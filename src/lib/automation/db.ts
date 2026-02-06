import { getSql } from "@/lib/db";
import { AutomationRule, Action } from "./types";

const SQL = getSql();

type SqlClient = ReturnType<typeof getSql>;

export async function ensureAutomationTables(sql: SqlClient = SQL) {
  await sql`create extension if not exists "pgcrypto"`;
  await sql`
    create table if not exists automation_rules (
      id uuid primary key default gen_random_uuid(),
      tenant_slug text not null,
      name text not null,
      description text,
      event_type text not null,
      condition jsonb not null,
      actions jsonb not null,
      scope jsonb,
      enabled boolean default true,
      simulation_only boolean default false,
      version integer default 1,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`create index if not exists automation_rules_tenant_idx on automation_rules (tenant_slug)`;
  await sql`create index if not exists automation_rules_event_idx on automation_rules (event_type)`;

  await sql`
    create table if not exists automation_rule_audits (
      id uuid primary key default gen_random_uuid(),
      rule_id uuid references automation_rules(id) on delete set null,
      tenant_slug text not null,
      trigger_event jsonb,
      matched boolean,
      result jsonb,
      actor text,
      scope jsonb,
      simulation boolean default false,
      created_at timestamptz default now()
    )
  `;

  await sql`create index if not exists automation_rule_audits_rule_idx on automation_rule_audits (rule_id)`;
  await sql`create index if not exists automation_rule_audits_tenant_idx on automation_rule_audits (tenant_slug)`;

  await sql`
    create table if not exists automation_action_queue (
      id uuid primary key default gen_random_uuid(),
      rule_id uuid references automation_rules(id) on delete set null,
      tenant_slug text not null,
      action_type text not null,
      action_payload jsonb not null,
      status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
      error text,
      scheduled_for timestamptz default now(),
      attempt_count integer not null default 0,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;

  await sql`alter table automation_action_queue add column if not exists attempt_count integer not null default 0`;

  await sql`create index if not exists automation_action_queue_status_idx on automation_action_queue (status)`;
  await sql`create index if not exists automation_action_queue_rule_idx on automation_action_queue (rule_id)`;
  await sql`create index if not exists automation_action_queue_tenant_idx on automation_action_queue (tenant_slug)`;
}

export async function listAutomationRules(tenantSlug: string, sql: SqlClient = SQL): Promise<AutomationRule[]> {
  await ensureAutomationTables(sql);
  const rows = await sql`select * from automation_rules where tenant_slug = ${tenantSlug} order by created_at desc`;
  return rows.map(mapRuleRow);
}

export async function getAutomationRule(id: string, tenantSlug: string, sql: SqlClient = SQL): Promise<AutomationRule | null> {
  await ensureAutomationTables(sql);
  const rows = await sql`select * from automation_rules where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  return rows.length ? mapRuleRow(rows[0]) : null;
}

export async function createAutomationRule(input: {
  tenantSlug: string;
  name: string;
  description?: string | null;
  eventType: string;
  condition: any;
  actions: Action[];
  scope?: Record<string, any> | null;
  enabled?: boolean;
  simulationOnly?: boolean;
}, sql: SqlClient = SQL): Promise<AutomationRule> {
  await ensureAutomationTables(sql);
  const [row] = await sql`
    insert into automation_rules (tenant_slug, name, description, event_type, condition, actions, scope, enabled, simulation_only)
    values (${input.tenantSlug}, ${input.name}, ${input.description || null}, ${input.eventType}, ${JSON.stringify(input.condition)}, ${JSON.stringify(input.actions)}, ${input.scope || null}, ${input.enabled ?? true}, ${input.simulationOnly ?? false})
    returning *
  ` as any[];
  return mapRuleRow(row);
}

export async function updateAutomationRule(id: string, tenantSlug: string, updates: Partial<{ name: string; description: string | null; condition: any; actions: Action[]; scope: any; enabled: boolean; simulationOnly: boolean; eventType: string }>, sql: SqlClient = SQL): Promise<AutomationRule | null> {
  await ensureAutomationTables(sql);
  const fields: string[] = [];
  const values: any[] = [];

  const push = (fragment: string, value: any) => {
    fields.push(fragment);
    values.push(value);
  };

  if (updates.name !== undefined) push(`name = $${fields.length + 1}`, updates.name);
  if (updates.description !== undefined) push(`description = $${fields.length + 1}`, updates.description);
  if (updates.eventType !== undefined) push(`event_type = $${fields.length + 1}`, updates.eventType);
  if (updates.condition !== undefined) push(`condition = $${fields.length + 1}`, JSON.stringify(updates.condition));
  if (updates.actions !== undefined) push(`actions = $${fields.length + 1}`, JSON.stringify(updates.actions));
  if (updates.scope !== undefined) push(`scope = $${fields.length + 1}`, updates.scope);
  if (updates.enabled !== undefined) push(`enabled = $${fields.length + 1}`, updates.enabled);
  if (updates.simulationOnly !== undefined) push(`simulation_only = $${fields.length + 1}`, updates.simulationOnly);

  if (fields.length === 0) return getAutomationRule(id, tenantSlug, sql);

  const query = `update automation_rules set ${fields.join(", ")}, updated_at = now() where id = $${fields.length + 1} and tenant_slug = $${fields.length + 2} returning *`;
  const [row] = await sql(query, ...values, id, tenantSlug) as any[];
  return row ? mapRuleRow(row) : null;
}

export async function deleteAutomationRule(id: string, tenantSlug: string, sql: SqlClient = SQL) {
  await ensureAutomationTables(sql);
  await sql`delete from automation_rules where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function insertAutomationAudit(entry: {
  ruleId: string;
  tenantSlug: string;
  triggerEvent: any;
  matched: boolean;
  result: any;
  actor?: string;
  scope?: any;
  simulation?: boolean;
}, sql: SqlClient = SQL) {
  await ensureAutomationTables(sql);
  await sql`
    insert into automation_rule_audits (rule_id, tenant_slug, trigger_event, matched, result, actor, scope, simulation)
    values (${entry.ruleId}, ${entry.tenantSlug}, ${JSON.stringify(entry.triggerEvent)}, ${entry.matched}, ${JSON.stringify(entry.result)}, ${entry.actor || null}, ${entry.scope || null}, ${entry.simulation ?? false})
  `;
}

export async function enqueueAutomationActions(actions: Array<{ ruleId: string; tenantSlug: string; actionType: string; actionPayload: any }>, sql: SqlClient = SQL) {
  if (actions.length === 0) return;
  await ensureAutomationTables(sql);
  for (const action of actions) {
    await sql`
      insert into automation_action_queue (rule_id, tenant_slug, action_type, action_payload)
      values (${action.ruleId}, ${action.tenantSlug}, ${action.actionType}, ${JSON.stringify(action.actionPayload)})
    `;
  }
}

export async function listAutomationAudits(tenantSlug: string, limit = 50, sql: SqlClient = SQL) {
  await ensureAutomationTables(sql);
  const rows = await sql`
    select * from automation_rule_audits
    where tenant_slug = ${tenantSlug}
    order by created_at desc
    limit ${limit}
  `;
  return rows.map((row: any) => ({
    id: row.id,
    ruleId: row.rule_id,
    tenantSlug: row.tenant_slug,
    triggerEvent: row.trigger_event,
    matched: row.matched,
    result: row.result,
    actor: row.actor,
    scope: row.scope,
    simulation: row.simulation,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  }));
}

export async function fetchPendingActions(limit = 25, tenantSlug?: string, maxAttempts = 5, sql: SqlClient = SQL) {
  await ensureAutomationTables(sql);
  const rows = tenantSlug
    ? await sql`
        select * from automation_action_queue
        where status = 'pending' and tenant_slug = ${tenantSlug} and (scheduled_for is null or scheduled_for <= now()) and attempt_count < ${maxAttempts}
        order by created_at asc
        limit ${limit}
        for update skip locked
      `
    : await sql`
        select * from automation_action_queue
        where status = 'pending' and (scheduled_for is null or scheduled_for <= now()) and attempt_count < ${maxAttempts}
        order by created_at asc
        limit ${limit}
        for update skip locked
      `;
  return rows;
}

export async function markActionStatus(id: string, status: "pending" | "processing" | "completed" | "failed", error: string | null = null, incrementAttempt = false, sql: SqlClient = SQL) {
  await ensureAutomationTables(sql);
  const increment = incrementAttempt ? sql`attempt_count = attempt_count + 1,` : sql``;
  await sql`
    update automation_action_queue
    set ${increment} status = ${status}, error = ${error}, updated_at = now()
    where id = ${id}
  `;
}

function mapRuleRow(row: any): AutomationRule {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    name: row.name,
    description: row.description,
    eventType: row.event_type,
    condition: row.condition,
    actions: row.actions,
    scope: row.scope,
    enabled: row.enabled,
    simulationOnly: row.simulation_only,
    version: row.version,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  };
}
