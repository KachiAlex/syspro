import { db, sql as SQL } from "@/lib/sql-client";

// ---------------------------------------------------------------------------
// Budget enforcement: checks a proposed spend against ACTIVE budgets whose
// lines cover the affected account codes, honoring each budget's
// enforcement_mode (HARD_BLOCK | SOFT_WARNING | AUDIT_ONLY), allow_overrun
// and overrun_threshold_percent. Optionally records the commitment/actual.
// ---------------------------------------------------------------------------

export type BudgetSpendLine = { accountCode: string; amount: number };

export type BudgetCheckResult = {
  ok: boolean;
  mode: string;
  violations: Array<{
    budgetCode: string;
    budgetName: string;
    accountCode: string;
    budgeted: number;
    consumed: number;
    requested: number;
    exceededBy: number;
    thresholdPercent: number;
  }>;
  warnings: string[];
};

async function activeBudgets(tenantSlug: string, fiscalYear: number) {
  return (await db.query<any>(
    `select * from budgets where tenant_slug = $1 and fiscal_year = $2
       and status = 'ACTIVE'`,
    [tenantSlug, fiscalYear]
  )).rows;
}

export async function checkBudget(input: {
  tenantSlug: string;
  fiscalYear?: number;
  lines: BudgetSpendLine[];
  record?: {
    actualType: "EXPENSE" | "INVOICE" | "PURCHASE_ORDER" | "PAYMENT";
    transactionCode?: string;
    transactionId?: number;
    committed?: boolean;
    transactionDate?: string;
  };
}): Promise<BudgetCheckResult> {
  const year = input.fiscalYear ?? new Date().getUTCFullYear();
  const budgets = await activeBudgets(input.tenantSlug, year);
  const result: BudgetCheckResult = { ok: true, mode: "NONE", violations: [], warnings: [] };
  if (!budgets.length || !input.lines.length) return result;

  for (const budget of budgets) {
    const mode = budget.enforcement_mode as string;
    if (mode === "AUDIT_ONLY") continue;
    result.mode = mode;

    for (const line of input.lines) {
      // Budget lines covering this account code inside this budget.
      const covers = (await db.query<any>(
        `select bl.id, coalesce(bl.budgeted_amount,0)::float as budgeted,
                coalesce((
                  select sum(ba.actual_amount) + sum(ba.committed_amount)
                  from budget_actuals ba
                  where ba.budget_id = bl.budget_id
                    and (ba.budget_line_id = bl.id or ba.account_code = bl.account_code)
                ),0)::float as consumed
         from budget_lines bl
         where bl.budget_id = $1 and bl.account_code = $2`,
        [budget.id, line.accountCode]
      )).rows;

      const budgeted = covers.reduce((s: number, r: any) => s + r.budgeted, 0);
      const consumed = covers.reduce((s: number, r: any) => s + r.consumed, 0);
      if (budgeted <= 0) continue;

      const remaining = budgeted - consumed;
      const overBy = line.amount - remaining;
      const threshold = Number(budget.overrun_threshold_percent ?? 110);
      const hardLimit = budgeted * (threshold / 100) - consumed;
      const exceedsHard = line.amount > hardLimit;

      if (overBy <= 0) continue;

      if (mode === "HARD_BLOCK" && (exceedsHard || !budget.allow_overrun)) {
        result.ok = false;
        result.violations.push({
          budgetCode: budget.code, budgetName: budget.name,
          accountCode: line.accountCode, budgeted, consumed,
          requested: line.amount,
          exceededBy: Math.max(0, line.amount - hardLimit),
          thresholdPercent: threshold,
        });
      } else if (mode === "SOFT_WARNING") {
        result.warnings.push(
          `Budget ${budget.code} (${budget.name}) account ${line.accountCode}: ` +
          `spend ${line.amount.toFixed(2)} exceeds remaining ${Math.max(0, remaining).toFixed(2)}`
        );
      }
    }
  }
  return result;
}

export class BudgetViolationError extends Error {
  violations: BudgetCheckResult["violations"];
  constructor(result: BudgetCheckResult) {
    super(
      "Budget hard-block: " + result.violations.map((v) =>
        `${v.budgetCode}/${v.accountCode} exceeded by ${v.exceededBy.toFixed(2)}`
      ).join("; ")
    );
    this.name = "BudgetViolationError";
    this.violations = result.violations;
  }
}

// Convenience wrapper: throws BudgetViolationError on HARD_BLOCK excess and
// optionally writes budget_actuals commitment rows for covered accounts.
export async function enforceBudget(input: Parameters<typeof checkBudget>[0]) {
  const result = await checkBudget(input);
  if (!result.ok || result.warnings.length) {
    try {
      const { emitEvent } = await import("@/lib/notify");
      const v = result.violations[0];
      void emitEvent({
        tenantSlug: input.tenantSlug,
        eventType: "budget.breached",
        sourceModule: "finance",
        sourceRecordId: input.record?.transactionId != null ? String(input.record.transactionId) : undefined,
        dedupeKey: input.record?.transactionId != null ? `budget:${input.record.transactionId}` : undefined,
        payload: {
          budgetCode: v?.budgetCode, budgetName: v?.budgetName,
          accountCode: v?.accountCode ?? input.lines[0]?.accountCode,
          budgeted: v?.budgeted, consumed: v?.consumed, requested: v?.requested,
          exceededBy: v?.exceededBy, mode: result.mode,
          warnings: result.warnings,
        },
      });
    } catch (err) {
      console.error("Failed to emit budget.breached:", err);
    }
  }
  if (!result.ok) throw new BudgetViolationError(result);

  if (input.record) {
    const year = input.fiscalYear ?? new Date().getUTCFullYear();
    const budgets = await activeBudgets(input.tenantSlug, year);
    for (const budget of budgets) {
      if (budget.enforcement_mode === "AUDIT_ONLY") continue;
      for (const line of input.lines) {
        const lines = (await db.query<any>(
          `select id, budgeted_amount::float as b from budget_lines
           where budget_id = $1 and account_code = $2 order by line_number`,
          [budget.id, line.accountCode]
        )).rows;
        if (!lines.length) continue;
        const per = line.amount / lines.length;
        for (const bl of lines) {
          await db.query(
            `insert into budget_actuals (budget_id, budget_line_id, tenant_slug,
               actual_type, transaction_id, transaction_code, actual_amount,
               committed_amount, account_code, transaction_date)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [budget.id, bl.id, input.tenantSlug, input.record.actualType,
             input.record.transactionId ?? null, input.record.transactionCode ?? null,
             input.record.committed ? 0 : per, input.record.committed ? per : 0,
             line.accountCode, input.record.transactionDate ?? null]
          );
        }
      }
    }
  }
  return result;
}
