/**
 * HR Core Database Operations (employees, departments, attendance, leave)
 */

import { randomUUID } from "crypto";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import { ensureAdminTables } from "@/lib/admin/db";
import { ensureAttendanceVerificationTables } from "@/lib/attendance-verification";
import type {
  EmployeeRecord,
  DepartmentRecord,
  AttendanceRecord,
  LeaveRecord,
} from "./types";
import { ensureOnce } from "@/lib/ensure-once";

function serializeTextArray(values?: string[] | null): string {
  if (!values || values.length === 0) return "{}";
  const escaped = values.map((v) => {
    const safe = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${safe}"`;
  });
  return `{${escaped.join(",")}}`;
}

// ============================================================================
// EMPLOYEE LIFECYCLE STATE MACHINE
// ============================================================================

/**
 * Valid employee statuses and their allowed transitions. `terminated` is
 * terminal — rehiring is a new employee record (or a fresh hire flow), not a
 * status flip on a terminated row.
 */
export const EMPLOYEE_STATUS_TRANSITIONS: Record<string, string[]> = {
  invited: ["active", "terminated"],
  active: ["on-leave", "suspended", "inactive", "terminated"],
  "on-leave": ["active", "terminated"],
  suspended: ["active", "terminated"],
  inactive: ["active", "terminated"],
  terminated: [],
};

export const EMPLOYEE_STATUSES = Object.keys(EMPLOYEE_STATUS_TRANSITIONS);

/** Throws when `to` is not a valid status or not reachable from `from`. */
export function validateStatusTransition(from: string | null | undefined, to: string) {
  if (!EMPLOYEE_STATUSES.includes(to)) {
    throw new Error(
      `Invalid employee status "${to}". Valid statuses: ${EMPLOYEE_STATUSES.join(", ")}.`
    );
  }
  const current = from ?? "invited";
  if (current === to) return;
  const allowed = EMPLOYEE_STATUS_TRANSITIONS[current];
  if (!allowed) return; // unknown legacy status — allow recovery to any valid state
  if (!allowed.includes(to)) {
    throw new Error(
      `Invalid status transition: ${current} → ${to}. Allowed: ${allowed.join(", ") || "none (terminal)"}.`
    );
  }
}

// ============================================================================
// HR AUDIT EVENT STREAM
// ============================================================================

/**
 * Writes an HR mutation to the tenant-scoped admin_audit_logs stream (the same
 * table surfaced by /api/tenant/audit). Never throws — audit failure must not
 * block the underlying operation.
 */
export async function logHrAudit(params: {
  tenantSlug: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    const id = randomUUID();
    await SQL`
      insert into admin_audit_logs (id, tenant_slug, user_id, action, resource, resource_id, changes, ip_address, created_at)
      values (${id}, ${params.tenantSlug}, ${params.userId ?? "system"}, ${params.action}, ${params.resource}, ${params.resourceId}, ${params.changes ? JSON.stringify(params.changes) : null}, ${params.ipAddress ?? null}, now())
    `;
  } catch (e) {
    console.error("HR audit log failed:", (e as any)?.message);
  }
}

// ============================================================================
// TABLE CREATION
// ============================================================================

export function ensureHrTables(...args: Parameters<typeof ensureHrTablesRun>) {
  return ensureOnce("hr/db:ensureHrTables", () => ensureHrTablesRun(...args));
}

async function ensureHrTablesRun(sql: SqlClient = SQL) {
  // Ensure base admin tables (admin_employees, admin_departments, etc.) exist
  // before running ALTER TABLE IF EXISTS on them.
  await ensureAdminTables(sql);

  // Tenant-scoped audit stream — mirrors the DDL in tenant-admin/schema.ts so
  // HR writes land even if the tenant-admin initializer hasn't run yet.
  await sql`
    create table if not exists admin_audit_logs (
      id text primary key,
      tenant_slug text not null,
      user_id text not null,
      action text not null,
      resource text not null,
      resource_id text not null,
      changes jsonb,
      ip_address text,
      user_agent text,
      created_at timestamptz default now()
    )
  `;
  await sql`alter table admin_audit_logs drop constraint if exists admin_audit_logs_action_check`;
  await sql`create index if not exists idx_admin_audit_logs_tenant on admin_audit_logs(tenant_slug)`;
  await sql`create index if not exists idx_admin_audit_logs_resource on admin_audit_logs(resource, resource_id)`;

  await sql`alter table if exists admin_roles add column if not exists description text`;
  await sql`alter table if exists admin_roles add column if not exists is_system boolean default false`;

  await sql`
    create table if not exists admin_user_roles (
      id text primary key,
      tenant_slug text not null,
      user_id text not null,
      role_id text not null,
      scope text not null check (scope in ('tenant','region','branch','department','custom')),
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create unique index if not exists idx_admin_user_roles_user_role on admin_user_roles(user_id, role_id)`;

  // Ensure admin_employees has all columns needed by insertEmployee
  await sql`alter table if exists admin_employees add column if not exists phone text`;
  await sql`alter table if exists admin_employees add column if not exists job_title text`;
  await sql`alter table if exists admin_employees add column if not exists reporting_manager_id text`;
  await sql`alter table if exists admin_employees add column if not exists cost_center text`;
  await sql`alter table if exists admin_employees add column if not exists hire_date timestamptz`;
  await sql`alter table if exists admin_employees add column if not exists salary numeric(15,2)`;
  await sql`alter table if exists admin_employees add column if not exists employment_type text default 'full-time' check (employment_type in ('full-time','part-time','contract','intern'))`;
  await sql`alter table if exists admin_employees add column if not exists role text default 'staff' check (role in ('staff','hod','admin','executive'))`;
  await sql`alter table if exists admin_employees add column if not exists created_by text`;
  await sql`alter table if exists admin_employees add column if not exists updated_by text`;
  await sql`alter table if exists admin_employees add column if not exists password_hash text`;
  await sql`alter table if exists admin_employees add column if not exists is_portal_active boolean default false`;
  await sql`alter table if exists admin_employees add column if not exists last_login timestamptz`;
  await sql`alter table if exists admin_employees add column if not exists address text`;
  await sql`alter table if exists admin_employees add column if not exists marital_status text`;
  await sql`alter table if exists admin_employees add column if not exists profile_picture text`;
  await sql`alter table if exists admin_employees add column if not exists gender text`;
  await sql`alter table if exists admin_employees add column if not exists date_of_birth text`;
  await sql`alter table if exists admin_employees add column if not exists emergency_contact_name text`;
  await sql`alter table if exists admin_employees add column if not exists emergency_contact_phone text`;
  await sql`alter table if exists admin_employees add column if not exists nationality text`;
  await sql`alter table if exists admin_employees add column if not exists state_of_origin text`;
  await sql`alter table if exists admin_employees add column if not exists city text`;
  await sql`alter table if exists admin_employees add column if not exists portal_permissions jsonb`;

  await sql`
    create table if not exists attendance_records (
      id text primary key,
      tenant_id text not null,
      employee_id text not null,
      work_date date not null,
      attendance_status text,
      work_mode text,
      check_in_time text,
      check_out_time text,
      employee_name text,
      notes text,
      check_in_lat numeric(10,7),
      check_in_lng numeric(10,7),
      check_out_lat numeric(10,7),
      check_out_lng numeric(10,7),
      confidence_score numeric,
      task_activity_count integer default 0,
      time_logged_hours numeric default 0,
      meetings_attended integer default 0,
      lms_activity_score numeric,
      is_override boolean default false,
      override_reason text,
      override_by_user_id text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create unique index if not exists idx_attendance_records_uniq on attendance_records(tenant_id, employee_id, work_date)`;
  await sql`create index if not exists idx_attendance_records_tenant on attendance_records(tenant_id)`;
  await sql`create index if not exists idx_attendance_records_emp_date on attendance_records(employee_id, work_date)`;
  await sql`alter table if exists attendance_records add column if not exists employee_name text`;
  await sql`alter table if exists attendance_records add column if not exists notes text`;
  await sql`alter table if exists attendance_records add column if not exists check_in_lat numeric(10,7)`;
  await sql`alter table if exists attendance_records add column if not exists check_in_lng numeric(10,7)`;
  await sql`alter table if exists attendance_records add column if not exists check_out_lat numeric(10,7)`;
  await sql`alter table if exists attendance_records add column if not exists check_out_lng numeric(10,7)`;
  await sql`alter table if exists attendance_records add column if not exists attendance_status text`;
  await sql`alter table if exists attendance_records add column if not exists work_mode text`;
  await sql`alter table if exists attendance_records add column if not exists confidence_score numeric`;
  await sql`alter table if exists attendance_records add column if not exists task_activity_count integer default 0`;
  await sql`alter table if exists attendance_records add column if not exists time_logged_hours numeric default 0`;
  await sql`alter table if exists attendance_records add column if not exists meetings_attended integer default 0`;
  await sql`alter table if exists attendance_records add column if not exists lms_activity_score numeric`;
  await sql`alter table if exists attendance_records add column if not exists is_override boolean default false`;
  await sql`alter table if exists attendance_records add column if not exists override_reason text`;
  await sql`alter table if exists attendance_records add column if not exists override_by_user_id text`;
  await sql`alter table if exists attendance_records add column if not exists updated_at timestamptz default now()`;
  try {
    const tableCheck = await sql`select 1 from pg_class where relname = 'admin_attendance' and relkind = 'r'`;
    if ((tableCheck as any[]).length > 0) {
      await sql`
        insert into attendance_records (id, tenant_id, employee_id, employee_name, work_date, attendance_status, check_in_time, check_out_time, notes, check_in_lat, check_in_lng, check_out_lat, check_out_lng, created_at, updated_at)
        select id, tenant_slug, employee_id, employee_name, date, status, check_in, check_out, notes, check_in_lat, check_in_lng, check_out_lat, check_out_lng, created_at, created_at
        from admin_attendance
        on conflict do nothing
      `;
    }
  } catch (e) { /* admin_attendance may not exist as a table */ }
  try {
    await sql`drop table if exists admin_attendance`;
  } catch (e) { /* ignore if cannot drop */ }
  try {
    await sql`
    create or replace view admin_attendance as
    select
      id,
      tenant_id as tenant_slug,
      employee_id,
      employee_name,
      work_date as date,
      attendance_status as status,
      check_in_time as check_in,
      check_out_time as check_out,
      notes,
      check_in_lat,
      check_in_lng,
      check_out_lat,
      check_out_lng,
      created_at,
      work_mode,
      check_in_method,
      check_in_distance_m,
      check_in_flagged,
      flag_reason,
      location_id,
      is_override,
      override_reason,
      override_by_user_id
    from attendance_records
  `;
  } catch (e) {
    // Verification columns may not exist yet on a fresh DB until
    // ensureAttendanceVerificationTables() runs; all in-repo readers use
    // attendance_records directly so a missing compat view is non-fatal.
  }

  await sql`
    create table if not exists admin_leave (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      employee_name text not null,
      leave_type text not null check (leave_type in ('annual','sick','personal','maternity','paternity','unpaid')),
      start_date date not null,
      end_date date not null,
      reason text not null,
      status text default 'pending' check (status in ('pending','approved','rejected','cancelled')),
      approved_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_leave_tenant on admin_leave(tenant_slug)`;
  await sql`create index if not exists idx_admin_leave_emp on admin_leave(employee_id)`;
  await sql`create index if not exists idx_admin_leave_status on admin_leave(status)`;
  await sql`alter table admin_leave add column if not exists reviewer_id text`;
  await sql`alter table admin_leave add column if not exists reviewer_comment text`;
  await sql`alter table admin_leave add column if not exists reviewed_at timestamptz`;

  // Payroll runs
  await sql`
    create table if not exists admin_payroll_runs (
      id text primary key,
      tenant_slug text not null,
      period text not null,
      status text default 'draft' check (status in ('draft','processing','completed','cancelled')),
      total_gross numeric(15,2) default 0,
      total_deductions numeric(15,2) default 0,
      total_net numeric(15,2) default 0,
      config jsonb default '{}',
      anomalies jsonb default '[]',
      compliance_passed boolean default false,
      processed_at timestamptz,
      processed_by text,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_payroll_runs_tenant on admin_payroll_runs(tenant_slug)`;
  await sql`create index if not exists idx_admin_payroll_runs_period on admin_payroll_runs(tenant_slug, period)`;

  // Payroll entries per employee per run
  await sql`
    create table if not exists admin_payroll_entries (
      id text primary key,
      tenant_slug text not null,
      run_id text not null references admin_payroll_runs(id) on delete cascade,
      employee_id text not null,
      employee_name text not null,
      department text,
      position text,
      base_salary numeric(15,2) default 0,
      transport_allowance numeric(15,2) default 0,
      housing_allowance numeric(15,2) default 0,
      meal_allowance numeric(15,2) default 0,
      bonus numeric(15,2) default 0,
      tax numeric(15,2) default 0,
      pension numeric(15,2) default 0,
      health_insurance numeric(15,2) default 0,
      other_deductions numeric(15,2) default 0,
      total_deductions numeric(15,2) default 0,
      gross_pay numeric(15,2) default 0,
      net_pay numeric(15,2) default 0,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_payroll_entries_run on admin_payroll_entries(run_id)`;
  await sql`create index if not exists idx_admin_payroll_entries_emp on admin_payroll_entries(tenant_slug, employee_id)`;

  // Payroll adjustments (audit trail for increments/deductions)
  await sql`
    create table if not exists admin_payroll_adjustments (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      type text not null check (type in ('increment','deduction')),
      category text not null check (category in ('bonus','promotion','fine','loan_repayment','other')),
      amount numeric(15,2) not null,
      reason text,
      effective_period text not null,
      status text default 'pending' check (status in ('pending','applied','rejected')),
      approved_by text,
      created_at timestamptz default now(),
      applied_at timestamptz
    )
  `;
  await sql`create index if not exists idx_admin_payroll_adjustments_tenant on admin_payroll_adjustments(tenant_slug)`;
  await sql`create index if not exists idx_admin_payroll_adjustments_emp_period on admin_payroll_adjustments(tenant_slug, employee_id, effective_period)`;
  await sql`create index if not exists idx_admin_payroll_adjustments_status on admin_payroll_adjustments(status)`;

  // Payroll run approval workflow columns
  await sql`alter table admin_payroll_runs add column if not exists approved_by text`;
  await sql`alter table admin_payroll_runs add column if not exists approved_at timestamptz`;
  await sql`alter table admin_payroll_runs add column if not exists journal_entry_id text`;
  await sql`alter table admin_payroll_runs add column if not exists paid_at timestamptz`;
  await sql`alter table admin_payroll_runs add column if not exists payment_journal_entry_id text`;

  // Employee termination date (set when offboarding completes)
  await sql`alter table admin_employees add column if not exists termination_date date`;

  // Employee bank details for payroll payout files
  await sql`alter table admin_employees add column if not exists bank_name text`;
  await sql`alter table admin_employees add column if not exists bank_account_number text`;
  await sql`alter table admin_employees add column if not exists bank_account_name text`;

  // Recurring per-employee salary components (allowances, deductions, loans)
  await sql`
    create table if not exists admin_employee_components (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      employee_name text,
      name text not null,
      component_type text not null check (component_type in ('earning','deduction')),
      amount_type text not null default 'fixed' check (amount_type in ('fixed','percent_of_base')),
      amount numeric(15,2) not null,
      is_recurring boolean default true,
      is_active boolean default true,
      start_period text,
      end_period text,
      notes text,
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_emp_components_tenant on admin_employee_components(tenant_slug)`;
  await sql`create index if not exists idx_admin_emp_components_emp on admin_employee_components(tenant_slug, employee_id)`;

  // Leave balances / entitlements per employee per leave type per year
  await sql`
    create table if not exists admin_leave_balances (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      employee_name text,
      leave_type text not null,
      year int not null,
      entitled numeric(6,2) not null default 0,
      used numeric(6,2) not null default 0,
      pending numeric(6,2) not null default 0,
      carried_over numeric(6,2) not null default 0,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      unique (tenant_slug, employee_id, leave_type, year)
    )
  `;
  await sql`create index if not exists idx_admin_leave_bal_tenant on admin_leave_balances(tenant_slug)`;
  await sql`create index if not exists idx_admin_leave_bal_emp on admin_leave_balances(tenant_slug, employee_id)`;
  // Rows created implicitly by leave-request tracking carry entitled=0 with no
  // deliberate configuration — flag distinguishes them from explicit overrides.
  await sql`alter table admin_leave_balances add column if not exists entitlement_set boolean not null default false`;
  await sql`update admin_leave_balances set entitlement_set = true where entitled > 0 and entitlement_set = false`;

  // Versioned tenant leave policies — effective-dated entitlements per type.
  await sql`
    create table if not exists admin_leave_policies (
      id text primary key,
      tenant_slug text not null,
      leave_type text not null,
      entitled_days numeric(6,2) not null,
      carryover_cap numeric(6,2) not null default 0,
      accrual text not null default 'annual' check (accrual in ('annual','monthly','immediate')),
      effective_from date not null,
      is_active boolean not null default true,
      country_code text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_leave_pol_tenant on admin_leave_policies(tenant_slug, leave_type, is_active)`;

  // Statutory deduction profile per tenant (tax bands, pension, other statutory lines)
  await sql`
    create table if not exists admin_statutory_profiles (
      id text primary key,
      tenant_slug text not null unique,
      country_code text,
      tax_bands jsonb not null default '[]',
      pension_employee_rate numeric(6,3) not null default 8,
      pension_employer_rate numeric(6,3) not null default 0,
      other_deductions jsonb not null default '[]',
      updated_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  // Employee offboarding workflow
  await sql`
    create table if not exists admin_offboarding (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      employee_name text,
      reason text,
      last_working_day date,
      status text not null default 'initiated' check (status in ('initiated','in_progress','completed','cancelled')),
      checklist jsonb not null default '[]',
      notes text,
      initiated_by text,
      completed_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_offboarding_tenant on admin_offboarding(tenant_slug)`;

  // Performance review cycles
  await sql`
    create table if not exists admin_review_cycles (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      period_start date not null,
      period_end date not null,
      status text not null default 'open' check (status in ('open','closed')),
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_review_cycles_tenant on admin_review_cycles(tenant_slug)`;

  // Shift definitions and employee shift assignments (roster)
  await sql`
    create table if not exists admin_shifts (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      start_time time not null,
      end_time time not null,
      days_of_week int[] not null default '{1,2,3,4,5}',
      grace_minutes int not null default 0,
      is_active boolean not null default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_shifts_tenant on admin_shifts(tenant_slug)`;

  await sql`
    create table if not exists admin_shift_assignments (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      shift_id text not null,
      effective_from date not null,
      effective_to date,
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_shift_assign_tenant on admin_shift_assignments(tenant_slug)`;
  await sql`create index if not exists idx_admin_shift_assign_emp on admin_shift_assignments(tenant_slug, employee_id)`;

  // Staff reports
  await sql`
    create table if not exists admin_staff_reports (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      title text,
      report_type text not null check (report_type in ('daily','weekly','monthly','quarterly','annual')),
      report_date text not null,
      raw_transcript text,
      refined_text text,
      objectives text not null,
      achievements text not null,
      challenges text,
      next_steps text,
      additional_notes text,
      meetings text,
      blockers text,
      activities text,
      head_of_department text not null,
      team_members text[] default '{}',
      submitted_at timestamptz default now(),
      updated_at timestamptz default now(),
      status text default 'pending' check (status in ('pending','under_review','approved','needs_edit')),
      appraisal jsonb default null
    )
  `;
  await sql`create index if not exists idx_admin_staff_reports_tenant on admin_staff_reports(tenant_slug)`;
  await sql`create index if not exists idx_admin_staff_reports_emp on admin_staff_reports(tenant_slug, employee_id)`;
  await sql`create index if not exists idx_admin_staff_reports_status on admin_staff_reports(status)`;
  await sql`create index if not exists idx_admin_staff_reports_hod on admin_staff_reports(tenant_slug, head_of_department)`;

    // Add columns that may be missing if the table was created before they were added
    await sql`alter table if exists admin_staff_reports add column if not exists title text`;
    await sql`alter table if exists admin_staff_reports add column if not exists raw_transcript text`;
    await sql`alter table if exists admin_staff_reports add column if not exists refined_text text`;
    await sql`alter table if exists admin_staff_reports add column if not exists meetings text`;
    await sql`alter table if exists admin_staff_reports add column if not exists blockers text`;
    await sql`alter table if exists admin_staff_reports add column if not exists activities text`;
    await sql`alter table if exists admin_staff_reports add column if not exists team_members text[] default '{}'`;
    await sql`alter table if exists admin_staff_reports add column if not exists appraisal jsonb default null`;
    await sql`alter table if exists admin_staff_reports add column if not exists template_id text`;
    await sql`alter table if exists admin_staff_reports add column if not exists template_snapshot jsonb default null`;
    await sql`alter table if exists admin_staff_reports add column if not exists department_id text`;
    await sql`alter table if exists admin_staff_reports add column if not exists hod_comment text`;
    await sql`alter table if exists admin_staff_reports add column if not exists hod_action_at timestamptz`;
    await sql`alter table if exists admin_staff_reports add column if not exists version integer default 1`;
    await sql`alter table if exists admin_staff_reports add column if not exists resubmission_of_id text`;
    await sql`alter table if exists admin_staff_reports add column if not exists rejected_at timestamptz`;
    await sql`alter table if exists admin_staff_reports add column if not exists submitter_role text default 'staff'`;
    await sql`alter table if exists admin_staff_reports add column if not exists approver_role text default 'hod'`;
    await sql`alter table if exists admin_staff_reports add column if not exists approver_id text`;
    await sql`create index if not exists idx_admin_staff_reports_approver on admin_staff_reports(tenant_slug, approver_role, approver_id)`;

    await sql`
      create table if not exists admin_staff_report_templates (
        id text primary key,
        tenant_slug text not null,
        report_type text not null check (report_type in ('daily','weekly','monthly','quarterly','annual')),
        name text not null,
        is_default boolean default false,
        sections jsonb not null default '[]',
        created_by text,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      )
    `;
    await sql`create index if not exists idx_admin_staff_report_templates_tenant on admin_staff_report_templates(tenant_slug)`;
    await sql`create index if not exists idx_admin_staff_report_templates_type on admin_staff_report_templates(tenant_slug, report_type)`;

  // Staff tasks assigned by HODs
  await sql`
    create table if not exists admin_staff_tasks (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      title text not null,
      description text,
      frequency text not null check (frequency in ('daily','weekly','monthly','quarterly','annual','one-time')),
      due_date text not null,
      status text default 'pending' check (status in ('pending','in_progress','completed','overdue')),
      assigned_by text not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_staff_tasks_tenant on admin_staff_tasks(tenant_slug)`;
  await sql`create index if not exists idx_admin_staff_tasks_emp on admin_staff_tasks(tenant_slug, employee_id)`;
  await sql`create index if not exists idx_admin_staff_tasks_status on admin_staff_tasks(status)`;
  await sql`create index if not exists idx_admin_staff_tasks_due on admin_staff_tasks(tenant_slug, due_date)`;

    await sql`alter table if exists admin_staff_tasks add column if not exists expected_outcome text`;
    await sql`alter table if exists admin_staff_tasks add column if not exists weight integer default 1`;
    await sql`alter table if exists admin_staff_tasks add column if not exists is_kpi boolean default false`;
    await sql`alter table if exists admin_staff_tasks add column if not exists completion_note text`;
    await sql`alter table if exists admin_staff_tasks add column if not exists completed_at timestamptz`;
    // Expand frequency constraint to support monthly, quarterly, annual
    await sql`alter table if exists admin_staff_tasks drop constraint if exists admin_staff_tasks_frequency_check`;
    await sql`alter table if exists admin_staff_tasks add constraint admin_staff_tasks_frequency_check check (frequency in ('daily','weekly','monthly','quarterly','annual','one-time'))`;

  // Leave requests
  await sql`
    create table if not exists admin_leave_requests (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      employee_name text not null,
      leave_type text not null check (leave_type in ('annual','sick','personal','maternity','paternity','unpaid')),
      start_date text not null,
      end_date text not null,
      reason text not null,
      status text default 'pending' check (status in ('pending','approved','rejected')),
      reviewer_id text,
      reviewer_name text,
      reviewer_comment text,
      reviewed_at timestamptz,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_leave_requests_tenant on admin_leave_requests(tenant_slug)`;
  await sql`create index if not exists idx_admin_leave_requests_emp on admin_leave_requests(tenant_slug, employee_id)`;
  await sql`create index if not exists idx_admin_leave_requests_status on admin_leave_requests(status)`;

  // Notifications
  await sql`
    create table if not exists admin_notifications (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      type text not null default 'info' check (type in ('info','success','warning','error')),
      category text not null default 'hr' check (category in ('hr','finance','crm','projects','system','general')),
      title text not null,
      message text not null,
      action_url text,
      is_read boolean default false,
      created_at timestamptz default now(),
      read_at timestamptz
    )
  `;
  await sql`create index if not exists idx_admin_notifications_emp on admin_notifications(tenant_slug, employee_id, is_read)`;
  await sql`create index if not exists idx_admin_notifications_created on admin_notifications(created_at desc)`;

  // Announcements
  await sql`
    create table if not exists admin_announcements (
      id text primary key,
      tenant_slug text not null,
      title text not null,
      message text not null,
      audience text default 'all' check (audience in ('all','department','role')),
      target_id text,
      priority text default 'medium' check (priority in ('low','medium','high','urgent')),
      created_by text,
      created_by_name text,
      created_at timestamptz default now(),
      expires_at timestamptz,
      is_active boolean default true
    )
  `;
  await sql`create index if not exists idx_admin_announcements_tenant on admin_announcements(tenant_slug, is_active, created_at desc)`;

  // Employee Appraisals (Phase 1+)
  await sql`
    create table if not exists admin_employee_appraisals (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      employee_name text,
      department_id text,
      period text not null default 'monthly' check (period in ('weekly','monthly','quarterly','annual','custom')),
      period_start timestamptz not null,
      period_end timestamptz not null,
      overall_score integer not null,
      rating text not null,
      categories jsonb not null,
      strengths text[] default '{}',
      improvements text[] default '{}',
      recommendation text,
      sentiment_score numeric(3,2) default 0,
      anomalies text[] default '{}',
      trend_delta integer,
      previous_score integer,
      department_average integer,
      percentile_rank integer,
      generated_by text not null default 'deterministic' check (generated_by in ('ai','deterministic','hybrid')),
      weights_used jsonb not null,
      metrics jsonb not null,
      peer_feedback jsonb,
      goal_alignment jsonb,
      generated_by_name text,
      is_shared boolean default false,
      employee_acknowledged boolean default false,
      acknowledged_at timestamptz,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_appraisals_tenant on admin_employee_appraisals(tenant_slug)`;
  await sql`create index if not exists idx_admin_appraisals_emp on admin_employee_appraisals(tenant_slug, employee_id, created_at desc)`;
  await sql`create index if not exists idx_admin_appraisals_dept on admin_employee_appraisals(tenant_slug, department_id)`;
  await sql`create index if not exists idx_admin_appraisals_period on admin_employee_appraisals(tenant_slug, employee_id, period)`;

  // Appraisal Configuration (per-tenant weights, templates, auto-generation settings)
  await sql`
    create table if not exists admin_appraisal_config (
      id text primary key,
      tenant_slug text not null unique,
      weights jsonb not null default '{}',
      auto_generate boolean default false,
      auto_generate_frequency text default 'monthly' check (auto_generate_frequency in ('weekly','monthly','quarterly','annual')),
      auto_generate_day integer default 1,
      use_ai boolean default true,
      role_templates jsonb default '{}',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  // Peer Feedback (Phase 4 — 360-degree)
  await sql`
    create table if not exists admin_peer_feedback (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      reviewer_id text not null,
      reviewer_name text,
      reviewer_role text default 'peer',
      rating integer not null check (rating between 1 and 5),
      collaboration_score integer check (collaboration_score between 1 and 100),
      communication_score integer check (communication_score between 1 and 100),
      reliability_score integer check (reliability_score between 1 and 100),
      strengths text[] default '{}',
      improvements text[] default '{}',
      comments text,
      period text default 'monthly',
      is_anonymous boolean default false,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_peer_feedback_emp on admin_peer_feedback(tenant_slug, employee_id, created_at desc)`;
  await sql`create index if not exists idx_admin_peer_feedback_reviewer on admin_peer_feedback(tenant_slug, reviewer_id)`;

  // Employee Goals / OKRs (Phase 4)
  await sql`
    create table if not exists admin_employee_goals (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      title text not null,
      description text,
      target_metric text,
      target_value numeric,
      actual_value numeric default 0,
      status text default 'not_started' check (status in ('not_started','in_progress','on_track','ahead','behind','achieved','completed','cancelled')),
      priority text default 'medium' check (priority in ('low','medium','high','critical')),
      start_date timestamptz,
      due_date timestamptz,
      completed_at timestamptz,
      linked_task_ids text[] default '{}',
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_goals_emp on admin_employee_goals(tenant_slug, employee_id, status)`;
  await sql`create index if not exists idx_admin_goals_tenant on admin_employee_goals(tenant_slug)`;
}

// ============================================================================
// EMPLOYEES
// ============================================================================

function normalizeEmployeeRow(row: any): EmployeeRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    departmentId: row.department_id,
    jobTitle: row.job_title ?? "",
    reportingManagerId: row.reporting_manager_id ?? null,
    branchId: row.branch_id ?? null,
    regionId: row.region_id ?? null,
    costCenter: row.cost_center ?? null,
    hireDate: row.hire_date ?? null,
    salary: row.salary ?? null,
    employmentType: row.employment_type ?? null,
    workMode: row.work_mode ?? null,
    role: row.role ?? null,
    status: row.status ?? "active",
    passwordHash: row.password_hash ?? null,
    isPortalActive: row.is_portal_active ?? false,
    lastLogin: row.last_login ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    portalPermissions: row.portal_permissions ?? null,
  };
}

export async function insertEmployee(row: {
  tenantSlug: string;
  name: string;
  email: string;
  phone?: string | null;
  departmentId: string;
  jobTitle: string;
  reportingManagerId?: string | null;
  branchId?: string | null;
  regionId?: string | null;
  costCenter?: string | null;
  hireDate?: string | null;
  salary?: number | null;
  employmentType?: string | null;
  role?: string | null;
  status?: string;
  createdBy?: string | null;
}) {
  const sql = SQL;
  await ensureHrTables(sql);

  // Check for duplicate email within tenant (case-insensitive)
  const existingEmp = await sql`
    select id, name from admin_employees
    where tenant_slug = ${row.tenantSlug}
      and email = ${row.email.toLowerCase()}
    limit 1
  `;
  if ((existingEmp as any[]).length > 0) {
    const existing = (existingEmp as any[])[0];
    throw new Error(`An employee with email ${row.email} already exists: ${existing.name}.`);
  }

  if (row.status) validateStatusTransition(null, row.status);

  // Enforce unique HOD per department
  if ((row.role ?? "staff") === "hod") {
    const dupRows = await sql`
      select id, name, email from admin_employees
      where tenant_slug = ${row.tenantSlug}
        and department_id = ${row.departmentId}
        and role = 'hod'
        and status != 'terminated'
      limit 1
    `;
    if ((dupRows as any[]).length > 0) {
      const dup = (dupRows as any[])[0];
      throw new Error(`Someone has already been assigned the HOD role in this department: ${dup.name} (${dup.email}).`);
    }
  }

  const id = randomUUID();
  await sql`
    insert into admin_employees (
      id, tenant_slug, name, email, phone, department_id, job_title,
      reporting_manager_id, branch_id, region_id, cost_center, hire_date,
      salary, employment_type, role, status, created_by
    ) values (
      ${id}, ${row.tenantSlug}, ${row.name}, ${row.email.toLowerCase()}, ${row.phone ?? null},
      ${row.departmentId}, ${row.jobTitle}, ${row.reportingManagerId ?? null},
      ${row.branchId ?? null}, ${row.regionId ?? null}, ${row.costCenter ?? null},
      ${row.hireDate ?? null}, ${row.salary ?? null}, ${row.employmentType ?? "full-time"},
      ${row.role ?? "staff"}, ${row.status ?? "active"}, ${row.createdBy ?? null}
    )
  `;
  const inserted = await sql`select * from admin_employees where id = ${id} limit 1`;
  const employee = normalizeEmployeeRow((inserted as any[])[0]);
  await logHrAudit({
    tenantSlug: row.tenantSlug,
    userId: row.createdBy,
    action: "employee.created",
    resource: "employee",
    resourceId: id,
    changes: {
      name: row.name,
      email: row.email.toLowerCase(),
      jobTitle: row.jobTitle,
      departmentId: row.departmentId,
      salary: row.salary ?? null,
      role: row.role ?? "staff",
    },
  });
  return employee;
}

export async function updateEmployee(
  id: string,
  updates: Partial<{
    name: string;
    email: string;
    phone: string | null;
    departmentId: string;
    jobTitle: string;
    reportingManagerId: string | null;
    branchId: string | null;
    regionId: string | null;
    costCenter: string | null;
    hireDate: string | null;
    salary: number | null;
    employmentType: string | null;
    workMode: string | null;
    role: string | null;
    status: string;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankAccountName: string | null;
  }>,
  tenantSlug?: string,
  actorId?: string | null
) {
  const sql = SQL;
  await ensureHrTables(sql);

  // Pre-fetch for audit old→new on sensitive fields
  const sensitive = ["salary", "role", "status", "departmentId", "jobTitle", "workMode", "employmentType"];
  const changedSensitive = sensitive.filter((k) => (updates as any)[k] !== undefined);
  let before: any = null;
  if (changedSensitive.length && tenantSlug) {
    const prev = await sql`
      select salary, role, status, department_id, job_title, work_mode, employment_type
      from admin_employees where id = ${id} and tenant_slug = ${tenantSlug} limit 1
    `;
    before = (prev as any[])[0] ?? null;
  }

  // Lifecycle state machine — enforced when the tenant context is available
  if (updates.status && before) {
    validateStatusTransition(String(before.status ?? "").toLowerCase(), updates.status);
  }

  // Enforce unique HOD per department
  if (updates.role === "hod") {
    const currentRows = tenantSlug
      ? await sql`select tenant_slug, department_id, role from admin_employees where id = ${id} and tenant_slug = ${tenantSlug} limit 1`
      : await sql`select tenant_slug, department_id, role from admin_employees where id = ${id} limit 1`;
    const current = (currentRows as any[])[0];
    if (current) {
      // Only check for conflicts if the employee is being PROMOTED to HOD
      // (not already HOD in the same department)
      const deptId = updates.departmentId ?? current.department_id;
      const isAlreadyHodInSameDept = current.role === 'hod' && current.department_id === deptId;
      if (!isAlreadyHodInSameDept) {
        const tenantSlug = current.tenant_slug;
        const dupRows = await sql`
          select id, name, email from admin_employees
          where tenant_slug = ${tenantSlug}
            and department_id = ${deptId}
            and role = 'hod'
            and status != 'terminated'
            and id != ${id}
          limit 1
        `;
        if ((dupRows as any[]).length > 0) {
          const dup = (dupRows as any[])[0];
          throw new Error(`Someone has already been assigned the HOD role in this department: ${dup.name} (${dup.email}).`);
        }
      }
    }
  }

  const updated = await sql`
    update admin_employees set
      name = coalesce(${updates.name ?? null}, name),
      email = coalesce(${updates.email ?? null}, email),
      phone = coalesce(${updates.phone ?? null}, phone),
      department_id = coalesce(${updates.departmentId ?? null}, department_id),
      job_title = coalesce(${updates.jobTitle ?? null}, job_title),
      reporting_manager_id = coalesce(${updates.reportingManagerId ?? null}, reporting_manager_id),
      branch_id = coalesce(${updates.branchId ?? null}, branch_id),
      region_id = coalesce(${updates.regionId ?? null}, region_id),
      cost_center = coalesce(${updates.costCenter ?? null}, cost_center),
      hire_date = coalesce(${updates.hireDate ?? null}, hire_date),
      salary = coalesce(${updates.salary ?? null}, salary),
      employment_type = coalesce(${updates.employmentType ?? null}, employment_type),
      work_mode = coalesce(${updates.workMode ?? null}, work_mode),
      role = coalesce(${updates.role ?? null}, role),
      status = coalesce(${updates.status ?? null}, status),
      bank_name = coalesce(${updates.bankName ?? null}, bank_name),
      bank_account_number = coalesce(${updates.bankAccountNumber ?? null}, bank_account_number),
      bank_account_name = coalesce(${updates.bankAccountName ?? null}, bank_account_name),
      updated_at = now()
    where id = ${id}
    ${tenantSlug ? sql`and tenant_slug = ${tenantSlug}` : sql``}
    returning *
  `;
  const rows = updated as any[];
  if (!rows.length) return null;
  const employee = normalizeEmployeeRow(rows[0]);

  if (tenantSlug) {
    const fieldNames: Record<string, string> = {
      salary: "salary",
      role: "role",
      status: "status",
      departmentId: "department_id",
      jobTitle: "job_title",
      workMode: "work_mode",
      employmentType: "employment_type",
    };
    const changes: Record<string, any> = { fields: Object.keys(updates).filter((k) => (updates as any)[k] !== undefined) };
    for (const k of changedSensitive) {
      const col = fieldNames[k];
      if (col && before) changes[k] = { from: before[col] ?? null, to: (rows[0] as any)[col] ?? null };
    }
    if (updates.status === "terminated" && before?.status !== "terminated") {
      await logHrAudit({
        tenantSlug,
        userId: actorId,
        action: "employee.terminated",
        resource: "employee",
        resourceId: id,
        changes: { from: before?.status ?? null, to: "terminated", fields: changes.fields },
      });
    } else {
      await logHrAudit({
        tenantSlug,
        userId: actorId,
        action: "employee.updated",
        resource: "employee",
        resourceId: id,
        changes,
      });
    }
  }
  return employee;
}

/** Historical-record counts that make hard deletion destructive. */
export async function employeeDependencies(id: string, tenantSlug: string) {
  const sql = SQL;
  const count = async (q: Promise<any>) => {
    try {
      const rows = (await q) as any[];
      return Number(rows[0]?.cnt ?? 0);
    } catch {
      return 0;
    }
  };
  const [leave, attendance, payroll, reviews, offboarding] = await Promise.all([
    count(sql`select count(*)::int as cnt from admin_leave where employee_id = ${id} and tenant_slug = ${tenantSlug}`),
    count(sql`select count(*)::int as cnt from attendance_records where employee_id = ${id} and tenant_id = ${tenantSlug}`),
    count(sql`select count(*)::int as cnt from admin_payroll_entries where employee_id = ${id} and tenant_slug = ${tenantSlug}`),
    count(sql`select count(*)::int as cnt from tenant_performance_reviews where employee_id = ${id} and tenant_slug = ${tenantSlug}`),
    count(sql`select count(*)::int as cnt from admin_offboarding where employee_id = ${id} and tenant_slug = ${tenantSlug}`),
  ]);
  return { leave, attendance, payroll, reviews, offboarding };
}

export async function deleteEmployee(id: string, tenantSlug: string, actorId?: string | null) {
  const sql = SQL;
  await sql`delete from admin_employees where id = ${id} and tenant_slug = ${tenantSlug}`;
  await logHrAudit({
    tenantSlug,
    userId: actorId,
    action: "employee.deleted",
    resource: "employee",
    resourceId: id,
  });
}

export async function listEmployees(filters: {
  tenantSlug: string;
  status?: string;
  departmentId?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 500) : 200;
  const offset = filters.offset ?? 0;

  let query = `select * from admin_employees where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }
  if (filters.departmentId) {
    params.push(filters.departmentId);
    query += ` and department_id = $${params.length}`;
  }

  query += ` order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeEmployeeRow);
}

export async function countEmployees(filters: {
  tenantSlug: string;
  status?: string;
  departmentId?: string;
}) {
  const sql = SQL;
  let query = `select count(*)::int as cnt from admin_employees where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }
  if (filters.departmentId) {
    params.push(filters.departmentId);
    query += ` and department_id = $${params.length}`;
  }

  const res = await db.query(query, params);
  return res.rows.length ? Number(res.rows[0].cnt) : 0;
}

export async function getEmployeeById(id: string, tenantSlug: string) {
  const sql = SQL;
  const rows = await sql`select * from admin_employees where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeEmployeeRow(arr[0]) : null;
}

// ============================================================================
// DEPARTMENTS
// ============================================================================

function normalizeDepartmentRow(row: any): DepartmentRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    name: row.name,
    description: row.description ?? null,
    parentDepartmentId: row.parent_department_id ?? null,
    budget: row.budget ?? null,
    costCenter: row.cost_center ?? null,
    managerId: row.manager_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listDepartments(tenantSlug: string) {
  const sql = SQL;
  const rows = await sql`select * from admin_departments where tenant_slug = ${tenantSlug} order by name`;
  return (rows as any[]).map(normalizeDepartmentRow);
}

export async function insertDepartment(row: {
  tenantSlug: string;
  name: string;
  description?: string | null;
  parentDepartmentId?: string | null;
  budget?: number | null;
  costCenter?: string | null;
  managerId?: string | null;
}) {
  const sql = SQL;
  const id = randomUUID();
  await sql`
    insert into admin_departments (id, tenant_slug, name, description, parent_department_id, budget, cost_center, manager_id)
    values (
      ${id}, ${row.tenantSlug}, ${row.name}, ${row.description ?? null},
      ${row.parentDepartmentId ?? null}, ${row.budget ?? null},
      ${row.costCenter ?? null}, ${row.managerId ?? null}
    )
  `;
  const inserted = await sql`select * from admin_departments where id = ${id} limit 1`;
  return normalizeDepartmentRow((inserted as any[])[0]);
}

export async function getDepartmentById(id: string, tenantSlug: string) {
  const sql = SQL;
  const rows = await sql`select * from admin_departments where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeDepartmentRow(arr[0]) : null;
}

/**
 * Given a tenant and a department name (or a UUID that already exists),
 * resolve it to a real admin_departments row. If the value is a raw name
 * that doesn't match any existing department, auto-create one.
 * This is the single source of truth for department resolution across
 * manual add, bulk import, and invite flows.
 */
export async function resolveOrCreateDepartment(
  tenantSlug: string,
  departmentNameOrId: string
): Promise<DepartmentRecord> {
  const sql = SQL;
  await ensureHrTables(sql);

  const trimmed = departmentNameOrId.trim();
  if (!trimmed) {
    throw new Error("Department name is required");
  }

  // 1. If it looks like a UUID, try direct ID lookup first
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(trimmed)) {
    const byId = await getDepartmentById(trimmed, tenantSlug);
    if (byId) return byId;
  }

  // 2. Case-insensitive name lookup
  const rows = await sql`
    select * from admin_departments
    where tenant_slug = ${tenantSlug} and lower(name) = lower(${trimmed})
    limit 1
  `;
  const arr = rows as any[];
  if (arr.length > 0) {
    return normalizeDepartmentRow(arr[0]);
  }

  // 3. Auto-create a minimal department
  return insertDepartment({
    tenantSlug,
    name: trimmed,
    description: null,
  });
}

export async function updateDepartmentHead(id: string, tenantSlug: string, managerId: string | null) {
  const sql = SQL;
  await sql`update admin_departments set manager_id = ${managerId}, updated_at = now() where id = ${id} and tenant_slug = ${tenantSlug}`;
  const rows = await sql`select * from admin_departments where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeDepartmentRow(arr[0]) : null;
}

export async function getManagedDepartmentForUser(userId: string, tenantSlug: string) {
  const sql = SQL;
  const rows = await sql`select * from admin_departments where tenant_slug = ${tenantSlug} and manager_id = ${userId} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeDepartmentRow(arr[0]) : null;
}

export function ensureDepartmentHeadRole(tenantSlug: string) {
  return ensureOnce(`hr/db:ensureDepartmentHeadRole:${tenantSlug}`, () =>
    ensureDepartmentHeadRoleRun(tenantSlug)
  );
}

async function ensureDepartmentHeadRoleRun(tenantSlug: string) {
  const sql = SQL;
  const rows = await sql`select id from admin_roles where tenant_slug = ${tenantSlug} and name = ${'department_head'} limit 1`;
  const arr = rows as any[];
  if (arr.length) return arr[0].id as string;
  const id = randomUUID();
  await sql`
    insert into admin_roles (id, tenant_slug, name, scope, permissions, description, is_system, created_at, updated_at)
    values (${id}, ${tenantSlug}, ${'department_head'}, ${'tenant'}, ${['hr:read', 'hr:write', 'hr:approve']}, ${'Department head with scoped access to their department'}, ${true}, now(), now())
  `;
  return id;
}

export async function assignDepartmentHeadRole(tenantSlug: string, userId: string, roleId: string) {
  const sql = SQL;
  await sql`
    insert into admin_user_roles (id, tenant_slug, user_id, role_id, scope, is_active, created_at)
    values (${randomUUID()}, ${tenantSlug}, ${userId}, ${roleId}, ${'department'}, ${true}, now())
    on conflict (user_id, role_id) do update set is_active = true, scope = ${'department'}
  `;
}

export async function revokeDepartmentHeadRole(tenantSlug: string, userId: string, roleId: string) {
  const sql = SQL;
  await sql`delete from admin_user_roles where tenant_slug = ${tenantSlug} and user_id = ${userId} and role_id = ${roleId}`;
}

export async function getTenantUsers(tenantSlug: string) {
  const sql = SQL;
  try {
    const rows = await sql`
      select id, email, name
      from admin_employees
      where tenant_slug = ${tenantSlug} and status = 'active'
      order by name
    `;
    return (rows as any[]).map((r) => ({ id: r.id, email: r.email, name: r.name }));
  } catch (error) {
    console.error('Failed to get tenant users:', error);
    return [];
  }
}

export async function getDepartmentEmployeeCount(tenantSlug: string, departmentId: string) {
  const res = await db.query<{ cnt: number }>(
    'select count(*) as cnt from admin_employees where tenant_slug = $1 and department_id = $2',
    [tenantSlug, departmentId]
  );
  return res.rows.length ? Number(res.rows[0].cnt) : 0;
}

/**
 * Delete a department. Refuses when employees are still assigned to it or it
 * has child departments — the caller must reassign/move them first.
 */
export async function deleteDepartment(id: string, tenantSlug: string): Promise<
  | { ok: true }
  | { ok: false; status: number; error: string }
> {
  const sql = SQL;
  await ensureHrTables(sql);

  const dept = await getDepartmentById(id, tenantSlug);
  if (!dept) return { ok: false, status: 404, error: "Department not found" };

  const employeeCount = await getDepartmentEmployeeCount(tenantSlug, id);
  if (employeeCount > 0) {
    return {
      ok: false,
      status: 409,
      error: `Cannot delete: ${employeeCount} employee${employeeCount === 1 ? " is" : "s are"} still assigned to this department. Reassign them first.`,
    };
  }

  const childRows = await sql`
    select count(*)::int as cnt from admin_departments
    where tenant_slug = ${tenantSlug} and parent_department_id = ${id}
  `;
  const childCount = Number((childRows as any[])[0]?.cnt ?? 0);
  if (childCount > 0) {
    return {
      ok: false,
      status: 409,
      error: `Cannot delete: ${childCount} sub-department${childCount === 1 ? "" : "s"} still reference${childCount === 1 ? "s" : ""} this department as parent.`,
    };
  }

  await sql`delete from admin_departments where id = ${id} and tenant_slug = ${tenantSlug}`;
  return { ok: true };
}

export async function listDepartmentsWithHeads(tenantSlug: string) {
  const sql = SQL;
  try {
    const rows = await sql`
      select d.*, e.name as head_name, e.email as head_email
      from admin_departments d
      left join admin_employees e on d.manager_id = e.id
      where d.tenant_slug = ${tenantSlug}
      order by d.name
    `;
    return (rows as any[]).map((r) => ({
      ...normalizeDepartmentRow(r),
      headName: r.head_name ?? null,
      headEmail: r.head_email ?? null,
    }));
  } catch (error) {
    console.error('Failed to list departments with heads:', error);
    return listDepartments(tenantSlug);
  }
}

// ============================================================================
// ATTENDANCE
// ============================================================================

function normalizeAttendanceRow(row: any): AttendanceRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    date: row.date,
    status: row.status,
    checkIn: row.check_in ?? null,
    checkOut: row.check_out ?? null,
    notes: row.notes ?? null,
    checkInLat: row.check_in_lat != null ? Number(row.check_in_lat) : null,
    checkInLng: row.check_in_lng != null ? Number(row.check_in_lng) : null,
    checkOutLat: row.check_out_lat != null ? Number(row.check_out_lat) : null,
    checkOutLng: row.check_out_lng != null ? Number(row.check_out_lng) : null,
    createdAt: row.created_at,
  };
}

/**
 * Roster-based late check: returns true when checkInTime ("HH:MM") is past
 * the employee's active shift start + grace for that weekday.
 * Returns null when the employee has no applicable shift.
 */
export async function isLateForShift(
  tenantSlug: string,
  employeeId: string,
  workDate: string,
  checkInTime: string
): Promise<boolean | null> {
  const sql = SQL;
  if (!/^\d{1,2}:\d{2}/.test(checkInTime)) return null;
  const dow = new Date(`${workDate}T00:00:00Z`).getUTCDay();
  try {
    const rows = await sql`
      select s.start_time, s.grace_minutes
      from admin_shift_assignments a
      join admin_shifts s on s.tenant_slug = a.tenant_slug and s.id = a.shift_id
      where a.tenant_slug = ${tenantSlug} and a.employee_id = ${employeeId}
        and a.effective_from <= ${workDate} and (a.effective_to is null or a.effective_to >= ${workDate})
        and ${dow} = any(s.days_of_week) and s.is_active
      order by a.effective_from desc limit 1
    `;
    const shift = (rows as any[])[0];
    if (!shift) return null;
    const [h, m] = checkInTime.split(":").map(Number);
    const [sh, sm] = String(shift.start_time).split(":").map(Number);
    return h * 60 + m > sh * 60 + sm + (shift.grace_minutes ?? 0);
  } catch {
    return null;
  }
}

export async function insertAttendance(row: {
  tenantSlug: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: string;
  checkIn?: string | null;
  checkOut?: string | null;
  notes?: string | null;
  workMode?: string | null;
  /** Admin user id performing the manual entry — recorded for audit */
  actorId?: string | null;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  await ensureAttendanceVerificationTables();
  // Reject attendance for ids that are not employees of this tenant — the id
  // must resolve in admin_employees or the record pollutes reports and can
  // never be seen by a portal user.
  const empRows = await sql`
    select name from admin_employees
    where id = ${row.employeeId} and tenant_slug = ${row.tenantSlug} limit 1
  `;
  const empName = (empRows as any[])[0]?.name;
  if (!empName) {
    const err = new Error("Employee not found in this tenant");
    (err as any).code = "EMPLOYEE_NOT_FOUND";
    throw err;
  }
  const id = randomUUID();
  // Admin-recorded attendance is a manual override — stamp it so it is
  // distinguishable from QR/geofence-verified check-ins in audit views.
  const overrideReason = `manual entry${row.notes ? `: ${row.notes}` : ""}`;
  // Roster-based late detection: a 'present' mark with a check-in past the
  // employee's assigned shift start + grace is downgraded to 'late'.
  let effectiveStatus = row.status;
  if (row.status === "present" && row.checkIn) {
    const late = await isLateForShift(row.tenantSlug, row.employeeId, row.date, row.checkIn);
    if (late) effectiveStatus = "late";
  }
  await sql`
    insert into attendance_records (id, tenant_id, employee_id, employee_name, work_date, attendance_status, check_in_time, check_out_time, notes, work_mode, check_in_method, is_override, override_reason, override_by_user_id, created_at, updated_at)
    values (${id}, ${row.tenantSlug}, ${row.employeeId}, ${empName}, ${row.date}, ${effectiveStatus}, ${row.checkIn ?? null}, ${row.checkOut ?? null}, ${row.notes ?? null}, ${row.workMode ?? null}, 'manual', true, ${overrideReason}, ${row.actorId ?? null}, now(), now())
    on conflict (tenant_id, employee_id, work_date) do update set
      attendance_status = excluded.attendance_status,
      check_in_time = coalesce(excluded.check_in_time, attendance_records.check_in_time),
      check_out_time = coalesce(excluded.check_out_time, attendance_records.check_out_time),
      notes = coalesce(excluded.notes, attendance_records.notes),
      employee_name = coalesce(excluded.employee_name, attendance_records.employee_name),
      check_in_method = 'manual',
      is_override = true,
      override_reason = excluded.override_reason,
      override_by_user_id = excluded.override_by_user_id,
      updated_at = now()
  `;
  const inserted = await sql`select id, tenant_id as tenant_slug, employee_id, employee_name,
      work_date as date, attendance_status as status, check_in_time as check_in,
      check_out_time as check_out, notes, check_in_lat, check_in_lng,
      check_out_lat, check_out_lng, work_mode, created_at
    from attendance_records where tenant_id = ${row.tenantSlug} and employee_id = ${row.employeeId} and work_date = ${row.date} limit 1`;
  await logHrAudit({
    tenantSlug: row.tenantSlug,
    userId: row.actorId,
    action: "attendance.override",
    resource: "attendance",
    resourceId: id,
    changes: {
      employeeId: row.employeeId,
      date: row.date,
      status: effectiveStatus,
      requestedStatus: row.status !== effectiveStatus ? row.status : undefined,
      reason: overrideReason,
    },
  });
  return normalizeAttendanceRow((inserted as any[])[0]);
}

export async function listAttendance(filters: {
  tenantSlug: string;
  date?: string;
  employeeId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
  const offset = filters.offset ?? 0;

  let query = `select id, tenant_id as tenant_slug, employee_id, employee_name,
      work_date as date, attendance_status as status, check_in_time as check_in,
      check_out_time as check_out, notes, check_in_lat, check_in_lng,
      check_out_lat, check_out_lng, work_mode, check_in_method, is_override,
      flag_reason, created_at
    from attendance_records where tenant_id = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.date) {
    params.push(filters.date);
    query += ` and work_date = $${params.length}`;
  }
  if (filters.employeeId) {
    params.push(filters.employeeId);
    query += ` and employee_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    query += ` and attendance_status = $${params.length}`;
  }

  query += ` order by work_date desc, created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeAttendanceRow);
}

export async function getAttendanceStats(tenantSlug: string, date: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select attendance_status as status, count(*)::int as cnt from attendance_records
    where tenant_id = ${tenantSlug} and work_date = ${date}
    group by attendance_status
  `;
  const counts: Record<string, number> = {};
  (rows as any[]).forEach((r) => { counts[r.status] = r.cnt; });
  return {
    present: counts["present"] ?? 0,
    absent: counts["absent"] ?? 0,
    late: counts["late"] ?? 0,
    halfDay: counts["half_day"] ?? 0,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

// ============================================================================
// LEAVE
// ============================================================================

function normalizeLeaveRow(row: any): LeaveRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    status: row.status,
    approvedBy: row.approved_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertLeave(row: {
  tenantSlug: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_leave (id, tenant_slug, employee_id, employee_name, leave_type, start_date, end_date, reason)
    values (${id}, ${row.tenantSlug}, ${row.employeeId}, ${row.employeeName}, ${row.leaveType}, ${row.startDate}, ${row.endDate}, ${row.reason})
  `;
  // New requests consume pending balance immediately (mirrors the
  // /api/tenant/leave/requests path).
  await adjustLeaveBalance({
    tenantSlug: row.tenantSlug,
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    leaveType: row.leaveType,
    year: new Date(`${row.startDate}T00:00:00Z`).getUTCFullYear(),
    pendingDelta: leaveDaysInclusive(row.startDate, row.endDate),
  });
  const inserted = await sql`select * from admin_leave where id = ${id} limit 1`;
  await logHrAudit({
    tenantSlug: row.tenantSlug,
    action: "leave.requested",
    resource: "leave",
    resourceId: id,
    changes: {
      employeeId: row.employeeId,
      leaveType: row.leaveType,
      startDate: row.startDate,
      endDate: row.endDate,
      days: leaveDaysInclusive(row.startDate, row.endDate),
    },
  });
  return normalizeLeaveRow((inserted as any[])[0]);
}

/** Inclusive day count for a leave range — matches daysBetween in the tenant routes. */
function leaveDaysInclusive(startDate: string, endDate: string): number {
  const s = new Date(`${startDate}T00:00:00Z`).getTime();
  const e = new Date(`${endDate}T00:00:00Z`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.round((e - s) / 86400000) + 1;
}

/**
 * Move days between pending/used buckets on admin_leave_balances.
 * Creates the row if absent (entitled 0 — real entitlement is set via
 * /api/tenant/leave/balances). Single place all leave write paths share.
 */
export async function adjustLeaveBalance(opts: {
  tenantSlug: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  year: number;
  pendingDelta?: number;
  usedDelta?: number;
}) {
  const sql = SQL;
  const pendingDelta = opts.pendingDelta ?? 0;
  const usedDelta = opts.usedDelta ?? 0;
  if (pendingDelta === 0 && usedDelta === 0) return;
  // Implicit rows get the policy/default entitlement (entitlement_set=false)
  // so the request isn't instantly over-balance; explicit overrides come via
  // POST /api/tenant/leave/balances which sets entitlement_set=true.
  const entitled = await resolveLeaveEntitlement({
    tenantSlug: opts.tenantSlug,
    leaveType: opts.leaveType,
    year: opts.year,
  });
  await sql`
    insert into admin_leave_balances (
      id, tenant_slug, employee_id, employee_name, leave_type, year, entitled, pending, used, entitlement_set
    ) values (
      ${randomUUID()}, ${opts.tenantSlug}, ${opts.employeeId}, ${opts.employeeName},
      ${opts.leaveType}, ${opts.year}, ${entitled}, greatest(0, ${pendingDelta}::numeric), greatest(0, ${usedDelta}::numeric), false
    )
    on conflict (tenant_slug, employee_id, leave_type, year)
    do update set
      pending = greatest(0, admin_leave_balances.pending + ${pendingDelta}::numeric),
      used = greatest(0, admin_leave_balances.used + ${usedDelta}::numeric),
      employee_name = coalesce(admin_leave_balances.employee_name, excluded.employee_name),
      updated_at = now()
  `;
}

/**
 * Remaining leave balance for an employee/type/year.
 * Explicit overrides (entitlement_set=true) win; implicit tracking rows and
 * absent rows fall back to the default entitlement. Unpaid is untracked.
 * Shared by all leave-creation paths so the cap is enforced identically.
 */
export async function checkLeaveBalanceAvailable(opts: {
  tenantSlug: string;
  employeeId: string;
  leaveType: string;
  year: number;
  days: number;
}): Promise<{ ok: boolean; remaining: number }> {
  const sql = SQL;
  if (opts.leaveType === "unpaid") return { ok: true, remaining: Number.POSITIVE_INFINITY };
  const rows = await sql`
    select entitled, used, pending, carried_over, entitlement_set from admin_leave_balances
    where tenant_slug = ${opts.tenantSlug} and employee_id = ${opts.employeeId}
      and leave_type = ${opts.leaveType} and year = ${opts.year}
    limit 1
  `;
  const bal = (rows as any[])[0];
  const entitled = bal?.entitlement_set
    ? Number(bal.entitled)
    : await resolveLeaveEntitlement({
        tenantSlug: opts.tenantSlug,
        leaveType: opts.leaveType,
        year: opts.year,
      });
  const remaining =
    entitled + Number(bal?.carried_over ?? 0) - Number(bal?.used ?? 0) - Number(bal?.pending ?? 0);
  return { ok: opts.days <= remaining, remaining };
}

export async function updateLeaveStatus(
  id: string,
  tenantSlug: string,
  status: string,
  approvedBy?: string | null
) {
  const sql = SQL;
  await ensureHrTables(sql);
  const prev = await sql`
    select status, leave_type, start_date, end_date, employee_id, employee_name
    from admin_leave where id = ${id} and tenant_slug = ${tenantSlug} limit 1
  `;
  const prevRow = (prev as any[])[0];
  if (!prevRow) return null;
  const updated = await sql`
    update admin_leave set
      status = ${status},
      approved_by = coalesce(${approvedBy ?? null}, approved_by),
      reviewed_at = now(),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `;
  const rows = updated as any[];
  if (!rows.length) return null;

  // Keep admin_leave_balances in step with the transition.
  const toDateStr = (d: any) => (d instanceof Date ? d.toISOString().split("T")[0] : String(d).split("T")[0]);
  const startDate = toDateStr(prevRow.start_date);
  const endDate = toDateStr(prevRow.end_date);
  const days = leaveDaysInclusive(startDate, endDate);
  const year = new Date(`${startDate}T00:00:00Z`).getUTCFullYear();
  const base = {
    tenantSlug,
    employeeId: prevRow.employee_id,
    employeeName: prevRow.employee_name ?? prevRow.employee_id,
    leaveType: prevRow.leave_type,
    year,
  };
  if (prevRow.status === "pending" && status === "approved") {
    await adjustLeaveBalance({ ...base, pendingDelta: -days, usedDelta: days });
  } else if (prevRow.status === "pending" && (status === "rejected" || status === "cancelled")) {
    await adjustLeaveBalance({ ...base, pendingDelta: -days });
  } else if (prevRow.status === "approved" && (status === "rejected" || status === "cancelled")) {
    await adjustLeaveBalance({ ...base, usedDelta: -days });
  } else if (prevRow.status === "approved" && status === "pending") {
    await adjustLeaveBalance({ ...base, pendingDelta: days, usedDelta: -days });
  }

  await logHrAudit({
    tenantSlug,
    userId: approvedBy,
    action: `leave.${status}`,
    resource: "leave",
    resourceId: id,
    changes: {
      employeeId: prevRow.employee_id,
      leaveType: prevRow.leave_type,
      from: prevRow.status,
      to: status,
      days,
    },
  });

  return normalizeLeaveRow(rows[0]);
}

export async function listLeave(filters: {
  tenantSlug: string;
  employeeId?: string;
  status?: string;
  leaveType?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
  const offset = filters.offset ?? 0;

  let query = `select * from admin_leave where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.employeeId) {
    params.push(filters.employeeId);
    query += ` and employee_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }
  if (filters.leaveType) {
    params.push(filters.leaveType);
    query += ` and leave_type = $${params.length}`;
  }

  query += ` order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeLeaveRow);
}

/** Default entitlements — kept in sync with /api/tenant/leave/balances. */
export const DEFAULT_LEAVE_ENTITLEMENTS: Record<string, number> = {
  annual: 21,
  sick: 12,
  personal: 5,
  maternity: 90,
  paternity: 14,
  unpaid: 0,
};

// ============================================================================
// LEAVE POLICIES (versioned, per-tenant)
// ============================================================================

export interface LeavePolicy {
  leaveType: string;
  entitledDays: number;
  carryoverCap: number;
  accrual: "annual" | "monthly" | "immediate";
  effectiveFrom: string;
  countryCode: string | null;
}

function normalizePolicyRow(row: any): LeavePolicy {
  return {
    leaveType: row.leave_type,
    entitledDays: Number(row.entitled_days) || 0,
    carryoverCap: Number(row.carryover_cap) || 0,
    accrual: row.accrual,
    effectiveFrom: row.effective_from instanceof Date
      ? row.effective_from.toISOString().split("T")[0]
      : String(row.effective_from).split("T")[0],
    countryCode: row.country_code ?? null,
  };
}

/** Latest active policy per leave_type applicable in `year` (effective-dated). */
export async function getLeavePolicies(tenantSlug: string, year: number): Promise<Record<string, LeavePolicy>> {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select distinct on (leave_type) * from admin_leave_policies
    where tenant_slug = ${tenantSlug} and is_active
      and effective_from <= ${year + "-12-31"}::date
    order by leave_type, effective_from desc
  `;
  const out: Record<string, LeavePolicy> = {};
  (rows as any[]).forEach((r) => { out[r.leave_type] = normalizePolicyRow(r); });
  return out;
}

/** Entitlement days a policy yields in `year` — monthly accrual is pro-rated. */
export function policyEntitlement(policy: LeavePolicy, year: number): number {
  if (policy.accrual === "monthly") {
    const now = new Date();
    const months =
      year < now.getUTCFullYear() ? 12
      : year === now.getUTCFullYear() ? now.getUTCMonth() + 1
      : 12;
    return Math.round((policy.entitledDays * months) / 12 * 10) / 10;
  }
  return policy.entitledDays;
}

/**
 * Effective entitlement for a leave type in `year`:
 *   explicit per-employee override (entitlement_set) > tenant policy > default.
 */
export async function resolveLeaveEntitlement(opts: {
  tenantSlug: string;
  leaveType: string;
  year: number;
  entitlementOverride?: number | null;
}): Promise<number> {
  if (opts.entitlementOverride != null) return opts.entitlementOverride;
  const policies = await getLeavePolicies(opts.tenantSlug, opts.year);
  const policy = policies[opts.leaveType];
  if (policy) return policyEntitlement(policy, opts.year);
  return DEFAULT_LEAVE_ENTITLEMENTS[opts.leaveType] ?? 0;
}

/** Insert or version a tenant leave policy (deactivates older versions). */
export async function upsertLeavePolicy(opts: {
  tenantSlug: string;
  leaveType: string;
  entitledDays: number;
  carryoverCap?: number;
  accrual?: "annual" | "monthly" | "immediate";
  effectiveFrom: string;
  countryCode?: string | null;
}): Promise<LeavePolicy> {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`
    update admin_leave_policies set is_active = false, updated_at = now()
    where tenant_slug = ${opts.tenantSlug} and leave_type = ${opts.leaveType} and is_active
  `;
  const id = randomUUID();
  const rows = await sql`
    insert into admin_leave_policies (id, tenant_slug, leave_type, entitled_days, carryover_cap, accrual, effective_from, country_code)
    values (${id}, ${opts.tenantSlug}, ${opts.leaveType}, ${opts.entitledDays}, ${opts.carryoverCap ?? 0}, ${opts.accrual ?? "annual"}, ${opts.effectiveFrom}, ${opts.countryCode ?? null})
    returning *
  `;
  return normalizePolicyRow((rows as any[])[0]);
}

export async function getLeaveBalance(tenantSlug: string, employeeId: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  const year = new Date().getUTCFullYear();

  // Entitlement/carried-over come from the balances table (tenant-overridable);
  // used/pending are computed from admin_leave so the answer is correct even
  // for requests recorded before balance tracking existed.
  const [usageRows, balanceRows, policies] = await Promise.all([
    sql`
      select leave_type, status, sum(end_date - start_date + 1)::int as days
      from admin_leave
      where tenant_slug = ${tenantSlug} and employee_id = ${employeeId}
        and status in ('approved', 'pending')
        and extract(year from start_date) = ${year}
      group by leave_type, status
    `,
    sql`
      select leave_type, entitled, carried_over, entitlement_set from admin_leave_balances
      where tenant_slug = ${tenantSlug} and employee_id = ${employeeId} and year = ${year}
    `,
    getLeavePolicies(tenantSlug, year),
  ]);

  const used: Record<string, number> = {};
  const pending: Record<string, number> = {};
  (usageRows as any[]).forEach((r) => {
    if (r.status === "approved") used[r.leave_type] = r.days ?? 0;
    if (r.status === "pending") pending[r.leave_type] = r.days ?? 0;
  });
  // Resolution order: global default < tenant policy < explicit per-employee
  // override (entitlement_set).
  const entitled: Record<string, number> = { ...DEFAULT_LEAVE_ENTITLEMENTS };
  for (const [type, p] of Object.entries(policies)) {
    entitled[type] = policyEntitlement(p, year);
  }
  const carried: Record<string, number> = {};
  (balanceRows as any[]).forEach((r) => {
    // Only deliberately configured entitlements override the defaults —
    // implicitly created tracking rows carry entitlement_set=false.
    if (r.entitlement_set) entitled[r.leave_type] = Number(r.entitled) || 0;
    carried[r.leave_type] = Number(r.carried_over) || 0;
  });

  const out: Record<string, { used: number; pending: number; total: number }> = {};
  for (const type of Object.keys(entitled)) {
    out[type] = {
      used: used[type] ?? 0,
      pending: pending[type] ?? 0,
      total: (entitled[type] ?? 0) + (carried[type] ?? 0),
    };
  }
  return out;
}

// ============================================================================
// PAYROLL
// ============================================================================

export interface PayrollTaxBand {
  upTo: number | null;
  rate: number;
}

export interface PayrollConfig {
  taxRate: number;
  pensionRate: number;
  healthInsuranceRate: number;
  transportAllowance: number;
  housingAllowance: number;
  mealAllowance: number;
  taxBands?: PayrollTaxBand[];
}

/** Progressive tax on a period amount. Bands are cumulative brackets on
 * the amount itself; a null upTo is the top (unbounded) bracket. */
export function computeProgressiveTax(amount: number, bands: PayrollTaxBand[]): number {
  let tax = 0;
  let lower = 0;
  for (const band of bands) {
    const upper = band.upTo ?? Number.POSITIVE_INFINITY;
    if (amount <= lower) break;
    const taxable = Math.min(amount, upper) - lower;
    tax += (taxable * band.rate) / 100;
    lower = upper;
  }
  return Math.round(tax * 100) / 100;
}

export interface PayrollAnomaly {
  type: string;
  severity: "warning" | "error";
  message: string;
  employeeId?: string;
  employeeName?: string;
}

export interface PayrollRunRecord {
  id: string;
  tenantSlug: string;
  period: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  config: PayrollConfig;
  anomalies: PayrollAnomaly[];
  compliancePassed: boolean;
  processedAt: string | null;
  processedBy: string | null;
  createdAt: string;
}

export interface PayrollEntryRecord {
  id: string;
  tenantSlug: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  department: string | null;
  position: string | null;
  baseSalary: number;
  transportAllowance: number;
  housingAllowance: number;
  mealAllowance: number;
  bonus: number;
  tax: number;
  pension: number;
  healthInsurance: number;
  otherDeductions: number;
  totalDeductions: number;
  grossPay: number;
  netPay: number;
  createdAt: string;
}

function normalizePayrollRun(row: any): PayrollRunRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    period: row.period,
    status: row.status,
    totalGross: Number(row.total_gross) || 0,
    totalDeductions: Number(row.total_deductions) || 0,
    totalNet: Number(row.total_net) || 0,
    config: (row.config as PayrollConfig) || {},
    anomalies: (row.anomalies as PayrollAnomaly[]) || [],
    compliancePassed: row.compliance_passed ?? false,
    processedAt: row.processed_at ?? null,
    processedBy: row.processed_by ?? null,
    createdAt: row.created_at,
  };
}

function normalizePayrollEntry(row: any): PayrollEntryRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    runId: row.run_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    department: row.department ?? null,
    position: row.position ?? null,
    baseSalary: Number(row.base_salary) || 0,
    transportAllowance: Number(row.transport_allowance) || 0,
    housingAllowance: Number(row.housing_allowance) || 0,
    mealAllowance: Number(row.meal_allowance) || 0,
    bonus: Number(row.bonus) || 0,
    tax: Number(row.tax) || 0,
    pension: Number(row.pension) || 0,
    healthInsurance: Number(row.health_insurance) || 0,
    otherDeductions: Number(row.other_deductions) || 0,
    totalDeductions: Number(row.total_deductions) || 0,
    grossPay: Number(row.gross_pay) || 0,
    netPay: Number(row.net_pay) || 0,
    createdAt: row.created_at,
  };
}

export function detectAnomalies(
  entries: PayrollEntryRecord[],
  prevEntries: PayrollEntryRecord[]
): PayrollAnomaly[] {
  const anomalies: PayrollAnomaly[] = [];
  const prevMap = new Map(prevEntries.map((e) => [e.employeeId, e]));

  for (const entry of entries) {
    // Zero salary
    if (entry.baseSalary <= 0) {
      anomalies.push({
        type: "zero_salary",
        severity: "error",
        message: "Employee has zero or negative base salary",
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
      });
    }

    // Massive increase vs previous
    const prev = prevMap.get(entry.employeeId);
    if (prev && prev.netPay > 0) {
      const change = (entry.netPay - prev.netPay) / prev.netPay;
      if (change > 2.0) {
        anomalies.push({
          type: "massive_increase",
          severity: "error",
          message: `Net pay increased by ${(change * 100).toFixed(0)}% vs previous period`,
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
        });
      } else if (change > 0.5) {
        anomalies.push({
          type: "large_increase",
          severity: "warning",
          message: `Net pay increased by ${(change * 100).toFixed(0)}% vs previous period`,
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
        });
      }
    }

    // Negative net
    if (entry.netPay < 0) {
      anomalies.push({
        type: "negative_net",
        severity: "error",
        message: "Net pay is negative after deductions",
        employeeId: entry.employeeId,
        employeeName: entry.employeeName,
      });
    }
  }

  // Duplicate check
  const idCounts = new Map<string, number>();
  for (const e of entries) {
    idCounts.set(e.employeeId, (idCounts.get(e.employeeId) || 0) + 1);
  }
  for (const [empId, count] of idCounts) {
    if (count > 1) {
      const emp = entries.find((e) => e.employeeId === empId);
      anomalies.push({
        type: "duplicate_employee",
        severity: "error",
        message: `Employee appears ${count} times in this payroll`,
        employeeId: empId,
        employeeName: emp?.employeeName,
      });
    }
  }

  return anomalies;
}

export function checkCompliance(
  entries: PayrollEntryRecord[],
  config: PayrollConfig
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  for (const entry of entries) {
    if (entry.grossPay <= 0) continue;

    // Tax sanity check: progressive bands when configured, else flat rate.
    // (an explicit rate of 0 means "no tax expected" — don't fall back to defaults)
    const expectedTax = config.taxBands?.length
      ? computeProgressiveTax(entry.grossPay, config.taxBands)
      : (entry.grossPay * (config.taxRate ?? 7.5)) / 100;
    const taxDiff = Math.abs(entry.tax - expectedTax);
    if (taxDiff > 1) {
      issues.push(
        `${entry.employeeName}: Tax (${entry.tax}) deviates from expected ${expectedTax.toFixed(2)}`
      );
    }

    // Pension check
    const pensionRate = config.pensionRate ?? 8;
    const expectedPension = (entry.grossPay * pensionRate) / 100;
    const pensionDiff = Math.abs(entry.pension - expectedPension);
    if (pensionDiff > 1) {
      issues.push(
        `${entry.employeeName}: Pension (${entry.pension}) deviates from expected ${expectedPension.toFixed(2)} based on ${pensionRate}% rate`
      );
    }

    // Net should not exceed gross
    if (entry.netPay > entry.grossPay) {
      issues.push(`${entry.employeeName}: Net pay (${entry.netPay}) exceeds gross pay (${entry.grossPay})`);
    }

    // Minimum wage check (example: 30,000 NGN or equivalent)
    if (entry.netPay > 0 && entry.netPay < 30000 && entry.baseSalary > 0) {
      issues.push(
        `${entry.employeeName}: Net pay (${entry.netPay}) is below minimum wage threshold`
      );
    }
  }

  return { passed: issues.length === 0, issues };
}

export async function createPayrollRun(params: {
  tenantSlug: string;
  period: string;
  config: PayrollConfig;
  entries: Omit<PayrollEntryRecord, "id" | "tenantSlug" | "runId" | "createdAt">[];
  processedBy?: string | null;
  status?: "draft" | "processing" | "completed";
}) {
  const sql = SQL;
  await ensureHrTables(sql);

  // Recompute statutory amounts server-side — callers (e.g. the payroll UI)
  // submit client-computed tax/pension/net which must not be trusted. Inputs
  // (base salary, allowances, bonus, other deductions) stay as provided;
  // tax/pension/statutory and the derived totals are recomputed from the
  // tenant's statutory profile (falling back to the run config's flat rates).
  let taxBands: PayrollTaxBand[] | null = params.config.taxBands?.length ? params.config.taxBands : null;
  let pensionRate = params.config.pensionRate;
  let otherStatutory: { name: string; type: string; amount: number }[] = [];
  try {
    const [profile] = await sql`
      select tax_bands, pension_employee_rate, other_deductions
      from admin_statutory_profiles where tenant_slug = ${params.tenantSlug}
    ` as any[];
    if (profile) {
      if (Array.isArray(profile.tax_bands) && profile.tax_bands.length) taxBands = profile.tax_bands;
      if (profile.pension_employee_rate != null) pensionRate = Number(profile.pension_employee_rate);
      if (Array.isArray(profile.other_deductions)) otherStatutory = profile.other_deductions;
    }
  } catch {
    // profile table may not exist yet — fall back to run config
  }

  const recomputeAnomalies: string[] = [];
  const entries = params.entries.map((e) => {
    const grossPay = Math.round(
      (e.baseSalary + e.transportAllowance + e.housingAllowance + e.mealAllowance + e.bonus) * 100
    ) / 100;
    const tax = taxBands
      ? computeProgressiveTax(grossPay, taxBands)
      : Math.round((grossPay * params.config.taxRate) / 100 * 100) / 100;
    const pension = Math.round((grossPay * pensionRate) / 100 * 100) / 100;
    let healthInsurance = Math.round((grossPay * params.config.healthInsuranceRate) / 100 * 100) / 100;
    let statutoryOther = 0;
    for (const d of otherStatutory) {
      const amt = d.type === "percent_of_gross"
        ? Math.round((grossPay * d.amount) / 100 * 100) / 100
        : d.amount;
      if (/health|nhis|hmo/i.test(d.name)) healthInsurance += amt;
      else statutoryOther += amt;
    }
    const totalDeductions = Math.round(
      (tax + pension + healthInsurance + statutoryOther + e.otherDeductions) * 100
    ) / 100;
    const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;
    if (
      Math.abs(tax - e.tax) > 0.5 ||
      Math.abs(pension - e.pension) > 0.5 ||
      Math.abs(netPay - e.netPay) > 0.5
    ) {
      recomputeAnomalies.push(
        `${e.employeeName}: submitted figures adjusted server-side (tax ${e.tax}→${tax}, net ${e.netPay}→${netPay})`
      );
    }
    return {
      ...e,
      grossPay,
      tax,
      pension,
      healthInsurance,
      otherDeductions: e.otherDeductions + statutoryOther,
      totalDeductions,
      netPay,
    };
  });

  // Fetch previous period entries for anomaly detection
  const prevPeriod = (await sql`
    select id from admin_payroll_runs
    where tenant_slug = ${params.tenantSlug} and period < ${params.period}
    order by period desc limit 1
  `) as any[];
  let prevEntries: PayrollEntryRecord[] = [];
  if (prevPeriod.length > 0) {
    const prevRows = await sql`
      select * from admin_payroll_entries where run_id = ${prevPeriod[0].id}
    `;
    prevEntries = (prevRows as any[]).map(normalizePayrollEntry);
  }

  const runId = randomUUID();
  const totalGross = entries.reduce((s, e) => s + e.grossPay, 0);
  const totalDeductions = entries.reduce((s, e) => s + e.totalDeductions, 0);
  const totalNet = entries.reduce((s, e) => s + e.netPay, 0);

  const anomalies = [
    ...recomputeAnomalies,
    ...detectAnomalies(
      entries.map((e) => ({ ...e, id: "", tenantSlug: params.tenantSlug, runId, createdAt: "" })),
      prevEntries
    ),
  ];
  const compliance = checkCompliance(
    entries.map((e) => ({ ...e, id: "", tenantSlug: params.tenantSlug, runId, createdAt: "" })),
    {
      ...params.config,
      pensionRate,
      taxBands: taxBands ?? params.config.taxBands,
    }
  );

  await sql`
    insert into admin_payroll_runs (
      id, tenant_slug, period, status, total_gross, total_deductions, total_net,
      config, anomalies, compliance_passed, processed_by
    ) values (
      ${runId}, ${params.tenantSlug}, ${params.period}, ${params.status ?? "completed"},
      ${totalGross}, ${totalDeductions}, ${totalNet},
      ${JSON.stringify(params.config)}::jsonb, ${JSON.stringify(anomalies)}::jsonb,
      ${compliance.passed}, ${params.processedBy ?? null}
    )
  `;

  for (const entry of entries) {
    const entryId = randomUUID();
    await sql`
      insert into admin_payroll_entries (
        id, tenant_slug, run_id, employee_id, employee_name, department, position,
        base_salary, transport_allowance, housing_allowance, meal_allowance, bonus,
        tax, pension, health_insurance, other_deductions, total_deductions,
        gross_pay, net_pay
      ) values (
        ${entryId}, ${params.tenantSlug}, ${runId}, ${entry.employeeId}, ${entry.employeeName},
        ${entry.department ?? null}, ${entry.position ?? null},
        ${entry.baseSalary}, ${entry.transportAllowance}, ${entry.housingAllowance},
        ${entry.mealAllowance}, ${entry.bonus},
        ${entry.tax}, ${entry.pension}, ${entry.healthInsurance}, ${entry.otherDeductions},
        ${entry.totalDeductions}, ${entry.grossPay}, ${entry.netPay}
      )
    `;
  }

  return { runId, anomalies, compliance };
}

export async function listPayrollRuns(tenantSlug: string, opts?: { limit?: number; offset?: number }) {
  const sql = SQL;
  await ensureHrTables(sql);
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;
  const rows = await sql`
    select * from admin_payroll_runs
    where tenant_slug = ${tenantSlug}
    order by period desc, created_at desc
    limit ${limit} offset ${offset}
  `;
  return (rows as any[]).map(normalizePayrollRun);
}

export async function getPayrollRun(tenantSlug: string, runId: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_payroll_runs
    where id = ${runId} and tenant_slug = ${tenantSlug}
    limit 1
  `;
  const arr = rows as any[];
  return arr.length ? normalizePayrollRun(arr[0]) : null;
}

export async function getPayrollEntries(runId: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_payroll_entries where run_id = ${runId} order by employee_name
  `;
  return (rows as any[]).map(normalizePayrollEntry);
}

export async function getPayrollHistoryForEmployee(tenantSlug: string, employeeId: string, opts?: { limit?: number }) {
  const sql = SQL;
  await ensureHrTables(sql);
  const limit = opts?.limit ?? 12;
  const rows = await sql`
    select e.*, r.period, r.status from admin_payroll_entries e
    join admin_payroll_runs r on e.run_id = r.id
    where e.tenant_slug = ${tenantSlug} and e.employee_id = ${employeeId}
    order by r.period desc
    limit ${limit}
  `;
  return rows as any[];
}

// ============================================================================
// PAYROLL ADJUSTMENTS
// ============================================================================

export interface PayrollAdjustmentRecord {
  id: string;
  tenantSlug: string;
  employeeId: string;
  type: 'increment' | 'deduction';
  category: 'bonus' | 'promotion' | 'fine' | 'loan_repayment' | 'other';
  amount: number;
  reason: string | null;
  effectivePeriod: string;
  status: 'pending' | 'applied' | 'rejected';
  approvedBy: string | null;
  createdAt: string;
  appliedAt: string | null;
}

function normalizeAdjustmentRow(row: any): PayrollAdjustmentRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    employeeId: row.employee_id,
    type: row.type,
    category: row.category,
    amount: Number(row.amount) || 0,
    reason: row.reason ?? null,
    effectivePeriod: row.effective_period,
    status: row.status,
    approvedBy: row.approved_by ?? null,
    createdAt: row.created_at,
    appliedAt: row.applied_at ?? null,
  };
}

export async function createPayrollAdjustment(params: {
  tenantSlug: string;
  employeeId: string;
  type: 'increment' | 'deduction';
  category: 'bonus' | 'promotion' | 'fine' | 'loan_repayment' | 'other';
  amount: number;
  reason?: string | null;
  effectivePeriod: string;
  approvedBy?: string | null;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_payroll_adjustments (
      id, tenant_slug, employee_id, type, category, amount, reason,
      effective_period, status, approved_by
    ) values (
      ${id}, ${params.tenantSlug}, ${params.employeeId}, ${params.type},
      ${params.category}, ${params.amount}, ${params.reason ?? null},
      ${params.effectivePeriod}, 'pending', ${params.approvedBy ?? null}
    )
  `;
  return { id };
}

export async function listPayrollAdjustments(
  tenantSlug: string,
  opts?: {
    employeeId?: string;
    period?: string;
    status?: 'pending' | 'applied' | 'rejected';
    limit?: number;
    offset?: number;
  }
) {
  const sql = SQL;
  await ensureHrTables(sql);
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  const rows = await sql`
    select * from admin_payroll_adjustments
    where tenant_slug = ${tenantSlug}
      ${opts?.employeeId ? sql`and employee_id = ${opts.employeeId}` : sql``}
      ${opts?.period ? sql`and effective_period = ${opts.period}` : sql``}
      ${opts?.status ? sql`and status = ${opts.status}` : sql``}
    order by created_at desc
    limit ${limit} offset ${offset}
  `;
  return (rows as any[]).map(normalizeAdjustmentRow);
}

export async function getPayrollAdjustment(tenantSlug: string, id: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_payroll_adjustments
    where id = ${id} and tenant_slug = ${tenantSlug}
    limit 1
  `;
  const arr = rows as any[];
  return arr.length ? normalizeAdjustmentRow(arr[0]) : null;
}

export async function updatePayrollAdjustmentStatus(
  tenantSlug: string,
  id: string,
  status: 'applied' | 'rejected',
  approvedBy?: string | null
) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`
    update admin_payroll_adjustments
    set status = ${status},
        approved_by = ${approvedBy ?? null},
        applied_at = ${status === 'applied' ? new Date().toISOString() : null}
    where id = ${id} and tenant_slug = ${tenantSlug}
  `;
}

export async function deletePayrollAdjustment(tenantSlug: string, id: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`
    delete from admin_payroll_adjustments
    where id = ${id} and tenant_slug = ${tenantSlug} and status = 'pending'
  `;
}

export async function applyPendingAdjustmentsToPayroll(
  tenantSlug: string,
  period: string,
  approvedBy?: string | null
) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`
    update admin_payroll_adjustments
    set status = 'applied',
        approved_by = ${approvedBy ?? null},
        applied_at = now()
    where tenant_slug = ${tenantSlug}
      and effective_period = ${period}
      and status = 'pending'
  `;
}

// ============================================================================
// STAFF REPORTS
// ============================================================================

function normalizeStaffReportRow(row: any) {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    employeeId: row.employee_id,
    title: row.title ?? '',
    reportType: row.report_type,
    reportDate: row.report_date,
    rawTranscript: row.raw_transcript ?? '',
    refinedText: row.refined_text ?? '',
    objectives: row.objectives ?? '',
    achievements: row.achievements ?? '',
    challenges: row.challenges ?? '',
    nextSteps: row.next_steps ?? '',
    additionalNotes: row.additional_notes ?? '',
    meetings: row.meetings ?? '',
    blockers: row.blockers ?? '',
    activities: row.activities ?? '',
    headOfDepartment: row.head_of_department,
    teamMembers: row.team_members ?? [],
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    status: row.status,
    templateId: row.template_id ?? null,
    templateSnapshot: row.template_snapshot ?? null,
    departmentId: row.department_id ?? null,
    hodComment: row.hod_comment ?? null,
    hodActionAt: row.hod_action_at ?? null,
    rejectedAt: row.rejected_at ?? null,
    version: row.version ?? 1,
    resubmissionOfId: row.resubmission_of_id ?? null,
    appraisal: row.appraisal ? (typeof row.appraisal === 'string' ? JSON.parse(row.appraisal) : row.appraisal) : null,
  };
}

export async function insertStaffReport(row: {
  tenantSlug: string;
  employeeId: string;
  title?: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  reportDate: string;
  rawTranscript?: string;
  refinedText?: string;
  objectives?: string;
  achievements?: string;
  challenges?: string;
  nextSteps?: string;
  additionalNotes?: string;
  meetings?: string;
  blockers?: string;
  activities?: string;
  headOfDepartment: string;
  teamMembers?: string[];
  status?: string;
  appraisal?: any;
  templateId?: string | null;
  templateSnapshot?: any;
  departmentId?: string | null;
  resubmissionOfId?: string | null;
  version?: number;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  const appraisalJson = row.appraisal ? JSON.stringify(row.appraisal) : null;
  const templateSnapshotJson = row.templateSnapshot ? JSON.stringify(row.templateSnapshot) : null;
  await sql`
    insert into admin_staff_reports (
      id, tenant_slug, employee_id, title, report_type, report_date,
      raw_transcript, refined_text,
      objectives, achievements, challenges, next_steps, additional_notes,
      meetings, blockers, activities,
      head_of_department, team_members, status, appraisal,
      template_id, template_snapshot, department_id, resubmission_of_id, version
    ) values (
      ${id}, ${row.tenantSlug}, ${row.employeeId}, ${row.title ?? null}, ${row.reportType}, ${row.reportDate},
      ${row.rawTranscript ?? null}, ${row.refinedText ?? null},
      ${row.objectives ?? null}, ${row.achievements ?? null}, ${row.challenges ?? null}, ${row.nextSteps ?? null}, ${row.additionalNotes ?? null},
      ${row.meetings ?? null}, ${row.blockers ?? null}, ${row.activities ?? null},
      ${row.headOfDepartment}, ${serializeTextArray(row.teamMembers)}::text[], ${row.status ?? 'pending'},
      ${appraisalJson},
      ${row.templateId ?? null}, ${templateSnapshotJson}, ${row.departmentId ?? null}, ${row.resubmissionOfId ?? null}, ${row.version ?? 1}
    )
  `;
  const rows = await sql`select * from admin_staff_reports where id = ${id} limit 1`;
  return normalizeStaffReportRow((rows as any[])[0]);
}

export async function listStaffReports(
  tenantSlug: string,
  filters?: { employeeId?: string; status?: string; approverRole?: string }
) {
  const sql = SQL;
  await ensureHrTables(sql);

  let query = `select * from admin_staff_reports where tenant_slug = $1`;
  const params: any[] = [tenantSlug];

  if (filters?.employeeId) {
    params.push(filters.employeeId);
    query += ` and employee_id = $${params.length}`;
  }
  if (filters?.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }
  if (filters?.approverRole) {
    params.push(filters.approverRole);
    query += ` and approver_role = $${params.length}`;
  }

  query += ` order by submitted_at desc`;

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeStaffReportRow);
}

export async function updateStaffReportStatus(
  tenantSlug: string,
  id: string,
  status: 'pending' | 'under_review' | 'approved' | 'needs_edit' | 'rejected',
  opts?: { hodComment?: string; hodActionAt?: string; rejectedAt?: string | null }
) {
  const sql = SQL;
  await ensureHrTables(sql);
  const shouldTimestamp = ['approved', 'rejected', 'needs_edit'].includes(status);
  const hodActionAt = opts?.hodActionAt ?? (shouldTimestamp ? new Date().toISOString() : null);
  const rejectedAt = opts?.rejectedAt ?? (status === 'rejected' ? new Date().toISOString() : null);
  await sql`
    update admin_staff_reports
    set
      status = ${status},
      hod_comment = ${opts?.hodComment ?? null},
      hod_action_at = ${hodActionAt},
      rejected_at = ${rejectedAt},
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
  `;
}

export async function deleteStaffReport(tenantSlug: string, id: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`
    delete from admin_staff_reports
    where id = ${id} and tenant_slug = ${tenantSlug}
  `;
}

function normalizeTemplateRow(row: any) {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    reportType: row.report_type,
    name: row.name,
    isDefault: row.is_default ?? false,
    sections: Array.isArray(row.sections) ? row.sections : (typeof row.sections === 'string' ? JSON.parse(row.sections) : []),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertStaffReportTemplate(row: {
  tenantSlug: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  name: string;
  isDefault?: boolean;
  sections?: any[];
  createdBy?: string;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  const sectionsJson = row.sections ? JSON.stringify(row.sections) : '[]';
  await sql`
    insert into admin_staff_report_templates (
      id, tenant_slug, report_type, name, is_default, sections, created_by
    ) values (
      ${id}, ${row.tenantSlug}, ${row.reportType}, ${row.name}, ${row.isDefault ?? false}, ${sectionsJson}::jsonb, ${row.createdBy ?? null}
    )
  `;
  if (row.isDefault) {
    await sql`
      update admin_staff_report_templates
      set is_default = false
      where tenant_slug = ${row.tenantSlug} and report_type = ${row.reportType} and id <> ${id}
    `;
  }
  const rows = await sql`select * from admin_staff_report_templates where id = ${id} limit 1`;
  return normalizeTemplateRow((rows as any[])[0]);
}

export async function listStaffReportTemplates(
  tenantSlug: string,
  filters?: { reportType?: string }
) {
  const sql = SQL;
  await ensureHrTables(sql);
  let query = `select * from admin_staff_report_templates where tenant_slug = $1`;
  const params: any[] = [tenantSlug];
  if (filters?.reportType) {
    params.push(filters.reportType);
    query += ` and report_type = $${params.length}`;
  }
  query += ` order by report_type, is_default desc, name`;
  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeTemplateRow);
}

export async function getStaffReportTemplateById(tenantSlug: string, id: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`select * from admin_staff_report_templates where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeTemplateRow(arr[0]) : null;
}

export async function getDefaultStaffReportTemplate(
  tenantSlug: string,
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly'
) {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`select * from admin_staff_report_templates where tenant_slug = ${tenantSlug} and report_type = ${reportType} and is_default = true limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeTemplateRow(arr[0]) : null;
}

export async function updateStaffReportTemplate(
  tenantSlug: string,
  id: string,
  updates: {
    reportType?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    name?: string;
    isDefault?: boolean;
    sections?: any[];
  }
) {
  const sql = SQL;
  await ensureHrTables(sql);
  const sectionsJson = updates.sections ? JSON.stringify(updates.sections) : undefined;
  await sql`
    update admin_staff_report_templates
    set
      report_type = coalesce(${updates.reportType ?? null}, report_type),
      name = coalesce(${updates.name ?? null}, name),
      is_default = coalesce(${updates.isDefault ?? null}, is_default),
      sections = coalesce(${sectionsJson ?? null}::jsonb, sections),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
  `;
  if (updates.isDefault && updates.reportType) {
    await sql`
      update admin_staff_report_templates
      set is_default = false
      where tenant_slug = ${tenantSlug} and report_type = ${updates.reportType} and id <> ${id}
    `;
  }
  const rows = await sql`select * from admin_staff_report_templates where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  return rows.length ? normalizeTemplateRow((rows as any[])[0]) : null;
}

export async function deleteStaffReportTemplate(tenantSlug: string, id: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`delete from admin_staff_report_templates where id = ${id} and tenant_slug = ${tenantSlug}`;
}

// ============================================================================
// STAFF TASKS
// ============================================================================

function normalizeStaffTaskRow(row: any) {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description ?? '',
    expectedOutcome: row.expected_outcome ?? '',
    weight: row.weight ?? 1,
    isKpi: row.is_kpi ?? false,
    frequency: row.frequency,
    dueDate: row.due_date,
    status: row.status,
    assignedBy: row.assigned_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertStaffTask(row: {
  tenantSlug: string;
  employeeId: string;
  title: string;
  description?: string;
  expectedOutcome?: string;
  weight?: number;
  isKpi?: boolean;
  frequency: 'daily' | 'weekly' | 'one-time';
  dueDate: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
  assignedBy: string;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_staff_tasks (
      id, tenant_slug, employee_id, title, description, expected_outcome, weight, is_kpi, frequency, due_date, status, assigned_by
    ) values (
      ${id}, ${row.tenantSlug}, ${row.employeeId}, ${row.title}, ${row.description ?? null}, ${row.expectedOutcome ?? null}, ${row.weight ?? 1}, ${row.isKpi ?? false}, ${row.frequency}, ${row.dueDate}, ${row.status ?? 'pending'}, ${row.assignedBy}
    )
  `;
  const rows = await sql`select * from admin_staff_tasks where id = ${id} limit 1`;
  return normalizeStaffTaskRow((rows as any[])[0]);
}

export async function listStaffTasks(
  tenantSlug: string,
  filters?: { employeeId?: string; status?: string; dueDate?: string; dueBefore?: string }
) {
  const sql = SQL;
  await ensureHrTables(sql);

  let query = `select * from admin_staff_tasks where tenant_slug = $1`;
  const params: any[] = [tenantSlug];

  if (filters?.employeeId) {
    params.push(filters.employeeId);
    query += ` and employee_id = $${params.length}`;
  }
  if (filters?.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }
  if (filters?.dueDate) {
    params.push(filters.dueDate);
    query += ` and due_date = $${params.length}`;
  }
  if (filters?.dueBefore) {
    params.push(filters.dueBefore);
    query += ` and due_date <= $${params.length}`;
  }

  query += ` order by due_date desc, created_at desc`;

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeStaffTaskRow);
}

export async function updateStaffTask(
  tenantSlug: string,
  id: string,
  updates: {
    title?: string;
    description?: string;
    expectedOutcome?: string;
    weight?: number;
    isKpi?: boolean;
    frequency?: 'daily' | 'weekly' | 'one-time';
    dueDate?: string;
    status?: 'pending' | 'in_progress' | 'completed' | 'overdue';
  }
) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`
    update admin_staff_tasks
    set
      title = coalesce(${updates.title ?? null}, title),
      description = coalesce(${updates.description ?? null}, description),
      expected_outcome = coalesce(${updates.expectedOutcome ?? null}, expected_outcome),
      weight = coalesce(${updates.weight ?? null}, weight),
      is_kpi = coalesce(${updates.isKpi ?? null}, is_kpi),
      frequency = coalesce(${updates.frequency ?? null}, frequency),
      due_date = coalesce(${updates.dueDate ?? null}, due_date),
      status = coalesce(${updates.status ?? null}, status),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
  `;
  const rows = await sql`select * from admin_staff_tasks where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  return normalizeStaffTaskRow((rows as any[])[0]);
}

export async function deleteStaffTask(tenantSlug: string, id: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`
    delete from admin_staff_tasks
    where id = ${id} and tenant_slug = ${tenantSlug}
  `;
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

export async function insertNotification(params: {
  tenantSlug: string;
  employeeId: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  category?: 'hr' | 'finance' | 'crm' | 'projects' | 'system' | 'general';
  title: string;
  message: string;
  actionUrl?: string | null;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_notifications (id, tenant_slug, employee_id, type, category, title, message, action_url)
    values (${id}, ${params.tenantSlug}, ${params.employeeId}, ${params.type || 'info'}, ${params.category || 'hr'}, ${params.title}, ${params.message}, ${params.actionUrl || null})
  `;
  return id;
}

export async function listNotifications(
  tenantSlug: string,
  employeeId: string,
  opts?: { unreadOnly?: boolean; limit?: number }
) {
  const sql = SQL;
  await ensureHrTables(sql);
  const limit = opts?.limit ?? 50;
  if (opts?.unreadOnly) {
    return await sql`
      select * from admin_notifications
      where tenant_slug = ${tenantSlug} and employee_id = ${employeeId} and is_read = false
      order by created_at desc limit ${limit}
    `;
  }
  return await sql`
    select * from admin_notifications
    where tenant_slug = ${tenantSlug} and employee_id = ${employeeId}
    order by created_at desc limit ${limit}
  `;
}

export async function markNotificationRead(tenantSlug: string, notificationId: string, employeeId: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`
    update admin_notifications set is_read = true, read_at = now()
    where id = ${notificationId} and tenant_slug = ${tenantSlug} and employee_id = ${employeeId}
  `;
}

export async function markAllNotificationsRead(tenantSlug: string, employeeId: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`
    update admin_notifications set is_read = true, read_at = now()
    where tenant_slug = ${tenantSlug} and employee_id = ${employeeId} and is_read = false
  `;
}

export async function getUnreadNotificationCount(tenantSlug: string, employeeId: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select count(*)::int as cnt from admin_notifications
    where tenant_slug = ${tenantSlug} and employee_id = ${employeeId} and is_read = false
  `;
  return (rows as any[])[0]?.cnt ?? 0;
}

// ============================================================================
// ANNOUNCEMENTS
// ============================================================================

export async function insertAnnouncement(params: {
  tenantSlug: string;
  title: string;
  message: string;
  audience?: 'all' | 'department' | 'role';
  targetId?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  createdBy?: string | null;
  createdByName?: string | null;
  expiresAt?: string | null;
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_announcements (id, tenant_slug, title, message, audience, target_id, priority, created_by, created_by_name, expires_at)
    values (${id}, ${params.tenantSlug}, ${params.title}, ${params.message}, ${params.audience || 'all'}, ${params.targetId || null}, ${params.priority || 'medium'}, ${params.createdBy || null}, ${params.createdByName || null}, ${params.expiresAt || null})
  `;
  return id;
}

export async function listAnnouncements(
  tenantSlug: string,
  opts?: { activeOnly?: boolean; limit?: number }
) {
  const sql = SQL;
  await ensureHrTables(sql);
  const limit = opts?.limit ?? 20;
  if (opts?.activeOnly) {
    return await sql`
      select * from admin_announcements
      where tenant_slug = ${tenantSlug} and is_active = true
      and (expires_at is null or expires_at > now())
      order by created_at desc limit ${limit}
    `;
  }
  return await sql`
    select * from admin_announcements
    where tenant_slug = ${tenantSlug}
    order by created_at desc limit ${limit}
  `;
}

export async function deleteAnnouncement(tenantSlug: string, id: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  await sql`delete from admin_announcements where id = ${id} and tenant_slug = ${tenantSlug}`;
}
