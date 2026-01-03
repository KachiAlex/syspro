import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantModuleService } from '../tenant-module.service';

interface ModuleRequest extends Request {
  moduleContext?: {
    moduleName: string;
    hasAccess: boolean;
    tenantId: string;
  };
}

@Injectable()
export class ModuleAccessMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ModuleAccessMiddleware.name);

  constructor(private tenantModuleService: TenantModuleService) {}

  async use(req: ModuleRequest, res: Response, next: NextFunction) {
    const tenantId = req.headers['x-tenant-id'] as string;
    const path = req.path;
    const method = req.method;

    // Skip for health checks, auth endpoints, and module management endpoints
    if (this.shouldSkipCheck(path)) {
      return next();
    }

    // Skip if no tenant ID (will be handled by tenant guard)
    if (!tenantId) {
      return next();
    }

    // Extract module name from path
    const moduleName = this.extractModuleFromPath(path);
    if (!moduleName) {
      // No module detected in path, allow request to continue
      return next();
    }

    try {
      // Check if tenant has access to module
      const hasAccess = await this.tenantModuleService.hasModuleAccess(tenantId, moduleName);

      if (!hasAccess) {
        this.logger.warn(`Module access denied: ${tenantId} -> ${moduleName}`, {
          tenantId,
          moduleName,
          path,
          method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });

        return res.status(403).json({
          error: 'Module Access Denied',
          message: `Module '${moduleName}' is not enabled for your organization`,
          moduleName,
          code: 'MODULE_NOT_ENABLED',
          timestamp: new Date().toISOString(),
        });
      }

      // Add module context to request for downstream use
      req.moduleContext = {
        moduleName,
        hasAccess: true,
        tenantId,
      };

      this.logger.debug(`Module access granted: ${tenantId} -> ${moduleName}`, {
        tenantId,
        moduleName,
        path,
        method,
      });

      next();
    } catch (error) {
      this.logger.error(`Error checking module access: ${error.message}`, {
        tenantId,
        moduleName,
        path,
        method,
        error: error.message,
      });

      // On error, allow request to continue to avoid breaking the system
      // The error will be logged for investigation
      next();
    }
  }

  /**
   * Determine if module access check should be skipped for this path
   */
  private shouldSkipCheck(path: string): boolean {
    const skipPaths = [
      // Health and system endpoints
      '/health',
      '/api/health',
      '/api/v1/health',
      
      // Authentication endpoints
      '/api/v1/auth',
      '/auth',
      
      // Module management endpoints (these handle their own authorization)
      '/api/v1/modules',
      '/api/v1/tenant/modules',
      
      // System admin endpoints
      '/api/v1/admin',
      '/api/v1/system',
      
      // Static assets and documentation
      '/docs',
      '/api-docs',
      '/swagger',
      '/favicon.ico',
      '/robots.txt',
    ];

    return skipPaths.some(skipPath => path.startsWith(skipPath));
  }

  /**
   * Extract module name from API path
   * Supports various path patterns:
   * - /api/v1/{module}/...
   * - /api/{module}/...
   * - /{module}/...
   */
  private extractModuleFromPath(path: string): string | null {
    // Pattern 1: /api/v1/{module}/...
    let match = path.match(/^\/api\/v1\/([^\/]+)/);
    if (match) {
      const segment = match[1];
      // Skip known non-module segments
      if (this.isNonModuleSegment(segment)) {
        return null;
      }
      return segment;
    }

    // Pattern 2: /api/{module}/...
    match = path.match(/^\/api\/([^\/]+)/);
    if (match) {
      const segment = match[1];
      if (this.isNonModuleSegment(segment)) {
        return null;
      }
      return segment;
    }

    // Pattern 3: /{module}/... (for direct module access)
    match = path.match(/^\/([^\/]+)/);
    if (match) {
      const segment = match[1];
      if (this.isNonModuleSegment(segment)) {
        return null;
      }
      // Only consider this a module if it looks like a module name
      if (this.looksLikeModuleName(segment)) {
        return segment;
      }
    }

    return null;
  }

  /**
   * Check if a path segment is a known non-module segment
   */
  private isNonModuleSegment(segment: string): boolean {
    const nonModuleSegments = [
      'v1', 'v2', 'v3', // API versions
      'auth', 'login', 'logout', 'register', // Auth
      'health', 'status', 'ping', // Health checks
      'admin', 'system', // System endpoints
      'modules', 'tenant', // Module management
      'docs', 'swagger', 'api-docs', // Documentation
      'static', 'assets', 'public', // Static files
      'webhooks', 'callbacks', // External integrations
    ];

    return nonModuleSegments.includes(segment.toLowerCase());
  }

  /**
   * Check if a segment looks like a module name
   * Module names typically follow kebab-case or snake_case patterns
   */
  private looksLikeModuleName(segment: string): boolean {
    // Module names should be alphanumeric with hyphens or underscores
    const moduleNamePattern = /^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/;
    return moduleNamePattern.test(segment.toLowerCase());
  }
}

/**
 * Factory function to create module access middleware
 * This allows for dependency injection in the middleware
 */
export function createModuleAccessMiddleware(tenantModuleService: TenantModuleService) {
  return new ModuleAccessMiddleware(tenantModuleService);
}