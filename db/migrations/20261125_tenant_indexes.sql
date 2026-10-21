-- Tenant-scoped index coverage: every table carrying tenant_slug gets an
-- index so tenant-filtered queries use index scans instead of seq scans.
-- Idempotent; skips views and tables/columns that do not exist.

do $$
declare
  t text;
  tables text[] := array[
    'account_balances','accounting_audit_log','activity_costs','admin_approval_routes',
    'advance_taxes','asset_capitalizations','asset_shift_allocations',
    'asset_value_adjustments','assignment_recommendations','attendance_qr_tokens',
    'bank_guarantees','budget_actuals','budget_approvals','budget_forecasts',
    'budget_lines','budget_variances','budget_versions','capacity_snapshots',
    'crm_activity_log','crm_contacts','crm_conversions','crm_customers',
    'crm_deal_competitors','crm_deals','crm_leads','data_imports',
    'employee_grievances','employee_skills','employee_transfers','field_jobs',
    'finance_allocations','finance_cost_centers','fx_revaluations',
    'invoice_discountings','leave_encashments','maintenance_visits',
    'mfg_sub_operations','mps_items','overtime_entries','payment_orders',
    'pos_held_sales','pos_price_list_items','pos_price_lists','report_jobs',
    'reports','sms_messages','staff_advance_applications','staffing_plans',
    'statement_runs','subcontract_material_movements','subcontract_materials',
    'subscription_invoices','tasks','time_logs','training_events',
    'user_notification_preferences','vendors','web_form_submissions',
    'webhook_deliveries','webhook_subscriptions','workstreams'
  ];
begin
  foreach t in array tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t and table_type = 'BASE TABLE'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'tenant_slug'
    ) then
      execute format(
        'create index if not exists %I on public.%I (tenant_slug)',
        'idx_' || t || '_tenant', t
      );
    end if;
  end loop;
end $$;

-- Composite indexes for the hottest tenant + status/date access patterns.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='crm_deals' and column_name='stage'
  ) then
    execute 'create index if not exists idx_crm_deals_tenant_stage on public.crm_deals (tenant_slug, stage)';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tasks' and column_name='status'
  ) then
    execute 'create index if not exists idx_tasks_tenant_status on public.tasks (tenant_slug, status)';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='time_logs' and column_name='work_date'
  ) then
    execute 'create index if not exists idx_time_logs_tenant_date on public.time_logs (tenant_slug, work_date)';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='webhook_deliveries' and column_name='status'
  ) then
    execute 'create index if not exists idx_webhook_deliveries_tenant_status on public.webhook_deliveries (tenant_slug, status)';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='crm_leads' and column_name='status'
  ) then
    execute 'create index if not exists idx_crm_leads_tenant_status on public.crm_leads (tenant_slug, status)';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='accounting_audit_log' and column_name='created_at'
  ) then
    execute 'create index if not exists idx_audit_log_tenant_created on public.accounting_audit_log (tenant_slug, created_at desc)';
  end if;
end $$;
