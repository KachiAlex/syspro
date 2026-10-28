import { randomUUID } from "crypto";
import { sql as SQL } from "../sql-client";

/**
 * Purchase Receipts (GRN) — the goods-in document between the PO and the
 * bill. A receipt records what physically arrived (ordered vs received vs
 * rejected per line); applying it bumps purchase_order_items.received_quantity
 * and posts the stock-in movement. Bills then match 3-way: billed qty can
 * never exceed received qty for a PO-backed bill.
 */

export async function ensurePurchaseReceiptTables(sql: any = SQL) {
  await sql`
    create table if not exists purchase_receipts (
      id text primary key,
      tenant_slug text not null,
      receipt_number text not null,
      purchase_order_id text,
      vendor_id text,
      vendor_name text,
      warehouse_id text,
      location text,
      received_date date not null,
      status text not null default 'pending' check (status in ('pending','received','rejected','cancelled')),
      total_amount numeric not null default 0,
      approval_id text,
      notes text,
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`
    create table if not exists purchase_receipt_items (
      id text primary key,
      tenant_slug text not null,
      receipt_id text not null,
      po_item_id text,
      product_id text,
      sku text,
      description text,
      ordered_qty numeric not null default 0,
      received_qty numeric not null default 0,
      rejected_qty numeric not null default 0,
      unit_price numeric not null default 0,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists pri_receipt_idx on purchase_receipt_items (receipt_id)`;
  await sql`create index if not exists purchase_receipts_tenant_idx on purchase_receipts (tenant_slug, status)`;
}

export interface ReceiptItemInput {
  poItemId?: string;
  productId?: string;
  sku?: string;
  description?: string;
  orderedQty?: number;
  receivedQty: number;
  rejectedQty?: number;
  unitPrice?: number;
}

export async function createPurchaseReceipt(input: {
  tenantSlug: string;
  purchaseOrderId?: string;
  vendorId?: string;
  vendorName?: string;
  warehouseId?: string;
  location?: string;
  receivedDate: string;
  notes?: string;
  createdBy?: string;
  items: ReceiptItemInput[];
}) {
  const sql = SQL;
  await ensurePurchaseReceiptTables(sql);
  if (!input.items.length) throw new Error("Receipt needs at least one item");

  // Validate against the PO: cannot receive more than ordered − already
  // received per line (the 3-way match floor).
  let poItems: any[] = [];
  if (input.purchaseOrderId) {
    poItems = (await sql`
      select * from purchase_order_items
      where coalesce(purchase_order_id, po_id) = ${input.purchaseOrderId}
    `) as any[];
    const byId = new Map(poItems.map((i) => [String(i.id), i]));
    for (const item of input.items) {
      const poItem = item.poItemId ? byId.get(String(item.poItemId)) : undefined;
      if (!poItem) continue;
      const remaining = Number(poItem.quantity) - Number(poItem.received_quantity ?? 0);
      if (Number(item.receivedQty) > remaining + 1e-9) {
        throw new Error(
          `Over-receipt on "${poItem.description ?? poItem.sku}": ` +
          `${item.receivedQty} received but only ${remaining} open on the PO`
        );
      }
    }
  }

  const id = `pr_${randomUUID().slice(0, 12)}`;
  const now = new Date();
  const total = input.items.reduce(
    (s, i) => s + Number(i.receivedQty) * Number(i.unitPrice ?? 0), 0
  );
  const receiptNumber = `GRN-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${id.slice(3, 9).toUpperCase()}`;

  await sql`
    insert into purchase_receipts (
      id, tenant_slug, receipt_number, purchase_order_id, vendor_id, vendor_name,
      warehouse_id, location, received_date, status, total_amount, notes, created_by
    ) values (
      ${id}, ${input.tenantSlug}, ${receiptNumber}, ${input.purchaseOrderId ?? null},
      ${input.vendorId ?? null}, ${input.vendorName ?? null}, ${input.warehouseId ?? null},
      ${input.location ?? null}, ${input.receivedDate}, 'pending', ${total},
      ${input.notes ?? null}, ${input.createdBy ?? null}
    )
  `;
  for (const item of input.items) {
    await sql`
      insert into purchase_receipt_items (
        id, tenant_slug, receipt_id, po_item_id, product_id, sku, description,
        ordered_qty, received_qty, rejected_qty, unit_price
      ) values (
        ${`pri_${randomUUID().slice(0, 12)}`}, ${input.tenantSlug}, ${id},
        ${item.poItemId ?? null}, ${item.productId ?? null}, ${item.sku ?? null},
        ${item.description ?? null}, ${item.orderedQty ?? 0}, ${item.receivedQty},
        ${item.rejectedQty ?? 0}, ${item.unitPrice ?? 0}
      )
    `;
  }
  return { id, receiptNumber, totalAmount: total, status: "pending" as const };
}

/** Applies a receipt: bumps PO received_quantity per line, posts the
 *  stock-in movement per received line, flips status → received. */
export async function receivePurchaseReceipt(tenantSlug: string, receiptId: string, decidedBy?: string) {
  const sql = SQL;
  await ensurePurchaseReceiptTables(sql);
  const [receipt] = (await sql`
    select * from purchase_receipts where id = ${receiptId} and tenant_slug = ${tenantSlug}
  `) as any[];
  if (!receipt) throw new Error("Receipt not found");
  if (receipt.status !== "pending") throw new Error(`Receipt is already ${receipt.status}`);

  const items = (await sql`
    select * from purchase_receipt_items where receipt_id = ${receiptId}
  `) as any[];

  for (const item of items) {
    if (item.po_item_id) {
      await sql`
        update purchase_order_items
        set received_quantity = coalesce(received_quantity, 0) + ${Number(item.received_qty)},
            updated_at = now()
        where id = ${item.po_item_id}
      `;
    }
    // Stock-in — the goods physically entered the warehouse.
    try {
      const { recordStockMovement } = await import("../inventory/stock-movements");
      await recordStockMovement(tenantSlug, {
        productSku: item.sku ?? item.product_id ?? item.description ?? "unknown",
        productName: item.description ?? null,
        movementType: "in",
        quantity: Number(item.received_qty),
        unitCost: Number(item.unit_price ?? 0),
        referenceType: "purchase_receipt",
        referenceId: receiptId,
        warehouseId: receipt.warehouse_id ?? undefined,
        notes: `Purchase receipt ${receipt.receipt_number}`,
      } as any);
    } catch (err) {
      console.error(`Receipt stock-in failed for line ${item.id}:`, err);
    }
  }

  await sql`
    update purchase_receipts set status = 'received', updated_at = now()
    where id = ${receiptId}
  `;

  // PO status: fully received → 'received'; partial → 'partially_received'.
  if (receipt.purchase_order_id) {
    const [agg] = (await sql`
      select coalesce(sum(quantity),0) as ordered,
             coalesce(sum(received_quantity),0) as received
      from purchase_order_items
      where coalesce(purchase_order_id, po_id) = ${receipt.purchase_order_id}
    `) as any[];
    const next = Number(agg?.received ?? 0) >= Number(agg?.ordered ?? 0) && Number(agg?.ordered) > 0
      ? "received" : "partially_received";
    await sql`
      update purchase_orders set status = ${next}
      where id = ${receipt.purchase_order_id} and tenant_slug = ${tenantSlug}
        and status not in ('received', 'cancelled', 'closed')
    `;
  }
  return { id: receiptId, status: "received" as const };
}

export async function listPurchaseReceipts(tenantSlug: string, filters?: { status?: string; purchaseOrderId?: string }) {
  const sql = SQL;
  await ensurePurchaseReceiptTables(sql);
  if (filters?.purchaseOrderId) {
    return (await sql`
      select * from purchase_receipts where tenant_slug = ${tenantSlug}
        and purchase_order_id = ${filters.purchaseOrderId} order by created_at desc
    `) as any[];
  }
  if (filters?.status) {
    return (await sql`
      select * from purchase_receipts where tenant_slug = ${tenantSlug}
        and status = ${filters.status} order by created_at desc
    `) as any[];
  }
  return (await sql`
    select * from purchase_receipts where tenant_slug = ${tenantSlug} order by created_at desc
  `) as any[];
}

export async function getPurchaseReceipt(tenantSlug: string, receiptId: string) {
  const sql = SQL;
  await ensurePurchaseReceiptTables(sql);
  const [receipt] = (await sql`
    select * from purchase_receipts where id = ${receiptId} and tenant_slug = ${tenantSlug}
  `) as any[];
  if (!receipt) return null;
  const items = (await sql`
    select * from purchase_receipt_items where receipt_id = ${receiptId}
  `) as any[];
  return { ...receipt, items };
}
