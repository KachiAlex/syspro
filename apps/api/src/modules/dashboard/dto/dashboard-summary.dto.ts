import { ApiProperty } from '@nestjs/swagger';
import { TenantModuleUsageSummaryDto } from '../../module-registry/dto/tenant-module.dto';

export class DashboardStatDto {
  @ApiProperty({ example: 'revenue' })
  id: string;

  @ApiProperty({ example: 'Total Revenue' })
  label: string;

  @ApiProperty({ example: 45231.89, description: 'Primary numeric value of the stat' })
  value: number;

  @ApiProperty({ example: 12.5, description: 'Percentage change over the comparison period' })
  change: number;

  @ApiProperty({ example: '30d', description: 'Comparison period (e.g., 24h, 7d, 30d)' })
  period: string;

  @ApiProperty({ example: 'up', enum: ['up', 'down', 'flat'] })
  trend: 'up' | 'down' | 'flat';
}

export class DashboardActivityDto {
  @ApiProperty({ example: 'order' })
  type: string;

  @ApiProperty({ example: '#12345' })
  reference: string;

  @ApiProperty({ example: 'Acme Corp' })
  subject: string;

  @ApiProperty({ example: 2350, description: 'Associated amount in tenant currency if applicable' })
  amount?: number;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiProperty({ example: '2024-11-10T14:32:00.000Z' })
  occurredAt: string;
}

export class DashboardQuickActionDto {
  @ApiProperty({ example: 'add-customer' })
  id: string;

  @ApiProperty({ example: 'Add Customer' })
  label: string;

  @ApiProperty({ example: 'Quickly add a new customer record' })
  description: string;

  @ApiProperty({ example: '/customers/new' })
  href: string;

  @ApiProperty({ example: 'user-plus', description: 'Icon identifier for the frontend' })
  icon: string;
}

export class DashboardSystemStatusDto {
  @ApiProperty({ example: 'API' })
  name: string;

  @ApiProperty({ example: 'operational' })
  status: string;

  @ApiProperty({ example: 'All systems nominal' })
  message: string;

  @ApiProperty({ example: '2024-11-10T14:32:00.000Z' })
  updatedAt: string;
}

export class DashboardSummaryDto {
  @ApiProperty({ type: [DashboardStatDto] })
  stats: DashboardStatDto[];

  @ApiProperty({ type: [DashboardActivityDto] })
  recentActivity: DashboardActivityDto[];

  @ApiProperty({ type: [DashboardQuickActionDto] })
  quickActions: DashboardQuickActionDto[];

  @ApiProperty({ type: [DashboardSystemStatusDto] })
  systemStatus: DashboardSystemStatusDto[];

  @ApiProperty({ type: TenantModuleUsageSummaryDto })
  moduleSummary: TenantModuleUsageSummaryDto;
}
