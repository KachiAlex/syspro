export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { db } from "@/lib/sql-client";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate1 = await requireModuleGate(request, "finance", "write");
    if (_gate1) return _gate1;
    const body = await request.json().catch(() => ({}));
    const { status, deliveryDate, expectedDeliveryDate, notes } = body;

    const fields = [] as { col: string; val: any }[];
    if (status !== undefined) fields.push({ col: "status", val: status });
    if ((deliveryDate ?? expectedDeliveryDate) !== undefined) fields.push({ col: "delivery_date", val: deliveryDate ?? expectedDeliveryDate });
    if (notes !== undefined) fields.push({ col: "notes", val: notes });
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const updates = fields.map((f, i) => `${f.col} = $${i + 1}`);
    const values = fields.map((f) => f.val);
    values.push(params.id, context.tenantSlug);
    const result = await db.query(
      `UPDATE purchase_orders SET ${updates.join(", ")}, updated_at = now() WHERE id = $${fields.length + 1} AND tenant_slug = $${fields.length + 2} RETURNING *`,
      values
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    const items = typeof row.items === "string" ? JSON.parse(row.items) : row.items ?? [];
    return NextResponse.json({ order: {
      id: row.id,
      poNumber: row.po_number,
      supplierId: row.supplier_id,
      vendor: row.supplier_name ?? row.supplier_id ?? "",
      supplier: row.supplier_name ?? row.supplier_id ?? "",
      total: Number(row.total ?? 0),
      amount: Number(row.total ?? 0),
      quantity: Number(row.quantity ?? items.length),
      status: row.status ?? "Pending",
      orderDate: row.order_date ?? "",
      poDate: row.order_date ?? "",
      deliveryDate: row.delivery_date ?? "",
      dueDate: row.delivery_date ?? "",
      items,
      notes: row.notes ?? "",
    }});
  } catch (error) {
    console.error("Purchase order update failed:", error);
    return NextResponse.json({ error: "Failed to update purchase order", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "delete");
    const _gate1 = await requireModuleGate(request, "finance", "write");
    if (_gate1) return _gate1;
    const result = await db.query(
      `DELETE FROM purchase_orders WHERE id = $1 AND tenant_slug = $2 RETURNING id`,
      [params.id, context.tenantSlug]
    );
    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Purchase order deleted" });
  } catch (error) {
    console.error("Purchase order delete failed:", error);
    return NextResponse.json({ error: "Failed to delete purchase order", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
