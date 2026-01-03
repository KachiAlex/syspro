import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing'
}

@Entity('subscriptions')
@Index(['tenantId'])
@Index(['status'])
export class Subscription extends BaseEntity {
  @ApiProperty({
    description: 'Subscription status',
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIALING,
  })
  @IsEnum(SubscriptionStatus)
  status: SubscriptionStatus;

  @ApiProperty({
    description: 'Plan identifier',
    example: 'pro-monthly',
  })
  @Column()
  planId: string;

  @ApiProperty({
    description: 'Current billing period start',
    example: '2023-12-01T00:00:00.000Z',
  })
  @Column({ type: 'timestamp with time zone' })
  currentPeriodStart: Date;

  @ApiProperty({
    description: 'Current billing period end',
    example: '2023-12-31T23:59:59.000Z',
  })
  @Column({ type: 'timestamp with time zone' })
  currentPeriodEnd: Date;

  @ApiProperty({
    description: 'Whether to cancel at period end',
    example: false,
  })
  @Column({ default: false })
  @IsBoolean()
  cancelAtPeriodEnd: boolean;

  @ApiProperty({
    description: 'Trial end date',
    example: '2023-12-15T23:59:59.000Z',
    required: false,
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  @IsOptional()
  trialEnd?: Date;

  // Foreign keys
  @Column('uuid')
  tenantId: string;

  // Relationships
  @ManyToOne(() => Tenant, (tenant) => tenant.subscriptions, { onDelete: 'CASCADE' })
  tenant: Tenant;
}