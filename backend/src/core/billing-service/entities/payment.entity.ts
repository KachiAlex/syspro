import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';

export enum PaymentStatus {
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  PENDING = 'pending',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum PaymentGateway {
  STRIPE = 'STRIPE',
  FLUTTERWAVE = 'FLUTTERWAVE',
  PAYSTACK = 'PAYSTACK',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.payments)
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column()
  invoiceId: string;

  @Column({
    type: 'enum',
    enum: PaymentGateway,
  })
  gateway: PaymentGateway;

  @Column()
  gatewayChargeId: string; // Encrypted payment gateway charge ID

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}

