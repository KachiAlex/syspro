# Sales & CRM - Quick Implementation Roadmap

## 📋 At a Glance

**What We Have**: Assets, Reports, Accounting, Budgets  
**What We Need**: Sales & CRM (Leads, Accounts, Contacts, Deals, Quotes, Orders)  
**Gap Size**: ~5,800 lines of code  
**Timeline**: 6-7 weeks (or 4 weeks intensive)  
**Reuse Rate**: 60% from existing patterns  

---

## 🎯 Phase 1: Foundation (Week 1-2)

### Builds: Leads, Accounts, Contacts

```
┌─────────────────────────┐
│   LEADS MANAGEMENT      │
│ ─────────────────────── │
│ • Create lead           │
│ • Qualify lead          │
│ • Assign to sales rep   │
│ • Track activities      │
│ • Convert to customer   │
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│ ACCOUNTS (Companies)    │
│ ─────────────────────── │
│ • Create account        │
│ • Set credit limit      │
│ • Assign manager        │
│ • Track address info    │
│ • Link to GL            │
└─────────────────────────┘
         ↓
┌─────────────────────────┐
│   CONTACTS (People)     │
│ ─────────────────────── │
│ • Create contact        │
│ • Link to account       │
│ • Set role/preference   │
│ • Track interactions    │
└─────────────────────────┘
```

### Database Tables
- `leads` - Lead records with scoring
- `accounts` - Company/customer records
- `contacts` - People within accounts
- `lead_activities` - Call, email, meeting logs

### API Endpoints (12)
```
/api/sales/leads           (CRUD + convert)
/api/sales/accounts        (CRUD)
/api/sales/contacts        (CRUD)
```

### React Components
- Lead list with kanban status view
- Lead detail page
- Lead conversion dialog
- Account list and detail
- Contact list and detail
- Activity timeline

### Deliverable
- ✅ All 3 entities fully functional
- ✅ Lead → Account conversion flow
- ✅ Activity tracking on all entities
- ✅ Basic filtering and search

---

## 🎯 Phase 2: Revenue Pipeline (Week 3-4)

### Builds: Opportunities, Quotes, Sales Orders

```
LEAD (Phase 1)
    ↓
OPPORTUNITY/DEAL (Phase 2)
    ↓ (Qualified)
QUOTE (Phase 2)
    ↓ (Approved)
SALES ORDER (Phase 2)
    ↓ (Fulfilled)
INVOICE (Existing Accounting)
```

### Database Tables
- `opportunities` - Sales pipeline with stages
- `opportunity_products` - Products in deal
- `quotes` - Quote management
- `quote_lines` - Quote line items
- `sales_orders` - Order fulfillment
- `order_lines` - Order line items

### API Endpoints (15)
```
/api/sales/opportunities   (CRUD + stage move)
/api/sales/quotes          (CRUD + approve/reject)
/api/sales/orders          (CRUD + fulfillment)
```

### React Components
- Kanban board view (drag-drop pipeline)
- Opportunity detail with products
- Quote creation wizard
- Quote approval UI
- Sales order tracker
- Fulfillment status view

### Deliverable
- ✅ Full sales pipeline management
- ✅ Quote to Order flow
- ✅ Inventory reservation
- ✅ Multi-stage tracking

---

## 🎯 Phase 3: Engagement & Analytics (Week 5-6)

### Builds: Activities, Performance, Reports

```
SALES REP DASHBOARD
├─ My Leads (count, score)
├─ My Pipeline (value, probability)
├─ My Deals (won/lost)
├─ Activities (calls, meetings)
└─ Performance (vs target)

MANAGER DASHBOARD
├─ Team Performance
├─ Pipeline by rep
├─ Conversion rates
├─ Revenue forecast
└─ Activity summary
```

### Database Tables
- `activities` - Calls, emails, meetings, tasks
- `sales_rep_targets` - Monthly/quarterly targets
- `activity_reminders` - Follow-up tracking

### API Endpoints (10+)
```
/api/sales/activities      (CRUD + reminders)
/api/sales/performance     (dashboards)
/api/sales/reports         (analytics)
```

### React Components
- Sales rep dashboard
- Manager dashboard with metrics
- Activity timeline and calendar
- Performance charts
- Conversion rate reports
- Revenue forecast views
- Lead scoring view

### Deliverable
- ✅ Performance dashboards
- ✅ Activity tracking and reminders
- ✅ Revenue forecasting
- ✅ Lead scoring
- ✅ Conversion analytics

---

## 🎯 Phase 4: Controls & Approvals (Week 7)

### Builds: Approval Workflows, Discount Rules, Permissions

```
APPROVAL RULES
├─ Discount > 10% → Manager approval
├─ Deal > ₦5M → Finance approval
├─ Region override → Region head
└─ Quote > 30 days → Re-qualify

PERMISSION MODEL
├─ Sales Rep → sees own deals
├─ Branch Mgr → sees branch deals
├─ Regional Mgr → sees region deals
├─ Finance → sees high-value deals
└─ Admin → sees all
```

### Database Tables
- `approval_rules` - Rule definitions
- `approval_workflows` - Workflow states
- `approval_history` - Audit trail

### API Endpoints (8+)
```
/api/sales/approvals       (submit/review/approve)
/api/sales/rules           (rules engine)
/api/sales/permissions     (role-based)
```

### React Components
- Approval workflow UI
- Rules engine manager
- Permission matrix
- Approval queue
- Audit trail views

### Deliverable
- ✅ Dynamic approval workflows
- ✅ Rules-based automation
- ✅ Permission enforcement
- ✅ Audit trail logging

---

## 📊 Effort Breakdown

| Phase | Component | Lines | Days | Status |
|-------|-----------|-------|------|--------|
| **1** | DB Schema | 300 | 1 | 📋 Ready |
| **1** | Service Layer | 400 | 2 | 📋 Ready |
| **1** | API Routes | 300 | 2 | 📋 Ready |
| **1** | Components | 400 | 2 | 📋 Ready |
| **1** | Types/Validation | 200 | 1 | 📋 Ready |
| | **Phase 1 Total** | **1,600** | **8 days** | |
| **2** | DB Schema | 300 | 1 | |
| **2** | Service Layer | 600 | 3 | |
| **2** | API Routes | 400 | 2 | |
| **2** | Components | 500 | 2 | |
| | **Phase 2 Total** | **1,800** | **8 days** | |
| **3** | Service Layer | 400 | 2 | |
| **3** | API Routes | 300 | 1.5 | |
| **3** | Components | 600 | 3 | |
| | **Phase 3 Total** | **1,300** | **6.5 days** | |
| **4** | Service Layer | 200 | 1 | |
| **4** | API Routes | 200 | 1 | |
| **4** | Components | 300 | 1.5 | |
| | **Phase 4 Total** | **700** | **3.5 days** | |
| | **TOTAL** | **5,400** | **26 days** | |

---

## 🔗 Integration Points

### Phase 1 Integration
- ✅ Tenant isolation (reuse from Assets/Accounting)
- ✅ User assignment (reuse from Budget/Expenses)
- ✅ Multi-branch support (reuse from all modules)

### Phase 2 Integration
- ✅ Inventory system (link to products)
- ✅ Pricing rules (link to price books)
- ✅ GL account mapping (prepare for invoicing)

### Phase 3 Integration
- ✅ Financial forecasting (link to budget module)
- ✅ Performance metrics (link to compensation)
- ✅ Activity tracking (feeds into analytics)

### Phase 4 Integration
- ✅ Approval workflows (link to existing approval system)
- ✅ Permission matrix (link to auth system)
- ✅ Rules engine (feeds into automation)

---

## 📈 Success Criteria by Phase

### Phase 1 ✓
- [ ] Can create/manage leads
- [ ] Can create/manage accounts
- [ ] Can create/manage contacts
- [ ] Can convert lead to account
- [ ] Can log activities on all entities

### Phase 2 ✓
- [ ] Can create opportunities
- [ ] Can move deals through pipeline
- [ ] Can create quotes from deals
- [ ] Can approve quotes
- [ ] Can create sales orders
- [ ] Can track fulfillment

### Phase 3 ✓
- [ ] Sales rep dashboard works
- [ ] Can view pipeline value
- [ ] Can see performance metrics
- [ ] Can log/track activities
- [ ] Can get conversion reports

### Phase 4 ✓
- [ ] Discount approvals work
- [ ] Quote approvals work
- [ ] Rules engine enforces policies
- [ ] Permissions are enforced
- [ ] Audit trail is complete

---

## 🚀 Quick Start (Today)

### Create Migration File
```bash
# Create Phase 1 database migration
create-file: db/migrations/20260209_create_sales_crm.sql
```

### Create Type Definitions
```bash
# Create CRM types with validation
create-file: src/lib/sales/types.ts
```

### Create Service Layer
```bash
# Start Phase 1 service layer
create-file: src/lib/sales/leads-db.ts
create-file: src/lib/sales/accounts-db.ts
create-file: src/lib/sales/contacts-db.ts
```

### Create API Routes
```bash
# Phase 1 API endpoints
create-directory: src/app/api/sales/
create-file: src/app/api/sales/leads/route.ts
create-file: src/app/api/sales/accounts/route.ts
create-file: src/app/api/sales/contacts/route.ts
```

---

## 📚 References & Reuse

### From Existing Modules
- **Multi-tenant pattern** ← Accounting, Assets
- **API structure** ← All modules
- **Type safety** ← All modules (Zod)
- **Error handling** ← All modules
- **Service layer pattern** ← Reports, Assets
- **React components** ← All UI components
- **Approval workflows** ← Budget, Expenses
- **Activity tracking** ← Could use from Audit

### New CRM-Specific Patterns
- **Pipeline stages** - New
- **Lead scoring** - New
- **Activity timeline** - New
- **Kanban views** - New
- **Probability weighting** - New

---

## ⚠️ Key Decisions to Make

### 1. Customer Entity Design
- **Option A**: Separate Lead and Account tables (current plan)
- **Option B**: Unified Customer table with lead_status field
- **Recommendation**: Option A (cleaner, matches requirement)

### 2. Activity Types
- **Option A**: Single activities table with type field
- **Option B**: Separate tables for calls, emails, meetings
- **Recommendation**: Option A (simpler, more flexible)

### 3. Pipeline Flexibility
- **Option A**: Fixed pipeline stages (hardcoded)
- **Option B**: Configurable pipelines per company
- **Recommendation**: Option B (more enterprise-ready)

### 4. Pricing Integration
- **Option A**: CRM reads from Product module
- **Option B**: CRM has its own price book tables
- **Recommendation**: Option A (single source of truth)

---

## 🎁 What You'll Get

### After Phase 1
Complete lead-to-customer workflow with full tracking

### After Phase 2
Complete sales order processing and invoicing integration

### After Phase 3
Comprehensive sales dashboards and analytics

### After Phase 4
Enterprise-grade approval controls and permissions

---

## Next Steps

**Option 1**: Start Phase 1 immediately (Leads, Accounts, Contacts)  
**Option 2**: Review design first (1 day)  
**Option 3**: Integrate with existing modules first  

**Recommendation**: **Start Phase 1 immediately** - DB schema and API routes (2 days)

Ready to begin? 🚀

