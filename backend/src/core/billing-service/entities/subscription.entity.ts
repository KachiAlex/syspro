import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Plan } from './plan.entity';
import { Invoice } from './invoice.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIALING = 'trialing',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid',
  SUSPENDED = 'suspended',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'planId' })
  plan: Plan;

  @Column()
  planId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.TRIALING,
  })
  status: SubscriptionStatus;

  @Column({ type: 'timestamp' })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp' })
  currentPeriodEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  trialEnd: Date;

  @Column({ type: 'timestamp', nullable: true })
  canceledAt: Date;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'jsonb', nullable: true })
  proration: Record<string, any>; // Proration details for upgrades/downgrades

  @Column({ nullable: true })
  gatewayCustomerId: string; // Payment gateway customer ID

  @Column({ nullable: true })
  gatewaySubscriptionId: string; // Payment gateway subscription ID

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => Invoice, (invoice) => invoice.subscription)
  invoices: Invoice[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

