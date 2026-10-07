import { db } from "@/lib/sql-client";
import { insertFinanceInvoice } from "@/lib/finance/db";
import { writeFinanceEvent } from "@/lib/finance/events";

export async function ensureSalesOrdersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS sales_orders (
      id text primary key,
      tenant_slug text not null,
      order_number text not null,
      customer_id text,
      customer_name text,
      order_date text,
      due_date text,
      items text,
      quantity numeric default 0,
      total numeric default 0,
      status text default 'Pending',
      notes text,
      deal_id text,
      invoice_id text,
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant ON sales_orders (tenant_slug)`);
  await db.query(`ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS deal_id text`);
  await db.query(`ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS invoice_id text`);
}

export function parseItems(itemsRaw: any) {
  if (Array.isArray(itemsRaw)) return itemsRaw;
  if (!itemsRaw) return [];
  try {
    const parsed = JSON.parse(itemsRaw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function computeTotal(items: any[]) {
  return items.reduce((sum: number, item: any) => sum + (Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0)), 0);
}

export function computeQuantity(items: any[]) {
  return items.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0);
}

export function mapOrder(row: any) {
  const items = parseItems(row.items);
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customer: row.customer_name ?? row.customer_id ?? "",
    amount: Number(row.total ?? computeTotal(items)),
    total: Number(row.total ?? computeTotal(items)),
    quantity: Number(row.quantity ?? computeQuantity(items)),
    status: row.status ?? "Pending",
    orderDate: row.order_date ?? "",
    dueDate: row.due_date ?? "",
    items: items.length,
    notes: row.notes ?? "",
    dealId: row.deal_id ?? null,
    invoiceId: row.invoice_id ?? null,
  };
}

export async function findOrder(id: string, tenantSlug: string) {
  const result = await db.query(
    `SELECT * FROM sales_orders WHERE id = $1 AND tenant_slug = $2`,
    [id, tenantSlug]
  );
  return result.rows[0] ?? null;
}

export async function validateDeal(dealId: string, tenantSlug: string) {
  const result = await db.query(
    `SELECT id, name, value, currency, stage FROM crm_deals WHERE id = $1 AND tenant_slug = $2`,
    [dealId, tenantSlug]
  );
  return result.rows[0] ?? null;
}

/**
 * Fulfillment chain: when an order reaches a completed/fulfilled state,
 * draft a canonical finance invoice from its items and publish a finance
 * event — the same downstream integration a won CRM deal triggers.
 * Idempotent: orders that already carry invoice_id are skipped.
 */
export async function fulfillOrder(order: any, tenantSlug: string, userId?: string) {
  if (!order || order.invoice_id) return null;

  const items = parseItems(order.items);
  const total = Number(order.total ?? computeTotal(items));
  const lineItems = (items.length
    ? items
    : [{ description: `Sales order ${order.order_number}`, quantity: 1, unitPrice: total }]
  ).map((item: any) => {
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPrice ?? item.unit_price ?? 0);
    return {
      description: String(item.description ?? item.name ?? "Order item"),
      quantity,
      unitPrice,
      amount: quantity * unitPrice,
    };
  });

  const issued = new Date().toISOString().split("T")[0];
  const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const invoice = await insertFinanceInvoice({
    tenantSlug,
    customerName: order.customer_name ?? order.customer_id ?? "Customer",
    invoiceNumber: `INV-${order.order_number}`,
    issuedDate: issued,
    dueDate: due,
    currency: "NGN",
    amount: total,
    status: "draft",
    lineItems,
    metadata: { salesOrderId: order.id, dealId: order.deal_id ?? null },
  });

  await db.query(
    `UPDATE sales_orders SET invoice_id = $1 WHERE id = $2 AND tenant_slug = $3`,
    [invoice.id, order.id, tenantSlug]
  );

  await writeFinanceEvent({
    tenantSlug,
    eventType: "invoice_issued",
    sourceModule: "sales",
    sourceRecordId: order.id,
    userId,
    amount: total,
    currency: "NGN",
    metadata: { orderNumber: order.order_number, invoiceId: invoice.id, dealId: order.deal_id ?? null },
  });

  return invoice;
}
