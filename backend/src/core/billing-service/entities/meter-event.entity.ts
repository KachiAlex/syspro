import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('meter_events')
@Index(['tenantId', 'eventType', 'recordedAt'])
export class MeterEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  eventType: string; // e.g., 'sms.sent', 'api.call', 'engineer.visit'

  @Column({ type: 'int', default: 1 })
  value: number; // Quantity/value of the event

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, any>; // Additional event metadata

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}

