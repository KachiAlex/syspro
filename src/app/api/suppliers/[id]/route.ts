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
    const { name, contact, email, phone, address, category, paymentTerms, rating, status } = body;

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const set = (col: string, val: any) => { updates.push(`${col} = $${idx++}`); values.push(val); };

    if (name !== undefined) { set("name", name); set("legal_name", name); set("display_name", name); }
    if (email !== undefined) set("email", email);
    if (phone !== undefined) set("phone", phone);
    if (address !== undefined) set("address", address);
    if (paymentTerms !== undefined) { set("default_payment_terms", paymentTerms); set("payment_terms", paymentTerms); }
    if (status !== undefined) {
      const inactive = String(status).toLowerCase() !== "active";
      set("status", inactive ? "inactive" : "active");
      set("is_active", !inactive);
    }

    const metaPatch: Record<string, unknown> = {};
    if (contact !== undefined) metaPatch.contact = contact;
    if (category !== undefined) metaPatch.category = category;
    if (rating !== undefined) metaPatch.rating = Number(rating);
    if (Object.keys(metaPatch).length > 0) {
      updates.push(`metadata = coalesce(metadata, '{}'::jsonb) || $${idx++}::jsonb`);
      values.push(JSON.stringify(metaPatch));
    }

    if (updates.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    updates.push("updated_at = now()");
    values.push(params.id, context.tenantSlug);
    const result = await db.query(
      `UPDATE vendors SET ${updates.join(", ")} WHERE id = $${idx++} AND tenant_slug = $${idx++} RETURNING *`,
      values
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    const meta = row.metadata ?? {};
    return NextResponse.json({ supplier: {
      id: row.id,
      name: row.display_name ?? row.name,
      contact: meta.contact ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      address: row.address ?? "",
      category: meta.category ?? "general",
      paymentTerms: row.default_payment_terms ?? row.payment_terms ?? "NET 30",
      rating: Number(meta.rating ?? 0),
      totalSpend: Number(meta.total_spend ?? 0),
      status: row.status === "active" || row.is_active ? "Active" : "Inactive",
    }});
  } catch (error) {
    console.error("Supplier update failed:", error);
    return NextResponse.json({ error: "Failed to update supplier", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const context = validateTenantContext(request, "delete");
    const _gate1 = await requireModuleGate(request, "finance", "write");
    if (_gate1) return _gate1;
    const result = await db.query(
      `DELETE FROM vendors WHERE id = $1 AND tenant_slug = $2 RETURNING id`,
      [params.id, context.tenantSlug]
    );
    if ((result.rowCount ?? 0) === 0) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Supplier deleted" });
  } catch (error) {
    console.error("Supplier delete failed:", error);
    return NextResponse.json({ error: "Failed to delete supplier", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
