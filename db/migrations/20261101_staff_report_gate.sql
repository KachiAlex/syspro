-- Staff-report central approval gate: approval_id links the pending report
-- to the approval_requests row when a staff_report rule or people matrix
-- band is configured (opt-in — legacy HOD routing stays when unconfigured).
alter table if exists admin_staff_reports add column if not exists approval_id text;
create index if not exists idx_admin_staff_reports_approval
  on admin_staff_reports(approval_id) where approval_id is not null;
