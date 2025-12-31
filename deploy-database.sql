-- Syspro ERP Database Setup Script
-- Run this in your Neon SQL Editor

-- 1. Create Tenants Table
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" varchar(100) NOT NULL,
    "code" varchar(20) UNIQUE NOT NULL,
    "domain" varchar,
    "isActive" boolean DEFAULT true,
    "settings" jsonb DEFAULT '{}',
    "schemaName" varchar,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" timestamp with time zone
);

-- 2. Create Organizations Table
CREATE TABLE IF NOT EXISTS "organizations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" varchar(100) NOT NULL,
    "description" text,
    "code" varchar,
    "isActive" boolean DEFAULT true,
    "settings" jsonb DEFAULT '{}',
    "email" varchar,
    "phone" varchar,
    "address" text,
    "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "mpath" varchar DEFAULT '',
    "parentId" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" timestamp with time zone
);

-- 3. Create User Roles Table
CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" varchar(50) NOT NULL,
    "description" text,
    "code" varchar,
    "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" timestamp with time zone,
    UNIQUE("tenantId", "name")
);

-- 4. Create Users Table
CREATE TYPE "user_status_enum" AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');

CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "email" varchar NOT NULL,
    "firstName" varchar(50) NOT NULL,
    "lastName" varchar(50) NOT NULL,
    "password" varchar NOT NULL,
    "avatar" varchar,
    "phone" varchar,
    "status" user_status_enum DEFAULT 'pending_verification',
    "isActive" boolean DEFAULT true,
    "emailVerified" boolean DEFAULT false,
    "lastLoginAt" timestamp with time zone,
    "failedLoginAttempts" integer DEFAULT 0,
    "lockedUntil" timestamp with time zone,
    "passwordResetToken" varchar,
    "passwordResetExpires" timestamp with time zone,
    "emailVerificationToken" varchar,
    "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "organizationId" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" timestamp with time zone,
    UNIQUE("email", "tenantId")
);

-- 5. Create Permissions Table
CREATE TABLE IF NOT EXISTS "permissions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "resource" varchar NOT NULL,
    "action" varchar NOT NULL,
    "conditions" jsonb,
    "roleId" uuid NOT NULL REFERENCES "user_roles"("id") ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" timestamp with time zone
);

-- 6. Create User-Role Junction Table
CREATE TABLE IF NOT EXISTS "user_roles_junction" (
    "userId" uuid REFERENCES "users"("id") ON DELETE CASCADE,
    "roleId" uuid REFERENCES "user_roles"("id") ON DELETE CASCADE,
    PRIMARY KEY ("userId", "roleId")
);

-- 7. Create Subscriptions Table
CREATE TYPE "subscription_status_enum" AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'trialing');

CREATE TABLE IF NOT EXISTS "subscriptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "status" subscription_status_enum DEFAULT 'trialing',
    "planId" varchar NOT NULL,
    "currentPeriodStart" timestamp with time zone NOT NULL,
    "currentPeriodEnd" timestamp with time zone NOT NULL,
    "cancelAtPeriodEnd" boolean DEFAULT false,
    "trialEnd" timestamp with time zone,
    "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" timestamp with time zone
);

-- 8. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "action" varchar NOT NULL,
    "resource" varchar NOT NULL,
    "resourceId" varchar NOT NULL,
    "oldValues" jsonb,
    "newValues" jsonb,
    "ipAddress" varchar,
    "userAgent" text,
    "tenantId" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
    "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "createdAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" timestamp with time zone
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS "IDX_tenants_code" ON "tenants"("code");
CREATE INDEX IF NOT EXISTS "IDX_tenants_isActive" ON "tenants"("isActive");
CREATE INDEX IF NOT EXISTS "IDX_organizations_tenantId" ON "organizations"("tenantId");
CREATE INDEX IF NOT EXISTS "IDX_users_email_tenant" ON "users"("email", "tenantId");
CREATE INDEX IF NOT EXISTS "IDX_users_tenantId" ON "users"("tenantId");
CREATE INDEX IF NOT EXISTS "IDX_permissions_roleId" ON "permissions"("roleId");
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_tenantId" ON "audit_logs"("tenantId");
CREATE INDEX IF NOT EXISTS "IDX_audit_logs_createdAt" ON "audit_logs"("createdAt");

-- Insert Initial Data
-- 1. Create Platform Tenant
INSERT INTO "tenants" ("id", "name", "code", "domain", "isActive", "settings")
VALUES (
    gen_random_uuid(),
    'Syspro Platform',
    'PLATFORM',
    'platform.syspro.com',
    true,
    '{"timezone": "UTC", "currency": "USD", "dateFormat": "YYYY-MM-DD", "language": "en", "features": ["crm", "inventory", "finance", "hr", "projects", "reports"]}'::jsonb
) ON CONFLICT (code) DO NOTHING;

-- Get the platform tenant ID for subsequent inserts
DO $$
DECLARE
    platform_tenant_id uuid;
    platform_org_id uuid;
    super_admin_role_id uuid;
    admin_role_id uuid;
    user_role_id uuid;
    super_admin_user_id uuid;
BEGIN
    -- Get platform tenant ID
    SELECT id INTO platform_tenant_id FROM "tenants" WHERE code = 'PLATFORM';
    
    -- 2. Create Platform Organization
    INSERT INTO "organizations" ("id", "name", "description", "code", "isActive", "tenantId", "settings", "email")
    VALUES (
        gen_random_uuid(),
        'Syspro Platform',
        'Main platform organization for Syspro ERP',
        'PLATFORM_ORG',
        true,
        platform_tenant_id,
        '{"allowSubOrganizations": true, "maxUsers": 1000, "features": ["all"]}'::jsonb,
        'platform@syspro.com'
    ) ON CONFLICT DO NOTHING
    RETURNING id INTO platform_org_id;
    
    -- If organization already exists, get its ID
    IF platform_org_id IS NULL THEN
        SELECT id INTO platform_org_id FROM "organizations" WHERE "tenantId" = platform_tenant_id AND code = 'PLATFORM_ORG';
    END IF;
    
    -- 3. Create Default Roles
    -- Super Admin Role
    INSERT INTO "user_roles" ("id", "name", "code", "description", "tenantId")
    VALUES (
        gen_random_uuid(),
        'Super Admin',
        'SUPER_ADMIN',
        'Full system access with all permissions',
        platform_tenant_id
    ) ON CONFLICT ("tenantId", "name") DO NOTHING
    RETURNING id INTO super_admin_role_id;
    
    IF super_admin_role_id IS NULL THEN
        SELECT id INTO super_admin_role_id FROM "user_roles" WHERE "tenantId" = platform_tenant_id AND code = 'SUPER_ADMIN';
    END IF;
    
    -- Admin Role
    INSERT INTO "user_roles" ("id", "name", "code", "description", "tenantId")
    VALUES (
        gen_random_uuid(),
        'Admin',
        'ADMIN',
        'Administrative access to tenant resources',
        platform_tenant_id
    ) ON CONFLICT ("tenantId", "name") DO NOTHING
    RETURNING id INTO admin_role_id;
    
    IF admin_role_id IS NULL THEN
        SELECT id INTO admin_role_id FROM "user_roles" WHERE "tenantId" = platform_tenant_id AND code = 'ADMIN';
    END IF;
    
    -- User Role
    INSERT INTO "user_roles" ("id", "name", "code", "description", "tenantId")
    VALUES (
        gen_random_uuid(),
        'User',
        'USER',
        'Standard user access',
        platform_tenant_id
    ) ON CONFLICT ("tenantId", "name") DO NOTHING
    RETURNING id INTO user_role_id;
    
    IF user_role_id IS NULL THEN
        SELECT id INTO user_role_id FROM "user_roles" WHERE "tenantId" = platform_tenant_id AND code = 'USER';
    END IF;
    
    -- 4. Create Permissions for Super Admin (all permissions)
    INSERT INTO "permissions" ("resource", "action", "roleId")
    VALUES ('*', '*', super_admin_role_id)
    ON CONFLICT DO NOTHING;
    
    -- 5. Create Super Admin User
    INSERT INTO "users" ("id", "email", "firstName", "lastName", "password", "status", "isActive", "emailVerified", "tenantId", "organizationId")
    VALUES (
        gen_random_uuid(),
        'admin@syspro.com',
        'Super',
        'Admin',
        '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash of 'Admin@123'
        'active',
        true,
        true,
        platform_tenant_id,
        platform_org_id
    ) ON CONFLICT ("email", "tenantId") DO NOTHING
    RETURNING id INTO super_admin_user_id;
    
    IF super_admin_user_id IS NULL THEN
        SELECT id INTO super_admin_user_id FROM "users" WHERE email = 'admin@syspro.com' AND "tenantId" = platform_tenant_id;
    END IF;
    
    -- 6. Assign Super Admin Role to User
    INSERT INTO "user_roles_junction" ("userId", "roleId")
    VALUES (super_admin_user_id, super_admin_role_id)
    ON CONFLICT DO NOTHING;
    
    -- 7. Create Trial Subscription
    INSERT INTO "subscriptions" ("tenantId", "planId", "status", "currentPeriodStart", "currentPeriodEnd", "trialEnd")
    VALUES (
        platform_tenant_id,
        'enterprise-trial',
        'trialing',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + INTERVAL '30 days',
        CURRENT_TIMESTAMP + INTERVAL '30 days'
    ) ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Database setup completed successfully!';
    RAISE NOTICE 'Platform Tenant ID: %', platform_tenant_id;
    RAISE NOTICE 'Admin Credentials: admin@syspro.com / Admin@123';
END $$;