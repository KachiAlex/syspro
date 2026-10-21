export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import * as R from "@/lib/finance/advanced-reports";
import { requireModuleAccess } from "@/lib/api-auth";

const REPORTS = [
  "financial-ratios",
  "gross-profit",
  "trial-balance-for-party",
  "voucher-wise-balance",
  "dimension-wise-balance",
  "sales-invoice-trends",
  "purchase-invoice-trends",
  "sales-payment-summary",
  "bank-reconciliation-statement",
  "billed-items-to-be-received",
  "payment-period-by-invoice-date",
  "pos-register",
  "inactive-sales-items",
  "invalid-ledger-entries",
] as const;

function esc(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const f2 = (v: unknown) => (typeof v === "number" ? v.toFixed(2) : v ?? "");

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;

  try {
    const sp = request.nextUrl.searchParams;
    const tenantSlug = sp.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }
    const report = sp.get("report") as (typeof REPORTS)[number] | null;
    if (!report || !REPORTS.includes(report)) {
      return NextResponse.json(
        { success: false, error: `report must be one of: ${REPORTS.join(", ")}` },
        { status: 400 },
      );
    }

    const filter: R.AdvReportFilter = {
      tenantSlug,
      periodStart: (sp.get("periodStart") ?? sp.get("startDate")) ?? undefined,
      periodEnd: (sp.get("periodEnd") ?? sp.get("endDate")) ?? undefined,
      asOfDate: sp.get("asOfDate") ?? undefined,
      branchId: sp.get("branchId") ?? sp.get("branch") ?? undefined,
      financeBook: sp.get("financeBook") ?? undefined,
    };
    const { applyBranchScope } = await import("@/lib/finance/report-scope");
    await applyBranchScope(filter as any, tenantSlug, (_scope as any).user?.id, filter.branchId ?? null);
    const granularity = (sp.get("granularity") ?? "monthly") as any;

    let headers: string[] = [];
    let rows: unknown[][] = [];
    let data: unknown;
    switch (report) {
      case "financial-ratios": {
        data = await R.financialRatios(filter);
        const d = data as any;
        headers = ["Group", "Ratio", "Value"];
        const flat = (g: string, o: Record<string, number | null>) =>
          Object.entries(o).map(([k, v]) => [g, k, v === null ? "n/a" : Number(v).toFixed(3)]);
        rows = [...flat("liquidity", d.liquidity), ...flat("leverage", d.leverage), ...flat("profitability", d.profitability), ...flat("efficiency", d.efficiency)];
        break;
      }
      case "gross-profit": {
        const r = await R.grossProfit(filter);
        data = r;
        headers = ["Invoice", "Date", "Customer", "Item", "Qty", "Unit Price", "Amount", "Unit Cost", "Gross Profit", "Margin %"];
        rows = (r.rows as any[]).map((x) => [x.invoice_number, String(x.issued_date).slice(0, 10), x.customer_name, x.description, x.quantity, f2(x.unit_price), f2(x.amount), f2(x.unit_cost), f2(x.gross_profit), f2(x.margin_pct)]);
        break;
      }
      case "trial-balance-for-party": {
        data = await R.trialBalanceForParty(filter);
        headers = ["Party Type", "Party", "Account", "Name", "Debit", "Credit", "Balance"];
        rows = (data as any[]).map((x) => [x.party_type, x.party_id, x.account_code, x.account_name, f2(x.debit), f2(x.credit), f2(x.balance)]);
        break;
      }
      case "voucher-wise-balance": {
        data = await R.voucherWiseBalance(filter);
        headers = ["Voucher Type", "Voucher", "Account", "Name", "Debit", "Credit", "Balance"];
        rows = (data as any[]).map((x) => [x.voucher_type, x.voucher_no, x.account_code, x.account_name, f2(x.debit), f2(x.credit), f2(x.balance)]);
        break;
      }
      case "dimension-wise-balance": {
        data = await R.dimensionWiseBalance({ ...filter, dimension: sp.get("dimension") ?? "branch" });
        headers = ["Dimension", "Account Type", "Account", "Name", "Debit", "Credit", "Balance"];
        rows = (data as any[]).map((x) => [x.dimension_value, x.account_type, x.account_code, x.account_name, f2(x.debit), f2(x.credit), f2(x.balance)]);
        break;
      }
      case "sales-invoice-trends":
      case "purchase-invoice-trends": {
        data = await R.invoiceTrends({ ...filter, kind: report === "sales-invoice-trends" ? "sales" : "purchase", granularity });
        headers = ["Period", "Documents", "Parties", "Total"];
        rows = (data as any[]).map((x) => [String(x.bucket).slice(0, 10), x.documents, x.parties, f2(x.total)]);
        break;
      }
      case "sales-payment-summary": {
        data = await R.salesPaymentSummary(filter);
        const d = data as any;
        headers = ["Method", "Payments", "Amount"];
        rows = (d.byMethod as any[]).map((x) => [x.method, x.payments, f2(x.amount)]);
        rows.push(["RETURNS", d.returns?.returns ?? 0, f2(d.returns?.returned_amount ?? 0)]);
        break;
      }
      case "bank-reconciliation-statement": {
        data = await R.bankReconciliationStatement({ ...filter, accountCode: sp.get("accountCode") ?? undefined });
        headers = ["Account", "Name", "Book Balance", "Reconciled", "Unreconciled"];
        rows = (data as any[]).map((x) => [x.account_code, x.account_name, f2(x.book_balance), f2(x.reconciled_balance), f2(Number(x.book_balance) - Number(x.reconciled_balance))]);
        break;
      }
      case "billed-items-to-be-received": {
        data = await R.billedItemsToBeReceived(filter);
        headers = ["PO", "Supplier", "Item", "Billed Qty", "Received Qty", "Pending", "Billed Value"];
        rows = (data as any[]).map((x) => [x.po_number, x.supplier_name ?? "", x.description ?? "", x.billed_qty, x.received_qty, x.pending_qty, f2(x.billed_value)]);
        break;
      }
      case "payment-period-by-invoice-date": {
        data = await R.paymentPeriodByInvoiceDate(filter);
        const d = data as any;
        headers = ["Invoice", "Issued", "Customer", "Amount", "Applied", "Paid On", "Days To Pay"];
        rows = (d.rows as any[]).map((x) => [x.invoice_number, x.issued_date, x.customer_name, f2(x.amount), f2(x.applied_amount), x.payment_date, x.days_to_pay]);
        break;
      }
      case "pos-register": {
        data = await R.posRegister(filter);
        const d = data as any;
        headers = ["Receipt", "Time", "Customer", "Method", "Net", "Tax", "Total", "Discount", "Shift", "Cashier"];
        rows = (d.rows as any[]).map((x) => [x.receipt_no, x.created_at, x.customer_name ?? "", x.payment_method, f2(x.net_amount), f2(x.tax_amount), f2(x.total_amount), f2(x.discount_amount), x.shift_id ?? "", x.created_by ?? ""]);
        break;
      }
      case "inactive-sales-items": {
        data = await R.inactiveSalesItems(filter);
        headers = ["SKU", "Name", "Category", "Stock", "Unit Cost", "Sale Price", "Last Sale"];
        rows = (data as any[]).map((x) => [x.sku, x.name, x.category ?? "", x.current_stock, f2(x.unit_cost), f2(x.sale_price), x.last_sale_date ?? "never"]);
        break;
      }
      case "invalid-ledger-entries": {
        data = await R.invalidLedgerEntries(filter);
        const d = data as any;
        headers = ["Check", "Rows"];
        rows = Object.entries(d).map(([k, v]) => [k, (v as any[]).length]);
        break;
      }
    }

    if (sp.get("format") === "csv") {
      return new NextResponse(
        [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n"),
        {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${report}-${new Date().toISOString().split("T")[0]}.csv"`,
          },
        },
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Advanced report error:", error);
    return NextResponse.json(
      { success: false, error: (error as any)?.message ?? "Internal server error" },
      { status: (error as any)?.status ?? 500 },
    );
  }
}
