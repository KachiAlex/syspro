import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('licenses')
@Index(['tenantId', 'moduleKey'], { unique: true })
export class License {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @Column()
  moduleKey: string; // e.g., 'HR', 'FINANCE', 'CRM'

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'int', nullable: true })
  quota: number; // e.g., seats limit, API calls limit

  @Column({ type: 'int', default: 0 })
  usedQuota: number; // Current usage

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date;

  @Column({ nullable: true })
  licenseKey: string; // Optional license key

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

