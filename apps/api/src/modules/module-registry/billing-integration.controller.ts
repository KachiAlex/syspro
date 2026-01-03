import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BillingIntegrationService } from './billing-integration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import {
  BillingLineItemDto,
  UpdateModulePricingDto,
  ProrationCalculationDto,
  InvoiceDto,
  GetBillingLineItemsQueryDto,
  GenerateInvoiceDto,
  BillingMetricsDto,
} from './dto/billing-integration.dto';

@ApiTags('Module Billing Integration')
@Controller('api/v1/billing/modules')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@ApiBearerAuth()
export class BillingIntegrationController {
  private readonly logger = new Logger(BillingIntegrationController.name);

  constructor(
    private readonly billingIntegrationService: BillingIntegrationService,
  ) {}

  @Get('line-items')
  @Roles('tenant_admin', 'billing_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Get billing line items for tenant modules' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of billing line items',
    type: [BillingLineItemDto],
  })
  async getBillingLineItems(
    @CurrentTenant() tenantId: string,
    @Query() query: GetBillingLineItemsQueryDto,
  ): Promise<BillingLineItemDto[]> {
    this.logger.log(`Getting billing line items for tenant ${tenantId}`);
    
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    const lineItems = await this.billingIntegrationService.getBillingLineItems(
      tenantId,
      startDate,
      endDate,
    );

    // Convert to DTOs with proper string formatting
    let filteredItems = lineItems.map(item => ({
      ...item,
      billingPeriodStart: item.billingPeriodStart.toISOString(),
      billingPeriodEnd: item.billingPeriodEnd.toISOString(),
      createdAt: item.createdAt.toISOString(),
    }));

    // Filter by module name if specified
    if (query.moduleName) {
      filteredItems = filteredItems.filter(item => item.moduleName === query.moduleName);
    }

    // Filter by pricing model if specified
    if (query.pricingModel) {
      filteredItems = filteredItems.filter(item => item.pricingModel === query.pricingModel);
    }

    return filteredItems;
  }

  @Post('invoice/generate')
  @Roles('tenant_admin', 'billing_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Generate invoice for tenant module usage' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invoice generated successfully',
    type: InvoiceDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid billing period or no line items found',
  })
  async generateInvoice(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() generateDto: GenerateInvoiceDto,
  ): Promise<InvoiceDto> {
    this.logger.log(`Generating invoice for tenant ${tenantId}`);

    const billingPeriod = {
      start: new Date(generateDto.billingPeriodStart),
      end: new Date(generateDto.billingPeriodEnd),
    };

    const invoice = await this.billingIntegrationService.generateInvoice(
      tenantId,
      billingPeriod,
    );

    return {
      invoiceId: invoice.invoiceId,
      tenantId: invoice.tenantId,
      billingPeriod: {
        start: invoice.billingPeriod.start.toISOString(),
        end: invoice.billingPeriod.end.toISOString(),
      },
      lineItems: invoice.lineItems.map(item => ({
        ...item,
        billingPeriodStart: item.billingPeriodStart.toISOString(),
        billingPeriodEnd: item.billingPeriodEnd.toISOString(),
        createdAt: item.createdAt.toISOString(),
      })),
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      dueDate: invoice.dueDate.toISOString(),
    };
  }

  @Get('proration/:moduleName')
  @Roles('tenant_admin', 'billing_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Calculate proration for module enablement/disablement' })
  @ApiParam({ name: 'moduleName', description: 'Module name' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Proration calculation result',
    type: ProrationCalculationDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  async calculateProration(
    @CurrentTenant() tenantId: string,
    @Param('moduleName') moduleName: string,
    @Query('effectiveDate') effectiveDate?: string,
  ): Promise<ProrationCalculationDto> {
    this.logger.log(`Calculating proration for module ${moduleName} for tenant ${tenantId}`);

    const startDate = effectiveDate ? new Date(effectiveDate) : new Date();
    
    // Get current billing period end (mock implementation)
    const billingPeriodEnd = new Date();
    billingPeriodEnd.setMonth(billingPeriodEnd.getMonth() + 1);
    billingPeriodEnd.setDate(0); // Last day of current month

    const proration = this.billingIntegrationService.calculateProration(
      startDate,
      billingPeriodEnd,
    );

    return proration;
  }

  // Admin-only endpoints for pricing management

  @Put('admin/modules/:moduleId/pricing')
  @Roles('billing_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Update module pricing (Admin only)' })
  @ApiParam({ name: 'moduleId', description: 'Module ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Module pricing updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Module not found',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid pricing data',
  })
  async updateModulePricing(
    @Param('moduleId') moduleId: string,
    @Body() updateDto: UpdateModulePricingDto,
  ): Promise<{ message: string; moduleId: string; updatedFields: string[] }> {
    this.logger.log(`Updating pricing for module ${moduleId}`);

    const effectiveDate = updateDto.effectiveDate ? new Date(updateDto.effectiveDate) : new Date();

    await this.billingIntegrationService.updateModulePricing(moduleId, {
      ...updateDto,
      effectiveDate,
    });

    const updatedFields = Object.keys(updateDto).filter(key => updateDto[key] !== undefined);

    return {
      message: 'Module pricing updated successfully',
      moduleId,
      updatedFields,
    };
  }

  @Get('admin/metrics')
  @Roles('billing_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Get billing metrics across all tenants (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Billing metrics',
    type: BillingMetricsDto,
  })
  async getBillingMetrics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<BillingMetricsDto> {
    this.logger.log('Getting billing metrics for admin dashboard');

    // Mock implementation - in reality, this would aggregate data from all tenants
    // Mock metrics data
    const metrics: BillingMetricsDto = {
      totalRevenue: 125000.00,
      activeSubscriptions: 250,
      averageRevenuePerUser: 500.00,
      popularModules: [
        { moduleName: 'crm-module', enabledCount: 180, revenue: 45000.00 },
        { moduleName: 'inventory-module', enabledCount: 150, revenue: 37500.00 },
        { moduleName: 'analytics-module', enabledCount: 120, revenue: 30000.00 },
      ],
      revenueByPricingModel: {
        flat_rate: 75000.00,
        per_user: 40000.00,
        usage_based: 10000.00,
        free: 0.00,
      },
      monthlyRecurringRevenue: 125000.00,
    };

    return metrics;
  }

  @Get('admin/line-items/all')
  @Roles('billing_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Get all billing line items across tenants (Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All billing line items',
    type: [BillingLineItemDto],
  })
  async getAllBillingLineItems(
    @Query() query: GetBillingLineItemsQueryDto,
    @Query('tenantId') tenantId?: string,
  ): Promise<BillingLineItemDto[]> {
    this.logger.log('Getting all billing line items for admin view');

    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    if (tenantId) {
      // Get line items for specific tenant and convert to DTOs
      const lineItems = await this.billingIntegrationService.getBillingLineItems(
        tenantId,
        startDate,
        endDate,
      );
      
      return lineItems.map(item => ({
        ...item,
        billingPeriodStart: item.billingPeriodStart.toISOString(),
        billingPeriodEnd: item.billingPeriodEnd.toISOString(),
        createdAt: item.createdAt.toISOString(),
      }));
    }

    // Mock implementation - in reality, this would query across all tenants
    return [];
  }

  @Post('admin/invoice/generate/:tenantId')
  @Roles('billing_admin', 'system_admin', 'super_admin')
  @ApiOperation({ summary: 'Generate invoice for specific tenant (Admin only)' })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invoice generated successfully',
    type: InvoiceDto,
  })
  async generateInvoiceForTenant(
    @Param('tenantId') tenantId: string,
    @Body() generateDto: GenerateInvoiceDto,
  ): Promise<InvoiceDto> {
    this.logger.log(`Admin generating invoice for tenant ${tenantId}`);

    const billingPeriod = {
      start: new Date(generateDto.billingPeriodStart),
      end: new Date(generateDto.billingPeriodEnd),
    };

    const invoice = await this.billingIntegrationService.generateInvoice(
      tenantId,
      billingPeriod,
    );

    return {
      invoiceId: invoice.invoiceId,
      tenantId: invoice.tenantId,
      billingPeriod: {
        start: invoice.billingPeriod.start.toISOString(),
        end: invoice.billingPeriod.end.toISOString(),
      },
      lineItems: invoice.lineItems.map(item => ({
        ...item,
        billingPeriodStart: item.billingPeriodStart.toISOString(),
        billingPeriodEnd: item.billingPeriodEnd.toISOString(),
        createdAt: item.createdAt.toISOString(),
      })),
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      total: invoice.total,
      dueDate: invoice.dueDate.toISOString(),
    };
  }
}