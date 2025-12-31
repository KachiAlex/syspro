import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheck,
  HealthCheckResult,
} from '@nestjs/terminus';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get application health status' })
  @ApiResponse({
    status: 200,
    description: 'Health check successful',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        info: { type: 'object' },
        error: { type: 'object' },
        details: { type: 'object' },
      },
    },
  })
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.healthService.checkRedis(),
      () => this.healthService.checkMemoryUsage(),
    ]);
  }

  @Get('simple')
  @ApiOperation({ summary: 'Simple health check' })
  @ApiResponse({
    status: 200,
    description: 'Simple health status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'healthy' },
        timestamp: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
        uptime: { type: 'number', example: 12345 },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  })
  simpleCheck() {
    return this.healthService.getSimpleHealth();
  }
}