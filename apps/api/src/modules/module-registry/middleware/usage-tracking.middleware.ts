import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ModuleUsageAnalyticsService } from '../module-usage-analytics.service';

interface ExtendedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
  };
  moduleContext?: {
    moduleName: string;
    hasAccess: boolean;
  };
  startTime?: number;
}

@Injectable()
export class UsageTrackingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(UsageTrackingMiddleware.name);

  constructor(
    private readonly analyticsService: ModuleUsageAnalyticsService,
  ) {}

  use(req: ExtendedRequest, res: Response, next: NextFunction): void {
    // Skip tracking for certain paths
    if (this.shouldSkipTracking(req.path)) {
      return next();
    }

    // Record start time
    req.startTime = Date.now();

    // Override res.end to capture response details
    const originalEnd = res.end.bind(res);
    const analyticsService = this.analyticsService;
    const logger = this.logger;

    res.end = ((chunk?: any, encoding?: any, callback?: () => void) => {
      // Call original end method
      originalEnd(chunk, encoding, callback);

      // Track the API usage after response is sent
      setImmediate(() => {
        try {
          const responseTime = Date.now() - (req.startTime || Date.now());

          const moduleName = req.moduleContext?.moduleName || 
                           extractModuleFromPath(req.path);
          
          if (moduleName && req.user?.tenantId) {
            analyticsService.trackApiUsage({
              tenantId: req.user.tenantId,
              moduleName,
              endpoint: req.path,
              method: req.method,
              responseTimeMs: responseTime,
              statusCode: res.statusCode,
              userId: req.user.id,
              userAgent: req.get('User-Agent'),
              ipAddress: getClientIp(req),
              featureFlags: extractFeatureFlags(req),
            }).catch(error => {
              // Log error but don't fail the request
              logger.error('Failed to track API usage', error.stack);
            });
          }
        } catch (error) {
          logger.error('Error in usage tracking middleware', error.stack);
        }
      });
    }) as typeof res.end;

    next();
  }

  private shouldSkipTracking(path: string): boolean {
    const skipPaths = [
      '/health',
      '/metrics',
      '/favicon.ico',
      '/api/v1/health',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
    ];

    return skipPaths.some(skipPath => path.startsWith(skipPath));
  }
}

/**
 * Extract module name from API path
 */
function extractModuleFromPath(path: string): string | null {
  // Pattern: /api/v1/{module}/...
  const match = path.match(/^\/api\/v\d+\/([^\/]+)/);
  if (match) {
    const segment = match[1];
    
    // Map API segments to module names
    const moduleMap: Record<string, string> = {
      'crm': 'crm',
      'leads': 'crm',
      'customers': 'crm',
      'deals': 'crm',
      'hr': 'hr',
      'employees': 'hr',
      'attendance': 'hr',
      'payroll': 'hr',
      'inventory': 'inventory',
      'products': 'inventory',
      'warehouses': 'inventory',
      'projects': 'projects',
      'tasks': 'projects',
      'timesheets': 'projects',
      'analytics': 'analytics',
      'reports': 'analytics',
      'dashboards': 'analytics',
      'notifications': 'notifications',
      'integrations': 'integrations',
      'webhooks': 'integrations',
      'tenants': 'tenant-management',
      'users': 'tenant-management',
      'organizations': 'tenant-management',
    };

    return moduleMap[segment] || segment;
  }

  return null;
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  return (
    req.get('X-Forwarded-For') ||
    req.get('X-Real-IP') ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * Extract feature flags from request context
 */
function extractFeatureFlags(req: ExtendedRequest): Record<string, boolean> | undefined {
  // This would typically come from the module context or user session
  // For now, return undefined - this can be enhanced based on implementation needs
  return undefined;
}