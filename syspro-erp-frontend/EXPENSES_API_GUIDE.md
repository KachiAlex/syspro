# Expenses API & Accounting Integration Guide

## API Endpoints (REST)

### Expense CRUD Operations

```
GET    /api/expenses
       Query params: 
         - date_from: YYYY-MM-DD
         - date_to: YYYY-MM-DD
         - category_id: string
         - department_id: string
         - approval_status: draft|pending|approved|rejected
         - payment_status: unpaid|paid|reimbursed|pending_payment
         - search: string (ID, description, vendor)
       Response: 
       {
         data: Expense[],
         total: number,
         page: number,
         per_page: number
       }

GET    /api/expenses/:id
       Response: Expense (with full approval history, audit trail)

POST   /api/expenses
       Body: {
         expenseDate: ISO date,
         amount: number,
         taxType: "none" | "vat" | "wht",
         category_id: string,
         type: "vendor" | "employee_reimbursement" | "cash" | "prepaid",
         vendorId?: string,
         departmentId: string,
         projectId?: string,
         description: string,
         notes?: string,
         receiptUrls?: string[]
       }
       Response: Expense (status: draft)
       Error: 422 if required fields missing

PATCH  /api/expenses/:id
       Body: Partial<Expense>
       Response: Expense
       Constraint: Only draft/pending expenses can be edited

DELETE /api/expenses/:id
       Response: { success: true }
       Constraint: Only draft expenses can be deleted
```

### Expense Submission & Approval

```
POST   /api/expenses/:id/submit
       Body: {
         notes?: string,
         attachments?: string[]
       }
       Action: Transition from draft → pending
       Response: Expense (status: pending)
       Trigger: Approval workflow initiation

POST   /api/expenses/:id/approve
       Body: {
         approverRole: "manager" | "finance" | "executive",
         reason?: string
       }
       Response: Expense
       Side Effects:
         - Add approval record
         - If all required approvals complete: create journal entry
         - Update status to approved if no more approvals needed
       Constraint: User must have required approval authority

POST   /api/expenses/:id/reject
       Body: {
         reason: string (required)
       }
       Response: Expense (status: rejected)
       Action: Trigger notification to submitter

POST   /api/expenses/:id/request-clarification
       Body: {
         question: string,
         requiredBy?: ISO date
       }
       Response: Notification to submitter
       Action: Expense status remains pending, awaits response
```

### Approval Workflow Logic

```
APPROVAL ROUTING RULES:

Amount ≤ ₦50,000:
  Required Approvers: Manager
  Route: Manager approval → Auto-approve (if manager approves)
  GL Entry: Posted immediately on manager approval

₦50,001 - ₦500,000:
  Required Approvers: Manager, Finance
  Route: Manager → Finance (sequential)
  GL Entry: Posted after final approval

> ₦500,000:
  Required Approvers: Manager, Finance, Executive
  Route: Manager → Finance → Executive (sequential)
  GL Entry: Posted after executive approval

OVERRIDE SCENARIOS:
  - Out-of-policy expenses: Require +1 level approval
  - Policy violation flagged: Escalate to Executive regardless of amount
  - Multiple rejections: Require Finance review before resubmission

STATE MACHINE:
DRAFT
  ↓ [Submit]
PENDING (awaiting manager)
  ├→ [Manager Approves & ≤₦50K] → APPROVED ✓
  ├→ [Manager Approves & >₦50K] → PENDING (awaiting finance)
  │   ├→ [Finance Approves & ≤₦500K] → APPROVED ✓
  │   ├→ [Finance Approves & >₦500K] → PENDING (awaiting executive)
  │   │   └→ [Executive Approves] → APPROVED ✓
  │   └→ [Finance Rejects] → REJECTED ✗
  ├→ [Manager Rejects] → REJECTED ✗
  └→ [Manager Requests Clarification] → PENDING (awaiting user response)

APPROVED
  ├→ [GL Posted] → GL_POSTED
  └→ [Payment Linked] → PAYMENT_LINKED
     └→ [Payment Marked Paid] → PAID
```

### Payment Linking

```
POST   /api/expenses/:id/link-payment
       Body: {
         paymentId: string
       }
       Response: Expense (linkedPaymentId set)
       Validation: Payment amount must match expense total

POST   /api/expenses/:id/mark-paid
       Body: {
         paymentDate: ISO date,
         paymentMethod: string,
         referenceNo: string
       }
       Response: Expense (paymentStatus: paid)
       Side Effects: Update GL if prepaid/accrual

POST   /api/expenses/:id/unlink-payment
       Response: Expense (linkedPaymentId removed)
       Constraint: Only unpaid expenses
```

### Receipts & Attachments

```
POST   /api/expenses/:id/upload-receipt
       Form-data: { file: File }
       Return: { url: string, filename: string, size: number, uploadedAt: ISO date }
       Validation:
         - Max 10 MB per file
         - Accepted: PDF, PNG, JPG, GIF
         - Max 5 receipts per expense

DELETE /api/expenses/:id/receipts/:receiptId
       Response: { success: true }
       Constraint: Only draft/pending expenses
```

### Reimbursements (Employee Expenses)

```
POST   /api/reimbursements
       Body: {
         employeeId: string,
         expenseIds: string[],
         memo?: string
       }
       Response: Reimbursement
       Actions:
         - Mark expenses as type: employee_reimbursement
         - Create payable to employee (GL entries)
         - Send notification to finance

PATCH  /api/reimbursements/:id/approve
       Body: { approvedBy: string }
       Response: Reimbursement (status: approved)
       GL Entry:
         Dr. 2050 - Employee Payable  ₦X
         Cr. 1010 - Bank/Cash         ₦X

POST   /api/reimbursements/:id/process
       Response: Reimbursement (status: paid)
       GL Entry: Same as above (if not already posted)
       Side Effect: Mark all linked expenses as paymentStatus: reimbursed

POST   /api/reimbursements/:id/batch-process
       Body: { reimbursementIds: string[] }
       Response: { processed: Reimbursement[], failed: string[] }
       Use Case: End-of-month reimbursement batch
```

### Dashboard & Reporting

```
GET    /api/expenses/dashboard/metrics
       Response: {
         totalExpenses: number,
         approved: number,
         pending: number,
         byCategory: {
           id: string,
           name: string,
           amount: number,
           count: number
         }[],
         budgetStatus: {
           period: string,
           allocated: number,
           consumed: number,
           remaining: number,
           percentage: number
         }[],
         topVendors: {
           vendorName: string,
           totalAmount: number,
           transactionCount: number
         }[]
       }

GET    /api/expenses/reports/by-category
       Query: date_from, date_to, department_id
       Response: {
         category: string,
         amount: number,
         count: number,
         taxAmount: number,
         percentage: number
       }[]

GET    /api/expenses/reports/by-department
       Response: {
         department: string,
         amount: number,
         count: number,
         budget: number,
         utilization: number
       }[]

GET    /api/expenses/reports/by-vendor
       Response: {
         vendorName: string,
         totalAmount: number,
         transactionCount: number,
         averageExpense: number
       }[]

GET    /api/expenses/reports/reimbursable
       Response: {
         employee: string,
         expenseIds: string[],
         totalAmount: number,
         status: "pending" | "approved" | "processed" | "paid"
       }[]

POST   /api/expenses/reports/export
       Body: {
         format: "pdf" | "excel" | "csv",
         report_type: "summary" | "detailed",
         filters: { date_from, date_to, category, department }
       }
       Response: { download_url: string, expires_in: number (minutes) }
```

---

## Accounting Journal Entries

### Entry 1: Standard Vendor Expense (No Tax)

```
TRANSACTION: Travel expense paid to Arik Air
Amount: ₦450,000
Tax: None
Status: Approved

JOURNAL ENTRY:
Dr. 4110 - Travel Expenses              ₦450,000
   Cr. 1010 - Operating Bank                     ₦450,000

Description: "Travel expense - Flight to Lagos [EXP-0001]"
GL Entry ID: JE-12345
Posted Date: 2026-01-17
Posted By: System (Auto-posting on approval)
Status: Posted
```

### Entry 2: Vendor Expense with VAT Input Tax

```
TRANSACTION: Office supplies purchase (VAT-inclusive)
Amount: ₦100,000 (inclusive of 7.5% VAT)
Base Amount: ₦93,023
VAT: ₦6,977

JOURNAL ENTRY:
Dr. 4120 - Office Supplies Expense     ₦93,023
Dr. 1050 - VAT Input Tax Receivable     ₦6,977
   Cr. 1010 - Operating Bank                     ₦100,000

Description: "Office supplies - Shoprite [EXP-0002]"
GL Entry ID: JE-12346
Posted Date: 2026-01-18
Posted By: System
Status: Posted

TAX HANDLING:
- VAT Input tax is recoverable in next VAT return
- Posted to separate GL account (1050) for VAT reconciliation
- VAT return process: Offset against VAT Output Tax liability
```

### Entry 3: Withholding Tax Expense

```
TRANSACTION: Professional services (KPMG Audit)
Amount: ₦500,000
WHT Rate: 5% = ₦25,000
Net Payment: ₦475,000

JOURNAL ENTRY:
Dr. 4250 - Professional Fees          ₦500,000
   Cr. 2080 - WHT Payable on Professional Fees   ₦25,000
   Cr. 1010 - Operating Bank                     ₦475,000

Description: "Professional services - Q1 audit [EXP-0005]"
GL Entry ID: JE-12347
Posted Date: 2026-01-29
Posted By: System
Status: Posted

WHT COMPLIANCE:
- 5% withholding is remitted to FIRS via PAYE portal
- GL 2080 tracks WHT liability (monthly reconciliation)
- Expense recorded at full amount (₦500K), WHT is withholding liability
- Supporting document required: Certificate of WHT from vendor
```

### Entry 4: Prepaid Expense (Amortization Schedule)

```
TRANSACTION: Annual insurance premium (24-month coverage)
Amount: ₦2,400,000
Amortization Period: 24 months
Monthly Amount: ₦100,000

INITIAL ENTRY (On Recording/Approval):
Dr. 1400 - Prepaid Insurance          ₦2,400,000
   Cr. 1010 - Operating Bank                     ₦2,400,000

Description: "Annual insurance - 24 months coverage [EXP-0004]"
GL Entry ID: JE-12348
Posted Date: 2026-01-26
Status: Posted

MONTHLY AMORTIZATION ENTRIES (Auto-posted months 1-24):
Dr. 4510 - Insurance Expense            ₦100,000
   Cr. 1400 - Prepaid Insurance                   ₦100,000

Description: "Insurance amortization - Month X/24 [EXP-0004]"
GL Entry ID: JE-12349 through JE-12372
Posted Dates: 2026-02-01 through 2027-01-01
Status: Posted (monthly)
```

### Entry 5: Employee Reimbursement

```
TRANSACTION: Employee travel expense reimbursement
Employee: John Doe
Expense ID: EXP-0001
Amount: ₦450,000
Approval Status: Approved

INITIAL ENTRY (On Approval):
Dr. 4110 - Travel Expenses             ₦450,000
   Cr. 2050 - Employee Payable (John Doe)        ₦450,000

Description: "Travel expense accrual [EXP-0001]"
GL Entry ID: JE-12350
Posted Date: 2026-01-17
Status: Posted

REIMBURSEMENT PAYMENT ENTRY (When Paid):
Dr. 2050 - Employee Payable (John Doe) ₦450,000
   Cr. 1010 - Operating Bank                     ₦450,000

Description: "Travel expense reimbursement to John Doe [EXP-0001]"
GL Entry ID: JE-12351
Posted Date: 2026-02-01 (date of payment)
Status: Posted

ALTERNATIVE: Salary Offset
- Offset against employee salary in payroll
- Create payroll entry: Deduct from gross salary
- Single GL entry: Dr. 2050 / Cr. 2100 (Salary Payable)
```

### Entry 6: Cash Expense

```
TRANSACTION: Team lunch (cash payment)
Amount: ₦85,000
Tax: VAT 7.5% = ₦6,375
Total: ₦91,375
Vendor: Tanqueray (restaurant)

JOURNAL ENTRY:
Dr. 4130 - Meals & Entertainment      ₦85,000
Dr. 1050 - VAT Input Tax Receivable    ₦6,375
   Cr. 1015 - Cash in Hand                       ₦91,375

Description: "Team lunch - Project meeting [EXP-0003]"
GL Entry ID: JE-12352
Posted Date: 2026-01-21
Posted By: System
Status: Posted

CASH TRACKING:
- If expense > ₦50K: Requires petty cash control
- Each receipt must be matched to expense entry
- Monthly reconciliation: Cash outstanding vs. expenses pending
```

---

## Approval Authority Matrix

```
Manager (Level 1):
  - Authority: ₦0 - ₦1,000,000
  - Can approve: All amounts up to ₦1M
  - Cannot reject: Executive approval needed for policy overrides
  - Required fields: department, category, business justification
  - Approval time SLA: 24 hours

Finance (Level 2):
  - Authority: ₦0 - ₦2,000,000
  - Can approve: Expenses > ₦50K up to ₦2M
  - Validates: Tax compliance, GL account coding, vendor master
  - Can reject: Policy violations, duplicate submissions
  - Approval time SLA: 48 hours
  - Policy authority: Can override category limits up to ₦500K

Executive (Level 3):
  - Authority: > ₦500,000 (all amounts)
  - Can approve: Expenses > ₦500K
  - Validates: Strategic alignment, budget impact
  - Final authority: Can override all limits
  - Approval time SLA: 72 hours
  - Policy authority: Full policy exemptions

Department Head:
  - Authority: ₦0 - ₦200,000
  - Can approve: Department expenses only
  - Limited to: Own department, own cost center
  - Supplementary: Manager approval still required for GL coding
```

---

## Budget Control & Alerts

```
BUDGET PERIOD: Monthly by Department × Category

Example: Sales Department × Travel
Allocated: ₦500,000 (monthly)
Consumed: ₦360,000
Remaining: ₦140,000
Utilization: 72%

ALERTS:
- Warning Threshold: 80% (₦400,000)
  → Email: Department manager, Finance team
  → Color: Yellow in UI

- Critical Threshold: 95% (₦475,000)
  → Email: Department head, Finance director, CFO
  → Color: Red in UI
  → Action: Block new expenses until rebudgeting

- Overbudget (> 100%)
  → Block expense posting
  → Require executive approval to proceed
  → Log variance in budget variance report

BUDGET REFORECASTING:
- Monthly review cycle
- Reforecast option: Increase/decrease by department head request
- Finance approval required: For increases
- Automatic carry-over: If unused → next month (cumulative, max 3 months)
```

---

## Tax Compliance & Reporting

```
VAT RECONCILIATION (Monthly):
Input Tax Collected:     ₦47,125 (from EXP-0002, EXP-0003, EXP-0004)
Output Tax Payable:      ₦152,380 (from invoices issued)
Net VAT Payable:         ₦105,255

WHT RECONCILIATION (Monthly):
WHT Withheld:            ₦25,000 (from EXP-0005)
GL Account 2080:         ₦25,000 (balance)
Due to FIRS:             ₦25,000 (by 10th of following month)

TAX CERTIFICATES:
- Vendor submits WHT certificate
- Matched against payment
- Filed with income tax return
- Evidence retention: 5 years
```

---

## Implementation Checklist - Phase 2 (Backend)

### API Development
- [ ] Express/NestJS setup for expense routes
- [ ] GET /api/expenses (list with filters)
- [ ] POST /api/expenses (create draft)
- [ ] PATCH /api/expenses/:id (update draft)
- [ ] POST /api/expenses/:id/submit (transition to pending)
- [ ] POST /api/expenses/:id/approve (routing logic)
- [ ] POST /api/expenses/:id/reject
- [ ] Receipt upload (S3 integration)
- [ ] Reimbursement batch processing

### Accounting Integration
- [ ] Journal entry generation service
- [ ] VAT input tax calculation
- [ ] WHT payable calculation
- [ ] Prepaid expense amortization scheduler
- [ ] GL posting workflow
- [ ] GL reconciliation reports

### Approval Workflow
- [ ] Approval routing logic (amount-based)
- [ ] State machine implementation
- [ ] Authority validation
- [ ] Notification service (email alerts)
- [ ] Approval delegation (optional)
- [ ] Bulk approval action

### Reporting & Analytics
- [ ] Dashboard metrics calculation
- [ ] Category-wise expense report
- [ ] Department-wise expense report
- [ ] Vendor spending report
- [ ] Budget vs. actual report
- [ ] Tax compliance report
- [ ] Export to PDF/Excel

### Database
- [ ] expenses table schema
- [ ] expense_approvals table
- [ ] expense_receipts table
- [ ] budget_allocations table
- [ ] reimbursements table
- [ ] prepaid_schedules table
- [ ] Indexes for query performance

### Testing
- [ ] Unit tests for approval routing
- [ ] Integration tests for GL posting
- [ ] Approval workflow scenarios
- [ ] Tax calculation accuracy
- [ ] Budget alert triggering
- [ ] Reconciliation accuracy
- [ ] Performance: 5K+ expenses query < 2s
```

---

## Next Steps for Full Implementation

1. **Phase 1 COMPLETE** ✅ - UI & frontend data models
2. **Phase 2 TODO** - Backend APIs & database
3. **Phase 3 TODO** - Accounting integration & GL posting
4. **Phase 4 TODO** - Approval workflows & notifications
5. **Phase 5 TODO** - Reporting & analytics
6. **Phase 6 TODO** - Testing & optimization
