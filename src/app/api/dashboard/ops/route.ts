export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { requireTenantScope } from "@/lib/api-auth";

/**
 * GET /api/dashboard/ops?tenantSlug=...
 * Operational action queue for the main dashboard — things needing attention,
 * not aggregates: overdue receivables/payables, unbilled receipts (GRNI),
 * low stock, draft journals, pending approvals, open work orders, today's POS.
 */
export async function GET(request: NextRequest) {
  const _scope = await requireTenantScope(request);
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const t = context.tenantSlug;

    const q = async (sql: string) =>
      (await db.query<any>(sql, [t]).catch(() => ({ rows: [] }))).rows[0] ?? {};

    const [
      overdueAr, overdueAp, unbilled, lowStock, draftJournals,
      pendingApprovals, openWorkOrders, posToday,
    ] = await Promise.all([
      q(`select count(*)::int as n, coalesce(sum(balance_due),0)::numeric as amt
         from finance_invoices
         where tenant_slug = $1 and balance_due > 0 and due_date < now()`),
      q(`select count(*)::int as n, coalesce(sum(balance_due),0)::numeric as amt
         from bills
         where tenant_slug = $1 and balance_due > 0 and due_date < now()`),
      q(`select count(*)::int as n, coalesce(sum(r.total_amount),0)::numeric as amt
         from procurement_goods_receipts r
         where r.tenant_slug = $1 and r.po_id is not null
           and not exists (select 1 from bills b where b.tenant_slug = r.tenant_slug and b.po_id = r.po_id)`),
      q(`select count(*)::int as n
         from inventory_reorder_rules rr
         left join inventory_stock_balances b
           on b.tenant_slug = rr.tenant_slug and b.product_sku = rr.product_sku and b.warehouse_id = rr.warehouse_id
         where rr.tenant_slug = $1 and rr.enabled
           and coalesce(b.quantity, 0) < rr.reorder_level`),
      q(`select count(*)::int as n
         from journal_entries
         where tenant_slug = $1 and coalesce(approval_status, 'POSTED') in ('DRAFT','PENDING','pending')`),
      q(`select count(*)::int as n
         from approvals
         where tenant_slug = $1 and status = 'pending'`),
      q(`select count(*)::int as n
         from work_orders
         where tenant_slug = $1 and status in ('released','in_progress')`),
      q(`select count(*)::int as n, coalesce(sum(total_amount),0)::numeric as amt
         from pos_sales
         where tenant_slug = $1 and status = 'completed' and created_at::date = current_date`),
    ]);

    const item = (n: any, amt: any, label: string, href: string, severity: "warn" | "info" = "warn") => ({
      count: Number(n ?? 0), amount: Number(amt ?? 0), label, href, severity,
    });

    return NextResponse.json({
      items: [
        item(overdueAr.n, overdueAr.amt, "Overdue invoices", "/tenant-admin/finance?view=receivables"),
        item(overdueAp.n, overdueAp.amt, "Overdue bills", "/tenant-admin/bills?overdue=1"),
        item(unbilled.n, unbilled.amt, "Unbilled receipts (GRNI open)", "/tenant-admin/purchases"),
        item(lowStock.n, null, "Items below reorder level", "/tenant-admin/inventory?view=reorder"),
        item(draftJournals.n, null, "Journals awaiting approval", "/tenant-admin/finance?view=journals"),
        item(pendingApprovals.n, null, "Pending approvals", "/tenant-admin/approvals"),
        item(openWorkOrders.n, null, "Open work orders", "/tenant-admin/manufacturing/work-orders", "info"),
      ].filter((i) => i.count > 0 || i.severity === "info"),
      today: {
        posSales: Number(posToday.n ?? 0),
        posRevenue: Number(posToday.amt ?? 0),
      },
    });
  } catch (error) {
    console.error("Dashboard ops failed:", error);
    return NextResponse.json({ items: [], today: { posSales: 0, posRevenue: 0 } });
  }
}
