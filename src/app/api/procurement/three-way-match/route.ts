import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

async function ensureMatchTables() {
  await db.query(`create table if not exists procurement_purchase_orders (id text primary key, tenant_slug text not null, po_number text, vendor_id text, items jsonb, quantity integer default 0, amount numeric default 0, delivery_date date, status text default 'sent', created_at timestamptz default now())`);
  await db.query(`create table if not exists procurement_goods_receipts (id text primary key, tenant_slug text not null, po_id text, receipt_number text, vendor_id text, items jsonb, total_amount numeric default 0, status text default 'received', received_date timestamptz default now(), notes text, created_at timestamptz default now())`);
  await db.query(`create table if not exists procurement_invoices (id text primary key, tenant_slug text not null, invoice_number text, vendor_id text, po_id text, amount numeric default 0, due_date date, status text default 'received', created_at timestamptz default now())`);
}

export async function GET(request: NextRequest) {
  try {
    await ensureMatchTables();
    const context = validateTenantContext(request, "read");
    const tenantSlug = context.tenantSlug;
    const poId = new URL(request.url).searchParams.get("poId");

    if (!poId) {
      return NextResponse.json({ error: "poId is required" }, { status: 400 });
    }

    const poRows = (await db.query(
      `select * from procurement_purchase_orders where tenant_slug = $1 and id = $2`,
      [tenantSlug, poId]
    )).rows;

    if (poRows.length === 0) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const po = poRows[0];

    const receiptRows = (await db.query(
      `select * from procurement_goods_receipts where tenant_slug = $1 and po_id = $2`,
      [tenantSlug, poId]
    )).rows;

    const invoiceRows = (await db.query(
      `select * from procurement_invoices where tenant_slug = $1 and po_id = $2`,
      [tenantSlug, poId]
    )).rows;

    const poAmount = Number(po.amount);
    const receiptAmount = receiptRows.reduce((sum: number, r: any) => sum + Number(r.total_amount), 0);
    const invoiceAmount = invoiceRows.reduce((sum: number, i: any) => sum + Number(i.amount), 0);

    const poMatched = Math.abs(poAmount - receiptAmount) < 0.01;
    const invoiceMatched = Math.abs(poAmount - invoiceAmount) < 0.01;
    const receiptInvoiceMatched = Math.abs(receiptAmount - invoiceAmount) < 0.01;

    const allMatched = poMatched && invoiceMatched && receiptInvoiceMatched;

    return NextResponse.json({
      match: {
        poId,
        po: {
          poNumber: po.po_number,
          amount: poAmount,
          status: po.status,
        },
        receipts: receiptRows.map((r: any) => ({
          receiptNumber: r.receipt_number,
          amount: Number(r.total_amount),
          status: r.status,
        })),
        invoices: invoiceRows.map((i: any) => ({
          invoiceNumber: i.invoice_number,
          amount: Number(i.amount),
          status: i.status,
        })),
        summary: {
          poAmount,
          receiptAmount,
          invoiceAmount,
          poMatched,
          invoiceMatched,
          receiptInvoiceMatched,
          allMatched,
          status: allMatched ? "matched" : "disputed",
        },
      },
    });
  } catch (error) {
    console.error("Error in 3-way match:", error);
    return NextResponse.json(
      { error: "Failed to perform 3-way match", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
