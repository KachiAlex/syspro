# Budget Module - Quick Reference

## File Structure

```
db/migrations/
  └─ 20260204_create_budgets.sql              (Migration: 7 tables, 2 views, 12 indexes)

src/lib/finance/
  ├─ budgets.ts                               (Types, interfaces, Zod schemas)
  └─ budgets-db.ts                            (Service layer: 1000+ lines)

src/app/api/finance/budgets/
  ├─ route.ts                                 (GET/POST budgets)
  ├─ [id]/route.ts                            (GET/PUT/DELETE budget)
  ├─ [id]/lines/route.ts                      (GET budget lines)
  ├─ [id]/actuals/route.ts                    (GET/POST actuals & commitments)
  ├─ [id]/variances/route.ts                  (GET/PATCH variances)
  ├─ [id]/forecasts/route.ts                  (GET/POST forecasts)
  └─ [id]/approvals/route.ts                  (GET/POST approvals)

src/app/tenant-admin/sections/
  └─ budget-planning.tsx                      (React component: 700+ lines)
```

## Key Constants

```typescript
// Budget Types
BUDGET_TYPES = ["DEPARTMENT", "PROJECT", "BRANCH", "ACCOUNT_CATEGORY"]

// Period Types
BUDGET_PERIOD_TYPES = ["ANNUAL", "QUARTERLY", "MONTHLY"]

// Status Flow
BUDGET_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "ACTIVE", "CLOSED", "ARCHIVED"]

// Enforcement
ENFORCEMENT_MODES = ["SOFT_WARNING", "HARD_BLOCK", "AUDIT_ONLY"]

// Actual Types (source of spending)
ACTUAL_TYPES = ["EXPENSE", "INVOICE", "PURCHASE_ORDER", "PAYMENT"]

// Variance Types
VARIANCE_TYPES = ["OVER_BUDGET", "UNDER_BUDGET", "THRESHOLD_WARNING"]

// Alert Levels
ALERT_LEVELS = ["INFO", "WARNING", "CRITICAL"]

// Forecast Types
FORECAST_TYPES = ["ROLLING", "TREND_BASED", "SCENARIO"]
FORECAST_METHODOLOGIES = ["avg_of_last_n_periods", "trend_projection", "custom_upload"]
CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"]
```

## Common Functions

### Budget CRUD

```typescript
// Create budget with lines
createBudget(input: BudgetCreateInput): Promise<Budget>

// Retrieve budget
getBudget(budgetId: bigint, tenantId: bigint): Promise<Budget>

// List with filters
getBudgets(tenantId: bigint, filters?: {...}): Promise<Budget[]>

// Get aggregated summaries
getBudgetSummaries(tenantId: bigint): Promise<BudgetSummary[]>

// Update budget (creates version)
updateBudget(budgetId: bigint, tenantId: bigint, input: BudgetUpdateInput): Promise<Budget>

// Change status (creates version)
changeBudgetStatus(budgetId: bigint, tenantId: bigint, newStatus: BudgetStatus): Promise<Budget>

// Delete budget
deleteBudget(budgetId: bigint, tenantId: bigint): Promise<boolean>
```

### Budget Lines

```typescript
// Get lines with optional variance
getBudgetLines(budgetId: bigint, tenantId: bigint): Promise<BudgetLine[]>

// Get variance view per line
getBudgetLineVariances(budgetId: bigint): Promise<BudgetLineVariance[]>

// Update line
updateBudgetLine(budgetLineId: bigint, tenantId: bigint, updates: any): Promise<BudgetLine>

// Delete line
deleteBudgetLine(budgetLineId: bigint, tenantId: bigint): Promise<boolean>
```

### Actuals & Commitments

```typescript
// Record expense, PO, invoice, or payment
recordBudgetActual(budgetId: bigint, tenantId: bigint, actual: any): Promise<BudgetActual>

// Get actuals with filters
getBudgetActuals(budgetId: bigint, tenantId: bigint, filters?: {...}): Promise<BudgetActual[]>

// Get sum of actual + committed
getTotalActualsByBudgetLine(budgetLineId: bigint): Promise<{actual, committed}>
```

### Variances

```typescript
// Auto-detect and create/update variances
checkAndCreateVariances(budgetId: bigint, tenantId: bigint): Promise<BudgetVariance[]>

// Get variances with filters
getBudgetVariances(budgetId: bigint, tenantId: bigint, filters?: {...}): Promise<BudgetVariance[]>

// Mark variance as reviewed
acknowledgeBudgetVariance(varianceId: bigint, acknowledgedBy: string): Promise<BudgetVariance>
```

### Forecasting

```typescript
// Create forecast (rolling, trend, or scenario)
createBudgetForecast(input: BudgetForecastCreateInput): Promise<BudgetForecast>

// Get all forecasts for budget
getBudgetForecasts(budgetId: bigint, tenantId: bigint, forecastType?: string): Promise<BudgetForecast[]>

// Generate rolling forecast (avg of last N periods)
generateRollingForecast(budgetId: bigint, tenantId: bigint, basePeriods?: number): Promise<BudgetForecast>
```

### Enforcement

```typescript
// Check if transaction can proceed
checkBudgetEnforcement(budgetId: bigint, budgetLineId: bigint | null, proposedAmount: number): Promise<{
  canProceed: boolean
  remainingBalance: number
  enforcementMode: string
  message: string
}>
```

### Approvals

```typescript
// Create approval step
createBudgetApproval(budgetId: bigint, tenantId: bigint, sequence: number, approverRole: string): Promise<BudgetApproval>

// Approve or reject budget
approveBudget(input: BudgetApproveInput): Promise<BudgetApproval>

// Get approval status
getBudgetApprovals(budgetId: bigint, tenantId: bigint): Promise<BudgetApproval[]>
```

## Zod Schemas

```typescript
budgetCreateSchema          // Required: code, name, budgetType, periodType, totalBudgetAmount, budgetLines
budgetUpdateSchema          // Optional: name, description, totalBudgetAmount, enforcementMode, notes
budgetApproveSchema         // Required: approverId, approverName, approve (boolean)
budgetActualSchema          // Required: actualType, actualAmount
budgetForecastCreateSchema  // Required: forecastType, forecastLines
```

## API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/finance/budgets | List budgets |
| POST | /api/finance/budgets | Create budget |
| GET | /api/finance/budgets/[id] | Get budget |
| PUT | /api/finance/budgets/[id] | Update budget |
| DELETE | /api/finance/budgets/[id] | Delete budget |
| GET | /api/finance/budgets/[id]/lines | Get lines |
| GET | /api/finance/budgets/[id]/actuals | Get actuals |
| POST | /api/finance/budgets/[id]/actuals | Record actual |
| GET | /api/finance/budgets/[id]/variances | Get variances |
| PATCH | /api/finance/budgets/[id]/variances | Acknowledge variance |
| GET | /api/finance/budgets/[id]/forecasts | Get forecasts |
| POST | /api/finance/budgets/[id]/forecasts | Create forecast |
| GET | /api/finance/budgets/[id]/approvals | Get approvals |
| POST | /api/finance/budgets/[id]/approvals | Approve budget |

## React Component Usage

```typescript
import BudgetPlanningWorkspace from "@/app/tenant-admin/sections/budget-planning";

export default function MyPage() {
  return <BudgetPlanningWorkspace tenantSlug="my-tenant" />;
}
```

**Component Props**:
```typescript
interface BudgetPlanningWorkspaceProps {
  tenantSlug: string;  // Tenant identifier for API calls
}
```

**Component Features**:
- **Planning Tab**: Create budgets, view structure
- **Tracking Tab**: Monitor budget vs. actuals, view variances
- **Forecasting Tab**: Generate and compare forecasts
- **Real-time Summaries**: Budget utilization %, remaining balance
- **Modals**: Create budget, generate forecast
- **Responsive**: Tailwind CSS design

## Typical Integration Steps

1. **Add to tenant admin**:
   ```typescript
   // In src/app/tenant-admin/page.tsx
   import BudgetPlanningWorkspace from "./sections/budget-planning";
   
   <BudgetPlanningWorkspace tenantSlug={tenantSlug} />
   ```

2. **Run migration**:
   ```bash
   npm run db:migrate
   ```

3. **Integrate with Expense module**:
   ```typescript
   // When posting expense
   await recordBudgetActual(budgetId, tenantId, {
     actualType: "EXPENSE",
     transactionId: expenseId,
     actualAmount: expense.amount,
   });
   ```

4. **Integrate with PO module**:
   ```typescript
   // When creating PO
   await recordBudgetActual(budgetId, tenantId, {
     actualType: "PURCHASE_ORDER",
     transactionId: poId,
     committedAmount: po.amount, // Not yet paid
   });
   ```

## Performance Characteristics

| Operation | Complexity | Indexes Used |
|-----------|-----------|---------------|
| Get budget summaries | O(1) | budget_summary_view |
| Get budget lines | O(n lines) | budget_lines_budget_id |
| Record actual | O(1) + variance check | budget_actuals_budget_id |
| Check variances | O(n lines) | Multiple indexes |
| Generate forecast | O(n actuals) | budget_actuals_date |

- **Read-heavy**: Budget tracking, forecasting
- **Write-light**: Actuals recorded as expenses posted (already happening)
- **Index strategy**: Tenants, dates, status for quick filtering

## Testing

```typescript
// Example test
const budget = await createBudget({
  tenantId: TENANT_ID,
  code: "TEST-BUDGET",
  name: "Test Budget",
  budgetType: "DEPARTMENT",
  periodType: "ANNUAL",
  fiscalYear: 2024,
  totalBudgetAmount: 100000,
  budgetLines: [
    { lineNumber: 1, accountCode: "5010", accountName: "Test", budgetedAmount: 100000 }
  ]
});

assert(budget.id !== null);
assert(budget.status === "DRAFT");

// Change status
await changeBudgetStatus(budget.id, TENANT_ID, "SUBMITTED");
const updated = await getBudget(budget.id, TENANT_ID);
assert(updated.status === "SUBMITTED");

// Record actual
await recordBudgetActual(budget.id, TENANT_ID, {
  actualType: "EXPENSE",
  actualAmount: 25000,
  budgetLineId: BigInt(budget.budgetLines[0].id),
});

// Check variance
const variances = await checkAndCreateVariances(budget.id, TENANT_ID);
assert(variances.length > 0);
```

## Deployment Checklist

- [ ] Run migration: `npm run db:migrate`
- [ ] Add BudgetPlanningWorkspace to tenant-admin/page.tsx
- [ ] Integrate recordBudgetActual calls in expense workflow
- [ ] Integrate recordBudgetActual calls in PO workflow
- [ ] Add enforcement check before posting large transactions
- [ ] Set up budget approval roles in RBAC
- [ ] Create default approval workflow sequence
- [ ] Test budget creation → approval → tracking → variance detection
- [ ] Load test with 1000+ budget lines and 10,000+ actuals
- [ ] Deploy to staging and smoke test
- [ ] Create admin guide for budget setup

