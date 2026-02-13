-- Migration: create tenants table used by superadmin UI
-- Run this migration in production to ensure tenant records persist.

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE,
  code text,
  domain text,
  "isActive" boolean DEFAULT false,
  settings jsonb DEFAULT '{}',
  "schemaName" text,
  region text,
  industry text,
  seats integer,
  status text DEFAULT 'pending',
  ledger_delta text DEFAULT '₦0',
  admin_name text,
  admin_email text,
  admin_password_hash text,
  admin_notes text,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now(),
  "deletedAt" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_key ON tenants(slug);
