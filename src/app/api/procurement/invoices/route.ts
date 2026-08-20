import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

async function ensureInvoiceTables() {
  await db.query(`
    create table if not exists procurement_invoices (
      id text primary key,
      tenant_slug text not null,
      invoice_number text not null,
      vendor_id text,
      po_id text,
      amount numeric default 0,
      due_date date,
      status text not null default 'received' check (status in ('received', 'approved', 'paid', 'disputed')),
      created_at timestamptz default now()
    )
  `);
  await db.query(`create index if not exists procurement_invoices_tenant_idx on procurement_invoices (tenant_slug)`);
  await db.query(`create index if not exists procurement_invoices_po_idx on procurement_invoices (po_id)`);
}

export async function GET(request: NextRequest) {
  try {
    await ensureInvoiceTables();
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
    await ensureInvoiceTables();
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
