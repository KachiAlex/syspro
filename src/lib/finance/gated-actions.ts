/**
 * Gated-action registry — declarative maker-checker for sensitive flows.
 *
 * Instead of hand-wiring each route into the approvals engine, a flow
 * registers one definition here and calls gateOrRun() at the mutation point:
 *
 *   const res = await gateOrRun(tenant, "vendor_bank_change", payload, { requestedBy });
 *   res.status === "pending" → staged; the chain decides, then def.run replays
 *   res.status === "ran"     → executed now (ungated / override / review mode)
 *   res.status === "denied"  → over a cap with no valid overrideBy
 *
 * Enforcement modes (a matching matrix band's `mode` overrides `def.mode`):
 *   block    — stage + defer until the chain approves (default)
 *   override — run under cap; over cap requires payload.overrideBy naming an
 *              authorized manager/officer — real-time, POS-style
 *   review   — run immediately AND land in the approval inbox post-hoc;
 *              a rejection invokes def.reverse when one is registered
 *
 * The deferred payload travels in the approvals row's metadata as
 * { action, payload, postHoc }; applyGatedActionOutcome() in approvals.ts
 * replays (or reverses) it through this registry.
 */

import { randomUUID } from "crypto";
import { db } from "../sql-client";
import {
  canOverride,
  initiateApproval,
  matrixBandFor,
  requiresApproval,
  type GateDomain,
} from "./approvals";
import { emitEvent } from "../notify";

export type GateMode = "block" | "override" | "review";

export interface GateCtx {
  requestedBy: string;
  requestedByName?: string;
  departmentId?: string;
  decidedBy?: string;
}

export interface GatedActionDef<P = any> {
  /** Authority-matrix domain — band selection uses this. */
  domain: GateDomain;
  /** Default enforcement mode when no band overrides it. */
  mode: GateMode;
  /** Gate even when the domain has no configured matrix band — for
   *  authority/policy actions that should never slip through silently. */
  always?: boolean;
  /** Extra gating predicate evaluated with the tenant's full settings. */
  gated?: (payload: P, settings: Record<string, any>) => boolean | Promise<boolean>;
  /** Risk amount used for matrix band selection and notifications. */
  amount: (payload: P) => number;
  /** One-line description shown to approvers and in notifications. */
  describe: (payload: P) => string;
  /** Override mode only: is this payload over the configured cap? */
  overLimit?: (payload: P, settings: Record<string, any>) => boolean;
  /** Block mode only: when false, the ungated path does NOT call run — the
   *  record stays in its pre-decision state for a legacy/manual decision
   *  flow (e.g. requisitions/leave have always-visible pending rows). An
   *  explicit auto-approve matrix band (approvers: []) still runs so the
   *  document reaches its approved end-state. Default true. */
  runUngated?: boolean;
  /** The real mutation — runs now (ungated/override/review) or on approval. */
  run: (tenantSlug: string, payload: P, ctx: GateCtx) => Promise<any>;
  /** Block mode: fired after the approval row is created — e.g. mark the
   *  underlying record as having a change awaiting review. */
  staged?: (tenantSlug: string, payload: P, ctx: GateCtx) => Promise<any>;
  /** Review mode: undo the effect when a post-hoc review rejects it. */
  reverse?: (tenantSlug: string, payload: P, ctx: GateCtx) => Promise<any>;
  /** Block mode: cleanup when rejected (e.g. clear a pending marker). */
  rejected?: (tenantSlug: string, payload: P, ctx: GateCtx) => Promise<any>;
}

const REGISTRY = new Map<string, GatedActionDef<any>>();

export function registerGatedAction<P>(name: string, def: GatedActionDef<P>): void {
  REGISTRY.set(name, def as GatedActionDef<any>);
}

export function getGatedAction(name: string): GatedActionDef<any> | undefined {
  return REGISTRY.get(name);
}

/** Names + metadata of every registered gated action — powers the rules
 *  editor's action picker (conditions.action) and the Policy tab. */
export function listGatedActions(): { name: string; domain: GateDomain; mode: GateMode; always: boolean }[] {
  return [...REGISTRY.entries()].map(([name, def]) => ({
    name,
    domain: def.domain,
    mode: def.mode,
    always: def.always === true,
  }));
}

export type GateOutcome<R = any> =
  | { status: "ran"; result: R; reviewApprovalId?: string }
  | { status: "pending"; approvalId: string }
  | { status: "denied"; error: string };

async function tenantFullSettings(tenantSlug: string): Promise<Record<string, any>> {
  const rows = await db.query<any>(`select settings from tenants where slug = $1`, [tenantSlug]);
  return (rows.rows[0]?.settings as any) ?? {};
}

/**
 * Route a mutation through the registered gate for `actionName`.
 *
 * Decision order: an explicit approval rule always gates. Otherwise the
 * domain's matrix band decides (approvers list → gate; empty → auto-approve;
 * `mode` picks block vs review). With no band, def.always/def.gated decide.
 */
export async function gateOrRun<P extends Record<string, any>>(
  tenantSlug: string,
  actionName: string,
  payload: P,
  ctx: GateCtx
): Promise<GateOutcome> {
  const def = getGatedAction(actionName);
  if (!def) throw new Error(`Gated action "${actionName}" is not registered`);

  const amount = def.amount(payload);
  const settings = await tenantFullSettings(tenantSlug);
  const matrix = (settings as any)?.approvals?.authorityMatrix ?? {};
  const band = matrixBandFor(matrix, def.domain, amount);
  const mode: GateMode = band?.mode ?? def.mode;

  // ---- Override mode: real-time cap check, no async chain ---------------
  if (mode === "override") {
    const over = def.overLimit ? def.overLimit(payload, settings) : false;
    if (!over) {
      return { status: "ran", result: await def.run(tenantSlug, payload, ctx) };
    }
    const overrideBy = String((payload as any).overrideBy ?? "").trim();
    if (!overrideBy) {
      return { status: "denied", error: `This ${actionName} exceeds the configured cap — a manager override is required (overrideBy)` };
    }
    if (!(await canOverride(tenantSlug, overrideBy))) {
      return { status: "denied", error: "The override user is not authorized to approve this action" };
    }
    void emitEvent({
      tenantSlug,
      eventType: `${actionName}.override`,
      sourceModule: "approvals",
      sourceRecordId: `ga_${randomUUID()}`,
      actorId: overrideBy,
      payload: {
        action: actionName,
        amount,
        requestedBy: ctx.requestedBy,
        overrideBy,
        description: def.describe(payload),
      },
    }).catch((err) => console.error("override audit event failed:", err));
    return { status: "ran", result: await def.run(tenantSlug, payload, ctx) };
  }

  // ---- Gating decision (rules → matrix → action defaults) ---------------
  const description = def.describe(payload);
  const entityData: Record<string, any> = {
    amount,
    domain: def.domain,
    action: actionName,
    payload,
    requestedBy: ctx.requestedBy,
    requestedByName: ctx.requestedByName,
    departmentId: ctx.departmentId,
    reference: description,
  };
  const engineGated = await requiresApproval(tenantSlug, "gated_action", entityData);
  const gated = engineGated || (!band && (def.always === true || (def.gated ? await def.gated(payload, settings) : false)));

  // ---- Review mode: apply now, review post-hoc ---------------------------
  if (mode === "review") {
    const result = await def.run(tenantSlug, payload, ctx);
    if (gated) {
      entityData.postHoc = true;
      entityData.ranAt = new Date().toISOString();
      const approval = await initiateApproval({
        tenantSlug,
        entityType: "gated_action",
        entityId: `ga_${randomUUID()}`,
        requestedBy: ctx.requestedBy,
        entityData,
      });
      return { status: "ran", result, reviewApprovalId: approval.id };
    }
    return { status: "ran", result };
  }

  // ---- Block mode: defer or run -----------------------------------------
  if (gated) {
    const approval = await initiateApproval({
      tenantSlug,
      entityType: "gated_action",
      entityId: `ga_${randomUUID()}`,
      requestedBy: ctx.requestedBy,
      entityData,
    });
    if (def.staged) {
      await def.staged(tenantSlug, payload, ctx).catch((err) =>
        console.error(`Gated action "${actionName}" staged hook failed:`, err)
      );
    }
    return { status: "pending", approvalId: approval.id };
  }
  // Ungated: run now — except actions that deliberately defer to a legacy
  // decision flow when no gate is configured (runUngated === false). An
  // explicit auto-approve band (approvers: []) still runs so the document
  // reaches its approved end-state.
  const explicitAutoApprove = !!band && !engineGated;
  if (explicitAutoApprove || def.runUngated !== false) {
    return { status: "ran", result: await def.run(tenantSlug, payload, ctx) };
  }
  return { status: "ran", result: undefined };
}

// ---------------------------------------------------------------------------
// Built-in gated actions — one registration per sensitive flow.
// ---------------------------------------------------------------------------

/** Vendor bank details — the payment-diversion fraud vector. The staged
 *  change shows as pending_bank_details on the vendor; approval applies the
 *  merged change and stamps bank_details_changed_at, which escalates payments
 *  to this vendor to a company officer for the next 30 days. */
registerGatedAction<{ vendorId: string; vendorName?: string; bankChanges: Record<string, string | undefined> }>(
  "vendor_bank_change",
  {
    domain: "master_data",
    mode: "block",
    always: true,
    amount: () => 0,
    describe: (p) => `Vendor bank details — ${p.vendorName ?? p.vendorId}`,
    staged: async (tenantSlug, p) => {
      await db.query(
        `update vendors set pending_bank_details = $1::jsonb where id = $2 and tenant_slug = $3`,
        [JSON.stringify(p.bankChanges), p.vendorId, tenantSlug]
      );
    },
    run: async (tenantSlug, p) => {
      const { getVendor, updateVendor } = await import("./vendors");
      const current = await getVendor(p.vendorId, tenantSlug);
      const merged = {
        accountNumber: p.bankChanges.accountNumber !== undefined ? p.bankChanges.accountNumber : current?.accountNumber,
        bankCode: p.bankChanges.bankCode !== undefined ? p.bankChanges.bankCode : current?.bankCode,
        bankName: p.bankChanges.bankName !== undefined ? p.bankChanges.bankName : current?.bankName,
      };
      const applied = await updateVendor(p.vendorId, merged, tenantSlug);
      await db.query(
        `update vendors set pending_bank_details = null, bank_details_changed_at = now()
         where id = $1 and tenant_slug = $2`,
        [p.vendorId, tenantSlug]
      );
      return applied;
    },
    rejected: async (tenantSlug, p) => {
      await db.query(
        `update vendors set pending_bank_details = null where id = $1 and tenant_slug = $2`,
        [p.vendorId, tenantSlug]
      );
    },
  }
);

/** Payroll adjustments (bonuses, fines, deductions) feed payroll runs —
 *  previously self-approved via a free-text field. Now staged until the
 *  chain approves; the adjustment row only exists after approval. */
registerGatedAction<Record<string, any>>("payroll_adjustment", {
  domain: "people",
  mode: "block",
  always: true,
  amount: (p) => Number(p.amount ?? 0),
  describe: (p) =>
    `Payroll ${p.type} — ${p.category} ${Number(p.amount ?? 0).toLocaleString()} for ${p.effectivePeriod}`,
  run: async (tenantSlug, p, ctx) =>
    (await import("../hr/db")).createPayrollAdjustment({
      tenantSlug,
      employeeId: p.employeeId,
      type: p.type,
      category: p.category,
      amount: Number(p.amount),
      reason: p.reason,
      effectivePeriod: p.effectivePeriod,
      approvedBy: ctx.decidedBy ?? ctx.requestedBy,
    }),
});

/** Imprest advances — cash out to staff. Staged until approval. */
registerGatedAction<Record<string, any>>("imprest_advance", {
  domain: "spend",
  mode: "block",
  always: true,
  amount: (p) => Number(p.amount ?? 0),
  describe: (p) => `Imprest advance — ${p.employeeName} ${Number(p.amount ?? 0).toLocaleString()}`,
  run: async (tenantSlug, p) => (await import("./imprest")).issueAdvance({ tenantSlug, ...p } as any),
});

/** Imprest fund replenishment — Dr petty cash / Cr bank. Staged. */
registerGatedAction<Record<string, any>>("imprest_replenish", {
  domain: "spend",
  mode: "block",
  always: true,
  amount: (p) => Number(p.amount ?? 0),
  describe: (p) => `Imprest replenishment ${Number(p.amount ?? 0).toLocaleString()} — fund ${p.fundId}`,
  run: async (tenantSlug, p) => (await import("./imprest")).replenishFund({ tenantSlug, ...p } as any),
});

/** Imprest disbursement — Dr expense / Cr petty cash. Staged. */
registerGatedAction<Record<string, any>>("imprest_disburse", {
  domain: "spend",
  mode: "block",
  always: true,
  amount: (p) => Number(p.amount ?? 0),
  describe: (p) => `Imprest disbursement ${Number(p.amount ?? 0).toLocaleString()} — fund ${p.fundId}`,
  run: async (tenantSlug, p) => (await import("./imprest")).disburseFund({ tenantSlug, ...p } as any),
});

/** Role/permission assignment — privilege escalation. Staged until the
 *  chain approves; admin_user_roles only changes on approval. */
registerGatedAction<Record<string, any>>("role_assignment", {
  domain: "system",
  mode: "block",
  always: true,
  amount: () => 0,
  describe: (p) => `Role assignment — ${p.userEmail ?? p.userId} → ${p.roleName ?? p.newRoleId}`,
  run: async (tenantSlug, p, ctx) =>
    (await import("../tenant/role-assignment")).assignUserRole(tenantSlug, {
      ...p,
      assignedBy: ctx.decidedBy ?? p.assignedBy ?? ctx.requestedBy,
      assignedByEmail: p.assignedByEmail,
    } as any),
});

/** POS pay-outs / drawer drops — cash leaving the register. Override mode:
 *  under settings.pos.cashMovementCap (or approvals.posCashMovementCap) runs
 *  freely; over cap needs a named authorized override. */
registerGatedAction<Record<string, any>>("pos_cash_movement", {
  domain: "sales",
  mode: "override",
  amount: (p) => Number(p.amount ?? 0),
  describe: (p) => `POS ${p.type} — ${Number(p.amount ?? 0).toLocaleString()}`,
  overLimit: (p, settings) => {
    if (p.type !== "pay_out" && p.type !== "drop") return false;
    const cap = settings?.pos?.cashMovementCap ?? (settings?.approvals as any)?.posCashMovementCap;
    return cap !== undefined && cap !== null && Number(p.amount) > Number(cap);
  },
  run: async (tenantSlug, p) => (await import("../pos/shifts")).addCashMovement(tenantSlug, p as any),
});

/** POS refunds — cash/credit back to the customer. Override mode with
 *  settings.pos.refundCap (or approvals.posRefundCap). */
registerGatedAction<Record<string, any>>("pos_refund", {
  domain: "sales",
  mode: "override",
  amount: (p) => Number(p.estimatedRefund ?? 0),
  describe: (p) => `POS refund — ${Number(p.estimatedRefund ?? 0).toLocaleString()}`,
  overLimit: (p, settings) => {
    const cap = settings?.pos?.refundCap ?? (settings?.approvals as any)?.posRefundCap;
    return cap !== undefined && cap !== null && Number(p.estimatedRefund ?? 0) > Number(cap);
  },
  run: async (tenantSlug, p) => (await import("../pos/returns")).createPosReturn(tenantSlug, p as any),
});

// ---------------------------------------------------------------------------
// Converged flows — bespoke approval mechanisms replaced by the shared engine.
// ---------------------------------------------------------------------------

/** Purchase requisitions: the row is created 'pending' and stays visible;
 *  what the gate controls is the pending → approved transition. Ungated
 *  (no rule/matrix/requisitionMinAmount) keeps the legacy manual
 *  approve/reject PATCH; a configured chain decides via the inbox. */
registerGatedAction<Record<string, any>>("purchase_requisition", {
  domain: "spend",
  mode: "block",
  runUngated: false,
  gated: (p, settings) => {
    const min = (settings?.approvals as any)?.requisitionMinAmount;
    return min !== undefined && min !== null && Number(p.totalAmount ?? 0) >= Number(min);
  },
  amount: (p) => Number(p.totalAmount ?? 0),
  describe: (p) =>
    `Purchase requisition ${p.requisitionNumber ?? p.requisitionId} — ${Number(p.totalAmount ?? 0).toLocaleString()}`,
  run: async (tenantSlug, p) => {
    const r = await db.query(
      `update procurement_requisitions set status = 'approved', updated_at = now()
       where id = $1 and tenant_slug = $2 and status = 'pending' returning id`,
      [p.requisitionId, tenantSlug]
    );
    return r.rows[0];
  },
  rejected: async (tenantSlug, p) => {
    await db.query(
      `update procurement_requisitions set status = 'rejected', updated_at = now()
       where id = $1 and tenant_slug = $2 and status = 'pending'`,
      [p.requisitionId, tenantSlug]
    );
  },
});

/** Leave requests: every request needs a decision (existing semantic), so
 *  always gate — the employee's department manager is step 0 by default and
 *  a people-matrix band can elevate or auto-approve (e.g. approvers: [] for
 *  short absences). Ungated keeps the legacy PATCH decision flow. */
registerGatedAction<Record<string, any>>("leave_request", {
  domain: "people",
  mode: "block",
  runUngated: false,
  always: true,
  amount: (p) => Number(p.days ?? 0),
  describe: (p) =>
    `Leave — ${p.employeeName ?? p.employeeId}, ${p.leaveType} ${p.startDate} → ${p.endDate} (${p.days}d)`,
  run: async (tenantSlug, p, ctx) =>
    (await import("../hr/db")).updateLeaveStatus(p.leaveId, tenantSlug, "approved", ctx.decidedBy ?? ctx.requestedBy),
  rejected: async (tenantSlug, p, ctx) =>
    (await import("../hr/db")).updateLeaveStatus(p.leaveId, tenantSlug, "rejected", ctx.decidedBy ?? ctx.requestedBy),
});

/** Invoice deletion — destructive; always routed unless a sales-matrix band
 *  auto-approves. */
registerGatedAction<Record<string, any>>("invoice_delete", {
  domain: "sales",
  mode: "block",
  always: true,
  amount: (p) => Number(p.total ?? 0),
  describe: (p) =>
    `Delete invoice ${p.invoiceNumber ?? p.invoiceId}${p.total ? ` — ${Number(p.total).toLocaleString()}` : ""}`,
  run: async (tenantSlug, p) =>
    (await import("./db")).deleteFinanceInvoice(p.invoiceId, tenantSlug),
});

/** Fiscal period close — posts the closing JE and locks the period. */
registerGatedAction<Record<string, any>>("period_close", {
  domain: "system",
  mode: "block",
  always: true,
  amount: () => 0,
  describe: (p) => `Close fiscal period ${p.periodName ?? p.periodId}`,
  run: async (tenantSlug, p, ctx) =>
    (await import("./gl")).closeFiscalPeriod(p.periodId, ctx.decidedBy ?? ctx.requestedBy),
});

/** Employee termination — the status transition waits for the chain. */
registerGatedAction<Record<string, any>>("employee_termination", {
  domain: "people",
  mode: "block",
  always: true,
  amount: () => 0,
  describe: (p) => `Terminate employee ${p.employeeName ?? p.employeeId}`,
  run: async (tenantSlug, p, ctx) =>
    (await import("../hr/db")).updateEmployee(p.employeeId, { status: "terminated" }, tenantSlug, ctx.decidedBy ?? ctx.requestedBy),
});

/** Employee deletion — erases history; always gated. */
registerGatedAction<Record<string, any>>("employee_delete", {
  domain: "people",
  mode: "block",
  always: true,
  amount: () => 0,
  describe: (p) => `Delete employee ${p.employeeName ?? p.employeeId}`,
  run: async (tenantSlug, p, ctx) =>
    (await import("../hr/db")).deleteEmployee(p.employeeId, tenantSlug, ctx.decidedBy ?? ctx.requestedBy),
});

/** Fixed-asset disposal/write-off — derecognizes the asset and posts the
 *  gain/loss journal. Amount is the asset's net book value. */
registerGatedAction<Record<string, any>>("asset_disposal", {
  domain: "system",
  mode: "block",
  always: true,
  amount: (p) => Number(p.netBookValue ?? 0),
  describe: (p) =>
    `Asset ${p.method} — ${p.assetName ?? p.assetId}${p.netBookValue ? ` (NBV ${Number(p.netBookValue).toLocaleString()})` : ""}`,
  run: async (tenantSlug, p, ctx) =>
    (await import("./fixed-assets")).disposeAsset({
      tenantSlug,
      assetId: p.assetId,
      disposalDate: p.disposalDate,
      method: p.method,
      proceeds: p.proceeds !== undefined ? Number(p.proceeds) : undefined,
      proceedsAccountCode: p.proceedsAccountCode,
      userId: ctx.decidedBy ?? ctx.requestedBy,
    }),
});

/** Stock transfer completion — goods only move when the transfer completes,
 *  so that's the gated transition. Gates on value (qty × unit cost) against
 *  settings.approvals.stockTransferMinAmount or an inventory-matrix band. */
registerGatedAction<Record<string, any>>("stock_transfer_completion", {
  domain: "inventory",
  mode: "block",
  gated: (p, settings) => {
    const min = (settings?.approvals as any)?.stockTransferMinAmount;
    return min !== undefined && min !== null && Number(p.value ?? 0) >= Number(min);
  },
  amount: (p) => Number(p.value ?? 0),
  describe: (p) =>
    `Stock transfer ${p.productSku ?? p.productId} ×${p.quantity} ${p.from ?? "?"} → ${p.to ?? "?"}${p.value ? ` — ${Number(p.value).toLocaleString()}` : ""}`,
  run: async (tenantSlug, p) =>
    (await import("../inventory/transfers")).completeStockTransfer(tenantSlug, p.transferId),
});

/** Budget approval — replaces the half-dead budget_approvals mechanism:
 *  submission routes through the chain; approval flips DRAFT → APPROVED and
 *  writes a budget_approvals audit row; rejection returns it to DRAFT. */
registerGatedAction<Record<string, any>>("budget_approval", {
  domain: "spend",
  mode: "block",
  always: true,
  amount: (p) => Number(p.totalBudgetAmount ?? 0),
  describe: (p) =>
    `Budget approval — ${p.budgetName ?? p.budgetId} ${Number(p.totalBudgetAmount ?? 0).toLocaleString()}`,
  run: async (tenantSlug, p, ctx) => {
    const { changeBudgetStatus, createBudgetApproval } = await import("./budgets-db");
    try {
      const rec = await createBudgetApproval(BigInt(p.budgetId), tenantSlug, 1, "approvals_engine");
      if ((rec as any)?.id) {
        await db.query(
          `update budget_approvals
           set status = 'APPROVED', approver_id = $1, approver_name = $2, approved_at = now()
           where id = $3`,
          [ctx.decidedBy ?? ctx.requestedBy, ctx.decidedBy ?? ctx.requestedBy, (rec as any).id]
        );
      }
    } catch (err) {
      console.error("budget_approval audit row failed:", err);
    }
    return changeBudgetStatus(BigInt(p.budgetId), tenantSlug, "APPROVED");
  },
  rejected: async (tenantSlug, p) =>
    (await import("./budgets-db")).changeBudgetStatus(BigInt(p.budgetId), tenantSlug, "DRAFT"),
});

/** Employee bank details — same payment-diversion vector as vendor bank
 *  changes, but on the payroll side. The staged change shows as
 *  pending_bank_details on the employee; approval applies the merge and
 *  stamps bank_details_changed_at, which escalates payroll runs covering
 *  this employee to a company officer for 30 days. */
registerGatedAction<{ employeeId: string; employeeName?: string; bankChanges: Record<string, string | undefined> }>(
  "employee_bank_change",
  {
    domain: "people",
    mode: "block",
    always: true,
    amount: () => 0,
    describe: (p) => `Employee bank details — ${p.employeeName ?? p.employeeId}`,
    staged: async (tenantSlug, p) => {
      await db.query(`alter table admin_employees add column if not exists pending_bank_details jsonb`).catch(() => {});
      await db.query(
        `update admin_employees set pending_bank_details = $1::jsonb where id = $2 and tenant_slug = $3`,
        [JSON.stringify(p.bankChanges), p.employeeId, tenantSlug]
      );
    },
    run: async (tenantSlug, p, ctx) => {
      const { getEmployeeById, updateEmployee } = await import("../hr/db");
      const current: any = await getEmployeeById(p.employeeId, tenantSlug);
      const merged: Record<string, string | undefined> = {
        bankName: p.bankChanges.bankName !== undefined ? p.bankChanges.bankName : current?.bankName,
        bankAccountNumber: p.bankChanges.bankAccountNumber !== undefined ? p.bankChanges.bankAccountNumber : current?.bankAccountNumber,
        bankAccountName: p.bankChanges.bankAccountName !== undefined ? p.bankChanges.bankAccountName : current?.bankAccountName,
      };
      const applied = await updateEmployee(p.employeeId, merged, tenantSlug, ctx.decidedBy ?? ctx.requestedBy);
      await db.query(`alter table admin_employees add column if not exists bank_details_changed_at timestamptz`).catch(() => {});
      await db.query(
        `update admin_employees set pending_bank_details = null, bank_details_changed_at = now()
         where id = $1 and tenant_slug = $2`,
        [p.employeeId, tenantSlug]
      );
      return applied;
    },
    rejected: async (tenantSlug, p) => {
      await db.query(
        `update admin_employees set pending_bank_details = null where id = $1 and tenant_slug = $2`,
        [p.employeeId, tenantSlug]
      );
    },
  }
);

/** Asset value adjustment (impairment/write-down) — posts a GL entry
 *  moving NBV without disposal. Amount is the absolute delta. */
registerGatedAction<Record<string, any>>("asset_value_adjustment", {
  domain: "system",
  mode: "block",
  always: true,
  amount: (p) => Math.abs(Number(p.delta ?? p.newNetBookValue ?? 0)),
  describe: (p) =>
    `Asset value adjustment — ${p.assetName ?? p.assetId} → NBV ${Number(p.newNetBookValue ?? 0).toLocaleString()}`,
  run: async (tenantSlug, p, ctx) =>
    (await import("./asset-lifecycle")).adjustAssetValue({
      tenantSlug,
      assetId: p.assetId,
      adjustmentDate: p.adjustmentDate,
      newNetBookValue: Number(p.newNetBookValue),
      reason: p.reason,
      financeBook: p.financeBook,
      userId: ctx.decidedBy ?? ctx.requestedBy,
    } as any),
});

/** Asset capitalization — recognizes spend as a fixed asset + depreciation
 *  schedule. Amount is the capitalized cost. */
registerGatedAction<Record<string, any>>("asset_capitalize", {
  domain: "system",
  mode: "block",
  always: true,
  amount: (p) => Number(p.amount ?? 0),
  describe: (p) => `Capitalize asset — ${p.name} ${Number(p.amount ?? 0).toLocaleString()}`,
  run: async (tenantSlug, p, ctx) =>
    (await import("./asset-lifecycle")).capitalizeAsset({
      ...p,
      tenantSlug,
      userId: ctx.decidedBy ?? ctx.requestedBy,
    } as any),
});

/** Chart-of-accounts create/update — opt-in master-data control: ungated
 *  unless the tenant configures a master_data matrix band (or a rule
 *  scoped to this action via conditions.action). */
registerGatedAction<Record<string, any>>("coa_change", {
  domain: "master_data",
  mode: "block",
  amount: () => 0,
  describe: (p) => `GL account ${p.op === "update" ? "update" : "create"} — ${p.code ?? ""} ${p.name ?? ""}`.trim(),
  run: async (tenantSlug, p) => {
    const { createChartOfAccount, updateChartOfAccount } = await import("../accounting/db");
    if (p.op === "update") {
      return updateChartOfAccount(p.accountId, { ...p.fields, tenantSlug } as any);
    }
    return createChartOfAccount({ ...p.fields, tenantSlug, createdBy: p.requestedBy } as any);
  },
});

/** Goods receipt — physical stock-in against a PO. Receipts are created
 *  'pending' and apply (stock-in + PO received_qty + status) only after
 *  the chain approves. Ungated → receives immediately (it's a physical
 *  event the warehouse already confirmed). */
registerGatedAction<Record<string, any>>("purchase_receipt", {
  domain: "inventory",
  mode: "block",
  amount: (p) => Number(p.totalAmount ?? 0),
  describe: (p) => `Purchase receipt — ${p.receiptNumber ?? p.receiptId ?? ""} ${Number(p.totalAmount ?? 0).toLocaleString()}`.trim(),
  run: async (tenantSlug, p, ctx) =>
    (await import("./purchase-receipts")).receivePurchaseReceipt(tenantSlug, p.receiptId, ctx.decidedBy ?? ctx.requestedBy),
});

/** Delivery note — goods physically leaving the warehouse against a sales
 *  order. Same posture as purchase receipts: notes are created 'pending'
 *  and apply (stock-out + SO status) after approval; ungated delivers
 *  immediately. */
registerGatedAction<Record<string, any>>("delivery_note", {
  domain: "inventory",
  mode: "block",
  amount: (p) => Number(p.totalAmount ?? 0),
  describe: (p) => `Delivery note — ${p.noteNumber ?? p.noteId ?? ""} ${Number(p.totalAmount ?? 0).toLocaleString()}`.trim(),
  run: async (tenantSlug, p) =>
    (await import("../sales/delivery-notes")).deliverDeliveryNote(tenantSlug, p.noteId),
});
