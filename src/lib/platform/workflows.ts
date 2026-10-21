import { db } from "@/lib/sql-client";

// Per-doctype workflow state machine: states + transitions gated by role.

export type WorkflowTransition = {
  from: string;
  to: string;
  action: string;
  roles: string[];
};

export async function listWorkflows(tenantSlug: string, docType?: string) {
  return (await db.query<any>(
    `select * from workflow_definitions where tenant_slug = $1
     ${docType ? "and doc_type = $2" : ""} order by doc_type, name`,
    docType ? [tenantSlug, docType] : [tenantSlug]
  )).rows;
}

export async function upsertWorkflow(input: {
  tenantSlug: string;
  id?: string;
  docType: string;
  name: string;
  statusField?: string;
  states: { name: string; docStatus?: string; style?: string }[];
  transitions: WorkflowTransition[];
  isActive?: boolean;
  createdBy?: string;
}) {
  const existing = input.id
    ? (await db.query<any>(
        `select * from workflow_definitions where id = $1 and tenant_slug = $2`,
        [input.id, input.tenantSlug]
      )).rows[0]
    : null;
  if (existing) {
    return (await db.query<any>(
      `update workflow_definitions set name=$1, status_field=$2, states=$3,
         transitions=$4, is_active=$5, updated_at=now()
       where id=$6 returning *`,
      [input.name, input.statusField ?? existing.status_field,
       JSON.stringify(input.states), JSON.stringify(input.transitions),
       input.isActive ?? existing.is_active, input.id]
    )).rows[0];
  }
  return (await db.query<any>(
    `insert into workflow_definitions (tenant_slug, doc_type, name, status_field,
       states, transitions, is_active, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (tenant_slug, doc_type, name) do update set
       status_field = excluded.status_field, states = excluded.states,
       transitions = excluded.transitions, is_active = excluded.is_active,
       updated_at = now()
     returning *`,
    [input.tenantSlug, input.docType, input.name, input.statusField ?? "status",
     JSON.stringify(input.states), JSON.stringify(input.transitions),
     input.isActive ?? true, input.createdBy ?? null]
  )).rows[0];
}

export async function getActiveWorkflow(tenantSlug: string, docType: string) {
  return (await db.query<any>(
    `select * from workflow_definitions where tenant_slug = $1 and doc_type = $2
       and is_active order by created_at limit 1`,
    [tenantSlug, docType]
  )).rows[0] ?? null;
}

/** Returns the transitions the given role may take from `currentState`. */
export async function allowedActions(
  tenantSlug: string, docType: string, currentState: string, roles: string[]
) {
  const wf = await getActiveWorkflow(tenantSlug, docType);
  if (!wf) return [];
  return (wf.transitions as WorkflowTransition[]).filter(
    (t) => t.from === currentState &&
      (t.roles.length === 0 || t.roles.some((r) => roles.includes(r)))
  );
}

/**
 * Validate + compute a workflow transition. Returns the new state. The caller
 * is responsible for persisting the state on the document — this keeps the
 * engine usable by every doctype without table coupling.
 */
export async function applyTransition(input: {
  tenantSlug: string;
  docType: string;
  currentState: string;
  action: string;
  roles: string[];
}) {
  const wf = await getActiveWorkflow(input.tenantSlug, input.docType);
  if (!wf) throw new Error(`No active workflow for ${input.docType}`);
  const t = (wf.transitions as WorkflowTransition[]).find(
    (tr) => tr.from === input.currentState && tr.action === input.action
  );
  if (!t)
    throw new Error(
      `No transition '${input.action}' from state '${input.currentState}'`
    );
  if (t.roles.length > 0 && !t.roles.some((r) => input.roles.includes(r)))
    throw new Error(`Role not permitted for action '${input.action}'`);
  const state = (wf.states as { name: string; docStatus?: string }[]).find(
    (s) => s.name === t.to
  );
  return { newState: t.to, docStatus: state?.docStatus ?? null };
}

export async function deleteWorkflow(tenantSlug: string, id: string) {
  await db.query(
    `delete from workflow_definitions where id = $1 and tenant_slug = $2`,
    [id, tenantSlug]
  );
}
