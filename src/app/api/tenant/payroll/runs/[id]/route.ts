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

      // Accrual: Dr Salaries & Wages / Cr Payroll Payable + Deductions Payable
      const journal = await createJournalEntry({
        tenantSlug: ctx.tenantSlug,
        entryDate,
        referenceType: "payroll",
        referenceId: id,
        description: `Payroll accrual ${r.period}`,
        lines: [
          {
            accountCode: "6300",
            debitAmount: totalGross,
            creditAmount: 0,
            description: `Salaries & wages — payroll ${r.period}`,
          },
          {
            accountCode: "2300",
            debitAmount: 0,
            creditAmount: totalNet,
            description: `Net payroll payable — ${r.period}`,
          },
          {
            accountCode: "2310",
            debitAmount: 0,
            creditAmount: totalDeductions,
            description: `Payroll deductions payable — ${r.period}`,
          },
        ],
        metadata: { runId: id, period: r.period, kind: "accrual" },
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
