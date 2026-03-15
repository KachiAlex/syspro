-- Migration: create materialized view for reports summary per tenant
-- Run this once in your Postgres database (via psql or migration runner)

create materialized view if not exists reports_summary_mv as
select
  tenant_slug,
  count(*) filter (where true) as total_reports,
  (select count(*) from report_jobs rj where rj.tenant_slug = reports.tenant_slug and rj.status = 'queued') as queued_jobs,
  (select count(*) from report_jobs rj where rj.tenant_slug = reports.tenant_slug and rj.created_at >= now() - interval '7 days') as runs_last_7,
  (select avg(extract(epoch from (completed_at - started_at))) from report_jobs rj where rj.tenant_slug = reports.tenant_slug and rj.completed_at is not null and rj.completed_at >= now() - interval '7 days') as avg_run_secs
from reports
group by tenant_slug;

-- Index to make querying by tenant fast
create index if not exists idx_reports_summary_mv_tenant on reports_summary_mv (tenant_slug);

-- Note: To refresh the materialized view periodically run:
-- refresh materialized view concurrently reports_summary_mv;
