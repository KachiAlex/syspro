import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private tenantId: string | null = null;

  setTenant(tenantId: string | null): void {
    this.tenantId = tenantId;
  }

  getTenant(): string | null {
    return this.tenantId;
  }

  requireTenant(): string {
    if (!this.tenantId) {
      throw new Error('Tenant ID is required but not set in context');
    }
    return this.tenantId;
  }
}

