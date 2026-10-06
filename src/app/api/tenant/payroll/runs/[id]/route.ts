export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
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
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
  };
}

/**
 * PATCH /api/tenant/payroll/runs/[id]
 * action: "approve" — posts the GL journal (Dr 6300 Salaries, Cr 2300 Payroll
 *   Payable net, Cr 2310 Deductions Payable) and marks the run completed.
 * action: "cancel" — cancels a draft run.
 */
export async function PATCH(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "write");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action.toLowerCase() : null;

    if (!action || !["approve", "cancel"].includes(action)) {
      return errorResponse("action must be 'approve' or 'cancel'", 400);
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
      return NextResponse.json({ success: true, data: mapRun(updated) });
    }

    // approve
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

    const journal = await createJournalEntry({
      tenantSlug: ctx.tenantSlug,
      entryDate,
      referenceType: "payroll",
      referenceId: id,
      description: `Payroll run ${r.period}`,
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
      metadata: { runId: id, period: r.period },
    });

    const [approver] = await sql`
      select coalesce(a.name, e.name) as name
      from (select ${ctx.tenantSlug}::text as ts) t
      left join tenant_admins a on a.tenant_slug = t.ts and a.id::text = ${ctx.userId}
      left join admin_employees e on e.tenant_slug = t.ts and e.id::text = ${ctx.userId}
      limit 1
    `;

    const [updated] = await sql`
      update admin_payroll_runs set
        status = 'completed',
        approved_by = ${(approver as any)?.name ?? ctx.userId},
        approved_at = now(),
        processed_at = coalesce(processed_at, now()),
        journal_entry_id = ${journal.id}
      where id = ${id}
      returning *
    `;

    return NextResponse.json({
      success: true,
      data: mapRun(updated),
      journalEntryId: journal.id,
    });
  } catch (error) {
    console.error("Payroll run PATCH error:", error);
    return handleTenantAdminError(error);
  }
}
