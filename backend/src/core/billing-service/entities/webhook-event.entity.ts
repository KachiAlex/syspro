import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_events')
@Index(['provider', 'providerEventId'], { unique: true })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  provider: string; // STRIPE, FLUTTERWAVE, PAYSTACK

  @Column()
  providerEventId: string; // Event ID from provider

  @Column()
  eventType: string; // invoice.payment_succeeded, etc.

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'timestamp' })
  processedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

