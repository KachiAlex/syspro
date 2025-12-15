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
import { Subscription } from './subscription.entity';
import { Payment } from './payment.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  FAILED = 'failed',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Subscription, (subscription) => subscription.invoices, {
    nullable: true,
  })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;

  @Column({ nullable: true })
  subscriptionId: string;

  @Column({ unique: true })
  invoiceNumber: string; // Format: INV-YYYYMMDD-XXXX

  @Column({ type: 'int' })
  amountDueCents: number;

  @Column({ type: 'int', default: 0 })
  amountPaidCents: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({ nullable: true })
  pdfUrl: string; // Local file path or URL for PDF

  @Column({ type: 'timestamp' })
  issuedAt: Date;

  @Column({ type: 'timestamp' })
  dueAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments: Payment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

