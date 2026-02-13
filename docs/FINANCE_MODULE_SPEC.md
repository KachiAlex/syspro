# Finance Module — High-level Spec

## Overview
- Purpose: provide core accounting functionality for transactions, ledger, invoicing, payments, reporting, reconciliation, approvals, and audit trails.
- Constraints: integrate with existing RBAC and tenant model; support multi-tenant data scoping via `tenant_id` or `tenant_slug`.

## Goals & Scope
- Basic GL (chart of accounts, journal entries, balances).
- AR/AP (invoices, bills, vendor/customer records, payments).
- Transactional API (create/capture/void transactions, journalization).
- Reports: Trial Balance, Balance Sheet, Profit & Loss, Cash Flow (initial implementations).
- Reconciliation adapters for bank statement imports and automated matching.
- Audit trail and approvals for financial-impacting operations.

## Core Domain Models (high level)
- `chart_of_accounts` — hierarchical account definitions.
- `accounts` (ledger accounts per tenant) — reference to COA entries.
- `journal_entries` — one entry per transaction with metadata.
- `journal_lines` — debit/credit lines linked to `journal_entries`.
- `invoices` — AR invoices, statuses, amounts, due dates.
- `payments` — recorded payments, payment method, references.
- `vendors`, `customers` — minimal contact/payment terms.
- `bank_statements` / `statement_lines` — imported bank data for reconciliation.
- `reconciliations` — matches between statements and ledger entries.
- `approvals` — records of pending/approved actions for audit.
- `audit_logs` — immutable log for who/when/what changed.

## Minimal DB Schema Sketch (migration examples)
- All tables include `id`, `tenant_id` (or `tenant_slug`), `created_at`, `updated_at`.

Example SQL (draft):
```sql
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- asset, liability, equity, income, expense
  parent_id UUID NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE journal_entries (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  reference TEXT,
  description TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft, posted, reversed
  source TEXT, -- invoice, payment, manual
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE journal_lines (
  id UUID PRIMARY KEY,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  account_id UUID REFERENCES chart_of_accounts(id),
  amount NUMERIC NOT NULL, -- always positive
  side TEXT NOT NULL, -- debit|credit
  description TEXT
);
```

## API Surface (REST/JSON or app-router routes)
- `GET /api/finance/accounts` — list accounts (with filters)
- `POST /api/finance/accounts` — create account
- `GET /api/finance/journals` — list journal entries
- `POST /api/finance/journals` — create journal entry (auto-validate debits==credits)
- `POST /api/finance/invoices` — create invoice (creates AR journal entries on post)
- `POST /api/finance/payments` — record payment and link to invoice(s)
- `GET /api/finance/reports/balance-sheet?asOf=YYYY-MM-DD` — report endpoints
- `POST /api/finance/reconcile/import` — upload bank statement CSV/OFX

APIs must validate tenant context and enforce RBAC permissions.

## RBAC & Approvals
- Roles: `finance_admin`, `accountant`, `approver`, `auditor`, `viewer`.
- Permissions: CRUD on accounts/journals/invoices/payments; `approver` required for posting large/judgmental entries.
- `approvals` table holds requests; posting actions require approval when above threshold.

## Audit & Compliance
- `audit_logs` table captures change events (actor, time, diff, source).
- Journals and journal_lines should be append-only once `posted` — reversals are separate entries.

## Integrations & Reconciliation
- Bank adapters: CSV, OFX, Plaid-style (if integrated later).
- Reconciliation engine matches by date/amount/reference and surfaces suggested matches.

## Testing Strategy
- Unit tests for services (ledger balancing, posting rules, rounding).
- Integration tests with a test DB for migrations + API flows (invoice -> payment -> ledger).
- E2E smoke tests for report endpoints.

## Rollout & Migration Notes
- Migrate incrementally: create COA and journal tables first, then backfill historical data if needed.
- Use feature flags / tenant opt-in for initial rollout.

## Next Steps (implementation plan)
1. Finalize canonical DB schema and indexes (performance for reports).
2. Add migrations under `db/migrations/` with idempotent SQL.
3. Implement `src/lib/finance/service.ts` and types in `src/lib/finance/types.ts`.
4. Create API routes under `src/app/api/finance/*` and tenant-admin UI pages.
5. Add RBAC checks and `approvals` workflow.
6. Write tests and CI checks for migrations, services, APIs.

---
Timestamp: 2026-02-13
