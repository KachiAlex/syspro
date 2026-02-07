# Accounting Core Module - Complete Guide

## Overview

A production-grade, double-entry bookkeeping system for multi-tenant ERP with full audit trail, approval workflows, and reporting capabilities.

## Architecture

### Data Model

```
chart_of_accounts (5 main types: ASSET, LIABILITY, EQUITY, INCOME, EXPENSE)
├── fiscal_periods (OPEN, CLOSED, LOCKED)
├── journal_entries (MANUAL, SYSTEM, ADJUSTMENT, REVERSING)
│   └── journal_lines (Debit/Credit pairs)
├── account_balances (Denormalized for fast reporting)
└── accounting_audit_log (Full compliance trail)
```

### Core Principles

1. **Double-Entry Bookkeeping**: Every journal entry must have Total Debits = Total Credits
2. **Immutability**: Posted journals cannot be deleted (only reversed)
3. **Period Locking**: Prevents accidental posting to closed periods
4. **Audit Trail**: Every action is logged with user, timestamp, and field changes
5. **Role-Based Access**: Different user roles can create/approve/post journals

## Chart of Accounts Setup

### Default Structure

```
ASSETS (1000-1999)
├── 1000 - Cash
├── 1100 - Accounts Receivable
├── 1200 - Inventory
└── 1500 - Fixed Assets

LIABILITIES (2000-2999)
├── 2000 - Accounts Payable
├── 2100 - Sales Tax Payable
└── 2200 - Salaries Payable

EQUITY (3000-3999)
├── 3000 - Owner Capital
└── 3100 - Retained Earnings

INCOME (4000-4999)
├── 4000 - Sales Revenue
└── 4100 - Service Revenue

EXPENSES (5000-5999)
├── 5000 - Cost of Goods Sold
├── 5100 - Salaries Expense
├── 5200 - Rent Expense
└── 5300 - Utilities Expense
```

### Creating Custom Accounts

```typescript
// API: POST /api/accounting/accounts
const account = {
  tenantSlug: "company-001",
  accountCode: "1300",
  accountName: "Prepaid Insurance",
  accountType: "ASSET",
  description: "Insurance premiums paid in advance",
  currency: "NGN",
  isSystemAccount: false,
  isActive: true,
  branchId: "branch-001", // Optional: branch-specific
  departmentId: "dept-001", // Optional: department-specific
  requireCostCenter: true, // Enforce cost center on entries
  createdBy: "user@company.com"
};
```

## Journal Entry Creation

### Example 1: Sales Invoice Posting

When a sales invoice is created, the system automatically posts:

```typescript
const invoicePosting = {
  tenantSlug: "company-001",
  journalType: "SYSTEM",
  fiscalPeriodId: "fy2026-p01",
  postingDate: "2026-02-04",
  referenceId: "INV-001234",
  referenceType: "SALES_INVOICE",
  description: "Sale of goods to ABC Corp",
  createdBy: "system",
  lines: [
    {
      lineNumber: 1,
      accountId: "acct-1100", // Accounts Receivable
      debitAmount: 1000000, // NGN 1M
      creditAmount: 0,
      description: "Invoice INV-001234"
    },
    {
      lineNumber: 2,
      accountId: "acct-4000", // Sales Revenue
      debitAmount: 0,
      creditAmount: 1000000, // NGN 1M
      description: "Revenue from sale"
    }
  ]
};
// Result: Debit AR, Credit Sales Revenue
```

### Example 2: Cash Payment Received

```typescript
const paymentPosting = {
  tenantSlug: "company-001",
  journalType: "SYSTEM",
  fiscalPeriodId: "fy2026-p01",
  postingDate: "2026-02-04",
  referenceId: "PAY-005678",
  referenceType: "CUSTOMER_PAYMENT",
  description: "Payment received from ABC Corp",
  createdBy: "system",
  lines: [
    {
      lineNumber: 1,
      accountId: "acct-1000", // Cash
      debitAmount: 1000000,
      creditAmount: 0,
      description: "Cash received"
    },
    {
      lineNumber: 2,
      accountId: "acct-1100", // Accounts Receivable
      debitAmount: 0,
      creditAmount: 1000000,
      description: "Invoice INV-001234 collected"
    }
  ]
};
// Result: Debit Cash, Credit AR
```

### Example 3: Expense Recording

```typescript
const expensePosting = {
  tenantSlug: "company-001",
  journalType: "SYSTEM",
  fiscalPeriodId: "fy2026-p01",
  postingDate: "2026-02-04",
  referenceId: "EXP-003456",
  referenceType: "EXPENSE_CLAIM",
  description: "Monthly office rent payment",
  createdBy: "system",
  lines: [
    {
      lineNumber: 1,
      accountId: "acct-5200", // Rent Expense
      debitAmount: 500000, // NGN 500K
      creditAmount: 0,
      departmentId: "operations",
      costCenterId: "cc-admin"
    },
    {
      lineNumber: 2,
      accountId: "acct-1000", // Cash
      debitAmount: 0,
      creditAmount: 500000,
      description: "Rent payment from corporate account"
    }
  ]
};
// Result: Debit Rent Expense, Credit Cash
```

### Example 4: Vendor Bill Payment

```typescript
const vendorPaymentPosting = {
  tenantSlug: "company-001",
  journalType: "SYSTEM",
  fiscalPeriodId: "fy2026-p01",
  postingDate: "2026-02-04",
  referenceId: "VEND-PAY-009999",
  referenceType: "VENDOR_PAYMENT",
  description: "Payment to vendor XYZ Corp",
  createdBy: "system",
  lines: [
    {
      lineNumber: 1,
      accountId: "acct-2000", // Accounts Payable
      debitAmount: 750000,
      creditAmount: 0,
      description: "Bill INV-VENDOR-100"
    },
    {
      lineNumber: 2,
      accountId: "acct-1000", // Cash/Bank
      debitAmount: 0,
      creditAmount: 750000,
      description: "Payment disbursed"
    }
  ]
};
// Result: Debit AP, Credit Cash
```

### Example 5: Payroll Posting

```typescript
const payrollPosting = {
  tenantSlug: "company-001",
  journalType: "SYSTEM",
  fiscalPeriodId: "fy2026-p01",
  postingDate: "2026-02-28",
  referenceId: "PAYROLL-2026-02",
  referenceType: "PAYROLL",
  description: "Monthly payroll for February 2026",
  createdBy: "system",
  lines: [
    {
      lineNumber: 1,
      accountId: "acct-5100", // Salaries Expense
      debitAmount: 5000000, // Gross amount
      creditAmount: 0,
      description: "Employee salaries"
    },
    {
      lineNumber: 2,
      accountId: "acct-2200", // Salaries Payable
      debitAmount: 0,
      creditAmount: 4200000,
      description: "Net salaries due to employees"
    },
    {
      lineNumber: 3,
      accountId: "acct-2100", // Tax Payable
      debitAmount: 0,
      creditAmount: 800000,
      description: "Withholding tax payable"
    }
  ]
};
// Result: Debit Salaries Expense, Credit Salaries Payable & Tax Payable
```

## Approval Workflow

### States

```
DRAFT → SUBMITTED → APPROVED → POSTED
                  ↓
                REJECTED
```

### Posting Flow

```typescript
// 1. Create journal in DRAFT
const { entry, lines } = await createJournalEntry(journalData);
// entry.approvalStatus = "DRAFT"

// 2. Approve/Post journal
await postJournalEntry(
  entry.id,
  "approver@company.com",
  "Manager Name"
);
// Updates:
// - approval_status = "POSTED"
// - approved_by = approver email
// - approved_at = timestamp
// - posted_at = timestamp
// - Updates account_balances
```

## Fiscal Period Management

### Creating a Fiscal Year

```typescript
// Create 12 months for FY2026
for (let month = 1; month <= 12; month++) {
  const startDate = new Date(2026, month - 1, 1);
  const endDate = new Date(2026, month, 0);

  await createFiscalPeriod({
    tenantSlug: "company-001",
    fiscalYear: 2026,
    periodNumber: month,
    periodName: `FY2026-P${String(month).padStart(2, "0")}`,
    startDate,
    endDate,
    status: "OPEN",
    allowPosting: true,
    allowAdjustments: false
  });
}
```

### Period Controls

```typescript
// Lock period (prevents new postings)
await lockFiscalPeriod(periodId, "controller@company.com");

// Close all periods up to year-end
await closeAllPeriodsUpto("company-001", 2025);
```

## Reporting

### Trial Balance

```typescript
// GET /api/accounting/reports/trial-balance
// ?tenantSlug=company-001&periodId=fy2026-p01

Response: {
  data: {
    fiscalYear: 2026,
    period: 1,
    totalDebits: 15750000,
    totalCredits: 15750000,
    isBalanced: true,
    entries: [
      {
        accountCode: "1000",
        accountName: "Cash",
        accountType: "ASSET",
        balance: 1500000,
        debitBalance: 1500000,
        creditBalance: 0
      },
      {
        accountCode: "4000",
        accountName: "Sales Revenue",
        accountType: "INCOME",
        balance: 1000000,
        debitBalance: 0,
        creditBalance: 1000000
      }
      // ... more accounts
    ]
  }
}
```

### General Ledger

```typescript
// GET /api/accounting/reports/general-ledger
// ?tenantSlug=company-001&accountId=acct-1000&startDate=2026-02-01&endDate=2026-02-28

Response: {
  data: [
    {
      entryId: "je-123",
      journalNumber: "MAN-1707049600000-000001",
      journalType: "SYSTEM",
      postingDate: "2026-02-04",
      referenceId: "INV-001234",
      accountCode: "1000",
      accountName: "Cash",
      debitAmount: 1000000,
      creditAmount: 0,
      description: "Payment received from ABC Corp",
      approvalStatus: "POSTED",
      createdBy: "system",
      createdAt: "2026-02-04T10:30:00Z"
    }
    // ... more entries
  ]
}
```

## Integration Points

### From Invoicing Module

```typescript
// When invoice is created:
await createJournalEntry({
  referenceType: "SALES_INVOICE",
  referenceId: invoice.id,
  // Automatically posts:
  // DR: Accounts Receivable
  // CR: Sales Revenue
});

// When invoice is deleted:
await reverseJournalEntry(
  correspondingJournalId,
  "Invoice cancelled",
  userId
);
```

### From Payments Module

```typescript
// When payment is recorded:
await createJournalEntry({
  referenceType: "CUSTOMER_PAYMENT",
  referenceId: payment.id,
  // Automatically posts:
  // DR: Cash
  // CR: Accounts Receivable
});
```

### From Expenses Module

```typescript
// When expense is approved:
await createJournalEntry({
  referenceType: "EXPENSE_CLAIM",
  referenceId: expense.id,
  // Automatically posts:
  // DR: Expense Category
  // CR: Cash/Payable
});
```

### From Vendor Payments Module

```typescript
// When vendor payment is posted:
await createJournalEntry({
  referenceType: "VENDOR_PAYMENT",
  referenceId: vendorPayment.id,
  // Automatically posts:
  // DR: Accounts Payable
  // CR: Cash
});
```

### From Payroll Module

```typescript
// When payroll is processed:
await createJournalEntry({
  referenceType: "PAYROLL",
  referenceId: payroll.id,
  // Automatically posts:
  // DR: Salaries Expense
  // CR: Salaries Payable, Tax Payable
});
```

## Security & Compliance

### Access Control

- **Finance Manager**: Can create/approve journals, close periods
- **Accountant**: Can create journals, view reports
- **Auditor**: Read-only access to all journals and audit logs
- **CFO**: Can lock periods, change approval rules

### Audit Logging

Every action is logged:

```typescript
{
  entityType: "JOURNAL_ENTRY",
  entityId: entry.id,
  action: "POST",
  changedFields: { status: "POSTED" },
  oldValues: { approvalStatus: "DRAFT" },
  newValues: { approvalStatus: "POSTED" },
  userId: "user@company.com",
  timestamp: "2026-02-04T10:30:00Z"
}
```

### Data Integrity Checks

1. ✅ Double-entry validation (Debits = Credits)
2. ✅ Period lock validation (Cannot post to closed periods)
3. ✅ Account existence validation
4. ✅ Balance integrity (Account balances always in sync)
5. ✅ Immutability (Posted entries cannot be edited, only reversed)

## Performance Optimization

### Denormalized Balances

Account balances are pre-calculated and stored in `account_balances` table for O(1) lookup instead of summing journal lines.

```sql
-- Trial balance query (optimized)
SELECT ab.closing_balance
FROM account_balances ab
WHERE ab.account_id = ? AND ab.fiscal_period_id = ?
-- Much faster than:
-- SELECT SUM(debit) - SUM(credit) FROM journal_lines WHERE account_id = ?
```

### Indexes

- `idx_journal_entries_tenant` - Tenant-level queries
- `idx_journal_lines_account_date` - GL lookups by date
- `idx_fiscal_periods_tenant` - Period management
- `idx_audit_log_tenant` - Compliance queries

## Common Scenarios

### Scenario 1: Month-End Close

```typescript
// 1. Validate trial balance is balanced
const tb = await getTrialBalance(tenantSlug, periodId);
if (!tb.isBalanced) throw new Error("Trial balance not balanced!");

// 2. Post any pending adjustment journals
const pending = await getJournalEntries(tenantSlug, {
  fiscalPeriodId: periodId,
  approvalStatus: "APPROVED"
});

for (const entry of pending) {
  await postJournalEntry(entry.id, cfoEmail, cfoName);
}

// 3. Lock the period
await lockFiscalPeriod(periodId, userId);

// 4. Run closing routines (depreciation, accruals, etc)
// ... [implementation varies by company]
```

### Scenario 2: Period Reversal (Emergency)

```typescript
// If need to reopen a closed period:
// 1. Get all posted entries in period
// 2. Reverse them in reverse chronological order
// 3. Reset period status to OPEN

const entries = await getJournalEntries(tenantSlug, { fiscalPeriodId });
for (const entry of entries.reverse()) {
  if (entry.approvalStatus === "POSTED") {
    await reverseJournalEntry(entry.id, "Period reversal", userId);
  }
}
```

### Scenario 3: Audit Trail Query

```typescript
// Retrieve all changes to a journal entry
const audit = await getAuditTrail("JOURNAL_ENTRY", entryId);

// Shows:
// CREATE - original values
// SUBMIT - status change
// APPROVE - approval fields
// POST - final posting
// Each with user, timestamp, IP address
```

## API Reference

### Chart of Accounts

- `GET /api/accounting/accounts` - List accounts
- `POST /api/accounting/accounts` - Create account
- `GET /api/accounting/accounts/:id` - Get account
- `PATCH /api/accounting/accounts/:id` - Update account

### Journals

- `GET /api/accounting/journals` - List journals
- `POST /api/accounting/journals` - Create journal
- `GET /api/accounting/journals/:id` - Get journal details
- `POST /api/accounting/journals/:id/approve` - Approve/post journal

### Fiscal Periods

- `GET /api/accounting/periods` - List periods
- `POST /api/accounting/periods` - Create period
- `PATCH /api/accounting/periods/:id/lock` - Lock period

### Reports

- `GET /api/accounting/reports/trial-balance` - Trial balance
- `GET /api/accounting/reports/general-ledger` - General ledger

---

**Version**: 1.0  
**Last Updated**: 2026-02-04  
**Compliance**: Full GAAP/IFRS double-entry bookkeeping
