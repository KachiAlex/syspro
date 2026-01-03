import { Entity, Column, ManyToOne, Index, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsUUID, IsOptional, Min, Max } from 'class-validator';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';

@Entity('module_usage_analytics')
@Index(['tenantId', 'date'])
@Index(['moduleName', 'date'])
@Index(['tenantId', 'moduleName', 'endpoint', 'date', 'hour'], { unique: true })
export class ModuleUsageAnalytics extends BaseEntity {
  @ApiProperty({
    description: 'Tenant ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @Column('uuid')
  @IsUUID()
  tenantId: string;

  @ApiProperty({
    description: 'Module name',
    example: 'crm',
    maxLength: 100,
  })
  @Column({ length: 100 })
  @IsString()
  moduleName: string;

  @ApiProperty({
    description: 'API endpoint accessed',
    example: '/api/v1/crm/leads',
    maxLength: 200,
    required: false,
  })
  @Column({ length: 200, nullable: true })
  @IsOptional()
  @IsString()
  endpoint?: string;

  @ApiProperty({
    description: 'Number of requests in this time period',
    example: 45,
  })
  @Column({ default: 1 })
  @IsNumber()
  @Min(0)
  requestCount: number;

  @ApiProperty({
    description: 'Average response time in milliseconds',
    example: 150,
    required: false,
  })
  @Column({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  responseTimeMs?: number;

  @ApiProperty({
    description: 'Number of errors in this time period',
    example: 2,
  })
  @Column({ default: 0 })
  @IsNumber()
  @Min(0)
  errorCount: number;

  @ApiProperty({
    description: 'Date of the analytics record',
    example: '2023-12-01',
  })
  @Column({ type: 'date' })
  date: Date;

  @ApiProperty({
    description: 'Hour of the day (0-23)',
    example: 14,
  })
  @Column()
  @IsNumber()
  @Min(0)
  @Max(23)
  hour: number;

  @ApiProperty({
    description: 'Additional metadata for the analytics record',
    example: {
      userAgent: 'Mozilla/5.0...',
      ipCountry: 'US',
      deviceType: 'desktop',
    },
    required: false,
  })
  @Column({ type: 'jsonb', default: {}, nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;

  // Relationships
  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  // Virtual properties
  get successRate(): number {
    if (this.requestCount === 0) return 0;
    return ((this.requestCount - this.errorCount) / this.requestCount) * 100;
  }

  get hasErrors(): boolean {
    return this.errorCount > 0;
  }

  get isHighTraffic(): boolean {
    return this.requestCount > 100; // Configurable threshold
  }

  get averageResponseTime(): number {
    return this.responseTimeMs || 0;
  }

  // Static methods for aggregation
  static createKey(tenantId: string, moduleName: string, endpoint: string | null, date: Date, hour: number): string {
    const dateStr = date.toISOString().split('T')[0];
    return `${tenantId}:${moduleName}:${endpoint || 'all'}:${dateStr}:${hour}`;
  }

  static fromApiCall(
    tenantId: string,
    moduleName: string,
    endpoint: string,
    responseTimeMs: number,
    isError: boolean = false,
    metadata?: Record<string, any>
  ): Partial<ModuleUsageAnalytics> {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hour = now.getHours();

    return {
      tenantId,
      moduleName,
      endpoint,
      requestCount: 1,
      responseTimeMs,
      errorCount: isError ? 1 : 0,
      date,
      hour,
      metadata,
    };
  }

  // Methods
  incrementUsage(responseTimeMs?: number, isError: boolean = false): void {
    this.requestCount += 1;
    
    if (responseTimeMs !== undefined) {
      // Calculate running average
      const totalTime = (this.responseTimeMs || 0) * (this.requestCount - 1) + responseTimeMs;
      this.responseTimeMs = Math.round(totalTime / this.requestCount);
    }
    
    if (isError) {
      this.errorCount += 1;
    }
  }

  merge(other: ModuleUsageAnalytics): void {
    const totalRequests = this.requestCount + other.requestCount;
    
    if (totalRequests > 0) {
      // Merge response times (weighted average)
      const thisTotal = (this.responseTimeMs || 0) * this.requestCount;
      const otherTotal = (other.responseTimeMs || 0) * other.requestCount;
      this.responseTimeMs = Math.round((thisTotal + otherTotal) / totalRequests);
    }
    
    this.requestCount = totalRequests;
    this.errorCount += other.errorCount;
    
    // Merge metadata
    if (other.metadata) {
      this.metadata = { ...this.metadata, ...other.metadata };
    }
  }
}