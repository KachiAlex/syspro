export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";
import { getPagination } from "@/lib/pagination";
import { createJournalEntry } from "@/lib/finance/accounting";
import { randomUUID } from "crypto";

import { requireModuleAccess, requireDocAccess } from "@/lib/api-auth";
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
    const _scope = await requireModuleAccess(request, "finance", "read");
    if (!_scope.ok) return _scope.response;

  try {
    await ensureGoodsReceiptTables();
    const context = validateTenantContext(request, "read");
    const tenantSlug = context.tenantSlug;
    const poId = new URL(request.url).searchParams.get("poId");
    const { limit, offset } = getPagination(request);

    const params: any[] = [tenantSlug];
    let where = `where tenant_slug = $1`;
    if (poId) {
      params.push(poId);
      where += ` and po_id = $${params.length}`;
    }

    const rows = (await db.query(
      `select * from procurement_goods_receipts ${where} order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`,
      [...params, limit, offset]
    )).rows;

    const receipts = (rows || []).map((r: any) => ({
      id: r.id,
      receiptNumber: r.receipt_number,
      poId: r.po_id,
      vendorId: r.vendor_id,
      items: r.items,
      totalAmount: Number(r.total_amount ?? 0),
      status: r.status,
      notes: r.notes,
      receivedDate: r.received_date,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ receipts, limit, offset });
  } catch (error) {
    console.error("Error fetching goods receipts:", error);
    return NextResponse.json(
      { error: "Failed to fetch goods receipts", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
    const _scope = await requireDocAccess(request, "goods_receipt", "submit", "finance", "write");
    if (!_scope.ok) return _scope.response;

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

    // Validate the referenced PO belongs to this tenant (canonical PO table)
    if (poId) {
      const poRows = (await db.query(
        `select id from purchase_orders where id = $1 and tenant_slug = $2 limit 1`,
        [poId, tenantSlug]
      )).rows;
      if (!poRows.length) {
        return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
      }
    }

    // Converged path — this legacy endpoint now delegates to
    // purchase_receipts (the gated GRN): over-receipt guard, UoM
    // conversion, moving-average cost, GRNI journal, PO progress, and
    // optional approval chaining all live there.
    const { createPurchaseReceipt } = await import("@/lib/finance/purchase-receipts");
    const { gateOrRun } = await import("@/lib/finance/gated-actions");
    const receipt = await createPurchaseReceipt({
      tenantSlug,
      purchaseOrderId: poId ?? undefined,
      vendorId: vendorId ?? undefined,
      receivedDate: body.receivedDate ?? new Date().toISOString().slice(0, 10),
      notes: notes ?? undefined,
      createdBy: context.userId ?? "unknown",
      items: items.map((it: any) => ({
        poItemId: it.poItemId ?? undefined,
        productId: it.productId ?? undefined,
        sku: it.sku,
        description: it.name ?? it.description ?? undefined,
        receivedQty: Number(it.quantity ?? it.receivedQty),
        rejectedQty: it.rejectedQty ?? undefined,
        unitPrice: Number(it.unitCost ?? it.unitPrice ?? 0),
        uom: it.uom ?? undefined,
      })),
    });

    const gated = await gateOrRun(tenantSlug, "purchase_receipt", {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      totalAmount: receipt.totalAmount,
      purchaseOrderId: poId ?? undefined,
      vendorId: vendorId ?? undefined,
    }, { requestedBy: context.userId ?? "unknown" });

    if (gated.status === "pending") {
      const approvalId = (gated as any).approvalId as string | undefined;
      if (approvalId) {
        const { sql } = await import("@/lib/sql-client");
        await sql`update purchase_receipts set approval_id = ${approvalId} where id = ${receipt.id}`;
      }
      return NextResponse.json({
        receipt: { id: receipt.id, receiptNumber: receipt.receiptNumber, status: "pending" },
        approvalId, pendingApproval: true,
      }, { status: 202 });
    }
    if (gated.status === "denied") {
      return NextResponse.json({ error: (gated as any).error ?? "Denied" }, { status: 403 });
    }

    return NextResponse.json({
      goodsReceipt: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        poId: poId ?? null,
        vendorId: vendorId ?? null,
        items,
        totalAmount: receipt.totalAmount,
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
