import { db, sql as SQL } from "../sql-client";
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
  TrialBalanceReport,
  TrialBalanceLine,
  GeneralLedgerReport,
  GLLine,
} from "./assets-reports";

/**
 * PROFIT & LOSS REPORT
 */

export async function generatePnLReport(
  filters: ReportFilters
): Promise<PnLReport | null> {
  try {
    const params: any[] = [filters.tenantSlug];
    let dateWhere = "";
    let idx = 1;
    if (filters.periodStart) {
      idx++;
      params.push(filters.periodStart);
      dateWhere += ` AND je.entry_date >= $${idx}`;
    }
    if (filters.periodEnd) {
      idx++;
      params.push(filters.periodEnd);
      dateWhere += ` AND je.entry_date <= $${idx}`;
    }

    const query = `
      SELECT
        coa.code,
        coa.name,
        COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as amount_total,
        coa.type as account_type,
        CASE WHEN coa.type = 'revenue' THEN 'REVENUE' ELSE 'EXPENSES' END as section
      FROM chart_of_accounts coa
      LEFT JOIN journal_entry_lines jel ON jel.account_code = coa.code
      LEFT JOIN journal_entries je ON jel.entry_id = je.id AND je.tenant_slug = $1
      WHERE coa.type IN ('revenue', 'expense')
        ${dateWhere}
      GROUP BY coa.code, coa.name, coa.type
      HAVING COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) != 0
      ORDER BY coa.type, coa.code
    `;

    const result = await db.query(query, params);
    const rows: any[] = result.rows;

    const revenueLines: PnLReportLine[] = rows
      .filter((r) => r.section === "REVENUE")
      .map((r) => ({
        section: "REVENUE" as const,
        code: r.code,
        name: r.name,
        amountTotal: Math.abs(Number(r.amount_total) || 0),
        accountType: r.account_type,
      }));

    const expenseLines: PnLReportLine[] = rows
      .filter((r) => r.section === "EXPENSES")
      .map((r) => ({
        section: "EXPENSES" as const,
        code: r.code,
        name: r.name,
        amountTotal: Math.abs(Number(r.amount_total) || 0),
        accountType: r.account_type,
      }));

    const totalRevenue = revenueLines.reduce((sum, line) => sum + line.amountTotal, 0);
    const totalExpenses = expenseLines.reduce((sum, line) => sum + line.amountTotal, 0);

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
      tenantSlug: filters.tenantSlug,
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
    const params: any[] = [filters.tenantSlug];
    let dateWhere = "";
    if (filters.periodEnd) {
      params.push(filters.periodEnd);
      dateWhere = ` AND je.entry_date <= $${params.length}`;
    }

    const query = `
      SELECT
        coa.code,
        coa.name,
        coa.type as account_type,
        CASE
          WHEN coa.type = 'asset' THEN 'ASSETS'
          WHEN coa.type = 'liability' THEN 'LIABILITIES'
          WHEN coa.type = 'equity' THEN 'EQUITY'
        END as section,
        COALESCE(SUM(
          CASE
            WHEN coa.type IN ('asset', 'expense') THEN jel.debit_amount - jel.credit_amount
            WHEN coa.type IN ('liability', 'equity', 'revenue') THEN jel.credit_amount - jel.debit_amount
          END
        ), 0) as balance
      FROM chart_of_accounts coa
      LEFT JOIN journal_entry_lines jel ON jel.account_code = coa.code
      LEFT JOIN journal_entries je ON jel.entry_id = je.id AND je.tenant_slug = $1
      WHERE coa.type IN ('asset', 'liability', 'equity')
        ${dateWhere}
      GROUP BY coa.code, coa.name, coa.type
      HAVING COALESCE(SUM(
          CASE
            WHEN coa.type IN ('asset', 'expense') THEN jel.debit_amount - jel.credit_amount
            WHEN coa.type IN ('liability', 'equity', 'revenue') THEN jel.credit_amount - jel.debit_amount
          END
        ), 0) != 0
      ORDER BY coa.type, coa.code
    `;

    const result = await db.query(query, params);
    const lines: BalanceSheetLine[] = result.rows.map((r: any) => ({
      section: r.section,
      code: r.code,
      name: r.name,
      balance: Math.abs(Number(r.balance) || 0),
      accountType: r.account_type,
    }));

    const assets = lines.filter((l) => l.section === "ASSETS");
    const liabilities = lines.filter((l) => l.section === "LIABILITIES");
    const equity = lines.filter((l) => l.section === "EQUITY");

    const totalAssets = assets.reduce((sum, line) => sum + line.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, line) => sum + line.balance, 0);
    const totalEquity = equity.reduce((sum, line) => sum + line.balance, 0);

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
      tenantSlug: filters.tenantSlug,
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
    const params: any[] = [filters.tenantSlug];
    let dateWhere = "";
    if (filters.periodStart) {
      params.push(filters.periodStart);
      dateWhere += ` AND je.entry_date >= $${params.length}`;
    }
    if (filters.periodEnd) {
      params.push(filters.periodEnd);
      dateWhere += ` AND je.entry_date <= $${params.length}`;
    }

    const query = `
      SELECT
        je.entry_date as transaction_date,
        coa.type as account_type,
        coa.code,
        coa.name,
        COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as net_cash_flow
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.entry_id = je.id
      JOIN chart_of_accounts coa ON jel.account_code = coa.code
      WHERE je.tenant_slug = $1
        AND coa.type IN ('asset', 'liability', 'equity', 'revenue', 'expense')
        ${dateWhere}
      GROUP BY je.entry_date, coa.type, coa.code, coa.name
      ORDER BY coa.type, je.entry_date DESC
    `;

    const result = await db.query(query, params);
    const rows: any[] = result.rows;

    const lines: CashFlowLine[] = rows.map((r) => ({
      category: categorizeCashFlow(r.account_type),
      date: r.transaction_date,
      code: r.code,
      name: r.name,
      netCashFlow: Number(r.net_cash_flow) || 0,
    }));

    const operatingLines = lines.filter((l) => l.category === "OPERATING");
    const investingLines = lines.filter((l) => l.category === "INVESTING");
    const financingLines = lines.filter((l) => l.category === "FINANCING");

    const operatingTotal = operatingLines.reduce((sum, line) => sum + line.netCashFlow, 0);
    const investingTotal = investingLines.reduce((sum, line) => sum + line.netCashFlow, 0);
    const financingTotal = financingLines.reduce((sum, line) => sum + line.netCashFlow, 0);

    const netCashChange = operatingTotal + investingTotal + financingTotal;

    let beginningCash = 0;
    if (filters.periodStart) {
      const cashParams: any[] = [filters.tenantSlug, filters.periodStart];
      const cashResult = await db.query(
        `SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as beginning_balance
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.entry_id = je.id
         JOIN chart_of_accounts coa ON jel.account_code = coa.code
         WHERE je.tenant_slug = $1
           AND coa.code IN ('1100', '1110')
           AND je.entry_date < $2`,
        cashParams
      );
      beginningCash = Number(cashResult.rows[0]?.beginning_balance || 0);
    }

    return {
      periodStart: filters.periodStart || new Date(new Date().getFullYear(), 0, 1),
      periodEnd: filters.periodEnd || new Date(),
      tenantSlug: filters.tenantSlug,
      operatingActivities: operatingLines,
      investingActivities: investingLines,
      financingActivities: financingLines,
      netCashChange,
      beginningCash,
      endingCash: beginningCash + netCashChange,
    };
  } catch (error) {
    console.error("Error generating cash flow report:", error);
    throw error;
  }
}

function categorizeCashFlow(accountType: string): "OPERATING" | "INVESTING" | "FINANCING" {
  switch (accountType) {
    case "revenue":
    case "expense":
      return "OPERATING";
    case "asset":
      return "INVESTING";
    case "liability":
    case "equity":
      return "FINANCING";
    default:
      return "OPERATING";
  }
}

/**
 * AGED RECEIVABLES REPORT
 */

export async function generateAgedReceivablesReport(
  filters: ReportFilters
): Promise<AgedReceivablesReport | null> {
  try {
    const params: any[] = [filters.tenantSlug];
    const query = `
      SELECT
        fi.id,
        fi.id::text as invoice_id,
        fi.customer_name,
        fi.amount,
        fi.issued_date as invoice_date,
        fi.due_date,
        fi.balance_due as outstanding_amount,
        GREATEST(CURRENT_DATE - fi.due_date::date, 0) as days_outstanding,
        CASE
          WHEN fi.balance_due <= 0 THEN 'Current'
          WHEN CURRENT_DATE - fi.due_date::date <= 30 THEN 'Current'
          WHEN CURRENT_DATE - fi.due_date::date <= 60 THEN '31-60 days'
          WHEN CURRENT_DATE - fi.due_date::date <= 90 THEN '61-90 days'
          WHEN CURRENT_DATE - fi.due_date::date <= 120 THEN '91-120 days'
          ELSE 'Over 120 days'
        END as aging_bucket
      FROM finance_invoices fi
      WHERE fi.tenant_slug = $1
        AND fi.balance_due > 0
        AND fi.status NOT IN ('void', 'paid')
      ORDER BY aging_bucket, fi.customer_name
    `;

    const result = await db.query(query, params);
    const receivables: AgedReceivable[] = result.rows.map((r: any) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      customerName: r.customer_name,
      amount: Number(r.amount) || 0,
      daysOutstanding: Number(r.days_outstanding) || 0,
      agingBucket: r.aging_bucket,
      invoiceDate: r.invoice_date,
      dueDate: r.due_date,
      outstandingAmount: Number(r.outstanding_amount) || 0,
    }));

    const totalOutstanding = receivables.reduce((sum, rec) => sum + rec.outstandingAmount, 0);
    const currentAmount = receivables.filter((r) => r.agingBucket === "Current").reduce((sum, r) => sum + r.outstandingAmount, 0);
    const days31to60 = receivables.filter((r) => r.agingBucket === "31-60 days").reduce((sum, r) => sum + r.outstandingAmount, 0);
    const days61to90 = receivables.filter((r) => r.agingBucket === "61-90 days").reduce((sum, r) => sum + r.outstandingAmount, 0);
    const days91to120 = receivables.filter((r) => r.agingBucket === "91-120 days").reduce((sum, r) => sum + r.outstandingAmount, 0);
    const over120Days = receivables.filter((r) => r.agingBucket === "Over 120 days").reduce((sum, r) => sum + r.outstandingAmount, 0);

    return {
      asOfDate: filters.periodEnd || new Date(),
      tenantSlug: filters.tenantSlug,
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
    const params: any[] = [filters.tenantSlug];
    const query = `
      SELECT
        b.id,
        b.id::text as invoice_id,
        v.legal_name as vendor_name,
        b.total as amount,
        b.bill_date as invoice_date,
        b.due_date,
        b.balance_due as outstanding_amount,
        GREATEST(CURRENT_DATE - b.due_date::date, 0) as days_outstanding,
        CASE
          WHEN b.balance_due <= 0 THEN 'Current'
          WHEN CURRENT_DATE - b.due_date::date <= 30 THEN 'Current'
          WHEN CURRENT_DATE - b.due_date::date <= 60 THEN '31-60 days'
          WHEN CURRENT_DATE - b.due_date::date <= 90 THEN '61-90 days'
          WHEN CURRENT_DATE - b.due_date::date <= 120 THEN '91-120 days'
          ELSE 'Over 120 days'
        END as aging_bucket
      FROM bills b
      LEFT JOIN vendors v ON b.vendor_id = v.id
      WHERE b.tenant_slug = $1
        AND b.balance_due > 0
        AND b.status NOT IN ('cancelled', 'paid')
      ORDER BY aging_bucket, v.legal_name
    `;

    const result = await db.query(query, params);
    const payables: AgedPayable[] = result.rows.map((r: any) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      vendorName: r.vendor_name || "Unknown Vendor",
      amount: Number(r.amount) || 0,
      daysOutstanding: Number(r.days_outstanding) || 0,
      agingBucket: r.aging_bucket,
      invoiceDate: r.invoice_date,
      dueDate: r.due_date,
      outstandingAmount: Number(r.outstanding_amount) || 0,
    }));

    const totalOutstanding = payables.reduce((sum, pay) => sum + pay.outstandingAmount, 0);
    const currentAmount = payables.filter((p) => p.agingBucket === "Current").reduce((sum, p) => sum + p.outstandingAmount, 0);
    const days31to60 = payables.filter((p) => p.agingBucket === "31-60 days").reduce((sum, p) => sum + p.outstandingAmount, 0);
    const days61to90 = payables.filter((p) => p.agingBucket === "61-90 days").reduce((sum, p) => sum + p.outstandingAmount, 0);
    const days91to120 = payables.filter((p) => p.agingBucket === "91-120 days").reduce((sum, p) => sum + p.outstandingAmount, 0);
    const over120Days = payables.filter((p) => p.agingBucket === "Over 120 days").reduce((sum, p) => sum + p.outstandingAmount, 0);

    return {
      asOfDate: filters.periodEnd || new Date(),
      tenantSlug: filters.tenantSlug,
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
 * TRIAL BALANCE REPORT
 */

export async function generateTrialBalance(
  filters: ReportFilters
): Promise<TrialBalanceReport | null> {
  try {
    const params: any[] = [filters.tenantSlug];
    let dateWhere = "";
    if (filters.periodEnd) {
      params.push(filters.periodEnd);
      dateWhere = ` AND je.entry_date <= $${params.length}`;
    }

    const query = `
      SELECT
        coa.code as account_code,
        coa.name as account_name,
        coa.type as account_type,
        COALESCE(SUM(jel.debit_amount), 0) as total_debit,
        COALESCE(SUM(jel.credit_amount), 0) as total_credit
      FROM chart_of_accounts coa
      LEFT JOIN journal_entry_lines jel ON jel.account_code = coa.code
      LEFT JOIN journal_entries je ON jel.entry_id = je.id AND je.tenant_slug = $1
      WHERE 1=1
        ${dateWhere}
      GROUP BY coa.code, coa.name, coa.type
      HAVING COALESCE(SUM(jel.debit_amount), 0) != 0 OR COALESCE(SUM(jel.credit_amount), 0) != 0
      ORDER BY coa.code
    `;

    const result = await db.query(query, params);
    const lines: TrialBalanceLine[] = result.rows.map((r: any) => ({
      accountCode: r.account_code,
      accountName: r.account_name,
      accountType: r.account_type,
      totalDebit: Number(r.total_debit) || 0,
      totalCredit: Number(r.total_credit) || 0,
    }));

    const totalDebits = lines.reduce((sum, l) => sum + l.totalDebit, 0);
    const totalCredits = lines.reduce((sum, l) => sum + l.totalCredit, 0);

    return {
      asOfDate: filters.periodEnd || new Date(),
      tenantSlug: filters.tenantSlug,
      lines,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  } catch (error) {
    console.error("Error generating trial balance:", error);
    throw error;
  }
}

/**
 * GENERAL LEDGER REPORT
 */

export async function generateGeneralLedger(
  filters: ReportFilters & { accountCode?: string }
): Promise<GeneralLedgerReport | null> {
  try {
    const params: any[] = [filters.tenantSlug];
    let whereClause = "";
    if (filters.accountCode) {
      params.push(filters.accountCode);
      whereClause += ` AND jel.account_code = $${params.length}`;
    }
    if (filters.periodStart) {
      params.push(filters.periodStart);
      whereClause += ` AND je.entry_date >= $${params.length}`;
    }
    if (filters.periodEnd) {
      params.push(filters.periodEnd);
      whereClause += ` AND je.entry_date <= $${params.length}`;
    }

    const query = `
      SELECT
        je.entry_number,
        je.entry_date,
        jel.account_code,
        jel.account_name,
        je.description,
        jel.debit_amount,
        jel.credit_amount,
        je.reference_type,
        je.reference_id
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.entry_id = je.id
      WHERE je.tenant_slug = $1
        ${whereClause}
      ORDER BY jel.account_code, je.entry_date, je.entry_number
    `;

    const result = await db.query(query, params);
    const rows: any[] = result.rows;

    let runningBalance = 0;
    const lines: GLLine[] = rows.map((r) => {
      const debit = Number(r.debit_amount) || 0;
      const credit = Number(r.credit_amount) || 0;
      runningBalance += debit - credit;
      return {
        entryNumber: r.entry_number,
        entryDate: r.entry_date,
        accountCode: r.account_code,
        accountName: r.account_name,
        description: r.description,
        debitAmount: debit,
        creditAmount: credit,
        runningBalance,
        referenceType: r.reference_type,
        referenceId: r.reference_id,
      };
    });

    const totalDebits = lines.reduce((sum, l) => sum + l.debitAmount, 0);
    const totalCredits = lines.reduce((sum, l) => sum + l.creditAmount, 0);

    let openingBalance = 0;
    if (filters.periodStart) {
      const openingParams: any[] = [filters.tenantSlug, filters.periodStart];
      let openingWhere = "";
      if (filters.accountCode) {
        openingParams.push(filters.accountCode);
        openingWhere = ` AND jel.account_code = $${openingParams.length}`;
      }
      const openingResult = await db.query(
        `SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as opening
         FROM journal_entry_lines jel
         JOIN journal_entries je ON jel.entry_id = je.id
         WHERE je.tenant_slug = $1
           AND je.entry_date < $2
           ${openingWhere}`,
        openingParams
      );
      openingBalance = Number(openingResult.rows[0]?.opening || 0);
    }

    return {
      periodStart: filters.periodStart || new Date(new Date().getFullYear(), 0, 1),
      periodEnd: filters.periodEnd || new Date(),
      tenantSlug: filters.tenantSlug,
      accountCode: filters.accountCode,
      lines,
      totalDebits,
      totalCredits,
      openingBalance,
      closingBalance: openingBalance + totalDebits - totalCredits,
    };
  } catch (error) {
    console.error("Error generating general ledger:", error);
    throw error;
  }
}

/**
 * DRILL DOWN TO JOURNAL DETAILS
 */

export async function drillDownToJournalDetails(
  accountCode: string,
  filters: ReportFilters
): Promise<DrillDownDetail[]> {
  try {
    const params: any[] = [filters.tenantSlug, accountCode];
    let dateWhere = "";
    if (filters.periodStart) {
      params.push(filters.periodStart);
      dateWhere += ` AND je.entry_date >= $${params.length}`;
    }
    if (filters.periodEnd) {
      params.push(filters.periodEnd);
      dateWhere += ` AND je.entry_date <= $${params.length}`;
    }

    const query = `
      SELECT
        je.entry_date as date,
        je.description,
        je.entry_number as reference,
        jel.debit_amount,
        jel.credit_amount,
        je.id::text as journal_entry_id
      FROM journal_entry_lines jel
      JOIN journal_entries je ON jel.entry_id = je.id
      WHERE je.tenant_slug = $1
        AND jel.account_code = $2
        ${dateWhere}
      ORDER BY je.entry_date DESC, je.created_at DESC
    `;

    const result = await db.query(query, params);
    return result.rows.map((r: any) => ({
      date: r.date,
      description: r.description,
      reference: r.reference,
      debitAmount: Number(r.debit_amount) || 0,
      creditAmount: Number(r.credit_amount) || 0,
      balance: 0,
      journalEntryId: r.journal_entry_id,
    }));
  } catch (error) {
    console.error("Error drilling down to journal details:", error);
    throw error;
  }
}

/**
 * COMPARATIVE PERIOD REPORT
 */

export async function generateComparativePnL(
  tenantSlug: string,
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
      tenantSlug,
      periodStart: currentPeriodStart,
      periodEnd: currentPeriodEnd,
    });

    const previous = await generatePnLReport({
      tenantSlug,
      periodStart: previousPeriodStart,
      periodEnd: previousPeriodEnd,
    });

    if (!current || !previous) return null;

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
  data.push(["BEGINNING CASH", "", report.beginningCash.toFixed(2)]);
  data.push(["ENDING CASH", "", report.endingCash.toFixed(2)]);

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

export function generateTrialBalanceCSV(report: TrialBalanceReport): string {
  const headers = ["Account Code", "Account Name", "Account Type", "Total Debit", "Total Credit"];
  const data: any[][] = [];

  report.lines.forEach((line) => {
    data.push([line.accountCode, line.accountName, line.accountType, line.totalDebit.toFixed(2), line.totalCredit.toFixed(2)]);
  });

  data.push([]);
  data.push(["TOTAL", "", "", report.totalDebits.toFixed(2), report.totalCredits.toFixed(2)]);
  data.push(["BALANCED", "", "", report.isBalanced ? "YES" : "NO", ""]);

  return generateCSVExport(data, headers);
}

export function generateGeneralLedgerCSV(report: GeneralLedgerReport): string {
  const headers = ["Entry #", "Date", "Account Code", "Account Name", "Description", "Debit", "Credit", "Running Balance"];
  const data: any[][] = [];

  data.push(["OPENING BALANCE", "", "", "", "", "", "", report.openingBalance.toFixed(2)]);
  data.push([]);

  report.lines.forEach((line) => {
    data.push([
      line.entryNumber,
      new Date(line.entryDate).toISOString().split("T")[0],
      line.accountCode,
      line.accountName || "",
      line.description,
      line.debitAmount.toFixed(2),
      line.creditAmount.toFixed(2),
      line.runningBalance.toFixed(2),
    ]);
  });

  data.push([]);
  data.push(["TOTALS", "", "", "", "", report.totalDebits.toFixed(2), report.totalCredits.toFixed(2), ""]);
  data.push(["CLOSING BALANCE", "", "", "", "", "", "", report.closingBalance.toFixed(2)]);

  return generateCSVExport(data, headers);
}
