import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, Like, In } from 'typeorm';
import { ModuleUsageAnalytics, TenantModule, ModuleRegistry } from '@syspro/database';
import { CacheService } from '../../shared/services/cache.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface UsageMetrics {
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  successRate: number;
  peakHour: number;
  uniqueEndpoints: number;
}

interface ModuleAdoptionMetrics {
  totalTenants: number;
  activeTenants: number;
  adoptionRate: number;
  averageUsagePerTenant: number;
  topFeatures: Array<{ feature: string; usage: number }>;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  throughput: number;
  slowestEndpoints: Array<{ endpoint: string; avgResponseTime: number }>;
}

interface FeatureFlagUsage {
  flagName: string;
  enabledTenants: number;
  totalTenants: number;
  adoptionRate: number;
  usageCount: number;
}

interface RealTimeStats {
  activeRequests: number;
  requestsPerMinute: number;
  errorRate: number;
  averageResponseTime: number;
}

interface UsageReport {
  period: { start: Date; end: Date };
  totalMetrics: UsageMetrics;
  moduleBreakdown: Record<string, UsageMetrics>;
  adoptionMetrics: Record<string, ModuleAdoptionMetrics>;
  performanceMetrics: Record<string, PerformanceMetrics>;
  featureFlagUsage: Record<string, FeatureFlagUsage[]>;
  trends: {
    dailyUsage: Array<{ date: string; requests: number }>;
    hourlyDistribution: Array<{ hour: number; requests: number }>;
  };
}

interface AnalyticsEvent {
  tenantId: string;
  moduleName: string;
  endpoint: string;
  method: string;
  responseTimeMs: number;
  statusCode: number;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  featureFlags?: Record<string, boolean>;
}

@Injectable()
export class ModuleUsageAnalyticsService {
  private readonly logger = new Logger(ModuleUsageAnalyticsService.name);
  private readonly batchSize = 100;
  private readonly batchInterval = 30000; // 30 seconds
  private pendingEvents: AnalyticsEvent[] = [];

  constructor(
    @InjectRepository(ModuleUsageAnalytics)
    private analyticsRepository: Repository<ModuleUsageAnalytics>,
    @InjectRepository(TenantModule)
    private tenantModuleRepository: Repository<TenantModule>,
    @InjectRepository(ModuleRegistry)
    private moduleRepository: Repository<ModuleRegistry>,
    private cacheService: CacheService,
    private eventEmitter: EventEmitter2,
  ) {
    // Start batch processing
    this.startBatchProcessor();
  }

  /**
   * Track API usage event
   */
  async trackApiUsage(event: AnalyticsEvent): Promise<void> {
    // Add to pending batch
    this.pendingEvents.push(event);

    // Process immediately if batch is full
    if (this.pendingEvents.length >= this.batchSize) {
      await this.processBatch();
    }

    // Emit real-time event for immediate processing needs
    this.eventEmitter.emit('module.api.usage', event);
  }

  /**
   * Track module activation/deactivation events
   */
  async trackModuleEvent(
    tenantId: string,
    moduleName: string,
    event: 'activated' | 'deactivated',
    userId: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    this.logger.log(`Tracking module ${event} event: ${moduleName} for tenant ${tenantId}`);

    const analyticsEvent: AnalyticsEvent = {
      tenantId,
      moduleName,
      endpoint: `/module/${event}`,
      method: 'POST',
      responseTimeMs: 0,
      statusCode: 200,
      userId,
      featureFlags: metadata?.featureFlags,
    };

    await this.trackApiUsage(analyticsEvent);

    // Emit specific module event
    this.eventEmitter.emit(`module.${event}`, {
      tenantId,
      moduleName,
      userId,
      timestamp: new Date(),
      metadata,
    });
  }

  /**
   * Track feature flag usage
   */
  async trackFeatureFlagUsage(
    tenantId: string,
    moduleName: string,
    flagName: string,
    enabled: boolean,
    userId?: string,
  ): Promise<void> {
    const analyticsEvent: AnalyticsEvent = {
      tenantId,
      moduleName,
      endpoint: `/feature-flag/${flagName}`,
      method: 'PATCH',
      responseTimeMs: 0,
      statusCode: 200,
      userId,
      featureFlags: { [flagName]: enabled },
    };

    await this.trackApiUsage(analyticsEvent);

    // Emit feature flag event
    this.eventEmitter.emit('module.feature.flag.changed', {
      tenantId,
      moduleName,
      flagName,
      enabled,
      userId,
      timestamp: new Date(),
    });
  }

  /**
   * Get usage metrics for a specific module and time period
   */
  async getModuleUsageMetrics(
    moduleName: string,
    startDate: Date,
    endDate: Date,
    tenantId?: string,
  ): Promise<UsageMetrics> {
    const cacheKey = `usage:metrics:${moduleName}:${tenantId || 'all'}:${startDate.toISOString()}:${endDate.toISOString()}`;
    let metrics = await this.cacheService.get<UsageMetrics>(cacheKey);

    if (!metrics) {
      const whereClause: any = {
        moduleName,
        date: Between(startDate, endDate),
      };

      if (tenantId) {
        whereClause.tenantId = tenantId;
      }

      const records = await this.analyticsRepository.find({
        where: whereClause,
      });

      metrics = this.calculateUsageMetrics(records);
      await this.cacheService.set(cacheKey, metrics, 300); // 5 minutes
    }

    return metrics;
  }

  /**
   * Get module adoption metrics
   */
  async getModuleAdoptionMetrics(
    moduleName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ModuleAdoptionMetrics> {
    const cacheKey = `adoption:metrics:${moduleName}:${startDate.toISOString()}:${endDate.toISOString()}`;
    let metrics = await this.cacheService.get<ModuleAdoptionMetrics>(cacheKey);

    if (!metrics) {
      // Get total tenants with this module enabled
      const totalTenants = await this.tenantModuleRepository.count({
        where: { moduleName, isEnabled: true },
      });

      // Get active tenants (those with usage in the period)
      const activeTenantsQuery = await this.analyticsRepository
        .createQueryBuilder('analytics')
        .select('DISTINCT analytics.tenantId')
        .where('analytics.moduleName = :moduleName', { moduleName })
        .andWhere('analytics.date BETWEEN :startDate AND :endDate', { startDate, endDate })
        .getRawMany();

      const activeTenants = activeTenantsQuery.length;

      // Get average usage per tenant
      const usageRecords = await this.analyticsRepository.find({
        where: {
          moduleName,
          date: Between(startDate, endDate),
        },
      });

      const totalUsage = usageRecords.reduce((sum, record) => sum + record.requestCount, 0);
      const averageUsagePerTenant = activeTenants > 0 ? totalUsage / activeTenants : 0;

      // Get top features (endpoints)
      const endpointUsage = new Map<string, number>();
      usageRecords.forEach(record => {
        if (record.endpoint) {
          const current = endpointUsage.get(record.endpoint) || 0;
          endpointUsage.set(record.endpoint, current + record.requestCount);
        }
      });

      const topFeatures = Array.from(endpointUsage.entries())
        .map(([feature, usage]) => ({ feature, usage }))
        .sort((a, b) => b.usage - a.usage)
        .slice(0, 10);

      metrics = {
        totalTenants,
        activeTenants,
        adoptionRate: totalTenants > 0 ? (activeTenants / totalTenants) * 100 : 0,
        averageUsagePerTenant,
        topFeatures,
      };

      await this.cacheService.set(cacheKey, metrics, 600); // 10 minutes
    }

    return metrics;
  }

  /**
   * Get performance metrics for a module
   */
  async getModulePerformanceMetrics(
    moduleName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PerformanceMetrics> {
    const cacheKey = `performance:metrics:${moduleName}:${startDate.toISOString()}:${endDate.toISOString()}`;
    let metrics = await this.cacheService.get<PerformanceMetrics>(cacheKey);

    if (!metrics) {
      const records = await this.analyticsRepository.find({
        where: {
          moduleName,
          date: Between(startDate, endDate),
        },
      });

      if (records.length === 0) {
        return {
          averageResponseTime: 0,
          p95ResponseTime: 0,
          errorRate: 0,
          throughput: 0,
          slowestEndpoints: [],
        };
      }

      // Calculate metrics
      const totalRequests = records.reduce((sum, r) => sum + r.requestCount, 0);
      const totalErrors = records.reduce((sum, r) => sum + r.errorCount, 0);
      const weightedResponseTime = records.reduce((sum, r) => 
        sum + (r.responseTimeMs || 0) * r.requestCount, 0
      );

      const averageResponseTime = totalRequests > 0 ? weightedResponseTime / totalRequests : 0;
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      // Calculate P95 response time (simplified)
      const responseTimes = records
        .filter(r => r.responseTimeMs)
        .map(r => r.responseTimeMs!)
        .sort((a, b) => a - b);
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p95ResponseTime = responseTimes[p95Index] || 0;

      // Calculate throughput (requests per hour)
      const periodHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
      const throughput = periodHours > 0 ? totalRequests / periodHours : 0;

      // Get slowest endpoints
      const endpointPerformance = new Map<string, { totalTime: number; count: number }>();
      records.forEach(record => {
        if (record.endpoint && record.responseTimeMs) {
          const current = endpointPerformance.get(record.endpoint) || { totalTime: 0, count: 0 };
          endpointPerformance.set(record.endpoint, {
            totalTime: current.totalTime + record.responseTimeMs * record.requestCount,
            count: current.count + record.requestCount,
          });
        }
      });

      const slowestEndpoints = Array.from(endpointPerformance.entries())
        .map(([endpoint, data]) => ({
          endpoint,
          avgResponseTime: data.count > 0 ? data.totalTime / data.count : 0,
        }))
        .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
        .slice(0, 10);

      metrics = {
        averageResponseTime,
        p95ResponseTime,
        errorRate,
        throughput,
        slowestEndpoints,
      };

      await this.cacheService.set(cacheKey, metrics, 600); // 10 minutes
    }

    return metrics;
  }

  /**
   * Get feature flag usage statistics
   */
  async getFeatureFlagUsage(
    moduleName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<FeatureFlagUsage[]> {
    const cacheKey = `feature:flags:${moduleName}:${startDate.toISOString()}:${endDate.toISOString()}`;
    let usage = await this.cacheService.get<FeatureFlagUsage[]>(cacheKey);

    if (!usage) {
      // Get all tenants with this module
      const tenantModules = await this.tenantModuleRepository.find({
        where: { moduleName, isEnabled: true },
      });

      const totalTenants = tenantModules.length;
      const flagUsageMap = new Map<string, { enabled: number; usage: number }>();

      // Analyze feature flag usage
      tenantModules.forEach(tenantModule => {
        if (tenantModule.featureFlags) {
          Object.entries(tenantModule.featureFlags).forEach(([flagName, enabled]) => {
            const current = flagUsageMap.get(flagName) || { enabled: 0, usage: 0 };
            if (enabled) {
              current.enabled += 1;
            }
            current.usage += 1;
            flagUsageMap.set(flagName, current);
          });
        }
      });

      // Get usage count from analytics
      const analyticsRecords = await this.analyticsRepository.find({
        where: {
          moduleName,
          date: Between(startDate, endDate),
          endpoint: Like('/feature-flag/%'),
        },
      });

      const flagUsageCount = new Map<string, number>();
      analyticsRecords.forEach(record => {
        if (record.endpoint) {
          const flagName = record.endpoint.split('/').pop();
          if (flagName) {
            const current = flagUsageCount.get(flagName) || 0;
            flagUsageCount.set(flagName, current + record.requestCount);
          }
        }
      });

      usage = Array.from(flagUsageMap.entries()).map(([flagName, data]) => ({
        flagName,
        enabledTenants: data.enabled,
        totalTenants,
        adoptionRate: totalTenants > 0 ? (data.enabled / totalTenants) * 100 : 0,
        usageCount: flagUsageCount.get(flagName) || 0,
      }));

      await this.cacheService.set(cacheKey, usage, 600); // 10 minutes
    }

    return usage;
  }

  /**
   * Generate comprehensive usage report
   */
  async generateUsageReport(
    startDate: Date,
    endDate: Date,
    moduleNames?: string[],
  ): Promise<UsageReport> {
    this.logger.log(`Generating usage report from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get all modules if not specified
    if (!moduleNames) {
      const modules = await this.moduleRepository.find({
        where: { isActive: true },
        select: ['name'],
      });
      moduleNames = modules.map(m => m.name);
    }

    // Aggregate metrics for all modules
    const moduleBreakdown: Record<string, UsageMetrics> = {};
    const adoptionMetrics: Record<string, ModuleAdoptionMetrics> = {};
    const performanceMetrics: Record<string, PerformanceMetrics> = {};
    const featureFlagUsage: Record<string, FeatureFlagUsage[]> = {};

    for (const moduleName of moduleNames) {
      moduleBreakdown[moduleName] = await this.getModuleUsageMetrics(moduleName, startDate, endDate);
      adoptionMetrics[moduleName] = await this.getModuleAdoptionMetrics(moduleName, startDate, endDate);
      performanceMetrics[moduleName] = await this.getModulePerformanceMetrics(moduleName, startDate, endDate);
      featureFlagUsage[moduleName] = await this.getFeatureFlagUsage(moduleName, startDate, endDate);
    }

    // Calculate total metrics
    const totalMetrics = this.aggregateUsageMetrics(Object.values(moduleBreakdown));

    // Get trends
    const trends = await this.calculateUsageTrends(startDate, endDate, moduleNames);

    return {
      period: { start: startDate, end: endDate },
      totalMetrics,
      moduleBreakdown,
      adoptionMetrics,
      performanceMetrics,
      featureFlagUsage,
      trends,
    };
  }

  /**
   * Get real-time usage statistics
   */
  async getRealTimeStats(): Promise<RealTimeStats> {
    const cacheKey = 'realtime:stats';
    let stats = await this.cacheService.get<RealTimeStats>(cacheKey);

    if (!stats) {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      const oneHourAgo = new Date(now.getTime() - 3600000);

      // Get recent analytics data
      const recentRecords = await this.analyticsRepository.find({
        where: {
          createdAt: MoreThan(oneHourAgo),
        },
      });

      const lastMinuteRecords = recentRecords.filter(
        r => r.createdAt > oneMinuteAgo
      );

      const totalRequests = lastMinuteRecords.reduce((sum, r) => sum + r.requestCount, 0);
      const totalErrors = lastMinuteRecords.reduce((sum, r) => sum + r.errorCount, 0);
      const totalResponseTime = lastMinuteRecords.reduce(
        (sum, r) => sum + (r.responseTimeMs || 0) * r.requestCount, 0
      );

      stats = {
        activeRequests: this.pendingEvents.length,
        requestsPerMinute: totalRequests,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
        averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      };

      await this.cacheService.set(cacheKey, stats, 30); // 30 seconds
    }

    return stats;
  }

  /**
   * Private helper methods
   */

  private startBatchProcessor(): void {
    setInterval(async () => {
      if (this.pendingEvents.length > 0) {
        await this.processBatch();
      }
    }, this.batchInterval);
  }

  private async processBatch(): Promise<void> {
    if (this.pendingEvents.length === 0) return;

    const events = [...this.pendingEvents];
    this.pendingEvents = [];

    try {
      await this.processAnalyticsEvents(events);
      this.logger.debug(`Processed batch of ${events.length} analytics events`);
    } catch (error) {
      this.logger.error('Failed to process analytics batch', error.stack);
      // Re-add events to pending queue for retry
      this.pendingEvents.unshift(...events);
    }
  }

  private async processAnalyticsEvents(events: AnalyticsEvent[]): Promise<void> {
    const aggregatedData = new Map<string, ModuleUsageAnalytics>();

    // Aggregate events by key
    for (const event of events) {
      const now = new Date();
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const hour = now.getHours();
      
      const key = ModuleUsageAnalytics.createKey(
        event.tenantId,
        event.moduleName,
        event.endpoint,
        date,
        hour
      );

      let record = aggregatedData.get(key);
      if (!record) {
        record = new ModuleUsageAnalytics();
        record.tenantId = event.tenantId;
        record.moduleName = event.moduleName;
        record.endpoint = event.endpoint;
        record.date = date;
        record.hour = hour;
        record.requestCount = 0;
        record.errorCount = 0;
        record.responseTimeMs = 0;
        record.metadata = {};
        aggregatedData.set(key, record);
      }

      const isError = event.statusCode >= 400;
      record.incrementUsage(event.responseTimeMs, isError);

      // Merge metadata
      if (event.featureFlags) {
        record.metadata = { ...record.metadata, featureFlags: event.featureFlags };
      }
    }

    // Upsert records to database
    for (const record of aggregatedData.values()) {
      await this.upsertAnalyticsRecord(record);
    }
  }

  private async upsertAnalyticsRecord(record: ModuleUsageAnalytics): Promise<void> {
    const existing = await this.analyticsRepository.findOne({
      where: {
        tenantId: record.tenantId,
        moduleName: record.moduleName,
        endpoint: record.endpoint,
        date: record.date,
        hour: record.hour,
      },
    });

    if (existing) {
      existing.merge(record);
      await this.analyticsRepository.save(existing);
    } else {
      await this.analyticsRepository.save(record);
    }
  }

  private calculateUsageMetrics(records: ModuleUsageAnalytics[]): UsageMetrics {
    if (records.length === 0) {
      return {
        totalRequests: 0,
        totalErrors: 0,
        averageResponseTime: 0,
        successRate: 0,
        peakHour: 0,
        uniqueEndpoints: 0,
      };
    }

    const totalRequests = records.reduce((sum, r) => sum + r.requestCount, 0);
    const totalErrors = records.reduce((sum, r) => sum + r.errorCount, 0);
    const weightedResponseTime = records.reduce((sum, r) => 
      sum + (r.responseTimeMs || 0) * r.requestCount, 0
    );

    // Find peak hour
    const hourlyUsage = new Map<number, number>();
    records.forEach(record => {
      const current = hourlyUsage.get(record.hour) || 0;
      hourlyUsage.set(record.hour, current + record.requestCount);
    });

    const peakHour = Array.from(hourlyUsage.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 0;

    // Count unique endpoints
    const uniqueEndpoints = new Set(records.map(r => r.endpoint).filter(Boolean)).size;

    return {
      totalRequests,
      totalErrors,
      averageResponseTime: totalRequests > 0 ? weightedResponseTime / totalRequests : 0,
      successRate: totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 0,
      peakHour,
      uniqueEndpoints,
    };
  }

  private aggregateUsageMetrics(metrics: UsageMetrics[]): UsageMetrics {
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        totalErrors: 0,
        averageResponseTime: 0,
        successRate: 0,
        peakHour: 0,
        uniqueEndpoints: 0,
      };
    }

    const totalRequests = metrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalErrors = metrics.reduce((sum, m) => sum + m.totalErrors, 0);
    const weightedResponseTime = metrics.reduce((sum, m) => 
      sum + m.averageResponseTime * m.totalRequests, 0
    );

    return {
      totalRequests,
      totalErrors,
      averageResponseTime: totalRequests > 0 ? weightedResponseTime / totalRequests : 0,
      successRate: totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 0,
      peakHour: 0, // Would need more complex calculation
      uniqueEndpoints: metrics.reduce((sum, m) => sum + m.uniqueEndpoints, 0),
    };
  }

  private async calculateUsageTrends(
    startDate: Date,
    endDate: Date,
    moduleNames: string[],
  ): Promise<{
    dailyUsage: Array<{ date: string; requests: number }>;
    hourlyDistribution: Array<{ hour: number; requests: number }>;
  }> {
    const records = await this.analyticsRepository.find({
      where: {
        moduleName: In(moduleNames),
        date: Between(startDate, endDate),
      },
    });

    // Daily usage
    const dailyUsage = new Map<string, number>();
    const hourlyDistribution = new Map<number, number>();

    records.forEach(record => {
      const dateStr = record.date.toISOString().split('T')[0];
      const currentDaily = dailyUsage.get(dateStr) || 0;
      dailyUsage.set(dateStr, currentDaily + record.requestCount);

      const currentHourly = hourlyDistribution.get(record.hour) || 0;
      hourlyDistribution.set(record.hour, currentHourly + record.requestCount);
    });

    return {
      dailyUsage: Array.from(dailyUsage.entries())
        .map(([date, requests]) => ({ date, requests }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      hourlyDistribution: Array.from(hourlyDistribution.entries())
        .map(([hour, requests]) => ({ hour, requests }))
        .sort((a, b) => a.hour - b.hour),
    };
  }
}