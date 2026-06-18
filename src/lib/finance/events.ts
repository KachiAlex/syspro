/**
 * Finance Event Bus Writer
 * Every financial action across modules should call this to publish events.
 * The finance_events table acts as the central event bus for reporting.
 */

import { sql } from "@/lib/sql-client";

export type FinanceEventType =
  | "invoice_issued"
  | "invoice_paid"
  | "expense_submitted"
  | "expense_approved"
  | "expense_rejected"
  | "bill_created"
  | "bill_paid"
  | "payroll_run"
  | "employee_hired"
  | "deal_won"
  | "payment_received"
  | "po_approved"
  | "po_matched"
  | "journal_posted"
  | "budget_breached"
  | "inventory_sold"
  | "inventory_received";

export interface FinanceEventInput {
  tenantSlug: string;
  eventType: FinanceEventType;
  sourceModule: string;
  sourceRecordId?: string;
  userId?: string;
  amount?: number;
  currency?: string;
  glAccountCode?: string;
  branchId?: string;
  regionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write a finance event to the event bus.
 * This should be called after any financial transaction is committed.
 */
export async function writeFinanceEvent(input: FinanceEventInput): Promise<void> {
  try {
    await sql`
      INSERT INTO finance_events (
        tenant_slug,
        event_type,
        source_module,
        source_record_id,
        user_id,
        amount,
        currency,
        gl_account_code,
        branch_id,
        region_id,
        metadata,
        event_timestamp
      ) VALUES (
        ${input.tenantSlug},
        ${input.eventType},
        ${input.sourceModule},
        ${input.sourceRecordId ?? null},
        ${input.userId ?? null},
        ${input.amount ?? null},
        ${input.currency ?? "NGN"},
        ${input.glAccountCode ?? null},
        ${input.branchId ?? null},
        ${input.regionId ?? null},
        ${input.metadata ? JSON.stringify(input.metadata) : null},
        NOW()
      )
    `;
  } catch (err) {
    // Event bus writes should not fail the main transaction.
    // Log the error but do not throw.
    console.error("[FinanceEventBus] Failed to write event:", err, input);
  }
}

/**
 * Refresh the cached summary for a tenant.
 * Call this in a background job or after batch processing events.
 */
export async function refreshFinanceSummary(tenantSlug: string): Promise<void> {
  try {
    // Revenue this month
    const revenueThisMonth = await sql<{ sum: number }>`
      SELECT COALESCE(SUM(amount), 0) as sum
      FROM finance_events
      WHERE tenant_slug = ${tenantSlug}
        AND event_type IN ('invoice_paid', 'deal_won', 'payment_received')
        AND event_timestamp >= DATE_TRUNC('month', CURRENT_DATE)
    `;

    // Expenses this month
    const expensesThisMonth = await sql<{ sum: number }>`
      SELECT COALESCE(SUM(amount), 0) as sum
      FROM finance_events
      WHERE tenant_slug = ${tenantSlug}
        AND event_type IN ('expense_approved', 'bill_paid', 'payroll_run')
        AND event_timestamp >= DATE_TRUNC('month', CURRENT_DATE)
    `;

    // Total payables (bills created but not yet paid events)
    const payables = await sql<{ sum: number }>`
      SELECT COALESCE(SUM(amount), 0) as sum
      FROM finance_events
      WHERE tenant_slug = ${tenantSlug}
        AND event_type = 'bill_created'
    `;

    // Total receivables (invoices issued)
    const receivables = await sql<{ sum: number }>`
      SELECT COALESCE(SUM(amount), 0) as sum
      FROM finance_events
      WHERE tenant_slug = ${tenantSlug}
        AND event_type = 'invoice_issued'
    `;

    await sql`
      INSERT INTO finance_cached_summary (
        tenant_slug,
        total_revenue,
        expenses_this_month,
        total_payables,
        total_receivables,
        updated_at
      ) VALUES (
        ${tenantSlug},
        ${Number(revenueThisMonth[0]?.sum ?? 0)},
        ${Number(expensesThisMonth[0]?.sum ?? 0)},
        ${Number(payables[0]?.sum ?? 0)},
        ${Number(receivables[0]?.sum ?? 0)},
        NOW()
      )
      ON CONFLICT (tenant_slug) DO UPDATE SET
        total_revenue = EXCLUDED.total_revenue,
        expenses_this_month = EXCLUDED.expenses_this_month,
        total_payables = EXCLUDED.total_payables,
        total_receivables = EXCLUDED.total_receivables,
        updated_at = NOW()
    `;
  } catch (err) {
    console.error("[FinanceSummary] Failed to refresh summary:", err);
  }
}
