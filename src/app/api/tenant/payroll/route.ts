export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  getPaginationParams,
  errorResponse,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";

/**
 * GET /api/tenant/payroll?period=YYYY-MM
 * Per-employee payroll entries for the given period (or the latest run).
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");

    if (!checkRateLimit(`payroll-get-${context.tenantSlug}`, 100, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period");
    const pagination = getPaginationParams(request);
    await ensureHrTables(sql);

    let rows: any[];
    if (period) {
      rows = await sql`
        select e.id, e.employee_id, e.employee_name, e.base_salary, e.total_deductions,
               e.gross_pay, e.net_pay, r.period, r.status as run_status
        from admin_payroll_entries e
        join admin_payroll_runs r on r.id = e.run_id
        where e.tenant_slug = ${context.tenantSlug} and r.period = ${period}
        order by e.employee_name asc
        limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
      `;
    } else {
      rows = await sql`
        select e.id, e.employee_id, e.employee_name, e.base_salary, e.total_deductions,
               e.gross_pay, e.net_pay, r.period, r.status as run_status
        from admin_payroll_entries e
        join admin_payroll_runs r on r.id = e.run_id
        where e.tenant_slug = ${context.tenantSlug}
        order by r.period desc, e.employee_name asc
        limit ${pagination.limit} offset ${(pagination.page - 1) * pagination.limit}
      `;
    }

    const records = rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: r.employee_name,
      period: r.period,
      baseSalary: Number(r.base_salary) || 0,
      deductions: Number(r.total_deductions) || 0,
      grossPay: Number(r.gross_pay) || 0,
      netSalary: Number(r.net_pay) || 0,
      status: r.run_status === "completed" ? "Paid" : "Processed",
    }));

    return NextResponse.json({
      success: true,
      data: records,
      pagination: { page: pagination.page, limit: pagination.limit, total: records.length },
    });
  } catch (error) {
    console.error("Payroll GET error:", error);
    return errorResponse("Failed to load payroll", 500);
  }
}
