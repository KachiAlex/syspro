import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Subscription } from './subscription.entity';

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string; // e.g., 'free', 'starter', 'pro', 'enterprise'

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: BillingCycle,
    default: BillingCycle.MONTHLY,
  })
  billingCycle: BillingCycle;

  @Column({ type: 'int' })
  priceCents: number; // Price in cents

  @Column({ default: 'USD' })
  currency: string;

  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, any>; // Module toggles, limits, etc.

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystemPlan: boolean; // Cannot be deleted if true

  @OneToMany(() => Subscription, (subscription) => subscription.plan)
  subscriptions: Subscription[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

