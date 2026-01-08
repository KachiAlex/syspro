import { BaseEntity } from './base.entity';
import { UserRole } from './user-role.entity';
export declare class Permission extends BaseEntity {
    tenantId: string;
    name: string;
    description?: string;
    resource: string;
    action: string;
    isActive: boolean;
    metadata?: Record<string, any>;
    conditions?: Record<string, any>;
    roleId?: string;
    role: UserRole;
}
