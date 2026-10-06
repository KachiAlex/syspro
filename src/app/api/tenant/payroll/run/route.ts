export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { createPayrollRun } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";

// Default payroll configuration: statutory 8% employee pension, no tax modelled.
const DEFAULT_CONFIG = {
  taxRate: 0,
  pensionRate: 0.08,
  healthInsuranceRate: 0,
  transportAllowance: 0,
  housingAllowance: 0,
  mealAllowance: 0,
};

/**
 * POST /api/tenant/payroll/run
 * Run payroll for a period — generates entries for every active employee
 * from their recorded salary.
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");

    if (!checkRateLimit(`payroll-run-${context.tenantSlug}`, 20, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const body = await request.json().catch(() => ({}));
    const period = body?.period || new Date().toISOString().slice(0, 7); // YYYY-MM

    const employees = await sql`
      select id, name, coalesce(salary, 0)::float as salary,
             department_id, job_title
      from admin_employees
      where tenant_slug = ${context.tenantSlug} and status in ('active', 'invited')
      order by name asc
    `;

    if (!(employees as any[]).length) {
      return errorResponse("No employees to run payroll for", 400);
    }

    const entries = (employees as any[]).map((emp) => {
      const baseSalary = emp.salary || 0;
      const pension = Math.round(baseSalary * DEFAULT_CONFIG.pensionRate * 100) / 100;
      const totalDeductions = pension;
      return {
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department_id,
        position: emp.job_title,
        baseSalary,
        transportAllowance: DEFAULT_CONFIG.transportAllowance,
        housingAllowance: DEFAULT_CONFIG.housingAllowance,
        mealAllowance: DEFAULT_CONFIG.mealAllowance,
        bonus: 0,
        tax: 0,
        pension,
        healthInsurance: 0,
        otherDeductions: 0,
        totalDeductions,
        grossPay: baseSalary,
        netPay: baseSalary - totalDeductions,
      };
    });

    const result = await createPayrollRun({
      tenantSlug: context.tenantSlug,
      period,
      config: DEFAULT_CONFIG,
      entries,
      processedBy: context.userId,
    });

    return NextResponse.json({ success: true, runId: result.runId, anomalies: result.anomalies });
  } catch (error) {
    console.error("Payroll run error:", error);
    return errorResponse("Failed to run payroll", 500);
  }
}
