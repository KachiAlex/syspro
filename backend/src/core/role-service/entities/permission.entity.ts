import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
} from 'typeorm';
import { Role } from './role.entity';

export enum PermissionResource {
  USER = 'USER',
  TENANT = 'TENANT',
  ROLE = 'ROLE',
  MODULE = 'MODULE',
  CONFIG = 'CONFIG',
  FILE = 'FILE',
  NOTIFICATION = 'NOTIFICATION',
  AUDIT = 'AUDIT',
  // Module-specific resources
  HR = 'HR',
  FINANCE = 'FINANCE',
  CRM = 'CRM',
  INVENTORY = 'INVENTORY',
  PROJECT = 'PROJECT',
}

export enum PermissionAction {
  CREATE = 'CREATE',
  READ = 'READ',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  EXECUTE = 'EXECUTE',
  MANAGE = 'MANAGE', // Full control
}

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string; // Format: RESOURCE:ACTION (e.g., USER:CREATE)

  @Column({
    type: 'enum',
    enum: PermissionResource,
  })
  resource: PermissionResource;

  @Column({
    type: 'enum',
    enum: PermissionAction,
  })
  action: PermissionAction;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

