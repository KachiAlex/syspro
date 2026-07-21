import { NextRequest, NextResponse } from "next/server";
import { decodeEmployeeToken } from "@/lib/hr/auth";
import { sql as SQL } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("employee_session")?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const session = decodeEmployeeToken(token);
  if (!session) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  try {
    const sql = SQL;
    await ensureHrTables(sql);

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStart = new Date(currentYear, currentMonth, 1).toISOString().split("T")[0];
    const monthEnd = new Date(currentYear, currentMonth + 1, 0).toISOString().split("T")[0];

    // Today's attendance
    const todayAtt = await sql`
      SELECT id, date, status, check_in, check_out FROM admin_attendance
      WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id} AND date = ${today}
      LIMIT 1
    `;

    // This month's attendance summary
    const monthAtt = await sql`
      SELECT status, count(*)::int as cnt FROM admin_attendance
      WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
        AND date >= ${monthStart} AND date <= ${monthEnd}
      GROUP BY status
    `;

    // This month's attendance records for calendar
    const monthRecords = await sql`
      SELECT date, status, check_in, check_out FROM admin_attendance
      WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
        AND date >= ${monthStart} AND date <= ${monthEnd}
      ORDER BY date ASC
    `;

    // Pending leave requests count
    const pendingLeave = await sql`
      SELECT count(*)::int as cnt FROM admin_leave
      WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id} AND status = 'pending'
    `;

    // Pending/overdue tasks
    const openTasks = await sql`
      SELECT count(*)::int as cnt FROM admin_staff_tasks
      WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
        AND status IN ('pending', 'in_progress', 'overdue')
    `;

    // KPI tasks
    const kpiTasks = await sql`
      SELECT id, title, description, expected_outcome, weight, is_kpi, frequency, due_date, status
      FROM admin_staff_tasks
      WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id} AND is_kpi = true
      ORDER BY created_at DESC
    `;

    // Recent reports (last 5)
    const recentReports = await sql`
      SELECT id, title, report_type, report_date, status, submitted_at
      FROM admin_staff_reports
      WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
      ORDER BY submitted_at DESC
      LIMIT 5
    `;

    // Reports submitted this month
    const monthReports = await sql`
      SELECT count(*)::int as cnt FROM admin_staff_reports
      WHERE tenant_slug = ${session.tenantSlug} AND employee_id = ${session.id}
        AND submitted_at >= ${monthStart}
    `;

    // Payslips count
    const payslipCount = await sql`
      SELECT count(*)::int as cnt FROM admin_payroll_entries pe
      JOIN admin_payroll_runs pr ON pr.id = pe.run_id
      WHERE pe.tenant_slug = ${session.tenantSlug} AND pe.employee_id = ${session.id}
    `;

    // Build attendance summary
    const attSummary: Record<string, number> = {};
    for (const row of monthAtt) {
      attSummary[row.status] = row.cnt;
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
      const checkInHour = parseInt(todayAtt[0].check_in?.split(":")[0] || "0");
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

    if (pendingLeave[0]?.cnt > 0) {
      pendingActions.push({ label: `${pendingLeave[0].cnt} leave request(s) pending approval`, tab: "profile", urgent: false });
    }

    if (openTasks[0]?.cnt > 0) {
      pendingActions.push({ label: `${openTasks[0].cnt} task(s) need attention`, tab: "reports", urgent: false });
    }

    // Calculate on-time rate
    const totalDays = Object.values(attSummary).reduce((a, b) => a + b, 0);
    const presentDays = (attSummary["present"] || 0) + (attSummary["half_day"] || 0);
    const onTimeRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

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
        pendingLeave: pendingLeave[0]?.cnt || 0,
        openTasks: openTasks[0]?.cnt || 0,
        kpiCount: kpiTasks.length,
        reportsThisMonth: monthReports[0]?.cnt || 0,
        payslipCount: payslipCount[0]?.cnt || 0,
      },
      kpis: kpiTasks,
      recentReports,
    });
  } catch (error: any) {
    console.error("Dashboard summary error:", error?.message || error);
    return NextResponse.json({ error: "Failed to load dashboard", detail: error?.message || String(error) }, { status: 500 });
  }
}
