import { NextRequest, NextResponse } from "next/server";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tenantSlug = url.searchParams.get("tenantSlug");
    const type = url.searchParams.get("type") || "pl";
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!tenantSlug) {
      return NextResponse.json(
        { error: "tenantSlug is required" },
        { status: 400 }
      );
    }
    const tenant = tenantSlug as string;

    const sql = SQL;
    let report: any = {};

    switch (type) {
      case "pl":
        report = await generatePLReport(sql, tenant, startDate || undefined, endDate || undefined);
        break;
      case "balance":
        report = await generateBalanceSheetReport(sql, tenant, startDate || undefined, endDate || undefined);
        break;
      case "cashflow":
        report = await generateCashFlowReport(sql, tenant, startDate || undefined, endDate || undefined);
        break;
      case "aged":
        report = await generateAgedReceivablesReport(sql, tenant, startDate || undefined, endDate || undefined);
        break;
      default:
        report = await generatePLReport(sql, tenant, startDate || undefined, endDate || undefined);
    }

    return NextResponse.json({ report });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Reports generation failed:", errorMessage, error);
    return NextResponse.json(
      { error: "Failed to generate report", details: errorMessage },
      { status: 500 }
    );
  }
}

async function generatePLReport(sql: any, tenantSlug: string, startDate?: string, endDate?: string) {
  try {
    // For now, return mock P&L structure
    return {
      title: "Profit & Loss Statement",
      metrics: [
        { label: "Total Revenue", value: 5250000, change: 12 },
        { label: "Total Expenses", value: 3180000, change: 8 },
        { label: "Gross Profit", value: 2070000, change: 18 },
        { label: "Net Income", value: 850000, change: 15 },
      ],
      items: [
        { name: "Sales Revenue", amount: 5000000, percentage: 95, priorAmount: 4450000 },
        { name: "Service Revenue", amount: 250000, percentage: 5, priorAmount: 225000 },
        { name: "Cost of Goods Sold", amount: -2400000, percentage: 46, priorAmount: -2200000 },
        { name: "Operating Expenses", amount: -780000, percentage: 15, priorAmount: -750000 },
        { name: "Other Expenses", amount: -220000, percentage: 4, priorAmount: -175000 },
      ],
    };
  } catch (error) {
    console.error("Error generating P&L report:", error);
    return { metrics: [], items: [] };
  }
}

async function generateBalanceSheetReport(sql: any, tenantSlug: string, startDate?: string, endDate?: string) {
  try {
    return {
      title: "Balance Sheet",
      metrics: [
        { label: "Total Assets", value: 8500000 },
        { label: "Total Liabilities", value: 3200000 },
        { label: "Total Equity", value: 5300000 },
      ],
      items: [
        { name: "Current Assets", amount: 2800000, percentage: 33 },
        { name: "Fixed Assets", amount: 5700000, percentage: 67 },
        { name: "Current Liabilities", amount: 1200000, percentage: 37 },
        { name: "Long-term Liabilities", amount: 2000000, percentage: 63 },
        { name: "Shareholders' Equity", amount: 5300000, percentage: 100 },
      ],
    };
  } catch (error) {
    console.error("Error generating balance sheet report:", error);
    return { metrics: [], items: [] };
  }
}

async function generateCashFlowReport(sql: any, tenantSlug: string, startDate?: string, endDate?: string) {
  try {
    return {
      title: "Cash Flow Statement",
      metrics: [
        { label: "Operating Cash Flow", value: 1250000, change: 8 },
        { label: "Investing Cash Flow", value: -450000, change: -5 },
        { label: "Financing Cash Flow", value: -200000, change: 0 },
        { label: "Net Cash Change", value: 600000, change: 12 },
      ],
      items: [
        { name: "Cash from Operations", amount: 1250000, percentage: 100 },
        { name: "Capital Expenditures", amount: -450000, percentage: 36 },
        { name: "Debt Repayment", amount: -200000, percentage: 16 },
        { name: "Dividends Paid", amount: -150000, percentage: 12 },
      ],
    };
  } catch (error) {
    console.error("Error generating cash flow report:", error);
    return { metrics: [], items: [] };
  }
}

async function generateAgedReceivablesReport(sql: any, tenantSlug: string, startDate?: string, endDate?: string) {
  try {
    return {
      title: "Aged Receivables",
      metrics: [
        { label: "Total Outstanding", value: 2850000 },
        { label: "Current (0-30)", value: 1800000 },
        { label: "Overdue (31-60)", value: 750000 },
        { label: "Very Overdue (60+)", value: 300000 },
      ],
      items: [
        { name: "Current (0-30 days)", amount: 1800000, percentage: 63 },
        { name: "Overdue (31-60 days)", amount: 750000, percentage: 26 },
        { name: "Very Overdue (60+ days)", amount: 300000, percentage: 11 },
      ],
    };
  } catch (error) {
    console.error("Error generating aged receivables report:", error);
    return { metrics: [], items: [] };
  }
}
