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
  
  UNIQUE (tenant_slug, account_code)
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
  
  UNIQUE (tenant_slug, fiscal_year, period_number)
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
  reversed_entry_id UUID REFERENCES journal_entries(id)
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
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  
  UNIQUE (account_id, fiscal_period_id)
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
  
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_tenant_type ON chart_of_accounts(tenant_slug, account_type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent ON chart_of_accounts(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_branch_dept ON chart_of_accounts(branch_id, department_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_tenant_status ON fiscal_periods(tenant_slug, status);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_period ON journal_entries(tenant_slug, fiscal_period_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_posting_date ON journal_entries(posting_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_approval_status ON journal_entries(approval_status);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_journal_type ON journal_entries(journal_type);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_cost_center ON journal_lines(branch_id, department_id, cost_center_id);

CREATE INDEX IF NOT EXISTS idx_account_balances_tenant_period ON account_balances(tenant_slug, fiscal_period_id);
CREATE INDEX IF NOT EXISTS idx_account_balances_account_period ON account_balances(account_id, fiscal_period_id);

CREATE INDEX IF NOT EXISTS idx_accounting_audit_entity ON accounting_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_accounting_audit_tenant_time ON accounting_audit_log(tenant_slug, timestamp);
CREATE INDEX IF NOT EXISTS idx_accounting_audit_action ON accounting_audit_log(action);

CREATE INDEX idx_journal_entries_tenant ON journal_entries(tenant_slug);
CREATE INDEX idx_journal_lines_account_date ON journal_lines(account_id, created_at);
CREATE INDEX idx_fiscal_periods_tenant ON fiscal_periods(tenant_slug);
CREATE INDEX idx_audit_log_tenant ON accounting_audit_log(tenant_slug);
