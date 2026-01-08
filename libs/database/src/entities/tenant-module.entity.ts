import { Entity, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsObject, IsUUID, Length, Matches } from 'class-validator';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
import { ModuleRegistry } from './module-registry.entity';

@Entity('tenant_modules')
@Index(['tenantId', 'moduleName'], { unique: true })
@Index(['tenantId', 'isEnabled'])
@Index(['moduleName'])
export class TenantModule extends BaseEntity {
  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Column('uuid')
  @IsUUID()
  tenantId: string;

  @ApiProperty({
    description: 'Module name',
    example: 'crm',
    maxLength: 100,
  })
  @Column({ length: 100 })
  @IsString()
  @Length(2, 100)
  moduleName: string;

  @ApiProperty({
    description: 'Whether the module is currently enabled for this tenant',
    example: true,
  })
  @Column({ default: true })
  @IsBoolean()
  isEnabled: boolean;

  @ApiProperty({
    description: 'Module version enabled for this tenant',
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
    description: 'Tenant-specific module configuration',
    example: {
      maxLeads: 500,
      enableAutoAssignment: false,
      customFields: ['industry', 'company_size'],
    },
  })
  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  configuration: Record<string, any>;

  @ApiProperty({
    description: 'Tenant-specific feature flag settings',
    example: {
      advancedReporting: true,
      mobileApp: false,
      customDashboard: true,
    },
  })
  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  featureFlags: Record<string, boolean>;

  @ApiProperty({
    description: 'When the module was enabled',
    example: '2023-12-01T10:00:00.000Z',
  })
  @Column({ type: 'timestamp with time zone', default: () => 'NOW()' })
  enabledAt: Date;

  @ApiProperty({
    description: 'User who enabled the module',
    example: '123e4567-e89b-12d3-a456-426614174001',
    required: false,
  })
  @Column('uuid', { nullable: true })
  @IsOptional()
  @IsUUID()
  enabledBy?: string;

  @ApiProperty({
    description: 'When the module was disabled',
    example: '2023-12-15T15:30:00.000Z',
    required: false,
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  @IsOptional()
  disabledAt?: Date;

  @ApiProperty({
    description: 'User who disabled the module',
    example: '123e4567-e89b-12d3-a456-426614174002',
    required: false,
  })
  @Column('uuid', { nullable: true })
  @IsOptional()
  @IsUUID()
  disabledBy?: string;

  @ApiProperty({
    description: 'Configuration and feature flag change history',
    example: [
      {
        timestamp: '2024-01-01T12:00:00.000Z',
        userId: 'user-id',
        action: 'update',
        field: 'featureFlags.advancedReporting',
        oldValue: false,
        newValue: true,
      },
    ],
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  auditTrail?: Array<Record<string, any>>;

  // Relationships
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @ManyToOne(() => ModuleRegistry, (module) => module.tenantModules)
  @JoinColumn({ name: 'moduleName', referencedColumnName: 'name' })
  moduleRegistry: ModuleRegistry;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'enabledBy' })
  enabledByUser?: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'disabledBy' })
  disabledByUser?: User;

  // Virtual properties
  get isCurrentlyEnabled(): boolean {
    return this.isEnabled && !this.disabledAt;
  }

  get enablementDuration(): number | null {
    if (!this.enabledAt) return null;
    
    const endDate = this.disabledAt || new Date();
    return endDate.getTime() - this.enabledAt.getTime();
  }

  get hasCustomConfiguration(): boolean {
    return Object.keys(this.configuration).length > 0;
  }

  get enabledFeatureFlags(): string[] {
    return Object.entries(this.featureFlags)
      .filter(([_, enabled]) => enabled)
      .map(([flag, _]) => flag);
  }

  // Methods
  enable(userId?: string): void {
    this.isEnabled = true;
    this.enabledAt = new Date();
    this.enabledBy = userId;
    this.disabledAt = null;
    this.disabledBy = null;
  }

  disable(userId?: string): void {
    this.isEnabled = false;
    this.disabledAt = new Date();
    this.disabledBy = userId;
  }

  updateConfiguration(config: Record<string, any>): void {
    this.configuration = { ...this.configuration, ...config };
  }

  toggleFeatureFlag(flagName: string, enabled: boolean): void {
    this.featureFlags = {
      ...this.featureFlags,
      [flagName]: enabled,
    };
  }

  isFeatureEnabled(flagName: string): boolean {
    return this.featureFlags[flagName] || false;
  }

  getConfigurationValue<T = any>(key: string, defaultValue?: T): T {
    return this.configuration[key] ?? defaultValue;
  }
}