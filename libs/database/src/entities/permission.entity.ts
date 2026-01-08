import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsBoolean, IsUUID } from 'class-validator';
import { BaseEntity } from './base.entity';
import { UserRole } from './user-role.entity';

@Entity('permissions')
@Index(['roleId'])
@Index(['resource', 'action'])
@Index(['tenantId', 'name'], { unique: true })
export class Permission extends BaseEntity {
  @ApiProperty({
    description: 'Tenant that owns the permission',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Column('uuid')
  @IsUUID()
  tenantId: string;

  @ApiProperty({
    description: 'Unique permission identifier (module:resource:action)',
    example: 'crm:leads:read',
  })
  @Column({ length: 150 })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Human readable description',
    example: 'Allows viewing CRM leads',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Resource being protected',
    example: 'users',
  })
  @Column()
  @IsString()
  resource: string;

  @ApiProperty({
    description: 'Action being performed',
    example: 'create',
  })
  @Column()
  @IsString()
  action: string;

  @ApiProperty({
    description: 'Whether the permission is currently active',
    example: true,
    required: false,
  })
  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'Additional metadata for module context',
    example: { moduleName: 'crm', isCore: false },
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Additional conditions for the permission',
    example: { ownResource: true },
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  // Foreign keys
  @Column('uuid', { nullable: true })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  // Relationships
  @ManyToOne(() => UserRole, (role) => role.permissions, { onDelete: 'CASCADE' })
  role: UserRole;
}