-- POS shift management: one open shift per tenant, cash float + reconciliation.

create table if not exists pos_shifts (
  id text primary key,
  tenant_slug text not null,
  status text not null default 'open' check (status in ('open','closed')),
  opened_by text,
  opened_at timestamptz not null default now(),
  opening_float numeric not null default 0,
  closed_by text,
  closed_at timestamptz,
  closing_counted numeric,
  expected_cash numeric,
  variance numeric,
  notes text
);
create index if not exists pos_shifts_tenant_idx on pos_shifts (tenant_slug, opened_at);
-- One open shift per tenant.
create unique index if not exists pos_shifts_one_open on pos_shifts (tenant_slug) where status = 'open';

alter table pos_sales add column if not exists shift_id text;
create index if not exists pos_sales_shift_idx on pos_sales (tenant_slug, shift_id);
