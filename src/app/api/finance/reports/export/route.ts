export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { requireModuleAccess } from "@/lib/api-auth";
import {
  generatePnLReport,
  generateBalanceSheet,
  generateCashFlowReport,
  generateAgedReceivablesReport,
  generateAgedPayablesReport,
  generateTrialBalance,
  generateGeneralLedger,
  generatePnLCSV,
  generateBalanceSheetCSV,
  generateCashFlowCSV,
  generateAgedReceivablesCSV,
  generateAgedPayablesCSV,
  generateTrialBalanceCSV,
  generateGeneralLedgerCSV,
} from "@/lib/finance/reports-db";
import type { ReportFilters } from "@/lib/finance/assets-reports";

const REPORTS: Record<
  string,
  {
    name: string;
    run: (f: ReportFilters) => Promise<any>;
    csv: (r: any) => string;
  }
> = {
  pl: { name: "Profit & Loss Statement", run: generatePnLReport, csv: generatePnLCSV },
  "balance-sheet": { name: "Balance Sheet", run: generateBalanceSheet, csv: generateBalanceSheetCSV },
  balance: { name: "Balance Sheet", run: generateBalanceSheet, csv: generateBalanceSheetCSV },
  cashflow: { name: "Cash Flow Statement", run: generateCashFlowReport, csv: generateCashFlowCSV },
  "cash-flow": { name: "Cash Flow Statement", run: generateCashFlowReport, csv: generateCashFlowCSV },
  "aged-receivables": { name: "Aged Receivables", run: generateAgedReceivablesReport, csv: generateAgedReceivablesCSV },
  aged: { name: "Aged Receivables", run: generateAgedReceivablesReport, csv: generateAgedReceivablesCSV },
  "aged-payables": { name: "Aged Payables", run: generateAgedPayablesReport, csv: generateAgedPayablesCSV },
  "trial-balance": { name: "Trial Balance", run: generateTrialBalance, csv: generateTrialBalanceCSV },
  "general-ledger": { name: "General Ledger", run: generateGeneralLedger, csv: generateGeneralLedgerCSV },
};

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "pl";
    const tenantSlug = url.searchParams.get("tenantSlug");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!tenantSlug) {
      return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
    }

    const report = REPORTS[type];
    if (!report) {
      return NextResponse.json(
        { error: `Invalid report type. Available: ${Object.keys(REPORTS).join(", ")}` },
        { status: 400 }
      );
    }

    const filters: ReportFilters = {
      tenantSlug,
      periodStart: startDate ? new Date(startDate) : undefined,
      periodEnd: endDate ? new Date(endDate) : undefined,
    };

    const data = await report.run(filters);
    if (!data) {
      return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }

    const safeStart = startDate ?? "all";
    const safeEnd = endDate ?? "all";

    return new NextResponse(report.csv(data), {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${type}-report-${safeStart}-to-${safeEnd}.csv"`,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Report export failed:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to export report", details: errorMessage },
      { status: 500 }
    );
  }
}
