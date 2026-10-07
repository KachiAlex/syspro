export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import {
  fetchPendingActions,
  markActionStatus,
} from "@/lib/automation/db";
import { handleAutomationAction } from "@/lib/automation/connectors";
import { emitAutomationEvent } from "@/lib/automation/emit";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_ATTEMPTS = 3;
const BATCH_LIMIT = 100;

/**
 * Scheduled automation runner. Two jobs:
 *  1. Drain automation_action_queue across all tenants — rule actions
 *     (webhooks, notifications, task creation) only execute when the queue
 *     is processed; without this they sit pending forever.
 *  2. Emit time-based triggers that no single request can produce —
 *     currently finance.payment-due for open bills past their due date.
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

    // 2. Time-based triggers: overdue open bills → finance.payment-due
    const overdueBills = (await SQL`
      select id, tenant_slug, bill_number, vendor_id, due_date, balance_due, currency
      from bills
      where status in ('open', 'partially_paid')
        and due_date < current_date
        and balance_due > 0
      limit 500
    `) as any[];

    const emittedByTenant: Record<string, number> = {};
    for (const bill of overdueBills) {
      emitAutomationEvent(bill.tenant_slug, "finance.payment-due", {
        billId: bill.id,
        billNumber: bill.bill_number,
        vendorId: bill.vendor_id,
        dueDate: bill.due_date,
        balanceDue: Number(bill.balance_due),
        currency: bill.currency,
      });
      emittedByTenant[bill.tenant_slug] = (emittedByTenant[bill.tenant_slug] ?? 0) + 1;
    }

    return NextResponse.json({
      actions: actionResults,
      processed: actionResults.length,
      paymentDueEmitted: overdueBills.length,
      tenantsAffected: Object.keys(emittedByTenant).length,
    });
  } catch (error) {
    console.error("Cron automation runner failed:", error);
    return NextResponse.json({ error: "Automation cron failed" }, { status: 500 });
  }
}
