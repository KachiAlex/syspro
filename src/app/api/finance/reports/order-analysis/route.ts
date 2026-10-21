export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import {
  salesOrderAnalysis,
  purchaseOrderAnalysis,
  itemsToBeBilledPurchase,
  itemsToBeReceivedPurchase,
  itemsToBeBilledSales,
  itemsToBeDeliveredSales,
  OrderAnalysisFilter,
} from "@/lib/finance/order-analysis";
import { requireModuleAccess } from "@/lib/api-auth";

function escCsv(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(escCsv).join(",")).join("\n");
}

const TYPES = [
  "sales",
  "purchase",
  "purchase-to-be-billed",
  "purchase-to-be-received",
  "sales-to-be-billed",
  "sales-to-be-delivered",
] as const;

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantSlug = searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }
    const type = (searchParams.get("type") ?? "sales") as (typeof TYPES)[number];
    if (!TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: `type must be one of: ${TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const filter: OrderAnalysisFilter = {
      tenantSlug,
      periodStart: (searchParams.get("periodStart") ?? searchParams.get("startDate")) ?? undefined,
      periodEnd: (searchParams.get("periodEnd") ?? searchParams.get("endDate")) ?? undefined,
      branchId: searchParams.get("branchId") ?? searchParams.get("branch") ?? undefined,
    };
    const { applyBranchScope } = await import("@/lib/finance/report-scope");
    await applyBranchScope(filter as any, tenantSlug, (_scope as any).user?.id, filter.branchId ?? null);

    let headers: string[];
    let rows: unknown[][];
    switch (type) {
      case "sales": {
        const data = await salesOrderAnalysis(filter);
        headers = ["Order", "Date", "Customer", "Status", "Ordered Qty", "Ordered Amt", "Invoiced", "Pending Billing", "Delivered", "Billed %"];
        rows = data.map((r) => [r.orderNumber, r.orderDate, r.customer, r.status, r.orderedQty, r.orderedAmount.toFixed(2), r.invoicedAmount.toFixed(2), r.pendingBillingAmount.toFixed(2), r.delivered ? "Y" : "N", r.billingPct]);
        return respond(searchParams, type, headers, rows, data);
      }
      case "purchase": {
        const data = await purchaseOrderAnalysis(filter);
        headers = ["PO", "Date", "Supplier", "Status", "Ordered Qty", "Ordered Amt", "Received Qty", "Received Amt", "Billed", "Rcvd Not Billed", "Not Received", "Receipt %", "Billing %"];
        rows = data.map((r) => [r.poNumber, r.orderDate, r.supplier, r.status, r.orderedQty, r.orderedAmount.toFixed(2), r.receivedQty, r.receivedAmount.toFixed(2), r.billedAmount.toFixed(2), r.receivedNotBilled.toFixed(2), r.orderedNotReceived, r.receiptPct, r.billingPct]);
        return respond(searchParams, type, headers, rows, data);
      }
      case "purchase-to-be-billed": {
        const data = await itemsToBeBilledPurchase(filter);
        headers = ["PO", "Date", "Supplier", "Received Amt", "Billed", "Rcvd Not Billed"];
        rows = data.map((r) => [r.poNumber, r.orderDate, r.supplier, r.receivedAmount.toFixed(2), r.billedAmount.toFixed(2), r.receivedNotBilled.toFixed(2)]);
        return respond(searchParams, type, headers, rows, data);
      }
      case "purchase-to-be-received": {
        const data = await itemsToBeReceivedPurchase(filter);
        headers = ["PO", "Date", "Supplier", "Item", "Description", "Ordered", "Received", "Pending", "Unit Price", "Pending Value"];
        rows = data.map((r) => [r.orderNumber, r.orderDate, r.party, r.itemCode, r.description, r.orderedQty, r.fulfilledQty, r.pendingQty, r.unitPrice.toFixed(2), r.pendingValue.toFixed(2)]);
        return respond(searchParams, type, headers, rows, data);
      }
      case "sales-to-be-billed": {
        const data = await itemsToBeBilledSales(filter);
        headers = ["Order", "Date", "Customer", "Status", "Ordered Amt", "Invoiced", "Pending Billing"];
        rows = data.map((r) => [r.orderNumber, r.orderDate, r.customer, r.status, r.orderedAmount.toFixed(2), r.invoicedAmount.toFixed(2), r.pendingBillingAmount.toFixed(2)]);
        return respond(searchParams, type, headers, rows, data);
      }
      case "sales-to-be-delivered": {
        const data = await itemsToBeDeliveredSales(filter);
        headers = ["Order", "Date", "Customer", "Status", "Ordered Qty", "Ordered Amt"];
        rows = data.map((r) => [r.orderNumber, r.orderDate, r.customer, r.status, r.orderedQty, r.orderedAmount.toFixed(2)]);
        return respond(searchParams, type, headers, rows, data);
      }
    }
  } catch (error) {
    console.error("Order analysis error:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: (error as any)?.status ?? 500 },
    );
  }
}

function respond(searchParams: URLSearchParams, type: string, headers: string[], rows: unknown[][], data: unknown) {
  if (searchParams.get("format") === "csv") {
    return new NextResponse(toCsv(headers, rows), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${type}-analysis-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }
  return NextResponse.json({ success: true, data });
}
