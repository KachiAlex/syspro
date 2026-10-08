export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { createPayrollRun, ensureHrTables, computeProgressiveTax, PayrollPeriodLockedError } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

// Default payroll configuration: statutory 8% employee pension, no tax modelled.
// Rates are PERCENT (8 = 8%) to match checkCompliance conventions.
const DEFAULT_CONFIG = {
  taxRate: 0,
  pensionRate: 8,
  healthInsuranceRate: 0,
  transportAllowance: 0,
  housingAllowance: 0,
  mealAllowance: 0,
};

// Working days used to prorate unpaid-leave deductions.
const WORKING_DAYS_PER_MONTH = 21.67;

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 86400000) + 1);
}

function overlapDays(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const s = aStart > bStart ? aStart : bStart;
  const e = aEnd < bEnd ? aEnd : bEnd;
  return s <= e ? daysBetween(s, e) : 0;
}

/**
 * POST /api/tenant/payroll/run
 * Generates a DRAFT payroll run for a YYYY-MM period: base salary minus
 * approved unpaid leave, plus recurring salary components and pending
 * one-off adjustments. The run must be approved via
 * PATCH /api/tenant/payroll/runs/[id] before it posts to the GL.
 */
export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate1 = await requireModuleGate(request, "people", "write");
    if (_gate1) return _gate1;

    if (!checkRateLimit(`payroll-run-${context.tenantSlug}`, 20, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    const body = await request.json().catch(() => ({}));
    const period = typeof body?.period === "string" && /^\d{4}-\d{2}$/.test(body.period)
      ? body.period
      : new Date().toISOString().slice(0, 7); // YYYY-MM
    const periodStart = `${period}-01`;
    const periodEnd = new Date(
      new Date(`${periodStart}T00:00:00Z`).getUTCFullYear(),
      new Date(`${periodStart}T00:00:00Z`).getUTCMonth() + 1,
      0
    )
      .toISOString()
      .split("T")[0];

    await ensureHrTables(sql);

    // Statutory profile (tax bands, pension, other statutory deductions)
    const [statutory] = await sql`
      select * from admin_statutory_profiles where tenant_slug = ${context.tenantSlug}
    ` as any[];
    const taxBands: { upTo: number | null; rate: number }[] =
      Array.isArray(statutory?.tax_bands) ? statutory.tax_bands : [];
    const pensionEmployeeRate =
      statutory != null ? Number(statutory.pension_employee_rate) : DEFAULT_CONFIG.pensionRate;
    const otherStatutory: { name: string; type: string; amount: number }[] =
      Array.isArray(statutory?.other_deductions) ? statutory.other_deductions : [];
    const runConfig = {
      ...DEFAULT_CONFIG,
      pensionRate: pensionEmployeeRate,
      taxBands,
    };

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

    // Approved unpaid leave overlapping the period
    const unpaidLeave = await sql`
      select employee_id, start_date, end_date
      from admin_leave
      where tenant_slug = ${context.tenantSlug}
        and status = 'approved' and leave_type = 'unpaid'
        and start_date <= ${periodEnd} and end_date >= ${periodStart}
    `;
    const unpaidDays = new Map<string, number>();
    for (const l of unpaidLeave as any[]) {
      const s = l.start_date instanceof Date ? l.start_date.toISOString().split("T")[0] : String(l.start_date);
      const e = l.end_date instanceof Date ? l.end_date.toISOString().split("T")[0] : String(l.end_date);
      const days = overlapDays(s, e, periodStart, periodEnd);
      unpaidDays.set(l.employee_id, (unpaidDays.get(l.employee_id) ?? 0) + days);
    }

    // Unexcused absences flagged as anomalies (no salary deduction by default)
    const absences = await sql`
      select employee_id, employee_name, count(*)::int as days
      from attendance_records
      where tenant_id = ${context.tenantSlug}
        and attendance_status = 'absent'
        and work_date >= ${periodStart} and work_date <= ${periodEnd}
      group by employee_id, employee_name
    `;

    // Recurring salary components active for this period
    const components = await sql`
      select employee_id, name, component_type, amount_type, amount::float as amount
      from admin_employee_components
      where tenant_slug = ${context.tenantSlug} and is_active
        and (start_period is null or start_period <= ${period})
        and (end_period is null or end_period >= ${period})
    `;
    const compsByEmp = new Map<string, any[]>();
    for (const c of components as any[]) {
      const list = compsByEmp.get(c.employee_id) ?? [];
      list.push(c);
      compsByEmp.set(c.employee_id, list);
    }

    // Pending one-off adjustments effective this period
    const adjustments = await sql`
      select id, employee_id, type, category, amount::float as amount, reason
      from admin_payroll_adjustments
      where tenant_slug = ${context.tenantSlug}
        and status = 'pending' and effective_period = ${period}
    `;
    const adjByEmp = new Map<string, any[]>();
    for (const a of adjustments as any[]) {
      const list = adjByEmp.get(a.employee_id) ?? [];
      list.push(a);
      adjByEmp.set(a.employee_id, list);
    }

    const extraAnomalies: string[] = [];
    for (const a of absences as any[]) {
      extraAnomalies.push(
        `${a.employee_name ?? a.employee_id}: ${a.days} unexcused absence day(s) in period — review before approving`
      );
    }

    const entries = (employees as any[]).map((emp) => {
      const baseSalary = emp.salary || 0;
      const dailyRate = baseSalary / WORKING_DAYS_PER_MONTH;

      const unpaidDaysN = Math.min(unpaidDays.get(emp.id) ?? 0, WORKING_DAYS_PER_MONTH);
      const unpaidDeduction = Math.round(dailyRate * unpaidDaysN * 100) / 100;
      if (unpaidDaysN > 0) {
        extraAnomalies.push(
          `${emp.name}: ${unpaidDaysN} unpaid leave day(s) → -${unpaidDeduction.toFixed(2)}`
        );
      }

      let componentEarnings = 0;
      let componentDeductions = 0;
      for (const c of compsByEmp.get(emp.id) ?? []) {
        const amt = c.amount_type === "percent_of_base"
          ? Math.round(baseSalary * (c.amount / 100) * 100) / 100
          : c.amount;
        if (c.component_type === "earning") componentEarnings += amt;
        else componentDeductions += amt;
      }

      let adjBonus = 0;
      let adjDeduction = 0;
      const appliedAdjustmentIds: string[] = [];
      for (const a of adjByEmp.get(emp.id) ?? []) {
        if (a.type === "increment") adjBonus += a.amount;
        else adjDeduction += a.amount;
        appliedAdjustmentIds.push(a.id);
        extraAnomalies.push(
          `${emp.name}: ${a.type === "increment" ? "+" : "-"}${a.amount} ${a.category}${a.reason ? ` (${a.reason})` : ""}`
        );
      }
      (emp as any)._appliedAdjustments = appliedAdjustmentIds;

      const grossPay = Math.round((baseSalary + componentEarnings + adjBonus) * 100) / 100;
      const tax = computeProgressiveTax(grossPay, taxBands);
      const pension = Math.round(grossPay * (pensionEmployeeRate / 100) * 100) / 100;
      let healthInsurance = 0;
      let statutoryOther = 0;
      for (const d of otherStatutory) {
        const amt = d.type === "percent_of_gross"
          ? Math.round(grossPay * (d.amount / 100) * 100) / 100
          : d.amount;
        if (/health|nhis|hmo/i.test(d.name)) healthInsurance += amt;
        else statutoryOther += amt;
      }
      const totalDeductions = Math.round(
        (tax + pension + healthInsurance + statutoryOther + unpaidDeduction + componentDeductions + adjDeduction) * 100
      ) / 100;
      const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department_id,
        position: emp.job_title,
        baseSalary,
        transportAllowance: DEFAULT_CONFIG.transportAllowance + componentEarnings,
        housingAllowance: DEFAULT_CONFIG.housingAllowance,
        mealAllowance: DEFAULT_CONFIG.mealAllowance,
        bonus: adjBonus,
        tax,
        pension,
        healthInsurance,
        otherDeductions: statutoryOther + unpaidDeduction + componentDeductions + adjDeduction,
        totalDeductions,
        grossPay,
        netPay,
      };
    });

    const result = await createPayrollRun({
      tenantSlug: context.tenantSlug,
      period,
      config: runConfig,
      entries,
      processedBy: context.userId,
      status: "draft",
    });

    // Mark consumed adjustments as applied to this run
    const appliedIds = (employees as any[]).flatMap((e) => e._appliedAdjustments ?? []);
    for (const id of appliedIds) {
      await sql`
        update admin_payroll_adjustments
        set status = 'applied', applied_at = now()
        where id = ${id} and tenant_slug = ${context.tenantSlug}
      `;
    }

    return NextResponse.json({
      success: true,
      runId: result.runId,
      status: "draft",
      anomalies: [...(result.anomalies ?? []), ...extraAnomalies],
      compliance: result.compliance,
    });
  } catch (error) {
    if (error instanceof PayrollPeriodLockedError) {
      return errorResponse("A payroll run already exists for this period. Cancel it first to re-run.", 409);
    }
    console.error("Payroll run error:", error);
    return errorResponse("Failed to run payroll", 500);
  }
}
