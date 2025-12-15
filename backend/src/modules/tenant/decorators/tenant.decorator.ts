import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { TenantContextService } from '../tenant-context.service';

export const Tenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId || request.user?.tenantId;
  },
);

