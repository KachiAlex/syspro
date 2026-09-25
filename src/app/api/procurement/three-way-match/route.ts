import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { db } from "@/lib/sql-client";

interface NormalizedLine {
  key: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface LineDiscrepancy {
  type: string;
  message: string;
  lineItem: { key: string; description: string };
}

interface LineMatchResult {
  key: string;
  description: string;
  po: { quantity: number; unitPrice: number; lineTotal: number } | null;
  receipt: { quantity: number; unitPrice: number; lineTotal: number } | null;
  bill: { quantity: number; unitPrice: number; lineTotal: number } | null;
  matched: boolean;
  discrepancies: LineDiscrepancy[];
}

function parseItems(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeLine(item: any): NormalizedLine {
  const key = String(
    item.sku ?? item.product_id ?? item.productId ?? item.name ?? item.description ?? ""
  ).toLowerCase().trim();
  const description = String(item.name ?? item.description ?? item.sku ?? item.product_id ?? "");
  const quantity = Number(item.quantity ?? 0);
  const unitPrice = Number(item.unitCost ?? item.unit_cost ?? item.unitPrice ?? item.unit_price ?? item.price ?? 0);
  const lineTotal = Number(item.lineTotal ?? item.line_total ?? item.amount ?? item.line_amount ?? quantity * unitPrice);
  return { key, description, quantity, unitPrice, lineTotal };
}

function normalizeLines(items: any[]): NormalizedLine[] {
  return parseItems(items).map(normalizeLine);
}

const TOLERANCE = 0.01;

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const tenantSlug = context.tenantSlug;
    const poId = new URL(request.url).searchParams.get("poId");

    if (!poId) {
      return NextResponse.json({ error: "poId is required" }, { status: 400 });
    }

    let poRows: any[] = [];
    try {
      poRows = (await db.query(
        `select * from purchase_orders where tenant_slug = $1 and id = $2`,
        [tenantSlug, poId]
      )).rows;
    } catch (e) {
      console.error("Error fetching purchase order for 3-way match:", e);
    }

    if (poRows.length === 0) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    const poRow = poRows[0];

    let poItemRows: any[] = [];
    try {
      poItemRows = (await db.query(
        `select * from purchase_order_items where coalesce(purchase_order_id, po_id) = $1 order by id`,
        [poId]
      )).rows;
    } catch (e) {
      console.error("Error fetching PO items for 3-way match:", e);
    }

    const po = {
      ...poRow,
      vendor_id: poRow.vendor_id ?? poRow.supplier_id ?? null,
      po_number: poRow.po_number ?? poRow.order_number ?? null,
      amount: poRow.total_amount ?? poRow.amount ?? poRow.total ?? 0,
      items: poItemRows,
      status: poRow.status,
    };

    let receiptRows: any[] = [];
    try {
      receiptRows = (await db.query(
        `select * from procurement_goods_receipts where tenant_slug = $1 and po_id = $2 order by created_at desc`,
        [tenantSlug, poId]
      )).rows;
    } catch (e) {
      console.error("Error fetching goods receipts for 3-way match:", e);
    }

    const invoiceRows: any[] = [];

    let billRows: any[] = [];
    let billItemRows: any[] = [];
    try {
      billRows = (await db.query(
        `select * from bills where tenant_slug = $1 and po_id = $2`,
        [tenantSlug, poId]
      )).rows;
      if (billRows.length > 0) {
        billItemRows = (await db.query(
          `select * from bill_items where bill_id = any($1) order by id`,
          [billRows.map((b: any) => b.id)]
        )).rows;
      }
    } catch (e) {
      console.error("Error fetching bills for 3-way match:", e);
    }

    const poVendorId = po.vendor_id ?? null;
    const receiptVendorIds = receiptRows.map((r: any) => r.vendor_id).filter((v: any) => v);
    const invoiceVendorIds = invoiceRows.map((i: any) => i.vendor_id).filter((v: any) => v);
    const billVendorIds = billRows.map((b: any) => b.vendor_id).filter((v: any) => v);

    const vendorDiscrepancies: LineDiscrepancy[] = [];
    const allVendorIds = [poVendorId, ...receiptVendorIds, ...invoiceVendorIds, ...billVendorIds].filter(
      (v): v is string => v !== null && v !== undefined && v !== ""
    );
    const uniqueVendorIds = Array.from(new Set(allVendorIds));
    if (uniqueVendorIds.length > 1) {
      vendorDiscrepancies.push({
        type: "vendor_mismatch",
        message: `Vendor mismatch across documents: ${uniqueVendorIds.join(", ")}`,
        lineItem: { key: "", description: "" },
      });
    }
    if (receiptVendorIds.length > 0 && poVendorId && !receiptVendorIds.every((v: string) => v === poVendorId)) {
      vendorDiscrepancies.push({
        type: "vendor_mismatch_po_receipt",
        message: `PO vendor (${poVendorId}) does not match goods receipt vendor(s) (${receiptVendorIds.join(", ")})`,
        lineItem: { key: "", description: "" },
      });
    }
    if (billVendorIds.length > 0 && poVendorId && !billVendorIds.every((v: string) => v === poVendorId)) {
      vendorDiscrepancies.push({
        type: "vendor_mismatch_po_bill",
        message: `PO vendor (${poVendorId}) does not match bill vendor(s) (${billVendorIds.join(", ")})`,
        lineItem: { key: "", description: "" },
      });
    }

    const poLines = normalizeLines(po.items);

    const receiptLines: NormalizedLine[] = [];
    for (const r of receiptRows) {
      receiptLines.push(...normalizeLines(r.items));
    }

    const billLines: NormalizedLine[] = billItemRows.map((item: any) => {
      const key = String(item.description ?? "").toLowerCase().trim();
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unit_price ?? 0);
      const lineTotal = Number(item.line_amount ?? quantity * unitPrice);
      return { key, description: String(item.description ?? ""), quantity, unitPrice, lineTotal };
    });

    const receiptByLine: Record<string, NormalizedLine[]> = {};
    for (const rl of receiptLines) {
      receiptByLine[rl.key] = receiptByLine[rl.key] || [];
      receiptByLine[rl.key].push(rl);
    }
    const billByLine: Record<string, NormalizedLine[]> = {};
    for (const bl of billLines) {
      billByLine[bl.key] = billByLine[bl.key] || [];
      billByLine[bl.key].push(bl);
    }

    const lineResults: LineMatchResult[] = [];
    const allLineDiscrepancies: LineDiscrepancy[] = [];

    for (const poLine of poLines) {
      const discrepancies: LineDiscrepancy[] = [];
      const matchingReceipts = receiptByLine[poLine.key] || [];
      const matchingBills = billByLine[poLine.key] || [];

      const receiptLine = matchingReceipts[0] ?? null;
      const billLine = matchingBills[0] ?? null;

      const receivedQty = receiptLine ? receiptLine.quantity : 0;
      const billedQty = billLine ? billLine.quantity : 0;

      if (!receiptLine) {
        discrepancies.push({
          type: "missing_receipt_line",
          message: `No goods receipt line found for PO line "${poLine.description}" (key: ${poLine.key})`,
          lineItem: { key: poLine.key, description: poLine.description },
        });
      } else {
        if (receivedQty > poLine.quantity + TOLERANCE) {
          discrepancies.push({
            type: "quantity_over_received",
            message: `Received quantity (${receivedQty}) exceeds ordered quantity (${poLine.quantity}) for line "${poLine.description}"`,
            lineItem: { key: poLine.key, description: poLine.description },
          });
        }
      }

      if (!billLine && billRows.length > 0) {
        discrepancies.push({
          type: "missing_bill_line",
          message: `No bill line found for PO line "${poLine.description}" (key: ${poLine.key})`,
          lineItem: { key: poLine.key, description: poLine.description },
        });
      } else if (billLine) {
        if (billedQty > receivedQty + TOLERANCE) {
          discrepancies.push({
            type: "quantity_over_billed",
            message: `Billed quantity (${billedQty}) exceeds received quantity (${receivedQty}) for line "${poLine.description}"`,
            lineItem: { key: poLine.key, description: poLine.description },
          });
        }
        if (Math.abs(poLine.unitPrice - billLine.unitPrice) > TOLERANCE) {
          discrepancies.push({
            type: "unit_price_mismatch",
            message: `Unit price mismatch for line "${poLine.description}": PO ${poLine.unitPrice} vs Bill ${billLine.unitPrice}`,
            lineItem: { key: poLine.key, description: poLine.description },
          });
        }
        const expectedBillLineTotal = billedQty * billLine.unitPrice;
        if (Math.abs(billLine.lineTotal - expectedBillLineTotal) > TOLERANCE) {
          discrepancies.push({
            type: "line_total_mismatch",
            message: `Bill line total mismatch for line "${poLine.description}": expected ${expectedBillLineTotal} vs actual ${billLine.lineTotal}`,
            lineItem: { key: poLine.key, description: poLine.description },
          });
        }
      }

      const expectedPoLineTotal = poLine.quantity * poLine.unitPrice;
      if (Math.abs(poLine.lineTotal - expectedPoLineTotal) > TOLERANCE) {
        discrepancies.push({
          type: "line_total_mismatch",
          message: `PO line total mismatch for line "${poLine.description}": expected ${expectedPoLineTotal} vs actual ${poLine.lineTotal}`,
          lineItem: { key: poLine.key, description: poLine.description },
        });
      }

      const matched = discrepancies.length === 0;
      lineResults.push({
        key: poLine.key,
        description: poLine.description,
        po: { quantity: poLine.quantity, unitPrice: poLine.unitPrice, lineTotal: poLine.lineTotal },
        receipt: receiptLine
          ? { quantity: receiptLine.quantity, unitPrice: receiptLine.unitPrice, lineTotal: receiptLine.lineTotal }
          : null,
        bill: billLine
          ? { quantity: billLine.quantity, unitPrice: billLine.unitPrice, lineTotal: billLine.lineTotal }
          : null,
        matched,
        discrepancies,
      });
      allLineDiscrepancies.push(...discrepancies);
    }

    for (const rl of receiptLines) {
      const poMatch = poLines.find((pl) => pl.key === rl.key);
      if (!poMatch) {
        const disc: LineDiscrepancy = {
          type: "extra_receipt_line",
          message: `Goods receipt line "${rl.description}" (key: ${rl.key}) has no corresponding PO line`,
          lineItem: { key: rl.key, description: rl.description },
        };
        allLineDiscrepancies.push(disc);
        lineResults.push({
          key: rl.key,
          description: rl.description,
          po: null,
          receipt: { quantity: rl.quantity, unitPrice: rl.unitPrice, lineTotal: rl.lineTotal },
          bill: null,
          matched: false,
          discrepancies: [disc],
        });
      }
    }

    for (const bl of billLines) {
      const poMatch = poLines.find((pl) => pl.key === bl.key);
      if (!poMatch) {
        const disc: LineDiscrepancy = {
          type: "extra_bill_line",
          message: `Bill line "${bl.description}" (key: ${bl.key}) has no corresponding PO line`,
          lineItem: { key: bl.key, description: bl.description },
        };
        allLineDiscrepancies.push(disc);
        lineResults.push({
          key: bl.key,
          description: bl.description,
          po: null,
          receipt: null,
          bill: { quantity: bl.quantity, unitPrice: bl.unitPrice, lineTotal: bl.lineTotal },
          matched: false,
          discrepancies: [disc],
        });
      }
    }

    const poAmount = Number(po.amount);
    const receiptAmount = receiptRows.reduce((sum: number, r: any) => sum + Number(r.total_amount), 0);
    const billAmount = billRows.reduce((sum: number, b: any) => sum + Number(b.total ?? 0), 0);
    const invoiceAmount = invoiceRows.reduce((sum: number, i: any) => sum + Number(i.amount), 0);
    const billOrInvoiceAmount = billAmount > 0 ? billAmount : invoiceAmount;

    const totalDiscrepancies: LineDiscrepancy[] = [];
    if (Math.abs(poAmount - receiptAmount) > TOLERANCE) {
      totalDiscrepancies.push({
        type: "total_mismatch_po_receipt",
        message: `PO total (${poAmount}) does not match goods receipt total (${receiptAmount})`,
        lineItem: { key: "", description: "" },
      });
    }
    if (billOrInvoiceAmount > 0 && Math.abs(poAmount - billOrInvoiceAmount) > TOLERANCE) {
      totalDiscrepancies.push({
        type: "total_mismatch_po_bill",
        message: `PO total (${poAmount}) does not match bill/invoice total (${billOrInvoiceAmount})`,
        lineItem: { key: "", description: "" },
      });
    }
    if (billOrInvoiceAmount > 0 && Math.abs(receiptAmount - billOrInvoiceAmount) > TOLERANCE) {
      totalDiscrepancies.push({
        type: "total_mismatch_receipt_bill",
        message: `Goods receipt total (${receiptAmount}) does not match bill/invoice total (${billOrInvoiceAmount})`,
        lineItem: { key: "", description: "" },
      });
    }

    const allDiscrepancies = [...vendorDiscrepancies, ...allLineDiscrepancies, ...totalDiscrepancies];
    const allMatched = allDiscrepancies.length === 0;

    return NextResponse.json({
      match: {
        poId,
        po: {
          poNumber: po.po_number,
          vendorId: poVendorId,
          amount: poAmount,
          status: po.status,
          lineCount: poLines.length,
        },
        receipts: receiptRows.map((r: any) => ({
          receiptNumber: r.receipt_number,
          vendorId: r.vendor_id,
          amount: Number(r.total_amount),
          status: r.status,
          lineCount: normalizeLines(r.items).length,
        })),
        bills: billRows.map((b: any) => ({
          billNumber: b.bill_number,
          vendorId: b.vendor_id,
          amount: Number(b.total ?? 0),
          status: b.status,
        })),
        invoices: invoiceRows.map((i: any) => ({
          invoiceNumber: i.invoice_number,
          vendorId: i.vendor_id,
          amount: Number(i.amount),
          status: i.status,
        })),
        lineMatches: lineResults,
        summary: {
          poAmount,
          receiptAmount,
          billAmount,
          invoiceAmount,
          vendorMatched: vendorDiscrepancies.length === 0,
          linesMatched: allLineDiscrepancies.length === 0,
          totalsMatched: totalDiscrepancies.length === 0,
          allMatched,
          status: allMatched ? "matched" : "disputed",
          discrepancyCount: allDiscrepancies.length,
        },
        discrepancies: allDiscrepancies,
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
