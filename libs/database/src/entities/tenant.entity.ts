import { Entity, Column, OneToMany, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsObject, Length, Matches } from 'class-validator';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Organization } from './organization.entity';
import { Subscription } from './subscription.entity';

export interface TenantSettings {
  timezone: string;
  currency: string;
  dateFormat: string;
  language: string;
  features: string[];
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

@Entity('tenants')
@Index(['code'], { unique: true })
@Index(['domain'], { unique: true, where: 'domain IS NOT NULL' })
export class Tenant extends BaseEntity {
  @ApiProperty({
    description: 'Tenant name',
    example: 'Acme Corporation',
    maxLength: 100,
  })
  @Column({ length: 100 })
  @IsString()
  @Length(2, 100)
  name: string;

  @ApiProperty({
    description: 'Unique tenant code',
    example: 'ACME_CORP',
    maxLength: 20,
  })
  @Column({ length: 20, unique: true })
  @IsString()
  @Length(2, 20)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Code must contain only uppercase letters, numbers, and underscores',
  })
  code: string;

  @ApiProperty({
    description: 'Tenant domain (optional)',
    example: 'acme.syspro.com',
    required: false,
  })
  @Column({ nullable: true, unique: true })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({
    description: 'Whether the tenant is active',
    example: true,
  })
  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'Tenant-specific settings and configuration',
    example: {
      timezone: 'UTC',
      currency: 'USD',
      dateFormat: 'YYYY-MM-DD',
      language: 'en',
      features: ['crm', 'inventory'],
    },
  })
  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  settings: TenantSettings;

  @ApiProperty({
    description: 'Database schema name for this tenant',
    example: 'tenant_acme_corp',
  })
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  schemaName?: string;

  // Relationships
  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Organization, (organization) => organization.tenant)
  organizations: Organization[];

  @OneToMany(() => Subscription, (subscription) => subscription.tenant)
  subscriptions: Subscription[];

  // Virtual properties
  get isTrialing(): boolean {
    return this.subscriptions?.some(
      (sub) => sub.status === 'trialing' && sub.trialEnd && sub.trialEnd > new Date(),
    ) || false;
  }

  get activeSubscription(): Subscription | undefined {
    return this.subscriptions?.find((sub) => sub.status === 'active');
  }
}