-- Manual Admin User Creation Script
-- Run this in your Neon SQL Editor if the seed endpoint fails

-- First, let's check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 1. Create Platform Tenant (if not exists)
INSERT INTO tenant (id, name, code, "isActive", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'Platform Tenant',
  'PLATFORM',
  true,
  NOW(),
  NOW()
) ON CONFLICT (code) DO NOTHING;

-- 2. Create Platform Organization (if not exists)
INSERT INTO organization (id, name, domain, "tenantId", settings, "isActive", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  'Syspro Platform',
  'syspro-platform.com',
  t.id,
  '{"timezone": "UTC", "currency": "USD", "dateFormat": "YYYY-MM-DD"}'::jsonb,
  true,
  NOW(),
  NOW()
FROM tenant t 
WHERE t.code = 'PLATFORM'
AND NOT EXISTS (
  SELECT 1 FROM organization o 
  WHERE o."tenantId" = t.id
);

-- 3. Create Super Admin User (if not exists)
INSERT INTO "user" (
  id, 
  "firstName", 
  "lastName", 
  email, 
  password, 
  role, 
  status, 
  "organizationId", 
  "tenantId", 
  "createdAt", 
  "updatedAt"
)
SELECT 
  gen_random_uuid(),
  'Super',
  'Admin',
  'admin@syspro.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash of 'Admin@123'
  'SUPER_ADMIN',
  'ACTIVE',
  o.id,
  t.id,
  NOW(),
  NOW()
FROM tenant t
JOIN organization o ON o."tenantId" = t.id
WHERE t.code = 'PLATFORM'
AND NOT EXISTS (
  SELECT 1 FROM "user" u 
  WHERE u.email = 'admin@syspro.com'
);

-- 4. Grant Admin Access to Platform Tenant
INSERT INTO user_tenant_access (id, "userId", "tenantId", "createdAt", "updatedAt")
SELECT 
  gen_random_uuid(),
  u.id,
  t.id,
  NOW(),
  NOW()
FROM "user" u
JOIN tenant t ON t.code = 'PLATFORM'
WHERE u.email = 'admin@syspro.com'
AND NOT EXISTS (
  SELECT 1 FROM user_tenant_access uta 
  WHERE uta."userId" = u.id AND uta."tenantId" = t.id
);

-- Verify the admin user was created
SELECT 
  u.id,
  u."firstName",
  u."lastName", 
  u.email,
  u.role,
  u.status,
  t.name as tenant_name,
  o.name as organization_name
FROM "user" u
JOIN tenant t ON t.id = u."tenantId"
JOIN organization o ON o.id = u."organizationId"
WHERE u.email = 'admin@syspro.com';