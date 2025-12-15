import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: false })
  isEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  conditions: Record<string, any>; // For conditional feature flags

  @Column({ nullable: true })
  tenantId: string; // null for global flags

  @Column({ type: 'timestamp', nullable: true })
  enabledAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  disabledAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

