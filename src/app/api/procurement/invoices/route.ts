import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const tenantSlug = context.tenantSlug;
    const vendorId = searchParams.get("vendorId");
    const status = searchParams.get("status");

    const rows = (await db.query(
      `select * from procurement_invoices where tenant_slug = $1`,
      [tenantSlug]
    )).rows;
    let invoices = rows || [];

    if (vendorId) {
      invoices = invoices.filter((i: any) => i.vendor_id === vendorId);
    }

    if (status) {
      invoices = invoices.filter((i: any) => i.status === status);
    }

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { vendorId, poId, amount, dueDate } = body;
    const tenantSlug = context.tenantSlug;

    if (!vendorId || !poId || !amount || !dueDate) {
      return NextResponse.json(
        { error: "Missing required fields: vendorId, poId, amount, dueDate" },
        { status: 400 }
      );
    }

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const invoice = {
      id: `inv_${Date.now()}`,
      tenantSlug,
      invoiceNumber,
      vendorId,
      poId,
      amount: parseFloat(amount),
      dueDate,
      status: "received" as const,
      createdAt: new Date().toISOString(),
    };

    await db.query(
      `insert into procurement_invoices (id, tenant_slug, invoice_number, vendor_id, po_id, amount, due_date, status, created_at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [invoice.id, invoice.tenantSlug, invoice.invoiceNumber, invoice.vendorId, invoice.poId, invoice.amount, invoice.dueDate, invoice.status, invoice.createdAt]
    );

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
