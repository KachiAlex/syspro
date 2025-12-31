import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { BaseEntity } from './base.entity';
import { UserRole } from './user-role.entity';

@Entity('permissions')
@Index(['roleId'])
@Index(['resource', 'action'])
export class Permission extends BaseEntity {
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
    description: 'Additional conditions for the permission',
    example: { ownResource: true },
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>;

  // Foreign keys
  @Column('uuid')
  roleId: string;

  // Relationships
  @ManyToOne(() => UserRole, (role) => role.permissions, { onDelete: 'CASCADE' })
  role: UserRole;
}