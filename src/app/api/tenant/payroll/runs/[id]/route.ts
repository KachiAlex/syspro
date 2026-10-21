export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables, logHrAudit } from "@/lib/hr/db";
import { createJournalEntry } from "@/lib/finance/accounting";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

const STATUS_TO_UI: Record<string, string> = {
  draft: "Draft",
  processing: "Approved",
  completed: "Paid",
  cancelled: "Cancelled",
};

function mapRun(r: any) {
  return {
    id: r.id,
    period: r.period,
    status: STATUS_TO_UI[r.status] ?? r.status,
    rawStatus: r.status,
    totalGross: Number(r.total_gross) || 0,
    totalDeductions: Number(r.total_deductions) || 0,
    totalNet: Number(r.total_net) || 0,
    journalEntryId: r.journal_entry_id,
    paymentJournalEntryId: r.payment_journal_entry_id,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    paidAt: r.paid_at,
  };
}

async function resolveActorName(ctx: { tenantSlug: string; userId: string }) {
  const [actor] = await sql`
    select coalesce(a.name, e.name) as name
    from (select ${ctx.tenantSlug}::text as ts) t
    left join tenant_admins a on a.tenant_slug = t.ts and a.id::text = ${ctx.userId}
    left join admin_employees e on e.tenant_slug = t.ts and e.id::text = ${ctx.userId}
    limit 1
  `;
  return (actor as any)?.name ?? ctx.userId;
}

/**
 * PATCH /api/tenant/payroll/runs/[id]
 * Workflow: draft → approve → processing (accrual JE posted) → pay → completed
 *   (payment JE posted). cancel allowed on draft only.
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "write");
    const _gate1 = await requireModuleGate(request, "people", "write");
    if (_gate1) return _gate1;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action.toLowerCase() : null;

    if (!action || !["approve", "pay", "cancel"].includes(action)) {
      return errorResponse("action must be 'approve', 'pay', or 'cancel'", 400);
    }

    await ensureHrTables(sql);

    const [run] = await sql`
      select * from admin_payroll_runs
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      limit 1
    `;
    if (!run) {
      return errorResponse("Payroll run not found", 404);
    }
    const r = run as any;

    if (action === "cancel") {
      if (r.status !== "draft") {
        return errorResponse("Only draft runs can be cancelled", 409);
      }
      const [updated] = await sql`
        update admin_payroll_runs set status = 'cancelled'
        where id = ${id}
        returning *
      `;
      // Release one-off adjustments the cancelled draft consumed — with one
      // active run per period, period-matched applied adjustments can only
      // belong to this run.
      await sql`
        update admin_payroll_adjustments
        set status = 'pending', applied_at = null
        where tenant_slug = ${ctx.tenantSlug}
          and effective_period = ${r.period}
          and status = 'applied'
      `;
      await logHrAudit({
        tenantSlug: ctx.tenantSlug,
        userId: ctx.userId,
        action: "payroll.cancelled",
        resource: "payroll_run",
        resourceId: id,
        changes: { period: r.period },
      });
      return NextResponse.json({ success: true, data: mapRun(updated) });
    }

    if (action === "approve") {
      if (r.status !== "draft") {
        return errorResponse(`Run is already ${r.status}`, 409);
      }
      if (r.compliance_passed === false && body?.force !== true) {
        return errorResponse("Run failed compliance checks; pass force=true to override", 409, {
          anomalies: r.anomalies,
        });
      }

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
          where e.tenant_slug = ${ctx.tenantSlug} and e.run_id = ${id}
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

      // Accrual: Dr Salaries & Wages (+ employer statutory) / Cr net + statutory payables
      const journal = await createJournalEntry({
        tenantSlug: ctx.tenantSlug,
        entryDate,
        referenceType: "payroll",
        referenceId: id,
        description: `Payroll accrual ${r.period}`,
        lines: accrualLines,
        metadata: { runId: id, period: r.period, kind: "accrual", employerCost },
      });

      const approvedBy = await resolveActorName(ctx);
      const [updated] = await sql`
        update admin_payroll_runs set
          status = 'processing',
          approved_by = ${approvedBy},
          approved_at = now(),
          processed_at = coalesce(processed_at, now()),
          journal_entry_id = ${journal.id}
        where id = ${id}
        returning *
      `;

      await logHrAudit({
        tenantSlug: ctx.tenantSlug,
        userId: ctx.userId,
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
        const [{ emitEvent }] = await Promise.all([import("@/lib/notify")]);
        void emitEvent({
          tenantSlug: ctx.tenantSlug,
          eventType: "payroll.run_posted",
          sourceModule: "hr",
          sourceRecordId: id,
          dedupeKey: `payroll:${id}:posted`,
          actorId: ctx.userId,
          payload: {
            period: r.period,
            totalNet: totalNet,
            totalGross: Number(r.total_gross) || 0,
            journalEntryId: journal.id,
          },
        });
      } catch (err) {
        console.error("Failed to emit payroll.run_posted:", err);
      }

      return NextResponse.json({
        success: true,
        data: mapRun(updated),
        journalEntryId: journal.id,
      });
    }

    // action === "pay"
    if (r.status !== "processing") {
      return errorResponse(
        r.status === "draft" ? "Run must be approved before payment" : `Run is already ${r.status}`,
        409
      );
    }

    const totalNet = Number(r.total_net) || 0;
    const paymentJournal = await createJournalEntry({
      tenantSlug: ctx.tenantSlug,
      entryDate: new Date().toISOString().split("T")[0],
      referenceType: "payroll",
      referenceId: id,
      description: `Payroll disbursement ${r.period}`,
      lines: [
        {
          accountCode: "2300",
          debitAmount: totalNet,
          creditAmount: 0,
          description: `Net payroll settled — ${r.period}`,
        },
        {
          accountCode: "1100",
          debitAmount: 0,
          creditAmount: totalNet,
          description: `Bank disbursement — payroll ${r.period}`,
        },
      ],
      metadata: { runId: id, period: r.period, kind: "disbursement" },
    });

    const [updated] = await sql`
      update admin_payroll_runs set
        status = 'completed',
        paid_at = now(),
        payment_journal_entry_id = ${paymentJournal.id}
      where id = ${id}
      returning *
    `;

    await logHrAudit({
      tenantSlug: ctx.tenantSlug,
      userId: ctx.userId,
      action: "payroll.paid",
      resource: "payroll_run",
      resourceId: id,
      changes: {
        period: r.period,
        paymentJournalEntryId: paymentJournal.id,
        totalNet: Number(r.total_net) || 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: mapRun(updated),
      paymentJournalEntryId: paymentJournal.id,
    });
  } catch (error) {
    console.error("Payroll run PATCH error:", error);
    return handleTenantAdminError(error);
  }
}

/**
 * GET /api/tenant/payroll/runs/[id]
 * Run detail with its entries.
 */
export async function GET(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "read");
    const _gate2 = await requireModuleGate(request, "people", "read");
    if (_gate2) return _gate2;
    const { id } = await context.params;

    await ensureHrTables(sql);

    const [run] = await sql`
      select * from admin_payroll_runs
      where id = ${id} and tenant_slug = ${ctx.tenantSlug}
      limit 1
    `;
    if (!run) {
      return errorResponse("Payroll run not found", 404);
    }

    const entries = await sql`
      select * from admin_payroll_entries where run_id = ${id} order by employee_name
    `;

    return NextResponse.json({ success: true, data: mapRun(run), entries });
  } catch (error) {
    console.error("Payroll run GET error:", error);
    return handleTenantAdminError(error);
  }
}
