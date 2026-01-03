import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsArray, IsBoolean, Length } from 'class-validator';

export class EnableModuleDto {
  @ApiProperty({
    description: 'Module name to enable',
    example: 'crm',
    maxLength: 100,
  })
  @IsString()
  @Length(2, 100)
  moduleName: string;

  @ApiProperty({
    description: 'Initial configuration for the module',
    example: {
      maxLeads: 500,
      enableAutoAssignment: false,
      customFields: ['industry', 'company_size'],
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;
}

export class UpdateModuleConfigDto {
  @ApiProperty({
    description: 'Updated module configuration',
    example: {
      maxLeads: 1000,
      enableAutoAssignment: true,
      customFields: ['industry', 'company_size', 'revenue'],
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  configuration?: Record<string, any>;

  @ApiProperty({
    description: 'Updated feature flag settings',
    example: {
      advancedReporting: true,
      mobileApp: false,
      customDashboard: true,
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;
}

export class ToggleFeatureFlagDto {
  @ApiProperty({
    description: 'Feature flag name',
    example: 'advancedReporting',
  })
  @IsString()
  flagName: string;

  @ApiProperty({
    description: 'Whether to enable or disable the feature',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;
}

export class BulkModuleOperationDto {
  @ApiProperty({
    description: 'List of module names to operate on',
    example: ['crm', 'hr', 'projects'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  moduleNames: string[];
}

export class BulkModuleOperationResultDto {
  @ApiProperty({
    description: 'Successfully processed modules',
    type: [String],
  })
  successful: string[];

  @ApiProperty({
    description: 'Failed modules with error messages',
    example: {
      'module-name': 'Error message',
    },
  })
  failed: Record<string, string>;
}

export class TenantModuleUsageSummaryDto {
  @ApiProperty({
    description: 'Total number of modules available',
    example: 25,
  })
  totalModules: number;

  @ApiProperty({
    description: 'Number of enabled modules',
    example: 12,
  })
  enabledModules: number;

  @ApiProperty({
    description: 'Number of core modules enabled',
    example: 3,
  })
  coreModules: number;

  @ApiProperty({
    description: 'Number of business modules enabled',
    example: 6,
  })
  businessModules: number;

  @ApiProperty({
    description: 'Number of integration modules enabled',
    example: 2,
  })
  integrationModules: number;

  @ApiProperty({
    description: 'Number of analytics modules enabled',
    example: 1,
  })
  analyticsModules: number;

  @ApiProperty({
    description: 'Module count by pricing model',
    example: {
      free: 3,
      flat_rate: 4,
      per_user: 5,
      usage_based: 0,
    },
  })
  modulesByPricing: Record<string, number>;
}

export class TenantModuleListDto {
  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  tenantId: string;

  @ApiProperty({
    description: 'Module name',
    example: 'crm',
  })
  moduleName: string;

  @ApiProperty({
    description: 'Whether the module is enabled',
    example: true,
  })
  isEnabled: boolean;

  @ApiProperty({
    description: 'Module version',
    example: '1.2.3',
  })
  version: string;

  @ApiProperty({
    description: 'Module configuration',
    example: {
      maxLeads: 1000,
      enableAutoAssignment: true,
    },
  })
  configuration: Record<string, any>;

  @ApiProperty({
    description: 'Feature flag settings',
    example: {
      advancedReporting: true,
      mobileApp: false,
    },
  })
  featureFlags: Record<string, boolean>;

  @ApiProperty({
    description: 'When the module was enabled',
    example: '2023-12-01T10:00:00.000Z',
  })
  enabledAt: Date;

  @ApiProperty({
    description: 'User who enabled the module',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  enabledBy?: string;

  @ApiProperty({
    description: 'Module registry information',
    required: false,
  })
  moduleRegistry?: any; // Will be ModuleRegistry entity
}