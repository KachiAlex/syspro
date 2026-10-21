# Module Audit — pisairtelerp vs ERPNext

Companion to `ERPNEXT_COMPARISON.md` (Finance). Audits CRM, RevOps, Sales,
Procurement, Inventory, POS, Storefront, HR & Payroll, Projects, Manufacturing,
Automation, Admin, and Analytics. Source-verified against `C:\erpnext-reference`.

Depth legend: **Real** = wired end-to-end · **Partial** = works with gaps ·
**Headless** = API/lib exists, no reachable UI · **Stub** = placeholder/no-op.

---

## 1. Cross-cutting findings (read first)

### Security — needs attention

| # | Issue | Location |
|---|---|---|
| S1 | **`lookupVendor` queries `vendors` with NO `tenant_slug`** — `/api/finance/vendors?search=true` exposes other tenants' vendor names/codes to any finance-read session. Also falls back to hardcoded `SAMPLE_VENDORS` on DB error (fake data returned as real). | `src/lib/finance/vendors.ts:157-214` |
| S2 | **Unauthenticated permission disclosure** — `GET /api/tenant/user/permissions` and `/api/tenant/user/modules` have no session check; `?tenantSlug&userId` returns any user's permission map; `user/modules` leaks `sessionEmail`/`roleId` in `_debug`. | `src/app/api/tenant/user/permissions`, `…/modules` |
| S3 | **Caller-controlled tenantSlug** on many `/api/tenant/*` handlers (`assign-role`, `role-history`, `audit`, `assignments`) — `params.tenantSlug || scope.user.tenantSlug`; a tenant user passing another slug is a cross-tenant read/write vector where the gate doesn't bind it. | `src/app/api/tenant/*` routes |
| S4 | **Webhook SSRF** — automation `webhook:post` accepts any URL, no allowlist; only optional `policyKey` mitigates. | `src/lib/automation/connectors.ts` |
| S5 | **IDOR in manufacturing writes** — `updateOperation` (`where id=$1 and work_order_id=$2`, no tenant), `addBomLine`, `removeBomLine` mutate without tenant predicates. | `work-orders.ts:519`, `bom.ts:287-305` |
| S6 | **Draft payslips visible to employees** — portal payslips route has no `run.status` filter. | `api/hr/employees/portal/payslips` |
| S7 | **Existence checks before auth** in several `/api/crm/*/​[id]` routes → 404-vs-403 cross-tenant oracle. | `crm/leads/[id]`, `contacts/[id]`, `deals/[id]` |

### The "orphaned implementations" pattern

The single largest structural finding: **substantial working code that no route
or nav entry can reach**. Stub pages were shipped over real workspaces:

| Orphaned code | Size | What should mount it |
|---|---|---|
| `sections/revops-workspace.tsx` (real RevOps workspace) | ~55 KB | `tenant-admin/revops/*` — currently 5 stub pages |
| `sections/it-support-workspace.tsx` | ~55 KB | `tenant-admin/it-support/*` — currently 5 stub pages |
| `sections/marketing-sales-dashboard.tsx` | real | nowhere |
| `sections/procurement.tsx` | ~40 KB | would expose the GOOD PO/GRN/3-way-match stack |
| `sections/inventory.tsx` | dead | `tenant-admin/inventory` is a 7-line stub |
| `sections/vendors.tsx` | dead | parallel vendors UI |
| ~20 more `sections/*` (role-builder, module-registry, access-control, approval-designer, org-structure, security, billing, analytics, reports, automation-dashboard, cost-allocation, policies…) | — | thin duplicate pages shipped instead |
| `lib/revops/*` (parallel impl, only tests import it; schema drifted) | — | dead |
| `project-fit` suggestions + `assignment-service` | — | in-memory store never populated → always `[]` |
| `admin_leave_requests` table | — | created but never written; AI query reads it → "nobody on leave" forever |

Consequence: some of the most ERPNext-like capabilities (procurement GRN/3-way
match, stock transfers, lots/serials UI, valuation, timesheet-billing trigger,
price lists, real report engine) are unreachable from the app.

### Dead-end APIs

- `/api/tenant/modules`: POST real; GET returns `{data:[]}`, PATCH fabricates, DELETE deletes nothing — module toggles are a lie.
- `/api/tenant/analytics` POST: mints `rep-*`/`exp-*` "reports" that exist only as audit-log rows — phantom report system.
- `/api/projects/timesheet-billing`, `/api/procurement/*`, `/api/inventory/{stock-movements,stock-transfers,products,lots,serials,valuation}`, `/api/pos/price-lists`: all real, zero UI consumers.
- `/api/hr/training`: GET returns `{[]}`, no POST — the service's createTrainingSession 405s.
- `hr/reports` service methods POST to GET-only routes → 405s.

### Duplicated / divergent surfaces

- **Two admin areas**: `tenant-admin/admin/{access,audit,billing,health,integrations,structure,users}` (real) vs nav-linked `tenant-admin/{settings,users,audit,health}` (different impls).
- **Three PO stacks**: legacy `/api/purchases/orders` (JSON items, what the UI uses) · canonical `finance/purchase-orders` (normalized items + approvals) · `api/procurement` facade — all write `purchase_orders` differently.
- **Two inventory APIs** on `inventory_products`; **two audit systems** (`admin_audit_logs` + `audit_logs` + 4 fragment trails); **two notification stacks** (`lib/notify/*` durable vs legacy in-memory `lib/notifications.ts`); **two automation engines** (real `automation_rules` engine vs dead `rule-engine.ts`/`event-bus.ts`); **two payroll generators** (`/api/tenant/payroll/run` vs `/api/hr/payroll` — divergent features).
- **`/crm/*` top-level pages** duplicate tenant-admin CRM — and three of them are broken (below).
- **`crm_customers` vs `finance_customers`** — unlinked parallel customer masters.

### Operational

- `/api/cron/automation` is the drain point for the action queue, scheduled
  reports, notification outbox, scheduled events — **if no external cron hits
  it, automation silently does nothing**. Verify a crontab entry exists on the VPS.
- Non-atomic payroll approve/pay: JE posts, then separate UPDATE — failure
  leaves orphan JE + duplicate posting on retry.

---

## 2. Module-by-module

### CRM — ~70% real

- **Real**: `sections/crm-dashboard.tsx` (2,400 lines) — leads/contacts/customers/deals/activities fully wired; CRUD, bulk ops, lead→customer/deal conversion, deal won→`crm_customers` + draft `finance_invoice` + GL receivable. `lib/crm/*` is solid.
- **Broken**: `/crm/contacts`, `/crm/accounts`, `/crm/deals` render dead (components get no `tenantSlug` → every fetch 400s, silently empty); contacts/accounts PATCH never sends `tenantSlug` → 400s; accounts POST drops contact data (shape mismatch); `NewLeadModal` marks region/branch "optional" but API requires them; `crm/leads/LeadsPage.tsx` dead duplicate.
- **Mismatches**: activities feed renders audit-log fields on task-feed rows; dashboard declares `{stage,value}` vs API `{stage,count}`; `lostReasons`/`revenueByOfficer`/`reminders`/`tasks`/`engagements` always `[]`; seed data writes invalid lead stages.
- **Gaps vs ERPNext CRM**: no Opportunity line-items, no `lost_reason` (dashboard slot exists!), no Prospect doc, no Sales Person master/commission link, hardcoded Lead Source (a real `revops_lead_sources` table is disconnected), no Appointment/Contract/Newsletter/Email Group, no Address doc, no CRM report suite, no communication threading.

### RevOps — ~10% reachable

- 5 stub pages (heading only). **55KB `revops-workspace.tsx` + marketing-sales-dashboard are orphaned**; all `/api/revops/*` routes are real (campaigns, attribution, forecasting, sales-performance, enablement on 8 real tables).
- Bugs: snapshot name resolution queries `admin_employees.full_name` (column is `name`) → falls back to raw IDs; attribution math is synthetic (even-split, heuristic scoring); forecasting treats missing `expected_close_date` as in-period.

### Sales & Procurement — ~45%

- **Sales orders**: CRUD works; but edit silently drops customer/date/items (API only accepts status/dueDate/notes); **no status control anywhere → `fulfillOrder` (→ invoice + GL) never fires for manual orders**; no stock decrement on fulfillment; dashboard cards hardcode `0`; view modal renders hardcoded "Sample Product".
- **Buying**: backends ~60% real (requisitions, goods-receipts → stock + JE, 3-way match) but **headless** — the only UIs drive the weakest legacy stack. `sections/procurement.tsx` dead. PO edit 405 (page PATCHes `/api/purchases/orders/[id]` which only exports DELETE); supplier edit 405 (same class of bug); create-PO modal has **hardcoded supplier dropdown ("1"/"2"/"3") and a dead Add-Item button** → every UI PO has no items, total 0.
- **Returns**: real (approval gate → credit/debit note JE + optional restock), ~65% of ERPNext.
- **Gaps**: no Quotation→SO→Delivery Note→Invoice chain, no RFQ/Supplier Quotation/Scorecard/Material Request UI, triplicated PO stack needs consolidation to the canonical finance model.

### Inventory / Stock — ~50%

- **Real**: item CRUD + bulk upsert, hierarchical warehouses + per-warehouse balances, landed cost (real: allocation + moving-average unit cost + JE), `stock_movements` (negative-stock enforcement, warehouse balances, movement JEs, low-stock events).
- **Headless**: transfers, lots, serials, valuation report — API-only since `sections/inventory.tsx` is unmounted; `tenant-admin/inventory` is a stub.
- **Gaps**: movements are an event log, not immutable SLE (no running `qty_after`/`valuation_rate`, no backdated reposting); no Item Group/UOM/variants/barcodes; no Stock Entry/Reconciliation/Pick List/Reservation docs; valuation inconsistent (`sale_price` in list vs `unit_cost` in valuation).
- **Bug**: `stock_movements.quantity` is integer but WO/BOM quantities are numeric → fractional qty errors.

### POS — ~85% (deepest module)

- Excellent: idempotent sale engine with saga compensation, server-side price/promo/VAT resolution, split tenders, serial/lot capture, shifts with expected-cash + variance tolerance + mandatory reason, offline queue, ESC/POS print, returns, held orders, cash movements, audit log.
- **Gaps**: POS Profile config is read-only blob (no write API/UI); price lists unreachable (lib+API exist, POS never sends `priceListId`); **shift variance not journaled** to a difference account.
- Storefront ~70%: real catalog/checkout/tracking/confirm→SO+stock+invoice. Bug: serial-tracked item discovered mid-loop leaves orphaned `sales_orders` row (pre-validate first).

### HR & Payroll — ~55%

- **Real**: employee CRUD + status machine + CSV import + portal invite; departments w/ budget/cost-center; attendance (geo+QR, late-vs-grace, remote days, flagging); leave (versioned policies, accrual, balances enforced on all paths); recruitment (requisitions→candidates→interviews→offers→hire w/ seeded onboarding + portal creds); offboarding checklist w/ enforced completion; performance (cycles/goals/AI appraisals + peer feedback); shifts; staff reports/tasks (richer than ERPNext); employee portal ~80% complete.
- **Payroll → GL: real** — approve posts Dr 6300 / Cr 2300/2320/2330/2340/2310; pay posts Dr 2300 / Cr 1100.
- **Critical**: **statutory preset double-write hazard** — `/api/tenant/payroll/statutory` NG preset writes *monthly* bands and doesn't touch `paye_annualize`/`paye_relief`/employer contribs. If the finance NG pack was applied first, saving the preset leaves `annualize=true` with monthly bands → **~12× over-taxation**. Compliance check recomputes monthly → false-positives on correct annualized entries.
- **More bugs**: two payroll generators diverge (UI path skips unpaid-leave + employee components); `invited` employees get payslips; employer NSITF/ITF post into employee-residual 2310; non-atomic approve/pay; `getPayrollEntries` lacks tenant predicate; portal `admin_employee_expenses` never reaches GL/'paid'; calendar-day leave vs 21.67 working-day deduction over-deducts; `carryover_cap` is inert (no rollover job); training is a stub.
- **Gaps**: no Salary Structure/formula engine/Salary Slip docs, no Holiday List, no Compensatory Leave/Leave Period/encashment/half-day, no Gratuity/Loans/Employee Benefits, no Transfer/Promotion docs, no Staffing Plan, no KRA templates.

### Projects — ~45% (reads systematically corrupted)

- **Critical bug**: `lib/projects/db.ts` uses `db.query` (raw snake_case) but `toProjectResponse`/stats/task mapping read camelCase → **every project renders $0 budget, no dates, "Unassigned", DRAFT**; assignments POST 500s (`task.projectId` undefined → NOT NULL violation).
- **Critical**: `projects/tasks/page.tsx` parses tenant from `pathname.split('/')[2]` = literal `"projects"` → **403 always in prod**; task creation always 400s (`workstreamId` required, modal sends null).
- Real underneath: projects/tasks/workstreams/team/time-logs(billable)/budgets/timesheet-billing→finance-invoice (headless).
- **Bugs**: `project_reports` text↔uuid join likely 500s; `project_invoices` is a GL-less shadow table; report metrics hardcoded (100/0/0); pdf/xlsx export emits CSV; progress is a status→% lookup.
- **Gaps**: no Timesheet doc w/ approval + per_billed, no Activity Type/Cost masters, no task dependencies/Gantt, no Project Template, no costing/profitability rollup.

### Manufacturing — ~40%

- **Real**: multi-level BOM w/ recursive explode + cycle detection + scrap %; WO lifecycle; batch-run WO fan-out; subcontracting (the ONLY path correctly using `recordStockMovement` + `postGLEntry`); quality inspection records; MRP (ephemeral, optional requisition generation).
- **Critical**: **in-house WO stock bypasses the ledger** — release/complete/cancel mutate `current_stock` directly, no movement rows, no warehouse/lot, clamps to 0 → `stock_movements` permanently diverges from `current_stock`; lot numbers never reach `lot_stock`.
- **Critical**: **WIP JEs are imbalanced over time** — labor+OH credited out of 1300 at completion but never debited in → 1300 drifts negative; JE amount can diverge from clamped stock change; JEs posted as `referenceType:"manual"`.
- **More**: `consumeMaterial` touches no stock; unconsumed material never returned on close (phantom shrinkage); `releaseWorkOrder` explodes the *active* BOM ignoring `wo.bomId`; swallowed cost errors → WIP JE silently skipped; ops update/consume are API-only.
- **Gaps**: no Production Plan doc, Job Card, Workstation/Operation/Routing masters, Item Alternative, BOM Update/Creator, serial/batch into stock, Quality Action/Feedback/readings, scrap output, partial production.

### Automation — split verdict

- **Rule engine: REAL** (~75%) — `automation_rules` → nested condition eval → audit rows → `automation_action_queue` → connectors (webhook/email/notify/task/attendance-flag, policy-gated) → deduped scheduled events → cron drain. All 9 advertised triggers have emitters.
- **Workflows: FAKE** — `executeWorkflow` inserts `status='running', execution_history='[]'` and returns success; **nothing ever advances steps or evaluates conditions**. History page lists eternally-`running` rows. This is the biggest single gap vs ERPNext's `apply_workflow` document state machine.
- **Bugs**: rules UI offers action types `notify|webhook|email|task` but API requires `notify:log|webhook:post|email:send|task:create` → **every UI-created rule 400s**; template paths `payload.*` don't match evaluator; dead `rule-engine.ts`/`event-bus.ts` wiring (wildcard never fires); workflows page has dead Run/Edit/Delete buttons + NaN% bug; "Policies" page shows rules not policies; overview page has hardcoded CPU/uptime metrics.
- Admin area ~80% real (roles/RBAC/users/org/approvals/security-posture/integrations/billing/onboarding) — but security policies are stored-not-enforced; audit is opt-in admin-plane only (business writes never reach `admin_audit_logs`).

### Analytics / Reports — ~40% (weakest)

- `analytics/{financial,sales,hr}` pages are **hardcoded mock numbers** — the real `api/tenant/hr/analytics` is orphaned.
- A genuinely real report engine exists (`lib/reporting`: `reports`/`report_jobs`, `executeReport` per-module SQL, scheduled queue with `skip locked`) — **but the admin UI shows the phantom audit-log reports instead**.
- Settings: only `currency` is consumed; other toggles cosmetic. Custom fields real but only mounted in 4 modals.

### Notifications — ~70%

- Durable `lib/notify/*` (DB outbox, rules API, per-event templates, preferences, ~20 emit sites) + legacy in-memory stack. Fixed event catalog, no user-editable templates, no generic per-doctype alert builder.

---

## 3. Ranked fix list

**P0 — correctness/security, do first**
1. `lookupVendor` tenant predicate + remove `SAMPLE_VENDORS` fallback (S1)
2. Auth-gate `/api/tenant/user/{permissions,modules}`; strip `_debug` (S2)
3. Bind `tenantSlug` to session on `/api/tenant/*` handlers (S3); add tenant predicates to `updateOperation`/`addBomLine`/`removeBomLine` (S5); auth-before-fetch in crm `[id]` routes (S7)
4. Portal payslips `status` filter (S6)
5. Fix NG statutory double-write (make payroll preset write the same fields as `seedNigeriaPack`, or read-only display) + compliance check honoring `paye_annualize`
6. Projects: normalize reads through camelizing path (one sweep fixes stats/list/tasks/assignments); fix tasks page tenant source; fix task-creation workstreamId
7. Work orders: route stock through `recordStockMovement`; post labor/OH into WIP; pre-validate serials in storefront confirm
8. Sales: add status control to orders UI; fix suppliers/PO PATCH routes; fix PO modal (real supplier select + Add-Item onClick); stop silent field drops on SO edit
9. Webhook connector URL allowlist (S4); atomic payroll approve/pay

**P1 — reach the built value**
10. Mount `revops-workspace`/`it-support-workspace`/`marketing-sales-dashboard` at their routes (or delete stubs); mount `sections/procurement.tsx` for GRN/3-way-match; wire inventory UI to stock-movements/transfers/lots/serials/valuation
11. Fix rules-UI action-type values so rules can be created; fix `payload.*` template paths
12. Wire analytics pages to real APIs (hr analytics + `lib/reporting` engine); kill phantom `rep-*` reports
13. Either implement the workflow state machine (`admin_workflows` steps/conditions/transitions) or remove the fake execute affordance
14. Fix `/api/tenant/modules` GET/PATCH/DELETE or remove
15. Wire timesheet-billing trigger; fix `project_reports` join typing; delete `project_invoices` shadow or give it GL

**P2 — parity depth**
16. `lost_reason` on `crm_deals` + wire revops_lead_sources into leads; unify `crm_customers`/`finance_customers`
17. PO consolidation onto `finance/purchase-orders`; journal POS shift variance; POS profile config UI + price lists
18. Leave carryover job + Holiday List; unify employee expenses → GL settlement; salary-structure engine
19. Job Card/Production Plan/serial-batch-into-stock; task dependencies/Gantt; Opportunity line-items + CRM reports suite
20. Generic per-doctype notification rules + user-editable templates; audit coverage for business writes; per-doctype report builder UI

## 4. Verified-healthy areas (no action needed)

Canonical GL + finance tranches, POS engine, employee portal, durable
notifications, recruitment pipeline, automation rule engine execution path,
RBAC/org/onboarding, landed cost, subcontracting stock+GL, bank clearance,
tax packs, process logs — all real and tenant-scoped.
