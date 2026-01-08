import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { User } from './user.entity';
export declare class Organization extends BaseEntity {
    name: string;
    description?: string;
    code?: string;
    isActive: boolean;
    settings: Record<string, any>;
    email?: string;
    phone?: string;
    address?: string;
    tenantId: string;
    tenant: Tenant;
    parent?: Organization;
    children: Organization[];
    users: User[];
    get userCount(): number;
    get hasChildren(): boolean;
    get level(): number;
    getPath(): string[];
    getFullPath(): string;
}
