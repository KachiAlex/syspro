CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended','terminated')),
  contract_type text DEFAULT 'full_time' CHECK (contract_type IN ('full_time','part_time','contractor','intern')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users (tenant_id, lower(email))';
  ELSE
    -- Fallback: create index on email only if tenant_id is not present
    EXECUTE 'CREATE INDEX IF NOT EXISTS users_email_idx ON users (lower(email))';
  END IF;
END$$;

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_predefined boolean NOT NULL DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  module text,
  action text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Role -> permission mapping (create with FKs only if roles.id and permissions.id are uuid)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'id' AND udt_name = 'uuid'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'permissions' AND column_name = 'id' AND udt_name = 'uuid'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS role_permissions (
      role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    )';
  ELSE
    EXECUTE 'CREATE TABLE IF NOT EXISTS role_permissions (
      role_id text NOT NULL,
      permission_id text NOT NULL,
      PRIMARY KEY (role_id, permission_id)
    )';
  END IF;
END$$;

-- User -> role assignments (conditionally add FKs)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id' AND udt_name='uuid'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='id' AND udt_name='uuid'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS user_roles (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      is_primary boolean NOT NULL DEFAULT false,
      assigned_by uuid,
      assigned_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NULL,
      PRIMARY KEY (user_id, role_id)
    )';
  ELSE
    EXECUTE 'CREATE TABLE IF NOT EXISTS user_roles (
      user_id text NOT NULL,
      role_id text NOT NULL,
      is_primary boolean NOT NULL DEFAULT false,
      assigned_by text,
      assigned_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NULL,
      PRIMARY KEY (user_id, role_id)
    )';
  END IF;
END$$;

-- Delegations / Acting roles (time-bound elevated access)
-- Delegations / Acting roles (time-bound elevated access)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='id' AND udt_name='uuid'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='id' AND udt_name='uuid'
  ) THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS access_delegations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      from_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      starts_at timestamptz NOT NULL DEFAULT now(),
      ends_at timestamptz,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now()
    )';
  ELSE
    EXECUTE 'CREATE TABLE IF NOT EXISTS access_delegations (
      id text PRIMARY KEY,
      tenant_id text NOT NULL,
      from_user text NOT NULL,
      to_user text NOT NULL,
      role_id text NOT NULL,
      starts_at timestamptz NOT NULL DEFAULT now(),
      ends_at timestamptz,
      reason text,
      created_at timestamptz NOT NULL DEFAULT now()
    )';
  END IF;
END$$;

-- Invitations for user invites
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  token text NOT NULL,
  expires_at timestamptz,
  accepted boolean NOT NULL DEFAULT false
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'tenant_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS invitations_tenant_email_idx ON invitations (tenant_id, lower(email))';
  ELSE
    EXECUTE 'CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations (lower(email))';
  END IF;
END$$;

-- Admin audit log
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  target jsonb,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

