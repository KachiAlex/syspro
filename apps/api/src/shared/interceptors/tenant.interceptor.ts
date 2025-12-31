import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

export interface TenantRequest extends Request {
  tenantId?: string;
  tenant?: any;
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    
    // Skip tenant validation for certain routes
    const skipTenantRoutes = [
      '/api/v1/health',
      '/api/v1/auth/register',
      '/api/docs',
    ];
    
    const path = request.path;
    const shouldSkip = skipTenantRoutes.some(route => path.startsWith(route));
    
    if (!shouldSkip) {
      // Extract tenant ID from header
      const tenantId = request.headers['x-tenant-id'] as string;
      
      if (!tenantId) {
        throw new BadRequestException('Tenant ID is required');
      }
      
      // Validate tenant ID format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(tenantId)) {
        throw new BadRequestException('Invalid tenant ID format');
      }
      
      // Attach tenant ID to request
      request.tenantId = tenantId;
    }
    
    return next.handle();
  }
}