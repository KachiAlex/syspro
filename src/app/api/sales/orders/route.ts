import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

async function ensureSalesOrdersTable() {
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
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant ON sales_orders (tenant_slug)`);
}

const hardcodedCustomers: Record<string, string> = {
  "1": "Acme Corp",
  "2": "Tech Solutions",
  "3": "Global Industries",
};

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
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureSalesOrdersTable();
    const context = validateTenantContext(request, "read");
    const rows = (await db.query(
      `SELECT * FROM sales_orders WHERE tenant_slug = $1 ORDER BY created_at DESC`,
      [context.tenantSlug]
    )).rows;
    const orders = rows.map(mapOrder);
    const revenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return NextResponse.json({ orders, total: orders.length, revenue });
  } catch (error) {
    console.error("Sales orders fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch sales orders", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSalesOrdersTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { customerId, orderDate, expectedDeliveryDate, items: rawItems, notes } = body;

    if (!customerId || !orderDate) {
      return NextResponse.json({ error: "Missing required fields: customerId, orderDate" }, { status: 400 });
    }

    const items = Array.isArray(rawItems) ? rawItems : [];
    const total = computeTotal(items);
    const quantity = computeQuantity(items);
    const id = `so_${Date.now()}`;
    const orderNumber = `SO-${Date.now().toString().slice(-6)}`;
    const customerName = hardcodedCustomers[String(customerId)] ?? String(customerId);
    const createdAt = new Date().toISOString();

    await db.query(
      `INSERT INTO sales_orders (id, tenant_slug, order_number, customer_id, customer_name, order_date, due_date, items, quantity, total, status, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [id, context.tenantSlug, orderNumber, String(customerId), customerName, orderDate, expectedDeliveryDate ?? "", JSON.stringify(items), quantity, total, "Pending", notes ?? "", createdAt]
    );

    const result = await db.query(`SELECT * FROM sales_orders WHERE id = $1`, [id]);
    return NextResponse.json({ order: mapOrder(result.rows[0]), message: "Sales order created" }, { status: 201 });
  } catch (error) {
    console.error("Sales order create failed:", error);
    return NextResponse.json({ error: "Failed to create sales order", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSalesOrdersTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { id, status, dueDate, notes } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const fields = [] as { col: string; val: any }[];
    if (status !== undefined) fields.push({ col: "status", val: status });
    if (dueDate !== undefined) fields.push({ col: "due_date", val: dueDate });
    if (notes !== undefined) fields.push({ col: "notes", val: notes });
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const updates = fields.map((f, i) => `${f.col} = $${i + 1}`);
    const values = fields.map((f) => f.val);
    values.push(id, context.tenantSlug);

    const result = await db.query(
      `UPDATE sales_orders SET ${updates.join(", ")} WHERE id = $${fields.length + 1} AND tenant_slug = $${fields.length + 2} RETURNING *`,
      values
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    return NextResponse.json({ order: mapOrder(row) });
  } catch (error) {
    console.error("Sales order update failed:", error);
    return NextResponse.json({ error: "Failed to update sales order", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
