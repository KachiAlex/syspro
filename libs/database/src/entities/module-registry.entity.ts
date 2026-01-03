import { Entity, Column, OneToMany, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsEnum, IsNumber, IsArray, IsObject, Length, Matches, Min } from 'class-validator';
import { BaseEntity } from './base.entity';
import { TenantModule } from './tenant-module.entity';

export enum ModuleCategory {
  CORE = 'core',
  BUSINESS = 'business',
  INTEGRATION = 'integration',
  ANALYTICS = 'analytics',
}

export enum PricingModel {
  FREE = 'free',
  FLAT_RATE = 'flat_rate',
  PER_USER = 'per_user',
  USAGE_BASED = 'usage_based',
}

@Entity('module_registry')
@Index(['category'])
@Index(['isActive'])
@Index(['name'], { unique: true })
export class ModuleRegistry extends BaseEntity {
  @ApiProperty({
    description: 'Unique module identifier',
    example: 'crm',
    maxLength: 100,
  })
  @Column({ length: 100, unique: true })
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
  @Column({ length: 200 })
  @IsString()
  @Length(2, 200)
  displayName: string;

  @ApiProperty({
    description: 'Module description',
    example: 'Comprehensive CRM system for managing customer relationships, leads, and sales pipeline',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Module category',
    enum: ModuleCategory,
    example: ModuleCategory.BUSINESS,
  })
  @Column({
    type: 'enum',
    enum: ModuleCategory,
  })
  @IsEnum(ModuleCategory)
  category: ModuleCategory;

  @ApiProperty({
    description: 'Module version',
    example: '1.2.3',
    maxLength: 20,
  })
  @Column({ length: 20 })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, {
    message: 'Version must follow semantic versioning (e.g., 1.2.3)',
  })
  version: string;

  @ApiProperty({
    description: 'Whether the module is active and available',
    example: true,
  })
  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'Whether this is a core module that cannot be disabled',
    example: false,
  })
  @Column({ default: false })
  @IsBoolean()
  isCore: boolean;

  @ApiProperty({
    description: 'Pricing model for the module',
    enum: PricingModel,
    example: PricingModel.PER_USER,
    required: false,
  })
  @Column({
    type: 'enum',
    enum: PricingModel,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiProperty({
    description: 'Base price for flat rate pricing',
    example: 29.99,
  })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({
    description: 'Per-user price for per-user pricing',
    example: 9.99,
  })
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  @IsNumber()
  @Min(0)
  perUserPrice: number;

  @ApiProperty({
    description: 'Required module dependencies',
    example: ['auth', 'tenant-management'],
    type: [String],
  })
  @Column({ type: 'jsonb', default: [] })
  @IsArray()
  @IsString({ each: true })
  dependencies: string[];

  @ApiProperty({
    description: 'Optional module dependencies that enhance functionality',
    example: ['notifications', 'analytics'],
    type: [String],
  })
  @Column({ type: 'jsonb', default: [] })
  @IsArray()
  @IsString({ each: true })
  optionalDependencies: string[];

  @ApiProperty({
    description: 'JSON schema for module configuration',
    example: {
      type: 'object',
      properties: {
        maxLeads: { type: 'number', default: 1000 },
        enableAutoAssignment: { type: 'boolean', default: true },
      },
    },
  })
  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  configurationSchema: Record<string, any>;

  @ApiProperty({
    description: 'Available feature flags for the module',
    example: {
      advancedReporting: { default: false, description: 'Enable advanced reporting features' },
      mobileApp: { default: true, description: 'Enable mobile app integration' },
    },
  })
  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  featureFlags: Record<string, any>;

  @ApiProperty({
    description: 'API endpoints protected by this module',
    example: ['/api/v1/crm/*', '/api/v1/leads/*', '/api/v1/customers/*'],
    type: [String],
  })
  @Column({ type: 'jsonb', default: [] })
  @IsArray()
  @IsString({ each: true })
  apiEndpoints: string[];

  // Relationships
  @OneToMany(() => TenantModule, (tenantModule) => tenantModule.moduleRegistry)
  tenantModules: TenantModule[];

  // Virtual properties
  get isFreeTier(): boolean {
    return this.pricingModel === PricingModel.FREE || this.basePrice === 0;
  }

  get hasDependencies(): boolean {
    return this.dependencies.length > 0;
  }

  get hasOptionalDependencies(): boolean {
    return this.optionalDependencies.length > 0;
  }

  // Methods
  validateConfiguration(config: Record<string, any>): boolean {
    // Basic validation - in a real implementation, use a JSON schema validator
    if (!this.configurationSchema || Object.keys(this.configurationSchema).length === 0) {
      return true; // No schema means any config is valid
    }

    // TODO: Implement proper JSON schema validation
    return true;
  }

  getDefaultConfiguration(): Record<string, any> {
    const defaults: Record<string, any> = {};
    
    if (this.configurationSchema?.properties) {
      Object.entries(this.configurationSchema.properties).forEach(([key, schema]: [string, any]) => {
        if (schema.default !== undefined) {
          defaults[key] = schema.default;
        }
      });
    }

    return defaults;
  }

  getDefaultFeatureFlags(): Record<string, boolean> {
    const defaults: Record<string, boolean> = {};
    
    Object.entries(this.featureFlags).forEach(([key, config]: [string, any]) => {
      defaults[key] = config.default || false;
    });

    return defaults;
  }
}