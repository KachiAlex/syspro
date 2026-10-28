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
  | "journal_entry" | "sales_return" | "purchase_return"
  | "expense" | "employee_expense"
  | "payroll_run" | "employee_salary_change" | "credit_limit_change"
  | "stock_adjustment" | "bank_guarantee" | "invoice_discounting"
  | "pricing_change"
  | "gated_action";

/** Approval domains — the rows of the tenant's delegation-of-authority
 * matrix (settings.approvals.authorityMatrix). Every gated entity type and
 * registered gated action maps onto exactly one domain. */
export type GateDomain =
  | "spend" | "treasury" | "people" | "inventory"
  | "master_data" | "system" | "sales";

/** Default domain per entity type; gated actions carry their own. */
export const ENTITY_DOMAINS: Record<string, GateDomain> = {
  purchase_order: "spend",
  bill: "spend",
  payment: "spend",
  expense: "spend",
  employee_expense: "spend",
  payroll_run: "spend",
  purchase_return: "spend",
  bank_guarantee: "treasury",
  invoice_discounting: "treasury",
  employee_salary_change: "people",
  credit_limit_change: "master_data",
  vendor_bank_change: "master_data",
  pricing_change: "master_data",
  stock_adjustment: "inventory",
  journal_entry: "system",
  sales_return: "sales",
};

export interface ApprovalRule {
  id: string;
  tenantSlug: string;
  entityType: ApprovalEntityType;
  ruleType: "amount_based" | "department_based" | "project_based" | "vendor_based" | "category_based";
  conditions: {
    minAmount?: number;
    maxAmount?: number;
    departmentId?: string;
    projectId?: string;
    vendorId?: string;
    categoryId?: string;
    /** Gated-action rules only: scope the rule to one registered action
     *  (metadata.action). Without it a gated_action rule matches all actions. */
    action?: string;
    slaHours?: number;
    slaAction?: "remind" | "escalate";
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
  decision: "approved" | "rejected" | "escalated" | "clarification_needed";
  comments?: string;
  timestamp: string;
  /** Set when the decider acted on behalf of the named approver via a
      valid approval_delegates grant. */
  delegatedFor?: string;
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
    // Entity/rule types grew — relax any legacy check constraint on both
    // tables so expense + category_based rows are accepted.
    await sql`alter table if exists approval_rules drop constraint if exists approval_rules_entity_type_check`;
    await sql`alter table if exists approval_rules drop constraint if exists approval_rules_rule_type_check`;
    await sql`alter table if exists approvals drop constraint if exists approvals_entity_type_check`;

    // Delegation: lets an approver hand their authority to another user for a
    // window (out-of-office). entity_type null = all document types.
    await sql`
      create table if not exists approval_delegates (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        delegator_id text not null,
        delegate_id text not null,
        entity_type text,
        valid_from timestamptz not null default now(),
        valid_to timestamptz,
        active boolean default true,
        note text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;

    // Create indexes
    await Promise.all([
      sql`create index if not exists approval_rules_tenant_idx on approval_rules (tenant_slug)`,
      sql`create index if not exists approval_rules_entity_idx on approval_rules (entity_type)`,
      sql`create index if not exists approval_rules_active_idx on approval_rules (is_active)`,
      sql`create index if not exists approvals_rule_idx on approvals (rule_id)`,
      sql`create index if not exists approval_delegates_lookup_idx on approval_delegates (tenant_slug, delegate_id, delegator_id)`
    ]);

  } catch (error) {
    console.error("Failed to ensure approval tables:", error);
  }
}

export async function createApprovalRule(payload: {
  tenantSlug: string;
  entityType: ApprovalEntityType;
  ruleType: "amount_based" | "department_based" | "project_based" | "vendor_based" | "category_based";
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

  // Action-scoped rules only fire for the registered gated action they name.
  if (conditions.action && entityData.action !== conditions.action) return false;

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

    case "category_based":
      if (conditions.categoryId && entityData.categoryId !== conditions.categoryId) return false;
      break;
  }

  return true;
}

/**
 * Build default approver chain based on document-specified thresholds:
 * - Under `step2Amount` (default ₦50,000) → Department Manager only
 * - `step2Amount` to `step3Amount` (default ₦500,000) → Department Manager → Finance Manager
 * - Above `step3Amount` → Department Manager → Finance Manager → Finance Admin → Tenant Owner
 */
export function buildThresholdEscalationChain(
  amount: number,
  thresholds?: { step2Amount?: number; step3Amount?: number }
): ApproverStep[] {
  const step2Amount = thresholds?.step2Amount ?? 50000;
  const step3Amount = thresholds?.step3Amount ?? 500000;
  const steps: ApproverStep[] = [];
  let stepNum = 0;

  // Always require Department Manager at step 0
  steps.push({ step: stepNum, userId: "role:dept_manager", role: "dept_manager", required: true, order: 0 });

  if (amount >= step2Amount) {
    stepNum++;
    steps.push({ step: stepNum, userId: "role:finance_manager", role: "finance_manager", required: true, order: 0 });
  }

  if (amount > step3Amount) {
    stepNum++;
    steps.push({ step: stepNum, userId: "role:finance_admin", role: "finance_admin", required: true, order: 0 });
    stepNum++;
    steps.push({ step: stepNum, userId: "role:tenant_owner", role: "tenant_owner", required: true, order: 0 });
  }

  return steps;
}

/**
 * Resolve the department authority for an approval step: the department's
 * manager_id on admin_departments, else employees flagged as HOD in that
 * department. Returns concrete user ids; empty when nobody can be found.
 */
async function resolveDeptApprovers(tenantSlug: string, departmentId?: string | null): Promise<string[]> {
  if (!departmentId) return [];
  try {
    const deptRows = await db.query<any>(
      `select manager_id from admin_departments where id = $1 and tenant_slug = $2 limit 1`,
      [departmentId, tenantSlug]
    );
    const managerId = deptRows.rows[0]?.manager_id;
    if (managerId) return [String(managerId)];

    const hods = await db.query<any>(
      `select id from admin_employees
       where tenant_slug = $1 and department_id = $2
         and lower(coalesce(role,'')) in ('hod','head_of_department','admin')
       order by id`,
      [tenantSlug, departmentId]
    );
    return hods.rows.map((r) => String(r.id));
  } catch (err) {
    console.error("resolveDeptApprovers failed:", err);
    return [];
  }
}

/**
 * Tenant-configured company officers (Managing Director, Chairman, …) live in
 * settings.approvals.officers as [{ title, userIds }]. Unlike dept managers —
 * who are scoped to the document's department — officers are company-wide
 * authorities. A `role:<slug>` spec where slug = normalized title resolves to
 * the officer's userIds (employee or tenant-admin ids).
 */
export interface TenantOfficer {
  title: string;
  userIds: string[];
}

export function officerSlug(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function tenantOfficers(tenantSlug: string): Promise<TenantOfficer[]> {
  try {
    const rows = await db.query<any>(
      `select settings from tenants where slug = $1`, [tenantSlug]
    );
    const officers = (rows.rows[0]?.settings as any)?.approvals?.officers;
    return Array.isArray(officers) ? officers : [];
  } catch {
    return [];
  }
}

async function resolveOfficerApprovers(tenantSlug: string, roleKey: string): Promise<string[]> {
  const officers = await tenantOfficers(tenantSlug);
  const ids: string[] = [];
  for (const o of officers) {
    if (o?.title && officerSlug(o.title) === roleKey && Array.isArray(o.userIds)) {
      ids.push(...o.userIds.map(String));
    }
  }
  return [...new Set(ids)];
}

/**
 * Expands role placeholders that depend on the document's context:
 *  - `role:dept_manager` → the submitter's department manager(s) / HODs
 *                         (department-scoped)
 *  - `role:<title>`      → tenant-configured officers (company-wide posts
 *                         like Managing Director / Chairman)
 * Built-in role placeholders (finance_manager, admin, …) stay symbolic so
 * callers holding that role keep matching by callerRoleKey — resolving them
 * to tenant_admin ids would lock out employee-side role holders.
 */
async function resolveChainApprovers(
  tenantSlug: string,
  chain: ApproverStep[],
  entityData: Record<string, any>
): Promise<ApproverStep[]> {
  const out: ApproverStep[] = [];
  for (const step of chain) {
    const spec = step.userId.startsWith("role:") ? step.userId : (step.role ? `role:${step.role}` : null);
    if (!spec) {
      out.push(step);
      continue;
    }
    const roleKey = spec.slice(5);
    const resolved = roleKey === "dept_manager"
      ? await resolveDeptApprovers(tenantSlug, entityData.departmentId)
      : await resolveOfficerApprovers(tenantSlug, roleKey);
    if (resolved.length === 0) {
      // Nobody found — keep the placeholder so role-based callers can still act.
      out.push(step);
      continue;
    }
    resolved.forEach((userId, i) => {
      out.push({ ...step, userId, required: resolved.length === 1 ? step.required : false, order: i });
    });
  }
  return out;
}

export async function getOfficers(tenantSlug: string): Promise<TenantOfficer[]> {
  return tenantOfficers(tenantSlug);
}

/** Replaces the tenant's officer list — each { title, userIds[] }. */
export async function setOfficers(
  tenantSlug: string,
  officers: TenantOfficer[]
): Promise<TenantOfficer[]> {
  const clean = (officers ?? [])
    .map((o) => ({
      title: String(o?.title ?? "").trim(),
      userIds: [...new Set((o?.userIds ?? []).map(String).map((s) => s.trim()).filter(Boolean))],
    }))
    .filter((o) => o.title.length > 0);
  await SQL`
    update tenants
    set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{approvals,officers}', ${JSON.stringify(clean)}::jsonb, true)
    where slug = ${tenantSlug}
  `;
  await notifyApprovalsConfigChanged(tenantSlug, "officers");
  return clean;
}

/**
 * Writes keys into settings.approvals (authorityMatrix, *MinAmount
 * thresholds, SLA defaults, …) and fires an audit notification — whoever
 * can weaken the control config should leave a trace admins see.
 */
export async function setApprovalSettings(
  tenantSlug: string,
  patch: Record<string, any>
): Promise<Record<string, any>> {
  const current = await tenantApprovalSettings(tenantSlug);
  const next = { ...current, ...patch };
  await SQL`
    update tenants
    set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{approvals}', ${JSON.stringify(next)}::jsonb, true)
    where slug = ${tenantSlug}
  `;
  await notifyApprovalsConfigChanged(tenantSlug, Object.keys(patch).join(", "));
  return next;
}

/** Audit event for approval-control changes — notifies tenant admins that
 *  the approval configuration itself was modified. */
async function notifyApprovalsConfigChanged(tenantSlug: string, section: string): Promise<void> {
  try {
    const { emitEvent } = await import("../notify");
    void emitEvent({
      tenantSlug,
      eventType: "approvals.config_changed",
      sourceModule: "approvals",
      sourceRecordId: `cfg_${Date.now()}`,
      payload: { section },
    }).catch((err) => console.error("approvals.config_changed emit failed:", err));
  } catch { /* notify lib must not break a settings write */ }
}

/**
 * Override-mode authorization: is `userId` allowed to co-sign an over-cap
 * action in real time? Managers, department heads, executives, and any
 * configured company officer may — the same authority set used for POS
 * discount overrides, now shared by all override-mode gated actions.
 */
export async function canOverride(tenantSlug: string, userId: string): Promise<boolean> {
  const admins = await SQL`
    select 1 from tenant_admins
    where tenant_slug = ${tenantSlug} and id::text = ${userId}
      and lower(coalesce(role,'')) in ('admin','owner','tenant_admin','superadmin','manager','finance_manager','finance_admin')
    limit 1
  ` as any[];
  if (admins.length) return true;
  const employees = await SQL`
    select 1 from admin_employees
    where tenant_slug = ${tenantSlug} and id::text = ${userId}
      and lower(coalesce(role,'')) in ('hod','head_of_department','admin','executive','manager','supervisor')
    limit 1
  ` as any[];
  if (employees.length) return true;
  const officers = await tenantOfficers(tenantSlug);
  return officers.some((o) => Array.isArray(o?.userIds) && o.userIds.map(String).includes(userId));
}

/**
 * Caller-role aliases: employee-portal roles map onto the role keys used in
 * approver chains. `hod` → dept_manager, HR roles → admin (HR can act on any
 * step, mirroring the legacy portal behavior where HR could approve).
 */
const APPROVER_ROLE_ALIASES: Record<string, string> = {
  hod: "dept_manager",
  head_of_department: "dept_manager",
  dept_manager: "dept_manager",
  hr: "admin",
  hr_admin: "admin",
  hr_manager: "admin",
  tenant_admin: "admin",
};

function normalizeApproverRole(role?: string | null): string | undefined {
  if (!role) return undefined;
  const key = role.toLowerCase();
  return APPROVER_ROLE_ALIASES[key] ?? key;
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

  // Default ladder thresholds are tenant-tunable via settings.approvals
  // (expenseStep2Amount / expenseStep3Amount for expense docs; the generic
  // step2Amount/step3Amount keys apply to everything else).
  let approverChain: ApproverStep[];
  if (rule?.approvers) {
    approverChain = rule.approvers;
  } else {
    const settings = await tenantApprovalSettings(payload.tenantSlug);
    // Delegation-of-authority matrix: when the domain has a configured band
    // for this amount, its approver list IS the chain (DoA grid). Otherwise
    // fall back to the legacy amount ladder.
    const domain = (payload.entityData.domain ?? ENTITY_DOMAINS[payload.entityType]) as GateDomain | undefined;
    const matrixChain = chainFromBand(
      matrixBandFor((settings as any)?.authorityMatrix ?? {}, domain, Number(amount))
    );
    if (matrixChain) {
      approverChain = matrixChain;
    } else {
      const isExpense = payload.entityType === "expense" || payload.entityType === "employee_expense";
      approverChain = buildThresholdEscalationChain(Number(amount), {
        step2Amount: isExpense ? settings.expenseStep2Amount : settings.step2Amount,
        step3Amount: isExpense ? settings.expenseStep3Amount : settings.step3Amount,
      });
      // Gated actions without a department context (period close, invoice
      // delete, asset disposal, …) can't resolve a dept_manager step —
      // substitute finance-manager authority as the sensible default floor.
      if (payload.entityType === "gated_action" && !payload.entityData.departmentId) {
        approverChain = approverChain.map((s) =>
          s.userId === "role:dept_manager"
            ? { ...s, userId: "role:finance_manager", role: "finance_manager" }
            : s
        );
      }
    }
  }

  // Department-scoped placeholders (role:dept_manager) resolve against the
  // submitter's department into concrete approver ids.
  approverChain = await resolveChainApprovers(payload.tenantSlug, approverChain, payload.entityData);

  // Risk escalation: callers flag documents that must reach a company officer
  // regardless of amount (e.g. paying a vendor whose bank details changed
  // recently). A title may be supplied ("managing_director"); the first
  // configured officer post is the fallback, then role:admin.
  if (payload.entityData.forceOfficerApproval) {
    const wanted = typeof payload.entityData.forceOfficerApproval === "string"
      ? payload.entityData.forceOfficerApproval : undefined;
    const officers = await tenantOfficers(payload.tenantSlug);
    const post = wanted
      ? officers.find((o) => officerSlug(o.title) === officerSlug(wanted))
      : officers[0];
    const holders = (post?.userIds ?? []).map(String).filter(Boolean);
    const stepNo = approverChain.reduce((m, s) => Math.max(m, s.step), -1) + 1;
    if (holders.length) {
      holders.forEach((uid, i) =>
        approverChain.push({ step: stepNo, userId: uid, required: holders.length === 1, order: i }));
    } else {
      approverChain.push({ step: stepNo, userId: "role:admin", required: true, order: 0 });
    }
  }
  
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
  decision: "approved" | "rejected" | "escalated" | "clarification_needed";
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
  const normalizedRole = normalizeApproverRole(payload.userRole);
  const callerRoleKey = normalizedRole ? `role:${normalizedRole}` : null;
  const isAdmin = ["admin", "tenant_admin", "superadmin"].includes(normalizedRole || "");
  let isAuthorized = isAdmin || currentStepApprovers.some(
    (step: ApproverStep) => step.userId === payload.userId || step.userId === callerRoleKey
  );

  // Delegation: an out-of-office approver's delegate may act on their step.
  let delegatedFor: string | undefined;
  if (!isAuthorized) {
    delegatedFor = await findActiveDelegation({
      tenantSlug: current.tenant_slug,
      entityType: current.entity_type,
      approverUserIds: currentStepApprovers.map((s: ApproverStep) => s.userId),
      delegateId: payload.userId,
    });
    isAuthorized = !!delegatedFor;
  }

  if (!isAuthorized) {
    throw new Error("User not authorized to approve at current step");
  }

  // Segregation of duties: the requester cannot decide their own document.
  // Tenant admins stay break-glass — they can act on any step by design so
  // workflows cannot stall.
  if (!isAdmin && payload.userId === current.requested_by) {
    throw new Error("The requester cannot approve their own document");
  }

  // Add decision
  const newDecision: ApprovalDecision = {
    step: currentStep,
    userId: payload.userId,
    decision: payload.decision,
    comments: payload.comments,
    timestamp: new Date().toISOString()
  };
  if (delegatedFor) newDecision.delegatedFor = delegatedFor;

  decisions.push(newDecision);

  // Determine new status and step
  let newStatus = current.status;
  let newStep = currentStep;

  if (payload.decision === "rejected") {
    newStatus = "rejected";
  } else if (payload.decision === "clarification_needed") {
    // Chain stays pending at the same step — the document itself is flagged
    // for clarification via applyApprovalOutcome below.
    newStatus = current.status;
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
  // one can. Clarification requests also update the document status but do
  // not move the chain.
  const isTerminal = (newStatus === "approved" || newStatus === "rejected") && newStatus !== current.status;
  if (isTerminal || payload.decision === "clarification_needed") {
    await applyApprovalOutcome(
      updated.tenant_slug,
      updated.entity_type,
      updated.entity_id,
      payload.decision === "clarification_needed" ? "clarify" : (newStatus as "approved" | "rejected"),
      { decidedBy: payload.userId, comments: payload.comments },
      updated.metadata
    );
  }
  if (isTerminal) {
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

  // Chain advanced to a new step (or escalated) — notify the approvers now on
  // deck so multi-step workflows actually move.
  if ((newStatus === "pending" || newStatus === "escalated") && newStep !== currentStep) {
    const nextSpecs = (approverChain as ApproverStep[])
      .filter((s) => s.step === newStep)
      .map((s) => s.userId.startsWith("role:")
        ? { kind: "role" as const, value: s.userId.slice(5) }
        : { kind: "user" as const, value: s.userId });
    if (nextSpecs.length > 0) {
      void emitEvent({
        tenantSlug: updated.tenant_slug,
        eventType: "approval.requested",
        sourceModule: "approvals",
        sourceRecordId: updated.id,
        actorId: payload.userId,
        explicitSpecs: nextSpecs,
        payload: {
          approvalId: updated.id,
          entityType: updated.entity_type,
          entityRef: updated.metadata?.invoiceNumber ?? updated.metadata?.billNumber
            ?? updated.metadata?.journalNumber ?? updated.metadata?.reference ?? updated.entity_id,
          amount: updated.metadata?.amount ?? updated.metadata?.total ?? 0,
          requestedBy: updated.requested_by,
          requestedByName: updated.metadata?.requestedByName,
        },
      });
    }
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
  expense: "expenseMinAmount",
  employee_expense: "employeeExpenseMinAmount",
  payroll_run: "payrollMinAmount",
  employee_salary_change: "salaryChangeMinAmount",
  credit_limit_change: "creditLimitMinAmount",
  stock_adjustment: "stockAdjustmentMinAmount",
  bank_guarantee: "bankGuaranteeMinAmount",
  invoice_discounting: "invoiceDiscountingMinAmount",
  pricing_change: "pricingChangeMinAmount",
  gated_action: "gatedActionMinAmount",
};

/**
 * Entity types that gate unconditionally — authority/policy decisions rather
 * than volume documents. For these, the configured *MinAmount setting acts as
 * an opt-out floor instead of an opt-in threshold: documents below it skip the
 * chain (e.g. trivial stock adjustments), everything else routes for review.
 * bill/payment keep the volume-document semantics (undefined setting = ungated).
 */
const ALWAYS_GATED: ReadonlySet<ApprovalEntityType> = new Set([
  "employee_expense",
  "payroll_run",
  "employee_salary_change",
  "credit_limit_change",
  "stock_adjustment",
  "bank_guarantee",
  "invoice_discounting",
  "pricing_change",
]);

async function tenantApprovalSettings(tenantSlug: string): Promise<Record<string, any>> {
  const rows = await db.query<any>(
    `select settings from tenants where slug = $1`,
    [tenantSlug]
  );
  return (rows.rows[0]?.settings as any)?.approvals ?? {};
}

// ---------------------------------------------------------------------------
// Delegation-of-authority matrix — settings.approvals.authorityMatrix
// ---------------------------------------------------------------------------

/**
 * One band of the authority matrix. Bands are ordered; the first band whose
 * `upTo` covers the amount wins (null = unlimited). `approvers` entries are
 * step specs in order — a string entry is one step, a string[] entry is
 * parallel approvers at one step. Spec tokens:
 *   "dept_manager"        → role:dept_manager (document's department)
 *   "officer:<title>"     → role:<slug-of-title> (company officer post)
 *   "role:<key>"          → symbolic role placeholder
 *   "user:<id>"           → concrete user id
 * `mode` overrides the enforcement mode for this band ("block" | "review").
 * A band with approvers: [] means auto-approved — no chain at that level.
 */
export interface MatrixBand {
  upTo: number | null;
  approvers?: (string | string[])[];
  mode?: "block" | "review";
}

export type AuthorityMatrix = Partial<Record<GateDomain, MatrixBand[]>>;

export async function tenantAuthorityMatrix(tenantSlug: string): Promise<AuthorityMatrix> {
  const settings = await tenantApprovalSettings(tenantSlug);
  const matrix = (settings as any)?.authorityMatrix;
  return matrix && typeof matrix === "object" ? matrix : {};
}

/** The band covering `amount` for `domain`, or null when the domain has no
 *  configured matrix. */
export function matrixBandFor(
  matrix: AuthorityMatrix,
  domain: GateDomain | undefined,
  amount: number
): MatrixBand | null {
  if (!domain) return null;
  const bands = matrix[domain];
  if (!Array.isArray(bands) || bands.length === 0) return null;
  return bands.find((b) => b && (b.upTo === null || b.upTo === undefined || amount <= Number(b.upTo))) ?? null;
}

function specToApprover(spec: string, step: number, order: number, required: boolean): ApproverStep {
  const s = spec.trim();
  if (s.startsWith("user:")) return { step, userId: s.slice(5), required, order };
  if (s.startsWith("officer:")) return { step, userId: `role:${officerSlug(s.slice(8))}`, required, order };
  if (s.startsWith("role:")) return { step, userId: s, required, order };
  return { step, userId: `role:${s}`, required, order };
}

/** Builds an approver chain from the domain's matrix band. Returns null when
 *  the band auto-approves (empty approvers) — caller decides fallback when
 *  no matrix exists for the domain. */
export function chainFromBand(band: MatrixBand | null): ApproverStep[] | null {
  if (!band) return null;
  const chain: ApproverStep[] = [];
  (band.approvers ?? []).forEach((entry, step) => {
    const specs = Array.isArray(entry) ? entry : [entry];
    specs.forEach((spec, order) => {
      chain.push(specToApprover(spec, step, order, specs.length === 1));
    });
  });
  return chain;
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
  const amount = Number(entityData.amount ?? entityData.total ?? 0);
  // Delegation-of-authority matrix owns the decision for its domain: a band
  // with approvers means gate, approvers:[] means auto-approve.
  const domain = (entityData.domain ?? ENTITY_DOMAINS[entityType]) as GateDomain | undefined;
  const band = matrixBandFor((settings as any)?.authorityMatrix ?? {}, domain, amount);
  if (band) return (band.approvers ?? []).length > 0;
  // Opt-in default ladder for finance expenses: when set, every expense is
  // routed through dept manager → finance → executive even with no rules.
  if (entityType === "expense" && settings.expenseDefaultChain) return true;
  const min = settings[ENTITY_THRESHOLD_KEYS[entityType]];
  if (ALWAYS_GATED.has(entityType)) {
    // Always-gated types: a configured floor opts small documents out
    // (e.g. stockAdjustmentMinAmount lets trivial adjustments through).
    if (min === undefined || min === null) return true;
    return amount >= Number(min);
  }
  if (min === undefined || min === null) return false;
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
 * processApprovalDecision when the chain reaches approved/rejected, or when a
 * clarification request should flip the document's visible status.
 */
async function applyApprovalOutcome(
  tenantSlug: string,
  entityType: string,
  entityId: string,
  outcome: "approved" | "rejected" | "clarify",
  ctx?: { decidedBy?: string; comments?: string },
  metadata?: Record<string, unknown>
): Promise<void> {
  // Clarification is only meaningful for expense documents — other entity
  // types would otherwise map it onto their rejected branch.
  if (outcome === "clarify" && entityType !== "expense" && entityType !== "employee_expense") return;
  try {
    switch (entityType) {
      case "expense":
        await applyExpenseOutcome(tenantSlug, entityId, outcome, ctx);
        break;
      case "employee_expense":
        await applyEmployeeExpenseOutcome(tenantSlug, entityId, outcome, ctx);
        break;
      case "bill":
        await applyBillOutcome(tenantSlug, entityId, outcome, ctx);
        break;
      case "payment":
        await applyVendorPaymentOutcome(tenantSlug, entityId, outcome, ctx);
        break;
      case "payroll_run":
        await applyPayrollRunOutcome(tenantSlug, entityId, outcome, ctx);
        break;
      case "employee_salary_change":
        await applySalaryChangeOutcome(tenantSlug, entityId, outcome, ctx);
        break;
      case "credit_limit_change":
        await applyCreditLimitOutcome(tenantSlug, entityId, outcome, ctx);
        break;
      case "stock_adjustment":
        await applyStockAdjustmentOutcome(tenantSlug, entityId, outcome, metadata, ctx);
        break;
      case "bank_guarantee":
      case "invoice_discounting":
        await applyTreasuryOutcome(tenantSlug, entityType, entityId, outcome, ctx);
        break;
      case "pricing_change":
        await applyPricingChangeOutcome(tenantSlug, entityId, outcome, metadata, ctx);
        break;
      case "gated_action":
        await applyGatedActionOutcome(tenantSlug, entityId, outcome, metadata, ctx);
        break;
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
    }
  } catch (err) {
    console.error(`applyApprovalOutcome ${entityType} ${entityId}:`, err);
  }
}

/** Best-effort display name for a user id across employees/admins. */
async function resolveUserName(tenantSlug: string, userId?: string | null): Promise<string> {
  if (!userId) return "System";
  try {
    const map = await resolveRequesterNames(tenantSlug, [String(userId).toLowerCase()]);
    return map.get(userId) ?? map.get(String(userId).toLowerCase()) ?? userId;
  } catch {
    return userId;
  }
}

/**
 * Finance `expenses` table outcome: sync approval_status, record the decision
 * in expense_approvals + expense_audit_logs (keeps the expenses UI history
 * working), and post the GL accrual on final approval — Dr category expense
 * account / Cr payable. Idempotent via the journal's referenceId.
 */
async function applyExpenseOutcome(
  tenantSlug: string,
  expenseId: string,
  outcome: "approved" | "rejected" | "clarify",
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  const newStatus = outcome === "approved" ? "APPROVED" : outcome === "rejected" ? "REJECTED" : "CLARIFY_NEEDED";
  const rows = await db.query<any>(
    `update expenses set approval_status = $1, updated_at = now()
     where id = $2 and tenant_slug = $3 returning *`,
    [newStatus, expenseId, tenantSlug]
  );
  const expense = rows.rows[0];
  if (!expense) return;

  const approverName = await resolveUserName(tenantSlug, ctx?.decidedBy);
  const action = outcome === "approved" ? "APPROVED" : outcome === "rejected" ? "REJECTED" : "CLARIFY_NEEDED";

  await db.query(
    `insert into expense_approvals (id, expense_id, approver_role, approver_id, approver_name, action, reason, amount_threshold)
     values ($1, $2, 'FINANCE', $3, $4, $5, $6, $7)`,
    [randomUUID(), expenseId, ctx?.decidedBy ?? "system", approverName, action, ctx?.comments ?? null, Number(expense.amount) || 0]
  );
  await db.query(
    `insert into expense_audit_logs (id, expense_id, action, user_id, details)
     values ($1, $2, $3, $4, $5)`,
    [randomUUID(), expenseId, `APPROVAL_${action}`, ctx?.decidedBy ?? "system",
     JSON.stringify({ via: "approval_workflow", reason: ctx?.comments ?? null })]
  );

  if (outcome !== "approved") return;
  const amount = Number(expense.total_amount ?? expense.amount) || 0;
  if (amount <= 0 || expense.journal_entry_id) return;

  try {
    const { postGLEntry, GL_ACCOUNTS } = await import("./gl");
    const catRows = await db.query<any>(
      `select account_id from expense_categories where id = $1 limit 1`,
      [expense.category_id]
    );
    const debitAccount = expense.gl_account_id || catRows.rows[0]?.account_id || GL_ACCOUNTS.GENERAL_EXPENSE;
    // Vendor/cash expenses accrue to AP; reimbursements accrue to the employee
    // payable so settlement follows the payroll path.
    const creditAccount = expense.type === "reimbursement" ? GL_ACCOUNTS.PAYROLL_PAYABLE : GL_ACCOUNTS.ACCOUNTS_PAYABLE;
    const je = await postGLEntry({
      tenantSlug,
      entryDate: new Date(),
      journalType: "SYSTEM",
      referenceType: "expense",
      referenceId: expenseId,
      status: "POSTED",
      description: `Expense approved — ${expense.description ?? expenseId}`,
      lines: [
        { accountCode: String(debitAccount), debitAmount: amount, description: `Expense ${expenseId}` },
        { accountCode: creditAccount, creditAmount: amount, description: `Accrued payable for expense ${expenseId}` },
      ],
      createdBy: ctx?.decidedBy,
    });
    const jeId = (je as any)?.id ?? null;
    if (jeId) {
      await db.query(`update expenses set journal_entry_id = $1 where id = $2`, [jeId, expenseId]);
    }
  } catch (err) {
    console.error("Expense approval GL posting failed:", err);
  }

  // Approved expense is now a payable awaiting settlement — alert finance.
  void emitEvent({
    tenantSlug,
    eventType: "expense.settlement_due",
    sourceModule: "approvals",
    sourceRecordId: expenseId,
    actorId: ctx?.decidedBy ?? "system",
    explicitSpecs: [
      { kind: "role", value: "finance_manager" },
      { kind: "role", value: "admin" },
    ],
    payload: {
      expenseId,
      entityRef: expense.description ?? expenseId,
      amount,
      type: expense.type,
    },
  });
}

/**
 * Employee portal expense outcome: sync admin_employee_expenses status and
 * approver fields, and post the liability entry on approval — identical to
 * the legacy portal PATCH behavior.
 */
async function applyEmployeeExpenseOutcome(
  tenantSlug: string,
  expenseId: string,
  outcome: "approved" | "rejected" | "clarify",
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  const rows = await db.query<any>(
    `select * from admin_employee_expenses where id = $1 and tenant_slug = $2 limit 1`,
    [expenseId, tenantSlug]
  );
  const expense = rows.rows[0];
  if (!expense) return;

  const newStatus = outcome === "approved" ? "approved" : outcome === "rejected" ? "rejected" : "pending";
  const approverName = await resolveUserName(tenantSlug, ctx?.decidedBy);

  // GL: approval books the liability (Dr expense / Cr employee payable).
  // Idempotent via journal_entry_id on the row.
  let journalEntryId: string | null = expense.journal_entry_id ?? null;
  if (outcome === "approved" && !journalEntryId) {
    try {
      const amount = Number(expense.amount);
      if (amount > 0) {
        const { postGLEntry, GL_ACCOUNTS } = await import("./gl");
        const je = await postGLEntry({
          tenantSlug,
          entryDate: new Date(),
          journalType: "SYSTEM",
          referenceType: "employee_expense",
          referenceId: expenseId,
          status: "POSTED",
          description: `Employee expense — ${expense.category ?? "general"}`,
          lines: [
            { accountCode: GL_ACCOUNTS.GENERAL_EXPENSE, debitAmount: amount, description: `Expense ${expenseId}` },
            { accountCode: GL_ACCOUNTS.PAYROLL_PAYABLE, creditAmount: amount, description: `Payable to employee ${expense.employee_id}` },
          ],
          createdBy: ctx?.decidedBy,
        });
        journalEntryId = (je as any)?.id ?? null;
      }
    } catch (err) {
      console.error("Employee expense GL posting failed:", err);
    }
  }

  await db.query(`alter table admin_employee_expenses add column if not exists journal_entry_id text`);
  await db.query(
    `update admin_employee_expenses
     set status = $1,
         approver_id = $2,
         approver_name = $3,
         approver_comment = coalesce($4, approver_comment),
         approved_at = case when $1 = 'pending' then approved_at else coalesce(approved_at, now()) end,
         journal_entry_id = coalesce($5, journal_entry_id),
         updated_at = now()
     where id = $6 and tenant_slug = $7`,
    [newStatus, ctx?.decidedBy ?? null, approverName, ctx?.comments ?? null, journalEntryId, expenseId, tenantSlug]
  );
}

/**
 * Bill outcome: a gated bill waits at 'pending_approval' with no GL or tax
 * ledger effects. Approval opens it and posts the AP journal + tax ledger
 * entries deferred at create; rejection voids it.
 */
async function applyBillOutcome(
  tenantSlug: string,
  billId: string,
  outcome: "approved" | "rejected" | "clarify",
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  const rows = await db.query<any>(
    `update bills set status = $1, updated_at = now()
     where id = $2 and tenant_slug = $3 and status = 'pending_approval'
     returning *`,
    [outcome === "approved" ? "open" : "rejected", billId, tenantSlug]
  );
  const bill = rows.rows[0];
  if (!bill || outcome !== "approved") return;

  try {
    const { getBill } = await import("./bills");
    const { createBillJournalEntry } = await import("./accounting");
    const normalized = await getBill(billId, tenantSlug);
    if (normalized && !bill.journal_entry_id) {
      await createBillJournalEntry(billId, normalized);
    }
  } catch (err) {
    console.error("Bill approval GL posting failed:", err);
  }
  try {
    const { recordBillTaxes } = await import("./localization");
    await recordBillTaxes({
      tenantSlug,
      billId,
      billNumber: bill.bill_number,
      vendorId: bill.vendor_id,
      date: bill.bill_date,
      subtotal: Number(bill.subtotal) || 0,
      vatAmount: Number(bill.taxes) || 0,
      whtAmount: Number(bill.wht_amount) || 0,
      whtRate: bill.wht_rate ?? undefined,
    });
  } catch (err) {
    console.error("Bill approval tax ledger failed:", err);
  }
}

/**
 * Vendor payment outcome: a gated payment waits at 'pending_approval' — its
 * bill applications are recorded but balances and the journal are deferred.
 * Approval posts the payment JE, applies the balance deltas, and marks the
 * payment posted; rejection voids it.
 */
async function applyVendorPaymentOutcome(
  tenantSlug: string,
  paymentId: string,
  outcome: "approved" | "rejected" | "clarify",
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  const rows = await db.query<any>(
    `update vendor_payments set status = $1
     where id = $2 and tenant_slug = $3 and status = 'pending_approval'
     returning *`,
    [outcome === "approved" ? "posted" : "rejected", paymentId, tenantSlug]
  );
  const payment = rows.rows[0];
  if (!payment || outcome !== "approved") return;

  const apps = (await db.query<any>(
    `select bill_id, applied_amount from vendor_payment_applications where payment_id = $1`,
    [paymentId]
  )).rows;
  for (const app of apps) {
    await db.query(
      `update bills
       set balance_due = balance_due - $1,
           status = case
             when balance_due - $1 <= 0.005 then 'paid'
             when balance_due - $1 < total then 'partially_paid'
             else status
           end,
           updated_at = now()
       where id = $2 and tenant_slug = $3`,
      [Number(app.applied_amount), app.bill_id, tenantSlug]
    );
    try {
      const { markBillSchedulePaid } = await import("./credit-control");
      await markBillSchedulePaid(tenantSlug, String(app.bill_id), Number(app.applied_amount));
    } catch { /* schedule is advisory */ }
  }

  try {
    const { getVendorPayment } = await import("./vendor-payments");
    const { createPaymentJournalEntry } = await import("./accounting");
    const normalized = await getVendorPayment(paymentId, tenantSlug);
    if (normalized && !payment.journal_entry_id) {
      await createPaymentJournalEntry(paymentId, normalized);
    }
  } catch (err) {
    console.error("Vendor payment approval GL posting failed:", err);
  }
}

/**
 * Payroll run outcome: approval runs the same accrual posting the legacy
 * PATCH action performs (atomic draft→processing claim + JE). Rejection
 * voids the run so the period's unique index frees for a re-run, and
 * releases the one-off adjustments it consumed — mirrors the cancel path.
 */
async function applyPayrollRunOutcome(
  tenantSlug: string,
  runId: string,
  outcome: "approved" | "rejected" | "clarify",
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  if (outcome === "rejected") {
    const run = (await db.query<any>(
      `update admin_payroll_runs set status = 'cancelled'
       where id = $1 and tenant_slug = $2 and status = 'draft' returning period`,
      [runId, tenantSlug]
    )).rows[0];
    if (run?.period) {
      await db.query(
        `update admin_payroll_adjustments set status = 'pending', applied_at = null
         where tenant_slug = $1 and effective_period = $2 and status = 'applied'`,
        [tenantSlug, run.period]
      );
    }
    return;
  }
  const { postPayrollAccrual } = await import("../hr/payroll-post");
  const approvedBy = await resolveUserName(tenantSlug, ctx?.decidedBy);
  await postPayrollAccrual({
    tenantSlug,
    runId,
    approvedBy,
    userId: ctx?.decidedBy,
  });
}

/** Salary change outcome: applies or clears the staged pending_salary. */
async function applySalaryChangeOutcome(
  tenantSlug: string,
  employeeId: string,
  outcome: "approved" | "rejected" | "clarify",
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  if (outcome === "approved") {
    await db.query(
      `update admin_employees
       set salary = coalesce(pending_salary, salary), pending_salary = null, updated_at = now()
       where id = $1 and tenant_slug = $2`,
      [employeeId, tenantSlug]
    );
  } else {
    await db.query(
      `update admin_employees set pending_salary = null, updated_at = now()
       where id = $1 and tenant_slug = $2`,
      [employeeId, tenantSlug]
    );
  }
}

/** Credit limit outcome: applies or clears the staged pending_credit_limit. */
async function applyCreditLimitOutcome(
  tenantSlug: string,
  customerId: string,
  outcome: "approved" | "rejected" | "clarify",
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  if (outcome === "approved") {
    await db.query(
      `update finance_customers
       set credit_limit = pending_credit_limit, pending_credit_limit = null, updated_at = now()
       where id = $1 and tenant_slug = $2`,
      [customerId, tenantSlug]
    );
  } else {
    await db.query(
      `update finance_customers set pending_credit_limit = null, updated_at = now()
       where id = $1 and tenant_slug = $2`,
      [customerId, tenantSlug]
    );
  }
}

/**
 * Stock adjustment outcome: the movement was never recorded — the full
 * payload lives in approval metadata and is replayed on approval.
 */
async function applyStockAdjustmentOutcome(
  tenantSlug: string,
  _entityId: string,
  outcome: "approved" | "rejected" | "clarify",
  metadata?: Record<string, unknown>,
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  if (outcome !== "approved") return;
  const movement = (metadata as any)?.movement;
  if (!movement?.productSku || !movement?.movementType) return;
  try {
    const { recordStockMovement } = await import("../inventory/stock-movements");
    await recordStockMovement(tenantSlug, movement);
  } catch (err) {
    console.error("Stock adjustment apply failed:", err);
  }
}

/**
 * Treasury outcome: gated guarantees/discounting wait at 'pending_approval'
 * with no journal posted. Approval posts the deferred JE (margin deposit for
 * guarantees, loan disbursement for discounting) and opens the facility.
 */
async function applyTreasuryOutcome(
  tenantSlug: string,
  entityType: string,
  entityId: string,
  outcome: "approved" | "rejected" | "clarify",
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  const isGuarantee = entityType === "bank_guarantee";
  const table = isGuarantee ? "bank_guarantees" : "invoice_discountings";
  const openStatus = isGuarantee ? "open" : "sanctioned";
  const dateCol = isGuarantee ? "start_date" : "disbursement_date";
  const rows = await db.query<any>(
    `update ${table} set status = $1
     where id = $2 and tenant_slug = $3 and status = 'pending_approval'
     returning *, ${dateCol}::text as entry_date_text`,
    [outcome === "approved" ? openStatus : "rejected", entityId, tenantSlug]
  );
  const row = rows.rows[0];
  if (!row || outcome !== "approved" || row.journal_entry_id) return;

  try {
    const { postGLEntry, GL_ACCOUNTS } = await import("./gl");
    if (isGuarantee) {
      const margin = Number(row.margin_amount) || 0;
      if (row.direction === "issued" && margin > 0) {
        const je = await postGLEntry({
          tenantSlug,
          entryDate: row.entry_date_text,
          journalType: "SYSTEM",
          referenceType: "bank_guarantee",
          referenceId: row.beneficiary,
          status: "POSTED",
          description: `Bank guarantee margin — ${row.bank} for ${row.beneficiary}`,
          createdBy: ctx?.decidedBy,
          lines: [
            { accountCode: "1560", debitAmount: margin, description: "Guarantee margin deposit" },
            { accountCode: GL_ACCOUNTS.BANK, creditAmount: margin, description: "Margin paid" },
          ],
        });
        await db.query(`update bank_guarantees set journal_entry_id = $1 where id = $2`, [(je as any)?.id ?? null, entityId]);
      }
    } else {
      const [inv] = (await db.query<any>(
        `select invoice_number from finance_invoices where id = $1 and tenant_slug = $2`,
        [row.invoice_id, tenantSlug]
      )).rows;
      const loanAmount = Number(row.loan_amount) || 0;
      if (loanAmount > 0) {
        const je = await postGLEntry({
          tenantSlug,
          entryDate: row.entry_date_text,
          journalType: "SYSTEM",
          referenceType: "invoice_discounting",
          referenceId: row.invoice_id,
          status: "POSTED",
          description: `Invoice discounting ${inv?.invoice_number ?? row.invoice_id} — ${row.bank}`,
          createdBy: ctx?.decidedBy,
          lines: [
            { accountCode: GL_ACCOUNTS.BANK, debitAmount: loanAmount, description: "Loan disbursement" },
            { accountCode: "2300", creditAmount: loanAmount, description: "Short-term loan payable" },
          ],
        });
        await db.query(`update invoice_discountings set journal_entry_id = $1 where id = $2`, [(je as any)?.id ?? null, entityId]);
      }
    }
  } catch (err) {
    console.error(`Treasury approval JE posting failed (${entityType} ${entityId}):`, err);
  }
}

/**
 * Pricing change outcome: the upsert never ran — the action + payload live in
 * approval metadata and are replayed on approval.
 */
async function applyPricingChangeOutcome(
  tenantSlug: string,
  _entityId: string,
  outcome: "approved" | "rejected" | "clarify",
  metadata?: Record<string, unknown>,
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  if (outcome !== "approved") return;
  const change = (metadata as any)?.change as { action?: string; input?: any } | undefined;
  if (!change?.action || !change.input) return;
  try {
    const pricing = await import("./pricing");
    if (change.action === "upsert-rule") await pricing.upsertPricingRule(change.input);
    else if (change.action === "upsert-scheme") await pricing.upsertPromotionalScheme(change.input);
    else if (change.action === "upsert-coupon") await pricing.upsertCouponCode(change.input);
  } catch (err) {
    console.error("Pricing change apply failed:", err);
  }
}

/**
 * Gated-action outcome: the deferred mutation lives in metadata
 * ({ action, payload }) and replays through the gated-action registry on
 * approval. Post-hoc (review-mode) rows work the other way — the action
 * already ran; approval merely marks it reviewed, while rejection invokes
 * the action's reverse handler when one is registered.
 */
async function applyGatedActionOutcome(
  tenantSlug: string,
  entityId: string,
  outcome: "approved" | "rejected" | "clarify",
  metadata?: Record<string, unknown>,
  ctx?: { decidedBy?: string; comments?: string }
): Promise<void> {
  const m = metadata as any;
  const actionName = m?.action as string | undefined;
  if (!actionName) return;
  try {
    const { getGatedAction } = await import("./gated-actions");
    const def = getGatedAction(actionName);
    if (!def) {
      console.error(`Gated action "${actionName}" is not registered (approval entity ${entityId})`);
      return;
    }
    const actionCtx = { requestedBy: m.requestedBy, decidedBy: ctx?.decidedBy };
    if (m.postHoc) {
      // Review mode: the effect already applied at request time. Approval
      // acknowledges the review; rejection reverses the effect when the
      // action defines a reverse handler.
      if (outcome === "rejected" && def.reverse) {
        await def.reverse(tenantSlug, m.payload, actionCtx);
      }
      return;
    }
    if (outcome === "approved") {
      await def.run(tenantSlug, m.payload, actionCtx);
    } else if (outcome === "rejected" && def.rejected) {
      await def.rejected(tenantSlug, m.payload, actionCtx);
    }
  } catch (err) {
    // Matches the other appliers: the approval row already committed, so a
    // replay failure is logged rather than thrown back at the decider.
    console.error(`Gated action "${actionName}" outcome failed (${entityId}):`, err);
  }
}

/**
 * Re-enters a document into its approval chain after a clarification
 * (CLARIFY_NEEDED) or a fresh submission: resets the approval to pending at
 * step 0 and notifies the first approvers again. Returns the reset approval,
 * or null when no workflow row exists for the document.
 */
export async function resetApprovalForResubmission(
  tenantSlug: string,
  entityType: ApprovalEntityType,
  entityId: string
): Promise<Approval | null> {
  await ensureApprovalTables();
  const [record] = (await SQL`
    update approvals
    set status = 'pending', current_step = 0, updated_at = now()
    where tenant_slug = ${tenantSlug} and entity_type = ${entityType} and entity_id = ${entityId}
      and status in ('pending', 'escalated')
    returning *
  `) as any[];
  if (!record) return null;

  const chain = (record.approver_chain ?? []) as ApproverStep[];
  const specs = chain
    .filter((s) => s.step === 0)
    .map((s) => s.userId.startsWith("role:")
      ? { kind: "role" as const, value: s.userId.slice(5) }
      : { kind: "user" as const, value: s.userId });
  if (specs.length > 0) {
    void emitEvent({
      tenantSlug,
      eventType: "approval.requested",
      sourceModule: "approvals",
      sourceRecordId: record.id,
      actorId: record.requested_by,
      explicitSpecs: specs,
      payload: {
        approvalId: record.id,
        entityType,
        entityRef: record.metadata?.reference ?? entityId,
        amount: record.metadata?.amount ?? record.metadata?.total ?? 0,
        requestedBy: record.requested_by,
        resubmission: true,
      },
    });
  }

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
    updatedAt: record.updated_at,
  };
}

/** Look up the active approval workflow row for a document, if any. */
export async function getApprovalForEntity(
  tenantSlug: string,
  entityType: ApprovalEntityType,
  entityId: string
): Promise<Approval | null> {
  await ensureApprovalTables();
  const [record] = (await SQL`
    select * from approvals
    where tenant_slug = ${tenantSlug} and entity_type = ${entityType} and entity_id = ${entityId}
    order by created_at desc limit 1
  `) as any[];
  if (!record) return null;
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
    updatedAt: record.updated_at,
  };
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
  const normalizedRole = normalizeApproverRole(role);
  const roleKey = normalizedRole ? `role:${normalizedRole}` : null;
  const seesAll = ["admin", "tenant_admin", "superadmin"].includes(normalizedRole || "");

  const records = (await sql`
    select * from approvals
    where tenant_slug = ${tenantSlug}
    and status in ('pending', 'escalated')
    and (
      ${seesAll}
      or approver_chain @> ${JSON.stringify([{ userId }])}::jsonb
      or exists (
        select 1 from jsonb_array_elements(approver_chain) el
        where (el->>'step')::int = approvals.current_step
          and (
            el->>'userId' = ${userId}
            or (${roleKey}::text is not null and el->>'userId' = ${roleKey})
            or exists (
              select 1 from approval_delegates d
              where d.tenant_slug = approvals.tenant_slug
                and d.delegator_id = el->>'userId'
                and d.delegate_id = ${userId}
                and d.active
                and now() >= d.valid_from
                and (d.valid_to is null or now() <= d.valid_to)
                and (d.entity_type is null or d.entity_type = approvals.entity_type)
            )
          )
      )
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

// ---------------------------------------------------------------------------
// Delegation (out-of-office)
// ---------------------------------------------------------------------------

export interface ApprovalDelegate {
  id: string;
  tenantSlug: string;
  delegatorId: string;
  delegateId: string;
  entityType: string | null;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  note: string | null;
  createdAt: string;
}

function mapDelegate(row: any): ApprovalDelegate {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    delegatorId: row.delegator_id,
    delegateId: row.delegate_id,
    entityType: row.entity_type ?? null,
    validFrom: row.valid_from,
    validTo: row.valid_to ?? null,
    active: row.active,
    note: row.note ?? null,
    createdAt: row.created_at,
  };
}

export async function createDelegate(payload: {
  tenantSlug: string;
  delegatorId: string;
  delegateId: string;
  entityType?: string;
  validFrom?: string;
  validTo?: string;
  note?: string;
}): Promise<ApprovalDelegate> {
  await ensureApprovalTables();
  if (payload.delegatorId === payload.delegateId) {
    throw new Error("Cannot delegate approval authority to yourself");
  }
  const [row] = (await SQL`
    insert into approval_delegates (tenant_slug, delegator_id, delegate_id, entity_type, valid_from, valid_to, note)
    values (
      ${payload.tenantSlug}, ${payload.delegatorId}, ${payload.delegateId},
      ${payload.entityType ?? null},
      ${payload.validFrom ? new Date(payload.validFrom) : new Date()},
      ${payload.validTo ? new Date(payload.validTo) : null},
      ${payload.note ?? null}
    ) returning *
  `) as any[];
  return mapDelegate(row);
}

export async function listDelegates(
  tenantSlug: string,
  filter?: { delegatorId?: string; delegateId?: string }
): Promise<ApprovalDelegate[]> {
  await ensureApprovalTables();
  const rows = (await SQL`
    select * from approval_delegates
    where tenant_slug = ${tenantSlug}
      and (${filter?.delegatorId ?? null}::text is null or delegator_id = ${filter?.delegatorId ?? null})
      and (${filter?.delegateId ?? null}::text is null or delegate_id = ${filter?.delegateId ?? null})
    order by created_at desc
  `) as any[];
  return rows.map(mapDelegate);
}

/** Deactivates a grant (kept for audit) — returns false if not found. */
export async function revokeDelegate(tenantSlug: string, id: string): Promise<boolean> {
  await ensureApprovalTables();
  const rows = (await SQL`
    update approval_delegates set active = false, updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning id
  `) as any[];
  return rows.length > 0;
}

/**
 * Returns the delegator whose authority `delegateId` may exercise for one of
 * `approverUserIds` on this entity type — or undefined when no valid grant
 * exists. Role placeholders ("role:*") cannot be delegated.
 */
async function findActiveDelegation(payload: {
  tenantSlug: string;
  entityType: string;
  approverUserIds: string[];
  delegateId: string;
}): Promise<string | undefined> {
  const concreteIds = payload.approverUserIds.filter(
    (id) => id && !id.startsWith("role:") && !id.startsWith("kind:")
  );
  if (concreteIds.length === 0) return undefined;
  const rows = (await SQL`
    select delegator_id from approval_delegates
    where tenant_slug = ${payload.tenantSlug}
      and delegate_id = ${payload.delegateId}
      and delegator_id = any(${concreteIds})
      and active
      and now() >= valid_from
      and (valid_to is null or now() <= valid_to)
      and (entity_type is null or entity_type = ${payload.entityType})
    limit 1
  `) as any[];
  return rows[0]?.delegator_id;
}

// ---------------------------------------------------------------------------
// Rule maintenance
// ---------------------------------------------------------------------------

export async function updateApprovalRule(
  tenantSlug: string,
  ruleId: string,
  updates: {
    conditions?: Record<string, any>;
    approvers?: ApproverStep[];
    isActive?: boolean;
    priority?: number;
    entityType?: ApprovalEntityType;
    ruleType?: ApprovalRule["ruleType"];
  }
): Promise<ApprovalRule | null> {
  await ensureApprovalTables();
  const [existing] = (await SQL`
    select * from approval_rules where id = ${ruleId} and tenant_slug = ${tenantSlug} limit 1
  `) as any[];
  if (!existing) return null;

  const conditions = updates.conditions !== undefined ? JSON.stringify(updates.conditions) : JSON.stringify(existing.conditions);
  const approvers = updates.approvers !== undefined ? JSON.stringify(updates.approvers) : JSON.stringify(existing.approvers);
  const [record] = (await SQL`
    update approval_rules set
      entity_type = ${updates.entityType ?? existing.entity_type},
      rule_type = ${updates.ruleType ?? existing.rule_type},
      conditions = ${conditions}::jsonb,
      approvers = ${approvers}::jsonb,
      is_active = ${updates.isActive ?? existing.is_active},
      priority = ${updates.priority ?? existing.priority},
      updated_at = now()
    where id = ${ruleId} and tenant_slug = ${tenantSlug}
    returning *
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
    updatedAt: record.updated_at,
  };
}

export async function deleteApprovalRule(tenantSlug: string, ruleId: string): Promise<boolean> {
  await ensureApprovalTables();
  const rows = (await SQL`
    delete from approval_rules where id = ${ruleId} and tenant_slug = ${tenantSlug}
    returning id
  `) as any[];
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// SLA sweep — remind or escalate approvals stuck past their SLA window.
// Configured per rule via conditions.slaHours/slaAction, or tenant-wide via
// settings.approvals.approvalSlaHours / approvalSlaAction. Idempotent: each
// step fires at most once (recorded in metadata.slaFiredSteps).
// ---------------------------------------------------------------------------

export async function escalateStaleApprovals(
  tenantSlug?: string
): Promise<{ scanned: number; reminded: number; escalated: number }> {
  await ensureApprovalTables();
  const rows = (await SQL`
    select a.*, r.conditions as rule_conditions
    from approvals a
    left join approval_rules r on r.id = a.rule_id
    where a.status in ('pending', 'escalated')
      and (${tenantSlug ?? null}::text is null or a.tenant_slug = ${tenantSlug ?? null})
    order by a.updated_at asc
    limit 1000
  `) as any[];
  if (rows.length === 0) return { scanned: 0, reminded: 0, escalated: 0 };

  // Tenant-level defaults for rows whose rule carries no SLA config.
  const tenantSlugs = [...new Set(rows.map((r: any) => r.tenant_slug))];
  const tenantDefaults = new Map<string, { slaHours?: number; slaAction?: string }>();
  const settingsRows = (await db.query<any>(
    `select slug, settings from tenants where slug = any($1)`, [tenantSlugs]
  )).rows;
  for (const t of settingsRows) {
    const approvals = (t.settings as any)?.approvals ?? {};
    tenantDefaults.set(t.slug, {
      slaHours: typeof approvals.approvalSlaHours === "number" ? approvals.approvalSlaHours : undefined,
      slaAction: approvals.approvalSlaAction,
    });
  }

  let reminded = 0;
  let escalated = 0;
  const now = Date.now();

  for (const row of rows) {
    const cond = row.rule_conditions ?? {};
    const defaults = tenantDefaults.get(row.tenant_slug) ?? {};
    const slaHours = typeof cond.slaHours === "number" ? cond.slaHours : defaults.slaHours;
    if (!slaHours || slaHours <= 0) continue;

    const staleMs = now - new Date(row.updated_at).getTime();
    if (staleMs < slaHours * 3600_000) continue;

    const metadata = row.metadata ?? {};
    const fired: number[] = Array.isArray(metadata.slaFiredSteps) ? metadata.slaFiredSteps : [];
    if (fired.includes(row.current_step)) continue; // already handled this step

    const chain = (row.approver_chain ?? []) as ApproverStep[];
    const maxStep = chain.reduce((m, s) => Math.max(m, s.step), 0);
    const slaAction = (cond.slaAction ?? defaults.slaAction ?? "remind") as string;
    const willEscalate = slaAction === "escalate";
    const atLastStep = row.current_step >= maxStep;
    const entityRef = metadata.invoiceNumber ?? metadata.billNumber
      ?? metadata.journalNumber ?? metadata.reference ?? row.entity_id;

    if (willEscalate && !atLastStep) {
      // Advance the chain — the stale step is skipped.
      const newStep = row.current_step + 1;
      const decisions = row.decisions ?? [];
      decisions.push({
        step: row.current_step,
        userId: "system",
        decision: "escalated",
        comments: `Auto-escalated: no action within ${slaHours}h SLA`,
        timestamp: new Date().toISOString(),
      });
      metadata.slaFiredSteps = [...fired, row.current_step];
      await SQL`
        update approvals set
          status = 'escalated', current_step = ${newStep},
          decisions = ${JSON.stringify(decisions)},
          metadata = ${JSON.stringify(metadata)},
          updated_at = now()
        where id = ${row.id} and status in ('pending', 'escalated')
      `;
      const nextSpecs = chain
        .filter((s) => s.step === newStep)
        .map((s) => s.userId.startsWith("role:")
          ? { kind: "role" as const, value: s.userId.slice(5) }
          : { kind: "user" as const, value: s.userId });
      void emitEvent({
        tenantSlug: row.tenant_slug,
        eventType: "approval.sla_breach",
        sourceModule: "approvals",
        sourceRecordId: row.id,
        actorId: "system",
        explicitSpecs: nextSpecs.length ? nextSpecs : [{ kind: "admin" }],
        payload: { approvalId: row.id, entityType: row.entity_type, entityRef, escalated: true, currentStep: newStep, amount: metadata.amount ?? metadata.total ?? 0 },
      });
      escalated++;
    } else {
      // Remind: re-notify the approvers still on the clock (or admins when
      // the last step itself is stale).
      const specs = atLastStep
        ? [{ kind: "admin" as const }]
        : chain
            .filter((s) => s.step === row.current_step)
            .map((s) => s.userId.startsWith("role:")
              ? { kind: "role" as const, value: s.userId.slice(5) }
              : { kind: "user" as const, value: s.userId });
      metadata.slaFiredSteps = [...fired, row.current_step];
      await SQL`
        update approvals set metadata = ${JSON.stringify(metadata)}
        where id = ${row.id}
      `;
      void emitEvent({
        tenantSlug: row.tenant_slug,
        eventType: "approval.sla_breach",
        sourceModule: "approvals",
        sourceRecordId: row.id,
        actorId: "system",
        explicitSpecs: specs.length ? specs : [{ kind: "admin" }],
        payload: { approvalId: row.id, entityType: row.entity_type, entityRef, escalated: false, currentStep: row.current_step, amount: metadata.amount ?? metadata.total ?? 0 },
      });
      reminded++;
    }
  }

  return { scanned: rows.length, reminded, escalated };
}
