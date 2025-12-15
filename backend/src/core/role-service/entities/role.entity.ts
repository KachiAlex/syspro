import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { Permission } from './permission.entity';
import { RolePermission } from './role-permission.entity';
import { UserRole } from './user-role.entity';

export enum RoleScope {
  SYSTEM = 'SYSTEM', // Global system roles
  TENANT = 'TENANT', // Tenant-specific roles
  MODULE = 'MODULE', // Module-specific roles
}

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: RoleScope,
    default: RoleScope.TENANT,
  })
  scope: RoleScope;

  @Column({ nullable: true })
  tenantId: string; // null for SYSTEM scope

  @Column({ nullable: true })
  moduleId: string; // null for non-module roles

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystemRole: boolean; // Cannot be deleted if true

  @ManyToMany(() => Permission, (permission) => permission.roles)
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'roleId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permissionId', referencedColumnName: 'id' },
  })
  permissions: Permission[];

  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions: RolePermission[];

  @OneToMany(() => UserRole, (ur) => ur.role)
  userRoles: UserRole[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

