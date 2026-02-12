export type Json = any;

export type ContractType = 'full_time' | 'part_time' | 'contractor' | 'intern';

export interface User {
  id: string;
  tenantId?: string | null;
  email: string;
  name?: string;
  status: 'invited' | 'active' | 'suspended' | 'terminated';
  contractType?: ContractType;
  metadata?: Json;
  createdAt?: string;
  updatedAt?: string;
}

export interface Role {
  id: string;
  tenantId?: string | null;
  name: string;
  description?: string;
  predefined?: boolean;
  metadata?: Json;
}

export interface Permission {
  id: string;
  key: string;
  module: string;
  action: string;
  description?: string;
}

export interface Delegation {
  id: string;
  tenantId?: string;
  grantedBy?: string;
  grantedTo?: string;
  roleId?: string;
  startsAt?: string;
  endsAt?: string;
  reason?: string;
}
export type Json = any;

export interface User {
  id: string;
  tenantSlug: string;
  email: string;
  displayName?: string;
  status: 'invited' | 'active' | 'suspended' | 'terminated';
  contractType?: 'full-time' | 'part-time' | 'contractor' | 'intern';
  primaryRoleId?: string | null;
  metadata?: Json;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  tenantSlug: string;
  name: string;
  description?: string;
  isBuiltin: boolean;
  metadata?: Json;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  key: string;
  description?: string;
  module?: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  tenantSlug: string;
  email: string;
  invitedBy?: string;
  invitedAt: string;
  token: string;
  expiresAt?: string;
  accepted: boolean;
}

export interface Delegation {
  id: string;
  tenantSlug: string;
  fromUser: string;
  toUser: string;
  roleId: string;
  startsAt: string;
  endsAt?: string;
  reason?: string;
}
