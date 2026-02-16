-- Migration to add missing columns for superadmin portal tests

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE licenses ADD COLUMN IF NOT EXISTS type VARCHAR(50);
ALTER TABLE tenant_admins ADD COLUMN IF NOT EXISTS role VARCHAR(50);
