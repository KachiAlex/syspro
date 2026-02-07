# Expenses Module - Enterprise Implementation Guide

## Table of Contents
1. [Data Models](#data-models)
2. [Dashboard Metrics](#dashboard-metrics)
3. [UI Layout](#ui-layout)
4. [API Endpoints](#api-endpoints)
5. [Approval Workflows](#approval-workflows)
6. [Accounting Logic](#accounting-logic)
7. [Sample Data](#sample-data)
8. [Implementation Checklist](#implementation-checklist)

---

## Data Models

### Core Types

```typescript
// Main Expense Record
interface Expense {
  id: string;                    // EXP-YYYY-NNNN
  tenantId: string;
  expenseDate: string;           // ISO date
  recordedDate: string;          // ISO date
  
  // Amount & Tax
  amount: number;                // Base amount in NGN
  taxType: 'none' | 'vat' | 'wht';
  taxRate: number;               // 0-100 (e.g., 7.5 for VAT)
  taxAmount: number;             // Calculated
  totalAmount: number;           // amount + tax
  
  // Classification
  category: ExpenseCategory;     // OPEX subcategory
  type: 'vendor' | 'employee_reimbursement' | 'cash' | 'prepaid';
  description: string;
  
  // Entity References
  vendorId?: string;             // For vendor expenses
  vendorName?: string;
  employeeId?: string;           // For reimbursements
  departmentId: string;
  projectId?: string;
  costCenterId?: string;
  
  // Payment & Approval Status
  paymentStatus: 'unpaid' | 'paid' | 'reimbursed' | 'pending_payment';
  approvalStatus: 'draft' | 'pending' | 'approved' | 'rejected';
  
  // Payment Tracking
  paymentMethod: 'bank_transfer' | 'cash' | 'corporate_card' | 'mobile_money' | 'check';
  linkedPaymentId?: string;      // Payment record ID
  linkedInvoiceId?: string;      // For reimbursement billing
  
  // Metadata
  notes: string;
  receiptUrls: string[];         // S3 URLs to receipts
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  
  // Accounting
  journalEntryId?: string;
  accountId: string;             // GL account for expense
  vatInputAccountId?: string;
  whtPayableAccountId?: string;
  
  // Approval History
  approvals: Approval[];
  auditTrail: AuditLog[];
}

// Approval Record
interface Approval {
  id: string;
  expenseId: string;
  approverRole: 'manager' | 'finance' | 'executive';
  approverId: string;
  approverName: string;
  action: 'approved' | 'rejected' | 'clarification_requested';
  reason?: string;
  timestamp: string;
  amountThreshold: number;       // Approval authority
}

// Audit Log
interface AuditLog {
  id: string;
  action: string;                // 'created' | 'submitted' | 'approved' | 'paid' | 'reimbursed'
  timestamp: string;
  user: string;
  details: Record<string, any>;
}

// Category Definition
interface ExpenseCategory {
  id: string;
  code: string;                  // OP-001
  name: string;                  // Travel, Office Supplies, etc.
  accountId: string;             // GL account mapping
  requiresVendor: boolean;
  requiresReceipt: boolean;
  categoryLimit?: number;        // Monthly budget
  policyDescription: string;
}

// Budget Record
interface Budget {
  id: string;
  tenantId: string;
  period: string;                // YYYY-MM
  departmentId: string;
  categoryId?: string;
  allocatedAmount: number;
  consumedAmount: number;        // Sum of approved expenses
  remainingAmount: number;
  warningThreshold: number;      // 80% consumption
  createdAt: string;
}

// Reimbursement Record
interface Reimbursement {
  id: string;
  employeeId: string;
  totalAmount: number;
  expenseIds: string[];
  status: 'pending' | 'approved' | 'processed' | 'paid';
  createdAt: string;
  processedAt?: string;
}

// Prepaid Expense
interface PrepaidExpense {
  id: string;
  expenseId: string;
  amortizationMonths: number;
  monthlyAmount: number;
  startMonth: string;             // YYYY-MM
  amortizationSchedule: AmortizationEntry[];
}

interface AmortizationEntry {
  month: string;
  amount: number;
  journalEntryId: string;
  posted: boolean;
}
```

---

## Dashboard Metrics

### 4-Column Summary
```
┌─────────────────────┬─────────────────────┬─────────────────────┬─────────────────────┐
│  TOTAL EXPENSES     │  APPROVED VS PENDING │  BY CATEGORY        │  BUDGET CONSUMPTION │
├─────────────────────┼─────────────────────┼─────────────────────┼─────────────────────┤
│ ₦2.45M              │ Approved: ₦1.89M    │ Travel: ₦580K       │ 72% (Warn @ 80%)   │
│ This Month          │ Pending: ₦560K      │ Meals: ₦345K        │ ₦1.76M / ₦2.45M    │
│                     │ Rejected: ₦0        │ Office: ₦189K       │                    │
└─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
```

### Calculation Formulas
```
Total Expenses = SUM(approved expenses this period)
Pending = SUM(expenses in pending approval status)
Rejected = COUNT(rejected expenses)
By Category = GROUP BY category, SUM amount
Budget Consumption = SUM(approved expenses) / budget_allocated
```

### Filters
- Date range (month/quarter/custom)
- Branch
- Department
- Category
- Approval status
- Payment status

---

## UI Layout

### 1. Expenses Dashboard
```
Header: "Expenses"
Subtitle: "February 2026"

[4 Metric Cards]
- Total Expenses: ₦2.45M
- Approved vs Pending
- Top Categories (mini pie)
- Budget Status

[Filter Bar]
[Date Range] [Branch ▼] [Department ▼] [Category ▼] [Status ▼] [Search]
[+ Record Expense Button]

[Tab Navigation]
- All Expenses | Pending Approval | By Category | By Department
```

### 2. Expenses List Table (9 Columns)
```
┌──────────┬────────────┬──────────────────┬──────────────┬──────────┬──────────┬────────────┬──────────┬──────────┐
│ ID       │ Date       │ Description      │ Category     │ Vendor   │ Dept     │ Amount     │ Status   │ Actions  │
├──────────┼────────────┼──────────────────┼──────────────┼──────────┼──────────┼────────────┼──────────┼──────────┤
│ EXP-0001 │ 2026-01-15 │ Flight to Lagos  │ Travel       │ Arik Air │ Sales    │ ₦450K      │ Approved │ [···]    │
│ EXP-0002 │ 2026-01-18 │ Office Supplies  │ Supplies     │ Shoprite │ Admin    │ ₦50K       │ Pending  │ [···]    │
│ EXP-0003 │ 2026-01-20 │ Team Lunch       │ Meals        │ Tanqueray│ Product  │ ₦85K       │ Approved │ [···]    │
└──────────┴────────────┴──────────────────┴──────────────┴──────────┴──────────┴────────────┴──────────┴──────────┘

Hover: Row highlight
Click: Open Detail Drawer (Right Slide)
Actions Menu: View Details | Edit | Approve | Reject | Attach Receipt | Link Payment
```

### 3. Expense Detail Drawer (8 Sections)

```
[Header]
EXP-0001 | [Close X]

[Section 1: Amount & Tax]
Amount:        ₦450,000
Tax Type:      VAT (7.5%)
Tax Amount:    ₦33,750
Total:         ₦483,750

[Section 2: Expense Details]
Date:          Jan 15, 2026
Category:      Travel
Vendor:        Arik Air
Department:    Sales
Project:       Q1 Campaign
Payment Method: Bank Transfer
Status:        Approved

[Section 3: Attachment]
Receipt:       flight-receipt.pdf [Download]
                arik-invoice.jpg  [Download]

[Section 4: Linked Payment]
Payment:       PAY-0045
Status:        Paid on Jan 18, 2026
Amount:        ₦483,750

[Section 5: Approval History]
- Approved by Manager (John Doe) on Jan 16, 2026
- Approved by Finance (Jane Smith) on Jan 17, 2026

[Section 6: Accounting]
GL Account:    4110-Travel Expenses
Entry Status:  Posted (JE-12345)

[Section 7: Reimbursement (if applicable)]
Status:        Reimbursed to John on Feb 1, 2026

[Section 8: Audit Trail]
- Created: Jan 15, 2026 by John Doe
- Submitted: Jan 15, 2026 by John Doe
- Approved: Jan 16, 2026 by Manager
- Posted to GL: Jan 17, 2026
```

### 4. Record Expense Modal/Drawer

```
[Header]
Record New Expense | [Close X]

[Wizard Step 1: Type & Basic Info]
Expense Type: [Vendor Expense ▼]
  Options: Vendor Expense | Employee Reimbursement | Cash | Prepaid

Date: [2026-02-01]
Amount: [____________]
Currency: NGN (₦)

[Next >]

[Wizard Step 2: Classification]
Category: [Travel ▼]
Department: [Sales ▼]
Project/Cost Center: [Q1 Campaign ▼]
Description: [_____________________________]

[Next >]

[Wizard Step 3: Tax & Vendor]
Tax Type: [None ▼] (VAT / WHT / None)
Tax Rate: [7.5%] (auto-calculated)
Tax Amount: [₦33,750]

Vendor: [Arik Air] (autocomplete)
Payment Method: [Bank Transfer ▼]

[Next >]

[Wizard Step 4: Attachments]
Attach Receipt: [Upload PDF/Image]
  receipt.pdf - 2.3 MB
  invoice.jpg - 1.8 MB
[Remove]

[Finish >]

[Wizard Step 5: Review & Submit]
Summary:
- Amount: ₦483,750 (₦450K + ₦33.75K tax)
- Category: Travel
- Vendor: Arik Air
- Status: Ready to Submit

[Save as Draft] [Submit for Approval]
```

---

## API Endpoints

### Expense CRUD
```
GET    /api/expenses
       Query params: date_from, date_to, category, department, status, search
       Response: { data: Expense[], total: number, page: number }

GET    /api/expenses/:id
       Response: Expense (with full approval history)

POST   /api/expenses
       Body: { expenseDate, amount, category, vendor, description, notes, receiptUrls }
       Response: Expense

PATCH  /api/expenses/:id
       Body: Partial<Expense>
       Response: Expense (only draft/pending allowed)

DELETE /api/expenses/:id
       Response: { success: true } (only draft allowed)
```

### Approval Workflow
```
POST   /api/expenses/:id/submit
       Body: { submittedBy: string }
       Response: Expense (status: pending)

POST   /api/expenses/:id/approve
       Body: { approvedBy: string, reason?: string }
       Response: Expense (status: approved) + Journal Entry created

POST   /api/expenses/:id/reject
       Body: { rejectedBy: string, reason: string }
       Response: Expense (status: rejected)

POST   /api/expenses/:id/request-clarification
       Body: { requestedBy: string, question: string }
       Response: Notification to expense creator
```

### Payment Linking
```
POST   /api/expenses/:id/link-payment
       Body: { paymentId: string }
       Response: Expense (linkedPaymentId set)

POST   /api/expenses/:id/mark-paid
       Body: { paymentDate: string, method: string, referenceNo: string }
       Response: Expense (paymentStatus: paid)
```

### Reimbursement
```
POST   /api/reimbursements
       Body: { employeeId: string, expenseIds: string[] }
       Response: Reimbursement

POST   /api/reimbursements/:id/approve
       Response: Creates payable to employee

POST   /api/reimbursements/:id/process
       Response: Creates payment + marks expenses as reimbursed
```

### Receipts
```
POST   /api/expenses/:id/upload-receipt
       Form-data: { file: File }
       Response: { url: string }

DELETE /api/expenses/:id/receipts/:receiptUrl
       Response: { success: true }
```

### Dashboard & Reporting
```
GET    /api/expenses/dashboard/metrics
       Response: {
         totalExpenses: number,
         approved: number,
         pending: number,
         byCategory: { category: string, amount: number }[],
         budgetStatus: { category: string, consumed: number, total: number }[]
       }

GET    /api/expenses/reports/by-category
       Query: date_from, date_to
       Response: { category: string, amount: number, count: number }[]

GET    /api/expenses/reports/by-department
       Response: Similar structure

GET    /api/expenses/reports/reimbursable
       Response: Reimbursable expenses grouped by employee
```

---

## Approval Workflows

### Standard Approval Rules

```
Amount Threshold Routing:
- ₦0 - ₦50K:     Manager approval only
- ₦50K - ₦500K:  Manager + Finance approval
- ₦500K+:        Manager + Finance + Executive approval

Override Rules:
- Out-of-policy expenses require additional executive sign-off
- Policy violation = 2-level approval minimum

Parallel vs Sequential:
- Manager review happens first (always)
- Finance & Executive can review in parallel (if amount > ₦50K)
- Executive review is required for ₦500K+ ONLY IF manager + finance both approved
```

### Approval State Machine
```
DRAFT
  ↓
[User Submits]
PENDING
  ├→ [Manager Rejects] → REJECTED
  ├→ [Manager Requests Clarification] → PENDING (awaiting user response)
  └→ [Manager Approves & Amount ≤ ₦50K] → APPROVED ✓
     └→ [Finance Approves & Amount > ₦50K] → APPROVED ✓
        └→ [Executive Approves & Amount > ₦500K] → APPROVED ✓

APPROVED
  ├→ [GL Posted] → GL_POSTED
  └→ [Marked Paid] → PAID

Immutable States: APPROVED, GL_POSTED, PAID
```

---

## Accounting Logic

### Journal Entry Generation

**Example 1: Vendor Expense (No Tax)**
```
Expense: ₦100,000 to Office Supplies Vendor (OPEX)

Dr. 4110 - Office Supplies Expense    ₦100,000
   Cr. 1010 - Cash/Bank                           ₦100,000

Description: "Office supplies - Shoprite [EXP-0001]"
GL Entry Status: Posted automatically on approval
```

**Example 2: Vendor Expense with VAT Input Tax**
```
Expense: ₦100,000 (VAT inclusive - 7.5%)
  Base: ₦93,023
  VAT: ₦6,977

Dr. 4110 - Office Supplies Expense    ₦93,023
Dr. 1050 - VAT Input Tax Receivable    ₦6,977
   Cr. 1010 - Cash/Bank                           ₦100,000

Note: VAT Input tax is recoverable on next VAT return
```

**Example 3: Withholding Tax**
```
Expense: ₦100,000 Professional Services (WTH: 5%)
  Base: ₦100,000
  WHT: ₦5,000
  Net: ₦95,000

Dr. 4250 - Professional Fees         ₦100,000
   Cr. 2080 - WHT Payable                         ₦5,000
   Cr. 1010 - Cash/Bank                           ₦95,000

Note: WHT is remitted to FIRS via PAYE portal
```

**Example 4: Prepaid Expense (24-month amortization)**
```
Expense: ₦2,400,000 Insurance (24 months)
  Monthly Amortization: ₦100,000

Initial Entry (on recording):
Dr. 1400 - Prepaid Insurance         ₦2,400,000
   Cr. 1010 - Cash/Bank                           ₦2,400,000

Monthly Entry (auto-generated):
Dr. 4510 - Insurance Expense         ₦100,000
   Cr. 1400 - Prepaid Insurance                   ₦100,000

(24 times for 24 months)
```

**Example 5: Employee Reimbursement**
```
Expense: ₦50,000 Travel (employee personal)

Initial Entry (on approval):
Dr. 4110 - Travel Expense            ₦50,000
   Cr. 2050 - Employee Payable                    ₦50,000

On Reimbursement Payment:
Dr. 2050 - Employee Payable          ₦50,000
   Cr. 1010 - Cash/Bank                           ₦50,000

Alternative: Create payroll entry to offset against salary
```

---

## Sample Data

### Sample Expense Records (5 Examples)

```typescript
const EXPENSE_RECORDS_BASELINE: Expense[] = [
  {
    id: "EXP-0001",
    tenantId: "tenant-001",
    expenseDate: "2026-01-15",
    recordedDate: "2026-01-15",
    amount: 450000,
    taxType: "vat",
    taxRate: 7.5,
    taxAmount: 33750,
    totalAmount: 483750,
    category: { id: "cat-001", code: "OP-100", name: "Travel", accountId: "4110", requiresVendor: true, requiresReceipt: true, policyDescription: "Flights, hotels, transport" },
    type: "vendor",
    description: "Flight to Lagos for client meeting",
    vendorId: "vend-001",
    vendorName: "Arik Air",
    employeeId: "emp-001",
    departmentId: "dept-001",
    projectId: "proj-001",
    costCenterId: "cc-001",
    paymentStatus: "paid",
    approvalStatus: "approved",
    paymentMethod: "bank_transfer",
    linkedPaymentId: "PAY-0045",
    notes: "Client engagement - Strategic account",
    receiptUrls: ["https://s3.amazonaws.com/receipts/flight-receipt.pdf"],
    createdBy: "emp-001",
    createdAt: "2026-01-15T09:00:00Z",
    updatedAt: "2026-01-17T14:30:00Z",
    approvedBy: "emp-002",
    approvedAt: "2026-01-17T14:30:00Z",
    journalEntryId: "JE-12345",
    accountId: "4110-Travel",
    vatInputAccountId: "1050",
    whtPayableAccountId: null,
    approvals: [
      { id: "app-001", expenseId: "EXP-0001", approverRole: "manager", approverId: "emp-002", approverName: "John Doe", action: "approved", timestamp: "2026-01-16T10:00:00Z", amountThreshold: 1000000 },
      { id: "app-002", expenseId: "EXP-0001", approverRole: "finance", approverId: "emp-003", approverName: "Jane Smith", action: "approved", timestamp: "2026-01-17T11:00:00Z", amountThreshold: 2000000 }
    ],
    auditTrail: [
      { id: "audit-001", action: "created", timestamp: "2026-01-15T09:00:00Z", user: "emp-001", details: { amount: 450000 } },
      { id: "audit-002", action: "submitted", timestamp: "2026-01-15T09:30:00Z", user: "emp-001", details: {} },
      { id: "audit-003", action: "approved", timestamp: "2026-01-17T14:30:00Z", user: "emp-002", details: { reason: "Approved - within authority" } },
      { id: "audit-004", action: "posted_to_gl", timestamp: "2026-01-18T08:00:00Z", user: "system", details: { journalEntryId: "JE-12345" } },
      { id: "audit-005", action: "marked_paid", timestamp: "2026-01-20T10:00:00Z", user: "emp-003", details: { linkedPaymentId: "PAY-0045" } }
    ]
  },
  {
    id: "EXP-0002",
    tenantId: "tenant-001",
    expenseDate: "2026-01-18",
    recordedDate: "2026-01-18",
    amount: 50000,
    taxType: "vat",
    taxRate: 7.5,
    taxAmount: 3750,
    totalAmount: 53750,
    category: { id: "cat-002", code: "OP-200", name: "Office Supplies", accountId: "4120", requiresVendor: true, requiresReceipt: true, policyDescription: "Stationery, equipment, furniture" },
    type: "vendor",
    description: "Office stationery and supplies",
    vendorId: "vend-002",
    vendorName: "Shoprite",
    departmentId: "dept-002",
    paymentStatus: "unpaid",
    approvalStatus: "pending",
    paymentMethod: "corporate_card",
    notes: "General office supplies",
    receiptUrls: ["https://s3.amazonaws.com/receipts/shoprite-receipt.pdf"],
    createdBy: "emp-004",
    createdAt: "2026-01-18T11:00:00Z",
    updatedAt: "2026-01-18T11:00:00Z",
    approvals: [
      { id: "app-003", expenseId: "EXP-0002", approverRole: "manager", approverId: "emp-002", approverName: "John Doe", action: "approved", timestamp: "2026-01-19T09:00:00Z", amountThreshold: 1000000 }
    ],
    auditTrail: [
      { id: "audit-006", action: "created", timestamp: "2026-01-18T11:00:00Z", user: "emp-004", details: {} },
      { id: "audit-007", action: "submitted", timestamp: "2026-01-18T12:00:00Z", user: "emp-004", details: {} }
    ],
    accountId: "4120-Office",
    vatInputAccountId: "1050"
  },
  {
    id: "EXP-0003",
    tenantId: "tenant-001",
    expenseDate: "2026-01-20",
    recordedDate: "2026-01-20",
    amount: 85000,
    taxType: "vat",
    taxRate: 7.5,
    taxAmount: 6375,
    totalAmount: 91375,
    category: { id: "cat-003", code: "OP-300", name: "Meals & Entertainment", accountId: "4130", requiresVendor: false, requiresReceipt: true, policyDescription: "Team meals, client entertainment" },
    type: "cash",
    description: "Team lunch - project kickoff meeting",
    departmentId: "dept-003",
    projectId: "proj-002",
    paymentStatus: "paid",
    approvalStatus: "approved",
    paymentMethod: "cash",
    notes: "Project team coordination",
    receiptUrls: ["https://s3.amazonaws.com/receipts/tanqueray-receipt.pdf"],
    createdBy: "emp-005",
    createdAt: "2026-01-20T13:00:00Z",
    updatedAt: "2026-01-21T10:00:00Z",
    approvedBy: "emp-002",
    approvedAt: "2026-01-21T10:00:00Z",
    journalEntryId: "JE-12346",
    linkedPaymentId: "PAY-0046",
    accountId: "4130-Meals",
    vatInputAccountId: "1050",
    approvals: [
      { id: "app-004", expenseId: "EXP-0003", approverRole: "manager", approverId: "emp-002", approverName: "John Doe", action: "approved", timestamp: "2026-01-21T09:00:00Z", amountThreshold: 1000000 }
    ],
    auditTrail: [
      { id: "audit-008", action: "created", timestamp: "2026-01-20T13:00:00Z", user: "emp-005", details: {} },
      { id: "audit-009", action: "approved", timestamp: "2026-01-21T10:00:00Z", user: "emp-002", details: {} }
    ]
  },
  {
    id: "EXP-0004",
    tenantId: "tenant-001",
    expenseDate: "2026-01-25",
    recordedDate: "2026-01-25",
    amount: 2400000,
    taxType: "none",
    taxRate: 0,
    taxAmount: 0,
    totalAmount: 2400000,
    category: { id: "cat-004", code: "OP-400", name: "Insurance", accountId: "4510", requiresVendor: true, requiresReceipt: true, categoryLimit: 3000000, policyDescription: "Corporate insurance policies" },
    type: "prepaid",
    description: "Annual insurance premium (24-month coverage)",
    vendorId: "vend-003",
    vendorName: "AXA Insurance",
    departmentId: "dept-001",
    paymentStatus: "paid",
    approvalStatus: "approved",
    paymentMethod: "bank_transfer",
    linkedPaymentId: "PAY-0047",
    notes: "24-month comprehensive coverage",
    receiptUrls: ["https://s3.amazonaws.com/receipts/axa-policy.pdf"],
    createdBy: "emp-006",
    createdAt: "2026-01-25T08:00:00Z",
    updatedAt: "2026-01-26T15:00:00Z",
    approvedBy: "emp-003",
    approvedAt: "2026-01-26T15:00:00Z",
    journalEntryId: "JE-12347",
    accountId: "1400-Prepaid",
    approvals: [
      { id: "app-005", expenseId: "EXP-0004", approverRole: "manager", approverId: "emp-002", approverName: "John Doe", action: "approved", timestamp: "2026-01-25T10:00:00Z", amountThreshold: 1000000 },
      { id: "app-006", expenseId: "EXP-0004", approverRole: "finance", approverId: "emp-003", approverName: "Jane Smith", action: "approved", timestamp: "2026-01-26T14:00:00Z", amountThreshold: 2000000 },
      { id: "app-007", expenseId: "EXP-0004", approverRole: "executive", approverId: "emp-007", approverName: "CEO", action: "approved", timestamp: "2026-01-26T15:00:00Z", amountThreshold: 5000000 }
    ],
    auditTrail: [
      { id: "audit-010", action: "created", timestamp: "2026-01-25T08:00:00Z", user: "emp-006", details: {} },
      { id: "audit-011", action: "approved", timestamp: "2026-01-26T15:00:00Z", user: "emp-003", details: { allApprovalsComplete: true } },
      { id: "audit-012", action: "posted_to_gl", timestamp: "2026-01-27T08:00:00Z", user: "system", details: { journalEntryId: "JE-12347", prepaidAmortization: "24 months @ ₦100K/month" } }
    ]
  },
  {
    id: "EXP-0005",
    tenantId: "tenant-001",
    expenseDate: "2026-01-28",
    recordedDate: "2026-01-28",
    amount: 500000,
    taxType: "wht",
    taxRate: 5,
    taxAmount: 25000,
    totalAmount: 475000,
    category: { id: "cat-005", code: "OP-500", name: "Professional Services", accountId: "4250", requiresVendor: true, requiresReceipt: true, policyDescription: "Consulting, audit, legal services" },
    type: "vendor",
    description: "External audit services - Q1 review",
    vendorId: "vend-004",
    vendorName: "KPMG",
    departmentId: "dept-001",
    paymentStatus: "unpaid",
    approvalStatus: "pending",
    paymentMethod: "bank_transfer",
    notes: "Quarterly audit - compliance requirement",
    receiptUrls: [],
    createdBy: "emp-006",
    createdAt: "2026-01-28T14:00:00Z",
    updatedAt: "2026-01-28T14:00:00Z",
    approvals: [
      { id: "app-008", expenseId: "EXP-0005", approverRole: "manager", approverId: "emp-002", approverName: "John Doe", action: "clarification_requested", reason: "Awaiting scope details", timestamp: "2026-01-29T09:00:00Z", amountThreshold: 1000000 }
    ],
    auditTrail: [
      { id: "audit-013", action: "created", timestamp: "2026-01-28T14:00:00Z", user: "emp-006", details: {} },
      { id: "audit-014", action: "submitted", timestamp: "2026-01-28T14:30:00Z", user: "emp-006", details: {} },
      { id: "audit-015", action: "clarification_requested", timestamp: "2026-01-29T09:00:00Z", user: "emp-002", details: { question: "Please provide scope of audit" } }
    ],
    accountId: "4250-Professional",
    whtPayableAccountId: "2080"
  }
];
```

---

## Implementation Checklist

### Phase 1: Data Models & Types
- [ ] Define Expense interface
- [ ] Define Approval interface
- [ ] Define Budget interface
- [ ] Define Reimbursement interface
- [ ] Create sample data (EXPENSE_RECORDS_BASELINE)
- [ ] Create category definitions

### Phase 2: UI Components
- [ ] Dashboard metrics (4-column)
- [ ] Expenses list table (9 columns)
- [ ] Row hover effects
- [ ] Detail drawer (8 sections)
- [ ] Record expense wizard modal (5 steps)
- [ ] Filter bar & search
- [ ] Status badge colors

### Phase 3: State Management & Interactions
- [ ] useState for expenses list
- [ ] Filter logic
- [ ] Search functionality
- [ ] Row click → detail drawer
- [ ] Menu actions (edit, approve, link payment)
- [ ] Form handling (record expense)

### Phase 4: API Integration
- [ ] GET /api/expenses (list)
- [ ] GET /api/expenses/:id (detail)
- [ ] POST /api/expenses (create)
- [ ] PATCH /api/expenses/:id (update draft)
- [ ] POST /api/expenses/:id/submit
- [ ] POST /api/expenses/:id/approve
- [ ] POST /api/expenses/:id/reject

### Phase 5: Approval Workflows
- [ ] Approval routing logic
- [ ] Amount threshold routing
- [ ] Approval status transitions
- [ ] Reject/clarification flows
- [ ] Email notifications

### Phase 6: Accounting Integration
- [ ] Journal entry generation on approval
- [ ] VAT input tax handling
- [ ] Withholding tax payable
- [ ] Prepaid expense amortization
- [ ] GL posting workflow

### Phase 7: Reports & Analytics
- [ ] Expenses by category
- [ ] Expenses by department
- [ ] Reimbursable expenses report
- [ ] Budget vs actual
- [ ] Export to PDF/Excel

### Phase 8: Testing & Refinement
- [ ] Component testing
- [ ] API integration testing
- [ ] Approval workflow testing
- [ ] Journal entry validation
- [ ] Performance optimization
- [ ] Accessibility review

---

## Status Badges Color Reference

```
Draft          → bg-slate-50 text-slate-700 border-slate-200
Pending        → bg-yellow-50 text-yellow-700 border-yellow-200
Approved       → bg-green-50 text-green-700 border-green-200
Rejected       → bg-red-50 text-red-700 border-red-200
Paid           → bg-blue-50 text-blue-700 border-blue-200
Reimbursed     → bg-purple-50 text-purple-700 border-purple-200
```

---

## Tax Handling Rules

| Tax Type | Rate | GL Credit Account | Recoverable | Example |
|----------|------|-------------------|-------------|---------|
| VAT      | 7.5% | 1050 VAT Input    | Yes (ITC)   | Goods/Services |
| WHT      | 5%   | 2080 WHT Payable  | No (FIRS)   | Professional Services |
| None     | 0%   | -                 | N/A         | Salary, utilities |

---

## Next Steps

1. **Create expense data models** in tenant-admin/page.tsx
2. **Build FinanceExpensesWorkspace component** using sample data
3. **Implement API endpoints** in api/finance/expenses route
4. **Add approval workflow** logic and state management
5. **Generate journal entries** on approval
6. **Build reimbursement** batch processing
7. **Add reporting** views and export functionality
