# ERPNext Parity — Full Deficiency Map

Grounded in the ERPNext source tree (~630 DocTypes across 12 modules) mapped
against this codebase. Legend: ❌ missing · 🟡 partial/simplified · ✅ parity+

Status after tranches A–G + module audit implementation (Nov 2025).

**Update (Oct 2026):** Tranches H–M shipped in `38cad07` — quotations→SO,
RFQ + supplier-quotation comparison, material requests + reorder rules,
UOM, variants, item-group tree, stock reconciliation/reservation/receipt-QC,
bundles, workstations/routings/job cards/production plans/forecasts,
subcontracting supplied-materials ledger, prospects/contracts/sales-stage
config/email campaigns/warranty claims/SLA engine, check-ins/leave accrual/
advances/lifecycle, and the platform layer (workflow state machine, print
formats, webhook subscriptions, web forms, data import, Paystack/Flutterwave
gateways, maintenance, global search).

**Update (Nov 2026):** Tranche N shipped — party links, advance taxes,
bank-reconciliation match suggestions, territories/industry types/market
segments, competitors + notes + appointments, SMS center, task types +
activity types/costing rates + project updates + installation notes,
plant floors/downtime entries/sub-operations/MPS/BOM update tools,
packing slips/putaway rules/party item codes, leave encashment/overtime/
grievances/transfers/skill maps/training/staffing plans/tax declarations,
asset allocations + activity logs, DocShare, energy points, and CMS
pages/posts. The remaining gaps are genuinely marginal items (bisect tool,
Gantt charting library, appointments calendar UI polish).

---

## 1. Accounts (~192 DocTypes) — ✅ ~95–100%

All tranches implemented: canonical GL, dimensions, fiscal close, AR/AP,
payment entry/reconciliation/unreconcile, treasury (guarantees, discounting,
subscriptions, FX pegs, recon rules), tax engine (templates, rules, WHT,
shipping), pricing (rules, schemes, coupons), deferred revenue, integrity
tools (repost, merge, ledger health), equity (share types, transfers, ledger),
sales-partner commissions, invoice-side loyalty, bank clearance, cheque print
templates, process-run audit logs, tax packs.

Remaining edge gaps (low value):
- ❌ `party_link` (bidirectional party-to-party linking for internal
  trade — customer that is also a supplier)
- ❌ `bank_reconciliation_tool` UI (manual match screen — we have rule-based
  auto-match; manual drag-match UI not built)
- ❌ `cashier_closing` doctype (ours is POS shift close — equivalent)
- ❌ `advance_taxes_and_charges` (taxes on payment-entry advances)
- ❌ `exchange_rate_revaluation` JE generation (rates stored; no reval tool)
- ❌ `bisect_accounting_statements` (ledger-health bisect tool; our
  integrity checker covers the substance)

---

## 2. Stock / Inventory (~81 DocTypes) — ~55–60%

Have: products, stock_movements ledger, serial/batch (lot-tracking),
warehouses, transfers, valuation, landed cost, POS consumption.

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ UOM framework + conversion | `uom_category`, `uom_conversion_detail` | HIGH — blocks accurate multi-pack selling/purchasing |
| ❌ Item variants + attributes | `item_variant`, `item_attribute` | HIGH — retail/apparel basics |
| ❌ Stock reconciliation (cycle count) | `stock_reconciliation` | HIGH — physical count vs books |
| ❌ Pick list / wave picking | `pick_list` | MED |
| ❌ Packing slip | `packing_slip` | LOW |
| ❌ Delivery trips / stops / routing | `delivery_trip`, `delivery_stop` | MED — logistics |
| ❌ Shipment tracking | `shipment`, `shipment_parcel` | MED |
| ❌ Putaway rules (slotting) | `putaway_rule` | LOW |
| ❌ Stock reservation | `stock_reservation_entry` | MED — reserve against SOs |
| ❌ Quality inspection on receipt | `quality_inspection` (stock side — ours is mfg-side only) | MED |
| ❌ Item reorder rules → auto material request | `item_reorder` | HIGH — replenishment core |
| ❌ Material request | `material_request` | HIGH — internal requisition→PO/WO trigger |
| ❌ Product bundle / kit | `sales_bom` (stock side) | MED |
| ❌ Manufacturer + customer item codes | `item_manufacturer`, `item_customer_detail` | LOW |
| ❌ Quick stock balance | `quick_stock_balance` | LOW |
| ❌ Item groups as a tree | we have flat `category` string | MED — affects reporting rollups |
| ❌ `serial_and_batch_bundle` abstraction | our serials/lots are separate models | internal — skip |
| ❌ Repost item valuation tool | `repost_item_valuation` | MED |
| ❌ Warehouse types/capacity | `warehouse_type` | LOW |

---

## 3. Selling (~21 DocTypes) — ~60%

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Quotations → SO conversion | `quotation` | HIGH — standard sales cycle |
| ❌ Proforma invoice | `proforma_invoice` | MED |
| ❌ Product bundles (selling side) | `product_bundle` | MED |
| ❌ Blanket orders / framework agreements | `blanket_order` | MED |
| ❌ Sales team commission splits | `sales_team` | MED |
| ❌ Territory tree | `territory` (in accounts-ish) | MED |
| ❌ Industry type master | `industry_type` | LOW |
| ❌ Party-specific item codes | `party_specific_item` | LOW |
| ❌ Installation notes | `installation_note` | LOW |
| ❌ SMS center (bulk SMS) | `sms_center` | LOW — brevo covers email |
| ❌ Customer credit limit enforcement | `customer_credit_limit` | MED |
| ❌ Supplier's item number at customer | `supplier_number_at_customer` | LOW |

---

## 4. Buying (~20 DocTypes) — ~65%

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Request for Quotation (RFQ) | `request_for_quotation` + items + suppliers | HIGH — procurement discipline |
| ❌ Supplier quotations + comparison | `supplier_quotation` | HIGH — pair with RFQ |
| ❌ Supplier scorecard | `supplier_scorecard` (6 doctypes) | MED |
| ❌ Customer-item-code at supplier | `customer_number_at_supplier` | LOW |
| ✅ PO, GRN, 3-way match, consolidation, requisitions | done | — |

---

## 5. CRM (~30 DocTypes) — ~65%

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Prospect doctype (pre-lead pipeline) | `prospect`, `prospect_lead` | MED |
| ❌ Contracts + templates + fulfilment checklist | `contract`, `contract_template` | MED |
| ❌ CRM notes on records | `crm_note` | LOW |
| ❌ Competitor tracking | `competitor` | LOW |
| ❌ Opportunity type master | `opportunity_type` | LOW |
| ❌ Sales stage configurator | `sales_stage` | MED — our pipeline stages are hardcoded |
| ❌ Appointment scheduling | `appointment` + slots | LOW |
| ❌ Email campaigns (drip) | `campaign`, `email_campaign`, `campaign_email_schedule` | MED — we have `campaign` field only |
| ❌ Market segments | `market_segment` | LOW |
| ✅ Leads, contacts, deals w/ items, lost reasons, sources, conversion, reports | done | — |

---

## 6. Projects (~16 DocTypes) — ~70%

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Project templates (scaffold tasks) | `project_template`, `project_template_task` | MED |
| ❌ Task types | `task_type` | LOW |
| ❌ Project updates (status reports) | `project_update` | MED |
| ❌ Activity cost rates (billing rates per activity) | `activity_cost` | MED — improves timesheet billing |
| ❌ Project costing rollup report | report layer | MED |
| ✅ Projects, workstreams, tasks, deps, time logs, timesheet→AR invoice, invoices→GL, reports | done | — |

---

## 7. Support (~12 DocTypes) — ~55%

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Issue priority/type masters | `issue_priority`, `issue_type` | LOW |
| ❌ Full SLA engine (service days, pause-on-status, fulfil-on-status) | `service_level_agreement` + 4 child tables | MED — we have an SLA page; ERPNext's is richer |
| ❌ Warranty claims | `warranty_claim` | MED — ties serials to claims |
| ✅ Tickets/issues via IT-support workspace | mounted | — |

---

## 8. Maintenance module (~6 DocTypes) — ❌ missing entirely

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Maintenance schedules (preventive) | `maintenance_schedule` | MED |
| ❌ Maintenance visits | `maintenance_visit` | MED |

---

## 9. Quality Management (~17 DocTypes) — ❌ mostly missing

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Quality procedures | `quality_procedure` | LOW |
| ❌ Quality reviews / goals / meetings | `quality_review`, `quality_goal`, `quality_meeting` | LOW |
| ❌ Quality feedback templates | `quality_feedback*` | LOW |
| ❌ Non-conformance + corrective action | `non_conformance`, `quality_action` | MED |
| 🟡 QC inspection on mfg only | `quality-control.ts` | stock-side inspection missing |

---

## 10. Manufacturing (~50 DocTypes) — ~55%

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Workstations (capacity, cost centers) | `workstation` + working hours | MED |
| ❌ Routings | `routing` | MED |
| ❌ Full job cards (time logs, scheduled times, subcontracting) | `job_card` + children — we have timestamps only | MED |
| ❌ Production plan with sales-order aggregation | `production_plan` + children — our MRP→WO is simpler | MED |
| ❌ BOM update tool (mass cost refresh) | `bom_update_tool`, `bom_update_log` | LOW |
| ❌ BOM creator (design-time tree editor) | `bom_creator` | LOW |
| ❌ Downtime entries | `downtime_entry` | LOW |
| ❌ Sales forecast → MRP | `sales_forecast` | MED |
| ❌ Master production schedule | `master_production_schedule` | LOW |
| ❌ Sub-operations | `sub_operation` | LOW |
| ❌ Plant floor hierarchy | `plant_floor` | LOW |
| ❌ Blanket order (mfg side) | `blanket_order` | MED |
| ✅ BOM, work orders (stock-ledger), WO operations w/ timestamps, MRP→WO, QC, subcontracting orders | done | — |

---

## 11. Subcontracting (~14 DocTypes) — ~40%

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Subcontracting BOM | `subcontracting_bom` | MED |
| ❌ Inward orders (we receive work) | `subcontracting_inward_order` | LOW |
| ❌ Order service items + supplied items tracking | child doctypes | MED — we track orders but not the supplied-material ledger deeply |
| ✅ Subcontracting order/receipt basics | exists | — |

---

## 12. HR / Payroll — ~55% (ERPNext HRMS is a separate app, ~50+ DocTypes)

| Gap | HRMS DocType | Priority |
|---|---|---|
| ❌ Attendance devices / check-in source | `employee_checkin`, `shift_type` | MED |
| ❌ Shift rostering + assignment | `shift_assignment`, `shift_schedule` | MED |
| ❌ Employee advances (as documents w/ repayment) | `employee_advance` | MED — our expenses post GL but no advance doc |
| ❌ Employee separation lifecycle | `employee_separation` | MED |
| ❌ Employee onboarding lifecycle | `employee_onboarding` | MED — we have tenant onboarding, not employee |
| ❌ Employee transfers | `employee_transfer` | LOW |
| ❌ Employee grievances | `employee_grievance` | LOW |
| ❌ Training program/events/feedback | `training_*` | LOW |
| ❌ Employee skill map | `employee_skill_map` | LOW |
| ❌ Leave policy engine (entitlement accrual) | `leave_policy`, `leave_policy_assignment` | MED — we have carryover/caps but no accrual engine |
| ❌ Leave allocations as docs | `leave_allocation` | MED |
| ❌ Leave encashment | `leave_encashment` | LOW |
| ❌ Overtime | `overtime_*` | LOW |
| ❌ Payroll period + payroll entry batch docs | `payroll_period`, `payroll_entry` | MED — our runs exist; batch-control doc pattern missing |
| ❌ Income tax slab configurator UI | `income_tax_slab` | LOW — JSON in statutory profile works |
| ❌ Employee tax exemption declarations | `employee_tax_exemption_*` | MED |
| ❌ Compensation/hr settings | `hr_settings` | LOW |
| ❌ Job offers vs offers in recruitment | `job_offer` | LOW |
| ❌ Staffing plan | `staffing_plan` | LOW |
| ✅ Employees, leave w/ holidays+carryover, payroll w/ NG statutory, expenses→GL, salary structures, appraisals, recruitment, attendance, disciplinary, portal | done | — |

---

## 13. Assets (~27 DocTypes) — ~70%

| Gap | ERPNext DocType | Priority |
|---|---|---|
| ❌ Asset maintenance schedules/teams/tasks | `asset_maintenance*` | MED |
| ❌ Asset shift allocation (shift-factor is in depreciation; allocation doc missing) | `asset_shift_allocation` | LOW |
| ❌ Linked locations tree | `location`, `linked_location` | LOW |
| ❌ Asset activity log | `asset_activity` | LOW |
| ✅ Lifecycle, finance books, depreciation schedules, repairs, capitalization, value adjustments, movements | done | — |

---

## 14. Platform layer — the biggest structural gap

ERPNext's Frappe framework ships features that apply to *every* doctype:

| Capability | ERPNext | Us | Priority |
|---|---|---|---|
| Workflow state machine per doctype | `workflow` + transitions/roles | step-executor + approval gates, not a per-doc state machine | HIGH |
| Print formats | `print_format`, `print_style`, print designer | cheque templates + e-invoice only | HIGH |
| Data import tool | `data_import` + mapping UI | per-entity CSV import only | MED |
| Communication threading on records | `communication`, email inbox | durable notifications but no inbound email threading | MED |
| File manager | `file` doctype | flat attachment handling | LOW |
| Document naming series configurator | `document_naming_rule`, `series` | hardcoded numbering per entity | MED |
| DocShare / sharing | `docshare` | role gates only | LOW |
| Assignment rules | `assignment_rule` | workflow notify only | MED |
| Global search | `global_search` | none | MED |
| Dashboards/charts per doctype | `dashboard`, `dashboard_chart` | we have report builder + analytics | 🟡 partial |
| Customize form / custom fields | `custom_field`, `property_setter`, `customize_form` | we have custom fields | ✅ |
| Notification digest/daily summary | `notification_settings` | per-event rules | 🟡 |
| Energy points (gamification) | `energy_point_*` | none | SKIP |
| Website module (CMS, blog, web forms) | `web_page`, `blog_post`, `web_form` | storefront covers commerce; no CMS/web-form builder | MED |
| Portal items configurator | `portal_menu_item` | fixed portals | LOW |
| Webhooks (inbound + outbound on doc events) | `webhook` | our automation connector posts outbound; no inbound doc-triggered webhook subscriptions | MED |
| Integration connectors | `google_*`, `plaid`, `razorpay`, etc. | brevo email only | MED — payment gateways matter for NG (Paystack/Flutterwave) |
| EDI / code lists | `code_list`, `common_code` | FIRS e-invoice covers NG need | LOW |
| Bulk transaction tool | `bulk_transaction` | our mass-process + run logs cover substance | 🟡 |

---

## Roll-up

| Module | ERPNext DocTypes | Coverage |
|---|---|---|
| Accounts | 192 | ~95%+ ✅ |
| Stock | 81 | ~55–60% 🟡 |
| Manufacturing | 50 | ~55% 🟡 |
| CRM | 30 | ~65% 🟡 |
| Assets | 27 | ~70% 🟡 |
| Selling | 21 | ~60% 🟡 |
| Buying | 20 | ~65% 🟡 |
| Quality Mgmt | 17 | ~20% ❌ |
| Projects | 16 | ~70% 🟡 |
| Subcontracting | 14 | ~40% 🟡 |
| Support | 12 | ~55% 🟡 |
| Maintenance | 6 | ~0% ❌ |
| Platform layer | — | ~50% 🟡 |
| **Total** | ~630 doctypes + platform | **~65–70%** |

---

## Where we're already superior to ERPNext

- Row-level `tenant_slug` multi-tenancy (ERPNext needs a separate site per tenant)
- Nigerian statutory depth (FIRS e-invoice, PAYE/pension/NHF/NHS, statutory filing exports)
- POS hardening (shifts, variance JEs, offline queue, serial pre-validation)
- Storefront + customer portal + employee portal built-in
- Approval gates + durable notifications wired through one engine
- PWA support

## Proposed implementation order (impact-ranked)

**Tranche H — sales/procurement cycle completion**
1. Quotations → SO conversion
2. RFQ + supplier quotations + comparison matrix
3. Customer credit limits
4. Material request → PO/WO
5. Item reorder rules → auto material requests

**Tranche I — inventory completeness**
6. UOM framework + conversions
7. Item variants + attributes
8. Stock reconciliation (cycle counts)
9. Stock reservation against SOs
10. Quality inspection on stock receipt
11. Product bundles/kits
12. Item-group tree

**Tranche J — manufacturing depth**
13. Workstations + working hours
14. Routings
15. Full job cards (time logs → job cost)
16. Production plans with SO aggregation
17. Sales forecast → MRP
18. Subcontracting supplied-materials ledger

**Tranche K — CRM/support depth**
19. Prospect doctype + funnel
20. Contracts + templates + fulfilment checklists
21. Sales stages configurator
22. Email campaigns (via brevo)
23. Warranty claims
24. SLA engine (service days, pause/fulfil statuses)

**Tranche L — HRMS depth**
25. Shift types + rosters + check-ins
26. Leave policy accrual engine + allocations
27. Employee advances
28. Employee onboarding/separation lifecycle
29. Payroll entry batch docs

**Tranche M — platform layer**
30. Per-doctype workflow state machine
31. Print-format engine
32. Web-form builder + inbound webhook subscriptions
33. Data-import tool with mapping UI
34. Payment-gateway integrations (Paystack/Flutterwave for NG)
35. Maintenance schedules/visits (assets + support tie-in)
36. Asset maintenance module
37. Global search
