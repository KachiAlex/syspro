export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  getPaginationParams,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

const STATUS_TO_UI: Record<string, string> = {
  draft: "Draft",
  processing: "Approved",
  completed: "Paid",
  cancelled: "Cancelled",
};

/**
 * GET /api/tenant/payroll/runs
 * Payroll runs with entry counts and approval metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "people", "read");
    if (_gate1) return _gate1;

    if (!checkRateLimit(`payroll-runs-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const pagination = getPaginationParams(request);
    await ensureHrTables(sql);

    const rows = await sql`
      select r.*, (select count(*)::int from admin_payroll_entries e where e.run_id = r.id) as entry_count
      from admin_payroll_runs r
      where r.tenant_slug = ${context.tenantSlug}
      order by r.period desc, r.created_at desc
      limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
    `;

    const runs = (rows as any[]).map((r) => ({
      id: r.id,
      period: r.period,
      status: STATUS_TO_UI[r.status] ?? r.status,
      rawStatus: r.status,
      totalGross: Number(r.total_gross) || 0,
      totalDeductions: Number(r.total_deductions) || 0,
      totalNet: Number(r.total_net) || 0,
      entryCount: r.entry_count,
      anomalies: r.anomalies ?? [],
      compliancePassed: r.compliance_passed,
      journalEntryId: r.journal_entry_id,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      processedBy: r.processed_by,
      processedAt: r.processed_at,
      createdAt: r.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: runs,
      pagination: { page: pagination.page, limit: pagination.limit, total: runs.length },
    });
  } catch (error) {
    console.error("Payroll runs GET error:", error);
    return handleTenantAdminError(error);
  }
}
