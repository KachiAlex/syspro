/**
 * Confirmed action tools — the agent can *propose* a write, which is stored
 * as a pending action and only executed after an explicit confirmation via
 * POST /api/ai/agent/actions. Permissions are enforced at both stages.
 */

import { randomUUID } from "crypto";

const PENDING_TTL_MINUTES = 30;
let actionsTableEnsured = false;

/** Roles allowed to propose/execute write actions. */
const WRITE_ROLES = new Set(["admin", "tenant_admin", "executive", "hod", "hr", "hr_admin", "hr_manager"]);
const ANNOUNCE_ROLES = new Set(["admin", "tenant_admin", "executive", "hr", "hr_admin", "hr_manager"]);

export interface ActionParamDef {
  name: string;
  type: "string" | "number";
  required: boolean;
  description: string;
}

export interface ActionDefinition {
  name: string;
  description: string;
  allowedRoles: Set<string>;
  params: ActionParamDef[];
  execute: (tenantSlug: string, params: Record<string, unknown>, actorId: string) => Promise<unknown>;
}

async function resolveEmployeeId(sql: any, tenantSlug: string, ref: string): Promise<string | null> {
  const refTrim = String(ref).trim();
  const byId = await sql`
    select id from admin_employees where tenant_slug = ${tenantSlug} and id = ${refTrim} limit 1
  `;
  if ((byId as any[])[0]) return (byId as any[])[0].id;
  const byName = await sql`
    select id from admin_employees
    where tenant_slug = ${tenantSlug} and lower(name) = lower(${refTrim}) limit 1
  `;
  return (byName as any[])[0]?.id ?? null;
}

export const ACTION_REGISTRY: ActionDefinition[] = [
  {
    name: "create_staff_task",
    description: "Create a task assigned to an employee (one-time or recurring)",
    allowedRoles: WRITE_ROLES,
    params: [
      { name: "employeeId", type: "string", required: true, description: "Employee id or exact full name" },
      { name: "title", type: "string", required: true, description: "Task title" },
      { name: "description", type: "string", required: false, description: "Task details" },
      { name: "dueDate", type: "string", required: true, description: "Due date, YYYY-MM-DD" },
      { name: "frequency", type: "string", required: false, description: "daily|weekly|monthly|one-time (default one-time)" },
    ],
    async execute(tenantSlug, params, actorId) {
      const { sql } = await import("@/lib/sql-client");
      const { insertStaffTask } = await import("@/lib/hr/db");
      const employeeId = await resolveEmployeeId(sql, tenantSlug, String(params.employeeId));
      if (!employeeId) throw new Error(`Employee not found: ${params.employeeId}`);
      const frequency = (["daily", "weekly", "monthly", "one-time"] as const).includes(params.frequency as any)
        ? params.frequency
        : "one-time";
      const task = await insertStaffTask({
        tenantSlug,
        employeeId,
        title: String(params.title),
        description: params.description ? String(params.description) : undefined,
        frequency: frequency as any, // DB constraint allows daily/weekly/monthly/quarterly/annual/one-time
        dueDate: String(params.dueDate),
        assignedBy: actorId,
      });
      return { taskId: (task as any).id ?? task, employeeId, title: params.title };
    },
  },
  {
    name: "post_announcement",
    description: "Publish an announcement to all employees (or a department/role)",
    allowedRoles: ANNOUNCE_ROLES,
    params: [
      { name: "title", type: "string", required: true, description: "Announcement title" },
      { name: "message", type: "string", required: true, description: "Announcement body" },
      { name: "priority", type: "string", required: false, description: "low|medium|high|urgent (default medium)" },
    ],
    async execute(tenantSlug, params, actorId) {
      const { insertAnnouncement } = await import("@/lib/hr/db");
      const priority = (["low", "medium", "high", "urgent"] as const).includes(params.priority as any)
        ? (params.priority as "low" | "medium" | "high" | "urgent")
        : "medium";
      const id = await insertAnnouncement({
        tenantSlug,
        title: String(params.title),
        message: String(params.message),
        priority,
        createdBy: actorId,
      });
      return { announcementId: id, title: params.title };
    },
  },
];

export function getAction(name: string): ActionDefinition | undefined {
  return ACTION_REGISTRY.find((a) => a.name === name);
}

export function canUseAction(def: ActionDefinition, actor: { role?: string; authMethod?: string }): boolean {
  if (actor.authMethod === "api_key") return true; // tenant-issued keys act at admin level
  return !!actor.role && def.allowedRoles.has(actor.role.toLowerCase());
}

async function ensureActionsTable() {
  if (actionsTableEnsured) return;
  actionsTableEnsured = true;
  const { sql } = await import("@/lib/sql-client");
  await sql`
    create table if not exists ai_pending_actions (
      id text primary key,
      tenant_slug text not null,
      actor_id text,
      actor_role text,
      action text not null,
      params jsonb not null,
      status text not null default 'proposed' check (status in ('proposed','executed','rejected','expired')),
      result jsonb,
      error text,
      created_at timestamptz default now(),
      executed_at timestamptz,
      expires_at timestamptz
    )
  `;
  await sql`create index if not exists idx_ai_pending_actions_tenant on ai_pending_actions(tenant_slug, status, created_at desc)`;
}

function validateParams(def: ActionDefinition, params: Record<string, unknown>): string[] {
  const missing = def.params
    .filter((p) => p.required && (params[p.name] == null || String(params[p.name]).trim() === ""))
    .map((p) => p.name);
  return missing;
}

export interface PendingAction {
  id: string;
  tenant_slug: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  params: Record<string, unknown>;
  status: string;
  result: unknown;
  created_at: string;
  expires_at: string;
}

/**
 * Stage a write action for confirmation. Throws on unknown action,
 * permission denial, or missing required params.
 */
export async function proposeAction(opts: {
  tenantSlug: string;
  actorId?: string;
  actorRole?: string;
  authMethod?: string;
  action: string;
  params: Record<string, unknown>;
}): Promise<PendingAction> {
  const def = getAction(opts.action);
  if (!def) throw new Error(`Unknown action: ${opts.action}. Available: ${ACTION_REGISTRY.map((a) => a.name).join(", ")}`);
  if (!canUseAction(def, { role: opts.actorRole, authMethod: opts.authMethod })) {
    throw new Error(`Your role cannot perform "${opts.action}"`);
  }
  const missing = validateParams(def, opts.params);
  if (missing.length) throw new Error(`Missing required parameters: ${missing.join(", ")}`);

  await ensureActionsTable();
  const { sql } = await import("@/lib/sql-client");
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + PENDING_TTL_MINUTES * 60_000).toISOString();
  await sql`
    insert into ai_pending_actions (id, tenant_slug, actor_id, actor_role, action, params, status, expires_at)
    values (${id}, ${opts.tenantSlug}, ${opts.actorId ?? null}, ${opts.actorRole ?? null}, ${opts.action}, ${JSON.stringify(opts.params)}::jsonb, 'proposed', ${expiresAt})
  `;
  const rows = await sql`select * from ai_pending_actions where id = ${id} limit 1`;
  return (rows as any[])[0] as PendingAction;
}

async function loadPending(id: string, tenantSlug: string): Promise<PendingAction | null> {
  await ensureActionsTable();
  const { sql } = await import("@/lib/sql-client");
  const rows = await sql`
    select * from ai_pending_actions
    where id = ${id} and tenant_slug = ${tenantSlug} limit 1
  `;
  return ((rows as any[])[0] as PendingAction) ?? null;
}

/**
 * Execute a previously proposed action. Re-validates role at execution time
 * (a different user may confirm) and refuses expired/replayed actions.
 */
export async function executeAction(
  id: string,
  opts: { tenantSlug: string; actorId?: string; actorRole?: string; authMethod?: string },
): Promise<{ status: string; result?: unknown; error?: string }> {
  const pending = await loadPending(id, opts.tenantSlug);
  if (!pending) return { status: "error", error: "Action not found" };
  if (pending.status !== "proposed") return { status: "error", error: `Action already ${pending.status}` };
  if (pending.expires_at && new Date(pending.expires_at) < new Date()) {
    await setStatus(id, "expired");
    return { status: "error", error: "Action expired — propose it again" };
  }

  const def = getAction(pending.action);
  if (!def) return { status: "error", error: "Unknown action" };
  if (!canUseAction(def, { role: opts.actorRole, authMethod: opts.authMethod })) {
    return { status: "error", error: `Your role cannot confirm "${pending.action}"` };
  }

  try {
    const result = await def.execute(opts.tenantSlug, pending.params, opts.actorId ?? pending.actor_id ?? "ai-agent");
    const { sql } = await import("@/lib/sql-client");
    await sql`
      update ai_pending_actions
      set status = 'executed', result = ${JSON.stringify(result)}::jsonb, executed_at = now()
      where id = ${id}
    `;
    import("@/lib/audit").then(({ logAuditAction }) =>
      logAuditAction("ai_action_executed", pending.action, id, { params: pending.params, result }, opts.tenantSlug, undefined, opts.actorId ?? pending.actor_id ?? undefined),
    ).catch(() => {});
    return { status: "executed", result };
  } catch (err: any) {
    const { sql } = await import("@/lib/sql-client");
    await sql`update ai_pending_actions set error = ${err?.message ?? "execution failed"} where id = ${id}`;
    return { status: "error", error: err?.message ?? "Execution failed" };
  }
}

export async function rejectAction(
  id: string,
  opts: { tenantSlug: string; actorId?: string },
): Promise<{ status: string; error?: string }> {
  const pending = await loadPending(id, opts.tenantSlug);
  if (!pending) return { status: "error", error: "Action not found" };
  if (pending.status !== "proposed") return { status: "error", error: `Action already ${pending.status}` };
  await setStatus(id, "rejected");
  return { status: "rejected" };
}

async function setStatus(id: string, status: string) {
  const { sql } = await import("@/lib/sql-client");
  await sql`update ai_pending_actions set status = ${status} where id = ${id}`;
}
