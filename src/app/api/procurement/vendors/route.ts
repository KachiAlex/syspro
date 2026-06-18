import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const tenantSlug = context.tenantSlug;
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    const rows = (await db.query(
      `select * from procurement_vendors where tenant_slug = $1`,
      [tenantSlug]
    )).rows;
    let vendors = rows || [];

    if (status) {
      vendors = vendors.filter((v: any) => v.status === status);
    }

    if (category) {
      vendors = vendors.filter((v: any) => v.category === category);
    }

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json(
      { error: "Failed to fetch vendors", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { name, code, category, paymentTerms } = body;
    const tenantSlug = context.tenantSlug;

    if (!name || !code || !category || !paymentTerms) {
      return NextResponse.json(
        { error: "Missing required fields: name, code, category, paymentTerms" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = (await db.query(
      `select id from procurement_vendors where code = $1 and tenant_slug = $2 limit 1`,
      [code, tenantSlug]
    )).rows;
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Vendor with this code already exists" },
        { status: 409 }
      );
    }

    const vendor = {
      id: `vendor_${Date.now()}`,
      tenantSlug,
      name,
      code,
      category,
      paymentTerms,
      status: "active" as const,
      createdAt: new Date().toISOString(),
    };

    await db.query(
      `insert into procurement_vendors (id, tenant_slug, name, code, category, payment_terms, status, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [vendor.id, vendor.tenantSlug, vendor.name, vendor.code, vendor.category, vendor.paymentTerms, vendor.status, vendor.createdAt]
    );

    return NextResponse.json({ vendor }, { status: 201 });
  } catch (error) {
    console.error("Error creating vendor:", error);
    return NextResponse.json(
      { error: "Failed to create vendor", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
