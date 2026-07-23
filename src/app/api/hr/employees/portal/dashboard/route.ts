import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken, resolveEmployeeSession } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";

export async function GET(request: NextRequest) {
  const session = resolveEmployeeSession(request); if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const sql = SQL;
    await ensureHrTables(sql);
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
    const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];

    // Today's attendance — wrap individually so one failure doesn't kill everything
    let todayAtt: any[] = [];
    try {
      todayAtt = await sql`
        SELECT id, date, status, check_in, check_out FROM admin_attendance
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id} AND date = ${today}
        LIMIT 1
      `;
    } catch (e) { console.error("dashboard: todayAtt failed:", (e as any)?.message); }

    // This month's attendance summary
    let monthAtt: any[] = [];
    try {
      monthAtt = await sql`
        SELECT status, count(*)::int as cnt FROM admin_attendance
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
          AND date >= ${monthStart} AND date <= ${monthEnd}
        GROUP BY status
      `;
    } catch (e) { console.error("dashboard: monthAtt failed:", (e as any)?.message); }

    // This month's attendance records for calendar
    let monthRecords: any[] = [];
    try {
      monthRecords = await sql`
        SELECT date, status, check_in, check_out FROM admin_attendance
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
          AND date >= ${monthStart} AND date <= ${monthEnd}
        ORDER BY date ASC
      `;
    } catch (e) { console.error("dashboard: monthRecords failed:", (e as any)?.message); }

    // Pending leave requests count
    let pendingLeaveCount = 0;
    try {
      const pendingLeave = await sql`
        SELECT count(*)::int as cnt FROM admin_leave
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id} AND status = 'pending'
      `;
      pendingLeaveCount = pendingLeave[0]?.cnt || 0;
    } catch (e) { console.error("dashboard: pendingLeave failed:", (e as any)?.message); }

    // Pending/overdue tasks
    let openTasksCount = 0;
    try {
      const openTasks = await sql`
        SELECT count(*)::int as cnt FROM admin_staff_tasks
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
          AND status IN ('pending', 'in_progress', 'overdue')
      `;
      openTasksCount = openTasks[0]?.cnt || 0;
    } catch (e) { console.error("dashboard: openTasks failed:", (e as any)?.message); }

    // KPI tasks — is_kpi column may not exist, wrap defensively
    let kpiTasks: any[] = [];
    try {
      kpiTasks = await sql`
        SELECT id, title, description, expected_outcome, weight, is_kpi, frequency, due_date, status
        FROM admin_staff_tasks
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id} AND is_kpi = true
        ORDER BY created_at DESC
      `;
    } catch (e) {
      console.error("dashboard: kpiTasks failed:", (e as any)?.message);
      // Fallback: try without is_kpi column
      try {
        kpiTasks = await sql`
          SELECT id, title, description, frequency, due_date, status
          FROM admin_staff_tasks
          WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
          ORDER BY created_at DESC
        `;
      } catch (e2) { console.error("dashboard: kpiTasks fallback failed:", (e2 as any)?.message); }
    }

    // Recent reports (last 5)
    let recentReports: any[] = [];
    try {
      recentReports = await sql`
        SELECT id, title, report_type, report_date, status, submitted_at
        FROM admin_staff_reports
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
        ORDER BY submitted_at DESC
        LIMIT 5
      `;
    } catch (e) { console.error("dashboard: recentReports failed:", (e as any)?.message); }

    // Reports submitted this month
    let reportsThisMonth = 0;
    try {
      const monthReports = await sql`
        SELECT count(*)::int as cnt FROM admin_staff_reports
        WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
          AND submitted_at >= ${monthStart}
      `;
      reportsThisMonth = monthReports[0]?.cnt || 0;
    } catch (e) { console.error("dashboard: monthReports failed:", (e as any)?.message); }

    // Payslips count
    let payslipCount = 0;
    try {
      const pc = await sql`
        SELECT count(*)::int as cnt FROM admin_payroll_entries pe
        JOIN admin_payroll_runs pr ON pr.id = pe.run_id
        WHERE pe.tenant_slug = ${session.tenantSlug} AND pe.employee_id = ${session.id}
      `;
      payslipCount = pc[0]?.cnt || 0;
    } catch (e) {
      console.error("dashboard: payslipCount failed:", (e as any)?.message);
      // Fallback: try just admin_payroll_entries
      try {
        const pc = await sql`
          SELECT count(*)::int as cnt FROM admin_payroll_entries
          WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
        `;
        payslipCount = pc[0]?.cnt || 0;
      } catch (e2) { console.error("dashboard: payslipCount fallback failed:", (e2 as any)?.message); }
    }

    // Build attendance summary
    const attSummary: Record<string, number> = {};
    for (const row of monthAtt) {
      attSummary[row.status] = row.cnt;
    }

    // HOD: pending expense and leave approvals
    const employeeRole = (session.role || "staff").toLowerCase();
    const isHOD = employeeRole === "hod" || employeeRole === "head_of_department";
    const isHR = employeeRole === "hr" || employeeRole === "hr_admin" || employeeRole === "hr_manager";
    let pendingExpenseApprovals = 0;
    let pendingLeaveApprovals = 0;
    if (isHOD || isHR) {
      try {
        const empInfo = await sql`
          SELECT department_id FROM admin_employees
          WHERE id = ${session.id} AND tenant_slug = ${session.tenantSlug}
          LIMIT 1
        `;
        const deptId = empInfo[0]?.department_id;

        if (deptId || isHR) {
          // Pending expense approvals
          try {
            let expRows: any[];
            if (isHR) {
              expRows = await sql`
                SELECT count(*)::int as cnt FROM admin_expense_requests
                WHERE tenant_slug = ${session.tenantSlug} AND status = 'pending'
              `;
            } else {
              expRows = await sql`
                SELECT count(*)::int as cnt FROM admin_expense_requests er
                JOIN admin_employees e ON er.employee_id = e.id
                WHERE er.tenant_slug = ${session.tenantSlug}
                  AND er.status = 'pending'
                  AND er.employee_id != ${session.id}
                  AND e.department_id = ${deptId}
              `;
            }
            pendingExpenseApprovals = expRows[0]?.cnt || 0;
          } catch (e) { console.error("dashboard: pendingExpenseApprovals failed:", (e as any)?.message); }

          // Pending leave approvals
          try {
            let leaveRows: any[];
            if (isHR) {
              leaveRows = await sql`
                SELECT count(*)::int as cnt FROM admin_leave_requests
                WHERE tenant_slug = ${session.tenantSlug} AND status = 'pending'
                  AND employee_id != ${session.id}
              `;
            } else {
              leaveRows = await sql`
                SELECT count(*)::int as cnt FROM admin_leave_requests lr
                JOIN admin_employees e ON lr.employee_id = e.id
                WHERE lr.tenant_slug = ${session.tenantSlug}
                  AND lr.status = 'pending'
                  AND lr.employee_id != ${session.id}
                  AND e.department_id = ${deptId}
              `;
            }
            pendingLeaveApprovals = leaveRows[0]?.cnt || 0;
          } catch (e) { console.error("dashboard: pendingLeaveApprovals failed:", (e as any)?.message); }
        }
      } catch (e) { console.error("dashboard: HOD approvals failed:", (e as any)?.message); }
    }

    // Build calendar data
    const calendarData: Record<string, { status: string; check_in: string | null; check_out: string | null }> = {};
    for (const row of monthRecords) {
      const d = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split("T")[0];
      calendarData[d] = { status: row.status, check_in: row.check_in, check_out: row.check_out };
    }

    // Determine pending actions
    const pendingActions: { label: string; tab: string; urgent: boolean }[] = [];

    if (!todayAtt[0]?.check_in) {
      pendingActions.push({ label: "Check in for today", tab: "attendance", urgent: true });
    } else if (todayAtt[0]?.check_in && !todayAtt[0]?.check_out) {
      if (now.getHours() >= 17) {
        pendingActions.push({ label: "Don't forget to check out", tab: "attendance", urgent: true });
      }
    }

    // Check if daily report is due
    const todayReport = recentReports.find(
      (r: any) => r.report_type === "daily" && r.report_date === today
    );
    if (!todayReport && now.getHours() >= 14) {
      pendingActions.push({ label: "Submit your daily report", tab: "reports", urgent: now.getHours() >= 18 });
    }

    // Check if weekly report is due (Friday)
    const dayOfWeek = now.getDay();
    const weekReport = recentReports.find(
      (r: any) => r.report_type === "weekly" && r.report_date >= new Date(now.getTime() - 7 * 86400000).toISOString().split("T")[0]
    );
    if (!weekReport && dayOfWeek >= 5) {
      pendingActions.push({ label: "Submit your weekly report", tab: "reports", urgent: dayOfWeek >= 6 });
    }

    if (pendingLeaveCount > 0) {
      pendingActions.push({ label: `${pendingLeaveCount} leave request(s) pending approval`, tab: "profile", urgent: false });
    }

    if (openTasksCount > 0) {
      pendingActions.push({ label: `${openTasksCount} task(s) need attention`, tab: "reports", urgent: false });
    }

    // HOD/HR: pending approvals
    if (pendingExpenseApprovals > 0) {
      pendingActions.push({ label: `${pendingExpenseApprovals} expense request(s) to review`, tab: "expenses", urgent: false });
    }
    if (pendingLeaveApprovals > 0) {
      pendingActions.push({ label: `${pendingLeaveApprovals} leave request(s) to review`, tab: "leave", urgent: false });
    }

    // Calculate on-time rate
    const totalDays = Object.values(attSummary).reduce((a, b) => a + b, 0);
    const presentDaysCount = (attSummary["present"] || 0) + (attSummary["half_day"] || 0);
    const onTimeRate = totalDays > 0 ? Math.round((presentDaysCount / totalDays) * 100) : 0;

    return NextResponse.json({
      today: todayAtt[0] || null,
      attendanceSummary: attSummary,
      calendarData,
      pendingActions,
      stats: {
        presentDays: attSummary["present"] || 0,
        lateDays: attSummary["late"] || 0,
        absentDays: attSummary["absent"] || 0,
        halfDays: attSummary["half_day"] || 0,
        onTimeRate,
        pendingLeave: pendingLeaveCount,
        openTasks: openTasksCount,
        kpiCount: kpiTasks.length,
        reportsThisMonth,
        payslipCount,
      },
      kpis: kpiTasks,
      recentReports,
    });
  } catch (error: any) {
    console.error("Dashboard summary error:", error?.message || error);
    return NextResponse.json({ error: "Failed to load dashboard", detail: error?.message || String(error) }, { status: 500 });
  }
}
