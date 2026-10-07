export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";
import { db } from "@/lib/sql-client";
import { randomUUID } from "crypto";

// Suppliers are unified onto the canonical finance `vendors` table — a vendor
// created here must be payable through bills/AP. Supplier-only fields
// (contact, category, rating, totalSpend) live in vendors.metadata.
// Normalize to the finance vendors payment-terms vocabulary (net30/net60/…)
// when the input loosely matches; otherwise keep the caller's text.
function normalizePaymentTerms(raw: string | undefined | null): string {
  const v = String(raw ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const map: Record<string, string> = {
    net30: "net30", net60: "net60", net90: "net90", net45: "net45",
    net15: "net15", net7: "net7", dueonreceipt: "immediate", immediate: "immediate",
    cod: "immediate", prepaid: "prepaid",
  };
  return map[v] ?? (raw || "net30");
}

function mapVendorRowToSupplier(row: any) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const name = row.display_name ?? row.legal_name ?? row.name ?? "";
  return {
    id: row.id,
    name,
    contact: meta.contact ?? name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    category: meta.category ?? "general",
    paymentTerms: row.default_payment_terms ?? row.payment_terms ?? "NET 30",
    rating: Number(meta.rating ?? 0),
    totalSpend: Number(meta.total_spend ?? 0),
    status: row.status === "active" || row.is_active ? "Active" : "Inactive",
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const _gate1 = await requireModuleGate(request, "finance", "read");
    if (_gate1) return _gate1;
    const rows = (await db.query(
      `SELECT * FROM vendors WHERE tenant_slug = $1 ORDER BY created_at DESC`,
      [context.tenantSlug]
    )).rows;
    const suppliers = rows.map(mapVendorRowToSupplier);
    return NextResponse.json({ suppliers, total: suppliers.length });
  } catch (error) {
    console.error("Suppliers fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch suppliers", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate2 = await requireModuleGate(request, "finance", "write");
    if (_gate2) return _gate2;
    const body = await request.json();
    const { name, contact, email, phone, address, category, paymentTerms, rating } = body;
    if (!name) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }
    const id = `sup_${randomUUID()}`;
    const code = `SUP-${Date.now().toString().slice(-6)}`;
    const terms = normalizePaymentTerms(paymentTerms);
    const metadata = {
      contact: contact ?? name,
      category: category ?? "general",
      rating: Number(rating ?? 0),
      total_spend: 0,
    };
    const result = await db.query(
      `INSERT INTO vendors (
        id, tenant_slug, vendor_code, code, name, legal_name, display_name,
        email, phone, address, payment_terms, default_payment_terms,
        status, is_active, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', true, $13, now(), now())
      RETURNING *`,
      [
        id, context.tenantSlug, code, code, name, name, name,
        email ?? "", phone ?? "", address ?? "", terms, terms,
        JSON.stringify(metadata),
      ]
    );
    return NextResponse.json({ supplier: mapVendorRowToSupplier(result.rows[0]), message: "Supplier created" }, { status: 201 });
  } catch (error) {
    console.error("Supplier create failed:", error);
    return NextResponse.json({ error: "Failed to create supplier", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const _gate3 = await requireModuleGate(request, "finance", "write");
    if (_gate3) return _gate3;
    const body = await request.json();
    const { id, name, contact, email, phone, address, category, paymentTerms, rating, status } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    const set = (col: string, val: any) => { updates.push(`${col} = $${idx++}`); values.push(val); };

    if (name !== undefined) { set("name", name); set("legal_name", name); set("display_name", name); }
    if (email !== undefined) set("email", email);
    if (phone !== undefined) set("phone", phone);
    if (address !== undefined) set("address", address);
    if (paymentTerms !== undefined) { const t = normalizePaymentTerms(paymentTerms); set("default_payment_terms", t); set("payment_terms", t); }
    if (status !== undefined) {
      const inactive = String(status).toLowerCase() !== "active";
      set("status", inactive ? "inactive" : "active");
      set("is_active", !inactive);
    }

    // Supplier-only extras merge into vendors.metadata
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
    values.push(id, context.tenantSlug);
    const result = await db.query(
      `UPDATE vendors SET ${updates.join(", ")} WHERE id = $${idx++} AND tenant_slug = $${idx++} RETURNING *`,
      values
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    return NextResponse.json({ supplier: mapVendorRowToSupplier(row) });
  } catch (error) {
    console.error("Supplier update failed:", error);
    return NextResponse.json({ error: "Failed to update supplier", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
