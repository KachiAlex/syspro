import { randomUUID } from "node:crypto";
import { sql as SQL, db } from "../sql-client";
import { ensureOnce } from "@/lib/ensure-once";
import { ensureSalesOrdersTable, fulfillOrder } from "../sales/orders";
import { recordStockMovement } from "../inventory/stock-movements";

export function ensureStorefrontTables(...args: Parameters<typeof ensureRun>) {
  return ensureOnce("storefront/orders:ensure", () => ensureRun(...args));
}

async function ensureRun(sql = SQL) {
  await sql`
    create table if not exists storefront_orders (
      id text primary key,
      tenant_slug text not null,
      order_number text not null,
      customer_name text not null,
      customer_email text,
      customer_phone text,
      items jsonb not null,
      total numeric not null,
      status text not null default 'pending' check (status in ('pending','confirmed','fulfilled','cancelled')),
      sales_order_id text,
      notes text,
      created_at timestamptz not null default now()
    )
  `;
}

/**
 * Public catalog — sellable products with positive stock. Tenant slug in the
 * URL is the public store identifier; no auth on the read path.
 */
export async function getCatalog(tenantSlug: string, opts: { category?: string; q?: string } = {}) {
  const sql = SQL;
  const rows = (await sql`
    select sku, name, category, description, sale_price, current_stock
    from inventory_products
    where tenant_slug = ${tenantSlug}
      and current_stock > 0
      and coalesce(sale_price, 0) > 0
      and (${opts.category ?? null}::text is null or category = ${opts.category ?? null})
      and (${opts.q ?? null}::text is null or name ilike ${"%" + (opts.q ?? "") + "%"})
    order by name limit 500
  `) as any[];
  return rows.map((r) => ({
    sku: r.sku,
    name: r.name,
    category: r.category,
    description: r.description,
    price: Number(r.sale_price),
    inStock: Number(r.current_stock),
  }));
}

/**
 * Public order placement — pricing is resolved server-side from sale_price;
 * the client cannot set prices. Stock availability is checked but not
 * reserved until admin confirmation.
 */
export async function placeOrder(
  tenantSlug: string,
  input: {
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    items: Array<{ sku: string; quantity: number }>;
    notes?: string;
  }
): Promise<{ id: string; orderNumber: string; total: number }> {
  const sql = SQL;
  await ensureStorefrontTables(sql);
  if (!input.items?.length) throw new Error("Order requires at least one item");

  const resolved: any[] = [];
  for (const item of input.items) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error(`Invalid quantity for ${item.sku}`);
    const rows = (await sql`
      select sku, name, sale_price, current_stock
      from inventory_products
      where tenant_slug = ${tenantSlug} and sku = ${item.sku}
    `) as any[];
    const p = rows[0];
    if (!p) throw new Error(`Unknown product "${item.sku}"`);
    if (Number(p.current_stock) < qty) {
      throw new Error(`Insufficient stock for "${p.name}" (${p.current_stock} available)`);
    }
    const price = Number(p.sale_price ?? 0);
    resolved.push({
      sku: p.sku,
      name: p.name,
      quantity: qty,
      unitPrice: price,
      amount: Math.round(qty * price * 100) / 100,
    });
  }
  const total = Math.round(resolved.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  const id = `so_${randomUUID().slice(0, 12)}`;
  const orderNumber = `WEB-${Date.now().toString(36).toUpperCase()}`;
  await sql`
    insert into storefront_orders (id, tenant_slug, order_number, customer_name, customer_email, customer_phone, items, total, status, notes, created_at)
    values (${id}, ${tenantSlug}, ${orderNumber}, ${input.customerName}, ${input.customerEmail ?? null},
            ${input.customerPhone ?? null}, ${JSON.stringify(resolved)}, ${total}, 'pending', ${input.notes ?? null}, now())
  `;
  return { id, orderNumber, total };
}

export async function getOrderStatus(tenantSlug: string, orderNumber: string, email?: string) {
  const sql = SQL;
  await ensureStorefrontTables(sql);
  const rows = (await sql`
    select order_number, customer_name, items, total, status, created_at
    from storefront_orders
    where tenant_slug = ${tenantSlug} and order_number = ${orderNumber}
      and (${email ?? null}::text is null or lower(customer_email) = lower(${email ?? null}))
  `) as any[];
  const r = rows[0];
  if (!r) return null;
  return {
    orderNumber: r.order_number,
    customerName: r.customer_name,
    items: typeof r.items === "string" ? JSON.parse(r.items) : r.items,
    total: Number(r.total),
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function listOrders(tenantSlug: string, opts: { status?: string; limit?: number } = {}) {
  const sql = SQL;
  await ensureStorefrontTables(sql);
  const rows = (await sql`
    select * from storefront_orders
    where tenant_slug = ${tenantSlug}
      and (${opts.status ?? null}::text is null or status = ${opts.status ?? null})
    order by created_at desc limit ${Math.min(opts.limit ?? 100, 500)}
  `) as any[];
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.order_number,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    customerPhone: r.customer_phone,
    items: typeof r.items === "string" ? JSON.parse(r.items) : r.items,
    total: Number(r.total),
    status: r.status,
    salesOrderId: r.sales_order_id,
    notes: r.notes,
    createdAt: r.created_at,
  }));
}

/**
 * Admin: confirm a pending storefront order — creates a real sales_order,
 * fulfills it (draft finance invoice), and decrements stock. Idempotent.
 */
export async function confirmOrder(
  tenantSlug: string,
  orderId: string,
  userId?: string
): Promise<{ error?: string; salesOrderId?: string; invoiceId?: string }> {
  const sql = SQL;
  await ensureStorefrontTables(sql);
  await ensureSalesOrdersTable();
  const rows = (await sql`
    select * from storefront_orders
    where id = ${orderId} and tenant_slug = ${tenantSlug}
  `) as any[];
  const order = rows[0];
  if (!order) return { error: "Order not found" };
  if (order.status !== "pending") {
    return { error: `Order is already ${order.status}`, salesOrderId: order.sales_order_id };
  }
  const items = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
  const today = new Date().toISOString().split("T")[0];

  // Pre-validate the whole basket before ANY mutation — serial-tracked items
  // can't be auto-issued, so bail out here rather than mid-loop after the
  // sales order and earlier stock movements have already committed.
  for (const item of items) {
    const product = (await sql`
      select sku, name, tracking, current_stock from inventory_products
      where tenant_slug = ${tenantSlug} and sku = ${item.sku}
    `) as any[];
    const p = product[0];
    if (!p) return { error: `Product ${item.sku} no longer exists` };
    if (p.tracking === "serial") {
      return { error: `"${p.name}" is serial-tracked — issue serials manually before confirming` };
    }
    if (Number(p.current_stock) < Number(item.quantity)) {
      return { error: `Insufficient stock for "${p.name}" (${p.current_stock} available)` };
    }
  }

  // Create the sales order (same convention as the sales module).
  const salesOrderId = `so-${randomUUID().slice(0, 10)}`;
  await db.query(
    `insert into sales_orders (id, tenant_slug, order_number, customer_name, order_date, items, quantity, total, status, notes, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 'Confirmed', $9, now())`,
    [
      salesOrderId,
      tenantSlug,
      order.order_number,
      order.customer_name,
      today,
      JSON.stringify(items),
      items.reduce((s: number, i: any) => s + Number(i.quantity), 0),
      Number(order.total),
      `Storefront order ${order.order_number}`,
    ]
  );

  // Issue stock per line — serial-tracked and out-of-stock items were
  // rejected in the pre-validation pass above.
  for (const item of items) {
    const product = (await sql`
      select sku, name, unit_cost from inventory_products
      where tenant_slug = ${tenantSlug} and sku = ${item.sku}
    `) as any[];
    const p = product[0];
    if (!p) continue;
    await recordStockMovement(tenantSlug, {
      productSku: p.sku,
      productName: p.name,
      movementType: "sale",
      quantity: item.quantity,
      unitCost: Number(p.unit_cost ?? 0),
      referenceType: "storefront_order",
      referenceId: order.order_number,
      notes: `Storefront ${order.order_number}`,
    });
  }

  // Fulfill → draft finance invoice
  const soRow = (await db.query(
    `select * from sales_orders where id = $1 and tenant_slug = $2`, [salesOrderId, tenantSlug]
  )).rows[0];
  const invoice = await fulfillOrder(soRow, tenantSlug, userId);

  await sql`
    update storefront_orders set status = 'confirmed', sales_order_id = ${salesOrderId}
    where id = ${orderId} and tenant_slug = ${tenantSlug}
  `;
  return { salesOrderId, invoiceId: invoice?.id };
}

export async function cancelOrder(tenantSlug: string, orderId: string): Promise<{ error?: string }> {
  const sql = SQL;
  await ensureStorefrontTables(sql);
  const rows = (await sql`
    update storefront_orders set status = 'cancelled'
    where id = ${orderId} and tenant_slug = ${tenantSlug} and status = 'pending'
    returning id
  `) as any[];
  if (!rows.length) return { error: "Order not found or not pending" };
  return {};
}
