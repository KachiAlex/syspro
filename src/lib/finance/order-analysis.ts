import { db } from "@/lib/sql-client";
import { ensureSalesOrdersTable, parseItems } from "@/lib/sales/orders";

// ---------------------------------------------------------------------------
// Order-analysis reports (ERPNext "Order Analysis" + "Items To Be
// Billed/Delivered" parity):
//   - Sales Order Analysis    — order → invoiced → billed-status pipeline
//   - Purchase Order Analysis — order → received → billed pipeline (GRNI)
//   - Items To Be Billed      — PO items received but not yet on a bill;
//                               SO items delivered/open but not yet invoiced
//   - Items To Be Delivered   — PO items ordered but not yet received;
//                               SO items not yet delivered
// ---------------------------------------------------------------------------

export interface OrderAnalysisFilter {
  tenantSlug: string;
  periodStart?: string;
  periodEnd?: string;
  branchId?: string;
}

function dateRange(filter: OrderAnalysisFilter, column: string, params: any[], startAt = 1) {
  let clause = "";
  if (filter.periodStart) {
    params.push(filter.periodStart);
    clause += ` and ${column} >= $${params.length}`;
  }
  if (filter.periodEnd) {
    params.push(filter.periodEnd);
    clause += ` and ${column} <= $${params.length}`;
  }
  return clause;
}

const DELIVERED_STATUSES = new Set(["delivered", "completed", "shipped", "invoiced", "closed"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "rejected"]);

export interface SalesOrderAnalysisRow {
  orderId: string;
  orderNumber: string;
  customer: string;
  orderDate: string;
  status: string;
  orderedQty: number;
  orderedAmount: number;
  invoicedAmount: number;
  pendingBillingAmount: number;
  delivered: boolean;
  billed: boolean;
  billingPct: number;
}

export async function salesOrderAnalysis(filter: OrderAnalysisFilter): Promise<SalesOrderAnalysisRow[]> {
  await ensureSalesOrdersTable();
  const params: any[] = [filter.tenantSlug];
  let where = `so.tenant_slug = $1`;
  where += dateRange(filter, `so.order_date::date`, params);
  const { rows } = await db.query(
    `select so.id, so.order_number, so.customer_name, so.customer_id, so.order_date,
            so.quantity, so.total, so.status, so.invoice_id, so.items,
            coalesce(inv.amount, 0) invoiced_amount,
            inv.status invoice_status
     from sales_orders so
     left join finance_invoices inv on inv.id::text = so.invoice_id and inv.tenant_slug = so.tenant_slug
     where ${where}
     order by so.order_date desc`,
    params,
  );

  return (rows as any[]).map((r) => {
    const status = String(r.status ?? "Pending");
    const items = parseItems(r.items);
    const orderedQty = Number(r.quantity) || items.reduce((s, i) => s + Number(i.quantity ?? 0), 0);
    const orderedAmount = Number(r.total) || items.reduce((s, i) => s + Number(i.quantity ?? 0) * Number(i.unitPrice ?? 0), 0);
    const invoiced = r.invoice_id && r.invoice_status !== "void" ? Number(r.invoiced_amount ?? 0) : 0;
    const pending = Math.max(0, Math.round((orderedAmount - invoiced) * 100) / 100);
    return {
      orderId: r.id,
      orderNumber: r.order_number,
      customer: r.customer_name ?? r.customer_id ?? "",
      orderDate: String(r.order_date ?? ""),
      status,
      orderedQty,
      orderedAmount,
      invoicedAmount: invoiced,
      pendingBillingAmount: pending,
      delivered: DELIVERED_STATUSES.has(status.toLowerCase()),
      billed: pending <= 0.005 && orderedAmount > 0,
      billingPct: orderedAmount > 0 ? Math.round((invoiced / orderedAmount) * 100) : 0,
    };
  });
}

export interface PurchaseOrderAnalysisRow {
  orderId: string;
  poNumber: string;
  supplier: string;
  orderDate: string;
  status: string;
  orderedQty: number;
  orderedAmount: number;
  receivedQty: number;
  receivedAmount: number;
  billedAmount: number;
  receivedNotBilled: number;
  orderedNotReceived: number;
  receiptPct: number;
  billingPct: number;
}

export async function purchaseOrderAnalysis(filter: OrderAnalysisFilter): Promise<PurchaseOrderAnalysisRow[]> {
  const params: any[] = [filter.tenantSlug];
  let where = `po.tenant_slug = $1`;
  where += dateRange(filter, `coalesce(po.issued_date, po.order_date::date)`, params);
  if (filter.branchId) {
    params.push(filter.branchId);
    where += ` and po.branch_id = $${params.length}`;
  }

  const { rows } = await db.query(
    `select po.id, coalesce(po.po_number, po.order_number) po_number,
            coalesce(po.supplier_name, po.vendor_id::text, po.supplier_id::text) supplier,
            coalesce(po.issued_date::text, po.order_date) order_date,
            po.status, coalesce(po.total_amount, 0) total_amount,
            coalesce(items.ordered_qty, 0) ordered_qty,
            coalesce(items.received_qty, 0) received_qty,
            coalesce(items.received_value, 0) received_value,
            coalesce(billed.billed_amount, 0) billed_amount
     from purchase_orders po
     left join lateral (
       select sum(i.quantity) ordered_qty,
              sum(coalesce(i.received_quantity, 0)) received_qty,
              sum(coalesce(i.received_quantity, 0) * coalesce(i.unit_price, 0)) received_value
       from purchase_order_items i
       where coalesce(i.purchase_order_id, i.po_id) = po.id
     ) items on true
     left join lateral (
       select sum(coalesce(b.total, 0)) billed_amount
       from bills b
       where b.tenant_slug = po.tenant_slug and b.po_id::text = po.id::text
         and b.status <> 'void'
     ) billed on true
     where ${where}
     order by order_date desc`,
    params,
  );

  return (rows as any[]).map((r) => {
    const orderedQty = Number(r.ordered_qty ?? 0);
    const receivedQty = Number(r.received_qty ?? 0);
    const receivedAmount = Number(r.received_value ?? 0);
    const billed = Number(r.billed_amount ?? 0);
    return {
      orderId: r.id,
      poNumber: r.po_number ?? "",
      supplier: r.supplier ?? "",
      orderDate: String(r.order_date ?? "").slice(0, 10),
      status: r.status ?? "",
      orderedQty,
      orderedAmount: Number(r.total_amount ?? 0),
      receivedQty,
      receivedAmount,
      billedAmount: billed,
      receivedNotBilled: Math.max(0, Math.round((receivedAmount - billed) * 100) / 100),
      orderedNotReceived: Math.max(0, orderedQty - receivedQty),
      receiptPct: orderedQty > 0 ? Math.round((receivedQty / orderedQty) * 100) : 0,
      billingPct: receivedAmount > 0 ? Math.min(100, Math.round((billed / receivedAmount) * 100)) : 0,
    };
  });
}

export interface PendingItemRow {
  orderId: string;
  orderNumber: string;
  party: string;
  orderDate: string;
  itemCode: string;
  description: string;
  orderedQty: number;
  fulfilledQty: number;
  pendingQty: number;
  unitPrice: number;
  pendingValue: number;
}

/** Purchase side: PO lines received but not yet billed (GRNI accrual candidates). */
export async function itemsToBeBilledPurchase(filter: OrderAnalysisFilter): Promise<PurchaseOrderAnalysisRow[]> {
  const analysis = await purchaseOrderAnalysis(filter);
  return analysis.filter((r) => r.receivedNotBilled > 0.005);
}

/** Purchase side: PO lines ordered but not yet received. */
export async function itemsToBeReceivedPurchase(filter: OrderAnalysisFilter): Promise<PendingItemRow[]> {
  const params: any[] = [filter.tenantSlug];
  let where = `po.tenant_slug = $1`;
  where += dateRange(filter, `coalesce(po.issued_date, po.order_date::date)`, params);
  if (filter.branchId) {
    params.push(filter.branchId);
    where += ` and po.branch_id = $${params.length}`;
  }
  const { rows } = await db.query(
    `select po.id order_id, coalesce(po.po_number, po.order_number) po_number,
            coalesce(po.supplier_name, po.vendor_id::text, po.supplier_id::text) supplier,
            coalesce(po.issued_date::text, po.order_date) order_date,
            i.sku, i.description, i.quantity, coalesce(i.received_quantity, 0) received_quantity,
            coalesce(i.unit_price, 0) unit_price
     from purchase_orders po
     join purchase_order_items i on coalesce(i.purchase_order_id, i.po_id) = po.id
     where ${where} and i.quantity > coalesce(i.received_quantity, 0)
       and lower(coalesce(po.status, '')) not in ('cancelled','canceled','closed')
     order by order_date desc`,
    params,
  );
  return (rows as any[]).map((r) => {
    const pending = Number(r.quantity) - Number(r.received_quantity);
    return {
      orderId: r.order_id,
      orderNumber: r.po_number ?? "",
      party: r.supplier ?? "",
      orderDate: String(r.order_date ?? "").slice(0, 10),
      itemCode: r.sku ?? "",
      description: r.description ?? "",
      orderedQty: Number(r.quantity),
      fulfilledQty: Number(r.received_quantity),
      pendingQty: pending,
      unitPrice: Number(r.unit_price),
      pendingValue: Math.round(pending * Number(r.unit_price) * 100) / 100,
    };
  });
}

/** Sales side: orders not yet fully invoiced. */
export async function itemsToBeBilledSales(filter: OrderAnalysisFilter): Promise<SalesOrderAnalysisRow[]> {
  const analysis = await salesOrderAnalysis(filter);
  return analysis.filter((r) => !CANCELLED_STATUSES.has(r.status.toLowerCase()) && r.pendingBillingAmount > 0.005);
}

/** Sales side: orders not yet delivered. */
export async function itemsToBeDeliveredSales(filter: OrderAnalysisFilter): Promise<SalesOrderAnalysisRow[]> {
  const analysis = await salesOrderAnalysis(filter);
  return analysis.filter(
    (r) => !CANCELLED_STATUSES.has(r.status.toLowerCase()) && !r.delivered,
  );
}
