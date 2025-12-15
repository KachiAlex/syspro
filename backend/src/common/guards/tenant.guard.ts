import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenant = request.headers['x-tenant-id'] || request.user?.organizationId;

    if (!tenant) {
      throw new UnauthorizedException('Tenant ID is required');
    }

    request.tenant = tenant;
    return true;
  }
}


