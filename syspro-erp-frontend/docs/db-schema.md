# Database Schema for Superadmin Portal

## Tables

### tenants
- id: SERIAL PRIMARY KEY
- name: VARCHAR(255) NOT NULL
- slug: VARCHAR(100) UNIQUE NOT NULL
- seats: INTEGER NOT NULL DEFAULT 1
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()

### licenses
- id: SERIAL PRIMARY KEY
- tenant_id: INTEGER REFERENCES tenants(id) ON DELETE CASCADE
- type: VARCHAR(50) NOT NULL (e.g., 'basic', 'premium')
- seats: INTEGER NOT NULL
- expiry: DATE
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()

### tenant_admins
- id: SERIAL PRIMARY KEY
- tenant_id: INTEGER REFERENCES tenants(id) ON DELETE CASCADE
- email: VARCHAR(255) UNIQUE NOT NULL
- name: VARCHAR(255) NOT NULL
- role: VARCHAR(50) NOT NULL DEFAULT 'admin'
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()

### superadmins
- id: SERIAL PRIMARY KEY
- email: VARCHAR(255) UNIQUE NOT NULL
- name: VARCHAR(255) NOT NULL
- password_hash: VARCHAR(255) NOT NULL
- created_at: TIMESTAMP DEFAULT NOW()

## Indexes
- CREATE INDEX idx_tenants_slug ON tenants(slug);
- CREATE INDEX idx_licenses_tenant_id ON licenses(tenant_id);
- CREATE INDEX idx_tenant_admins_tenant_id ON tenant_admins(tenant_id);
- CREATE INDEX idx_tenant_admins_email ON tenant_admins(email);

## Migrations
To apply these changes, run the following SQL in your database:

```sql
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  seats INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE licenses (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  seats INTEGER NOT NULL,
  expiry DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tenant_admins (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE superadmins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX idx_tenant_admins_tenant_id ON tenant_admins(tenant_id);
CREATE INDEX idx_tenant_admins_email ON tenant_admins(email);
```