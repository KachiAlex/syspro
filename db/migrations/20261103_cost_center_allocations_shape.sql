-- cost_center_allocations was created with a legacy shape (account_code,
-- active) before the runtime code keyed rules by main_cost_center. The runtime
-- CREATE TABLE IF NOT EXISTS never alters an existing table, so allocation
-- lookups failed on those databases. Align the shape; legacy columns stay but
-- no longer block inserts. Idempotent.
alter table if exists cost_center_allocations add column if not exists main_cost_center text;
alter table if exists cost_center_allocations alter column account_code drop not null;
alter table if exists cost_center_allocations alter column active set default true;
create unique index if not exists cost_center_allocations_tenant_main_uq
  on cost_center_allocations (tenant_slug, main_cost_center);
