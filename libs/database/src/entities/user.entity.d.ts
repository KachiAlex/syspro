import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';
import { Organization } from './organization.entity';
import { UserRole } from './user-role.entity';
import { AuditLog } from './audit-log.entity';
export declare enum UserStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    SUSPENDED = "suspended",
    PENDING_VERIFICATION = "pending_verification"
}
export declare class User extends BaseEntity {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    avatar?: string;
    phone?: string;
    status: UserStatus;
    isActive: boolean;
    emailVerified: boolean;
    lastLoginAt?: Date;
    failedLoginAttempts: number;
    lockedUntil?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    emailVerificationToken?: string;
    tenantId: string;
    organizationId?: string;
    tenant: Tenant;
    organization?: Organization;
    roles: UserRole[];
    auditLogs: AuditLog[];
    get fullName(): string;
    get isLocked(): boolean;
    get canLogin(): boolean;
    incrementFailedLoginAttempts(): void;
    resetFailedLoginAttempts(): void;
}
