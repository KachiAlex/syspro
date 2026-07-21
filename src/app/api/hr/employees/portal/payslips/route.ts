import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";

/**
 * GET /api/hr/employees/portal/payslips
 * Returns the logged-in employee's payslip history.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const session = decodeEmployeeToken(token);
  if (!session) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const rows = await SQL`
      select pe.id, pe.period, pe.base_salary, pe.transport_allowance,
             pe.housing_allowance, pe.meal_allowance, pe.bonus,
             pe.tax, pe.pension, pe.health_insurance, pe.other_deductions,
             pe.net_pay, pe.status, pe.created_at
      from admin_payroll_entries pe
      join admin_payroll_runs pr on pr.id = pe.payroll_run_id
      where pr.tenant_slug = ${session.tenantSlug}
        and pe.employee_id = ${session.id}
      order by pe.period desc
      limit 24
    `;

    return NextResponse.json({ payslips: rows || [] });
  } catch (error) {
    console.error("Portal payslips error:", error);
    return NextResponse.json({ error: "Failed to load payslips" }, { status: 500 });
  }
}
