import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Scope,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContextService } from '../tenant-context.service';

@Injectable({ scope: Scope.REQUEST })
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContextService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    let tenantId: string | null = null;

    // Tenant is derived strictly from authenticated user context
    if (user?.tenantId) {
      tenantId = user.tenantId;
    }
    else if (user?.organizationId) {
      tenantId = user.organizationId; // Using organizationId as tenantId for now
    }

    // Set tenant in context
    this.tenantContext.setTenant(tenantId);
    request.tenantId = tenantId;

    return next.handle();
  }
}
