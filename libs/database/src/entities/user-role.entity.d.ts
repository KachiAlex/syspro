import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
import { Permission } from './permission.entity';
export declare class UserRole extends BaseEntity {
    name: string;
    description?: string;
    code?: string;
    tenantId: string;
    tenant: Tenant;
    users: User[];
    permissions: Permission[];
}
