-- Budgets & Forecasting Module
-- Supports annual, quarterly, and monthly budgets
-- Versioning for budget edits and historical tracking
-- Integration with expenses and procurement for enforcement

-- Budget master table
CREATE TABLE IF NOT EXISTS budgets (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Budget scope
  budget_type VARCHAR(20) NOT NULL CHECK (budget_type IN ('DEPARTMENT', 'PROJECT', 'BRANCH', 'ACCOUNT_CATEGORY')),
  scope_entity_id BIGINT,  -- department_id, project_id, branch_id, or account_id
  scope_entity_name VARCHAR(255),
  
  -- Budget period
  period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('ANNUAL', 'QUARTERLY', 'MONTHLY')),
  fiscal_year INTEGER NOT NULL,
  quarter_num INTEGER CHECK (quarter_num IS NULL OR quarter_num BETWEEN 1 AND 4),
  month_num INTEGER CHECK (month_num IS NULL OR month_num BETWEEN 1 AND 12),
  
  -- Total budget amount
  total_budget_amount DECIMAL(19, 2) NOT NULL DEFAULT 0,
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CLOSED', 'ARCHIVED')),
  
  -- Enforcement
  enforcement_mode VARCHAR(20) NOT NULL CHECK (enforcement_mode IN ('SOFT_WARNING', 'HARD_BLOCK', 'AUDIT_ONLY')) DEFAULT 'SOFT_WARNING',
  allow_overrun BOOLEAN DEFAULT FALSE,
  overrun_threshold_percent DECIMAL(5, 2) DEFAULT 110,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  version_number INTEGER DEFAULT 1,
  notes TEXT,
  
  CONSTRAINT unique_budget_code UNIQUE (tenant_id, code),
  CONSTRAINT budgets_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Budget line items
CREATE TABLE IF NOT EXISTS budget_lines (
  id BIGSERIAL PRIMARY KEY,
  budget_id BIGINT NOT NULL,
  tenant_id BIGINT NOT NULL,
  
  -- Line details
  line_number INTEGER NOT NULL,
  account_id BIGINT,
  account_code VARCHAR(50),
  account_name VARCHAR(255),
  
  -- Optional additional dimensions
  cost_center_id BIGINT,
  cost_center_name VARCHAR(255),
  project_id BIGINT,
  project_name VARCHAR(255),
  
  -- Budget amount for this line
  budgeted_amount DECIMAL(19, 2) NOT NULL DEFAULT 0,
  
  -- Allocation percentage (if budget_lines sum < total)
  allocation_percent DECIMAL(5, 2),
  
  description TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT budget_lines_budget_fk FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  CONSTRAINT budget_lines_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT unique_budget_line UNIQUE (budget_id, line_number)
);

-- Budget versions for audit trail and historical tracking
CREATE TABLE IF NOT EXISTS budget_versions (
  id BIGSERIAL PRIMARY KEY,
  budget_id BIGINT NOT NULL,
  tenant_id BIGINT NOT NULL,
  
  version_number INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL,
  total_budget_amount DECIMAL(19, 2) NOT NULL,
  
  change_reason VARCHAR(255),
  changed_by VARCHAR(255),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Snapshot of budget details
  budget_snapshot JSONB,
  
  CONSTRAINT budget_versions_budget_fk FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  CONSTRAINT budget_versions_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT unique_budget_version UNIQUE (budget_id, version_number)
);

-- Actual expenditures against budget
CREATE TABLE IF NOT EXISTS budget_actuals (
  id BIGSERIAL PRIMARY KEY,
  budget_id BIGINT NOT NULL,
  budget_line_id BIGINT,
  tenant_id BIGINT NOT NULL,
  
  -- Reference to actual transactions
  actual_type VARCHAR(50) NOT NULL CHECK (actual_type IN ('EXPENSE', 'INVOICE', 'PURCHASE_ORDER', 'PAYMENT')),
  transaction_id BIGINT,
  transaction_code VARCHAR(255),
  
  -- Amount details
  actual_amount DECIMAL(19, 2) NOT NULL,
  committed_amount DECIMAL(19, 2) DEFAULT 0,  -- POs not yet invoiced
  
  -- Categorization
  account_id BIGINT,
  account_code VARCHAR(50),
  cost_center_id BIGINT,
  project_id BIGINT,
  
  -- Date
  transaction_date DATE,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  notes TEXT,
  
  CONSTRAINT budget_actuals_budget_fk FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  CONSTRAINT budget_actuals_budget_line_fk FOREIGN KEY (budget_line_id) REFERENCES budget_lines(id) ON DELETE SET NULL,
  CONSTRAINT budget_actuals_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Rolling forecasts and trend projections
CREATE TABLE IF NOT EXISTS budget_forecasts (
  id BIGSERIAL PRIMARY KEY,
  budget_id BIGINT NOT NULL,
  tenant_id BIGINT NOT NULL,
  
  forecast_type VARCHAR(30) NOT NULL CHECK (forecast_type IN ('ROLLING', 'TREND_BASED', 'SCENARIO')),
  
  -- Rolling forecast period
  forecast_period_start DATE,
  forecast_period_end DATE,
  
  -- Forecast amounts by line
  forecast_lines JSONB NOT NULL,  -- Array of {budget_line_id, forecasted_amount, confidence_level}
  
  -- Scenario name (if scenario forecast)
  scenario_name VARCHAR(255),
  scenario_description TEXT,
  
  -- Methodology
  methodology VARCHAR(255),  -- "avg_of_last_n_periods", "trend_projection", "custom_upload"
  base_periods INTEGER,  -- How many periods were used for calculation
  
  -- Projection confidence
  confidence_level VARCHAR(20) CHECK (confidence_level IN ('HIGH', 'MEDIUM', 'LOW')),
  variance_percent DECIMAL(5, 2),
  
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT budget_forecasts_budget_fk FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  CONSTRAINT budget_forecasts_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Budget approval workflow
CREATE TABLE IF NOT EXISTS budget_approvals (
  id BIGSERIAL PRIMARY KEY,
  budget_id BIGINT NOT NULL,
  tenant_id BIGINT NOT NULL,
  
  approval_sequence INTEGER NOT NULL,
  approver_role VARCHAR(100) NOT NULL,
  approver_id VARCHAR(255),
  approver_name VARCHAR(255),
  
  status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  
  comment TEXT,
  approved_at TIMESTAMP,
  
  CONSTRAINT budget_approvals_budget_fk FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  CONSTRAINT budget_approvals_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT unique_budget_approval UNIQUE (budget_id, approval_sequence)
);

-- Variance alerts and breaches
CREATE TABLE IF NOT EXISTS budget_variances (
  id BIGSERIAL PRIMARY KEY,
  budget_id BIGINT NOT NULL,
  budget_line_id BIGINT,
  tenant_id BIGINT NOT NULL,
  
  variance_type VARCHAR(30) NOT NULL CHECK (variance_type IN ('OVER_BUDGET', 'UNDER_BUDGET', 'THRESHOLD_WARNING')),
  
  -- Variance details
  budgeted_amount DECIMAL(19, 2),
  actual_amount DECIMAL(19, 2),
  committed_amount DECIMAL(19, 2) DEFAULT 0,
  variance_amount DECIMAL(19, 2),
  variance_percent DECIMAL(5, 2),
  
  -- Alert management
  alert_level VARCHAR(20) CHECK (alert_level IN ('INFO', 'WARNING', 'CRITICAL')),
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT budget_variances_budget_fk FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE,
  CONSTRAINT budget_variances_budget_line_fk FOREIGN KEY (budget_line_id) REFERENCES budget_lines(id) ON DELETE SET NULL,
  CONSTRAINT budget_variances_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_budgets_tenant_id ON budgets(tenant_id);
CREATE INDEX idx_budgets_status ON budgets(status);
CREATE INDEX idx_budgets_budget_type ON budgets(budget_type);
CREATE INDEX idx_budgets_fiscal_year ON budgets(fiscal_year);
CREATE INDEX idx_budgets_scope_entity ON budgets(scope_entity_id);
CREATE INDEX idx_budgets_created_at ON budgets(created_at DESC);

CREATE INDEX idx_budget_lines_budget_id ON budget_lines(budget_id);
CREATE INDEX idx_budget_lines_account_id ON budget_lines(account_id);
CREATE INDEX idx_budget_lines_cost_center ON budget_lines(cost_center_id);
CREATE INDEX idx_budget_lines_project_id ON budget_lines(project_id);

CREATE INDEX idx_budget_actuals_budget_id ON budget_actuals(budget_id);
CREATE INDEX idx_budget_actuals_transaction_id ON budget_actuals(transaction_id);
CREATE INDEX idx_budget_actuals_account_id ON budget_actuals(account_id);
CREATE INDEX idx_budget_actuals_transaction_date ON budget_actuals(transaction_date DESC);
CREATE INDEX idx_budget_actuals_type ON budget_actuals(actual_type);

CREATE INDEX idx_budget_variances_budget_id ON budget_variances(budget_id);
CREATE INDEX idx_budget_variances_type ON budget_variances(variance_type);
CREATE INDEX idx_budget_variances_alert_level ON budget_variances(alert_level);

CREATE INDEX idx_budget_forecasts_budget_id ON budget_forecasts(budget_id);
CREATE INDEX idx_budget_forecasts_type ON budget_forecasts(forecast_type);

-- View: Budget Summary with Variance
CREATE OR REPLACE VIEW budget_summary_view AS
SELECT
  b.id,
  b.tenant_id,
  b.code,
  b.name,
  b.budget_type,
  b.period_type,
  b.fiscal_year,
  b.status,
  b.total_budget_amount,
  COALESCE(SUM(ba.actual_amount), 0) as total_actual,
  COALESCE(SUM(ba.committed_amount), 0) as total_committed,
  b.total_budget_amount - (COALESCE(SUM(ba.actual_amount), 0) + COALESCE(SUM(ba.committed_amount), 0)) as remaining_balance,
  ROUND(((COALESCE(SUM(ba.actual_amount), 0) + COALESCE(SUM(ba.committed_amount), 0)) / NULLIF(b.total_budget_amount, 0) * 100)::NUMERIC, 2) as percent_utilized,
  b.created_at,
  b.approved_at
FROM budgets b
LEFT JOIN budget_actuals ba ON b.id = ba.budget_id
GROUP BY b.id, b.tenant_id, b.code, b.name, b.budget_type, b.period_type, b.fiscal_year, b.status, b.total_budget_amount, b.created_at, b.approved_at;

-- View: Budget Line Variance Detail
CREATE OR REPLACE VIEW budget_line_variance_view AS
SELECT
  bl.id as budget_line_id,
  bl.budget_id,
  bl.tenant_id,
  bl.account_code,
  bl.account_name,
  bl.budgeted_amount,
  COALESCE(SUM(ba.actual_amount), 0) as actual_amount,
  COALESCE(SUM(ba.committed_amount), 0) as committed_amount,
  bl.budgeted_amount - (COALESCE(SUM(ba.actual_amount), 0) + COALESCE(SUM(ba.committed_amount), 0)) as remaining_balance,
  ROUND(((COALESCE(SUM(ba.actual_amount), 0) + COALESCE(SUM(ba.committed_amount), 0)) / NULLIF(bl.budgeted_amount, 0) * 100)::NUMERIC, 2) as percent_utilized
FROM budget_lines bl
LEFT JOIN budget_actuals ba ON bl.id = ba.budget_line_id
GROUP BY bl.id, bl.budget_id, bl.tenant_id, bl.account_code, bl.account_name, bl.budgeted_amount;
