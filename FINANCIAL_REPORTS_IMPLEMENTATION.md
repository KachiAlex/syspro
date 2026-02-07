# Financial Reports Module - Implementation Guide

## Overview

The Financial Reports module provides comprehensive financial analysis and reporting capabilities, including:
- **Profit & Loss (P&L) Reports** - Revenue, expenses, and profitability analysis
- **Balance Sheet** - Assets, liabilities, and equity position
- **Cash Flow Statement** - Operating, investing, and financing activities
- **Aged Receivables** - Customer payment aging analysis
- **Aged Payables** - Vendor payment aging analysis
- **Comparative Reporting** - Period-over-period analysis with variance
- **Report Export** - CSV and PDF export functionality
- **Drill-Down Analysis** - Journal entry level detail

---

## Architecture

### Database Layer
- **Views**: Pre-computed SQL views for performance
  - `p_and_l_view` - Revenue and expense categorization
  - `balance_sheet_view` - Assets, liabilities, and equity
  - `cash_flow_view` - Transaction categorization by activity type
  - `aged_receivables_view` - Customer invoice aging
  - `aged_payables_view` - Vendor invoice aging

### Service Layer (`lib/finance/reports-db.ts`)
- Report generation functions with filtering
- Variance calculations
- CSV export utilities
- Drill-down to journal entries

### API Layer (`app/api/finance/reports/`)
- RESTful endpoints for each report type
- Query parameter filtering (date range, tenant)
- Error handling and response formatting
- Export endpoints (CSV, PDF)

### UI Layer (`components/finance/reports/`)
- React components for report display
- Interactive filtering
- Drill-down navigation
- Export buttons
- Charts and visualizations

---

## Type Definitions

### Report Types
```typescript
interface ReportFilters {
  tenantId: bigint;
  periodStart?: Date;
  periodEnd?: Date;
  departmentId?: bigint;
  accountCode?: string;
}

interface PnLReport {
  periodStart: Date;
  periodEnd: Date;
  tenantId: bigint;
  revenue: PnLReportLine[];
  expenses: PnLReportLine[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
}

interface PnLReportLine {
  code: string;
  name: string;
  amountTotal: number;
  accountType: string;
  percentOfRevenue?: number;
}

interface BalanceSheet {
  asOfDate: Date;
  tenantId: bigint;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

interface BalanceSheetLine {
  section: "ASSETS" | "LIABILITIES" | "EQUITY";
  code: string;
  name: string;
  accountType: string;
  balance: number;
  percentOfTotal?: number;
}

interface CashFlowReport {
  periodStart: Date;
  periodEnd: Date;
  tenantId: bigint;
  operatingActivities: CashFlowLine[];
  investingActivities: CashFlowLine[];
  financingActivities: CashFlowLine[];
  netCashChange: number;
  beginningCash: number;
  endingCash: number;
}

interface CashFlowLine {
  category: "OPERATING" | "INVESTING" | "FINANCING";
  code: string;
  name: string;
  netCashFlow: number;
}

interface AgedReceivablesReport {
  asOfDate: Date;
  tenantId: bigint;
  receivables: AgedReceivable[];
  totalOutstanding: number;
  currentAmount: number;      // 0-30 days
  days31to60: number;
  days61to90: number;
  days91to120: number;
  over120Days: number;
}

interface AgedReceivable {
  customerId: bigint;
  customerName: string;
  invoiceId: bigint;
  invoiceDate: Date;
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
  daysOutstanding: number;
  agingBucket: "Current" | "31-60 days" | "61-90 days" | "91-120 days" | "Over 120 days";
}

interface AgedPayablesReport {
  asOfDate: Date;
  tenantId: bigint;
  payables: AgedPayable[];
  totalOutstanding: number;
  currentAmount: number;      // 0-30 days
  days31to60: number;
  days61to90: number;
  days91to120: number;
  over120Days: number;
}

interface AgedPayable {
  vendorId: bigint;
  vendorName: string;
  invoiceId: bigint;
  invoiceDate: Date;
  amount: number;
  paidAmount: number;
  outstandingAmount: number;
  daysOutstanding: number;
  agingBucket: "Current" | "31-60 days" | "61-90 days" | "91-120 days" | "Over 120 days";
}

interface DrillDownDetail {
  date: Date;
  description: string;
  referenceNumber: string;
  debitAmount: number;
  creditAmount: number;
  balance: number;
  journalEntryId: bigint;
}
```

---

## Database Migrations

### 1. Create P&L View

```sql
-- P&L Report View
CREATE OR REPLACE VIEW p_and_l_view AS
SELECT
  c.id,
  c.code,
  c.name,
  c.account_type,
  CASE WHEN c.account_type IN ('REVENUE', 'INCOME') THEN 'REVENUE'
       WHEN c.account_type IN ('EXPENSE', 'COST_OF_GOODS', 'OPERATING_EXPENSE') THEN 'EXPENSES'
  END as section,
  COALESCE(SUM(jl.credit_amount - jl.debit_amount), 0) as amount_total
FROM chart_of_accounts c
LEFT JOIN journal_lines jl ON c.id = jl.account_id
LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id
  AND je.status = 'POSTED'
  AND EXTRACT(YEAR FROM je.created_at) = EXTRACT(YEAR FROM NOW())
WHERE c.account_type IN ('REVENUE', 'INCOME', 'EXPENSE', 'COST_OF_GOODS', 'OPERATING_EXPENSE')
GROUP BY c.id, c.code, c.name, c.account_type;
```

### 2. Create Balance Sheet View

```sql
-- Balance Sheet View
CREATE OR REPLACE VIEW balance_sheet_view AS
SELECT
  c.id,
  c.code,
  c.name,
  c.account_type,
  CASE WHEN c.account_type IN ('ASSET', 'CURRENT_ASSET', 'FIXED_ASSET') THEN 'ASSETS'
       WHEN c.account_type IN ('LIABILITY', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY') THEN 'LIABILITIES'
       WHEN c.account_type IN ('EQUITY', 'RETAINED_EARNINGS') THEN 'EQUITY'
  END as section,
  COALESCE(SUM(CASE
    WHEN c.account_type IN ('ASSET', 'CURRENT_ASSET', 'FIXED_ASSET') THEN jl.debit_amount - jl.credit_amount
    WHEN c.account_type IN ('LIABILITY', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY') THEN jl.credit_amount - jl.debit_amount
    WHEN c.account_type IN ('EQUITY', 'RETAINED_EARNINGS') THEN jl.credit_amount - jl.debit_amount
    ELSE 0
  END), 0) as balance
FROM chart_of_accounts c
LEFT JOIN journal_lines jl ON c.id = jl.account_id
LEFT JOIN journal_entries je ON jl.journal_entry_id = je.id
  AND je.status = 'POSTED'
WHERE c.account_type IN ('ASSET', 'CURRENT_ASSET', 'FIXED_ASSET', 'LIABILITY', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY', 'EQUITY', 'RETAINED_EARNINGS')
GROUP BY c.id, c.code, c.name, c.account_type;
```

### 3. Create Cash Flow View

```sql
-- Cash Flow View
CREATE OR REPLACE VIEW cash_flow_view AS
SELECT
  je.created_at::DATE as transaction_date,
  CASE
    WHEN c.cash_flow_category = 'OPERATING' THEN 'OPERATING'
    WHEN c.cash_flow_category = 'INVESTING' THEN 'INVESTING'
    WHEN c.cash_flow_category = 'FINANCING' THEN 'FINANCING'
  END as cash_flow_category,
  c.code,
  c.name,
  SUM(CASE WHEN jl.debit_amount > 0 THEN jl.debit_amount ELSE -jl.credit_amount END) as net_cash_flow
FROM journal_entries je
JOIN journal_lines jl ON je.id = jl.journal_entry_id
JOIN chart_of_accounts c ON jl.account_id = c.id
WHERE je.status = 'POSTED'
GROUP BY je.created_at::DATE, c.cash_flow_category, c.code, c.name;
```

### 4. Create Aged Receivables View

```sql
-- Aged Receivables View
CREATE OR REPLACE VIEW aged_receivables_view AS
SELECT
  c.id as customer_id,
  c.name as customer_name,
  i.id as invoice_id,
  i.invoice_date,
  i.total_amount as amount,
  COALESCE(SUM(p.amount), 0) as paid_amount,
  i.total_amount - COALESCE(SUM(p.amount), 0) as outstanding_amount,
  CAST(CURRENT_DATE - i.invoice_date AS INTEGER) as days_outstanding,
  CASE
    WHEN CAST(CURRENT_DATE - i.invoice_date AS INTEGER) <= 30 THEN 'Current'
    WHEN CAST(CURRENT_DATE - i.invoice_date AS INTEGER) BETWEEN 31 AND 60 THEN '31-60 days'
    WHEN CAST(CURRENT_DATE - i.invoice_date AS INTEGER) BETWEEN 61 AND 90 THEN '61-90 days'
    WHEN CAST(CURRENT_DATE - i.invoice_date AS INTEGER) BETWEEN 91 AND 120 THEN '91-120 days'
    ELSE 'Over 120 days'
  END as aging_bucket
FROM customers c
JOIN invoices i ON c.id = i.customer_id
LEFT JOIN payments p ON i.id = p.invoice_id AND p.status = 'COMPLETED'
WHERE i.status IN ('ISSUED', 'PARTIALLY_PAID')
GROUP BY c.id, c.name, i.id, i.invoice_date, i.total_amount;
```

### 5. Create Aged Payables View

```sql
-- Aged Payables View
CREATE OR REPLACE VIEW aged_payables_view AS
SELECT
  v.id as vendor_id,
  v.name as vendor_name,
  b.id as invoice_id,
  b.bill_date as invoice_date,
  b.total_amount as amount,
  COALESCE(SUM(p.amount), 0) as paid_amount,
  b.total_amount - COALESCE(SUM(p.amount), 0) as outstanding_amount,
  CAST(CURRENT_DATE - b.bill_date AS INTEGER) as days_outstanding,
  CASE
    WHEN CAST(CURRENT_DATE - b.bill_date AS INTEGER) <= 30 THEN 'Current'
    WHEN CAST(CURRENT_DATE - b.bill_date AS INTEGER) BETWEEN 31 AND 60 THEN '31-60 days'
    WHEN CAST(CURRENT_DATE - b.bill_date AS INTEGER) BETWEEN 61 AND 90 THEN '61-90 days'
    WHEN CAST(CURRENT_DATE - b.bill_date AS INTEGER) BETWEEN 91 AND 120 THEN '91-120 days'
    ELSE 'Over 120 days'
  END as aging_bucket
FROM vendors v
JOIN bills b ON v.id = b.vendor_id
LEFT JOIN bill_payments p ON b.id = p.bill_id AND p.status = 'COMPLETED'
WHERE b.status IN ('APPROVED', 'PARTIALLY_PAID')
GROUP BY v.id, v.name, b.id, b.bill_date, b.total_amount;
```

---

## Service Layer Functions

### P&L Report

```typescript
// Generate P&L report for period
async function generatePnLReport(filters: ReportFilters): Promise<PnLReport | null>

// Features:
// - Aggregates revenue and expense accounts
// - Calculates percent of revenue for each line
// - Returns structured report with totals and net income
// - Supports date range filtering
```

### Balance Sheet

```typescript
// Generate balance sheet as of date
async function generateBalanceSheet(filters: ReportFilters): Promise<BalanceSheet | null>

// Features:
// - Separates assets, liabilities, and equity
// - Calculates balance for each account
// - Verifies accounting equation (A = L + E)
// - Shows percentage of total assets
```

### Cash Flow

```typescript
// Generate cash flow statement for period
async function generateCashFlowReport(filters: ReportFilters): Promise<CashFlowReport | null>

// Features:
// - Categorizes transactions (operating, investing, financing)
// - Calculates net cash change
// - Tracks beginning and ending cash
```

### Aged Receivables

```typescript
// Generate aged receivables report
async function generateAgedReceivablesReport(filters: ReportFilters): Promise<AgedReceivablesReport | null>

// Features:
// - Groups invoices by aging bucket
// - Calculates days outstanding
// - Identifies slow-paying customers
// - Supports collection management
```

### Aged Payables

```typescript
// Generate aged payables report
async function generateAgedPayablesReport(filters: ReportFilters): Promise<AgedPayablesReport | null>

// Features:
// - Groups bills by aging bucket
// - Calculates days outstanding
// - Identifies payment obligations
// - Supports cash flow planning
```

### Comparative Analysis

```typescript
// Compare two periods with variance analysis
async function generateComparativePnL(
  tenantId: bigint,
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  previousPeriodStart: Date,
  previousPeriodEnd: Date
): Promise<{
  current: PnLReport | null;
  previous: PnLReport | null;
  variance: any;
} | null>

// Returns:
// - Current period P&L
// - Previous period P&L
// - Absolute variance
// - Percent variance
```

### Drill-Down Analysis

```typescript
// Get journal entry details for an account
async function drillDownToJournalDetails(
  accountId: bigint,
  filters: ReportFilters
): Promise<DrillDownDetail[]>

// Features:
// - Transaction-level detail
// - Running balance calculation
// - Date range filtering
// - Account reconciliation
```

---

## CSV Export Functions

### P&L Export
```typescript
export function generatePnLCSV(report: PnLReport): string
// Returns CSV with revenue, expenses, and net income
```

### Balance Sheet Export
```typescript
export function generateBalanceSheetCSV(report: BalanceSheet): string
// Returns CSV with assets, liabilities, and equity
```

### Cash Flow Export
```typescript
export function generateCashFlowCSV(report: CashFlowReport): string
// Returns CSV with operating, investing, and financing activities
```

### Aged Receivables Export
```typescript
export function generateAgedReceivablesCSV(report: AgedReceivablesReport): string
// Returns CSV with customer aging summary
```

### Aged Payables Export
```typescript
export function generateAgedPayablesCSV(report: AgedPayablesReport): string
// Returns CSV with vendor aging summary
```

---

## API Endpoints

### P&L Report
```
GET /api/finance/reports/pnl
Query Parameters:
  - tenantId: bigint (required)
  - periodStart: ISO date (optional, default: Jan 1 current year)
  - periodEnd: ISO date (optional, default: today)
  - format: 'json' | 'csv' (optional, default: json)

Response:
{
  "success": true,
  "data": PnLReport | string (csv)
}
```

### Balance Sheet
```
GET /api/finance/reports/balance-sheet
Query Parameters:
  - tenantId: bigint (required)
  - asOfDate: ISO date (optional, default: today)
  - format: 'json' | 'csv' (optional, default: json)

Response:
{
  "success": true,
  "data": BalanceSheet | string (csv)
}
```

### Cash Flow
```
GET /api/finance/reports/cash-flow
Query Parameters:
  - tenantId: bigint (required)
  - periodStart: ISO date (optional)
  - periodEnd: ISO date (optional)
  - format: 'json' | 'csv' (optional, default: json)

Response:
{
  "success": true,
  "data": CashFlowReport | string (csv)
}
```

### Aged Receivables
```
GET /api/finance/reports/aged-receivables
Query Parameters:
  - tenantId: bigint (required)
  - asOfDate: ISO date (optional, default: today)
  - format: 'json' | 'csv' (optional, default: json)

Response:
{
  "success": true,
  "data": AgedReceivablesReport | string (csv)
}
```

### Aged Payables
```
GET /api/finance/reports/aged-payables
Query Parameters:
  - tenantId: bigint (required)
  - asOfDate: ISO date (optional, default: today)
  - format: 'json' | 'csv' (optional, default: json)

Response:
{
  "success": true,
  "data": AgedPayablesReport | string (csv)
}
```

### Comparative P&L
```
GET /api/finance/reports/comparative-pnl
Query Parameters:
  - tenantId: bigint (required)
  - currentPeriodStart: ISO date (required)
  - currentPeriodEnd: ISO date (required)
  - previousPeriodStart: ISO date (required)
  - previousPeriodEnd: ISO date (required)

Response:
{
  "success": true,
  "data": {
    "current": PnLReport,
    "previous": PnLReport,
    "variance": {...}
  }
}
```

### Drill-Down
```
GET /api/finance/reports/drill-down/:accountId
Query Parameters:
  - tenantId: bigint (required)
  - periodStart: ISO date (optional)
  - periodEnd: ISO date (optional)

Response:
{
  "success": true,
  "data": DrillDownDetail[]
}
```

---

## Implementation Checklist

- [ ] Create database views (5 views)
- [ ] Create reports-db.ts service layer
- [ ] Create assets-reports.ts type definitions
- [ ] Create API endpoints in app/api/finance/reports/
- [ ] Create React components for report display
- [ ] Implement date range picker component
- [ ] Implement chart visualizations
- [ ] Implement export functionality
- [ ] Add report caching layer
- [ ] Implement performance optimization
- [ ] Create comprehensive tests
- [ ] Document API endpoints
- [ ] Create user documentation
- [ ] Set up role-based access control

---

## Performance Considerations

1. **View Indexing**: Ensure proper indexes on foreign keys in views
   ```sql
   CREATE INDEX idx_journal_entries_status_date ON journal_entries(status, created_at);
   CREATE INDEX idx_journal_lines_account ON journal_lines(account_id);
   ```

2. **Caching**: Cache report results for 1 hour
   ```typescript
   const cacheKey = `report:${reportType}:${tenantId}:${dateRange}`;
   const cached = await redis.get(cacheKey);
   if (cached) return JSON.parse(cached);
   ```

3. **Date Range Limits**: Enforce reasonable date range limits (max 5 years)

4. **Pagination**: For aged receivables/payables with thousands of records

5. **Lazy Loading**: Load drill-down details on demand

---

## Error Handling

```typescript
try {
  const report = await generatePnLReport(filters);
  if (!report) {
    return { success: false, error: "Failed to generate report" };
  }
  return { success: true, data: report };
} catch (error) {
  console.error("Report generation error:", error);
  return { success: false, error: "Internal server error" };
}
```

---

## Integration Points

- **Accounting Module**: Journal entries and chart of accounts
- **Tenant System**: Multi-tenant data isolation
- **Auth System**: Role-based access control
- **Export System**: CSV, PDF, Excel formats
- **Dashboard**: Key metrics and KPIs

---

## Testing Strategy

1. **Unit Tests**: Test report calculations
2. **Integration Tests**: Test with sample data
3. **Accuracy Tests**: Verify accounting equation
4. **Performance Tests**: Test with large datasets
5. **Export Tests**: Verify CSV/PDF generation

---

## Future Enhancements

- Advanced filtering (department, cost center)
- Budget variance analysis
- Trend analysis and forecasting
- Custom report builder
- Mobile-friendly export
- Real-time report generation
- Multi-currency support
- Financial ratio analysis
- Audit trail for report access
- Scheduled report generation via email

