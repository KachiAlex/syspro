import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsDateString, IsArray, IsBoolean, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class UsageMetricsDto {
  @ApiProperty({
    description: 'Total number of requests',
    example: 1250,
  })
  @IsNumber()
  totalRequests: number;

  @ApiProperty({
    description: 'Total number of errors',
    example: 15,
  })
  @IsNumber()
  totalErrors: number;

  @ApiProperty({
    description: 'Average response time in milliseconds',
    example: 145.5,
  })
  @IsNumber()
  averageResponseTime: number;

  @ApiProperty({
    description: 'Success rate as percentage',
    example: 98.8,
  })
  @IsNumber()
  successRate: number;

  @ApiProperty({
    description: 'Peak hour of usage (0-23)',
    example: 14,
  })
  @IsNumber()
  @Min(0)
  @Max(23)
  peakHour: number;

  @ApiProperty({
    description: 'Number of unique endpoints accessed',
    example: 25,
  })
  @IsNumber()
  uniqueEndpoints: number;
}

export class ModuleAdoptionMetricsDto {
  @ApiProperty({
    description: 'Total number of tenants with this module',
    example: 150,
  })
  @IsNumber()
  totalTenants: number;

  @ApiProperty({
    description: 'Number of active tenants in the period',
    example: 120,
  })
  @IsNumber()
  activeTenants: number;

  @ApiProperty({
    description: 'Adoption rate as percentage',
    example: 80.0,
  })
  @IsNumber()
  adoptionRate: number;

  @ApiProperty({
    description: 'Average usage per tenant',
    example: 45.2,
  })
  @IsNumber()
  averageUsagePerTenant: number;

  @ApiProperty({
    description: 'Top features by usage',
    type: [Object],
    example: [
      { feature: '/api/v1/crm/leads', usage: 450 },
      { feature: '/api/v1/crm/customers', usage: 320 },
    ],
  })
  @IsArray()
  topFeatures: Array<{ feature: string; usage: number }>;
}

export class PerformanceMetricsDto {
  @ApiProperty({
    description: 'Average response time in milliseconds',
    example: 145.5,
  })
  @IsNumber()
  averageResponseTime: number;

  @ApiProperty({
    description: '95th percentile response time in milliseconds',
    example: 280.0,
  })
  @IsNumber()
  p95ResponseTime: number;

  @ApiProperty({
    description: 'Error rate as percentage',
    example: 1.2,
  })
  @IsNumber()
  errorRate: number;

  @ApiProperty({
    description: 'Throughput (requests per hour)',
    example: 125.5,
  })
  @IsNumber()
  throughput: number;

  @ApiProperty({
    description: 'Slowest endpoints by average response time',
    type: [Object],
    example: [
      { endpoint: '/api/v1/crm/reports/complex', avgResponseTime: 850.0 },
      { endpoint: '/api/v1/analytics/dashboard', avgResponseTime: 420.0 },
    ],
  })
  @IsArray()
  slowestEndpoints: Array<{ endpoint: string; avgResponseTime: number }>;
}

export class FeatureFlagUsageDto {
  @ApiProperty({
    description: 'Feature flag name',
    example: 'advancedReporting',
  })
  @IsString()
  flagName: string;

  @ApiProperty({
    description: 'Number of tenants with this flag enabled',
    example: 45,
  })
  @IsNumber()
  enabledTenants: number;

  @ApiProperty({
    description: 'Total number of tenants with this module',
    example: 150,
  })
  @IsNumber()
  totalTenants: number;

  @ApiProperty({
    description: 'Adoption rate as percentage',
    example: 30.0,
  })
  @IsNumber()
  adoptionRate: number;

  @ApiProperty({
    description: 'Number of times this flag was toggled',
    example: 12,
  })
  @IsNumber()
  usageCount: number;
}

export class UsageReportDto {
  @ApiProperty({
    description: 'Report period',
    example: {
      start: '2023-12-01T00:00:00.000Z',
      end: '2023-12-31T23:59:59.999Z',
    },
  })
  period: { start: Date; end: Date };

  @ApiProperty({
    description: 'Total metrics across all modules',
    type: UsageMetricsDto,
  })
  totalMetrics: UsageMetricsDto;

  @ApiProperty({
    description: 'Usage metrics broken down by module',
    type: Object,
    example: {
      crm: { totalRequests: 500, totalErrors: 5, averageResponseTime: 120 },
      hr: { totalRequests: 300, totalErrors: 2, averageResponseTime: 95 },
    },
  })
  moduleBreakdown: Record<string, UsageMetricsDto>;

  @ApiProperty({
    description: 'Adoption metrics by module',
    type: Object,
  })
  adoptionMetrics: Record<string, ModuleAdoptionMetricsDto>;

  @ApiProperty({
    description: 'Performance metrics by module',
    type: Object,
  })
  performanceMetrics: Record<string, PerformanceMetricsDto>;

  @ApiProperty({
    description: 'Feature flag usage by module',
    type: Object,
  })
  featureFlagUsage: Record<string, FeatureFlagUsageDto[]>;

  @ApiProperty({
    description: 'Usage trends over time',
    example: {
      dailyUsage: [
        { date: '2023-12-01', requests: 450 },
        { date: '2023-12-02', requests: 520 },
      ],
      hourlyDistribution: [
        { hour: 9, requests: 120 },
        { hour: 14, requests: 180 },
      ],
    },
  })
  trends: {
    dailyUsage: Array<{ date: string; requests: number }>;
    hourlyDistribution: Array<{ hour: number; requests: number }>;
  };
}

export class RealTimeStatsDto {
  @ApiProperty({
    description: 'Number of active/pending requests',
    example: 15,
  })
  @IsNumber()
  activeRequests: number;

  @ApiProperty({
    description: 'Requests per minute',
    example: 45,
  })
  @IsNumber()
  requestsPerMinute: number;

  @ApiProperty({
    description: 'Current error rate as percentage',
    example: 2.1,
  })
  @IsNumber()
  errorRate: number;

  @ApiProperty({
    description: 'Current average response time in milliseconds',
    example: 125.5,
  })
  @IsNumber()
  averageResponseTime: number;
}

export class GetUsageMetricsQueryDto {
  @ApiProperty({
    description: 'Start date for the metrics period',
    example: '2023-12-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for the metrics period',
    example: '2023-12-31',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Specific tenant ID to filter by (optional)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class GenerateReportQueryDto {
  @ApiProperty({
    description: 'Start date for the report period',
    example: '2023-12-01',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'End date for the report period',
    example: '2023-12-31',
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Specific modules to include in the report (optional)',
    type: [String],
    example: ['crm', 'hr', 'inventory'],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modules?: string[];

  @ApiProperty({
    description: 'Include privacy-preserving aggregation',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  privacyMode?: boolean;
}

export class TrackEventDto {
  @ApiProperty({
    description: 'Module name',
    example: 'crm',
  })
  @IsString()
  moduleName: string;

  @ApiProperty({
    description: 'Event type',
    enum: ['activated', 'deactivated'],
    example: 'activated',
  })
  @IsString()
  event: 'activated' | 'deactivated';

  @ApiProperty({
    description: 'Additional metadata',
    example: { reason: 'user_request', featureFlags: { advancedReporting: true } },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class TrackFeatureFlagDto {
  @ApiProperty({
    description: 'Module name',
    example: 'crm',
  })
  @IsString()
  moduleName: string;

  @ApiProperty({
    description: 'Feature flag name',
    example: 'advancedReporting',
  })
  @IsString()
  flagName: string;

  @ApiProperty({
    description: 'Whether the flag is enabled',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;
}