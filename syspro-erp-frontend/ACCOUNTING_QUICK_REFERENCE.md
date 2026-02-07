# Accounting Core - Quick Reference

## Key Endpoints

```bash
# Chart of Accounts
GET    /api/accounting/accounts?tenantSlug=X&accountType=ASSET
POST   /api/accounting/accounts
PATCH  /api/accounting/accounts/:id

# Journal Entries
GET    /api/accounting/journals?tenantSlug=X&approvalStatus=DRAFT
POST   /api/accounting/journals
POST   /api/accounting/journals/:id/approve

# Fiscal Periods
GET    /api/accounting/periods?tenantSlug=X&status=OPEN
POST   /api/accounting/periods

# Reports
GET    /api/accounting/reports/trial-balance?tenantSlug=X&periodId=Y
GET    /api/accounting/reports/general-ledger?tenantSlug=X&accountId=Y
```

## Key Functions

```typescript
import {
  createChartOfAccount,
  createJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
  getTrialBalance,
  getGeneralLedger,
  lockFiscalPeriod,
  initializeDefaultChartOfAccounts
} from "@/lib/accounting/db";

// Create account
const account = await createChartOfAccount({
  tenantSlug: "company-001",
  accountCode: "1000",
  accountName: "Cash",
  accountType: "ASSET"
});

// Create journal (double-entry)
const { entry, lines } = await createJournalEntry({
  tenantSlug: "company-001",
  journalType: "MANUAL",
  fiscalPeriodId: "fy2026-p01",
  postingDate: new Date(),
  createdBy: "user@company.com",
  lines: [
    { lineNumber: 1, accountId, debitAmount: 1000, creditAmount: 0 },
    { lineNumber: 2, accountId, debitAmount: 0, creditAmount: 1000 }
  ]
});

// Post journal (updates balances, immutable)
const posted = await postJournalEntry(
  entry.id,
  "manager@company.com",
  "Manager Name"
);

// Get reports
const tb = await getTrialBalance("company-001", periodId);
const gl = await getGeneralLedger("company-001", accountId);
```

## Journal Entry Rules

### ✅ VALID
- 2 lines: DR 1000, CR 1000
- 3 lines: DR 1000, DR 500, CR 1500
- Multiple lines as long as DR = CR

### ❌ INVALID
- Unbalanced: DR 1000, CR 500
- Only debits: DR 1000 (needs credit)
- Only credits: CR 1000 (needs debit)
- Wrong data type: string amounts instead of numbers

## Account Types

| Type | Used For | Example | Normal Balance |
|------|----------|---------|-----------------|
| ASSET | What you own | Cash, AR, Inventory | Debit |
| LIABILITY | What you owe | AP, Loans | Credit |
| EQUITY | Owner's stake | Capital, Retained Earnings | Credit |
| INCOME | Revenue earned | Sales, Service Revenue | Credit |
| EXPENSE | Money spent | Salaries, Rent | Debit |

## Common Postings

### Sale Invoice
```
DR: 1100 - Accounts Receivable
CR: 4000 - Sales Revenue
Amount: Invoice total
```

### Cash Collection
```
DR: 1000 - Cash
CR: 1100 - Accounts Receivable
Amount: Payment amount
```

### Expense Claim
```
DR: 5100 - Salaries Expense  (or relevant expense)
CR: 1000 - Cash
Amount: Claim amount
```

### Vendor Payment
```
DR: 2000 - Accounts Payable
CR: 1000 - Cash
Amount: Payment amount
```

### Payroll
```
DR: 5100 - Salaries Expense
CR: 2200 - Salaries Payable (net)
CR: 2100 - Tax Payable (taxes withheld)
Amount: Gross salary
```

## Period Status Meanings

- **OPEN**: New postings allowed ✅
- **CLOSED**: No new postings, adjustments ok ⚠️
- **LOCKED**: Complete freeze, GL finalized 🔒

## Troubleshooting

### "Journal must balance"
**Problem**: Total debits ≠ Total credits  
**Solution**: Check all debit and credit amounts sum to same total

### "Cannot post to period: Period is closed"
**Problem**: Trying to post to closed period  
**Solution**: Use next open period or reopen the period (admin only)

### "Account not found"
**Problem**: Account ID doesn't exist  
**Solution**: Verify account exists via GET /api/accounting/accounts

### "System accounts cannot be modified"
**Problem**: Trying to edit a system account  
**Solution**: Create a new user-defined account instead

## Performance Tips

1. **Use periodId filters** - Queries much faster with fiscal period
2. **Batch journal creation** - Post multiple entries together
3. **Archive old periods** - Query performance improves
4. **Denormalized balances** - Always queries account_balances table
5. **Index on account_id** - Used for GL lookups

## Compliance Checklist

- [ ] All journals have equal debits & credits
- [ ] All postings reference correct accounts
- [ ] Periods locked after month-close
- [ ] Trial balance balanced before closing
- [ ] Audit trail reviewed quarterly
- [ ] User access roles defined
- [ ] Sensitive journals require approval
- [ ] No deletions of posted entries (only reversals)

## Integration Checklist

For each financial module to integrate:

- [ ] Determine posting rules (DR/CR accounts)
- [ ] Create mapping in posting instruction
- [ ] Call `createJournalEntry()` on event
- [ ] Test with sample data
- [ ] Verify trial balance after posting
- [ ] Add integration test

## Emergency Procedures

### Reverse a Journal Entry
```typescript
await reverseJournalEntry(
  journalId,
  "Reason for reversal",
  userId
);
// Creates opposite entry (swaps DR/CR), posts it
// Original entry remains for audit trail
```

### Reopen a Closed Period
```typescript
// 1. Get all entries in period
const entries = await getJournalEntries(tenantSlug, { fiscalPeriodId });

// 2. Reverse them (in reverse order)
for (const entry of entries.reverse()) {
  await reverseJournalEntry(entry.id, "Period reversal", userId);
}

// 3. Update period status
// (requires direct DB access - high privilege)
```

### Fix a Wrong Account
```typescript
// Cannot edit posted entry, so:
// 1. Reverse the original entry
await reverseJournalEntry(originalId, "Correction", userId);

// 2. Create new entry with correct account
await createJournalEntry({
  // ... same data but correct account
});

// 3. Post the new entry
await postJournalEntry(newEntryId, approverEmail, approverName);
```

---

**Last Updated**: 2026-02-04  
**Status**: Ready for Production Testing
