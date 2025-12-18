import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Module } from './module.entity';

@Entity('tenant_modules')
export class TenantModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Module)
  @JoinColumn({ name: 'moduleId' })
  module: Module;

  @Column()
  moduleId: string;

  @Column()
  tenantId: string;

  @Column({ default: true })
  isEnabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  enabledAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  disabledAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  licenseExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

