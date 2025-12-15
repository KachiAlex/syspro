import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TenantModule } from './tenant-module.entity';

export enum ModuleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DEPRECATED = 'DEPRECATED',
}

@Entity('modules')
export class Module {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string; // e.g., 'HR', 'FINANCE', 'CRM'

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  version: string; // Semantic versioning

  @Column({ type: 'text', nullable: true })
  author: string;

  @Column({ type: 'jsonb', nullable: true })
  dependencies: string[]; // Module codes this module depends on

  @Column({
    type: 'enum',
    enum: ModuleStatus,
    default: ModuleStatus.ACTIVE,
  })
  status: ModuleStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: false })
  isSystemModule: boolean; // Cannot be disabled if true

  @OneToMany(() => TenantModule, (tm) => tm.module)
  tenantModules: TenantModule[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

