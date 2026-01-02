// Core entity types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

// Tenant-related types
export interface Tenant extends BaseEntity {
  name: string;
  code: string;
  domain?: string;
  isActive: boolean;
  settings: TenantSettings;
  subscription?: Subscription;
}

export interface TenantSettings {
  timezone: string;
  currency: string;
  dateFormat: string;
  language: string;
  features: string[];
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

// User and authentication types
export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  tenantId: string;
  roles: UserRole[];
}

export interface UserRole extends BaseEntity {
  name: string;
  description?: string;
  permissions: Permission[];
  tenantId: string;
}

export interface Permission extends BaseEntity {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

// Subscription and billing types
export interface Subscription extends BaseEntity {
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  trialEnd?: Date;
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing'
}

// ERP Module types
export interface Organization extends BaseEntity {
  name: string;
  description?: string;
  tenantId: string;
  parentId?: string;
  isActive: boolean;
}

export interface Contact extends BaseEntity {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  organizationId?: string;
  tenantId: string;
  type: ContactType;
}

export enum ContactType {
  CUSTOMER = 'customer',
  VENDOR = 'vendor',
  EMPLOYEE = 'employee',
  LEAD = 'lead'
}

// Audit and logging types
export interface AuditLog extends BaseEntity {
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}