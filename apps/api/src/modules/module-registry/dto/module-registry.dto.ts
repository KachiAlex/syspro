import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsEnum, IsNumber, IsArray, IsObject, Length, Matches, Min } from 'class-validator';
import { ModuleCategory, PricingModel } from '@syspro/database';

export class CreateModuleDto {
  @ApiProperty({
    description: 'Unique module identifier',
    example: 'crm',
    maxLength: 100,
  })
  @IsString()
  @Length(2, 100)
  @Matches(/^[a-z0-9-_]+$/, {
    message: 'Module name must contain only lowercase letters, numbers, hyphens, and underscores',
  })
  name: string;

  @ApiProperty({
    description: 'Human-readable module name',
    example: 'Customer Relationship Management',
    maxLength: 200,
  })
  @IsString()
  @Length(2, 200)
  displayName: string;

  @ApiProperty({
    description: 'Module description',
    example: 'Comprehensive CRM system for managing customer relationships, leads, and sales pipeline',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Module category',
    enum: ModuleCategory,
    example: ModuleCategory.BUSINESS,
  })
  @IsEnum(ModuleCategory)
  category: ModuleCategory;

  @ApiProperty({
    description: 'Module version',
    example: '1.2.3',
    maxLength: 20,
  })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semantic versioning (e.g., 1.2.3)',
  })
  version: string;

  @ApiProperty({
    description: 'Whether this is a core module that cannot be disabled',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isCore?: boolean;

  @ApiProperty({
    description: 'Pricing model for the module',
    enum: PricingModel,
    example: PricingModel.PER_USER,
    required: false,
  })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiProperty({
    description: 'Base price for flat rate pricing',
    example: 29.99,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiProperty({
    description: 'Per-user price for per-user pricing',
    example: 9.99,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  perUserPrice?: number;

  @ApiProperty({
    description: 'Required module dependencies',
    example: ['auth', 'tenant-management'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dependencies?: string[];

  @ApiProperty({
    description: 'Optional module dependencies that enhance functionality',
    example: ['notifications', 'analytics'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionalDependencies?: string[];

  @ApiProperty({
    description: 'JSON schema for module configuration',
    example: {
      type: 'object',
      properties: {
        maxLeads: { type: 'number', default: 1000 },
        enableAutoAssignment: { type: 'boolean', default: true },
      },
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  configurationSchema?: Record<string, any>;

  @ApiProperty({
    description: 'Available feature flags for the module',
    example: {
      advancedReporting: { default: false, description: 'Enable advanced reporting features' },
      mobileApp: { default: true, description: 'Enable mobile app integration' },
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, any>;

  @ApiProperty({
    description: 'API endpoints protected by this module',
    example: ['/api/v1/crm/*', '/api/v1/leads/*', '/api/v1/customers/*'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  apiEndpoints?: string[];
}

export class UpdateModuleDto extends PartialType(CreateModuleDto) {
  @ApiProperty({
    description: 'Module name cannot be updated',
    readOnly: true,
  })
  name?: never; // Prevent name updates
}

export class ModuleStatusDto {
  @ApiProperty({
    description: 'Whether the module should be active',
    example: true,
  })
  @IsBoolean()
  isActive: boolean;
}

export class ModuleCompatibilityCheckDto {
  @ApiProperty({
    description: 'List of module names to check compatibility for',
    example: ['crm', 'hr', 'projects'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  modules: string[];
}

export class ModuleCompatibilityResultDto {
  @ApiProperty({
    description: 'Whether the modules are compatible',
    example: true,
  })
  isCompatible: boolean;

  @ApiProperty({
    description: 'List of compatibility conflicts',
    example: ['Module X conflicts with Module Y'],
    type: [String],
  })
  conflicts: string[];

  @ApiProperty({
    description: 'List of missing dependencies',
    example: ['Module A requires Module B'],
    type: [String],
  })
  missingDependencies: string[];
}

export class ModuleDependencyTreeDto {
  @ApiProperty({
    description: 'The main module',
  })
  module: any; // Will be ModuleRegistry entity

  @ApiProperty({
    description: 'Required dependencies',
    type: [Object],
  })
  dependencies: any[];

  @ApiProperty({
    description: 'Optional dependencies',
    type: [Object],
  })
  optionalDependencies: any[];

  @ApiProperty({
    description: 'Modules that depend on this one',
    type: [Object],
  })
  dependents: any[];
}

export class ModuleStatisticsDto {
  @ApiProperty({
    description: 'Total number of modules',
    example: 25,
  })
  total: number;

  @ApiProperty({
    description: 'Number of active modules',
    example: 20,
  })
  active: number;

  @ApiProperty({
    description: 'Number of inactive modules',
    example: 5,
  })
  inactive: number;

  @ApiProperty({
    description: 'Number of core modules',
    example: 3,
  })
  core: number;

  @ApiProperty({
    description: 'Module count by category',
    example: {
      core: 3,
      business: 10,
      integration: 5,
      analytics: 2,
    },
  })
  byCategory: Record<ModuleCategory, number>;

  @ApiProperty({
    description: 'Module count by pricing model',
    example: {
      free: 5,
      flat_rate: 8,
      per_user: 10,
      usage_based: 2,
    },
  })
  byPricingModel: Record<PricingModel, number>;
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

  @ApiProperty({
    description: 'Operation to perform',
    enum: ['activate', 'deactivate'],
    example: 'activate',
  })
  @IsEnum(['activate', 'deactivate'])
  operation: 'activate' | 'deactivate';
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

  @ApiProperty({
    description: 'Total number of modules processed',
    example: 10,
  })
  total: number;

  @ApiProperty({
    description: 'Number of successful operations',
    example: 8,
  })
  successCount: number;

  @ApiProperty({
    description: 'Number of failed operations',
    example: 2,
  })
  failureCount: number;
}