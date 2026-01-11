import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '@syspro/database';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User = request.user;
    let tenantId: string = request.tenantId;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (!user) {
      return false;
    }

    // If the request did not provide a tenantId (e.g. no X-Tenant-ID header),
    // fall back to the authenticated user's tenant.
    if (!tenantId) {
      tenantId = user.tenantId;
      request.tenantId = tenantId;
    }

    // Check if user belongs to the requested tenant
    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('Access denied: User does not belong to this tenant');
    }

    return true;
  }
}