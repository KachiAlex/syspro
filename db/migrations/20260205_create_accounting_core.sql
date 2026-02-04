-- Accounting Core Module
-- Supports: Chart of Accounts, Journal Entries, Fiscal Periods, Trial Balance

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  account_code VARCHAR(50) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE')),
  sub_type VARCHAR(100),
  parent_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  description TEXT,
  currency VARCHAR(3) DEFAULT 'NGN',
  
  -- Classification
  is_system_account BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Tagging
  branch_id UUID,
  department_id UUID,
  project_id UUID,
  
  -- Control flags
  allow_manual_posting BOOLEAN DEFAULT TRUE,
  require_cost_center BOOLEAN DEFAULT FALSE,
  is_reconciliation_account BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (tenant_slug, account_code),
  INDEX idx_tenant_type (tenant_slug, account_type),
  INDEX idx_parent (parent_account_id),
  INDEX idx_branch_dept (branch_id, department_id)
);

-- ============================================================
-- FISCAL PERIODS
-- ============================================================

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  fiscal_year INTEGER NOT NULL,
  period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 12),
  period_name VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LOCKED')),
  locked_by VARCHAR(255),
  locked_at TIMESTAMP,
  
  -- Control
  allow_posting BOOLEAN DEFAULT TRUE,
  allow_adjustments BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (tenant_slug, fiscal_year, period_number),
  INDEX idx_tenant_status (tenant_slug, status),
  INDEX idx_dates (start_date, end_date)
);

-- ============================================================
-- JOURNAL ENTRIES (Header)
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  journal_number VARCHAR(100),
  journal_type VARCHAR(50) NOT NULL CHECK (journal_type IN ('MANUAL', 'SYSTEM', 'ADJUSTMENT', 'REVERSING')),
  
  -- Posting details
  fiscal_period_id UUID NOT NULL REFERENCES fiscal_periods(id),
  posting_date DATE NOT NULL,
  reference_id VARCHAR(255),
  reference_type VARCHAR(100),
  
  -- Debit/Credit totals
  total_debit DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(15,2) NOT NULL DEFAULT 0,
  
  -- Notes and attachments
  description TEXT,
  notes TEXT,
  attachment_url VARCHAR(500),
  
  -- Approval
  approval_status VARCHAR(50) DEFAULT 'DRAFT' CHECK (approval_status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED')),
  approved_by UUID,
  approved_at TIMESTAMP,
  
  -- User tracking
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  posted_at TIMESTAMP,
  
  -- Control
  is_reversing BOOLEAN DEFAULT FALSE,
  reversed_entry_id UUID REFERENCES journal_entries(id),
  
  INDEX idx_tenant_period (tenant_slug, fiscal_period_id),
  INDEX idx_posting_date (posting_date),
  INDEX idx_approval_status (approval_status),
  INDEX idx_reference (reference_type, reference_id),
  INDEX idx_journal_type (journal_type)
);

-- ============================================================
-- JOURNAL LINES (Detail)
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  
  -- Optional cost allocation
  branch_id UUID,
  department_id UUID,
  project_id UUID,
  cost_center_id UUID,
  
  description TEXT,
  
  -- Reconciliation tracking
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_journal_entry (journal_entry_id),
  INDEX idx_account (account_id),
  INDEX idx_cost_center (branch_id, department_id, cost_center_id)
);

-- ============================================================
-- ACCOUNT BALANCES (Denormalized for Performance)
-- ============================================================

CREATE TABLE IF NOT EXISTS account_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE CASCADE,
  fiscal_period_id UUID NOT NULL REFERENCES fiscal_periods(id),
  
  opening_balance DECIMAL(15,2) DEFAULT 0,
  period_debit DECIMAL(15,2) DEFAULT 0,
  period_credit DECIMAL(15,2) DEFAULT 0,
  closing_balance DECIMAL(15,2) GENERATED ALWAYS AS (
    opening_balance + period_debit - period_credit
  ) STORED,
  
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (account_id, fiscal_period_id),
  INDEX idx_tenant_period (tenant_slug, fiscal_period_id),
  INDEX idx_account_period (account_id, fiscal_period_id)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  
  user_id VARCHAR(255),
  user_name VARCHAR(255),
  ip_address VARCHAR(45),
  
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_tenant_time (tenant_slug, timestamp),
  INDEX idx_action (action)
);

-- ============================================================
-- TRIAL BALANCE VIEW
-- ============================================================

CREATE OR REPLACE VIEW trial_balance_view AS
SELECT
  ab.tenant_slug,
  ab.fiscal_period_id,
  fp.fiscal_year,
  fp.period_number,
  coa.id as account_id,
  coa.account_code,
  coa.account_name,
  coa.account_type,
  COALESCE(ab.closing_balance, 0) as balance,
  CASE
    WHEN coa.account_type IN ('ASSET', 'EXPENSE') THEN
      CASE WHEN ab.closing_balance > 0 THEN ab.closing_balance ELSE 0 END
    ELSE
      CASE WHEN ab.closing_balance > 0 THEN ab.closing_balance ELSE 0 END
  END as debit_balance,
  CASE
    WHEN coa.account_type IN ('LIABILITY', 'EQUITY', 'INCOME') THEN
      CASE WHEN ab.closing_balance > 0 THEN ab.closing_balance ELSE 0 END
    ELSE
      CASE WHEN ab.closing_balance < 0 THEN ABS(ab.closing_balance) ELSE 0 END
  END as credit_balance
FROM account_balances ab
JOIN chart_of_accounts coa ON ab.account_id = coa.id
JOIN fiscal_periods fp ON ab.fiscal_period_id = fp.id
WHERE coa.is_active = TRUE;

-- ============================================================
-- GENERAL LEDGER VIEW
-- ============================================================

CREATE OR REPLACE VIEW general_ledger_view AS
SELECT
  je.id as entry_id,
  je.journal_number,
  je.journal_type,
  je.posting_date,
  je.reference_id,
  coa.account_code,
  coa.account_name,
  coa.account_type,
  jl.debit_amount,
  jl.credit_amount,
  je.description,
  je.approval_status,
  je.created_by,
  je.created_at
FROM journal_entries je
JOIN journal_lines jl ON je.id = jl.journal_entry_id
JOIN chart_of_accounts coa ON jl.account_id = coa.id
ORDER BY je.posting_date, je.journal_number;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX idx_journal_entries_tenant ON journal_entries(tenant_slug);
CREATE INDEX idx_journal_lines_account_date ON journal_lines(account_id, created_at);
CREATE INDEX idx_fiscal_periods_tenant ON fiscal_periods(tenant_slug);
CREATE INDEX idx_audit_log_tenant ON accounting_audit_log(tenant_slug);
