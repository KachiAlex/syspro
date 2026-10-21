-- Composite indexes for the dominant tenant+date/status access patterns on
-- the largest transactional tables. tenant_slug alone returns a full-tenant
-- scan; posting_date alone returns an all-tenants scan — the composite lets
-- Postgres satisfy both predicates from one index.

-- Ledger queries: WHERE tenant_slug = ? AND posting_date/entry_date BETWEEN ? AND ?
create index if not exists idx_journal_entries_tenant_posting_date
  on journal_entries (tenant_slug, posting_date);
create index if not exists idx_journal_entries_tenant_entry_date
  on journal_entries (tenant_slug, entry_date);

-- Open-order filters used by MPS/production-planning demand aggregation:
-- WHERE tenant_slug = ? AND status NOT IN ('Completed','Delivered','Fulfilled','Cancelled')
create index if not exists idx_sales_orders_tenant_status
  on sales_orders (tenant_slug, status);

-- AR aging / ledger reports: tenant + issued_date range + status.
create index if not exists idx_finance_invoices_tenant_issued
  on finance_invoices (tenant_slug, issued_date);
