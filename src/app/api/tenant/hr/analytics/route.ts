export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import {
  validateTenantContext,
  errorResponse,
  handleTenantAdminError,
  checkRateLimit,
} from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

/**
 * GET /api/tenant/hr/analytics
 * Real HR metrics computed from the tenant's tables:
 * headcount, attrition, absenteeism, leave usage, payroll cost trend.
 */
export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "people", "read");
    if (_gate1) return _gate1;

    if (!checkRateLimit(`hr-analytics-${context.tenantSlug}`, 60, 60000)) {
      return errorResponse("Rate limit exceeded", 429);
    }

    await ensureHrTables(sql);
    const year = new Date().getUTCFullYear();

    const [headcount] = await sql`
      select count(*)::int as total,
             count(*) filter (where status = 'active')::int as active,
             count(*) filter (where status = 'on-leave')::int as on_leave
      from admin_employees
      where tenant_slug = ${context.tenantSlug} and status != 'terminated'
    `;

    const byDepartment = await sql`
      select coalesce(d.name, e.department_id, 'Unassigned') as department,
             count(*)::int as employees
      from admin_employees e
      left join admin_departments d
        on d.tenant_slug = e.tenant_slug and d.id = e.department_id
      where e.tenant_slug = ${context.tenantSlug} and e.status != 'terminated'
      group by 1
      order by employees desc
    `;

    const [attrition] = await sql`
      select count(*)::int as terminated_this_year
      from admin_employees
      where tenant_slug = ${context.tenantSlug} and status = 'terminated'
        and updated_at >= make_date(${year}, 1, 1)
    `;

    const [absenteeism] = await sql`
      select count(*) filter (where attendance_status = 'absent')::int as absent_days,
             count(*)::int as total_records
      from attendance_records
      where tenant_id = ${context.tenantSlug}
        and work_date >= date_trunc('month', now())::date
    `;

    const [leaveStats] = await sql`
      select count(*) filter (where status = 'pending')::int as pending_requests,
             count(*) filter (
               where status = 'approved'
                 and start_date <= now()::date and end_date >= now()::date
             )::int as on_leave_now,
             coalesce(sum(
               case when status = 'approved' and extract(year from start_date) = ${year}
                 then greatest(1, (end_date - start_date) + 1) else 0 end
             ), 0)::int as days_taken_this_year
      from admin_leave
      where tenant_slug = ${context.tenantSlug}
    `;

    const payrollTrend = await sql`
      select period, status, total_gross::float, total_deductions::float, total_net::float,
             (select count(*)::int from admin_payroll_entries e where e.run_id = r.id) as headcount
      from admin_payroll_runs r
      where tenant_slug = ${context.tenantSlug} and status != 'cancelled'
      order by period desc
      limit 6
    `;

    const [openRoles] = await sql`
      select count(*)::int as cnt from admin_job_requisitions
      where tenant_slug = ${context.tenantSlug} and status in ('open','approved')
    `;

    const absenteeismRate =
      (absenteeism as any)?.total_records > 0
        ? Math.round(((absenteeism as any).absent_days / (absenteeism as any).total_records) * 1000) / 10
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        headcount: {
          total: (headcount as any)?.total ?? 0,
          active: (headcount as any)?.active ?? 0,
          onLeave: (headcount as any)?.on_leave ?? 0,
          byDepartment: (byDepartment as any[]).map((d) => ({
            department: d.department,
            employees: d.employees,
          })),
        },
        attrition: {
          terminatedThisYear: (attrition as any)?.terminated_this_year ?? 0,
          rate:
            ((headcount as any)?.total ?? 0) > 0
              ? Math.round(
                  (((attrition as any)?.terminated_this_year ?? 0) /
                    ((headcount as any).total + ((attrition as any)?.terminated_this_year ?? 0))) *
                    1000
                ) / 10
              : 0,
        },
        absenteeism: {
          absentDaysThisMonth: (absenteeism as any)?.absent_days ?? 0,
          rateThisMonth: absenteeismRate,
        },
        leave: {
          pendingRequests: (leaveStats as any)?.pending_requests ?? 0,
          onLeaveNow: (leaveStats as any)?.on_leave_now ?? 0,
          daysTakenThisYear: (leaveStats as any)?.days_taken_this_year ?? 0,
        },
        payrollTrend: (payrollTrend as any[]).map((r) => ({
          period: r.period,
          status: r.status,
          gross: r.total_gross,
          deductions: r.total_deductions,
          net: r.total_net,
          headcount: r.headcount,
        })),
        openRoles: (openRoles as any)?.cnt ?? 0,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("HR analytics error:", error);
    return handleTenantAdminError(error);
  }
}
