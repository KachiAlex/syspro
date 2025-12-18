import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { Plan } from '../entities/plan.entity';
import { TenantContextService } from '../../../modules/tenant/tenant-context.service';
import { PaymentGatewayFactory } from '../factories/payment-gateway.factory';
import { EventPublisherService } from '../../../shared/events/event-publisher.service';
import { EventType } from '../../../shared/events/event.types';
import { ProrationService } from './proration.service';
import { Invoice } from '../entities/invoice.entity';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Plan)
    private planRepository: Repository<Plan>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    private readonly tenantContext: TenantContextService,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly eventPublisher: EventPublisherService,
    private readonly prorationService: ProrationService,
  ) {}

  async createSubscription(
    planId: string,
    gateway: string = 'STRIPE',
    trialDays?: number,
  ): Promise<Subscription> {
    const tenantId = this.tenantContext.requireTenant();
    const plan = await this.planRepository.findOne({ where: { id: planId } });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${planId} not found`);
    }

    // Check for existing active subscription
    const existing = await this.subscriptionRepository.findOne({
      where: {
        tenantId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existing) {
      throw new BadRequestException('Tenant already has an active subscription');
    }

    const gatewayAdapter = this.gatewayFactory.getAdapter(gateway);
    const now = new Date();
    const trialEnd = trialDays
      ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Create customer in payment gateway (if needed)
    // This would typically use tenant's billing contact info
    // For now, we'll create subscription without gateway integration in this step

    const subscription = this.subscriptionRepository.create({
      tenantId,
      planId: plan.id,
      status: trialEnd ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: this.calculatePeriodEnd(now, plan.billingCycle),
      trialEnd,
    });

    const saved = await this.subscriptionRepository.save(subscription);

    await this.eventPublisher.publish(EventType.TENANT_CREATED, {
      tenantId,
      subscriptionId: saved.id,
      planId: plan.id,
    });

    return saved;
  }

  async upgradeSubscription(
    subscriptionId: string,
    newPlanId: string,
  ): Promise<{ subscription: Subscription; prorationInvoice?: any }> {
    const tenantId = this.tenantContext.requireTenant();
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, tenantId },
      relations: ['plan'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const newPlan = await this.planRepository.findOne({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      throw new NotFoundException('New plan not found');
    }

    // Calculate proration using ProrationService
    const proration = this.prorationService.calculateProration(
      subscription,
      newPlan,
      new Date(), // Current date as upgrade date
    );

    // Update subscription
    subscription.planId = newPlan.id;
    subscription.proration = proration;

    const saved = await this.subscriptionRepository.save(subscription);

    // Note: Proration invoice will be created by billing service when needed
    // The proration data is stored in subscription.proration for reference

    await this.eventPublisher.publish(EventType.MODULE_UPDATED, {
      tenantId,
      subscriptionId: saved.id,
      oldPlanId: subscription.plan.id,
      newPlanId: newPlan.id,
    });

    return {
      subscription: saved,
      prorationInvoice: proration.amountCents !== 0 ? proration : undefined,
    };
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = true,
  ): Promise<Subscription> {
    const tenantId = this.tenantContext.requireTenant();
    const subscription = await this.subscriptionRepository.findOne({
      where: { id: subscriptionId, tenantId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (cancelAtPeriodEnd) {
      subscription.cancelAtPeriodEnd = true;
    } else {
      subscription.status = SubscriptionStatus.CANCELED;
      subscription.canceledAt = new Date();
    }

    return this.subscriptionRepository.save(subscription);
  }

  async getCurrentSubscription(): Promise<Subscription | null> {
    const tenantId = this.tenantContext.requireTenant();

    return this.subscriptionRepository.findOne({
      where: {
        tenantId,
        status: SubscriptionStatus.ACTIVE,
      },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  private calculatePeriodEnd(startDate: Date, billingCycle: string): Date {
    const endDate = new Date(startDate);

    if (billingCycle === 'YEARLY') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    return endDate;
  }
}

