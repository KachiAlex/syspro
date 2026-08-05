import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { createJournalEntry } from "@/lib/finance/accounting";
import { randomUUID } from "crypto";

async function ensureGoodsReceiptTables() {
  await db.query(`
    create table if not exists procurement_goods_receipts (
      id text primary key,
      tenant_slug text not null,
      po_id text,
      receipt_number text not null,
      vendor_id text,
      items jsonb not null,
      total_amount numeric not null default 0,
      status text not null default 'received' check (status in ('received', 'matched', 'disputed')),
      received_date timestamptz default now(),
      notes text,
      created_at timestamptz default now()
    )
  `);
  await db.query(`create index if not exists procurement_goods_receipts_tenant_idx on procurement_goods_receipts (tenant_slug)`);
  await db.query(`create index if not exists procurement_goods_receipts_po_idx on procurement_goods_receipts (po_id)`);
}

export async function GET(request: NextRequest) {
  try {
    await ensureGoodsReceiptTables();
    const context = validateTenantContext(request, "read");
    const tenantSlug = context.tenantSlug;
    const poId = new URL(request.url).searchParams.get("poId");

    let rows;
    if (poId) {
      rows = (await db.query(
        `select * from procurement_goods_receipts where tenant_slug = $1 and po_id = $2 order by created_at desc`,
        [tenantSlug, poId]
      )).rows;
    } else {
      rows = (await db.query(
        `select * from procurement_goods_receipts where tenant_slug = $1 order by created_at desc`,
        [tenantSlug]
      )).rows;
    }

    return NextResponse.json({ receipts: rows });
  } catch (error) {
    console.error("Error fetching goods receipts:", error);
    return NextResponse.json(
      { error: "Failed to fetch goods receipts", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureGoodsReceiptTables();
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    const { poId, vendorId, items, notes } = body;
    const tenantSlug = context.tenantSlug;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: items (array of { sku, name, quantity, unitCost })" },
        { status: 400 }
      );
    }

    const id = `gr_${randomUUID()}`;
    const receiptNumber = `GR-${Date.now().toString().slice(-8)}`;
    const totalAmount = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitCost, 0);

    await db.query(
      `insert into procurement_goods_receipts (id, tenant_slug, po_id, receipt_number, vendor_id, items, total_amount, status, notes, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, 'received', $8, now())`,
      [id, tenantSlug, poId ?? null, receiptNumber, vendorId ?? null, JSON.stringify(items), totalAmount, notes ?? null]
    );

    for (const item of items) {
      const existing = (await db.query(
        `select id, current_stock, unit_cost from inventory_products where tenant_slug = $1 and sku = $2`,
        [tenantSlug, item.sku]
      )).rows;

      if (existing.length > 0) {
        const newStock = Number(existing[0].current_stock) + Number(item.quantity);
        await db.query(
          `update inventory_products set current_stock = $1, unit_cost = $2 where id = $3`,
          [newStock, item.unitCost, existing[0].id]
        );
      } else {
        await db.query(
          `insert into inventory_products (id, tenant_slug, name, sku, category, current_stock, min_stock, unit_cost, sale_price, created_at)
           values ($1, $2, $3, $4, 'materials', $5, 0, $6, 0, now())`,
          [randomUUID(), tenantSlug, item.name, item.sku, item.quantity, item.unitCost]
        );
      }
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      await createJournalEntry({
        tenantSlug,
        entryDate: today,
        referenceType: "manual",
        referenceId: receiptNumber,
        description: `Goods receipt ${receiptNumber} from vendor`,
        lines: [
          {
            accountCode: "1500",
            debitAmount: totalAmount,
            creditAmount: 0,
            description: `Inventory receipt (${items.length} items)`,
          },
          {
            accountCode: "2100",
            debitAmount: 0,
            creditAmount: totalAmount,
            description: `Accounts Payable for ${receiptNumber}`,
          },
        ],
      });
    } catch (jeError) {
      console.error("Failed to post goods receipt journal entry:", jeError);
    }

    return NextResponse.json({
      receipt: {
        id,
        receiptNumber,
        poId: poId ?? null,
        vendorId: vendorId ?? null,
        items,
        totalAmount,
        status: "received",
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating goods receipt:", error);
    return NextResponse.json(
      { error: "Failed to create goods receipt", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
