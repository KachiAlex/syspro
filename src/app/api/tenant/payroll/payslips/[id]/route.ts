export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
} from "@/lib/tenant-admin/utils";

/**
 * GET /api/tenant/payroll/payslips/[id]
 * Payslip detail for a payroll entry (id = admin_payroll_entries.id).
 */
export async function GET(request: NextRequest, context: any) {
  try {
    const ctx = validateTenantContext(request, "read");
    const { id } = await context.params;

    await ensureHrTables(sql);

    const [row] = await sql`
      select e.*, r.period, r.status as run_status, r.approved_by, r.approved_at
      from admin_payroll_entries e
      join admin_payroll_runs r on r.id = e.run_id
      where e.id = ${id} and e.tenant_slug = ${ctx.tenantSlug}
      limit 1
    `;
    if (!row) {
      return errorResponse("Payslip not found", 404);
    }
    const r = row as any;

    const [emp] = await sql`
      select email, job_title, department_id, employment_type
      from admin_employees
      where tenant_slug = ${ctx.tenantSlug} and id = ${r.employee_id}
      limit 1
    `;

    const earnings = [
      { label: "Base Salary", amount: Number(r.base_salary) || 0 },
      Number(r.transport_allowance) > 0 && { label: "Transport Allowance", amount: Number(r.transport_allowance) },
      Number(r.housing_allowance) > 0 && { label: "Housing Allowance", amount: Number(r.housing_allowance) },
      Number(r.meal_allowance) > 0 && { label: "Meal Allowance", amount: Number(r.meal_allowance) },
      Number(r.bonus) > 0 && { label: "Bonus / Adjustments", amount: Number(r.bonus) },
    ].filter(Boolean);

    const deductions = [
      Number(r.tax) > 0 && { label: "Tax (PAYE)", amount: Number(r.tax) },
      Number(r.pension) > 0 && { label: "Pension", amount: Number(r.pension) },
      Number(r.health_insurance) > 0 && { label: "Health Insurance", amount: Number(r.health_insurance) },
      Number(r.other_deductions) > 0 && { label: "Other Deductions", amount: Number(r.other_deductions) },
    ].filter(Boolean);

    return NextResponse.json({
      success: true,
      data: {
        id: r.id,
        period: r.period,
        status: r.run_status,
        employee: {
          id: r.employee_id,
          name: r.employee_name,
          email: (emp as any)?.email ?? null,
          position: r.position ?? (emp as any)?.job_title ?? null,
          department: r.department ?? (emp as any)?.department_id ?? null,
          employmentType: (emp as any)?.employment_type ?? null,
        },
        earnings,
        deductions,
        grossPay: Number(r.gross_pay) || 0,
        totalDeductions: Number(r.total_deductions) || 0,
        netPay: Number(r.net_pay) || 0,
        approvedBy: r.approved_by,
        approvedAt: r.approved_at,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Payslip GET error:", error);
    return handleTenantAdminError(error);
  }
}
