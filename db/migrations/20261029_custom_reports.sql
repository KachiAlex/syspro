create table if not exists custom_reports (
  id text primary key,
  tenant_slug text not null,
  name text not null,
  description text,
  table_name text not null,
  columns jsonb not null default '[]',
  filters jsonb not null default '[]',
  sort jsonb,
  row_limit int not null default 500,
  is_shared boolean not null default false,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
