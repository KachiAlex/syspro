alter table bills add column if not exists payment_term_id uuid;
create table if not exists bill_payment_schedule (
  id uuid primary key default gen_random_uuid(),
  tenant_slug text not null,
  bill_id text not null,
  due_date date not null,
  amount numeric not null,
  paid_amount numeric not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists bill_sched_bill_idx on bill_payment_schedule (tenant_slug, bill_id);
