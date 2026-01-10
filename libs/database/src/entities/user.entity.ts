import { Entity, Column, ManyToOne, OneToMany, ManyToMany, JoinTable, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsBoolean, IsOptional, IsEnum, Length } from 'class-validator';
import { Exclude } from 'class-transformer';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { Organization } from './organization.entity';
import { UserRole } from './user-role.entity';
import { AuditLog } from './audit-log.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

@Entity('users')
@Index(['email', 'tenantId'], { unique: true })
@Index(['tenantId'])
export class User extends BaseEntity {
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@acme.com',
  })
  @Column()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    maxLength: 50,
  })
  @Column({ length: 50 })
  @IsString()
  @Length(1, 50)
  firstName: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    maxLength: 50,
  })
  @Column({ length: 50 })
  @IsString()
  @Length(1, 50)
  lastName: string;

  @Column()
  @Exclude()
  password: string;

  @ApiProperty({
    description: 'User avatar URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+1234567890',
    required: false,
  })
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'User status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiProperty({
    description: 'Whether the user is active',
    example: true,
  })
  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'Email verification status',
    example: false,
  })
  @Column({ default: false })
  @IsBoolean()
  emailVerified: boolean;

  @ApiProperty({
    description: 'Last login timestamp',
    example: '2023-12-01T10:00:00.000Z',
    required: false,
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  lastLoginAt?: Date;

  @ApiProperty({
    description: 'Failed login attempts count',
    example: 0,
  })
  @Column({ default: 0 })
  failedLoginAttempts: number;

  @ApiProperty({
    description: 'Account locked until timestamp',
    required: false,
  })
  @Column({ type: 'timestamp with time zone', nullable: true })
  lockedUntil?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  @Exclude()
  passwordResetToken?: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  @Exclude()
  passwordResetExpires?: Date;

  @Column({ nullable: true })
  @Exclude()
  emailVerificationToken?: string;

  // Foreign keys
  @Column('uuid')
  tenantId: string;

  @Column('uuid', { nullable: true })
  organizationId?: string;

  // Relationships
  @ManyToOne(() => Tenant, (tenant) => tenant.users, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @ManyToOne(() => Organization, (organization) => organization.users, { 
    nullable: true,
    onDelete: 'SET NULL',
  })
  organization?: Organization;

  @ManyToMany(() => UserRole, (role) => role.users)
  @JoinTable({
    name: 'user_roles_junction',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'roleId', referencedColumnName: 'id' },
  })
  roles: UserRole[];

  @OneToMany(() => AuditLog, (auditLog) => auditLog.user)
  auditLogs: AuditLog[];

  // Virtual properties
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  get isLocked(): boolean {
    return this.lockedUntil ? this.lockedUntil > new Date() : false;
  }

  get canLogin(): boolean {
    return (
      this.isActive &&
      this.status === UserStatus.ACTIVE &&
      this.emailVerified &&
      !this.isLocked
    );
  }

  // Methods
  incrementFailedLoginAttempts(): void {
    this.failedLoginAttempts += 1;
    
    // Lock account after 5 failed attempts for 15 minutes
    if (this.failedLoginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
  }

  resetFailedLoginAttempts(): void {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
    this.lastLoginAt = new Date();
  }
}