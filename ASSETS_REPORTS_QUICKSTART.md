# Assets & Depreciation + Financial Reports - Quick Start Guide

## Overview

This guide provides a fast-track to understanding and working with the two major modules:
1. **Assets & Depreciation Module** - Fixed asset management with automated depreciation
2. **Financial Reports Module** - Comprehensive financial statement generation

## For Developers

### Understanding the Architecture

**Three-Layer Architecture**:
```
UI Layer (React Components)
    ↓
API Layer (Next.js Routes)
    ↓
Service Layer (Business Logic & Database)
```

### Quick Navigation

#### Assets & Depreciation
- **Start Here**: [ASSETS_DEPRECIATION_IMPLEMENTATION.md](ASSETS_DEPRECIATION_IMPLEMENTATION.md)
- **Types**: `src/lib/finance/assets-reports.ts` (lines 1-200)
- **Service**: `src/lib/finance/assets-db.ts`
- **API**: `src/app/api/finance/assets/`
- **Components**: `src/components/finance/assets/`

#### Financial Reports
- **Start Here**: [FINANCIAL_REPORTS_IMPLEMENTATION.md](FINANCIAL_REPORTS_IMPLEMENTATION.md)
- **Types**: `src/lib/finance/assets-reports.ts` (lines 200-425)
- **Service**: `src/lib/finance/reports-db.ts`
- **API**: `src/app/api/finance/reports/`
- **Components**: `src/components/finance/reports/`

### Key Concepts

#### Assets Module Workflow
```
1. Create Asset Category
   ├── Set default depreciation method
   ├── Map GL accounts
   └── Define useful life defaults

2. Create Asset
   ├── Link to category
   ├── Set acquisition cost and date
   └── Set residual value

3. Generate Depreciation Schedule
   ├── Calculate monthly depreciation
   └── Create posting journal

4. Post Depreciation
   ├── Create GL entries
   └── Update accumulated depreciation

5. End of Life
   ├── Revalue if needed
   ├── Dispose (sale/scrap)
   └── Calculate gain/loss
```

#### Financial Reports Workflow
```
1. Data Collection
   └── Read from chart of accounts & journal entries

2. View Transformation
   └── Calculate balances, aging, categorization

3. Report Generation
   ├── Aggregate to report format
   └── Add analysis metrics

4. Drill-Down Support
   └── Link report lines to transaction detail

5. Export
   ├── CSV for Excel
   └── PDF for printing
```

### Common Tasks

#### Task: Create an Asset
```typescript
// 1. In React component, call API
const response = await fetch('/api/finance/assets', {
  method: 'POST',
  body: JSON.stringify({
    assetCategoryId: 1,
    name: 'Office Equipment',
    acquisitionCost: 5000,
    acquisitionDate: new Date('2025-02-01'),
    usefulLifeYears: 5,
    residualValue: 500,
    depreciationMethod: 'STRAIGHT_LINE'
  })
});

// 2. Response includes generated asset ID
const asset = await response.json();
```

#### Task: Generate Depreciation Schedule
```typescript
// Call the schedule endpoint
const response = await fetch('/api/finance/assets/depreciation/schedule', {
  method: 'POST',
  body: JSON.stringify({
    tenantId: '1',
    year: 2025,
    month: 2
  })
});

// Returns depreciation details for all assets
const schedule = await response.json();
```

#### Task: Generate P&L Report
```typescript
// P&L report with date range
const response = await fetch(
  '/api/finance/reports/pnl?tenantId=1&periodStart=2025-01-01&periodEnd=2025-02-28'
);

const pnl = await response.json();
console.log(pnl.data.totalRevenue);
console.log(pnl.data.totalExpenses);
console.log(pnl.data.netIncome);
```

#### Task: Export Aged Receivables as CSV
```typescript
// CSV export of aged receivables
const response = await fetch(
  '/api/finance/reports/aged-receivables?tenantId=1&format=csv'
);

// Response is CSV file
const csv = await response.text();
// Save to file or display in table
```

### Testing Key Features

#### Test 1: Depreciation Calculation
```bash
# Create test asset with straight-line depreciation
POST /api/finance/assets
{
  "name": "Test Asset",
  "acquisitionCost": 10000,
  "usefulLifeYears": 5,
  "residualValue": 0,
  "depreciationMethod": "STRAIGHT_LINE"
}

# Expected: Monthly depreciation = $10,000 / 5 / 12 = $166.67
```

#### Test 2: Financial Report
```bash
# Get P&L for current month
GET /api/finance/reports/pnl?tenantId=1

# Response should show:
# - Revenue accounts with totals
# - Expense accounts with totals
# - Net income calculation
# - Percentages
```

#### Test 3: Drill-Down
```bash
# Drill from P&L account to journal entries
GET /api/finance/reports/drill-down/1001?tenantId=1

# Response shows all journal entries for account 1001
```

### Database Queries Cheat Sheet

#### Get Current Assets
```sql
SELECT * FROM assets WHERE status = 'IN_USE';
```

#### Calculate Book Value
```sql
SELECT 
  a.name,
  a.acquisition_cost,
  COALESCE(SUM(d.depreciation_amount), 0) as accumulated_depreciation,
  a.acquisition_cost - COALESCE(SUM(d.depreciation_amount), 0) as book_value
FROM assets a
LEFT JOIN depreciation_schedules d ON a.id = d.asset_id
WHERE a.status = 'IN_USE'
GROUP BY a.id;
```

#### P&L for Period
```sql
SELECT 
  c.name,
  SUM(CASE WHEN jl.debit_amount > 0 THEN jl.debit_amount ELSE -jl.credit_amount END) as amount
FROM journal_entries je
JOIN journal_lines jl ON je.id = jl.journal_entry_id
JOIN chart_of_accounts c ON jl.account_id = c.id
WHERE je.status = 'POSTED'
  AND c.account_type IN ('REVENUE', 'EXPENSE')
  AND je.created_at BETWEEN ? AND ?
GROUP BY c.id, c.name;
```

#### Aged Receivables
```sql
SELECT 
  c.name as customer,
  COUNT(*) as invoice_count,
  SUM(i.total_amount - COALESCE(p.paid_amount, 0)) as outstanding,
  AVG(CURRENT_DATE - i.invoice_date) as avg_days_outstanding
FROM customers c
JOIN invoices i ON c.id = i.customer_id
LEFT JOIN payments p ON i.id = p.invoice_id
WHERE i.status IN ('ISSUED', 'PARTIALLY_PAID')
GROUP BY c.id
ORDER BY outstanding DESC;
```

### Type Safety

All modules use **Zod** for runtime validation:

```typescript
// Types are defined with Zod schemas
import { ReportFiltersSchema, PnLReportSchema } from '@/lib/finance/assets-reports';

// Parse and validate data
const filters = ReportFiltersSchema.parse(incoming);

// Generate reports with typed results
const report = await generatePnLReport(filters);
// report is strongly typed as PnLReport
```

### Performance Tips

1. **Cache Reports**: Reports are cached for 1 hour
   ```typescript
   // Check cache before generating
   const cached = await redis.get(`report:pnl:${tenantId}:${period}`);
   ```

2. **Use Views**: All reports use pre-computed SQL views for speed

3. **Index Frequently Queried Fields**:
   - `journal_entries.created_at`
   - `journal_lines.account_id`
   - `assets.asset_category_id`
   - `invoices.customer_id`

4. **Batch Process Large Exports**: For thousands of records, use pagination

### Error Handling

All APIs return consistent error format:

```typescript
{
  success: false,
  error: "User-friendly error message",
  timestamp: "2025-02-08T10:30:00Z"
}
```

### Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `tenantId is required` | Missing query parameter | Add `?tenantId=X` to request |
| `periodStart must be before periodEnd` | Invalid date range | Swap start/end dates |
| `Failed to generate report` | Data issue or view missing | Run migrations, check view exists |
| `Asset not found` | Bad asset ID | Verify asset exists first |
| `Insufficient funds for disposal` | GL balance issue | Check accumulated depreciation entries |

### Environment Variables Needed

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/syspro

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# API Configuration
API_RATE_LIMIT=1000  # requests per hour
REPORT_CACHE_TTL=3600  # seconds
```

### Next Steps

1. **Read the full documentation**
   - [Assets & Depreciation Guide](ASSETS_DEPRECIATION_IMPLEMENTATION.md)
   - [Financial Reports Guide](FINANCIAL_REPORTS_IMPLEMENTATION.md)

2. **Run the database migrations**
   ```bash
   npm run migrate:latest
   ```

3. **Create test data**
   ```bash
   npm run seed:assets
   npm run seed:financials
   ```

4. **Try the API endpoints**
   - Use Postman/Insomnia collection provided
   - Test each report type
   - Verify calculations

5. **Review the code**
   - Start with service layer (business logic)
   - Then API routes (request/response)
   - Finally React components (UI)

### Getting Help

- **API Issues**: Check route file in `src/app/api/finance/`
- **Calculation Issues**: Review `*-db.ts` service files
- **UI Issues**: Check React component files
- **Type Issues**: See `assets-reports.ts` type definitions
- **Database Issues**: Review SQL migration files

### Further Reading

- [Complete Implementation Summary](ASSETS_AND_FINANCIAL_REPORTS_COMPLETE.md)
- [Assets Implementation Details](ASSETS_DEPRECIATION_IMPLEMENTATION.md)
- [Financial Reports Implementation Details](FINANCIAL_REPORTS_IMPLEMENTATION.md)

---

**Last Updated**: 2025-02-08  
**Status**: Ready for Development & Testing

