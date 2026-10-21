import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";

export function ensureQuotationTables() {
  return ensureOnce("sales/quotations:ensureTables", ensureQuotationTablesRun);
}

async function ensureQuotationTablesRun() {
  const sql = SQL;
  await sql`create table if not exists sales_quotations (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    quotation_number text not null,
    customer_id text,
    customer_name text not null,
    quotation_date date not null default current_date,
    valid_until date,
    status text not null default 'draft'
      check (status in ('draft','sent','accepted','rejected','expired','converted','lost')),
    currency text not null default 'NGN',
    subtotal numeric not null default 0,
    tax_total numeric not null default 0,
    total numeric not null default 0,
    notes text,
    sales_order_id text,
    lost_reason text,
    metadata jsonb,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`create unique index if not exists sales_quotations_tenant_number_uq
    on sales_quotations (tenant_slug, quotation_number)`;
  await sql`create index if not exists sales_quotations_tenant_status_idx
    on sales_quotations (tenant_slug, status)`;
  await sql`create table if not exists sales_quotation_items (
    id uuid primary key default gen_random_uuid(),
    quotation_id uuid not null references sales_quotations(id) on delete cascade,
    product_id text,
    sku text,
    description text not null,
    quantity numeric not null default 1,
    uom text,
    unit_price numeric not null default 0,
    tax_rate numeric,
    line_amount numeric not null default 0,
    metadata jsonb
  )`;
  await sql`create index if not exists sales_quotation_items_quotation_idx
    on sales_quotation_items (quotation_id)`;
  await sql`alter table if exists sales_orders add column if not exists quotation_id uuid`;
}

type QuotationItemInput = {
  productId?: string | null;
  sku?: string | null;
  description: string;
  quantity: number;
  uom?: string | null;
  unitPrice: number;
  taxRate?: number | null;
};

function nextNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function listQuotations(tenantSlug: string, status?: string) {
  await ensureQuotationTables();
  const rows = status
    ? (await db.query(
        `SELECT q.*, (SELECT count(*) FROM sales_quotation_items i WHERE i.quotation_id = q.id)::int AS item_count
         FROM sales_quotations q WHERE q.tenant_slug = $1 AND q.status = $2
         ORDER BY q.created_at DESC`,
        [tenantSlug, status]
      )).rows
    : (await db.query(
        `SELECT q.*, (SELECT count(*) FROM sales_quotation_items i WHERE i.quotation_id = q.id)::int AS item_count
         FROM sales_quotations q WHERE q.tenant_slug = $1
         ORDER BY q.created_at DESC`,
        [tenantSlug]
      )).rows;
  return rows.map(mapQuotation);
}

export async function getQuotation(tenantSlug: string, id: string) {
  await ensureQuotationTables();
  const row = (
    await db.query(
      `SELECT * FROM sales_quotations WHERE id = $1 AND tenant_slug = $2`,
      [id, tenantSlug]
    )
  ).rows[0];
  if (!row) return null;
  const items = (
    await db.query(
      `SELECT * FROM sales_quotation_items WHERE quotation_id = $1 ORDER BY id`,
      [id]
    )
  ).rows;
  return { ...mapQuotation(row), items: items.map(mapItem) };
}

export async function createQuotation(input: {
  tenantSlug: string;
  customerId?: string | null;
  customerName: string;
  quotationDate?: string;
  validUntil?: string | null;
  currency?: string;
  notes?: string | null;
  items: QuotationItemInput[];
  createdBy?: string | null;
}) {
  await ensureQuotationTables();
  if (!input.items?.length) throw new Error("At least one line item is required");

  const totals = computeTotals(input.items);
  const row = (
    await db.query(
      `INSERT INTO sales_quotations
         (tenant_slug, quotation_number, customer_id, customer_name, quotation_date,
          valid_until, currency, subtotal, tax_total, total, notes, created_by)
       VALUES ($1,$2,$3,$4,coalesce($5::date, current_date),$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        input.tenantSlug,
        nextNumber("QTN"),
        input.customerId ?? null,
        input.customerName,
        input.quotationDate ?? null,
        input.validUntil ?? null,
        input.currency ?? "NGN",
        totals.subtotal,
        totals.taxTotal,
        totals.total,
        input.notes ?? null,
        input.createdBy ?? null,
      ]
    )
  ).rows[0];

  await insertItems(row.id, input.items);
  return getQuotation(input.tenantSlug, row.id);
}

async function insertItems(quotationId: string, items: QuotationItemInput[]) {
  for (const item of items) {
    const lineAmount = Number(item.quantity) * Number(item.unitPrice);
    await db.query(
      `INSERT INTO sales_quotation_items
         (quotation_id, product_id, sku, description, quantity, uom, unit_price, tax_rate, line_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        quotationId,
        item.productId ?? null,
        item.sku ?? null,
        item.description,
        item.quantity,
        item.uom ?? null,
        item.unitPrice,
        item.taxRate ?? null,
        lineAmount,
      ]
    );
  }
}

function computeTotals(items: QuotationItemInput[]) {
  let subtotal = 0;
  let taxTotal = 0;
  for (const item of items) {
    const line = Number(item.quantity) * Number(item.unitPrice);
    subtotal += line;
    if (item.taxRate) taxTotal += (line * Number(item.taxRate)) / 100;
  }
  return { subtotal, taxTotal, total: subtotal + taxTotal };
}

export async function updateQuotationStatus(
  tenantSlug: string,
  id: string,
  status: "sent" | "accepted" | "rejected" | "expired" | "lost",
  lostReason?: string | null
) {
  await ensureQuotationTables();
  const row = (
    await db.query(
      `UPDATE sales_quotations
       SET status = $1, lost_reason = $2, updated_at = now()
       WHERE id = $3 AND tenant_slug = $4 AND status IN ('draft','sent')
       RETURNING *`,
      [status, lostReason ?? null, id, tenantSlug]
    )
  ).rows[0];
  if (!row) throw new Error("Quotation not found or already closed");
  return mapQuotation(row);
}

/**
 * Convert an accepted/draft quotation into a sales order. Reuses the
 * canonical sales_orders table so downstream fulfillment→invoice→GL is
 * unchanged. Idempotent via sales_order_id on the quotation row.
 */
export async function convertToSalesOrder(
  tenantSlug: string,
  quotationId: string,
  userId?: string
) {
  await ensureQuotationTables();
  const quote = await getQuotation(tenantSlug, quotationId);
  if (!quote) throw new Error("Quotation not found");
  if (quote.salesOrderId) return { salesOrderId: quote.salesOrderId, alreadyConverted: true };
  if (["rejected", "expired", "lost"].includes(quote.status)) {
    throw new Error(`Cannot convert a ${quote.status} quotation`);
  }

  const items = quote.items.map((i: any) => ({
    description: i.description,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  }));
  const total = items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
  const quantity = items.reduce((s: number, i: any) => s + i.quantity, 0);

  const orderId = `so_${Date.now()}_${randomUUID().slice(0, 6)}`;
  const orderNumber = `SO-${Date.now().toString().slice(-6)}`;
  await db.query(
    `INSERT INTO sales_orders
       (id, tenant_slug, order_number, customer_id, customer_name, order_date,
        items, quantity, total, status, notes, quotation_id, created_at)
     VALUES ($1,$2,$3,$4,$5,current_date::text,$6,$7,$8,'Pending',$9,$10,now())`,
    [
      orderId,
      tenantSlug,
      orderNumber,
      quote.customerId,
      quote.customerName,
      JSON.stringify(items),
      quantity,
      total,
      quote.notes ?? null,
      quotationId,
    ]
  );
  await db.query(
    `UPDATE sales_quotations
     SET status = 'converted', sales_order_id = $1, updated_at = now()
     WHERE id = $2 AND tenant_slug = $3`,
    [orderId, quotationId, tenantSlug]
  );
  return { salesOrderId: orderId, orderNumber, alreadyConverted: false };
}

/** Expire sent/draft quotations past valid_until. Called by scheduler/API. */
export async function expireStaleQuotations(tenantSlug: string) {
  await ensureQuotationTables();
  const res = await db.query(
    `UPDATE sales_quotations
     SET status = 'expired', updated_at = now()
     WHERE tenant_slug = $1 AND status IN ('draft','sent')
       AND valid_until IS NOT NULL AND valid_until < current_date
     RETURNING id`,
    [tenantSlug]
  );
  return { expired: res.rowCount ?? 0 };
}

function mapQuotation(row: any) {
  return {
    id: row.id,
    quotationNumber: row.quotation_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    quotationDate: row.quotation_date,
    validUntil: row.valid_until,
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal ?? 0),
    taxTotal: Number(row.tax_total ?? 0),
    total: Number(row.total ?? 0),
    notes: row.notes,
    salesOrderId: row.sales_order_id,
    lostReason: row.lost_reason,
    itemCount: row.item_count != null ? Number(row.item_count) : undefined,
    createdAt: row.created_at,
  };
}

function mapItem(row: any) {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    description: row.description,
    quantity: Number(row.quantity),
    uom: row.uom,
    unitPrice: Number(row.unit_price),
    taxRate: row.tax_rate != null ? Number(row.tax_rate) : null,
    lineAmount: Number(row.line_amount),
  };
}
