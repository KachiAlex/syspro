import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { User } from '@syspro/database';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User = request.user;
    const tenantId: string = request.tenantId;

    if (!user || !tenantId) {
      return false;
    }

    // Check if user belongs to the requested tenant
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: User does not belong to this tenant');
    }

    return true;
  }
}