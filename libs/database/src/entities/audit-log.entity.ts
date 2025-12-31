import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject } from 'class-validator';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';

@Entity('audit_logs')
@Index(['tenantId'])
@Index(['userId'])
@Index(['resource'])
@Index(['action'])
@Index(['createdAt'])
export class AuditLog extends BaseEntity {
  @ApiProperty({
    description: 'Action performed',
    example: 'CREATE',
  })
  @Column()
  @IsString()
  action: string;

  @ApiProperty({
    description: 'Resource affected',
    example: 'User',
  })
  @Column()
  @IsString()
  resource: string;

  @ApiProperty({
    description: 'Resource ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Column()
  @IsString()
  resourceId: string;

  @ApiProperty({
    description: 'Previous values before change',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  @IsObject()
  oldValues?: Record<string, any>;

  @ApiProperty({
    description: 'New values after change',
    required: false,
  })
  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  @IsObject()
  newValues?: Record<string, any>;

  @ApiProperty({
    description: 'IP address of the user',
    example: '192.168.1.1',
    required: false,
  })
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({
    description: 'User agent string',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  userAgent?: string;

  // Foreign keys
  @Column('uuid')
  tenantId: string;

  @Column('uuid')
  userId: string;

  // Relationships
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @ManyToOne(() => User, (user) => user.auditLogs, { onDelete: 'CASCADE' })
  user: User;
}