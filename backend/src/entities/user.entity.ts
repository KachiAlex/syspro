import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Organization } from './organization.entity';
import { Subsidiary } from './subsidiary.entity';
import { Department } from './department.entity';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  CEO = 'CEO',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
  HR = 'HR',
  FINANCE = 'FINANCE',
  IT = 'IT',
  MARKETING = 'MARKETING',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.EMPLOYEE,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @ManyToOne(() => Organization, (org) => org.users)
  @JoinColumn({ name: 'organizationId' })
  organization: Organization;

  @Column()
  organizationId: string;

  @ManyToOne(() => Subsidiary, (subsidiary) => subsidiary.users, { nullable: true })
  @JoinColumn({ name: 'subsidiaryId' })
  subsidiary: Subsidiary;

  @Column({ nullable: true })
  subsidiaryId: string;

  @ManyToOne(() => Department, (dept) => dept.users, { nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ nullable: true })
  departmentId: string;

  @Column()
  tenantId: string;

  @Column({ type: 'jsonb', nullable: true })
  permissions: string[];

  @Column({ default: false })
  mfaEnabled: boolean;

  @Column({ nullable: true })
  mfaSecret: string;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }
}


