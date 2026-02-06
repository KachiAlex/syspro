-- ASSETS & DEPRECIATION MODULE
-- Comprehensive asset lifecycle management with depreciation engine

-- Asset Categories
CREATE TABLE IF NOT EXISTS asset_categories (
  id BIGSERIAL PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Default depreciation settings
  default_useful_life_years INTEGER DEFAULT 5,
  default_depreciation_method VARCHAR(30) NOT NULL CHECK (default_depreciation_method IN ('STRAIGHT_LINE', 'REDUCING_BALANCE')),
  default_residual_percent DECIMAL(5, 2) DEFAULT 0,
  
  -- GL Accounts
  asset_account_id BIGINT,
  accumulated_depreciation_account_id BIGINT,
  depreciation_expense_account_id BIGINT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_asset_category UNIQUE (tenant_slug, code)
);

-- Assets (Fixed Assets Register)
CREATE TABLE IF NOT EXISTS assets (
  id BIGSERIAL PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Category & Location
  category_id BIGINT NOT NULL,
  location VARCHAR(255),
  cost_center_id BIGINT,
  
  -- Purchase Info
  purchase_date DATE NOT NULL,
  purchase_cost DECIMAL(19, 2) NOT NULL,
  purchase_invoice_id BIGINT,
  
  -- Depreciation Settings
  useful_life_years INTEGER NOT NULL DEFAULT 5,
  depreciation_method VARCHAR(30) NOT NULL CHECK (depreciation_method IN ('STRAIGHT_LINE', 'REDUCING_BALANCE')),
  residual_value DECIMAL(19, 2) DEFAULT 0,
  
  -- Accumulated Depreciation (denormalized for performance)
  accumulated_depreciation DECIMAL(19, 2) DEFAULT 0,
  net_book_value DECIMAL(19, 2),
  
  -- Revaluation
  last_revaluation_date DATE,
  last_revaluation_amount DECIMAL(19, 2),
  revaluation_count INTEGER DEFAULT 0,
  
  -- Status
  asset_status VARCHAR(30) NOT NULL CHECK (asset_status IN ('ACQUIRED', 'IN_USE', 'UNDER_MAINTENANCE', 'REVALUED', 'DISPOSED')),
  
  -- Depreciation Control
  depreciation_started_date DATE,
  depreciation_end_date DATE,
  last_depreciation_date DATE,
  
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_asset_code UNIQUE (tenant_slug, code),
  CONSTRAINT assets_category_fk FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE RESTRICT
);

-- Depreciation Schedules (Monthly calculation records)
CREATE TABLE IF NOT EXISTS depreciation_schedules (
  id BIGSERIAL PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  asset_id BIGINT NOT NULL,
  
  -- Period Info
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  
  -- Book Value at Start of Period
  opening_net_book_value DECIMAL(19, 2) NOT NULL,
  
  -- Depreciation Calculation
  depreciation_rate DECIMAL(8, 4),
  depreciation_amount DECIMAL(19, 2) NOT NULL,
  
  -- Book Value at End of Period
  closing_net_book_value DECIMAL(19, 2) NOT NULL,
  
  -- Journal Posting
  is_posted BOOLEAN DEFAULT FALSE,
  journal_entry_id UUID,
  posted_at TIMESTAMP,
  
  -- Status
  status VARCHAR(20) NOT NULL CHECK (status IN ('DRAFT', 'CALCULATED', 'POSTED', 'REVERSED')) DEFAULT 'DRAFT',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT unique_asset_period UNIQUE (asset_id, period_year, period_month),
  CONSTRAINT depreciation_schedules_asset_fk FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT depreciation_schedules_journal_fk FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE SET NULL
);

-- Asset Journals (Depreciation journal entries)
CREATE TABLE IF NOT EXISTS asset_journals (
  id BIGSERIAL PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  asset_id BIGINT NOT NULL,
  
  -- Transaction Info
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('ACQUISITION', 'DEPRECIATION', 'REVALUATION', 'DISPOSAL')),
  transaction_date DATE NOT NULL,
  
  -- Amount Details
  debit_amount DECIMAL(19, 2),
  credit_amount DECIMAL(19, 2),
  
  -- Accounts
  debit_account_id BIGINT,
  credit_account_id BIGINT,
  
  -- GL Integration
  journal_entry_id UUID,
  posted_to_gl BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  description TEXT,
  reference_number VARCHAR(255),
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT asset_journals_asset_fk FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- Asset Disposals (Scrapping, selling)
CREATE TABLE IF NOT EXISTS asset_disposals (
  id BIGSERIAL PRIMARY KEY,
  tenant_slug TEXT NOT NULL,
  asset_id BIGINT NOT NULL,
  
  -- Disposal Info
  disposal_date DATE NOT NULL,
  disposal_method VARCHAR(30) NOT NULL CHECK (disposal_method IN ('SCRAP', 'SALE', 'DONATION', 'EXCHANGE')),
  
  -- Financial Details
  sale_price DECIMAL(19, 2),
  net_book_value_at_disposal DECIMAL(19, 2),
  gain_loss DECIMAL(19, 2),
  
  -- GL Impact
  cash_receipt_account_id BIGINT,
  gain_loss_account_id BIGINT,
  
  -- Journal Posting
  journal_entry_id UUID,
  is_posted BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  notes TEXT,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT asset_disposals_asset_fk FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_assets_tenant_slug ON assets(tenant_slug);
CREATE INDEX idx_assets_category_id ON assets(category_id);
CREATE INDEX idx_assets_status ON assets(asset_status);
CREATE INDEX idx_assets_purchase_date ON assets(purchase_date DESC);

CREATE INDEX idx_asset_categories_tenant_slug ON asset_categories(tenant_slug);
CREATE INDEX idx_asset_categories_active ON asset_categories(is_active);

CREATE INDEX idx_depreciation_schedules_asset_id ON depreciation_schedules(asset_id);
CREATE INDEX idx_depreciation_schedules_period ON depreciation_schedules(period_year, period_month);
CREATE INDEX idx_depreciation_schedules_status ON depreciation_schedules(status);
CREATE INDEX idx_depreciation_schedules_posted ON depreciation_schedules(is_posted);

CREATE INDEX idx_asset_journals_asset_id ON asset_journals(asset_id);
CREATE INDEX idx_asset_journals_type ON asset_journals(transaction_type);
CREATE INDEX idx_asset_journals_date ON asset_journals(transaction_date DESC);

CREATE INDEX idx_asset_disposals_asset_id ON asset_disposals(asset_id);
CREATE INDEX idx_asset_disposals_date ON asset_disposals(disposal_date DESC);

-- VIEWS FOR REPORTING

-- Asset Register Summary
CREATE OR REPLACE VIEW asset_register_view AS
SELECT
  a.id,
  a.tenant_slug,
  a.code,
  a.name,
  ac.name as category_name,
  a.purchase_date,
  a.purchase_cost,
  a.useful_life_years,
  a.depreciation_method,
  a.accumulated_depreciation,
  (a.purchase_cost - a.accumulated_depreciation) as net_book_value,
  a.asset_status,
  a.location,
  EXTRACT(YEAR FROM a.purchase_date) as purchase_year,
  (CURRENT_DATE - a.purchase_date) as days_in_use
FROM assets a
LEFT JOIN asset_categories ac ON a.category_id = ac.id;

-- Depreciation Summary by Category
CREATE OR REPLACE VIEW depreciation_summary_view AS
SELECT
  a.tenant_slug,
  ac.id as category_id,
  ac.name as category_name,
  COUNT(a.id) as asset_count,
  SUM(a.purchase_cost) as total_purchase_cost,
  SUM(a.accumulated_depreciation) as total_accumulated_depreciation,
  SUM(a.purchase_cost - a.accumulated_depreciation) as total_net_book_value,
  SUM(CASE WHEN ds.depreciation_amount IS NOT NULL THEN ds.depreciation_amount ELSE 0 END) as current_period_depreciation
FROM assets a
LEFT JOIN asset_categories ac ON a.category_id = ac.id
LEFT JOIN depreciation_schedules ds ON a.id = ds.asset_id AND EXTRACT(YEAR FROM ds.period_start_date) = EXTRACT(YEAR FROM CURRENT_DATE)
WHERE a.asset_status != 'DISPOSED'
GROUP BY a.tenant_slug, ac.id, ac.name;

-- Next Depreciation Schedule
CREATE OR REPLACE VIEW next_depreciation_schedules_view AS
SELECT
  a.id as asset_id,
  a.tenant_slug,
  a.code,
  a.name,
  ac.name as category_name,
  a.purchase_cost,
  a.accumulated_depreciation,
  (a.purchase_cost - a.accumulated_depreciation) as current_net_book_value,
  COALESCE(MAX(ds.period_year), EXTRACT(YEAR FROM a.purchase_date)) as last_depreciation_year,
  COALESCE(MAX(ds.period_month), 0) as last_depreciation_month
FROM assets a
LEFT JOIN asset_categories ac ON a.category_id = ac.id
LEFT JOIN depreciation_schedules ds ON a.id = ds.asset_id AND ds.is_posted = TRUE
WHERE a.asset_status IN ('IN_USE', 'REVALUED')
GROUP BY a.id, a.tenant_slug, a.code, a.name, ac.name, a.purchase_cost, a.accumulated_depreciation;
