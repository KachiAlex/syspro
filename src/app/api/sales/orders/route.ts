export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { getPagination } from "@/lib/pagination";

import { requireModuleAccess } from "@/lib/api-auth";
import {
  computeQuantity,
  computeTotal,
  ensureSalesOrdersTable,
  findOrder,
  fulfillOrder,
  mapOrder,
  validateDeal,
} from "@/lib/sales/orders";

const FULFILLING_STATUSES = new Set(["Completed", "Delivered", "Fulfilled"]);

export async function GET(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "sales", "read");
    if (!_scope.ok) return _scope.response;

  try {
    await ensureSalesOrdersTable();
    const context = validateTenantContext(request, "read");
    const { limit, offset } = getPagination(request);
    const rows = (await db.query(
      `SELECT * FROM sales_orders WHERE tenant_slug = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [context.tenantSlug, limit, offset]
    )).rows;
    // total + revenue cover the full tenant set, not just this page
    const aggRow = (await db.query(
      `SELECT COUNT(*)::int AS total, COALESCE(SUM(total), 0) AS revenue FROM sales_orders WHERE tenant_slug = $1`,
      [context.tenantSlug]
    )).rows[0];
    const orders = rows.map(mapOrder);
    return NextResponse.json({ orders, total: Number(aggRow?.total ?? orders.length), revenue: Number(aggRow?.revenue ?? 0), limit, offset });
  } catch (error) {
    console.error("Sales orders fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch sales orders", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "sales", "write");
    if (!_scope.ok) return _scope.response;

  try {
    await ensureSalesOrdersTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { customerId, orderDate, expectedDeliveryDate, items: rawItems, notes, dealId } = body;

    if (!customerId || !orderDate) {
      return NextResponse.json({ error: "Missing required fields: customerId, orderDate" }, { status: 400 });
    }

    let dealIdValue: string | null = null;
    if (dealId) {
      const deal = await validateDeal(String(dealId), context.tenantSlug).catch(() => null);
      if (!deal) {
        return NextResponse.json({ error: "Deal not found" }, { status: 404 });
      }
      dealIdValue = deal.id;
    }

    const items = Array.isArray(rawItems) ? rawItems : [];
    const total = computeTotal(items);
    const quantity = computeQuantity(items);
    const id = `so_${Date.now()}`;
    const orderNumber = `SO-${Date.now().toString().slice(-6)}`;
    const custResult = await db.query(
      `SELECT name FROM crm_customers WHERE id = $1 AND tenant_slug = $2`,
      [String(customerId), context.tenantSlug]
    );
    if (!custResult.rows[0]) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    const customerName = custResult.rows[0].name;
    const createdAt = new Date().toISOString();

    await db.query(
      `INSERT INTO sales_orders (id, tenant_slug, order_number, customer_id, customer_name, order_date, due_date, items, quantity, total, status, notes, deal_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, context.tenantSlug, orderNumber, String(customerId), customerName, orderDate, expectedDeliveryDate ?? "", JSON.stringify(items), quantity, total, "Pending", notes ?? "", dealIdValue, createdAt]
    );

    const row = await findOrder(id, context.tenantSlug);
    return NextResponse.json({ order: mapOrder(row), message: "Sales order created" }, { status: 201 });
  } catch (error) {
    console.error("Sales order create failed:", error);
    return NextResponse.json({ error: "Failed to create sales order", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
    const _scope = await requireModuleAccess(request, "sales", "write");
    if (!_scope.ok) return _scope.response;

  try {
    await ensureSalesOrdersTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { id, status, dueDate, notes } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const allowedStatuses = new Set(["Pending", "In Transit", "Completed", "Cancelled"]);
    if (status !== undefined && !allowedStatuses.has(status)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${[...allowedStatuses].join(", ")}` }, { status: 400 });
    }

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

    // Fulfillment chain: completing an order drafts a finance invoice once.
    let invoice: any = null;
    if (FULFILLING_STATUSES.has(row.status) && !row.invoice_id) {
      try {
        invoice = await fulfillOrder(row, context.tenantSlug, context.userId);
      } catch (fulfillErr) {
        console.error("[SalesOrder] Auto-invoice draft failed:", fulfillErr);
      }
    }

    const refreshed = invoice ? { ...row, invoice_id: invoice.id } : row;
    return NextResponse.json({ order: mapOrder(refreshed), invoice });
  } catch (error) {
    console.error("Sales order update failed:", error);
    return NextResponse.json({ error: "Failed to update sales order", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
