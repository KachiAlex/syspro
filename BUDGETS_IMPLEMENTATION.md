# Budget & Forecasting Module - Complete Guide

## Overview

The Budget & Forecasting module provides enterprise-grade budget management with:
- **Multi-scope budgeting**: Department, Project, Branch, Account Category
- **Period flexibility**: Annual, Quarterly, Monthly budgets with versioning
- **Real-time tracking**: Budget vs. Actual with committed amounts (POs)
- **Smart enforcement**: Soft warnings, hard blocks, or audit-only modes
- **Advanced forecasting**: Rolling, trend-based, and scenario forecasts
- **Variance management**: Automatic detection, alerts, and acknowledgment
- **Approval workflows**: Multi-level budget approvals before activation

---

## Architecture

### Database Schema

**Core Tables** (7 tables + 2 views):

```
budgets                    - Budget headers with period & enforcement config
  ├─ budget_lines         - Line items with budgeted amounts
  ├─ budget_versions      - Audit trail of budget changes
  ├─ budget_actuals       - Actual spending linked to transactions
  ├─ budget_forecasts     - Rolling/trend-based projections
  ├─ budget_variances     - Detected over/under budget situations
  ├─ budget_approvals     - Multi-level approval workflow
  └─ views:
      ├─ budget_summary_view      - Aggregated budget with totals
      └─ budget_line_variance_view - Line-level variance details
```

**Performance**: 12 indexes on frequently queried columns (tenant_id, status, type, dates)

### Service Layer Architecture

**lib/finance/budgets-db.ts** (1,000+ lines):
- CRUD operations for all entities
- Variance detection and alert generation
- Forecast generation algorithms
- Enforcement checks before posting
- Approval workflow management

**Key Functions**:
```typescript
// Budget Management
createBudget()          // Create with lines and versioning
updateBudget()          // Track changes in versions
changeBudgetStatus()    // Draft → Submitted → Approved → Active
getBudgetSummaries()    // View with real-time actuals

// Budget Lines
getBudgetLines()        // Retrieve with variance
getBudgetLineVariances() // Line-level budget vs actual

// Actuals & Commitment
recordBudgetActual()    // Log expenses, invoices, POs, payments
getTotalActualsByBudgetLine() // Aggregate actual+committed

// Variance Detection
checkAndCreateVariances() // Auto-detect budget breaches
acknowledgeBudgetVariance() // Mark variance as reviewed

// Forecasting
generateRollingForecast() // Average of last N periods
createBudgetForecast()   // Custom forecast upload

// Enforcement
checkBudgetEnforcement() // Pre-transaction enforcement check

// Approvals
approveBudget()          // Multi-level approval workflow
```

---

## Usage Patterns

### Pattern 1: Create Annual Department Budget

```typescript
// Create budget with quarterly breakdown
const budget = await createBudget({
  tenantId: TENANT_ID,
  code: "DEPT-2024-ENG",
  name: "Engineering Department 2024",
  budgetType: "DEPARTMENT",
  scopeEntityId: ENG_DEPT_ID,
  periodType: "ANNUAL",
  fiscalYear: 2024,
  totalBudgetAmount: 500000,
  enforcementMode: "SOFT_WARNING",
  budgetLines: [
    { lineNumber: 1, accountCode: "5010", accountName: "Salaries", budgetedAmount: 350000 },
    { lineNumber: 2, accountCode: "5020", accountName: "Contractor", budgetedAmount: 100000 },
    { lineNumber: 3, accountCode: "5030", accountName: "Equipment", budgetedAmount: 50000 },
  ],
});

// Submit for approval
await changeBudgetStatus(budget.id, TENANT_ID, "SUBMITTED");

// Approve
await approveBudget({
  budgetId: budget.id,
  tenantId: TENANT_ID,
  approverRole: "CFO",
  approverId: "user-123",
  approverName: "Jane Doe",
  approve: true,
  comment: "Approved for FY 2024",
});

// Budget transitions to ACTIVE
```

### Pattern 2: Track Spending Against Budget

```typescript
// Record expense against budget
await recordBudgetActual({
  budgetId: BUDGET_ID,
  budgetLineId: LINE_ID,
  tenantId: TENANT_ID,
  actualType: "EXPENSE",
  transactionId: EXPENSE_ID,
  transactionCode: "EXP-2024-001",
  actualAmount: 5000,
  transactionDate: new Date("2024-01-15"),
  notes: "Contractor invoice",
});

// Record PO (commitment)
await recordBudgetActual({
  budgetId: BUDGET_ID,
  budgetLineId: LINE_ID,
  tenantId: TENANT_ID,
  actualType: "PURCHASE_ORDER",
  transactionId: PO_ID,
  transactionCode: "PO-2024-001",
  actualAmount: 0,
  committedAmount: 20000, // Not yet invoiced
  accountCode: "5020",
  transactionDate: new Date("2024-01-20"),
});

// System auto-detects variances
// If spending > 80% → Creates WARNING variance
// If spending > 100% → Creates CRITICAL variance (if HARD_BLOCK mode)
```

### Pattern 3: Generate Forecasts

```typescript
// Rolling forecast: average of last 3 months
const forecast = await generateRollingForecast(
  BUDGET_ID,
  TENANT_ID,
  3 // base periods
);

// Creates forecast lines with:
// - Averaged historical amounts
// - Confidence level (MEDIUM)
// - Methodology tracking

// Retrieve forecasts
const forecasts = await getBudgetForecasts(BUDGET_ID, TENANT_ID, "ROLLING");
```

### Pattern 4: Pre-Transaction Enforcement

```typescript
// Before posting an expense, check budget
const check = await checkBudgetEnforcement(
  BUDGET_ID,
  BUDGET_LINE_ID,
  PROPOSED_AMOUNT
);

if (!check.canProceed && check.enforcementMode === "HARD_BLOCK") {
  // Block the transaction
  throw new Error(`Budget exceeded. Remaining: $${check.remainingBalance}`);
}

if (check.enforcementMode === "SOFT_WARNING" && !check.canProceed) {
  // Log warning but allow posting
  console.warn(check.message);
}

// Post the expense
```

---

## API Reference

### Budget CRUD

#### GET /api/finance/budgets
List all budgets for tenant with optional filters.

**Query Parameters**:
```
tenantSlug      (required) - Tenant identifier
status          (optional) - Filter by DRAFT|SUBMITTED|APPROVED|ACTIVE|CLOSED|ARCHIVED
budgetType      (optional) - Filter by DEPARTMENT|PROJECT|BRANCH|ACCOUNT_CATEGORY
fiscalYear      (optional) - Filter by year
withSummary     (optional) - Include calculated summaries (true|false)
```

**Response**:
```json
{
  "budgets": [
    {
      "id": 1,
      "code": "DEPT-2024-ENG",
      "name": "Engineering 2024",
      "status": "ACTIVE",
      "totalBudgetAmount": 500000,
      "versionNumber": 1
    }
  ],
  "summaries": [
    {
      "id": 1,
      "totalBudgetAmount": 500000,
      "totalActual": 125000,
      "totalCommitted": 50000,
      "remainingBalance": 325000,
      "percentUtilized": 35.0
    }
  ]
}
```

#### POST /api/finance/budgets
Create new budget with lines.

**Body**:
```json
{
  "tenantId": "1",
  "code": "DEPT-2024-ENG",
  "name": "Engineering Department 2024",
  "description": "Annual budget",
  "budgetType": "DEPARTMENT",
  "scopeEntityId": 5,
  "periodType": "ANNUAL",
  "fiscalYear": 2024,
  "totalBudgetAmount": 500000,
  "enforcementMode": "SOFT_WARNING",
  "budgetLines": [
    {
      "lineNumber": 1,
      "accountCode": "5010",
      "accountName": "Salaries",
      "budgetedAmount": 350000
    }
  ]
}
```

#### GET /api/finance/budgets/[id]
Retrieve specific budget.

#### PUT /api/finance/budgets/[id]
Update budget details and track as new version.

**Body**:
```json
{
  "name": "Updated Name",
  "totalBudgetAmount": 550000,
  "changeReason": "Adjusted for headcount increase"
}
```

#### DELETE /api/finance/budgets/[id]
Delete budget (soft cascade to related records).

---

### Budget Lines

#### GET /api/finance/budgets/[id]/lines
Get budget lines with optional variance data.

**Query Parameters**:
```
tenantSlug      (required)
withVariance    (optional) - Include actual vs budget comparison
```

**Response**:
```json
{
  "lines": [
    {
      "id": 1,
      "budgetId": 1,
      "lineNumber": 1,
      "accountCode": "5010",
      "accountName": "Salaries",
      "budgetedAmount": 350000
    }
  ],
  "variances": [
    {
      "budgetLineId": 1,
      "budgetedAmount": 350000,
      "actualAmount": 125000,
      "remainingBalance": 225000,
      "percentUtilized": 35.7
    }
  ]
}
```

---

### Actuals & Commitments

#### POST /api/finance/budgets/[id]/actuals
Record actual spending or PO commitment.

**Body**:
```json
{
  "budgetId": "1",
  "budgetLineId": "1",
  "tenantId": "1",
  "actualType": "EXPENSE",
  "transactionId": 123,
  "transactionCode": "EXP-2024-001",
  "actualAmount": 5000,
  "committedAmount": 0,
  "accountCode": "5010",
  "transactionDate": "2024-01-15"
}
```

---

### Variances

#### GET /api/finance/budgets/[id]/variances
Get detected budget variances.

**Query Parameters**:
```
tenantSlug      (required)
varianceType    (optional) - OVER_BUDGET|UNDER_BUDGET|THRESHOLD_WARNING
alertLevel      (optional) - INFO|WARNING|CRITICAL
```

**Response**:
```json
[
  {
    "id": 1,
    "budgetLineId": 1,
    "varianceType": "THRESHOLD_WARNING",
    "budgetedAmount": 350000,
    "actualAmount": 280000,
    "varianceAmount": -70000,
    "variancePercent": 80.0,
    "alertLevel": "WARNING",
    "isAcknowledged": false
  }
]
```

#### PATCH /api/finance/budgets/[id]/variances
Acknowledge variance as reviewed.

**Body**:
```json
{
  "varianceId": "1",
  "acknowledgedBy": "user-123"
}
```

---

### Forecasts

#### GET /api/finance/budgets/[id]/forecasts
List all forecasts for budget.

**Query Parameters**:
```
tenantSlug      (required)
forecastType    (optional) - ROLLING|TREND_BASED|SCENARIO
```

#### POST /api/finance/budgets/[id]/forecasts
Create forecast.

**Rolling Forecast**:
```json
{
  "generateRolling": true,
  "basePeriods": 3
}
```

**Custom Forecast**:
```json
{
  "forecastType": "SCENARIO",
  "scenarioName": "Worst Case",
  "scenarioDescription": "30% headcount reduction",
  "forecastLines": [
    {
      "budgetLineId": "1",
      "forecastedAmount": 245000,
      "confidenceLevel": "LOW"
    }
  ]
}
```

---

### Approvals

#### GET /api/finance/budgets/[id]/approvals
Get approval workflow status.

**Response**:
```json
[
  {
    "approvalSequence": 1,
    "approverRole": "MANAGER",
    "status": "APPROVED",
    "approvedAt": "2024-01-10T10:00:00Z"
  },
  {
    "approvalSequence": 2,
    "approverRole": "CFO",
    "status": "PENDING"
  }
]
```

#### POST /api/finance/budgets/[id]/approvals
Approve or reject budget.

**Body**:
```json
{
  "approverRole": "CFO",
  "approverId": "user-123",
  "approverName": "Jane Doe",
  "approve": true,
  "comment": "Approved with notes"
}
```

---

## Integration Points

### With Expense Module
When expense is created/posted:
1. Call `recordBudgetActual()` with type "EXPENSE"
2. System auto-detects variances
3. If HARD_BLOCK mode and over budget → reject posting
4. Otherwise log the actual and create variance if threshold exceeded

### With Purchase Order Module
When PO is created:
1. Call `recordBudgetActual()` with type "PURCHASE_ORDER" and `committedAmount`
2. Committed amounts reduce available balance
3. When PO is invoiced, convert to type "INVOICE"
4. When paid, convert to type "PAYMENT"

### With Accounting Module
When posting journal entries:
1. Check if entry affects budgeted accounts
2. For HARD_BLOCK budgets → enforce before posting
3. For SOFT_WARNING → log but allow with notification

### With Approval Workflow
Budget status flow:
```
DRAFT (creation)
  ↓
SUBMITTED (ready for approval)
  ↓
APPROVED (passed all approvals)
  ↓
ACTIVE (can enforce on transactions)
  ↓
CLOSED (period ended)
  ↓
ARCHIVED (old/inactive)
```

---

## Enforcement Modes

### SOFT_WARNING
- Allow transactions to exceed budget
- Log warning/notification to user
- Suitable for predictive/advisory budgets

### HARD_BLOCK
- Reject transactions that would exceed budget
- Require override approval for over-budget posting
- Suitable for strict cost control

### AUDIT_ONLY
- No enforcement at transaction time
- Track variances for post-analysis
- Suitable for reporting/forecasting only

---

## Variance Types

### OVER_BUDGET
- Actual + Committed > Budgeted
- Alert level: WARNING (80-100%) or CRITICAL (>100%)

### UNDER_BUDGET
- Actual + Committed < Budgeted
- Often indicates budget slack or postponed spending

### THRESHOLD_WARNING
- 80-100% of budget used (consumption warning)
- Helps teams plan for remaining period

---

## Forecasting Algorithms

### Rolling Forecast
```
1. Collect actuals for last N periods
2. Calculate average per period
3. Multiply by remaining periods in budget
4. Aggregate for total forecast
Confidence: MEDIUM
```

### Trend-Based
```
1. Calculate spending trend (linear regression)
2. Project trend through remaining period
3. Account for seasonality if detected
Confidence: MEDIUM-HIGH (with enough data)
```

### Scenario
```
1. Accept custom forecast lines from user
2. Apply manual adjustments/assumptions
3. Compare vs baseline and other scenarios
Confidence: USER-DEFINED
```

---

## Reporting & Analytics

### Budget Summary View
- Real-time budget utilization %
- Actual vs. budgeted amounts
- Remaining balance tracking
- Period-based filtering

### Variance Report
- Over/under budget line items
- Alert level summary
- Acknowledged vs. pending variances
- Historical variance trends

### Forecast Accuracy
- Compare previous forecasts vs. actual actuals
- Identify forecast model biases
- Adjust basePeriods or methodology

---

## Best Practices

1. **Budget Granularity**: Create budget lines by account, not department totals
   - Enables line-level enforcement
   - Better variance tracking

2. **Period Alignment**: Match budget period to fiscal calendar
   - ANNUAL with quarters for review points
   - MONTHLY for tight cost control

3. **Enforcement Levels**:
   - HARD_BLOCK for capital/restricted budgets
   - SOFT_WARNING for operational budgets
   - AUDIT_ONLY for new/emerging categories

4. **Variance Review**: Check CRITICAL alerts weekly, WARNING alerts monthly

5. **Forecasting**: Generate rolling forecasts when >50% of period has passed

6. **Approval Flow**:
   - Manager approval for amounts <$50K
   - Director approval for $50K-$200K
   - CFO approval for >$200K

---

## Example: Q1 2024 Project Budget Lifecycle

```typescript
// 1. CREATE (January 5, 2024)
const budget = await createBudget({
  code: "PROJ-Q1-2024-MOBILE",
  name: "Mobile App Redesign Q1 2024",
  budgetType: "PROJECT",
  scopeEntityId: PROJECT_MOBILE_ID,
  periodType: "QUARTERLY",
  fiscalYear: 2024,
  quarterNum: 1,
  totalBudgetAmount: 150000,
  budgetLines: [
    { account: "5010", name: "Developer", budgeted: 80000 },
    { account: "5020", name: "Designer", budgeted: 40000 },
    { account: "5030", name: "QA", budgeted: 20000 },
    { account: "5040", name: "Tools", budgeted: 10000 },
  ],
});

// 2. SUBMIT (January 8, 2024)
await changeBudgetStatus(budget.id, TENANT_ID, "SUBMITTED");

// 3. APPROVE (January 10, 2024)
await approveBudget({
  budgetId: budget.id,
  approverRole: "PROJECT_DIRECTOR",
  approverId: "user-456",
  approverName: "Mike Johnson",
  approve: true,
});

// 4. TRACK SPENDING (January - March)
// Weekly PO creation
await recordBudgetActual({
  budgetId: budget.id,
  budgetLineId: DEV_LINE_ID,
  actualType: "PURCHASE_ORDER",
  transactionCode: "PO-Q1-2024-001",
  committedAmount: 20000, // Developer contract
  transactionDate: new Date("2024-01-15"),
});

// Bi-weekly expense posting
for (const week of [22, 29, 5, 12, 19, 26, 5, 12]) {
  await recordBudgetActual({
    budgetId: budget.id,
    budgetLineId: DEV_LINE_ID,
    actualType: "EXPENSE",
    actualAmount: 6000,
    transactionCode: `EXP-Q1-2024-${week}`,
    transactionDate: new Date(2024, 0, week),
  });
}

// 5. MONITOR VARIANCES (Mid-March)
const variances = await getBudgetVariances(budget.id, TENANT_ID);
// Output: Dev line at 85% utilization (WARNING)

await acknowledgeBudgetVariance(variances[0].id, "user-456");

// 6. FORECAST (Mid-March)
const forecast = await generateRollingForecast(budget.id, TENANT_ID, 4);
// Projects remaining 2 weeks based on 4-week average

// 7. CLOSE (March 31, 2024)
await changeBudgetStatus(budget.id, TENANT_ID, "CLOSED");
// Final summary: 98% utilized, $3,000 remaining
```

---

## Troubleshooting

### Q: Variance not detected after recording actual
**A**: Call `checkAndCreateVariances()` manually or ensure it's called in the POST actual endpoint

### Q: Budget enforcement not blocking transaction
**A**: Verify budget status is "ACTIVE" and enforcement_mode is "HARD_BLOCK"

### Q: Forecast amounts seem wrong
**A**: Check that actuals are correctly recorded with dates; rolling forecast uses transaction_date filter

### Q: Can't create budget with duplicate code
**A**: Budget codes must be unique per tenant; use pattern BUDGET-PERIOD-SCOPE (e.g., DEPT-Q1-ENG)

