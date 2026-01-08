import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
export declare class AuditLog extends BaseEntity {
    action: string;
    resource: string;
    resourceId: string;
    oldValues?: Record<string, any>;
    newValues?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    tenantId: string;
    userId: string;
    tenant: Tenant;
    user: User;
}
