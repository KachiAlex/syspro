// Event Types for Event-Driven Architecture

export enum EventType {
  // User Events
  USER_CREATED = 'USER.CREATED',
  USER_UPDATED = 'USER.UPDATED',
  USER_DELETED = 'USER.DELETED',
  USER_ACTIVATED = 'USER.ACTIVATED',
  USER_DEACTIVATED = 'USER.DEACTIVATED',
  USER_LOGIN = 'USER.LOGIN',
  USER_LOGOUT = 'USER.LOGOUT',
  USER_PASSWORD_CHANGED = 'USER.PASSWORD_CHANGED',
  USER_2FA_ENABLED = 'USER.2FA_ENABLED',
  USER_2FA_DISABLED = 'USER.2FA_DISABLED',

  // Tenant Events
  TENANT_CREATED = 'TENANT.CREATED',
  TENANT_UPDATED = 'TENANT.UPDATED',
  TENANT_DELETED = 'TENANT.DELETED',
  TENANT_ACTIVATED = 'TENANT.ACTIVATED',
  TENANT_DEACTIVATED = 'TENANT.DEACTIVATED',
  TENANT_SWITCHED = 'TENANT.SWITCHED',

  // Role & Permission Events
  ROLE_CREATED = 'ROLE.CREATED',
  ROLE_UPDATED = 'ROLE.UPDATED',
  ROLE_DELETED = 'ROLE.DELETED',
  PERMISSION_GRANTED = 'PERMISSION.GRANTED',
  PERMISSION_REVOKED = 'PERMISSION.REVOKED',

  // Module Events
  MODULE_REGISTERED = 'MODULE.REGISTERED',
  MODULE_ENABLED = 'MODULE.ENABLED',
  MODULE_DISABLED = 'MODULE.DISABLED',
  MODULE_UPDATED = 'MODULE.UPDATED',

  // Configuration Events
  CONFIG_UPDATED = 'CONFIG.UPDATED',
  FEATURE_FLAG_TOGGLED = 'FEATURE_FLAG.TOGGLED',

  // Notification Events
  NOTIFICATION_SENT = 'NOTIFICATION.SENT',
  NOTIFICATION_FAILED = 'NOTIFICATION.FAILED',

  // Audit Events
  AUDIT_LOG_CREATED = 'AUDIT_LOG.CREATED',

  // File Events
  FILE_UPLOADED = 'FILE.UPLOADED',
  FILE_DELETED = 'FILE.DELETED',
}

export interface BaseEvent {
  eventType: EventType;
  tenantId: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UserCreatedEvent extends BaseEvent {
  eventType: EventType.USER_CREATED;
  data: {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}

export interface TenantCreatedEvent extends BaseEvent {
  eventType: EventType.TENANT_CREATED;
  data: {
    tenantId: string;
    name: string;
    code: string;
  };
}

export interface ModuleEnabledEvent extends BaseEvent {
  eventType: EventType.MODULE_ENABLED;
  data: {
    moduleId: string;
    moduleName: string;
    tenantId: string;
  };
}

export type SystemEvent = UserCreatedEvent | TenantCreatedEvent | ModuleEnabledEvent;

