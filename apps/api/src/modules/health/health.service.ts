import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthIndicatorResult, HealthIndicator } from '@nestjs/terminus';

@Injectable()
export class HealthService extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async checkRedis(): Promise<HealthIndicatorResult> {
    const isHealthy = true; // TODO: Implement actual Redis health check
    const result = this.getStatus('redis', isHealthy, {
      status: isHealthy ? 'connected' : 'disconnected',
    });

    if (isHealthy) {
      return result;
    }
    throw new Error('Redis connection failed');
  }

  async checkMemoryUsage(): Promise<HealthIndicatorResult> {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const isHealthy = heapUsedMB < 512; // Consider unhealthy if using more than 512MB

    const result = this.getStatus('memory', isHealthy, {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
    });

    if (isHealthy) {
      return result;
    }
    throw new Error('Memory usage too high');
  }

  getSimpleHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: this.configService.get<string>('app.version', '1.0.0'),
      environment: this.configService.get<string>('app.environment', 'development'),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
  }
}