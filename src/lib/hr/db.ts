/**
 * HR Core Database Operations (employees, departments, attendance, leave)
 */

import { randomUUID } from "node:crypto";
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
