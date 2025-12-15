-- Syspro ERP Database Schema
-- Generated for PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE IF NOT EXISTS "tenant" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" varchar NOT NULL,
    "slug" varchar UNIQUE NOT NULL,
    "domain" varchar,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- Organizations table
CREATE TABLE IF NOT EXISTS "organization" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" varchar NOT NULL,
    "code" varchar UNIQUE NOT NULL,
    "type" varchar NOT NULL,
    "country" varchar,
    "currency" varchar DEFAULT 'NGN',
    "timezone" varchar DEFAULT 'Africa/Lagos',
    "email" varchar,
    "phone" varchar,
    "address" text,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- Users table
CREATE TABLE IF NOT EXISTS "user" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" varchar UNIQUE NOT NULL,
    "password" varchar NOT NULL,
    "firstName" varchar NOT NULL,
    "lastName" varchar NOT NULL,
    "phone" varchar,
    "avatar" varchar,
    "isActive" boolean DEFAULT true,
    "isEmailVerified" boolean DEFAULT false,
    "emailVerificationToken" varchar,
    "passwordResetToken" varchar,
    "passwordResetExpires" timestamp,
    "lastLoginAt" timestamp,
    "failedLoginAttempts" integer DEFAULT 0,
    "lockoutUntil" timestamp,
    "twoFactorEnabled" boolean DEFAULT false,
    "twoFactorSecret" varchar,
    "refreshToken" varchar,
    "refreshTokenExpires" timestamp,
    "tenantId" uuid,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- User-Tenant Access table (for multi-tenant access)
CREATE TABLE IF NOT EXISTS "user_tenant_access" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "role" varchar NOT NULL,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
    FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE
);

-- Subsidiary table
CREATE TABLE IF NOT EXISTS "subsidiary" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" varchar NOT NULL,
    "code" varchar UNIQUE NOT NULL,
    "organizationId" uuid,
    "tenantId" uuid NOT NULL,
    "registrationNumber" varchar,
    "taxId" varchar,
    "incorporationDate" date,
    "legalForm" varchar,
    "industry" varchar,
    "country" varchar,
    "state" varchar,
    "city" varchar,
    "address" text,
    "postalCode" varchar,
    "email" varchar,
    "phone" varchar,
    "website" varchar,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE SET NULL
);

-- Department table
CREATE TABLE IF NOT EXISTS "department" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" varchar NOT NULL,
    "code" varchar NOT NULL,
    "type" varchar NOT NULL,
    "subsidiaryId" uuid,
    "managerId" uuid,
    "tenantId" uuid NOT NULL,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    FOREIGN KEY ("subsidiaryId") REFERENCES "subsidiary"("id") ON DELETE CASCADE,
    FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE SET NULL
);

-- Roles table
CREATE TABLE IF NOT EXISTS "role" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" varchar NOT NULL,
    "description" text,
    "tenantId" uuid NOT NULL,
    "scope" varchar DEFAULT 'tenant',
    "isSystem" boolean DEFAULT false,
    "isActive" boolean DEFAULT true,
    "permissions" text,
    "metadata" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE
);

-- Permissions table
CREATE TABLE IF NOT EXISTS "permission" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" varchar UNIQUE NOT NULL,
    "description" text,
    "resource" varchar NOT NULL,
    "action" varchar NOT NULL,
    "scope" varchar DEFAULT 'tenant',
    "isSystem" boolean DEFAULT false,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- Role-Permission junction table
CREATE TABLE IF NOT EXISTS "role_permission" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "roleId" uuid NOT NULL,
    "permissionId" uuid NOT NULL,
    "granted" boolean DEFAULT true,
    "conditions" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE,
    FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE,
    UNIQUE ("roleId", "permissionId")
);

-- User-Role junction table
CREATE TABLE IF NOT EXISTS "user_role" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" uuid NOT NULL,
    "roleId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "assignedBy" uuid,
    "expiresAt" timestamp,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
    FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE,
    FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE
);

-- User Activity table
CREATE TABLE IF NOT EXISTS "user_activity" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "action" varchar NOT NULL,
    "resource" varchar,
    "resourceId" varchar,
    "ipAddress" varchar,
    "userAgent" varchar,
    "metadata" text,
    "createdAt" timestamp DEFAULT now(),
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
    FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE
);

-- Modules table
CREATE TABLE IF NOT EXISTS "module" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" varchar UNIQUE NOT NULL,
    "displayName" varchar NOT NULL,
    "description" text,
    "version" varchar NOT NULL,
    "category" varchar,
    "isCore" boolean DEFAULT false,
    "isActive" boolean DEFAULT true,
    "config" text,
    "dependencies" text,
    "permissions" text,
    "routes" text,
    "metadata" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- Tenant-Module junction table
CREATE TABLE IF NOT EXISTS "tenant_module" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tenantId" uuid NOT NULL,
    "moduleId" uuid NOT NULL,
    "isEnabled" boolean DEFAULT true,
    "config" text,
    "installedAt" timestamp DEFAULT now(),
    "installedBy" uuid,
    "expiresAt" timestamp,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE,
    FOREIGN KEY ("moduleId") REFERENCES "module"("id") ON DELETE CASCADE,
    FOREIGN KEY ("installedBy") REFERENCES "user"("id") ON DELETE SET NULL
);

-- Config table
CREATE TABLE IF NOT EXISTS "config" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "key" varchar NOT NULL,
    "value" text,
    "tenantId" uuid,
    "moduleId" uuid,
    "category" varchar,
    "dataType" varchar DEFAULT 'string',
    "isEncrypted" boolean DEFAULT false,
    "isPublic" boolean DEFAULT false,
    "description" text,
    "defaultValue" text,
    "validationRules" text,
    "metadata" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now(),
    FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE,
    FOREIGN KEY ("moduleId") REFERENCES "module"("id") ON DELETE CASCADE
);

-- Feature Flags table
CREATE TABLE IF NOT EXISTS "feature_flag" (
    "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    "key" varchar UNIQUE NOT NULL,
    "name" varchar NOT NULL,
    "description" text,
    "isEnabled" boolean DEFAULT false,
    "rolloutPercentage" integer DEFAULT 0,
    "tenantIds" text,
    "userIds" text,
    "conditions" text,
    "metadata" text,
    "createdAt" timestamp DEFAULT now(),
    "updatedAt" timestamp DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user"("email");
CREATE INDEX IF NOT EXISTS "idx_user_tenant" ON "user"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_user_tenant_access_user" ON "user_tenant_access"("userId");
CREATE INDEX IF NOT EXISTS "idx_user_tenant_access_tenant" ON "user_tenant_access"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_subsidiary_organization" ON "subsidiary"("organizationId");
CREATE INDEX IF NOT EXISTS "idx_subsidiary_tenant" ON "subsidiary"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_department_subsidiary" ON "department"("subsidiaryId");
CREATE INDEX IF NOT EXISTS "idx_department_tenant" ON "department"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_role_tenant" ON "role"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_user_role_user" ON "user_role"("userId");
CREATE INDEX IF NOT EXISTS "idx_user_role_tenant" ON "user_role"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_user_activity_user" ON "user_activity"("userId");
CREATE INDEX IF NOT EXISTS "idx_user_activity_tenant" ON "user_activity"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_tenant_module_tenant" ON "tenant_module"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_config_tenant" ON "config"("tenantId");
CREATE INDEX IF NOT EXISTS "idx_config_module" ON "config"("moduleId");

COMMENT ON TABLE "tenant" IS 'Multi-tenant isolation - each tenant represents a separate organization';
COMMENT ON TABLE "user" IS 'Platform users with multi-tenant access capabilities';
COMMENT ON TABLE "organization" IS 'Top-level organizational entities (Syscomptech, subsidiaries, etc.)';

