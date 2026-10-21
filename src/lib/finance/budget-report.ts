import { db, sql as SQL } from "@/lib/sql-client";

// ---------------------------------------------------------------------------
// Budget vs Actual — compares budget_lines against GL actuals computed
// straight from posted journal entries. Actuals for expense/asset accounts
// are debits−credits; for revenue/liability accounts credits−debits.
// ---------------------------------------------------------------------------

function periodRange(b: { period_type: string; fiscal_year: number; quarter_num?: number | null; month_num?: number | null }) {
  const y = Number(b.fiscal_year);
  if (b.period_type === "MONTHLY" && b.month_num) {
    const start = new Date(Date.UTC(y, b.month_num - 1, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(y, b.month_num, 0)).toISOString().slice(0, 10);
    return { start, end };
  }
  if (b.period_type === "QUARTERLY" && b.quarter_num) {
    const startMonth = (b.quarter_num - 1) * 3;
    const start = new Date(Date.UTC(y, startMonth, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(y, startMonth + 3, 0)).toISOString().slice(0, 10);
    return { start, end };
  }
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

export async function budgetVsActualReport(input: {
  tenantSlug: string;
  fiscalYear?: number;
  budgetId?: string;
}) {
  const budgets = (await db.query<any>(
    `select * from budgets
     where tenant_slug = $1 and status in ('APPROVED','ACTIVE','CLOSED')
       ${input.fiscalYear ? "and fiscal_year = $2" : ""}
       ${input.budgetId ? `and id = $${input.fiscalYear ? 3 : 2}` : ""}
     order by fiscal_year desc, code`,
    [input.tenantSlug, ...(input.fiscalYear ? [input.fiscalYear] : []), ...(input.budgetId ? [input.budgetId] : [])]
  )).rows;

  const report: any[] = [];
  for (const b of budgets) {
    const { start, end } = periodRange(b);
    const lines = (await db.query<any>(
      `select * from budget_lines where budget_id = $1 order by line_number`,
      [b.id]
    )).rows;

    const actuals = (await db.query<any>(
      `select coalesce(jel.account_code, ca.code) as account_code,
              sum(coalesce(jel.debit_amount, jel.debit, 0))::float as dr,
              sum(coalesce(jel.credit_amount, jel.credit, 0))::float as cr
       from journal_entry_lines jel
       join journal_entries je on je.id = coalesce(jel.journal_entry_id, jel.entry_id)
       left join chart_of_accounts ca on ca.id = jel.account_id
       where je.tenant_slug = $1
         and coalesce(upper(je.approval_status), 'POSTED') in ('POSTED','APPROVED')
         and je.entry_date between $2 and $3
       group by 1`,
      [b.tenant_slug, start, end]
    )).rows;
    const actualMap = new Map(actuals.map((a) => [a.account_code, a]));

    const accountTypes = (await db.query<any>(
      `select code, type from chart_of_accounts where tenant_slug = $1 or tenant_slug is null`,
      [b.tenant_slug]
    )).rows;
    const typeMap = new Map(accountTypes.map((a) => [a.code, a.type]));

    let totalBudget = 0, totalActual = 0;
    const lineRows = lines.map((l) => {
      const budgeted = Number(l.budgeted_amount ?? 0);
      const a = actualMap.get(l.account_code) ?? { dr: 0, cr: 0 };
      const type = typeMap.get(l.account_code) ?? "expense";
      const actual = Math.round(((type === "revenue" || type === "liability" || type === "equity")
        ? a.cr - a.dr : a.dr - a.cr) * 100) / 100;
      totalBudget += budgeted;
      totalActual += actual;
      return {
        lineNumber: l.line_number,
        accountCode: l.account_code,
        accountName: l.account_name,
        description: l.description,
        budgeted,
        actual,
        variance: Math.round((actual - budgeted) * 100) / 100,
        variancePct: budgeted !== 0 ? Math.round(((actual - budgeted) / budgeted) * 1000) / 10 : null,
      };
    });

    report.push({
      budgetId: b.id,
      code: b.code,
      name: b.name,
      budgetType: b.budget_type,
      periodType: b.period_type,
      fiscalYear: b.fiscal_year,
      status: b.status,
      periodStart: start,
      periodEnd: end,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalActual: Math.round(totalActual * 100) / 100,
      totalVariance: Math.round((totalActual - totalBudget) * 100) / 100,
      lines: lineRows,
    });
  }
  return report;
}
