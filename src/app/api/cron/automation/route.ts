export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import {
  fetchPendingActions,
  markActionStatus,
} from "@/lib/automation/db";
import { handleAutomationAction } from "@/lib/automation/connectors";
import { emitAutomationEvent, emitAutomationEventOnce } from "@/lib/automation/emit";
import { refreshFinanceSummary } from "@/lib/finance/events";
import { processQueuedReportJobs, queueDueScheduledReports } from "@/lib/reporting/jobs";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_ATTEMPTS = 3;
const BATCH_LIMIT = 100;

/**
 * Scheduled automation runner. Jobs:
 *  1. Drain automation_action_queue across all tenants — rule actions
 *     (webhooks, notifications, task creation) only execute when the queue
 *     is processed; without this they sit pending forever.
 *  2. Emit time-based triggers that no single request can produce:
 *     finance.payment-due, attendance.missed, projects.over-budget.
 *     All go through emitAutomationEventOnce so a rule cannot fire twice
 *     for the same source record within its cooldown window.
 *  3. refreshFinanceSummary per active tenant — the consumer half of the
 *     finance_events bus that backs finance_dashboard_metrics.
 *  4. Queue reports whose schedule interval has elapsed (daily/weekly/
 *     monthly), then drain the report job queue so they actually execute.
 *
 * Invoke with Authorization: Bearer $CRON_SECRET (e.g. hourly/daily).
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  // Fail closed: if CRON_SECRET is unset there is no way to authenticate —
  // never accept a forged "Bearer undefined" header.
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Drain the cross-tenant action queue
    const actions = await fetchPendingActions(BATCH_LIMIT, undefined, MAX_ATTEMPTS);
    const actionResults: Array<{ id: string; status: string; error?: string }> = [];
    for (const action of actions) {
      await markActionStatus(action.id, "processing", null);
      const result = await handleAutomationAction(action as any);
      await markActionStatus(action.id, result.status, result.error || null);
      actionResults.push({ id: action.id, status: result.status, error: result.error });
    }

    // 2a. finance.payment-due: open bills past due (7-day re-notify window)
    const overdueBills = (await SQL`
      select id, tenant_slug, bill_number, vendor_id, due_date, balance_due, currency
      from bills
      where status in ('open', 'partially_paid')
        and due_date < current_date
        and balance_due > 0
      limit 500
    `) as any[];
    let paymentDueEmitted = 0;
    for (const bill of overdueBills) {
      const emitted = await emitAutomationEventOnce(
        bill.tenant_slug,
        "finance.payment-due",
        `bill:${bill.id}`,
        {
          billId: bill.id,
          billNumber: bill.bill_number,
          vendorId: bill.vendor_id,
          dueDate: bill.due_date,
          balanceDue: Number(bill.balance_due),
          currency: bill.currency,
        }
      );
      if (emitted) paymentDueEmitted++;
    }

    // 2b. attendance.missed: active employees with no record on the last
    //     weekday — only for tenants that actually use attendance.
    const target = new Date();
    do {
      target.setDate(target.getDate() - 1);
    } while (target.getDay() === 0 || target.getDay() === 6);
    const workDate = target.toISOString().slice(0, 10);
    const absent = (await SQL`
      select e.tenant_slug, e.id as employee_id, e.name as employee_name
      from admin_employees e
      where e.status = 'active'
        and e.tenant_slug in (
          select distinct tenant_id from attendance_records
          where work_date >= current_date - 30
        )
        and not exists (
          select 1 from attendance_records a
          where a.tenant_id = e.tenant_slug
            and a.employee_id = e.id
            and a.work_date = ${workDate}::date
        )
      limit 500
    `) as any[];
    let attendanceEmitted = 0;
    for (const row of absent) {
      const emitted = await emitAutomationEventOnce(
        row.tenant_slug,
        "attendance.missed",
        `employee:${row.employee_id}:${workDate}`,
        {
          employeeId: String(row.employee_id),
          employeeName: row.employee_name,
          workDate,
        }
      );
      if (emitted) attendanceEmitted++;
    }

    // 2c. projects.over-budget: task actual_cost exceeds the project budget.
    //     over_budget_alerted_at dedups and auto-resets if spend drops back
    //     under the budget so a re-cross fires again.
    await SQL`alter table if exists projects add column if not exists over_budget_alerted_at timestamptz`;
    const overBudget = (await SQL`
      select p.id, p.tenant_slug, p.code, p.name, p.total_budget_amount, p.currency,
             coalesce(sum(t.actual_cost), 0) as spent
      from projects p
      join tasks t on t.project_id = p.id and t.tenant_slug = p.tenant_slug
      where p.over_budget_alerted_at is null
        and coalesce(p.total_budget_amount, 0) > 0
        and p.status not in ('COMPLETED', 'CANCELLED', 'ON_HOLD', 'ARCHIVED')
      group by p.id
      having coalesce(sum(t.actual_cost), 0) > p.total_budget_amount
      limit 200
    `) as any[];
    for (const p of overBudget) {
      await SQL`update projects set over_budget_alerted_at = now() where id = ${p.id} and tenant_slug = ${p.tenant_slug}`;
      emitAutomationEvent(p.tenant_slug, "projects.over-budget", {
        projectId: p.id,
        projectCode: p.code,
        projectName: p.name,
        budget: Number(p.total_budget_amount),
        spent: Number(p.spent),
        overBy: Number(p.spent) - Number(p.total_budget_amount),
        currency: p.currency,
      });
    }
    await SQL`
      update projects p set over_budget_alerted_at = null
      where p.over_budget_alerted_at is not null
        and coalesce((
          select sum(t.actual_cost) from tasks t
          where t.project_id = p.id and t.tenant_slug = p.tenant_slug
        ), 0) <= coalesce(p.total_budget_amount, 0)
    `;

    // 3. Consume the finance_events bus → cached summary aggregates
    const tenants = (await SQL`
      select distinct tenant_slug from finance_events
      where event_timestamp >= now() - interval '45 days'
    `) as any[];
    for (const t of tenants) {
      await refreshFinanceSummary(t.tenant_slug);
    }

    // 4. Queue due scheduled reports, then drain the report job queue
    const scheduledReports = await queueDueScheduledReports(BATCH_LIMIT);
    const reportResults = await processQueuedReportJobs(BATCH_LIMIT);

    return NextResponse.json({
      actions: actionResults,
      processed: actionResults.length,
      paymentDueEmitted,
      attendanceMissedEmitted: attendanceEmitted,
      overBudgetEmitted: overBudget.length,
      summariesRefreshed: tenants.length,
      scheduledReportsQueued: scheduledReports.length,
      reportJobsProcessed: reportResults.length,
      reportJobs: reportResults,
    });
  } catch (error) {
    console.error("Cron automation runner failed:", error);
    return NextResponse.json({ error: "Automation cron failed" }, { status: 500 });
  }
}
