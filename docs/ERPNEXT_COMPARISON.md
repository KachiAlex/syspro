# ERPNext vs Syspro ERP — Feature Comparison

Ground-truth comparison of ERPNext's Accounts/Assets modules (192 + 25 DocTypes,
62 reports — inventoried from the ERPNext source tree) against this codebase.

Status legend: ✅ implemented · 🟡 partial / simplified · ❌ not implemented

---

## 1. Core Ledger & GL

| ERPNext | Syspro ERP | Status |
|---|---|---|
| `gl_entry` | `journal_entries` + `journal_entry_lines`, canonical `postGLEntry` (gl.ts) | ✅ |
| `journal_entry` / `journal_entry_account` | Journal entries API + JE templates (`je-templates`) | ✅ |
| `account` / `chart_of_accounts_importer` | `chart_of_accounts`, onboarding CoA seeding | ✅ |
| `accounting_period` / `fiscal_year` | `fiscal-periods` + Period End page | ✅ |
| `period_closing_voucher` / `process_period_closing_voucher` | `closeFiscalPeriod` with P&L sweep → retained earnings | ✅ |
| `account_closing_balance` | `account_closing_balance` snapshot table | ✅ |
| `accounting_dimension` + filters | `dimensions` lib (branch/department/project/cost-center + custom dims) | ✅ |
| `finance_book` | Asset finance books (`asset_finance_books`) | ✅ |
| `cost_center` / `cost_center_allocation` | Cost centers + auto-allocation inside `postGLEntry` | ✅ |
| `monthly_distribution` | `monthly_distributions` table + tools page | ✅ |
| `budget` / `budget_variance_report` | Budgets + budget-vs-actual + budget enforcement | ✅ |
| `mode_of_payment` | `mode_of_payment` + tools page | ✅ |
| `exchange_rate_revaluation` | `revaluation` API + Period End | ✅ |
| `pegged_currencies` | ❌ | ❌ |
| `ledger_merge` (account merging) | ❌ | ❌ |
| Multi-company consolidation | `consolidation.ts` (per-tenant group reporting) | 🟡 |
| Immutable GL / soft-close audit | Posted-entry immutability, reversal-only correction, deletion records | ✅ |

## 2. Receivables (AR)

| ERPNext | Syspro ERP | Status |
|---|---|---|
| `sales_invoice` + items + advances | `finance_invoices` → GL on issue (Dr 1200 / Cr revenue+tax) | ✅ |
| `payment_entry` + references/deductions | `finance_payments` + `payment_applications` allocation engine | ✅ |
| `payment_reconciliation` tool | Payment Reconciliation workbench page | ✅ |
| `unreconcile_payment` | unreconcile actions in Finance Tools | ✅ |
| `payment_order` | `payment_orders` + process | ✅ |
| `payment_request` | `payment-requests` API + gateway hooks (`gateway.ts`) | ✅ |
| `payment_terms_template` / `payment_schedule` | `payment-terms` + schedules on invoices | ✅ |
| `dunning` (dunning_type, letters) | `dunning` API + credit-control page, fee income account | ✅ |
| `overdue_payment` | Aged receivables + dunning pipeline | ✅ |
| `process_statement_of_accounts` | Statement runs (generate + email via outbox) | ✅ |
| `opening_invoice_creation_tool` | Opening balance CSV import (tools page) | ✅ |
| `loyalty_program` / points | POS loyalty (`src/lib/pos/loyalty.ts`) | 🟡 POS-scoped |
| `sales_partner` commission | ❌ | ❌ |
| `pos_invoice` (merged into SI) | POS sales post through canonical GL | ✅ |

## 3. Payables (AP)

| ERPNext | Syspro ERP | Status |
|---|---|---|
| `purchase_invoice` | `bills` + purchase-orders flow | ✅ |
| Supplier payments / advance allocation | `vendor_payments` + `vendor_payment_applications` | ✅ |
| `tax_withholding_category` (TDS/WHT) | Withholding categories with single + cumulative thresholds | ✅ |
| Supplier ledger / statements | `vendor-payments`, `vendor-analytics` | ✅ |
| Employee advances / expense claims | Imprest module (floats, top-ups, retirement, surrender) | ✅ |
| `supplier_group_item` | Vendor groups via `vendors` | 🟡 |

## 4. Tax & Pricing

| ERPNext | Syspro ERP | Status |
|---|---|---|
| `item_tax_template` | `item_tax_templates` + item→template mapping | ✅ |
| `sales/purchase_taxes_and_charges_template` | `tax_templates` (multi-line, sales/purchase/both) | ✅ |
| `tax_rule` + `tax_category` | `tax_rules` with priority + party/item/amount matching | ✅ |
| `shipping_rule` | `shipping_rules` (flat/percent, value/weight bands) | ✅ |
| `pricing_rule` | `pricing_rules` (price/discount%/margin, priority) | ✅ |
| `promotional_scheme` | `promotional_schemes` | ✅ |
| `coupon_code` | `coupon_codes` + redemption | ✅ |
| FIRS/NRS e-invoicing | `einvoice-submission` + NG localization (VAT/WHT/PAYE/pension/NHF) | ✅ (NG-specific) |
| Regional packs (IT/FR/…) | Nigerian localization only | 🟡 |

## 5. Banking & Treasury

| ERPNext | Syspro ERP | Status |
|---|---|---|
| `bank_account` / `bank` / subtypes | Bank accounts via modes of payment + chart | 🟡 |
| `bank_statement_import` (+ column map, logs) | `bank-statement` import (CSV/OFX) | ✅ |
| `bank_transaction` + auto-match | `bank_statement_lines` + `autoMatch` | ✅ |
| `bank_transaction_rule` | `bank_recon_rules` (regex + amount tolerance + party hints) | ✅ |
| `bank_reconciliation_tool` | Bank Reconciliation page | ✅ |
| `bank_clearance` | Clearance status on statement lines | 🟡 |
| `bank_guarantee` | `bank_guarantees` (issued/received, margin, JE on claim) | ✅ |
| `invoice_discounting` | `invoice_discountings` (sanction → disburse JE → settle) | ✅ |
| `cheque_print_template` | ❌ | ❌ |
| Currency exchange + auto-fetch | `exchange_rates` + provider auto-fetch (`source='auto'`) | ✅ |
| `subscription` / `subscription_plan` / `process_subscription` | Plans, subscriptions, invoice generation engine | ✅ |

## 6. Deferred & Integrity

| ERPNext | Syspro ERP | Status |
|---|---|---|
| `process_deferred_accounting` | Deferred items + schedules + `process` action | ✅ |
| `repost_accounting_ledger` | Repost tool (reverse + repost with corrections) | ✅ |
| `repost_payment_ledger` | Covered by repost + unreconcile | 🟡 |
| `ledger_health` monitor | `gl-vs-subledger` comparison + integrity checks | 🟡 |
| `transaction_deletion_record` | `transaction_deletion_records` audit table | ✅ |
| `closed_document` / frozen docs | Fiscal-period locks + posted immutability | ✅ |

## 7. Assets

| ERPNext | Syspro ERP | Status |
|---|---|---|
| `asset` / `asset_category` | Fixed assets + categories | ✅ |
| `asset_depreciation_schedule` | Per-finance-book schedules | ✅ |
| `asset_shift_factor` / usage depreciation | Units-of-production + shift factors (`recordAssetUsage`, `postUsageDepreciation`) | ✅ |
| `asset_movement` | Movements + location hierarchy | ✅ |
| `asset_maintenance` + team/log | Maintenance teams, schedules, logs | ✅ |
| `asset_repair` (+consumed items, purchase invoice) | Repairs with stock parts → Dr 6450 / Cr 1500+1100 | ✅ |
| `asset_value_adjustment` | `adjustAssetValue` | ✅ |
| `asset_capitalization` | `capitalizeAsset` (WIP → asset) | ✅ |
| `asset_activity` | Unified activity timeline (`getAssetActivity`) | ✅ |
| `location` hierarchy | `asset_locations` tree | ✅ |

## 8. Reports (ERPNext 62)

| Area | ERPNext | Syspro ERP |
|---|---|---|
| Core statements | balance sheet, P&L, cash flow, trial balance (+ simple, consolidated) | ✅ all incl. consolidated |
| AR/AP | aged receivables/payables + summaries, customer/supplier ledger summary | ✅ |
| GL analysis | general ledger, voucher-wise balance, payment ledger, dimension-wise, invalid ledger entries, GL-vs-payment-ledger comparison | ✅ |
| Profitability | gross profit, gross & net profit, profitability analysis | ✅ gross profit + ratios; 🟡 profitability-by-dimension partial |
| Registers | sales/purchase/item-wise registers, POS register, payment period by invoice date | ✅ |
| Operations | delivered/billed/received items to be billed/received, inactive sales items, invoice trends, sales payment summary | ✅ |
| Tax | TDS computation summary, tax withholding details | 🟡 withholding data exists, dedicated reports thin |
| Banking | bank reconciliation statement, clearance summaries | ✅ recon statement; 🟡 clearance summaries |
| Assets | depreciation ledger, depreciations & balances | ✅ |
| Misc | deferred revenue & expense, budget variance, share balance/ledger, sales partners commission, financial ratios, custom financial statements | ✅ all except share_* and partners commission ❌ |
| Custom statements | `custom_financial_statement` builder | ✅ + saved-reports framework |

## 9. Where Syspro exceeds ERPNext

- **Tenant isolation** — every row scoped by `tenant_slug`; ERPNext achieves this via sites, not row-level tenancy
- **Nigerian statutory depth** — FIRS e-invoice submission, PAYE/pension/NHF, serial/batch tracking, filing exports
- **Storefront + customer/vendor portals** — public catalog, order tracking, token-based portal views
- **POS hardening** — shifts, held carts, cash movements, receipts, returns at POS level
- **Low-code custom fields**, durable notification outbox, PWA, onboarding wizard
- **Branch/location access control** on documents

## 10. Honest gaps remaining

| Gap | Notes |
|---|---|
| Shareholder / share_transfer / share_type / share_ledger | Not built — only relevant for equity accounting |
| Sales partner commissions | Not built |
| Cheque print templates | Not built — print layer is thin generally |
| Pegged currencies | Not built |
| Ledger merge (account merge tool) | Not built |
| Loyalty program invoicing-side (earn/redeem on SI) | POS-side only |
| Bank clearance workflow | Status field exists; no dedicated clearance UI |
| `process_*` job audit logs | ERPNext logs each mass-process run; ours are fire-and-forget |
| Regional tax packs beyond Nigeria | NG only |

## Bottom line

~85% of ERPNext Accounts surface area is implemented, with the remaining gaps
concentrated in edge features (equity accounting, cheque printing, partner
commissions) rather than core double-entry capability. The canonical-GL
architecture, tenant isolation, and Nigerian localization match or exceed
ERPNext's model for the target market.
