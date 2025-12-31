import { Entity, Column, ManyToOne, ManyToMany, OneToMany, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
import { Permission } from './permission.entity';

@Entity('user_roles')
@Index(['tenantId'])
@Index(['tenantId', 'name'], { unique: true })
export class UserRole extends BaseEntity {
  @ApiProperty({
    description: 'Role name',
    example: 'Admin',
    maxLength: 50,
  })
  @Column({ length: 50 })
  @IsString()
  @Length(1, 50)
  name: string;

  @ApiProperty({
    description: 'Role description',
    example: 'Full system administrator access',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Role code for programmatic access',
    example: 'ADMIN',
    required: false,
  })
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  code?: string;

  // Foreign keys
  @Column('uuid')
  tenantId: string;

  // Relationships
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @ManyToMany(() => User, (user) => user.roles)
  users: User[];

  @OneToMany(() => Permission, (permission) => permission.role)
  permissions: Permission[];
}