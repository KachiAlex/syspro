-- Create tenant users table
CREATE TABLE IF NOT EXISTS tenant_users (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_slug VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255),
  role_id VARCHAR(100) DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_tenant_user UNIQUE(tenant_slug, email),
  CONSTRAINT fk_tenant_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{"modules": {}, "features": []}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create role assignments tracking table
CREATE TABLE IF NOT EXISTS role_history (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_slug VARCHAR(255) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  old_role_id VARCHAR(100),
  new_role_id VARCHAR(100) NOT NULL,
  assigned_by_user_id VARCHAR(36),
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_role_history_user FOREIGN KEY (user_id) REFERENCES tenant_users(id),
  CONSTRAINT fk_role_history_old_role FOREIGN KEY (old_role_id) REFERENCES roles(id),
  CONSTRAINT fk_role_history_new_role FOREIGN KEY (new_role_id) REFERENCES roles(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_slug ON tenant_users(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_role ON tenant_users(tenant_slug, role_id);
CREATE INDEX IF NOT EXISTS idx_role_history_tenant_user ON role_history(tenant_slug, user_id);

-- Insert default roles
INSERT INTO roles (id, name, description, permissions) VALUES
  (
    'admin',
    'Administrator',
    'Full access to all modules and features',
    '{
      "modules": {
        "overview": 3, "crm": 3, "finance": 3, "people": 3, "projects": 3,
        "billing": 3, "inventory": 3, "procurement": 3, "itsupport": 3,
        "revops": 3, "automation": 3, "admin": 3, "integrations": 3,
        "analytics": 3, "security": 3, "policies": 3, "reports": 3,
        "dashboards": 3, "approvals": 3, "workflows": 3
      },
      "features": ["all"]
    }'::jsonb
  ),
  (
    'manager',
    'Manager',
    'Can read and write to most modules, manage teams',
    '{
      "modules": {
        "overview": 1, "crm": 2, "finance": 1, "people": 2, "projects": 2,
        "billing": 1, "inventory": 1, "procurement": 1, "itsupport": 1,
        "revops": 1, "automation": 1, "admin": 1, "integrations": 1,
        "analytics": 1, "security": 1, "policies": 1, "reports": 1,
        "dashboards": 1, "approvals": 2, "workflows": 2
      },
      "features": ["reports", "basic_analytics"]
    }'::jsonb
  ),
  (
    'editor',
    'Editor',
    'Can read and edit assigned modules, view reports',
    '{
      "modules": {
        "overview": 1, "crm": 2, "finance": 1, "people": 1, "projects": 2,
        "billing": 1, "inventory": 1, "procurement": 1, "itsupport": 1,
        "revops": 1, "automation": 1, "admin": 0, "integrations": 0,
        "analytics": 1, "security": 0, "policies": 0, "reports": 1,
        "dashboards": 1, "approvals": 1, "workflows": 1
      },
      "features": ["reports"]
    }'::jsonb
  ),
  (
    'viewer',
    'Viewer',
    'Read-only access to assigned modules',
    '{
      "modules": {
        "overview": 1, "crm": 1, "finance": 1, "people": 1, "projects": 1,
        "billing": 1, "inventory": 1, "procurement": 1, "itsupport": 1,
        "revops": 1, "automation": 0, "admin": 0, "integrations": 0,
        "analytics": 1, "security": 0, "policies": 0, "reports": 1,
        "dashboards": 1, "approvals": 0, "workflows": 0
      },
      "features": ["reports"]
    }'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
