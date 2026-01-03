import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ModuleRegistry, TenantModule, Subscription, PricingModel } from '@syspro/database';
import { CacheService } from '../../shared/services/cache.service';

export interface BillingLineItem {
  id: string;
  tenantId: string;
  subscriptionId: string;
  moduleId: string;
  moduleName: string;
  description: string;
  pricingModel: PricingModel;
  basePrice: number;
  perUserPrice: number;
  quantity: number;
  totalAmount: number;
  prorationFactor: number;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface ProrationCalculation {
  fullPeriodDays: number;
  usedDays: number;
  prorationFactor: number;
  originalAmount: number;
  prorationAmount: number;
}

export interface BillingEvent {
  type: 'module_enabled' | 'module_disabled' | 'module_upgraded' | 'module_downgraded';
  tenantId: string;
  moduleName: string;
  moduleId: string;
  userId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class BillingIntegrationService {
  private readonly logger = new Logger(BillingIntegrationService.name);

  constructor(
    @InjectRepository(ModuleRegistry)
    private moduleRepository: Repository<ModuleRegistry>,
    @InjectRepository(TenantModule)
    private tenantModuleRepository: Repository<TenantModule>,
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    private cacheService: CacheService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle module enabled event for billing
   */
  @OnEvent('module.enabled')
  async handleModuleEnabled(event: BillingEvent): Promise<void> {
    this.logger.log(`Processing billing for module enabled: ${event.moduleName} for tenant ${event.tenantId}`);

    try {
      const module = await this.getModuleWithPricing(event.moduleName);
      if (!module || module.pricingModel === PricingModel.FREE) {
        this.logger.debug(`Module ${event.moduleName} is free, skipping billing`);
        return;
      }

      const subscription = await this.getTenantSubscription(event.tenantId);
      if (!subscription) {
        this.logger.warn(`No active subscription found for tenant ${event.tenantId}`);
        return;
      }

      const billingLineItem = await this.createBillingLineItem({
        tenantId: event.tenantId,
        subscriptionId: subscription.id,
        module,
        operation: 'enable',
        effectiveDate: event.timestamp,
        metadata: event.metadata,
      });

      // Emit billing event for external systems
      this.eventEmitter.emit('billing.line_item.created', {
        lineItem: billingLineItem,
        event,
      });

      this.logger.log(`Billing line item created for module ${event.moduleName}: ${billingLineItem.id}`);

    } catch (error) {
      this.logger.error(`Failed to process billing for module enabled: ${error.message}`, error.stack);
      
      // Emit billing error event
      this.eventEmitter.emit('billing.error', {
        type: 'module_enabled_billing_failed',
        tenantId: event.tenantId,
        moduleName: event.moduleName,
        error: error.message,
        originalEvent: event,
      });
    }
  }

  /**
   * Handle module disabled event for billing
   */
  @OnEvent('module.disabled')
  async handleModuleDisabled(event: BillingEvent): Promise<void> {
    this.logger.log(`Processing billing for module disabled: ${event.moduleName} for tenant ${event.tenantId}`);

    try {
      const module = await this.getModuleWithPricing(event.moduleName);
      if (!module || module.pricingModel === PricingModel.FREE) {
        this.logger.debug(`Module ${event.moduleName} is free, skipping billing adjustment`);
        return;
      }

      const subscription = await this.getTenantSubscription(event.tenantId);
      if (!subscription) {
        this.logger.warn(`No active subscription found for tenant ${event.tenantId}`);
        return;
      }

      // Calculate proration for the unused period
      const prorationAdjustment = await this.calculateProrationAdjustment({
        tenantId: event.tenantId,
        module,
        disabledDate: event.timestamp,
        subscription,
      });

      if (prorationAdjustment.prorationAmount > 0) {
        const creditLineItem = await this.createCreditLineItem({
          tenantId: event.tenantId,
          subscriptionId: subscription.id,
          module,
          prorationAdjustment,
          effectiveDate: event.timestamp,
          metadata: event.metadata,
        });

        // Emit billing credit event
        this.eventEmitter.emit('billing.credit.created', {
          creditLineItem,
          prorationAdjustment,
          event,
        });

        this.logger.log(`Billing credit created for module ${event.moduleName}: ${creditLineItem.id}`);
      }

    } catch (error) {
      this.logger.error(`Failed to process billing for module disabled: ${error.message}`, error.stack);
      
      this.eventEmitter.emit('billing.error', {
        type: 'module_disabled_billing_failed',
        tenantId: event.tenantId,
        moduleName: event.moduleName,
        error: error.message,
        originalEvent: event,
      });
    }
  }

  /**
   * Create billing line item for module enablement
   */
  async createBillingLineItem(params: {
    tenantId: string;
    subscriptionId: string;
    module: ModuleRegistry;
    operation: 'enable' | 'upgrade' | 'downgrade';
    effectiveDate: Date;
    metadata?: Record<string, any>;
  }): Promise<BillingLineItem> {
    const { tenantId, subscriptionId, module, operation, effectiveDate, metadata } = params;

    // Get current billing period
    const billingPeriod = await this.getCurrentBillingPeriod(subscriptionId);
    
    // Calculate proration if enabled mid-period
    const proration = this.calculateProration(effectiveDate, billingPeriod.end);
    
    // Calculate pricing based on model
    const pricing = await this.calculateModulePricing({
      tenantId,
      module,
      billingPeriod,
      proration,
    });

    const lineItem: BillingLineItem = {
      id: this.generateLineItemId(),
      tenantId,
      subscriptionId,
      moduleId: module.id,
      moduleName: module.name,
      description: this.generateLineItemDescription(module, operation, proration),
      pricingModel: module.pricingModel as any,
      basePrice: module.basePrice || 0,
      perUserPrice: module.perUserPrice || 0,
      quantity: pricing.quantity,
      totalAmount: pricing.totalAmount,
      prorationFactor: proration.prorationFactor,
      billingPeriodStart: billingPeriod.start,
      billingPeriodEnd: billingPeriod.end,
      createdAt: new Date(),
      metadata: {
        operation,
        effectiveDate: effectiveDate.toISOString(),
        ...metadata,
      },
    };

    // Store in cache for quick access
    await this.cacheService.set(
      `billing:line_item:${lineItem.id}`,
      lineItem,
      3600 // 1 hour
    );

    return lineItem;
  }

  /**
   * Create credit line item for module disablement
   */
  async createCreditLineItem(params: {
    tenantId: string;
    subscriptionId: string;
    module: ModuleRegistry;
    prorationAdjustment: ProrationCalculation;
    effectiveDate: Date;
    metadata?: Record<string, any>;
  }): Promise<BillingLineItem> {
    const { tenantId, subscriptionId, module, prorationAdjustment, effectiveDate, metadata } = params;

    const billingPeriod = await this.getCurrentBillingPeriod(subscriptionId);

    const creditLineItem: BillingLineItem = {
      id: this.generateLineItemId(),
      tenantId,
      subscriptionId,
      moduleId: module.id,
      moduleName: module.name,
      description: `Credit for ${module.displayName} (disabled ${effectiveDate.toLocaleDateString()})`,
      pricingModel: module.pricingModel as any,
      basePrice: module.basePrice || 0,
      perUserPrice: module.perUserPrice || 0,
      quantity: 1,
      totalAmount: -prorationAdjustment.prorationAmount, // Negative for credit
      prorationFactor: prorationAdjustment.prorationFactor,
      billingPeriodStart: billingPeriod.start,
      billingPeriodEnd: billingPeriod.end,
      createdAt: new Date(),
      metadata: {
        operation: 'credit',
        effectiveDate: effectiveDate.toISOString(),
        originalAmount: prorationAdjustment.originalAmount,
        ...metadata,
      },
    };

    await this.cacheService.set(
      `billing:line_item:${creditLineItem.id}`,
      creditLineItem,
      3600
    );

    return creditLineItem;
  }

  /**
   * Calculate module pricing based on pricing model
   */
  async calculateModulePricing(params: {
    tenantId: string;
    module: ModuleRegistry;
    billingPeriod: { start: Date; end: Date };
    proration: ProrationCalculation;
  }): Promise<{ quantity: number; totalAmount: number }> {
    const { tenantId, module, proration } = params;

    switch (module.pricingModel) {
      case PricingModel.FLAT_RATE:
        return {
          quantity: 1,
          totalAmount: (module.basePrice || 0) * proration.prorationFactor,
        };

      case PricingModel.PER_USER:
        const userCount = await this.getTenantUserCount(tenantId);
        return {
          quantity: userCount,
          totalAmount: ((module.basePrice || 0) + (module.perUserPrice || 0) * userCount) * proration.prorationFactor,
        };

      case PricingModel.USAGE_BASED:
        // For usage-based, we'll create a base line item and usage will be calculated separately
        return {
          quantity: 1,
          totalAmount: (module.basePrice || 0) * proration.prorationFactor,
        };

      case PricingModel.FREE:
      default:
        return {
          quantity: 1,
          totalAmount: 0,
        };
    }
  }

  /**
   * Calculate proration for partial billing periods
   */
  calculateProration(startDate: Date, periodEndDate: Date): ProrationCalculation {
    const now = new Date();
    const effectiveStart = startDate > now ? startDate : now;
    
    const fullPeriodDays = Math.ceil((periodEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const usedDays = Math.ceil((periodEndDate.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
    
    const prorationFactor = fullPeriodDays > 0 ? usedDays / fullPeriodDays : 0;

    return {
      fullPeriodDays,
      usedDays,
      prorationFactor: Math.max(0, Math.min(1, prorationFactor)),
      originalAmount: 0, // Will be set by caller
      prorationAmount: 0, // Will be calculated by caller
    };
  }

  /**
   * Calculate proration adjustment for module disablement
   */
  async calculateProrationAdjustment(params: {
    tenantId: string;
    module: ModuleRegistry;
    disabledDate: Date;
    subscription: any;
  }): Promise<ProrationCalculation> {
    const { tenantId, module, disabledDate, subscription } = params;

    const billingPeriod = await this.getCurrentBillingPeriod(subscription.id);
    const remainingDays = Math.ceil((billingPeriod.end.getTime() - disabledDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = Math.ceil((billingPeriod.end.getTime() - billingPeriod.start.getTime()) / (1000 * 60 * 60 * 24));
    
    const prorationFactor = totalDays > 0 ? remainingDays / totalDays : 0;

    // Get the original pricing for this module
    const pricing = await this.calculateModulePricing({
      tenantId,
      module,
      billingPeriod,
      proration: { prorationFactor: 1, fullPeriodDays: totalDays, usedDays: totalDays, originalAmount: 0, prorationAmount: 0 },
    });

    const originalAmount = pricing.totalAmount;
    const prorationAmount = originalAmount * Math.max(0, prorationFactor);

    return {
      fullPeriodDays: totalDays,
      usedDays: remainingDays,
      prorationFactor: Math.max(0, prorationFactor),
      originalAmount,
      prorationAmount,
    };
  }

  /**
   * Get billing line items for a tenant and period
   */
  async getBillingLineItems(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BillingLineItem[]> {
    const cacheKey = `billing:line_items:${tenantId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    let lineItems = await this.cacheService.get<BillingLineItem[]>(cacheKey);

    if (!lineItems) {
      // In a real implementation, this would query a billing database
      // For now, we'll return an empty array as this is a mock implementation
      lineItems = [];
      await this.cacheService.set(cacheKey, lineItems, 300); // 5 minutes
    }

    return lineItems;
  }

  /**
   * Generate invoice for tenant
   */
  async generateInvoice(tenantId: string, billingPeriod: { start: Date; end: Date }): Promise<{
    invoiceId: string;
    tenantId: string;
    billingPeriod: { start: Date; end: Date };
    lineItems: BillingLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    dueDate: Date;
  }> {
    const lineItems = await this.getBillingLineItems(tenantId, billingPeriod.start, billingPeriod.end);
    
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
    const tax = subtotal * 0.1; // 10% tax rate (configurable)
    const total = subtotal + tax;

    const invoice = {
      invoiceId: this.generateInvoiceId(),
      tenantId,
      billingPeriod,
      lineItems,
      subtotal,
      tax,
      total,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    };

    // Emit invoice generated event
    this.eventEmitter.emit('billing.invoice.generated', invoice);

    return invoice;
  }

  /**
   * Support different pricing models
   */
  async updateModulePricing(
    moduleId: string,
    pricingUpdate: {
      pricingModel?: PricingModel;
      basePrice?: number;
      perUserPrice?: number;
      effectiveDate?: Date;
    },
  ): Promise<void> {
    const module = await this.moduleRepository.findOne({ where: { id: moduleId } });
    if (!module) {
      throw new Error(`Module not found: ${moduleId}`);
    }

    const effectiveDate = pricingUpdate.effectiveDate || new Date();

    // Update module pricing
    if (pricingUpdate.pricingModel !== undefined) {
      module.pricingModel = pricingUpdate.pricingModel;
    }
    if (pricingUpdate.basePrice !== undefined) {
      module.basePrice = pricingUpdate.basePrice;
    }
    if (pricingUpdate.perUserPrice !== undefined) {
      module.perUserPrice = pricingUpdate.perUserPrice;
    }

    await this.moduleRepository.save(module);

    // Clear cache
    await this.cacheService.del(`module:pricing:${module.name}`);

    // Emit pricing change event
    this.eventEmitter.emit('billing.pricing.updated', {
      moduleId,
      moduleName: module.name,
      pricingUpdate,
      effectiveDate,
    });

    this.logger.log(`Updated pricing for module ${module.name}: ${JSON.stringify(pricingUpdate)}`);
  }

  /**
   * Private helper methods
   */

  private async getModuleWithPricing(moduleName: string): Promise<ModuleRegistry | null> {
    const cacheKey = `module:pricing:${moduleName}`;
    let module = await this.cacheService.get<ModuleRegistry>(cacheKey);

    if (!module) {
      module = await this.moduleRepository.findOne({
        where: { name: moduleName, isActive: true },
      });

      if (module) {
        await this.cacheService.set(cacheKey, module, 3600); // 1 hour
      }
    }

    return module;
  }

  private async getTenantSubscription(tenantId: string): Promise<any> {
    // In a real implementation, this would query the subscription table
    // For now, return a mock subscription
    return {
      id: `sub_${tenantId}`,
      tenantId,
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };
  }

  private async getCurrentBillingPeriod(subscriptionId: string): Promise<{ start: Date; end: Date }> {
    // Mock implementation - in reality, this would query subscription data
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return { start, end };
  }

  private async getTenantUserCount(tenantId: string): Promise<number> {
    // Mock implementation - in reality, this would query user count
    return 5; // Default user count
  }

  private generateLineItemId(): string {
    return `li_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInvoiceId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateLineItemDescription(
    module: ModuleRegistry,
    operation: string,
    proration: ProrationCalculation,
  ): string {
    const baseDescription = `${module.displayName} - ${operation}`;
    
    if (proration.prorationFactor < 1) {
      const prorationPercent = Math.round(proration.prorationFactor * 100);
      return `${baseDescription} (${prorationPercent}% of billing period)`;
    }

    return baseDescription;
  }
}