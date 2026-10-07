export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { requireModuleAccess } from "@/lib/api-auth";
import { ensureSalesOrdersTable, findOrder, fulfillOrder, mapOrder } from "@/lib/sales/orders";

const FULFILLING_STATUSES = new Set(["Completed", "Delivered", "Fulfilled"]);

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const scope = await requireModuleAccess(request, "sales", "write");
  if (!scope.ok) return scope.response;

  try {
    await ensureSalesOrdersTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json().catch(() => ({}));
    const { status, dueDate, notes } = body;

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
    values.push(params.id, context.tenantSlug);

    const result = await db.query(
      `UPDATE sales_orders SET ${updates.join(", ")} WHERE id = $${fields.length + 1} AND tenant_slug = $${fields.length + 2} RETURNING *`,
      values
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: "Sales order not found" }, { status: 404 });

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

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const scope = await requireModuleAccess(request, "sales", "write");
  if (!scope.ok) return scope.response;

  try {
    await ensureSalesOrdersTable();
    const context = validateTenantContext(request, "delete");
    const result = await db.query(
      `DELETE FROM sales_orders WHERE id = $1 AND tenant_slug = $2 RETURNING id`,
      [params.id, context.tenantSlug]
    );
    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Sales order not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Sales order deleted" });
  } catch (error) {
    console.error("Sales order delete failed:", error);
    return NextResponse.json({ error: "Failed to delete sales order", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
