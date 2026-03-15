-- Migration: Add indexes and audit logging for superadmin optimization
-- This migration adds indexes for common queries and creates audit_logs table

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action VARCHAR(50) NOT NULL, -- 'delete', 'suspend', 'activate', 'create'
  entity_type VARCHAR(50) NOT NULL, -- 'tenant', 'license', 'admin'
  entity_id VARCHAR(255) NOT NULL,
  entity_slug VARCHAR(255),
  details JSONB,
  user_id UUID,
  ip_address VARCHAR(45),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_logs_created_at_idx UNIQUE (created_at, id)
);

-- Create indexes for tenants table
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Create indexes for licenses table
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry ON licenses(expiry);

-- Create indexes for tenant_admins table
CREATE INDEX IF NOT EXISTS idx_tenant_admins_tenant_id ON tenant_admins(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_admins_email ON tenant_admins(email);

-- Create indexes for audit_logs table
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_slug ON audit_logs(entity_slug);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Add status column to tenants if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tenants' AND column_name = 'status'
  ) THEN
    ALTER TABLE tenants ADD COLUMN status VARCHAR(50) DEFAULT 'active';
  END IF;
END $$;
