/**
 * Shared payroll accrual posting.
 *
 * Called from the legacy PATCH /api/tenant/payroll/runs/[id] approve action
 * AND the approvals engine's payroll_run outcome — a gated run's terminal
 * approval executes the same atomic claim + JE posting this function performs.
 */
import { sql } from "@/lib/sql-client";
import { createJournalEntry } from "@/lib/finance/accounting";
import { logHrAudit } from "@/lib/hr/db";

export class PayrollPostError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}

/**
 * Claims a draft run (atomic, single-winner) and posts the accrual JE:
 * Dr Salaries & Wages (+employer statutory) / Cr net + statutory payables.
 * On JE failure the run is returned to draft so approval can be retried.
 */
export async function postPayrollAccrual(payload: {
  tenantSlug: string;
  runId: string;
  approvedBy: string;
  userId?: string;
}): Promise<{ run: any; journalEntryId: string }> {
  const { tenantSlug, runId: id, approvedBy, userId } = payload;

  const [r] = await sql`
    select * from admin_payroll_runs
    where id = ${id} and tenant_slug = ${tenantSlug}
    limit 1
  ` as any[];
  if (!r) throw new PayrollPostError("Payroll run not found", 404);
  if (r.status !== "draft") throw new PayrollPostError(`Run is already ${r.status}`);

  const totalGross = Number(r.total_gross) || 0;
  const totalDeductions = Number(r.total_deductions) || 0;
  const totalNet = Number(r.total_net) || 0;
  const entryDate = `${r.period}-28`;

  // Statutory split for dedicated payables — aggregate per-entry breakdowns;
  // legacy rows without a breakdown fall back to the lumped 2310 residual.
  let split: any = null;
  try {
    const rows = await sql`
      select
        coalesce(sum(e.tax),0)::numeric(15,2) as paye,
        coalesce(sum(e.pension),0)::numeric(15,2) as pension_ee,
        coalesce(sum((e.statutory_breakdown->>'nhf')::numeric),0)::numeric(15,2) as nhf,
        coalesce(sum((e.statutory_breakdown->>'health')::numeric),0)::numeric(15,2) as health,
        coalesce(sum(e.employer_cost),0)::numeric(15,2) as employer_cost,
        coalesce(sum((
          select coalesce(sum((b->>'amount')::numeric),0)
          from jsonb_array_elements(e.employer_breakdown) b
          where b->>'name' ilike '%pension%'
        )),0)::numeric(15,2) as pension_er
      from admin_payroll_entries e
      where e.tenant_slug = ${tenantSlug} and e.run_id = ${id}
    ` as any[];
    split = rows[0] ?? null;
  } catch {
    // statutory_breakdown/employer_cost columns predate this release — fall
    // back to the lumped deductions payable line.
    split = null;
  }
  const paye = Number(split?.paye) || 0;
  const pensionTotal = (Number(split?.pension_ee) || 0) + (Number(split?.pension_er) || 0);
  const nhf = Number(split?.nhf) || 0;
  const health = Number(split?.health) || 0;
  const employerCost = Number(split?.employer_cost) || 0;
  const employerOther = employerCost - (Number(split?.pension_er) || 0);
  // Employee-side residual (custom deductions + unclassified statutory)
  const employeeResidual = Math.max(0, totalDeductions - paye - (Number(split?.pension_ee) || 0) - nhf - health);

  const accrualLines = [
    {
      accountCode: "6300",
      debitAmount: totalGross + employerCost,
      creditAmount: 0,
      description: `Salaries & wages — payroll ${r.period}${employerCost > 0 ? " (incl. employer statutory)" : ""}`,
    },
    { accountCode: "2300", debitAmount: 0, creditAmount: totalNet, description: `Net payroll payable — ${r.period}` },
  ];
  if (paye > 0) accrualLines.push({ accountCode: "2320", debitAmount: 0, creditAmount: paye, description: `PAYE tax payable — ${r.period}` });
  if (pensionTotal > 0) accrualLines.push({ accountCode: "2330", debitAmount: 0, creditAmount: pensionTotal, description: `Pension contributions payable — ${r.period}` });
  if (nhf > 0) accrualLines.push({ accountCode: "2340", debitAmount: 0, creditAmount: nhf, description: `NHF payable — ${r.period}` });
  const residual = employeeResidual + health + employerOther;
  if (residual > 0) accrualLines.push({ accountCode: "2310", debitAmount: 0, creditAmount: residual, description: `Payroll deductions payable — ${r.period}` });

  // Atomic claim FIRST — two concurrent approvals must not both post an
  // accrual JE. The conditional update is the single-winner guard; the
  // loser sees zero rows and 409s before touching the ledger.
  const [claimed] = await sql`
    update admin_payroll_runs set
      status = 'processing',
      approved_by = ${approvedBy},
      approved_at = now(),
      processed_at = coalesce(processed_at, now())
    where id = ${id} and tenant_slug = ${tenantSlug} and status = 'draft'
    returning *
  ` as any[];
  if (!claimed) {
    throw new PayrollPostError("Run is no longer a draft (concurrent approval?)");
  }

  // Accrual: Dr Salaries & Wages (+ employer statutory) / Cr net + statutory payables
  let journal;
  try {
    journal = await createJournalEntry({
      tenantSlug,
      entryDate,
      referenceType: "payroll",
      referenceId: id,
      description: `Payroll accrual ${r.period}`,
      lines: accrualLines,
      metadata: { runId: id, period: r.period, kind: "accrual", employerCost },
    });
  } catch (journalErr) {
    // Compensate — return the run to draft so approval can be retried.
    await sql`
      update admin_payroll_runs set
        status = 'draft', approved_by = null, approved_at = null
      where id = ${id} and status = 'processing' and journal_entry_id is null
    `;
    throw journalErr;
  }

  const [updated] = await sql`
    update admin_payroll_runs set
      journal_entry_id = ${journal.id}
    where id = ${id}
    returning *
  ` as any[];

  await logHrAudit({
    tenantSlug,
    userId: userId ?? approvedBy,
    action: "payroll.approved",
    resource: "payroll_run",
    resourceId: id,
    changes: {
      period: r.period,
      journalEntryId: journal.id,
      totalGross: Number(r.total_gross) || 0,
      totalNet: Number(r.total_net) || 0,
    },
  });

  try {
    const { emitEvent } = await import("@/lib/notify");
    void emitEvent({
      tenantSlug,
      eventType: "payroll.run_posted",
      sourceModule: "hr",
      sourceRecordId: id,
      dedupeKey: `payroll:${id}:posted`,
      actorId: userId,
      payload: {
        period: r.period,
        totalNet,
        totalGross: Number(r.total_gross) || 0,
        journalEntryId: journal.id,
      },
    });
  } catch (err) {
    console.error("Failed to emit payroll.run_posted:", err);
  }

  return { run: updated, journalEntryId: journal.id };
}
