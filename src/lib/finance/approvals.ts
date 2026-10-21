/**
 * Approval Workflow Service
 * Manages configurable approval workflows for POs, bills, and payments
 */

import { randomUUID } from "crypto";
import { db, sql as SQL } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { emitEvent } from "@/lib/notify";

export type ApprovalEntityType =
  | "purchase_order" | "bill" | "payment"
  | "journal_entry" | "sales_return" | "purchase_return";

export interface ApprovalRule {
  id: string;
  tenantSlug: string;
  entityType: ApprovalEntityType;
  ruleType: "amount_based" | "department_based" | "project_based" | "vendor_based";
  conditions: {
    minAmount?: number;
    maxAmount?: number;
    departmentId?: string;
    projectId?: string;
    vendorId?: string;
  };
  approvers: ApproverStep[];
  isActive: boolean;
  priority: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApproverStep {
  step: number;
  userId: string;
  role?: string;
  required: boolean;
  order: number;
}

export interface Approval {
  id: string;
  tenantSlug: string;
  entityType: ApprovalEntityType;
  entityId: string;
  ruleId?: string;
  status: "pending" | "approved" | "rejected" | "escalated" | "cancelled";
  requestedBy: string;
  requestedByName?: string | null;
  approverChain: ApproverStep[];
  decisions: ApprovalDecision[];
  currentStep: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalDecision {
  step: number;
  userId: string;
  decision: "approved" | "rejected" | "escalated";
  comments?: string;
  timestamp: string;
}

/* using imported SQL */

export function ensureApprovalTables(...args: Parameters<typeof ensureApprovalTablesRun>) {
  return ensureOnce("finance/approvals:ensureApprovalTables", () => ensureApprovalTablesRun(...args));
}

async function ensureApprovalTablesRun(sql = SQL) {
  try {
    // Approval rules table
    await sql`
      create table if not exists approval_rules (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        entity_type text not null check (entity_type in ('purchase_order', 'bill', 'payment', 'journal_entry', 'sales_return', 'purchase_return')),
        rule_type text not null check (rule_type in ('amount_based', 'department_based', 'project_based', 'vendor_based')),
        conditions jsonb not null,
        approvers jsonb not null,
        is_active boolean default true,
        priority integer default 0,
        metadata jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;

    // Approvals table (already exists from migration, but ensure structure)
    await sql`
      alter table approvals add column if not exists rule_id uuid
    `;
    // Entity types grew — relax any legacy check constraint on both tables.
    await sql`alter table if exists approval_rules drop constraint if exists approval_rules_entity_type_check`;
    await sql`alter table if exists approvals drop constraint if exists approvals_entity_type_check`;

    // Create indexes
    await Promise.all([
      sql`create index if not exists approval_rules_tenant_idx on approval_rules (tenant_slug)`,
      sql`create index if not exists approval_rules_entity_idx on approval_rules (entity_type)`,
      sql`create index if not exists approval_rules_active_idx on approval_rules (is_active)`,
      sql`create index if not exists approvals_rule_idx on approvals (rule_id)`
    ]);

  } catch (error) {
    console.error("Failed to ensure approval tables:", error);
  }
}

export async function createApprovalRule(payload: {
  tenantSlug: string;
  entityType: ApprovalEntityType;
  ruleType: "amount_based" | "department_based" | "project_based" | "vendor_based";
  conditions: Record<string, any>;
  approvers: ApproverStep[];
  priority?: number;
  metadata?: Record<string, unknown>;
}): Promise<ApprovalRule> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  const id = randomUUID();

  const [record] = (await sql`
    insert into approval_rules (
      id, tenant_slug, entity_type, rule_type, conditions, approvers,
      is_active, priority, metadata, created_at, updated_at
    ) values (
      ${id}, ${payload.tenantSlug}, ${payload.entityType}, ${payload.ruleType},
      ${JSON.stringify(payload.conditions)}, ${JSON.stringify(payload.approvers)},
      true, ${payload.priority || 0}, ${payload.metadata || null}, now(), now()
    ) returning *
  `) as any[];

  return {
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    ruleType: record.rule_type,
    conditions: record.conditions,
    approvers: record.approvers,
    isActive: record.is_active,
    priority: record.priority,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export async function getApprovalRules(filters: {
  tenantSlug: string;
  entityType?: string;
  isActive?: boolean;
}): Promise<ApprovalRule[]> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  const params: any[] = [];
  let paramIndex = 1;
  let whereClause = `tenant_slug = $${paramIndex}`;
  params.push(filters.tenantSlug);
  paramIndex++;

  if (filters.entityType) {
    whereClause += ` and entity_type = $${paramIndex}`;
    params.push(filters.entityType);
    paramIndex++;
  }

  if (filters.isActive !== undefined) {
    whereClause += ` and is_active = $${paramIndex}`;
    params.push(filters.isActive);
    paramIndex++;
  }

  const queryText = `select * from approval_rules where ${whereClause} order by priority desc, created_at asc`;

  const records = (await db.query<any>(queryText, params)).rows;

  return records.map(record => ({
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    ruleType: record.rule_type,
    conditions: record.conditions,
    approvers: record.approvers,
    isActive: record.is_active,
    priority: record.priority,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }));
}

export async function findMatchingRule(
  tenantSlug: string,
  entityType: ApprovalEntityType,
  entityData: Record<string, any>
): Promise<ApprovalRule | null> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  const rules = await getApprovalRules({ tenantSlug, entityType, isActive: true });

  for (const rule of rules) {
    if (matchesRule(rule, entityData)) {
      return rule;
    }
  }

  return null;
}

function matchesRule(rule: ApprovalRule, entityData: Record<string, any>): boolean {
  const { conditions } = rule;

  switch (rule.ruleType) {
    case "amount_based":
      const amount = entityData.amount || entityData.total || 0;
      if (conditions.minAmount && amount < conditions.minAmount) return false;
      if (conditions.maxAmount && amount > conditions.maxAmount) return false;
      break;

    case "department_based":
      if (conditions.departmentId && entityData.departmentId !== conditions.departmentId) return false;
      break;

    case "project_based":
      if (conditions.projectId && entityData.projectId !== conditions.projectId) return false;
      break;

    case "vendor_based":
      if (conditions.vendorId && entityData.vendorId !== conditions.vendorId) return false;
      break;
  }

  return true;
}

/**
 * Build default approver chain based on document-specified thresholds:
 * - Under ₦50,000 → Department Manager only
 * - ₦50,000 to ₦500,000 → Department Manager → Finance Manager
 * - Above ₦500,000 → Department Manager → Finance Manager → Finance Admin → Tenant Owner
 */
export function buildThresholdEscalationChain(amount: number): ApproverStep[] {
  const steps: ApproverStep[] = [];
  let stepNum = 0;

  // Always require Department Manager at step 0
  steps.push({ step: stepNum, userId: "role:dept_manager", role: "dept_manager", required: true, order: 0 });

  if (amount >= 50000) {
    stepNum++;
    steps.push({ step: stepNum, userId: "role:finance_manager", role: "finance_manager", required: true, order: 0 });
  }

  if (amount > 500000) {
    stepNum++;
    steps.push({ step: stepNum, userId: "role:finance_admin", role: "finance_admin", required: true, order: 0 });
    stepNum++;
    steps.push({ step: stepNum, userId: "role:tenant_owner", role: "tenant_owner", required: true, order: 0 });
  }

  return steps;
}

export async function initiateApproval(payload: {
  tenantSlug: string;
  entityType: ApprovalEntityType;
  entityId: string;
  requestedBy: string;
  entityData: Record<string, any>;
}): Promise<Approval> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  // Find matching approval rule
  const rule = await findMatchingRule(payload.tenantSlug, payload.entityType, payload.entityData);

  const id = randomUUID();
  const amount = payload.entityData.amount || payload.entityData.total || 0;
  const approverChain = rule?.approvers || buildThresholdEscalationChain(Number(amount));
  
  const [record] = (await sql`
    insert into approvals (
      id, tenant_slug, entity_type, entity_id, rule_id, status,
      requested_by, approver_chain, decisions, current_step, metadata,
      created_at, updated_at
    ) values (
      ${id}, ${payload.tenantSlug}, ${payload.entityType}, ${payload.entityId},
      ${rule?.id || null}, 'pending', ${payload.requestedBy},
      ${JSON.stringify(approverChain)}, ${JSON.stringify([])}, 0,
      ${JSON.stringify(payload.entityData)}, now(), now()
    ) returning *
  `) as any[];

  // Notify step-0 approvers — concrete ids resolve directly, role placeholders
  // ("role:finance_manager") resolve via tenant_admins role matching.
  const step0Specs = (approverChain as ApproverStep[])
    .filter((s) => s.step === 0)
    .map((s) => s.userId.startsWith("role:")
      ? { kind: "role" as const, value: s.userId.slice(5) }
      : { kind: "user" as const, value: s.userId });
  void emitEvent({
    tenantSlug: payload.tenantSlug,
    eventType: "approval.requested",
    sourceModule: "approvals",
    sourceRecordId: id,
    actorId: payload.requestedBy,
    explicitSpecs: step0Specs,
    payload: {
      approvalId: id,
      entityType: payload.entityType,
      entityRef: payload.entityData.invoiceNumber ?? payload.entityData.billNumber
        ?? payload.entityData.journalNumber ?? payload.entityData.reference ?? payload.entityId,
      amount,
      requestedBy: payload.requestedBy,
      requestedByName: payload.entityData.requestedByName,
    },
  });

  return {
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    entityId: record.entity_id,
    ruleId: record.rule_id,
    status: record.status,
    requestedBy: record.requested_by,
    approverChain: record.approver_chain,
    decisions: record.decisions || [],
    currentStep: record.current_step,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export async function processApprovalDecision(payload: {
  approvalId: string;
  userId: string;
  userRole?: string;
  decision: "approved" | "rejected" | "escalated";
  comments?: string;
}): Promise<Approval | null> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  // Get current approval
  const [current] = (await sql`
    select * from approvals where id = ${payload.approvalId} limit 1
  `) as any[];

  if (!current) return null;

  const approverChain = current.approver_chain;
  const decisions = current.decisions || [];
  const currentStep = current.current_step;

  // Check if user is authorized to make decision at current step.
  // Approvers are either concrete userIds or role placeholders ("role:dept_manager");
  // tenant admins may act on any step so workflows cannot stall.
  const currentStepApprovers = approverChain.filter((step: ApproverStep) => step.step === currentStep);
  const callerRoleKey = payload.userRole ? `role:${payload.userRole}` : null;
  const isAdmin = ["admin", "tenant_admin", "superadmin"].includes(payload.userRole || "");
  const isAuthorized = isAdmin || currentStepApprovers.some(
    (step: ApproverStep) => step.userId === payload.userId || step.userId === callerRoleKey
  );

  if (!isAuthorized) {
    throw new Error("User not authorized to approve at current step");
  }

  // Add decision
  const newDecision: ApprovalDecision = {
    step: currentStep,
    userId: payload.userId,
    decision: payload.decision,
    comments: payload.comments,
    timestamp: new Date().toISOString()
  };

  decisions.push(newDecision);

  // Determine new status and step
  let newStatus = current.status;
  let newStep = currentStep;

  if (payload.decision === "rejected") {
    newStatus = "rejected";
  } else if (payload.decision === "escalated") {
    newStatus = "escalated";
    newStep = Math.min(currentStep + 1, approverChain.length - 1);
  } else if (payload.decision === "approved") {
    // Check if all required approvers at current step have approved
    const stepDecisions = decisions.filter((d: ApprovalDecision) => d.step === currentStep && d.decision === "approved");
    const requiredApprovers = currentStepApprovers.filter((step: ApproverStep) => step.required);
    
    if (stepDecisions.length >= requiredApprovers.length) {
      // Move to next step or complete approval
      if (currentStep >= approverChain.length - 1) {
        newStatus = "approved";
      } else {
        newStep = currentStep + 1;
      }
    }
  }

  // Update approval
  const [updated] = (await sql`
    update approvals set
      status = ${newStatus},
      decisions = ${JSON.stringify(decisions)},
      current_step = ${newStep},
      updated_at = now()
    where id = ${payload.approvalId}
    returning *
  `) as any[];

  // Terminal decision reached — apply it to the underlying document so a
  // rejected journal/PO/return cannot take financial effect and an approved
  // one can.
  if ((newStatus === "approved" || newStatus === "rejected") && newStatus !== current.status) {
    await applyApprovalOutcome(updated.tenant_slug, updated.entity_type, updated.entity_id, newStatus);
    void emitEvent({
      tenantSlug: updated.tenant_slug,
      eventType: "approval.decided",
      sourceModule: "approvals",
      sourceRecordId: updated.id,
      actorId: payload.userId,
      explicitSpecs: [{ kind: "user", value: updated.requested_by }],
      payload: {
        approvalId: updated.id,
        entityType: updated.entity_type,
        entityRef: updated.metadata?.invoiceNumber ?? updated.metadata?.billNumber
          ?? updated.metadata?.journalNumber ?? updated.metadata?.reference ?? updated.entity_id,
        decision: newStatus,
        decidedBy: payload.userId,
        comments: payload.comments,
      },
    });
  }

  return {
    id: updated.id,
    tenantSlug: updated.tenant_slug,
    entityType: updated.entity_type,
    entityId: updated.entity_id,
    ruleId: updated.rule_id,
    status: updated.status,
    requestedBy: updated.requested_by,
    approverChain: updated.approver_chain,
    decisions: updated.decisions,
    currentStep: updated.current_step,
    metadata: updated.metadata,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at
  };
}

// ---------------------------------------------------------------------------
// Approval gates — auto-initiation + document effects
// ---------------------------------------------------------------------------

/**
 * Tenant-configured thresholds in settings.approvals. A document whose amount
 * meets or exceeds the configured minimum requires approval even when no
 * explicit rule matches. 0 means "always".
 */
const ENTITY_THRESHOLD_KEYS: Record<ApprovalEntityType, string> = {
  purchase_order: "purchaseOrderMinAmount",
  bill: "billMinAmount",
  payment: "paymentMinAmount",
  journal_entry: "journalEntryMinAmount",
  sales_return: "returnMinAmount",
  purchase_return: "returnMinAmount",
};

async function tenantApprovalSettings(tenantSlug: string): Promise<Record<string, number>> {
  const rows = await db.query<any>(
    `select settings from tenants where slug = $1`,
    [tenantSlug]
  );
  return (rows.rows[0]?.settings as any)?.approvals ?? {};
}

/**
 * Does this document require approval? True when a matching rule exists OR
 * the tenant threshold for the entity type is configured and met.
 */
export async function requiresApproval(
  tenantSlug: string,
  entityType: ApprovalEntityType,
  entityData: Record<string, any>
): Promise<boolean> {
  const rule = await findMatchingRule(tenantSlug, entityType, entityData);
  if (rule) return true;
  const settings = await tenantApprovalSettings(tenantSlug);
  const min = settings[ENTITY_THRESHOLD_KEYS[entityType]];
  if (min === undefined || min === null) return false;
  const amount = Number(entityData.amount ?? entityData.total ?? 0);
  return amount >= Number(min);
}

/**
 * Gate helper: call after the entity exists. Returns the approval record when
 * the document needs sign-off, else null.
 */
export async function initiateApprovalIfRequired(payload: {
  tenantSlug: string;
  entityType: ApprovalEntityType;
  entityId: string;
  requestedBy?: string;
  entityData: Record<string, any>;
}): Promise<Approval | null> {
  if (!(await requiresApproval(payload.tenantSlug, payload.entityType, payload.entityData))) {
    return null;
  }
  return initiateApproval({
    tenantSlug: payload.tenantSlug,
    entityType: payload.entityType,
    entityId: payload.entityId,
    requestedBy: payload.requestedBy ?? "system",
    entityData: payload.entityData,
  });
}

/**
 * Applies a terminal approval outcome to the underlying document. Called by
 * processApprovalDecision when the chain reaches approved/rejected.
 */
async function applyApprovalOutcome(
  tenantSlug: string,
  entityType: string,
  entityId: string,
  outcome: "approved" | "rejected"
): Promise<void> {
  try {
    switch (entityType) {
      case "journal_entry":
        await db.query(
          `update journal_entries
           set approval_status = $1, status = lower($1),
               posted_at = case when $1 = 'POSTED' then now() else null end,
               updated_at = now()
           where id = $2 and tenant_slug = $3`,
          [outcome === "approved" ? "POSTED" : "REJECTED", entityId, tenantSlug]
        );
        break;
      case "purchase_order":
        await db.query(
          `update purchase_orders set status = $1, updated_at = now()
           where id = $2 and tenant_slug = $3 and status = 'pending_approval'`,
          [outcome === "approved" ? "open" : "rejected", entityId, tenantSlug]
        );
        break;
      case "sales_return":
      case "purchase_return":
        if (outcome === "approved") {
          const { finalizeReturn } = await import("./returns");
          await finalizeReturn(tenantSlug, entityId);
        } else {
          await db.query(
            `update finance_returns set status = 'cancelled'
             where id = $1 and tenant_slug = $2 and status = 'pending_approval'`,
            [entityId, tenantSlug]
          );
        }
        break;
      // bill/payment approvals are tracked but do not gate the underlying
      // document — their lifecycle is managed by existing flows.
    }
  } catch (err) {
    console.error(`applyApprovalOutcome ${entityType} ${entityId}:`, err);
  }
}

export async function getApprovals(filters: {
  tenantSlug: string;
  entityType?: string;
  entityId?: string;
  status?: string;
  userId?: string; // Approvals where user is an approver
  limit?: number;
  offset?: number;
}): Promise<Approval[]> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const params: any[] = [];
  let paramIndex = 1;
  let whereClause = `tenant_slug = $${paramIndex}`;
  params.push(filters.tenantSlug);
  paramIndex++;

  if (filters.entityType) {
    whereClause += ` and entity_type = $${paramIndex}`;
    params.push(filters.entityType);
    paramIndex++;
  }

  if (filters.entityId) {
    whereClause += ` and entity_id = $${paramIndex}`;
    params.push(filters.entityId);
    paramIndex++;
  }

  if (filters.status) {
    whereClause += ` and status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  const queryText = `select * from approvals where ${whereClause} order by created_at desc limit $${paramIndex} offset $${paramIndex + 1}`;
  params.push(limit, offset);

  const records = (await db.query<any>(queryText, params)).rows;
  const nameMap = await resolveRequesterNames(
    filters.tenantSlug,
    [...new Set(records.map((r) => r.requested_by).filter(Boolean))]
  );

  return records.map(record => ({
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    entityId: record.entity_id,
    ruleId: record.rule_id,
    status: record.status,
    requestedBy: record.requested_by,
    requestedByName: nameMap.get(record.requested_by) ?? null,
    approverChain: record.approver_chain,
    decisions: record.decisions || [],
    currentStep: record.current_step,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }));
}

/**
 * Batch-resolves requested_by values (employee ids, admin ids, or emails)
 * to display names. Never throws.
 */
async function resolveRequesterNames(tenantSlug: string, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  try {
    const employees = (await db.query<any>(
      `select id, name, email from admin_employees where tenant_slug = $1 and (id = any($2) or lower(email) = any($2))`,
      [tenantSlug, ids.map((i) => String(i).toLowerCase())]
    )).rows;
    for (const e of employees) {
      map.set(e.id, e.name);
      if (e.email) map.set(String(e.email).toLowerCase(), e.name);
    }
    const admins = (await db.query<any>(
      `select id::text as id, name, email from tenant_admins where tenant_slug = $1 and (id::text = any($2) or lower(email) = any($2))`,
      [tenantSlug, ids.map((i) => String(i).toLowerCase())]
    )).rows;
    for (const a of admins) {
      map.set(a.id, a.name);
      if (a.email) map.set(String(a.email).toLowerCase(), a.name);
    }
  } catch {
    // best-effort name resolution
  }
  return map;
}

export async function getPendingApprovalsForUser(
  tenantSlug: string,
  userId: string,
  role?: string
): Promise<Approval[]> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  // Chains mix concrete userIds with role placeholders ("role:dept_manager").
  // Match the step currently awaiting action against the caller's id or role;
  // tenant admins see every pending item so nothing gets stuck.
  const roleKey = role ? `role:${role}` : null;
  const seesAll = ["admin", "tenant_admin", "superadmin"].includes(role || "");

  const records = (await sql`
    select * from approvals 
    where tenant_slug = ${tenantSlug}
    and status = 'pending'
    and (
      ${seesAll}
      or approver_chain -> current_step ->> 'userId' = ${userId}
      or (${roleKey}::text is not null and approver_chain -> current_step ->> 'userId' = ${roleKey})
      or approver_chain @> ${JSON.stringify([{ userId }])}::jsonb
    )
    order by created_at asc
  `) as any[];

  return records.map(record => ({
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    entityId: record.entity_id,
    ruleId: record.rule_id,
    status: record.status,
    requestedBy: record.requested_by,
    approverChain: record.approver_chain,
    decisions: record.decisions || [],
    currentStep: record.current_step,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }));
}
