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

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
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

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
  meta?: PaginationMeta;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
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

// File and media types
export interface FileUpload {
  filename: string;
  mimetype: string;
  size: number;
  url: string;
  tenantId: string;
  uploadedBy: string;
}

// Configuration types
export interface SystemConfig {
  maintenance: boolean;
  allowRegistration: boolean;
  defaultTenantPlan: string;
  supportedLanguages: string[];
  supportedCurrencies: string[];
  supportedTimezones: string[];
}