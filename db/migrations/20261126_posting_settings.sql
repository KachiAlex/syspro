-- Tenant-configurable posting account map (key -> account code), mirroring
-- runtime ensure*Tables in src/lib/finance/posting-settings.ts.
create table if not exists finance_posting_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  setting_key text not null,
  account_code text not null,
  updated_at timestamptz not null default now(),
  unique (tenant_slug, setting_key)
);
create index if not exists finance_posting_settings_tenant on finance_posting_settings (tenant_slug);
