-- Saved report definitions (user/tenant-saved report configs for the report
-- workbench). Additive; no destructive changes.
create table if not exists saved_reports (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  name text not null,
  report_key text not null,
  config jsonb not null default '{}'::jsonb,
  created_by text,
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_slug, name, report_key)
);

create index if not exists saved_reports_tenant_idx on saved_reports (tenant_slug);
