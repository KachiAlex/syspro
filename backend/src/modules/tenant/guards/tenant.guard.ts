import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantContextService } from '../tenant-context.service';
import { TenantService } from '../tenant.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantService: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const tenantId = this.tenantContext.getTenant();

    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID is required');
    }

    // Super admin and CEO can access any tenant
    if (user.role === 'SUPER_ADMIN' || user.role === 'CEO') {
      return true;
    }

    // Validate user has access to this tenant
    const hasAccess = await this.tenantService.validateUserTenantAccess(
      user.id,
      tenantId,
    );
    if (!hasAccess) {
      throw new ForbiddenException(
        'You do not have access to this tenant',
      );
    }

    return true;
  }
}

