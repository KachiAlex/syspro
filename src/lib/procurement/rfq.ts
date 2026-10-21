import { randomUUID } from "crypto";

import { db, sql as SQL } from "@/lib/sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { createPurchaseOrder } from "@/lib/finance/purchase-orders";
import { writeFinanceEvent } from "@/lib/finance/events";

export function ensureRfqTables() {
  return ensureOnce("procurement/rfq:ensureTables", ensureRfqTablesRun);
}

async function ensureRfqTablesRun() {
  const sql = SQL;
  await sql`create table if not exists procurement_rfqs (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    rfq_number text not null,
    title text not null,
    status text not null default 'draft'
      check (status in ('draft','sent','closed','cancelled')),
    required_by date,
    metadata jsonb,
    created_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`create unique index if not exists procurement_rfqs_tenant_number_uq
    on procurement_rfqs (tenant_slug, rfq_number)`;
  await sql`create table if not exists procurement_rfq_items (
    id uuid primary key default gen_random_uuid(),
    rfq_id uuid not null references procurement_rfqs(id) on delete cascade,
    product_id text,
    sku text,
    description text not null,
    quantity numeric not null default 1,
    uom text,
    target_price numeric
  )`;
  await sql`create index if not exists procurement_rfq_items_rfq_idx
    on procurement_rfq_items (rfq_id)`;
  await sql`create table if not exists procurement_rfq_suppliers (
    id uuid primary key default gen_random_uuid(),
    rfq_id uuid not null references procurement_rfqs(id) on delete cascade,
    vendor_id uuid not null,
    unique (rfq_id, vendor_id)
  )`;
  await sql`create table if not exists procurement_supplier_quotations (
    id uuid primary key default gen_random_uuid(),
    tenant_slug text not null,
    rfq_id uuid not null references procurement_rfqs(id) on delete cascade,
    vendor_id uuid not null,
    vendor_name text not null,
    status text not null default 'submitted'
      check (status in ('submitted','awarded','rejected','withdrawn')),
    currency text not null default 'NGN',
    subtotal numeric not null default 0,
    tax_total numeric not null default 0,
    total numeric not null default 0,
    valid_until date,
    notes text,
    purchase_order_id uuid,
    metadata jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`;
  await sql`create index if not exists procurement_sq_tenant_idx
    on procurement_supplier_quotations (tenant_slug, status)`;
  await sql`create index if not exists procurement_sq_rfq_idx
    on procurement_supplier_quotations (rfq_id)`;
  await sql`create table if not exists procurement_supplier_quotation_items (
    id uuid primary key default gen_random_uuid(),
    quotation_id uuid not null references procurement_supplier_quotations(id) on delete cascade,
    rfq_item_id uuid,
    product_id text,
    description text not null,
    quantity numeric not null default 1,
    uom text,
    unit_price numeric not null default 0,
    line_amount numeric not null default 0
  )`;
  await sql`alter table if exists purchase_orders add column if not exists rfq_id uuid`;
  await sql`alter table if exists purchase_orders add column if not exists supplier_quotation_id uuid`;
}

function nextNumber(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
}

export async function listRfqs(tenantSlug: string) {
  await ensureRfqTables();
  const rows = (
    await db.query(
      `SELECT r.*,
         (SELECT count(*) FROM procurement_rfq_items i WHERE i.rfq_id = r.id)::int AS item_count,
         (SELECT count(*) FROM procurement_rfq_suppliers s WHERE s.rfq_id = r.id)::int AS supplier_count,
         (SELECT count(*) FROM procurement_supplier_quotations q WHERE q.rfq_id = r.id AND q.status = 'submitted')::int AS quote_count
       FROM procurement_rfqs r WHERE r.tenant_slug = $1 ORDER BY r.created_at DESC`,
      [tenantSlug]
    )
  ).rows;
  return rows.map(mapRfq);
}

export async function getRfq(tenantSlug: string, id: string) {
  await ensureRfqTables();
  const row = (
    await db.query(`SELECT * FROM procurement_rfqs WHERE id = $1 AND tenant_slug = $2`, [id, tenantSlug])
  ).rows[0];
  if (!row) return null;
  const [items, suppliers, quotes] = await Promise.all([
    db.query(`SELECT * FROM procurement_rfq_items WHERE rfq_id = $1 ORDER BY id`, [id]),
    db.query(`SELECT * FROM procurement_rfq_suppliers WHERE rfq_id = $1`, [id]),
    db.query(
      `SELECT * FROM procurement_supplier_quotations WHERE rfq_id = $1 ORDER BY total ASC`,
      [id]
    ),
  ]);
  const quoteItems = quotes.rows.length
    ? (
        await db.query(
          `SELECT * FROM procurement_supplier_quotation_items
           WHERE quotation_id = ANY($1::uuid[]) ORDER BY quotation_id, id`,
          [quotes.rows.map((q: any) => q.id)]
        )
      ).rows
    : [];
  return {
    ...mapRfq(row),
    items: items.rows,
    suppliers: suppliers.rows.map((s: any) => s.vendor_id),
    quotations: quotes.rows.map((q: any) => ({
      ...mapQuote(q),
      items: quoteItems.filter((i: any) => i.quotation_id === q.id),
    })),
  };
}

export async function createRfq(input: {
  tenantSlug: string;
  title: string;
  requiredBy?: string | null;
  items: { productId?: string | null; sku?: string | null; description: string; quantity: number; uom?: string | null; targetPrice?: number | null }[];
  vendorIds: string[];
  createdBy?: string | null;
}) {
  await ensureRfqTables();
  if (!input.items?.length) throw new Error("At least one item is required");
  if (!input.vendorIds?.length) throw new Error("At least one supplier is required");

  const row = (
    await db.query(
      `INSERT INTO procurement_rfqs (tenant_slug, rfq_number, title, required_by, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.tenantSlug, nextNumber("RFQ"), input.title, input.requiredBy ?? null, input.createdBy ?? null]
    )
  ).rows[0];

  for (const item of input.items) {
    await db.query(
      `INSERT INTO procurement_rfq_items (rfq_id, product_id, sku, description, quantity, uom, target_price)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, item.productId ?? null, item.sku ?? null, item.description, item.quantity, item.uom ?? null, item.targetPrice ?? null]
    );
  }
  for (const vendorId of input.vendorIds) {
    await db.query(
      `INSERT INTO procurement_rfq_suppliers (rfq_id, vendor_id) VALUES ($1,$2)
       ON CONFLICT (rfq_id, vendor_id) DO NOTHING`,
      [row.id, vendorId]
    );
  }
  return getRfq(input.tenantSlug, row.id);
}

export async function sendRfq(tenantSlug: string, rfqId: string) {
  await ensureRfqTables();
  const res = await db.query(
    `UPDATE procurement_rfqs SET status = 'sent', updated_at = now()
     WHERE id = $1 AND tenant_slug = $2 AND status = 'draft' RETURNING id`,
    [rfqId, tenantSlug]
  );
  if (!res.rows[0]) throw new Error("RFQ not found or already sent");
  return { ok: true };
}

/** Record a supplier's quotation against an RFQ. */
export async function recordSupplierQuotation(input: {
  tenantSlug: string;
  rfqId: string;
  vendorId: string;
  vendorName: string;
  currency?: string;
  validUntil?: string | null;
  notes?: string | null;
  items: { rfqItemId?: string | null; productId?: string | null; description: string; quantity: number; uom?: string | null; unitPrice: number }[];
}) {
  await ensureRfqTables();
  const rfq = (
    await db.query(`SELECT status FROM procurement_rfqs WHERE id = $1 AND tenant_slug = $2`, [input.rfqId, input.tenantSlug])
  ).rows[0];
  if (!rfq) throw new Error("RFQ not found");

  let subtotal = 0;
  for (const i of input.items) subtotal += Number(i.quantity) * Number(i.unitPrice);

  const row = (
    await db.query(
      `INSERT INTO procurement_supplier_quotations
         (tenant_slug, rfq_id, vendor_id, vendor_name, currency, subtotal, total, valid_until, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8) RETURNING *`,
      [input.tenantSlug, input.rfqId, input.vendorId, input.vendorName, input.currency ?? "NGN", subtotal, input.validUntil ?? null, input.notes ?? null]
    )
  ).rows[0];

  for (const item of input.items) {
    await db.query(
      `INSERT INTO procurement_supplier_quotation_items
         (quotation_id, rfq_item_id, product_id, description, quantity, uom, unit_price, line_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [row.id, item.rfqItemId ?? null, item.productId ?? null, item.description, item.quantity, item.uom ?? null, item.unitPrice, Number(item.quantity) * Number(item.unitPrice)]
    );
  }
  return mapQuote(row);
}

/** Line-item comparison across submitted quotations for an RFQ. */
export async function compareQuotations(tenantSlug: string, rfqId: string) {
  const rfq = await getRfq(tenantSlug, rfqId);
  if (!rfq) throw new Error("RFQ not found");
  const submitted = (rfq as any).quotations.filter((q: any) => q.status === "submitted");

  const comparison = (rfq as any).items.map((rfqItem: any) => {
    const offers = submitted.map((q: any) => {
      const line = q.items.find(
        (i: any) => i.rfq_item_id === rfqItem.id || (i.product_id && i.product_id === rfqItem.product_id)
      );
      return line
        ? { quotationId: q.id, vendorId: q.vendorId, vendorName: q.vendorName, unitPrice: Number(line.unit_price), lineAmount: Number(line.line_amount) }
        : null;
    }).filter(Boolean);
    const best = offers.reduce((min: any, o: any) => (min == null || o.unitPrice < min.unitPrice ? o : min), null);
    return {
      rfqItemId: rfqItem.id,
      description: rfqItem.description,
      quantity: Number(rfqItem.quantity),
      bestUnitPrice: best?.unitPrice ?? null,
      bestVendorName: best?.vendorName ?? null,
      offers,
    };
  });

  const vendorTotals = submitted.map((q: any) => ({
    quotationId: q.id,
    vendorId: q.vendorId,
    vendorName: q.vendorName,
    total: q.total,
    currency: q.currency,
  })).sort((a: any, b: any) => a.total - b.total);

  return { rfq: mapRfq(rfq as any), comparison, vendorTotals };
}

/**
 * Award a supplier quotation: marks it awarded, rejects the rest, creates a
 * canonical purchase order, and closes the RFQ.
 */
export async function awardQuotation(input: {
  tenantSlug: string;
  rfqId: string;
  quotationId: string;
  userId?: string;
}) {
  await ensureRfqTables();
  const quote = (
    await db.query(
      `SELECT * FROM procurement_supplier_quotations
       WHERE id = $1 AND rfq_id = $2 AND tenant_slug = $3 AND status = 'submitted'`,
      [input.quotationId, input.rfqId, input.tenantSlug]
    )
  ).rows[0];
  if (!quote) throw new Error("Quotation not found or already closed");

  const items = (
    await db.query(`SELECT * FROM procurement_supplier_quotation_items WHERE quotation_id = $1`, [quote.id])
  ).rows;

  const today = new Date().toISOString().split("T")[0];
  const po = await createPurchaseOrder({
    tenantSlug: input.tenantSlug,
    supplierId: quote.vendor_id,
    orderNumber: `PO-${Date.now().toString().slice(-6)}`,
    issuedDate: today,
    dueDate: today,
    currency: quote.currency ?? "NGN",
    items: items.map((i: any) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
    })),
  });

  await db.query(
    `UPDATE procurement_supplier_quotations
     SET status = 'awarded', purchase_order_id = $1, updated_at = now()
     WHERE id = $2`,
    [po.id, quote.id]
  );
  await db.query(
    `UPDATE procurement_supplier_quotations
     SET status = 'rejected', updated_at = now()
     WHERE rfq_id = $1 AND id <> $2 AND status = 'submitted'`,
    [input.rfqId, quote.id]
  );
  await db.query(
    `UPDATE procurement_rfqs SET status = 'closed', updated_at = now()
     WHERE id = $1 AND tenant_slug = $2`,
    [input.rfqId, input.tenantSlug]
  );
  await db.query(
    `UPDATE purchase_orders SET rfq_id = $1, supplier_quotation_id = $2 WHERE id = $3`,
    [input.rfqId, quote.id, po.id]
  );

  writeFinanceEvent({
    tenantSlug: input.tenantSlug,
    eventType: "rfq_awarded",
    sourceModule: "procurement",
    sourceRecordId: input.rfqId,
    userId: input.userId,
    amount: Number(quote.total ?? 0),
    currency: quote.currency ?? "NGN",
    metadata: { quotationId: quote.id, purchaseOrderId: po.id, vendorId: quote.vendor_id },
  }).catch(() => {});

  return { quotationId: quote.id, purchaseOrderId: po.id, orderNumber: po.orderNumber };
}

function mapRfq(row: any) {
  return {
    id: row.id,
    rfqNumber: row.rfq_number,
    title: row.title,
    status: row.status,
    requiredBy: row.required_by,
    itemCount: row.item_count != null ? Number(row.item_count) : undefined,
    supplierCount: row.supplier_count != null ? Number(row.supplier_count) : undefined,
    quoteCount: row.quote_count != null ? Number(row.quote_count) : undefined,
    createdAt: row.created_at,
  };
}

function mapQuote(row: any) {
  return {
    id: row.id,
    rfqId: row.rfq_id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    status: row.status,
    currency: row.currency,
    subtotal: Number(row.subtotal ?? 0),
    taxTotal: Number(row.tax_total ?? 0),
    total: Number(row.total ?? 0),
    validUntil: row.valid_until,
    notes: row.notes,
    purchaseOrderId: row.purchase_order_id,
    createdAt: row.created_at,
  };
}
