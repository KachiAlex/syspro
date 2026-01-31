import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";

const SQL = getSql();

type SqlClient = ReturnType<typeof getSql>;

export async function ensureAdminTables(sql: SqlClient = SQL) {
  // Departments table
  await sql`
    create table if not exists admin_departments (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      description text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  // Roles table
  await sql`
    create table if not exists admin_roles (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      scope text not null,
      permissions text[] default array[]::text[],
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  // Employees table
  await sql`
    create table if not exists admin_employees (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      email text not null,
      department_id text,
      branch_id text,
      region_id text,
      status text default 'active',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  // Approval routes table
  await sql`
    create table if not exists admin_approval_routes (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      steps jsonb not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  // Access control table
  await sql`
    create table if not exists admin_access_controls (
      id text primary key,
      tenant_slug text not null,
      role_id text not null,
      role_name text not null,
      module_access jsonb not null,
      temp_grants jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  // Workflows table
  await sql`
    create table if not exists admin_workflows (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      type text not null,
      steps jsonb not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  // Modules table
  await sql`
    create table if not exists admin_modules (
      id text primary key,
      tenant_slug text not null,
      key text not null,
      name text not null,
      enabled boolean default false,
      regions text[] default array[]::text[],
      flags jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
}

// Departments
export async function insertDepartment(row: { tenantSlug: string; name: string; description?: string }, sql: SqlClient = SQL) {
  const id = randomUUID();
  await sql`
    insert into admin_departments (id, tenant_slug, name, description)
    values (${id}, ${row.tenantSlug}, ${row.name}, ${row.description || null})
  `;
  return id;
}

export async function getDepartments(tenantSlug: string, sql: SqlClient = SQL) {
  return sql`select * from admin_departments where tenant_slug = ${tenantSlug} order by created_at desc`;
}

export async function deleteDepartment(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await sql`delete from admin_departments where id = ${id} and tenant_slug = ${tenantSlug}`;
}

// Roles
export async function insertRole(row: { tenantSlug: string; name: string; scope: string; permissions: string[] }, sql: SqlClient = SQL) {
  const id = randomUUID();
  await sql`
    insert into admin_roles (id, tenant_slug, name, scope, permissions)
    values (${id}, ${row.tenantSlug}, ${row.name}, ${row.scope}, ${row.permissions})
  `;
  return id;
}

export async function getRoles(tenantSlug: string, sql: SqlClient = SQL) {
  return sql`select * from admin_roles where tenant_slug = ${tenantSlug} order by created_at desc`;
}

export async function updateRole(id: string, tenantSlug: string, updates: { name?: string; scope?: string; permissions?: string[] }, sql: SqlClient = SQL) {
  const parts = [];
  const values = [];
  if (updates.name !== undefined) {
    parts.push(`name = $${parts.length + 1}`);
    values.push(updates.name);
  }
  if (updates.scope !== undefined) {
    parts.push(`scope = $${parts.length + 1}`);
    values.push(updates.scope);
  }
  if (updates.permissions !== undefined) {
    parts.push(`permissions = $${parts.length + 1}`);
    values.push(updates.permissions);
  }
  if (parts.length === 0) return;
  await sql`update admin_roles set ${sql(parts.join(", "))} where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function deleteRole(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await sql`delete from admin_roles where id = ${id} and tenant_slug = ${tenantSlug}`;
}

// Employees
export async function insertEmployee(row: { tenantSlug: string; name: string; email: string; departmentId?: string; branchId?: string; regionId?: string }, sql: SqlClient = SQL) {
  const id = randomUUID();
  await sql`
    insert into admin_employees (id, tenant_slug, name, email, department_id, branch_id, region_id, status)
    values (${id}, ${row.tenantSlug}, ${row.name}, ${row.email}, ${row.departmentId || null}, ${row.branchId || null}, ${row.regionId || null}, 'active')
  `;
  return id;
}

export async function getEmployees(tenantSlug: string, sql: SqlClient = SQL) {
  return sql`select * from admin_employees where tenant_slug = ${tenantSlug} order by created_at desc`;
}

export async function updateEmployee(id: string, tenantSlug: string, updates: { departmentId?: string | null; branchId?: string | null; regionId?: string | null }, sql: SqlClient = SQL) {
  await sql`
    update admin_employees
    set department_id = ${updates.departmentId || null}, branch_id = ${updates.branchId || null}, region_id = ${updates.regionId || null}
    where id = ${id} and tenant_slug = ${tenantSlug}
  `;
}

export async function deleteEmployee(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await sql`delete from admin_employees where id = ${id} and tenant_slug = ${tenantSlug}`;
}

// Approval routes
export async function insertApprovalRoute(row: { tenantSlug: string; name: string; steps: any[] }, sql: SqlClient = SQL) {
  const id = randomUUID();
  await sql`
    insert into admin_approval_routes (id, tenant_slug, name, steps)
    values (${id}, ${row.tenantSlug}, ${row.name}, ${JSON.stringify(row.steps)})
  `;
  return id;
}

export async function getApprovalRoutes(tenantSlug: string, sql: SqlClient = SQL) {
  return sql`select * from admin_approval_routes where tenant_slug = ${tenantSlug} order by created_at desc`;
}

export async function deleteApprovalRoute(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await sql`delete from admin_approval_routes where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function updateApprovalRoute(id: string, tenantSlug: string, updates: { steps?: any[] }, sql: SqlClient = SQL) {
  if (updates.steps) {
    await sql`update admin_approval_routes set steps = ${JSON.stringify(updates.steps)} where id = ${id} and tenant_slug = ${tenantSlug}`;
  }
}

// Access controls
export async function insertAccessControl(row: { tenantSlug: string; roleId: string; roleName: string; moduleAccess: any[] }, sql: SqlClient = SQL) {
  const id = randomUUID();
  await sql`
    insert into admin_access_controls (id, tenant_slug, role_id, role_name, module_access)
    values (${id}, ${row.tenantSlug}, ${row.roleId}, ${row.roleName}, ${JSON.stringify(row.moduleAccess)})
  `;
  return id;
}

export async function getAccessControls(tenantSlug: string, sql: SqlClient = SQL) {
  return sql`select * from admin_access_controls where tenant_slug = ${tenantSlug} order by created_at desc`;
}

export async function updateAccessControl(id: string, tenantSlug: string, updates: { moduleAccess?: any[] }, sql: SqlClient = SQL) {
  if (updates.moduleAccess) {
    await sql`update admin_access_controls set module_access = ${JSON.stringify(updates.moduleAccess)} where id = ${id} and tenant_slug = ${tenantSlug}`;
  }
}

export async function deleteAccessControl(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await sql`delete from admin_access_controls where id = ${id} and tenant_slug = ${tenantSlug}`;
}

// Workflows
export async function insertWorkflow(row: { tenantSlug: string; name: string; type: string; steps: any[] }, sql: SqlClient = SQL) {
  const id = randomUUID();
  await sql`
    insert into admin_workflows (id, tenant_slug, name, type, steps)
    values (${id}, ${row.tenantSlug}, ${row.name}, ${row.type}, ${JSON.stringify(row.steps)})
  `;
  return id;
}

export async function getWorkflows(tenantSlug: string, sql: SqlClient = SQL) {
  return sql`select * from admin_workflows where tenant_slug = ${tenantSlug} order by created_at desc`;
}

export async function updateWorkflow(id: string, tenantSlug: string, updates: { steps?: any[] }, sql: SqlClient = SQL) {
  if (updates.steps) {
    await sql`update admin_workflows set steps = ${JSON.stringify(updates.steps)} where id = ${id} and tenant_slug = ${tenantSlug}`;
  }
}

export async function deleteWorkflow(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await sql`delete from admin_workflows where id = ${id} and tenant_slug = ${tenantSlug}`;
}

// Modules
export async function insertModule(row: { tenantSlug: string; key: string; name: string; enabled: boolean }, sql: SqlClient = SQL) {
  const id = randomUUID();
  await sql`
    insert into admin_modules (id, tenant_slug, key, name, enabled)
    values (${id}, ${row.tenantSlug}, ${row.key}, ${row.name}, ${row.enabled})
  `;
  return id;
}

export async function getModules(tenantSlug: string, sql: SqlClient = SQL) {
  return sql`select * from admin_modules where tenant_slug = ${tenantSlug} order by created_at desc`;
}

export async function updateModule(id: string, tenantSlug: string, updates: { enabled?: boolean; flags?: any }, sql: SqlClient = SQL) {
  const parts = [];
  if (updates.enabled !== undefined) {
    parts.push(`enabled = ${updates.enabled}`);
  }
  if (updates.flags !== undefined) {
    parts.push(`flags = '${JSON.stringify(updates.flags)}'`);
  }
  if (parts.length === 0) return;
  await sql`update admin_modules set ${sql(parts.join(", "))} where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function deleteModule(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await sql`delete from admin_modules where id = ${id} and tenant_slug = ${tenantSlug}`;
}
