import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from '../tenant-context.service';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    let tenantId: string | null = null;

    // Priority 1: Check x-tenant-id header (for tenant switching)
    if (request.headers['x-tenant-id']) {
      tenantId = request.headers['x-tenant-id'];
    }
    // Priority 2: Check JWT payload for tenantId
    else if (user?.tenantId) {
      tenantId = user.tenantId;
    }
    // Priority 3: Check user's default tenant from organization
    else if (user?.organizationId) {
      tenantId = user.organizationId; // Using organizationId as tenantId for now
    }

    // Set tenant in context
    this.tenantContext.setTenant(tenantId);
    request.tenantId = tenantId;

    return next.handle();
  }
}
