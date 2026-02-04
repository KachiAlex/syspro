import { db } from "@/lib/db";
import {
  PnLReport,
  PnLReportLine,
  BalanceSheet,
  BalanceSheetLine,
  CashFlowReport,
  CashFlowLine,
  AgedReceivablesReport,
  AgedReceivable,
  AgedPayablesReport,
  AgedPayable,
  ReportFilters,
  DrillDownDetail,
} from "./assets-reports";

/**
 * PROFIT & LOSS REPORT
 */

export async function generatePnLReport(
  filters: ReportFilters
): Promise<PnLReport | null> {
  try {
    // Get revenue lines
    const revenueResult = await db.query(
      `
      SELECT
        code,
        name,
        amount_total,
        account_type
      FROM p_and_l_view
      WHERE section = 'REVENUE'
      ORDER BY code
      `
    );

    // Get expense lines
    const expenseResult = await db.query(
      `
      SELECT
        code,
        name,
        amount_total,
        account_type
      FROM p_and_l_view
      WHERE section = 'EXPENSES'
      ORDER BY code
      `
    );

    const revenueLines: PnLReportLine[] = revenueResult.rows;
    const expenseLines: PnLReportLine[] = expenseResult.rows;

    const totalRevenue = revenueLines.reduce((sum, line) => sum + (line.amountTotal || 0), 0);
    const totalExpenses = expenseLines.reduce((sum, line) => sum + (line.amountTotal || 0), 0);

    // Add percent of revenue
    const revenueWithPercent = revenueLines.map((line) => ({
      ...line,
      percentOfRevenue: totalRevenue > 0 ? (line.amountTotal / totalRevenue) * 100 : 0,
    }));

    const expenseWithPercent = expenseLines.map((line) => ({
      ...line,
      percentOfRevenue: totalRevenue > 0 ? (line.amountTotal / totalRevenue) * 100 : 0,
    }));

    return {
      periodStart: filters.periodStart || new Date(new Date().getFullYear(), 0, 1),
      periodEnd: filters.periodEnd || new Date(),
      tenantId: filters.tenantId,
      revenue: revenueWithPercent,
      expenses: expenseWithPercent,
      totalRevenue,
      totalExpenses,
      netIncome: totalRevenue - totalExpenses,
    };
  } catch (error) {
    console.error("Error generating P&L report:", error);
    throw error;
  }
}

/**
 * BALANCE SHEET REPORT
 */

export async function generateBalanceSheet(
  filters: ReportFilters
): Promise<BalanceSheet | null> {
  try {
    const result = await db.query(
      `
      SELECT
        section,
        code,
        name,
        account_type,
        balance
      FROM balance_sheet_view
      ORDER BY section, code
      `
    );

    const lines: BalanceSheetLine[] = result.rows;

    // Calculate totals
    const assets = lines.filter((l) => l.section === "ASSETS");
    const liabilities = lines.filter((l) => l.section === "LIABILITIES");
    const equity = lines.filter((l) => l.section === "EQUITY");

    const totalAssets = assets.reduce((sum, line) => sum + (line.balance || 0), 0);
    const totalLiabilities = liabilities.reduce((sum, line) => sum + (line.balance || 0), 0);
    const totalEquity = equity.reduce((sum, line) => sum + (line.balance || 0), 0);

    // Add percent of total
    const assetsWithPercent = assets.map((line) => ({
      ...line,
      percentOfTotal: totalAssets > 0 ? (line.balance / totalAssets) * 100 : 0,
    }));

    const liabilitiesWithPercent = liabilities.map((line) => ({
      ...line,
      percentOfTotal: (totalAssets > 0 ? (line.balance / totalAssets) * 100 : 0),
    }));

    const equityWithPercent = equity.map((line) => ({
      ...line,
      percentOfTotal: (totalAssets > 0 ? (line.balance / totalAssets) * 100 : 0),
    }));

    return {
      asOfDate: filters.periodEnd || new Date(),
      tenantId: filters.tenantId,
      assets: assetsWithPercent,
      liabilities: liabilitiesWithPercent,
      equity: equityWithPercent,
      totalAssets,
      totalLiabilities,
      totalEquity,
    };
  } catch (error) {
    console.error("Error generating balance sheet:", error);
    throw error;
  }
}

/**
 * CASH FLOW REPORT
 */

export async function generateCashFlowReport(
  filters: ReportFilters
): Promise<CashFlowReport | null> {
  try {
    const result = await db.query(
      `
      SELECT
        transaction_date,
        cash_flow_category,
        code,
        name,
        net_cash_flow
      FROM cash_flow_view
      ORDER BY cash_flow_category, transaction_date DESC
      `
    );

    const lines: CashFlowLine[] = result.rows;

    const operatingLines = lines.filter((l) => l.category === "OPERATING");
    const investingLines = lines.filter((l) => l.category === "INVESTING");
    const financingLines = lines.filter((l) => l.category === "FINANCING");

    const operatingTotal = operatingLines.reduce((sum, line) => sum + (line.netCashFlow || 0), 0);
    const investingTotal = investingLines.reduce((sum, line) => sum + (line.netCashFlow || 0), 0);
    const financingTotal = financingLines.reduce((sum, line) => sum + (line.netCashFlow || 0), 0);

    const netCashChange = operatingTotal + investingTotal + financingTotal;

    return {
      periodStart: filters.periodStart || new Date(new Date().getFullYear(), 0, 1),
      periodEnd: filters.periodEnd || new Date(),
      tenantId: filters.tenantId,
      operatingActivities: operatingLines,
      investingActivities: investingLines,
      financingActivities: financingLines,
      netCashChange,
      beginningCash: 0, // Would be from previous period balance sheet
      endingCash: netCashChange,
    };
  } catch (error) {
    console.error("Error generating cash flow report:", error);
    throw error;
  }
}

/**
 * AGED RECEIVABLES REPORT
 */

export async function generateAgedReceivablesReport(
  filters: ReportFilters
): Promise<AgedReceivablesReport | null> {
  try {
    const result = await db.query(
      `
      SELECT * FROM aged_receivables_view
      ORDER BY aging_bucket, customer_name
      `
    );

    const receivables: AgedReceivable[] = result.rows;

    const totalOutstanding = receivables.reduce(
      (sum, rec) => sum + (rec.outstandingAmount || 0),
      0
    );
    const currentAmount = receivables
      .filter((r) => r.agingBucket === "Current")
      .reduce((sum, r) => sum + (r.outstandingAmount || 0), 0);
    const days31to60 = receivables
      .filter((r) => r.agingBucket === "31-60 days")
      .reduce((sum, r) => sum + (r.outstandingAmount || 0), 0);
    const days61to90 = receivables
      .filter((r) => r.agingBucket === "61-90 days")
      .reduce((sum, r) => sum + (r.outstandingAmount || 0), 0);
    const days91to120 = receivables
      .filter((r) => r.agingBucket === "91-120 days")
      .reduce((sum, r) => sum + (r.outstandingAmount || 0), 0);
    const over120Days = receivables
      .filter((r) => r.agingBucket === "Over 120 days")
      .reduce((sum, r) => sum + (r.outstandingAmount || 0), 0);

    return {
      asOfDate: filters.periodEnd || new Date(),
      tenantId: filters.tenantId,
      receivables,
      totalOutstanding,
      currentAmount,
      days31to60,
      days61to90,
      days91to120,
      over120Days,
    };
  } catch (error) {
    console.error("Error generating aged receivables report:", error);
    throw error;
  }
}

/**
 * AGED PAYABLES REPORT
 */

export async function generateAgedPayablesReport(
  filters: ReportFilters
): Promise<AgedPayablesReport | null> {
  try {
    const result = await db.query(
      `
      SELECT * FROM aged_payables_view
      ORDER BY aging_bucket, vendor_name
      `
    );

    const payables: AgedPayable[] = result.rows;

    const totalOutstanding = payables.reduce(
      (sum, pay) => sum + (pay.outstandingAmount || 0),
      0
    );
    const currentAmount = payables
      .filter((p) => p.agingBucket === "Current")
      .reduce((sum, p) => sum + (p.outstandingAmount || 0), 0);
    const days31to60 = payables
      .filter((p) => p.agingBucket === "31-60 days")
      .reduce((sum, p) => sum + (p.outstandingAmount || 0), 0);
    const days61to90 = payables
      .filter((p) => p.agingBucket === "61-90 days")
      .reduce((sum, p) => sum + (p.outstandingAmount || 0), 0);
    const days91to120 = payables
      .filter((p) => p.agingBucket === "91-120 days")
      .reduce((sum, p) => sum + (p.outstandingAmount || 0), 0);
    const over120Days = payables
      .filter((p) => p.agingBucket === "Over 120 days")
      .reduce((sum, p) => sum + (p.outstandingAmount || 0), 0);

    return {
      asOfDate: filters.periodEnd || new Date(),
      tenantId: filters.tenantId,
      payables,
      totalOutstanding,
      currentAmount,
      days31to60,
      days61to90,
      days91to120,
      over120Days,
    };
  } catch (error) {
    console.error("Error generating aged payables report:", error);
    throw error;
  }
}

/**
 * DRILL DOWN TO JOURNAL DETAILS
 */

export async function drillDownToJournalDetails(
  accountId: bigint,
  filters: ReportFilters
): Promise<DrillDownDetail[]> {
  try {
    let query = `
      SELECT
        je.created_at::DATE as date,
        je.description,
        jl.reference_number,
        jl.debit_amount,
        jl.credit_amount,
        jl.running_balance as balance,
        je.id as journal_entry_id
      FROM journal_lines jl
      JOIN journal_entries je ON jl.journal_entry_id = je.id
      WHERE jl.account_id = $1 AND je.status = 'POSTED'
    `;

    const params: any[] = [accountId.toString()];

    if (filters.periodStart) {
      query += ` AND je.created_at >= $${params.length + 1}`;
      params.push(filters.periodStart);
    }

    if (filters.periodEnd) {
      query += ` AND je.created_at <= $${params.length + 1}`;
      params.push(filters.periodEnd);
    }

    query += ` ORDER BY je.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error("Error drilling down to journal details:", error);
    throw error;
  }
}

/**
 * COMPARATIVE PERIOD REPORT
 */

export async function generateComparativePnL(
  tenantId: bigint,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  previousPeriodStart: Date,
  previousPeriodEnd: Date
): Promise<{
  current: PnLReport | null;
  previous: PnLReport | null;
  variance: any;
} | null> {
  try {
    const current = await generatePnLReport({
      tenantId,
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
    });

    const previous = await generatePnLReport({
      tenantId,
      periodStart: previousPeriodStart,
      periodEnd: previousPeriodEnd,
    });

    if (!current || !previous) return null;

    // Calculate variance
    const variance = {
      revenueVariance: current.totalRevenue - previous.totalRevenue,
      revenueVariancePercent:
        previous.totalRevenue > 0
          ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue) * 100
          : 0,
      expenseVariance: current.totalExpenses - previous.totalExpenses,
      expenseVariancePercent:
        previous.totalExpenses > 0
          ? ((current.totalExpenses - previous.totalExpenses) / previous.totalExpenses) * 100
          : 0,
      incomeVariance: current.netIncome - previous.netIncome,
    };

    return { current, previous, variance };
  } catch (error) {
    console.error("Error generating comparative P&L:", error);
    throw error;
  }
}

/**
 * EXPORT HELPERS
 */

export function generateCSVExport(data: any[][], headers: string[]): string {
  const csvContent = [
    headers.join(","),
    ...data.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  return csvContent;
}

export function generatePnLCSV(report: PnLReport): string {
  const headers = ["Account Code", "Account Name", "Amount", "% of Revenue"];
  const data: any[][] = [];

  data.push(["REVENUE"]);
  report.revenue.forEach((line) => {
    data.push([line.code, line.name, line.amountTotal.toFixed(2), (line.percentOfRevenue || 0).toFixed(2)]);
  });

  data.push([]);
  data.push(["TOTAL REVENUE", "", report.totalRevenue.toFixed(2), "100.00"]);
  data.push([]);

  data.push(["EXPENSES"]);
  report.expenses.forEach((line) => {
    data.push([line.code, line.name, line.amountTotal.toFixed(2), (line.percentOfRevenue || 0).toFixed(2)]);
  });

  data.push([]);
  data.push(["TOTAL EXPENSES", "", report.totalExpenses.toFixed(2), ""]);
  data.push([]);
  data.push(["NET INCOME", "", report.netIncome.toFixed(2), ""]);

  return generateCSVExport(data, headers);
}

export function generateBalanceSheetCSV(report: BalanceSheet): string {
  const headers = ["Account Code", "Account Name", "Balance", "% of Total Assets"];
  const data: any[][] = [];

  data.push(["ASSETS"]);
  report.assets.forEach((line) => {
    data.push([line.code, line.name, line.balance.toFixed(2), (line.percentOfTotal || 0).toFixed(2)]);
  });
  data.push(["TOTAL ASSETS", "", report.totalAssets.toFixed(2), "100.00"]);
  data.push([]);

  data.push(["LIABILITIES"]);
  report.liabilities.forEach((line) => {
    data.push([line.code, line.name, line.balance.toFixed(2), (line.percentOfTotal || 0).toFixed(2)]);
  });
  data.push(["TOTAL LIABILITIES", "", report.totalLiabilities.toFixed(2), ""]);
  data.push([]);

  data.push(["EQUITY"]);
  report.equity.forEach((line) => {
    data.push([line.code, line.name, line.balance.toFixed(2), (line.percentOfTotal || 0).toFixed(2)]);
  });
  data.push(["TOTAL EQUITY", "", report.totalEquity.toFixed(2), ""]);

  return generateCSVExport(data, headers);
}

export function generateCashFlowCSV(report: CashFlowReport): string {
  const headers = ["Account Code", "Account Name", "Amount"];
  const data: any[][] = [];

  data.push(["OPERATING ACTIVITIES"]);
  report.operatingActivities.forEach((line) => {
    data.push([line.code, line.name, line.netCashFlow.toFixed(2)]);
  });
  const operatingTotal = report.operatingActivities.reduce((sum, l) => sum + (l.netCashFlow || 0), 0);
  data.push(["NET OPERATING CASH FLOW", "", operatingTotal.toFixed(2)]);
  data.push([]);

  data.push(["INVESTING ACTIVITIES"]);
  report.investingActivities.forEach((line) => {
    data.push([line.code, line.name, line.netCashFlow.toFixed(2)]);
  });
  const investingTotal = report.investingActivities.reduce((sum, l) => sum + (l.netCashFlow || 0), 0);
  data.push(["NET INVESTING CASH FLOW", "", investingTotal.toFixed(2)]);
  data.push([]);

  data.push(["FINANCING ACTIVITIES"]);
  report.financingActivities.forEach((line) => {
    data.push([line.code, line.name, line.netCashFlow.toFixed(2)]);
  });
  const financingTotal = report.financingActivities.reduce((sum, l) => sum + (l.netCashFlow || 0), 0);
  data.push(["NET FINANCING CASH FLOW", "", financingTotal.toFixed(2)]);
  data.push([]);

  data.push(["NET CHANGE IN CASH", "", report.netCashChange.toFixed(2)]);

  return generateCSVExport(data, headers);
}

export function generateAgedReceivablesCSV(report: AgedReceivablesReport): string {
  const headers = ["Customer", "Invoice #", "Amount", "Days Outstanding", "Aging Bucket", "Outstanding"];
  const data: any[][] = [];

  report.receivables.forEach((rec) => {
    data.push([
      rec.customerName,
      rec.invoiceId.toString(),
      rec.amount.toFixed(2),
      rec.daysOutstanding.toString(),
      rec.agingBucket,
      rec.outstandingAmount.toFixed(2),
    ]);
  });

  data.push([]);
  data.push(["TOTAL", "", "", "", "", report.totalOutstanding.toFixed(2)]);
  data.push(["Current (0-30 days)", "", "", "", "", report.currentAmount.toFixed(2)]);
  data.push(["31-60 days", "", "", "", "", report.days31to60.toFixed(2)]);
  data.push(["61-90 days", "", "", "", "", report.days61to90.toFixed(2)]);
  data.push(["91-120 days", "", "", "", "", report.days91to120.toFixed(2)]);
  data.push(["Over 120 days", "", "", "", "", report.over120Days.toFixed(2)]);

  return generateCSVExport(data, headers);
}

export function generateAgedPayablesCSV(report: AgedPayablesReport): string {
  const headers = ["Vendor", "Invoice #", "Amount", "Days Outstanding", "Aging Bucket", "Outstanding"];
  const data: any[][] = [];

  report.payables.forEach((pay) => {
    data.push([
      pay.vendorName,
      pay.invoiceId.toString(),
      pay.amount.toFixed(2),
      pay.daysOutstanding.toString(),
      pay.agingBucket,
      pay.outstandingAmount.toFixed(2),
    ]);
  });

  data.push([]);
  data.push(["TOTAL", "", "", "", "", report.totalOutstanding.toFixed(2)]);
  data.push(["Current (0-30 days)", "", "", "", "", report.currentAmount.toFixed(2)]);
  data.push(["31-60 days", "", "", "", "", report.days31to60.toFixed(2)]);
  data.push(["61-90 days", "", "", "", "", report.days61to90.toFixed(2)]);
  data.push(["91-120 days", "", "", "", "", report.days91to120.toFixed(2)]);
  data.push(["Over 120 days", "", "", "", "", report.over120Days.toFixed(2)]);

  return generateCSVExport(data, headers);
}
