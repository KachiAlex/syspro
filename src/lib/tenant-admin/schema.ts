/**
 * Tenant Admin Database Schema & Migrations
 * SQL setup for all tenant-admin tables
 */

import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

export async function setupTenantAdminSchema(sql: SqlClient = SQL) {
  // ============================================================================
  // DEPARTMENTS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_departments (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      description text,
      parent_department_id text,
      budget numeric(15, 2),
      cost_center text,
      manager_id text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text,
      updated_by text,
      constraint fk_parent_dept foreign key (parent_department_id) references admin_departments(id) on delete set null
    );
    create index if not exists idx_admin_departments_tenant on admin_departments(tenant_slug);
    create index if not exists idx_admin_departments_parent on admin_departments(parent_department_id);
  `;

  // ============================================================================
  // ROLES TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_roles (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      scope text not null check (scope in ('tenant', 'region', 'branch', 'custom')),
      permissions text[] default array[]::text[],
      description text,
      is_system boolean default false,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text,
      updated_by text
    );
    create index if not exists idx_admin_roles_tenant on admin_roles(tenant_slug);
    create index if not exists idx_admin_roles_name on admin_roles(name);
  `;

  // ============================================================================
  // USER ROLES (Role Assignments) TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_user_roles (
      id text primary key,
      tenant_slug text not null,
      user_id text not null,
      role_id text not null,
      scope text default 'tenant',
      scope_id text,
      expires_at timestamptz,
      justification text,
      approved_by text,
      created_at timestamptz default now(),
      created_by text,
      constraint fk_role foreign key (role_id) references admin_roles(id) on delete cascade,
      constraint uq_user_role unique (user_id, role_id)
    );
    create index if not exists idx_admin_user_roles_tenant on admin_user_roles(tenant_slug);
    create index if not exists idx_admin_user_roles_user on admin_user_roles(user_id);
  `;

  // ============================================================================
  // EMPLOYEES TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_employees (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      email text not null,
      phone text,
      department_id text not null,
      reporting_manager_id text,
      branch_id text,
      region_id text,
      status text default 'active' check (status in ('active', 'inactive', 'on-leave', 'terminated')),
      cost_center text,
      job_title text,
      hire_date timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text,
      updated_by text,
      constraint fk_department foreign key (department_id) references admin_departments(id),
      constraint unique_email unique (tenant_slug, email)
    );
    create index if not exists idx_admin_employees_tenant on admin_employees(tenant_slug);
    create index if not exists idx_admin_employees_dept on admin_employees(department_id);
    create index if not exists idx_admin_employees_manager on admin_employees(reporting_manager_id);
  `;

  // ============================================================================
  // ACCESS CONTROLS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_access_controls (
      id text primary key,
      tenant_slug text not null,
      role_id text not null,
      role_name text not null,
      module_access jsonb not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text,
      updated_by text,
      constraint fk_ac_role foreign key (role_id) references admin_roles(id) on delete cascade
    );
    create index if not exists idx_admin_access_controls_tenant on admin_access_controls(tenant_slug);
    create index if not exists idx_admin_access_controls_role on admin_access_controls(role_id);
  `;

  // ============================================================================
  // TEMPORARY ACCESS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_temporary_access (
      id text primary key,
      tenant_slug text not null,
      granted_to text not null,
      module_key text not null,
      permissions text[] not null,
      expires_at timestamptz not null,
      justification text not null,
      approved_by text not null,
      created_at timestamptz default now(),
      created_by text
    );
    create index if not exists idx_admin_temp_access_tenant on admin_temporary_access(tenant_slug);
    create index if not exists idx_admin_temp_access_user on admin_temporary_access(granted_to);
    create index if not exists idx_admin_temp_access_expires on admin_temporary_access(expires_at);
  `;

  // ============================================================================
  // APPROVAL FLOWS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_approval_flows (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      type text not null,
      steps jsonb not null,
      description text,
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text,
      updated_by text
    );
    create index if not exists idx_admin_approval_flows_tenant on admin_approval_flows(tenant_slug);
    create index if not exists idx_admin_approval_flows_type on admin_approval_flows(type);
  `;

  // ============================================================================
  // APPROVAL REQUESTS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_approval_requests (
      id text primary key,
      tenant_slug text not null,
      flow_id text not null,
      flow_type text not null,
      requester_id text not null,
      subject_id text not null,
      status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
      current_step_index integer default 0,
      history jsonb default '[]'::jsonb,
      documents jsonb default '[]'::jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      constraint fk_approval_flow foreign key (flow_id) references admin_approval_flows(id) on delete cascade
    );
    create index if not exists idx_admin_approval_requests_tenant on admin_approval_requests(tenant_slug);
    create index if not exists idx_admin_approval_requests_status on admin_approval_requests(status);
    create index if not exists idx_admin_approval_requests_requester on admin_approval_requests(requester_id);
  `;

  // ============================================================================
  // WORKFLOWS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_workflows (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      type text not null,
      trigger text not null check (trigger in ('manual', 'event', 'schedule', 'condition')),
      steps jsonb not null,
      status text default 'draft' check (status in ('draft', 'active', 'archived')),
      description text,
      is_active boolean default false,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text,
      updated_by text
    );
    create index if not exists idx_admin_workflows_tenant on admin_workflows(tenant_slug);
    create index if not exists idx_admin_workflows_active on admin_workflows(is_active);
  `;

  // ============================================================================
  // WORKFLOW EXECUTIONS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_workflow_executions (
      id text primary key,
      tenant_slug text not null,
      workflow_id text not null,
      triggered_by text not null,
      current_step_id text,
      status text default 'running' check (status in ('running', 'completed', 'failed')),
      execution_history jsonb default '[]'::jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      constraint fk_workflow foreign key (workflow_id) references admin_workflows(id) on delete cascade
    );
    create index if not exists idx_admin_workflow_executions_tenant on admin_workflow_executions(tenant_slug);
    create index if not exists idx_admin_workflow_executions_status on admin_workflow_executions(status);
  `;

  // ============================================================================
  // MODULES TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_modules (
      id text primary key,
      tenant_slug text not null,
      key text not null,
      name text not null,
      description text,
      enabled boolean default false,
      regions text[] default array[]::text[],
      branches text[] default array[]::text[],
      feature_flags jsonb default '{}'::jsonb,
      required_modules text[] default array[]::text[],
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text,
      updated_by text,
      constraint unique_module unique (tenant_slug, key)
    );
    create index if not exists idx_admin_modules_tenant on admin_modules(tenant_slug);
    create index if not exists idx_admin_modules_enabled on admin_modules(enabled);
  `;

  // ============================================================================
  // INTEGRATIONS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_integrations (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      type text not null check (type in ('webhook', 'oauth', 'api_key', 'custom')),
      status text default 'inactive' check (status in ('active', 'inactive', 'error', 'pending')),
      provider text,
      config jsonb not null,
      webhook_url text,
      events text[] default array[]::text[],
      last_sync_at timestamptz,
      error_message text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text,
      updated_by text
    );
    create index if not exists idx_admin_integrations_tenant on admin_integrations(tenant_slug);
    create index if not exists idx_admin_integrations_status on admin_integrations(status);
  `;

  // ============================================================================
  // API KEYS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_api_keys (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      key text not null unique,
      secret text not null,
      permissions jsonb not null,
      rate_limit integer,
      expires_at timestamptz,
      last_used_at timestamptz,
      created_at timestamptz default now(),
      created_by text,
      constraint unique_key_per_tenant unique (tenant_slug, key)
    );
    create index if not exists idx_admin_api_keys_tenant on admin_api_keys(tenant_slug);
    create index if not exists idx_admin_api_keys_key on admin_api_keys(key);
  `;

  // ============================================================================
  // SECURITY POLICIES TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_security_policies (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      description text,
      rules jsonb not null,
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      created_by text,
      updated_by text
    );
    create index if not exists idx_admin_security_policies_tenant on admin_security_policies(tenant_slug);
  `;

  // ============================================================================
  // AUDIT LOGS TABLE
  // ============================================================================
  await sql`
    create table if not exists admin_audit_logs (
      id text primary key,
      tenant_slug text not null,
      user_id text not null,
      action text not null check (action in ('create', 'read', 'update', 'delete', 'export', 'permission_change')),
      resource text not null,
      resource_id text not null,
      changes jsonb,
      ip_address text,
      user_agent text,
      created_at timestamptz default now()
    );
    create index if not exists idx_admin_audit_logs_tenant on admin_audit_logs(tenant_slug);
    create index if not exists idx_admin_audit_logs_user on admin_audit_logs(user_id);
    create index if not exists idx_admin_audit_logs_resource on admin_audit_logs(resource, resource_id);
    create index if not exists idx_admin_audit_logs_created on admin_audit_logs(created_at desc);
  `;

  console.log("✓ Tenant Admin schema initialized successfully");
}

/**
 * Run migrations on application startup
 */
export async function initializeTenantAdmin() {
  try {
    await setupTenantAdminSchema();
  } catch (error) {
    console.error("Failed to initialize tenant admin schema:", error);
    throw error;
  }
}
