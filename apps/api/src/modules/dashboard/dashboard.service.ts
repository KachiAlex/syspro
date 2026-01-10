import { Injectable } from '@nestjs/common';
import { TenantModuleService } from '../module-registry/tenant-module.service';
import {
  DashboardSummaryDto,
  DashboardActivityDto,
  DashboardQuickActionDto,
  DashboardStatDto,
  DashboardSystemStatusDto,
} from './dto/dashboard-summary.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly tenantModuleService: TenantModuleService) {}

  async getDashboardSummary(tenantId: string): Promise<DashboardSummaryDto> {
    const moduleSummary = await this.tenantModuleService.getModuleUsageSummary(tenantId);

    const stats: DashboardStatDto[] = [
      {
        id: 'revenue',
        label: 'Total Revenue',
        value: 45231.89,
        change: 12.5,
        period: '30d',
        trend: 'up',
      },
      {
        id: 'customers',
        label: 'Active Customers',
        value: 2350,
        change: 3.1,
        period: '30d',
        trend: 'up',
      },
      {
        id: 'orders',
        label: 'Pending Orders',
        value: 12,
        change: -1.8,
        period: '7d',
        trend: 'down',
      },
      {
        id: 'inventory',
        label: 'Inventory Items',
        value: 1429,
        change: 0.0,
        period: '7d',
        trend: 'flat',
      },
    ];

    const recentActivity: DashboardActivityDto[] = [
      {
        type: 'order',
        reference: '#12345',
        subject: 'Acme Corp',
        amount: 2350,
        status: 'completed',
        occurredAt: new Date().toISOString(),
      },
      {
        type: 'order',
        reference: '#12344',
        subject: 'Tech Solutions',
        amount: 1200,
        status: 'processing',
        occurredAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      },
      {
        type: 'order',
        reference: '#12343',
        subject: 'Global Industries',
        amount: 3450,
        status: 'pending',
        occurredAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    ];

    const quickActions: DashboardQuickActionDto[] = [
      {
        id: 'add-customer',
        label: 'Add Customer',
        description: 'Create a new customer record',
        href: '/customers/new',
        icon: 'user-plus',
      },
      {
        id: 'create-invoice',
        label: 'Create Invoice',
        description: 'Issue a new invoice',
        href: '/invoices/new',
        icon: 'file-text',
      },
      {
        id: 'add-product',
        label: 'Add Product',
        description: 'Extend your catalog',
        href: '/inventory/new',
        icon: 'package',
      },
      {
        id: 'view-reports',
        label: 'View Reports',
        description: 'Analyze performance metrics',
        href: '/reports',
        icon: 'chart-bar',
      },
    ];

    const systemStatus: DashboardSystemStatusDto[] = [
      {
        name: 'API',
        status: 'operational',
        message: 'All systems nominal',
        updatedAt: new Date().toISOString(),
      },
      {
        name: 'Database',
        status: 'operational',
        message: 'Connected',
        updatedAt: new Date().toISOString(),
      },
      {
        name: 'Services',
        status: 'operational',
        message: 'All services healthy',
        updatedAt: new Date().toISOString(),
      },
    ];

    return {
      stats,
      recentActivity,
      quickActions,
      systemStatus,
      moduleSummary,
    };
  }
}
