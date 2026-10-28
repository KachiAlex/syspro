import { randomUUID } from "crypto";
import { sql as SQL } from "../sql-client";

/**
 * Delivery Notes — the outbound mirror of purchase receipts. A DN records
 * what physically left the warehouse against a sales order (ordered vs
 * delivered vs rejected per line). Applying it posts the stock-out movement
 * and flips the SO to partially_delivered/delivered. SO items are JSONB —
 * lines are matched by sku (fallback description or index).
 */

export async function ensureDeliveryNoteTables(sql: any = SQL) {
  await sql`
    create table if not exists delivery_notes (
      id text primary key,
      tenant_slug text not null,
      note_number text not null,
      sales_order_id text,
      customer_id text,
      customer_name text,
      warehouse_id text,
      delivery_date date not null,
      status text not null default 'pending' check (status in ('pending','delivered','rejected','cancelled')),
      total_amount numeric not null default 0,
      approval_id text,
      driver text,
      vehicle text,
      notes text,
      created_by text,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`
    create table if not exists delivery_note_items (
      id text primary key,
      tenant_slug text not null,
      note_id text not null,
      so_line_key text,
      product_id text,
      sku text,
      description text,
      ordered_qty numeric not null default 0,
      delivered_qty numeric not null default 0,
      rejected_qty numeric not null default 0,
      unit_price numeric not null default 0,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists dni_note_idx on delivery_note_items (note_id)`;
  await sql`create index if not exists delivery_notes_tenant_idx on delivery_notes (tenant_slug, status)`;
  await sql`alter table if exists delivery_note_items add column if not exists so_line_key text`;
}

/** Delivered-so-far per SO line key (sku or description), across all
 *  non-cancelled notes for that order. */
async function deliveredSoFar(sql: any, tenantSlug: string, salesOrderId: string) {
  const rows = (await sql`
    select i.so_line_key, sum(i.delivered_qty) as qty
    from delivery_note_items i
    join delivery_notes d on d.id = i.note_id
    where d.sales_order_id = ${salesOrderId} and d.tenant_slug = ${tenantSlug}
      and d.status in ('pending','delivered')
    group by i.so_line_key
  `) as any[];
  return new Map(rows.map((r) => [String(r.so_line_key), Number(r.qty)]));
}

function soLineKey(item: any, idx: number) {
  return String(item.sku ?? item.productSku ?? item.description ?? item.name ?? `line-${idx}`);
}
function soLineQty(item: any) {
  return Number(item.qty ?? item.quantity ?? 0);
}
function soLinePrice(item: any) {
  return Number(item.unitPrice ?? item.unit_price ?? item.price ?? 0);
}

export async function createDeliveryNote(input: {
  tenantSlug: string;
  salesOrderId?: string;
  customerId?: string;
  customerName?: string;
  warehouseId?: string;
  deliveryDate: string;
  driver?: string;
  vehicle?: string;
  notes?: string;
  createdBy?: string;
  items: { soLineKey?: string; productId?: string; sku?: string; description?: string; deliveredQty: number; rejectedQty?: number; unitPrice?: number }[];
}) {
  const sql = SQL;
  await ensureDeliveryNoteTables(sql);
  if (!input.items.length) throw new Error("Delivery note needs at least one item");

  // Over-delivery guard: delivered ≤ ordered − already delivered, per line.
  if (input.salesOrderId) {
    const [so] = (await sql`
      select * from sales_orders where id = ${input.salesOrderId} and tenant_slug = ${input.tenantSlug}
    `) as any[];
    if (!so) throw new Error("Sales order not found");
    const soItems: any[] = typeof so.items === "string" ? JSON.parse(so.items) : (so.items ?? []);
    const byKey = new Map(soItems.map((i, idx) => [soLineKey(i, idx), i]));
    const delivered = await deliveredSoFar(sql, input.tenantSlug, input.salesOrderId);
    for (const line of input.items) {
      const key = line.soLineKey ?? line.sku ?? line.description;
      const soItem = key ? byKey.get(String(key)) : undefined;
      if (!soItem) continue; // free-form line not on the SO — allow
      const remaining = soLineQty(soItem) - (delivered.get(String(key)) ?? 0);
      if (line.deliveredQty > remaining + 1e-9) {
        throw new Error(
          `Over-delivery on "${soItem.description ?? soItem.name ?? key}": ` +
          `${line.deliveredQty} requested but only ${remaining} open on the order`
        );
      }
    }
  }

  const id = `dn_${randomUUID().slice(0, 12)}`;
  const total = input.items.reduce((s, i) => s + i.deliveredQty * Number(i.unitPrice ?? 0), 0);
  const now = new Date();
  const noteNumber = `DN-${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}-${id.slice(3, 9).toUpperCase()}`;

  await sql`
    insert into delivery_notes (
      id, tenant_slug, note_number, sales_order_id, customer_id, customer_name,
      warehouse_id, delivery_date, status, total_amount, driver, vehicle, notes, created_by
    ) values (
      ${id}, ${input.tenantSlug}, ${noteNumber}, ${input.salesOrderId ?? null},
      ${input.customerId ?? null}, ${input.customerName ?? null}, ${input.warehouseId ?? null},
      ${input.deliveryDate}, 'pending', ${total}, ${input.driver ?? null},
      ${input.vehicle ?? null}, ${input.notes ?? null}, ${input.createdBy ?? null}
    )
  `;
  for (const line of input.items) {
    await sql`
      insert into delivery_note_items (
        id, tenant_slug, note_id, so_line_key, product_id, sku, description,
        ordered_qty, delivered_qty, rejected_qty, unit_price
      ) values (
        ${`dni_${randomUUID().slice(0, 12)}`}, ${input.tenantSlug}, ${id},
        ${line.soLineKey ?? line.sku ?? line.description ?? null}, ${line.productId ?? null},
        ${line.sku ?? null}, ${line.description ?? null}, 0, ${line.deliveredQty},
        ${line.rejectedQty ?? 0}, ${line.unitPrice ?? 0}
      )
    `;
  }
  return { id, noteNumber, totalAmount: total, status: "pending" as const };
}

/** Applies a DN: stock-out per line, note → delivered, SO status updated. */
export async function deliverDeliveryNote(tenantSlug: string, noteId: string) {
  const sql = SQL;
  await ensureDeliveryNoteTables(sql);
  const [note] = (await sql`
    select * from delivery_notes where id = ${noteId} and tenant_slug = ${tenantSlug}
  `) as any[];
  if (!note) throw new Error("Delivery note not found");
  if (note.status !== "pending") throw new Error(`Delivery note is already ${note.status}`);

  const items = (await sql`
    select * from delivery_note_items where note_id = ${noteId}
  `) as any[];

  for (const item of items) {
    try {
      const { recordStockMovement } = await import("../inventory/stock-movements");
      await recordStockMovement(tenantSlug, {
        productSku: item.sku ?? item.product_id ?? item.description ?? "unknown",
        productName: item.description ?? null,
        movementType: "out",
        quantity: Number(item.delivered_qty),
        unitCost: Number(item.unit_price ?? 0),
        referenceType: "delivery_note",
        referenceId: noteId,
        warehouseId: note.warehouse_id ?? undefined,
        notes: `Delivery note ${note.note_number}`,
      } as any);
    } catch (err) {
      console.error(`Delivery stock-out failed for line ${item.id}:`, err);
    }
  }

  await sql`update delivery_notes set status = 'delivered', updated_at = now() where id = ${noteId}`;

  // SO status: fully delivered → 'delivered'; partial → 'partially_delivered'.
  if (note.sales_order_id) {
    const [so] = (await sql`
      select items from sales_orders where id = ${note.sales_order_id} and tenant_slug = ${tenantSlug}
    `) as any[];
    if (so) {
      const soItems: any[] = typeof so.items === "string" ? JSON.parse(so.items) : (so.items ?? []);
      const delivered = await deliveredSoFar(sql, tenantSlug, note.sales_order_id);
      const allDone = soItems.length > 0 && soItems.every((i, idx) =>
        (delivered.get(soLineKey(i, idx)) ?? 0) >= soLineQty(i)
      );
      const next = allDone ? "delivered" : "partially_delivered";
      await sql`
        update sales_orders set status = ${next}
        where id = ${note.sales_order_id} and tenant_slug = ${tenantSlug}
          and status not in ('delivered', 'cancelled', 'closed', 'invoiced')
      `;
    }
  }
  return { id: noteId, status: "delivered" as const };
}

export async function listDeliveryNotes(tenantSlug: string, filters?: { status?: string; salesOrderId?: string }) {
  const sql = SQL;
  await ensureDeliveryNoteTables(sql);
  if (filters?.salesOrderId) {
    return (await sql`select * from delivery_notes where tenant_slug = ${tenantSlug} and sales_order_id = ${filters.salesOrderId} order by created_at desc`) as any[];
  }
  if (filters?.status) {
    return (await sql`select * from delivery_notes where tenant_slug = ${tenantSlug} and status = ${filters.status} order by created_at desc`) as any[];
  }
  return (await sql`select * from delivery_notes where tenant_slug = ${tenantSlug} order by created_at desc`) as any[];
}

export async function getDeliveryNote(tenantSlug: string, noteId: string) {
  const sql = SQL;
  await ensureDeliveryNoteTables(sql);
  const [note] = (await sql`select * from delivery_notes where id = ${noteId} and tenant_slug = ${tenantSlug}`) as any[];
  if (!note) return null;
  const items = (await sql`select * from delivery_note_items where note_id = ${noteId}`) as any[];
  return { ...note, items };
}
