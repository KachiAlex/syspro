export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /api/tenant/payroll/runs/[id]/payout
 * Bulk bank-transfer file (CSV) for an approved/paid run.
 */
export async function GET(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "people", "read");
    if (_gate1) return _gate1;
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
    if ((run as any).status === "draft") {
      return errorResponse("Approve the run before generating a payout file", 409);
    }

    const entries = await sql`
      select e.employee_id, e.employee_name, e.net_pay,
             emp.bank_name, emp.bank_account_number, emp.bank_account_name
      from admin_payroll_entries e
      left join admin_employees emp
        on emp.tenant_slug = e.tenant_slug and emp.id = e.employee_id
      where e.run_id = ${id}
      order by e.employee_name
    `;

    const missingBank = (entries as any[]).filter((e) => !e.bank_account_number);
    const header = ["employee_id", "employee_name", "bank_name", "account_number", "account_name", "amount", "currency", "narration"];
    const lines = (entries as any[]).map((e) =>
      [
        e.employee_id,
        e.employee_name,
        e.bank_name,
        e.bank_account_number,
        e.bank_account_name ?? e.employee_name,
        Number(e.net_pay).toFixed(2),
        "NGN",
        `Salary ${(run as any).period}`,
      ]
        .map(csvCell)
        .join(",")
    );

    const csv = [header.join(","), ...lines].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-payout-${(run as any).period}.csv"`,
        ...(missingBank.length
          ? { "X-Missing-Bank-Details": missingBank.map((e) => e.employee_id).join(",") }
          : {}),
      },
    });
  } catch (error) {
    console.error("Payroll payout GET error:", error);
    return handleTenantAdminError(error);
  }
}
