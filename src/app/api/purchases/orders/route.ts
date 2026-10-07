export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { getPagination } from "@/lib/pagination";

import { requireModuleAccess } from "@/lib/api-auth";
async function ensurePurchaseOrdersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id text primary key,
      tenant_slug text not null,
      po_number text not null,
      supplier_id text,
      supplier_name text,
      order_date text,
      delivery_date text,
      items text,
      quantity numeric default 0,
      total numeric default 0,
      status text default 'Pending',
      notes text,
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders (tenant_slug)`);

  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS po_number text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_id text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_id text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS supplier_name text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS order_number text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS order_date text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS delivery_date text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS issued_date date`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS due_date date`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS status text default 'Pending'`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS items text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS quantity numeric default 0`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total numeric default 0`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS total_amount numeric default 0`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS balance_due numeric default 0`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency text default 'NGN'`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS notes text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS branch_id text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS metadata jsonb`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_by text`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS created_at timestamptz default now()`);
  await db.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at timestamptz default now()`);
}

async function resolveSupplierName(supplierId: string, tenantSlug: string) {
  if (!supplierId) return "";
  try {
    // Canonical vendor master is `vendors` (suppliers were unified onto it)
    const vendor = await db.query(
      `SELECT coalesce(display_name, legal_name, name) AS name FROM vendors WHERE id = $1 AND tenant_slug = $2`,
      [supplierId, tenantSlug]
    );
    return vendor.rows[0]?.name ?? supplierId;
  } catch (e) {
    return supplierId;
  }
}

function parseItems(itemsRaw: any) {
  if (Array.isArray(itemsRaw)) return itemsRaw;
  if (!itemsRaw) return [];
  try {
    const parsed = JSON.parse(itemsRaw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function computeTotal(items: any[]) {
  return items.reduce((sum: number, item: any) => sum + (Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0)), 0);
}

function computeQuantity(items: any[]) {
  return items.reduce((sum: number, item: any) => sum + Number(item.quantity ?? 0), 0);
}

function mapOrder(row: any) {
  const items = parseItems(row.items);
  return {
    id: row.id,
    poNumber: row.po_number,
    supplierId: row.supplier_id,
    vendor: row.supplier_name ?? row.supplier_id ?? "",
    supplier: row.supplier_name ?? row.supplier_id ?? "",
    total: Number(row.total ?? computeTotal(items)),
    amount: Number(row.total ?? computeTotal(items)),
    quantity: Number(row.quantity ?? computeQuantity(items)),
    status: row.status ?? "Pending",
    orderDate: row.order_date ?? "",
    poDate: row.order_date ?? "",
    deliveryDate: row.delivery_date ?? "",
    dueDate: row.delivery_date ?? "",
    items: items.length,
    notes: row.notes ?? "",
  };
}

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

  try {
    await ensurePurchaseOrdersTable();
    const context = validateTenantContext(request, "read");
    const { limit, offset } = getPagination(request);
    const rows = (await db.query(
      `SELECT * FROM purchase_orders WHERE tenant_slug = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [context.tenantSlug, limit, offset]
    )).rows;
    const countRow = (await db.query(
      `SELECT COUNT(*)::int AS total FROM purchase_orders WHERE tenant_slug = $1`,
      [context.tenantSlug]
    )).rows[0];
    const orders = rows.map(mapOrder);
    return NextResponse.json({ orders, total: Number(countRow?.total ?? orders.length), limit, offset });
  } catch (error) {
    console.error("Purchase orders fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch purchase orders", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  try {
    await ensurePurchaseOrdersTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { supplierId, orderDate, expectedDeliveryDate, items: rawItems, notes } = body;

    if (!supplierId || !orderDate) {
      return NextResponse.json({ error: "Missing required fields: supplierId, orderDate" }, { status: 400 });
    }

    const supplierName = await resolveSupplierName(supplierId, context.tenantSlug);
    const items = Array.isArray(rawItems) ? rawItems : [];
    const total = computeTotal(items);
    const quantity = computeQuantity(items);
    const id = `po_${Date.now()}`;
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const createdAt = new Date().toISOString();

    await db.query(
      `INSERT INTO purchase_orders (id, tenant_slug, po_number, supplier_id, supplier_name, order_date, delivery_date, items, quantity, total, status, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, context.tenantSlug, poNumber, supplierId, supplierName, orderDate, expectedDeliveryDate ?? "", JSON.stringify(items), quantity, total, "Pending", notes ?? "", createdAt]
    );

    const result = await db.query(`SELECT * FROM purchase_orders WHERE id = $1`, [id]);
    return NextResponse.json({ order: mapOrder(result.rows[0]), message: "Purchase order created" }, { status: 201 });
  } catch (error) {
    console.error("Purchase order create failed:", error);
    return NextResponse.json({ error: "Failed to create purchase order", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "finance", "write");
    if (!_scope.ok) return _scope.response;

  try {
    await ensurePurchaseOrdersTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { id, status } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const fields = [] as { col: string; val: any }[];
    if (status !== undefined) fields.push({ col: "status", val: status });
    if (body.deliveryDate !== undefined) fields.push({ col: "delivery_date", val: body.deliveryDate });
    if (body.notes !== undefined) fields.push({ col: "notes", val: body.notes });

    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    const updates = fields.map((f, i) => `${f.col} = $${i + 1}`);
    const values = fields.map((f) => f.val);
    values.push(id, context.tenantSlug);

    const result = await db.query(
      `UPDATE purchase_orders SET ${updates.join(", ")} WHERE id = $${fields.length + 1} AND tenant_slug = $${fields.length + 2} RETURNING *`,
      values
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    return NextResponse.json({ order: mapOrder(row) });
  } catch (error) {
    console.error("Purchase order update failed:", error);
    return NextResponse.json({ error: "Failed to update purchase order", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
