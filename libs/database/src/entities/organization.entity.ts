import { Entity, Column, ManyToOne, OneToMany, Tree, TreeParent, TreeChildren, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsObject, Length } from 'class-validator';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';

@Entity('organizations')
@Tree('materialized-path')
@Index(['tenantId'])
@Index(['tenantId', 'name'])
export class Organization extends BaseEntity {
  @ApiProperty({
    description: 'Organization name',
    example: 'Sales Department',
    maxLength: 100,
  })
  @Column({ length: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({
    description: 'Organization description',
    example: 'Handles all sales operations and customer relationships',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Organization code or identifier',
    example: 'SALES_DEPT',
    required: false,
  })
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    description: 'Whether the organization is active',
    example: true,
  })
  @Column({ default: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'Organization-specific settings',
    example: {
      allowSubOrganizations: true,
      maxUsers: 100,
      features: ['crm', 'reports'],
    },
    required: false,
  })
  @Column({ type: 'jsonb', default: {} })
  @IsObject()
  settings: Record<string, any>;

  @ApiProperty({
    description: 'Organization contact email',
    example: 'sales@acme.com',
    required: false,
  })
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Organization contact phone',
    example: '+1234567890',
    required: false,
  })
  @Column({ nullable: true })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Organization address',
    example: '123 Business St, City, State 12345',
    required: false,
  })
  @Column({ type: 'text', nullable: true })
  @IsOptional()
  @IsString()
  address?: string;

  // Foreign keys
  @Column('uuid')
  tenantId: string;

  // Relationships
  @ManyToOne(() => Tenant, (tenant) => tenant.organizations, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @TreeParent()
  parent?: Organization;

  @TreeChildren()
  children: Organization[];

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  // Virtual properties
  get userCount(): number {
    return this.users?.length || 0;
  }

  get hasChildren(): boolean {
    return this.children?.length > 0;
  }

  get level(): number {
    // Calculate organization hierarchy level
    let level = 0;
    let current = this.parent;
    while (current) {
      level++;
      current = current.parent;
    }
    return level;
  }

  // Methods
  getPath(): string[] {
    const path: string[] = [];
    let current: Organization = this;
    
    while (current) {
      path.unshift(current.name);
      current = current.parent;
    }
    
    return path;
  }

  getFullPath(): string {
    return this.getPath().join(' > ');
  }
}