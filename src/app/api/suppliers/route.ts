import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

async function ensureSuppliersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id text primary key,
      tenant_slug text not null,
      name text not null,
      contact text,
      email text,
      phone text,
      address text,
      category text,
      payment_terms text,
      rating numeric default 0,
      total_spend numeric default 0,
      status text default 'Active',
      created_at timestamptz default now()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers (tenant_slug)`);
}

function mapSupplier(row: any) {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact ?? row.name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    category: row.category ?? "general",
    paymentTerms: row.payment_terms ?? "NET 30",
    rating: Number(row.rating ?? 0),
    totalSpend: Number(row.total_spend ?? 0),
    status: row.status ?? "Active",
  };
}

export async function GET(request: NextRequest) {
  try {
    await ensureSuppliersTable();
    const context = validateTenantContext(request, "read");
    const rows = (await db.query(
      `SELECT * FROM suppliers WHERE tenant_slug = $1 ORDER BY created_at DESC`,
      [context.tenantSlug]
    )).rows;
    const suppliers = rows.map(mapSupplier);
    return NextResponse.json({ suppliers, total: suppliers.length });
  } catch (error) {
    console.error("Suppliers fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch suppliers", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureSuppliersTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { name, contact, email, phone, address, category, paymentTerms, rating } = body;
    if (!name) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }
    const id = `sup_${Date.now()}`;
    const createdAt = new Date().toISOString();
    await db.query(
      `INSERT INTO suppliers (id, tenant_slug, name, contact, email, phone, address, category, payment_terms, rating, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, context.tenantSlug, name, contact ?? name, email ?? "", phone ?? "", address ?? "", category ?? "general", paymentTerms ?? "NET 30", Number(rating ?? 0), "Active", createdAt]
    );
    const result = await db.query(`SELECT * FROM suppliers WHERE id = $1`, [id]);
    return NextResponse.json({ supplier: mapSupplier(result.rows[0]), message: "Supplier created" }, { status: 201 });
  } catch (error) {
    console.error("Supplier create failed:", error);
    return NextResponse.json({ error: "Failed to create supplier", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await ensureSuppliersTable();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { id, name, contact, email, phone, address, category, paymentTerms, rating, status } = body;
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const fields = [
      { col: "name", val: name },
      { col: "contact", val: contact },
      { col: "email", val: email },
      { col: "phone", val: phone },
      { col: "address", val: address },
      { col: "category", val: category },
      { col: "payment_terms", val: paymentTerms },
      { col: "rating", val: rating !== undefined ? Number(rating) : undefined },
      { col: "status", val: status },
    ];
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const f of fields) {
      if (f.val !== undefined) {
        updates.push(`${f.col} = $${idx++}`);
        values.push(f.val);
      }
    }
    if (updates.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    values.push(id, context.tenantSlug);
    const result = await db.query(
      `UPDATE suppliers SET ${updates.join(", ")} WHERE id = $${idx++} AND tenant_slug = $${idx++} RETURNING *`,
      values
    );
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    return NextResponse.json({ supplier: mapSupplier(row) });
  } catch (error) {
    console.error("Supplier update failed:", error);
    return NextResponse.json({ error: "Failed to update supplier", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
