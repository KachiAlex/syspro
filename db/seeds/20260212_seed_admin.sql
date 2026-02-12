-- Seed common roles and permissions for Admin module
INSERT INTO permissions (id, key, module, action, description)
VALUES
  (gen_random_uuid(), 'superadmin:*', 'admin', 'all', 'Full system access'),
  (gen_random_uuid(), 'tenant.admin:users:view', 'admin', 'view', 'View users'),
  (gen_random_uuid(), 'tenant.admin:users:create', 'admin', 'create', 'Create users'),
  (gen_random_uuid(), 'tenant.admin:users:edit', 'admin', 'edit', 'Edit users'),
  (gen_random_uuid(), 'tenant.admin:roles:manage', 'admin', 'manage', 'Manage roles')
ON CONFLICT DO NOTHING;

-- Predefined roles
INSERT INTO roles (id, tenant_id, name, description, predefined)
VALUES
  (gen_random_uuid(), NULL, 'Super Admin', 'Platform super administrator', true),
  (gen_random_uuid(), NULL, 'Admin', 'Tenant administrator', true),
  (gen_random_uuid(), NULL, 'Finance Manager', 'Finance lead', true),
  (gen_random_uuid(), NULL, 'HR Manager', 'HR lead', true),
  (gen_random_uuid(), NULL, 'HOD', 'Head of department', true),
  (gen_random_uuid(), NULL, 'Staff', 'Regular staff role', true)
ON CONFLICT DO NOTHING;
