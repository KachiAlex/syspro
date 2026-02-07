# Sales & CRM Architecture - Comparison & Implementation Plan

**Date**: 2025-02-08  
**Status**: Requirements Analysis  
**Task**: Compare current implementation vs Sales & CRM requirements

---

## 📊 Current Implementation Status

### ✅ What We've Built (Completed Modules)

#### 1. Assets & Depreciation Module (100%)
- Asset creation, categorization, revaluation
- Depreciation calculations (straight-line, reducing-balance)
- Monthly depreciation posting
- Asset disposal with gain/loss
- Audit trail and asset register

#### 2. Financial Reports Module (93%)
- P&L statements
- Balance sheets
- Cash flow statements
- Aged receivables analysis (A/R aging)
- Aged payables analysis (A/P aging)
- Comparative period analysis
- Account drill-down
- CSV export

#### 3. Accounting Core (Partial)
- Chart of accounts structure
- Journal entry management
- General ledger functionality
- Trial balance reporting
- Period management

#### 4. Budget Module (Partial)
- Budget creation and management
- Budget lines and structure
- Some variance analysis
- Actuals vs budget tracking

#### 5. Expenses Module (Exists)
- Expense tracking
- Expense workflows
- Expense approvals

#### 6. Vendor Management (Partial)
- Vendor records
- Vendor payments
- Bill management (A/P)

---

## ❌ What's Missing - Sales & CRM Module

### Complete Gap Analysis

| Feature | Current | Needed | Priority |
|---------|---------|--------|----------|
| **Leads Management** | ❌ None | ✅ Full system | 🔴 High |
| Leads creation | ❌ No | ✅ Manual, Import, API | 🔴 High |
| Lead qualification | ❌ No | ✅ Status, scoring | 🔴 High |
| Lead activities | ❌ No | ✅ Calls, emails, meetings | 🔴 High |
| **Contacts & Accounts** | ⚠️ Partial | ✅ Full system | 🔴 High |
| Account management | ⚠️ Vendor/Customer split | ✅ Unified accounts | 🟡 Medium |
| Contact management | ❌ No | ✅ Full contact DB | 🔴 High |
| Account hierarchy | ❌ No | ✅ Parent/child accounts | 🟡 Medium |
| **Deals/Opportunities** | ❌ None | ✅ Full pipeline | 🔴 High |
| Pipeline management | ❌ No | ✅ Multiple pipelines | 🔴 High |
| Kanban board | ❌ No | ✅ Drag-drop view | 🟡 Medium |
| Stage tracking | ❌ No | ✅ Win/loss analysis | 🔴 High |
| **Quotes/Estimates** | ❌ None | ✅ Full system | 🔴 High |
| Quote creation | ❌ No | ✅ From deals | 🔴 High |
| Quote approval | ❌ No | ✅ Workflow | 🟡 Medium |
| PDF generation | ❌ No | ✅ Email ready | 🟡 Medium |
| **Sales Orders** | ❌ None | ✅ Full system | 🔴 High |
| Order creation | ❌ No | ✅ From quotes | 🔴 High |
| Fulfillment tracking | ❌ No | ✅ Partial fulfillment | 🔴 High |
| Inventory linking | ❌ No | ✅ Reservation | 🟡 Medium |
| **Products & Pricing** | ⚠️ Basic | ✅ CRM view | 🟡 Medium |
| Price books | ❌ No | ✅ Multiple books | 🟡 Medium |
| Branch pricing | ❌ No | ✅ Per-branch | 🟡 Medium |
| Discount rules | ❌ No | ✅ Rules engine | 🔴 High |
| **Activities & Communication** | ❌ None | ✅ Full system | 🔴 High |
| Call logging | ❌ No | ✅ With history | 🔴 High |
| Email tracking | ❌ No | ✅ Integration ready | 🟡 Medium |
| Meeting scheduling | ❌ No | ✅ Calendar sync | 🟡 Medium |
| **Sales Team & Performance** | ❌ None | ✅ Full dashboards | 🔴 High |
| Rep performance | ❌ No | ✅ Metrics & targets | 🔴 High |
| Revenue tracking | ❌ No | ✅ By rep/branch | 🔴 High |
| Conversion rates | ❌ No | ✅ Analytics | 🟡 Medium |
| **Approvals & Controls** | ⚠️ Basic | ✅ Advanced rules | 🟡 Medium |
| Discount approval | ❌ No | ✅ Rules-based | 🔴 High |
| Quote approval | ❌ No | ✅ Workflow | 🟡 Medium |
| Deal approval | ❌ No | ✅ Value-based | 🟡 Medium |
| **CRM Reports** | ❌ None | ✅ 10+ reports | 🔴 High |
| Pipeline reports | ❌ No | ✅ Forecast & value | 🔴 High |
| Lead conversion | ❌ No | ✅ Analytics | 🔴 High |
| Revenue reports | ❌ No | ✅ By dimension | 🔴 High |

---

## 🏗️ Architecture Overlap & Reusability

### What We Can Reuse

#### 1. Multi-Tenant Infrastructure ✅
- **From**: Accounting, Budget, Assets modules
- **Reuse**: Tenant ID isolation, branch/region logic
- **Impact**: Can directly apply to all CRM entities

#### 2. Approval Workflows ✅
- **From**: Budget approvals, Expense approvals
- **Reuse**: Approval rules engine, status tracking
- **Update**: Extend for discount, quote, deal approvals

#### 3. API Architecture ✅
- **From**: All existing modules
- **Reuse**: Next.js route structure, validation patterns, error handling
- **Impact**: Consistent with existing codebase

#### 4. Type Safety & Validation ✅
- **From**: All modules using Zod
- **Reuse**: Validation patterns, schema definitions
- **Impact**: Same patterns for CRM entities

#### 5. Database Patterns ✅
- **From**: Assets, Accounting tables
- **Reuse**: Audit trails, multi-tenant structure, foreign keys
- **Pattern**: Mirror existing table design

#### 6. React Components ✅
- **From**: Dashboard, list, detail views
- **Reuse**: Card layouts, tables, form patterns
- **Impact**: Consistent UI/UX

#### 7. Financial Integration ✅
- **From**: Accounting core
- **Reuse**: GL account mapping, invoice generation
- **Impact**: Sales orders → Invoices → GL

---

## 📋 Sales & CRM Implementation Plan

### Phase 1: Foundation (Weeks 1-2)

#### Database Schema
```sql
-- Leads
CREATE TABLE leads (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  name VARCHAR(255),
  company VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  source VARCHAR(50), -- Website, Referral, Ads, Walk-in
  region VARCHAR(100),
  branch VARCHAR(100),
  assigned_sales_rep_id BIGINT,
  status VARCHAR(50), -- New, Contacted, Qualified, Unqualified
  score INT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Accounts (Companies/Customers)
CREATE TABLE accounts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  name VARCHAR(255),
  industry VARCHAR(100),
  region VARCHAR(100),
  branch VARCHAR(100),
  billing_address TEXT,
  shipping_address TEXT,
  tax_id VARCHAR(50),
  currency VARCHAR(3) DEFAULT 'USD',
  credit_limit DECIMAL(12,2),
  payment_terms VARCHAR(100),
  account_manager_id BIGINT,
  status VARCHAR(50), -- Active, Dormant
  created_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Contacts
CREATE TABLE contacts (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  account_id BIGINT,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),
  role VARCHAR(100),
  communication_preference VARCHAR(50),
  created_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Opportunities/Deals
CREATE TABLE opportunities (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  pipeline_id BIGINT,
  account_id BIGINT,
  name VARCHAR(255),
  estimated_value DECIMAL(12,2),
  currency VARCHAR(3),
  probability INT, -- 0-100
  expected_close_date DATE,
  sales_owner_id BIGINT,
  branch VARCHAR(100),
  stage VARCHAR(100), -- Prospecting, Qualification, Proposal, Negotiation, Won, Lost
  deal_type VARCHAR(50), -- One-time, Subscription
  status VARCHAR(50),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Activities (Calls, Emails, Meetings)
CREATE TABLE activities (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  activity_type VARCHAR(50), -- Call, Email, Meeting, Task
  lead_id BIGINT,
  contact_id BIGINT,
  account_id BIGINT,
  opportunity_id BIGINT,
  subject VARCHAR(255),
  notes TEXT,
  assigned_to BIGINT,
  scheduled_date TIMESTAMP,
  completed_date TIMESTAMP,
  created_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Quotes
CREATE TABLE quotes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  opportunity_id BIGINT,
  account_id BIGINT,
  quote_number VARCHAR(50),
  total_amount DECIMAL(12,2),
  tax DECIMAL(12,2),
  discount DECIMAL(12,2),
  status VARCHAR(50), -- Draft, Sent, Accepted, Rejected
  validity_date DATE,
  created_at TIMESTAMP,
  approved_at TIMESTAMP,
  approval_user_id BIGINT,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (opportunity_id) REFERENCES opportunities(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

-- Sales Orders
CREATE TABLE sales_orders (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  quote_id BIGINT,
  order_number VARCHAR(50),
  account_id BIGINT,
  total_amount DECIMAL(12,2),
  delivery_date DATE,
  status VARCHAR(50), -- Pending, Fulfilled, Cancelled, Partially Fulfilled
  created_at TIMESTAMP,
  fulfilled_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (quote_id) REFERENCES quotes(id)
);

-- Price Books
CREATE TABLE price_books (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  name VARCHAR(255), -- Retail, Wholesale, Enterprise
  branch VARCHAR(100),
  status VARCHAR(50),
  created_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Sales Rep Performance
CREATE TABLE sales_reps (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  user_id BIGINT,
  branch VARCHAR(100),
  region VARCHAR(100),
  monthly_target DECIMAL(12,2),
  quarterly_target DECIMAL(12,2),
  created_at TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
```

#### API Endpoints (Phase 1)
```
POST   /api/sales/leads
GET    /api/sales/leads
GET    /api/sales/leads/:id
PUT    /api/sales/leads/:id
POST   /api/sales/leads/:id/convert
POST   /api/sales/leads/:id/activities

POST   /api/sales/accounts
GET    /api/sales/accounts
GET    /api/sales/accounts/:id
PUT    /api/sales/accounts/:id

POST   /api/sales/contacts
GET    /api/sales/contacts
GET    /api/sales/contacts/:id
PUT    /api/sales/contacts/:id

POST   /api/sales/opportunities
GET    /api/sales/opportunities
GET    /api/sales/opportunities/:id
PUT    /api/sales/opportunities/:id
```

### Phase 2: Core Features (Weeks 3-4)

#### Features
- Opportunities/Deals pipeline
- Quotes creation and approval
- Sales Orders
- Activities tracking
- Quote to SO flow

#### New Endpoints
```
POST   /api/sales/opportunities/:id/quotes
POST   /api/sales/opportunities/:id/quotes/:quoteId/approve
POST   /api/sales/opportunities/:id/orders

POST   /api/sales/quotes
GET    /api/sales/quotes/:id
POST   /api/sales/quotes/:id/send
POST   /api/sales/quotes/:id/approve
POST   /api/sales/quotes/:id/reject

POST   /api/sales/orders
GET    /api/sales/orders/:id
PUT    /api/sales/orders/:id/status
```

### Phase 3: Advanced Features (Weeks 5-6)

#### Features
- Sales Performance dashboards
- Lead scoring
- Activity timeline
- Advanced filtering and search
- PDF quote generation
- Email integration hooks

#### New Endpoints
```
GET    /api/sales/performance/summary
GET    /api/sales/performance/:repId
GET    /api/sales/pipeline/forecast
GET    /api/sales/reports/conversion-rate
GET    /api/sales/reports/average-deal-size
GET    /api/sales/quotes/:id/pdf
```

### Phase 4: Advanced Controls (Week 7)

#### Features
- Approval rules engine
- Discount approval workflows
- Deal value approval
- Region-specific rules
- Permission matrix

---

## 🔄 Integration Points

### With Existing Modules

#### Accounts/Contacts → Accounting
```
Account created → GL Account created (A/R setup)
Contact added → Customer contact record
Account address → Billing address for invoices
Tax ID → Tax calculation
```

#### Sales Orders → Invoicing
```
Sales Order created → Reserved inventory
SO fulfilled → Invoice created
Invoice posted → GL entries (A/R, Revenue)
Invoice paid → Reduce A/R balance
```

#### Deals → Financial Forecasting
```
Opportunity value → Revenue forecast
Win probability → Weighted revenue
Expected close → Forecasting period
```

#### Sales Rep → Budget
```
Sales Rep targets → Budget allocation
Revenue generated → Actuals in budget
Commission tracking → Expense allocation
```

---

## 📊 Implementation Effort Estimation

| Component | Lines of Code | Effort | Duration |
|-----------|----------------|--------|----------|
| Database Schema | 300 | 1 day | Phase 1 |
| API Routes (Lead mgmt) | 400 | 2 days | Phase 1 |
| API Routes (Accounts/Contacts) | 500 | 2 days | Phase 1 |
| API Routes (Opportunities) | 600 | 3 days | Phase 2 |
| API Routes (Quotes) | 400 | 2 days | Phase 2 |
| API Routes (Orders) | 400 | 2 days | Phase 2 |
| API Routes (Reports) | 400 | 2 days | Phase 3 |
| Service Layer | 1,000 | 5 days | All phases |
| React Components | 1,500 | 7 days | All phases |
| Type Definitions | 300 | 1 day | Phase 1 |
| **TOTAL** | **~5,800** | **~27 days** | **6-7 weeks** |

---

## ✅ What To Do Next

### Immediate Actions (This Week)

#### 1. Create Sales & CRM Database Migration
- [ ] Design and implement all tables
- [ ] Add proper indexes
- [ ] Create relationships
- [ ] Add audit trails

#### 2. Create Type Definitions
- [ ] Lead types and schemas
- [ ] Account/Contact types
- [ ] Opportunity types
- [ ] Quote/Order types
- [ ] Activity types

#### 3. Start Service Layer
- [ ] Lead creation and management
- [ ] Account management
- [ ] Contact management
- [ ] Basic CRUD operations

#### 4. Build First Phase APIs
- [ ] Lead endpoints (CRUD)
- [ ] Account endpoints (CRUD)
- [ ] Contact endpoints (CRUD)
- [ ] Lead conversion endpoint

### Phase 2-4 (Following Weeks)
- [ ] Opportunity pipeline
- [ ] Quote workflow
- [ ] Sales order processing
- [ ] Activity tracking
- [ ] Performance dashboards
- [ ] Approval workflows

---

## 🎯 Key Differences vs Other Modules

### What Makes CRM Different

1. **Relationship-Heavy**: Multiple entities linked (Lead→Contact→Account→Deal)
2. **Status-Driven**: Pipelines, stages, workflow states
3. **Activity-Centric**: Every action tracked (calls, emails, meetings)
4. **Performance-Focused**: Revenue, metrics, forecasting
5. **Flow-Based**: Lead→Deal→Quote→Order→Invoice→Payment

### What's Similar
- Multi-tenant architecture
- Role-based access
- Approval workflows
- Financial integration
- Reporting framework

---

## 🚀 Recommended Approach

### Build CRM As A New Module
- **Separate** from Assets, Reports, Accounting
- **Integrate** with existing GL, invoicing
- **Reuse** patterns from existing modules
- **Follow** same architecture (Service layer → API → Components)

### Phased Rollout
- **Phase 1**: Leads, Accounts, Contacts (Foundation)
- **Phase 2**: Opportunities, Quotes, Orders (Revenue Flow)
- **Phase 3**: Activities, Performance (Engagement)
- **Phase 4**: Approvals, Analytics (Control)

### Quality Focus
- Type safety (Zod schemas)
- Error handling
- Input validation
- Audit trails
- Performance optimization

---

## 📝 Summary

### Current State
✅ Assets & Depreciation (100%)  
✅ Financial Reports (93%)  
✅ Accounting Core (60%)  
✅ Budgets (50%)  
✅ Expenses (partially)  
✅ Vendor Mgmt (partial)  

### Gap
❌ **Sales & CRM Module (0%)**

### Effort to Build CRM
- **Code**: ~5,800 lines
- **Time**: 6-7 weeks (or 4 weeks intensive)
- **Phases**: 4 phases, starting with foundation
- **Reuse**: ~60% of patterns from existing modules

### Critical Path
Phase 1 (Leads/Accounts/Contacts) → Phase 2 (Pipeline/Quotes/Orders) → Phase 3 (Activities/Reports) → Phase 4 (Approvals)

Would you like me to start building Phase 1 (Leads, Accounts, Contacts foundation)?

