create table if not exists document_merges (
  id text primary key,
  tenant_slug text not null,
  doc_type text not null check (doc_type in ('customer','vendor')),
  source_id text not null,
  target_id text not null,
  rewrote jsonb not null default '{}',
  created_by text,
  created_at timestamptz not null default now()
);
alter table if exists finance_customers add column if not exists merged_into text;
alter table if exists vendors add column if not exists merged_into text;
