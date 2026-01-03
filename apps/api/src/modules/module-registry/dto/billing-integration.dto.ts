import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PricingModel } from '@syspro/database';

export class BillingLineItemDto {
  @ApiProperty({ description: 'Unique identifier for the billing line item' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'Subscription ID' })
  @IsString()
  subscriptionId: string;

  @ApiProperty({ description: 'Module ID' })
  @IsString()
  moduleId: string;

  @ApiProperty({ description: 'Module name' })
  @IsString()
  moduleName: string;

  @ApiProperty({ description: 'Line item description' })
  @IsString()
  description: string;

  @ApiProperty({ 
    description: 'Pricing model',
    enum: PricingModel
  })
  @IsEnum(PricingModel)
  pricingModel: PricingModel;

  @ApiProperty({ description: 'Base price for the module' })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({ description: 'Per-user price for the module' })
  @IsNumber()
  @Min(0)
  perUserPrice: number;

  @ApiProperty({ description: 'Quantity (e.g., number of users)' })
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty({ description: 'Total amount for this line item' })
  @IsNumber()
  totalAmount: number;

  @ApiProperty({ description: 'Proration factor (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  prorationFactor: number;

  @ApiProperty({ description: 'Billing period start date' })
  @IsDateString()
  billingPeriodStart: string;

  @ApiProperty({ description: 'Billing period end date' })
  @IsDateString()
  billingPeriodEnd: string;

  @ApiProperty({ description: 'Creation timestamp' })
  @IsDateString()
  createdAt: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateModulePricingDto {
  @ApiPropertyOptional({ 
    description: 'New pricing model',
    enum: PricingModel
  })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional({ description: 'New base price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ description: 'New per-user price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perUserPrice?: number;

  @ApiPropertyOptional({ description: 'Effective date for pricing change' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ description: 'Reason for pricing change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ProrationCalculationDto {
  @ApiProperty({ description: 'Total days in the billing period' })
  @IsNumber()
  @Min(0)
  fullPeriodDays: number;

  @ApiProperty({ description: 'Days used in the billing period' })
  @IsNumber()
  @Min(0)
  usedDays: number;

  @ApiProperty({ description: 'Proration factor (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  prorationFactor: number;

  @ApiProperty({ description: 'Original amount before proration' })
  @IsNumber()
  @Min(0)
  originalAmount: number;

  @ApiProperty({ description: 'Prorated amount' })
  @IsNumber()
  @Min(0)
  prorationAmount: number;
}

export class BillingEventDto {
  @ApiProperty({ 
    description: 'Type of billing event',
    enum: ['module_enabled', 'module_disabled', 'module_upgraded', 'module_downgraded']
  })
  @IsEnum(['module_enabled', 'module_disabled', 'module_upgraded', 'module_downgraded'])
  type: 'module_enabled' | 'module_disabled' | 'module_upgraded' | 'module_downgraded';

  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'Module name' })
  @IsString()
  moduleName: string;

  @ApiProperty({ description: 'Module ID' })
  @IsString()
  moduleId: string;

  @ApiProperty({ description: 'User ID who triggered the event' })
  @IsString()
  userId: string;

  @ApiProperty({ description: 'Event timestamp' })
  @IsDateString()
  timestamp: string;

  @ApiPropertyOptional({ description: 'Additional event metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class InvoiceDto {
  @ApiProperty({ description: 'Invoice ID' })
  @IsString()
  invoiceId: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'Billing period' })
  @IsObject()
  billingPeriod: {
    start: string;
    end: string;
  };

  @ApiProperty({ description: 'Line items', type: [BillingLineItemDto] })
  @Type(() => BillingLineItemDto)
  lineItems: BillingLineItemDto[];

  @ApiProperty({ description: 'Subtotal amount' })
  @IsNumber()
  @Min(0)
  subtotal: number;

  @ApiProperty({ description: 'Tax amount' })
  @IsNumber()
  @Min(0)
  tax: number;

  @ApiProperty({ description: 'Total amount' })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({ description: 'Invoice due date' })
  @IsDateString()
  dueDate: string;
}

export class GetBillingLineItemsQueryDto {
  @ApiProperty({ description: 'Start date for billing period' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'End date for billing period' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({ description: 'Filter by module name' })
  @IsOptional()
  @IsString()
  moduleName?: string;

  @ApiPropertyOptional({ description: 'Filter by pricing model' })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;
}

export class GenerateInvoiceDto {
  @ApiProperty({ description: 'Billing period start date' })
  @IsDateString()
  billingPeriodStart: string;

  @ApiProperty({ description: 'Billing period end date' })
  @IsDateString()
  billingPeriodEnd: string;

  @ApiPropertyOptional({ description: 'Include draft line items' })
  @IsOptional()
  includeDraft?: boolean;
}

export class BillingMetricsDto {
  @ApiProperty({ description: 'Total revenue for the period' })
  @IsNumber()
  @Min(0)
  totalRevenue: number;

  @ApiProperty({ description: 'Number of active subscriptions' })
  @IsNumber()
  @Min(0)
  activeSubscriptions: number;

  @ApiProperty({ description: 'Average revenue per user' })
  @IsNumber()
  @Min(0)
  averageRevenuePerUser: number;

  @ApiProperty({ description: 'Most popular modules' })
  @IsObject()
  popularModules: Array<{
    moduleName: string;
    enabledCount: number;
    revenue: number;
  }>;

  @ApiProperty({ description: 'Revenue by pricing model' })
  @IsObject()
  revenueByPricingModel: Record<string, number>;

  @ApiProperty({ description: 'Monthly recurring revenue' })
  @IsNumber()
  @Min(0)
  monthlyRecurringRevenue: number;
}

export class BillingErrorDto {
  @ApiProperty({ description: 'Error type' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Tenant ID' })
  @IsString()
  tenantId: string;

  @ApiProperty({ description: 'Module name' })
  @IsString()
  moduleName: string;

  @ApiProperty({ description: 'Error message' })
  @IsString()
  error: string;

  @ApiProperty({ description: 'Original event that caused the error' })
  @IsObject()
  originalEvent: any;

  @ApiProperty({ description: 'Error timestamp' })
  @IsDateString()
  timestamp: string;
}