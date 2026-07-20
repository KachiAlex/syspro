/**
 * HR Core Database Operations (employees, departments, attendance, leave)
 */

import { randomUUID } from "crypto";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import type {
  EmployeeRecord,
  DepartmentRecord,
  AttendanceRecord,
  LeaveRecord,
} from "./types";

function serializeTextArray(values?: string[] | null): string {
  if (!values || values.length === 0) return "{}";
  const escaped = values.map((v) => {
    const safe = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${safe}"`;
  });
  return `{${escaped.join(",")}}`;
}

// ============================================================================
// TABLE CREATION
// ============================================================================

export async function ensureHrTables(sql: SqlClient = SQL) {
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

  await sql`
    create table if not exists admin_attendance (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      employee_name text not null,
      date date not null,
      status text not null check (status in ('present','absent','late','half_day')),
      check_in text,
      check_out text,
      notes text,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_attendance_tenant on admin_attendance(tenant_slug)`;
  await sql`create index if not exists idx_admin_attendance_emp_date on admin_attendance(employee_id, date)`;

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

  // Staff reports
  await sql`
    create table if not exists admin_staff_reports (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      title text,
      report_type text not null check (report_type in ('daily','weekly','monthly','quarterly')),
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

    await sql`alter table if exists admin_staff_reports add column if not exists template_id text`;
    await sql`alter table if exists admin_staff_reports add column if not exists template_snapshot jsonb default null`;
    await sql`alter table if exists admin_staff_reports add column if not exists department_id text`;
    await sql`alter table if exists admin_staff_reports add column if not exists hod_comment text`;
    await sql`alter table if exists admin_staff_reports add column if not exists hod_action_at timestamptz`;
    await sql`alter table if exists admin_staff_reports add column if not exists version integer default 1`;
    await sql`alter table if exists admin_staff_reports add column if not exists resubmission_of_id text`;
    await sql`alter table if exists admin_staff_reports add column if not exists rejected_at timestamptz`;

    await sql`
      create table if not exists admin_staff_report_templates (
        id text primary key,
        tenant_slug text not null,
        report_type text not null check (report_type in ('daily','weekly','monthly','quarterly')),
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

    await sql`alter table if exists admin_staff_tasks add column if not exists expected_outcome text`;
    await sql`alter table if exists admin_staff_tasks add column if not exists weight integer default 1`;
    await sql`alter table if exists admin_staff_tasks add column if not exists is_kpi boolean default false`;

  // Staff tasks assigned by HODs
  await sql`
    create table if not exists admin_staff_tasks (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      title text not null,
      description text,
      frequency text not null check (frequency in ('daily','weekly','one-time')),
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
    role: row.role ?? null,
    status: row.status ?? "active",
    passwordHash: row.password_hash ?? null,
    isPortalActive: row.is_portal_active ?? false,
    lastLogin: row.last_login ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

  // Enforce unique HOD per department
  if ((row.role ?? "staff") === "hod") {
    const dupRows = await sql`
      select id from admin_employees
      where tenant_slug = ${row.tenantSlug}
        and department_id = ${row.departmentId}
        and role = 'hod'
      limit 1
    `;
    if ((dupRows as any[]).length > 0) {
      throw new Error("Someone has already been assigned the HOD role in this department.");
    }
  }

  const id = randomUUID();
  await sql`
    insert into admin_employees (
      id, tenant_slug, name, email, phone, department_id, job_title,
      reporting_manager_id, branch_id, region_id, cost_center, hire_date,
      salary, employment_type, role, status, created_by
    ) values (
      ${id}, ${row.tenantSlug}, ${row.name}, ${row.email}, ${row.phone ?? null},
      ${row.departmentId}, ${row.jobTitle}, ${row.reportingManagerId ?? null},
      ${row.branchId ?? null}, ${row.regionId ?? null}, ${row.costCenter ?? null},
      ${row.hireDate ?? null}, ${row.salary ?? null}, ${row.employmentType ?? "full-time"},
      ${row.role ?? "staff"}, ${row.status ?? "active"}, ${row.createdBy ?? null}
    )
  `;
  const inserted = await sql`select * from admin_employees where id = ${id} limit 1`;
  return normalizeEmployeeRow((inserted as any[])[0]);
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
    role: string | null;
    status: string;
  }>
) {
  const sql = SQL;
  await ensureHrTables(sql);

  // Enforce unique HOD per department
  if (updates.role === "hod") {
    const currentRows = await sql`select tenant_slug, department_id from admin_employees where id = ${id} limit 1`;
    const current = (currentRows as any[])[0];
    if (current) {
      const deptId = updates.departmentId ?? current.department_id;
      const tenantSlug = current.tenant_slug;
      const dupRows = await sql`
        select id from admin_employees
        where tenant_slug = ${tenantSlug}
          and department_id = ${deptId}
          and role = 'hod'
          and id != ${id}
        limit 1
      `;
      if ((dupRows as any[]).length > 0) {
        throw new Error("Someone has already been assigned the HOD role in this department.");
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
      role = coalesce(${updates.role ?? null}, role),
      status = coalesce(${updates.status ?? null}, status),
      updated_at = now()
    where id = ${id}
    returning *
  `;
  const rows = updated as any[];
  return rows.length ? normalizeEmployeeRow(rows[0]) : null;
}

export async function deleteEmployee(id: string, tenantSlug: string) {
  const sql = SQL;
  await sql`delete from admin_employees where id = ${id} and tenant_slug = ${tenantSlug}`;
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

export async function ensureDepartmentHeadRole(tenantSlug: string) {
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
  } catch {
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
  } catch {
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
    createdAt: row.created_at,
  };
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
}) {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_attendance (id, tenant_slug, employee_id, employee_name, date, status, check_in, check_out, notes)
    values (${id}, ${row.tenantSlug}, ${row.employeeId}, ${row.employeeName}, ${row.date}, ${row.status}, ${row.checkIn ?? null}, ${row.checkOut ?? null}, ${row.notes ?? null})
  `;
  const inserted = await sql`select * from admin_attendance where id = ${id} limit 1`;
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

  let query = `select * from admin_attendance where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.date) {
    params.push(filters.date);
    query += ` and date = $${params.length}`;
  }
  if (filters.employeeId) {
    params.push(filters.employeeId);
    query += ` and employee_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }

  query += ` order by date desc, created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeAttendanceRow);
}

export async function getAttendanceStats(tenantSlug: string, date: string) {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select status, count(*)::int as cnt from admin_attendance
    where tenant_slug = ${tenantSlug} and date = ${date}
    group by status
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
  const inserted = await sql`select * from admin_leave where id = ${id} limit 1`;
  return normalizeLeaveRow((inserted as any[])[0]);
}

export async function updateLeaveStatus(
  id: string,
  tenantSlug: string,
  status: string,
  approvedBy?: string | null
) {
  const sql = SQL;
  await ensureHrTables(sql);
  const updated = await sql`
    update admin_leave set
      status = ${status},
      approved_by = coalesce(${approvedBy ?? null}, approved_by),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `;
  const rows = updated as any[];
  return rows.length ? normalizeLeaveRow(rows[0]) : null;
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

export async function getLeaveBalance(tenantSlug: string, employeeId: string) {
  const sql = SQL;
  await ensureHrTables(sql);

  const rows = await sql`
    select leave_type, sum(end_date - start_date + 1)::int as days
    from admin_leave
    where tenant_slug = ${tenantSlug} and employee_id = ${employeeId} and status = 'approved'
    group by leave_type
  `;

  const used: Record<string, number> = {};
  (rows as any[]).forEach((r) => { used[r.leave_type] = r.days ?? 0; });

  return {
    annual: { used: used["annual"] ?? 0, total: 20 },
    sick: { used: used["sick"] ?? 0, total: 10 },
    personal: { used: used["personal"] ?? 0, total: 5 },
    maternity: { used: used["maternity"] ?? 0, total: 90 },
    paternity: { used: used["paternity"] ?? 0, total: 14 },
    unpaid: { used: used["unpaid"] ?? 0, total: 0 },
  };
}

// ============================================================================
// PAYROLL
// ============================================================================

export interface PayrollConfig {
  taxRate: number;
  pensionRate: number;
  healthInsuranceRate: number;
  transportAllowance: number;
  housingAllowance: number;
  mealAllowance: number;
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

    // Tax sanity check: tax should be roughly config.taxRate % of gross
    const expectedTax = (entry.grossPay * (config.taxRate || 7.5)) / 100;
    const taxDiff = Math.abs(entry.tax - expectedTax);
    if (taxDiff > 1) {
      issues.push(
        `${entry.employeeName}: Tax (${entry.tax}) deviates from expected ${expectedTax.toFixed(2)} based on ${config.taxRate}% rate`
      );
    }

    // Pension check
    const expectedPension = (entry.grossPay * (config.pensionRate || 8)) / 100;
    const pensionDiff = Math.abs(entry.pension - expectedPension);
    if (pensionDiff > 1) {
      issues.push(
        `${entry.employeeName}: Pension (${entry.pension}) deviates from expected ${expectedPension.toFixed(2)} based on ${config.pensionRate}% rate`
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
}) {
  const sql = SQL;
  await ensureHrTables(sql);

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
  const totalGross = params.entries.reduce((s, e) => s + e.grossPay, 0);
  const totalDeductions = params.entries.reduce((s, e) => s + e.totalDeductions, 0);
  const totalNet = params.entries.reduce((s, e) => s + e.netPay, 0);

  const anomalies = detectAnomalies(
    params.entries.map((e) => ({ ...e, id: "", tenantSlug: params.tenantSlug, runId, createdAt: "" })),
    prevEntries
  );
  const compliance = checkCompliance(
    params.entries.map((e) => ({ ...e, id: "", tenantSlug: params.tenantSlug, runId, createdAt: "" })),
    params.config
  );

  await sql`
    insert into admin_payroll_runs (
      id, tenant_slug, period, status, total_gross, total_deductions, total_net,
      config, anomalies, compliance_passed, processed_by
    ) values (
      ${runId}, ${params.tenantSlug}, ${params.period}, 'completed',
      ${totalGross}, ${totalDeductions}, ${totalNet},
      ${JSON.stringify(params.config)}::jsonb, ${JSON.stringify(anomalies)}::jsonb,
      ${compliance.passed}, ${params.processedBy ?? null}
    )
  `;

  for (const entry of params.entries) {
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
      ${row.headOfDepartment}, ${serializeTextArray(row.teamMembers)}, ${row.status ?? 'pending'},
      ${appraisalJson},
      ${row.templateId ?? null}, ${templateSnapshotJson}, ${row.departmentId ?? null}, ${row.resubmissionOfId ?? null}, ${row.version ?? 1}
    )
  `;
  const rows = await sql`select * from admin_staff_reports where id = ${id} limit 1`;
  return normalizeStaffReportRow((rows as any[])[0]);
}

export async function listStaffReports(
  tenantSlug: string,
  filters?: { employeeId?: string; status?: string }
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
