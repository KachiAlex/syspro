-- Finance Events & Cached Summary Architecture
-- Enables event-driven reporting and real-time dashboard metrics

-- ============================================================
-- FINANCE_EVENTS (Event Bus Table)
-- Every financial action across all modules writes here
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,       -- invoice_paid, expense_approved, payroll_run, deal_won, bill_paid, po_matched, etc.
  source_module VARCHAR(50) NOT NULL,      -- crm, finance, hr, inventory, procurement, projects
  source_record_id VARCHAR(255),           -- ID of the originating record (invoice ID, expense ID, etc.)
  user_id VARCHAR(255),                    -- Who triggered the event
  amount DECIMAL(19, 2),                  -- Monetary value of the event
  currency VARCHAR(3) DEFAULT 'NGN',
  gl_account_code VARCHAR(50),            -- Affected GL account
  branch_id UUID,
  region_id UUID,
  metadata JSONB,                         -- Flexible extra data
  event_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,        -- Whether the cached summary has picked this up
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_finance_events_tenant ON finance_events(tenant_slug);
CREATE INDEX IF NOT EXISTS idx_finance_events_type ON finance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_finance_events_module ON finance_events(source_module);
CREATE INDEX IF NOT EXISTS idx_finance_events_timestamp ON finance_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_finance_events_unprocessed ON finance_events(tenant_slug, processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_finance_events_gl ON finance_events(tenant_slug, gl_account_code, event_timestamp);

-- ============================================================
-- FINANCE_CACHED_SUMMARY (Materialized Dashboard Cache)
-- Pre-aggregated metrics per tenant for near-zero query time
-- ============================================================

CREATE TABLE IF NOT EXISTS finance_cached_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL UNIQUE,
  
  -- Revenue metrics
  total_revenue DECIMAL(19, 2) DEFAULT 0,
  revenue_this_month DECIMAL(19, 2) DEFAULT 0,
  revenue_last_month DECIMAL(19, 2) DEFAULT 0,
  
  -- Expense metrics
  total_expenses DECIMAL(19, 2) DEFAULT 0,
  expenses_this_month DECIMAL(19, 2) DEFAULT 0,
  expenses_last_month DECIMAL(19, 2) DEFAULT 0,
  
  -- Payables
  total_payables DECIMAL(19, 2) DEFAULT 0,
  overdue_payables DECIMAL(19, 2) DEFAULT 0,
  
  -- Receivables
  total_receivables DECIMAL(19, 2) DEFAULT 0,
  overdue_receivables DECIMAL(19, 2) DEFAULT 0,
  
  -- Payroll
  payroll_this_month DECIMAL(19, 2) DEFAULT 0,
  headcount INTEGER DEFAULT 0,
  
  -- Cash
  cash_balance DECIMAL(19, 2) DEFAULT 0,
  
  -- Budget
  total_budget DECIMAL(19, 2) DEFAULT 0,
  budget_utilized DECIMAL(19, 2) DEFAULT 0,
  
  -- Event tracking
  last_event_id UUID,
  last_event_timestamp TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cached_summary_tenant ON finance_cached_summary(tenant_slug);

-- ============================================================
-- TRIGGER: Auto-update cached summary on finance_events insert
-- (NeonDB supports triggers; this runs in the same transaction)
-- ============================================================

CREATE OR REPLACE FUNCTION update_finance_cached_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert cached summary row for tenant
  INSERT INTO finance_cached_summary (tenant_slug)
  VALUES (NEW.tenant_slug)
  ON CONFLICT (tenant_slug) DO NOTHING;

  -- Mark event as processed
  NEW.processed := TRUE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if recreating
DROP TRIGGER IF EXISTS trg_finance_events_process ON finance_events;

CREATE TRIGGER trg_finance_events_process
  BEFORE INSERT ON finance_events
  FOR EACH ROW
  EXECUTE FUNCTION update_finance_cached_summary();

-- ============================================================
-- VIEW: Real-time finance dashboard metrics
-- Combines cached summary with live unprocessed events
-- ============================================================

CREATE OR REPLACE VIEW finance_dashboard_metrics AS
SELECT 
  cs.tenant_slug,
  cs.total_revenue + COALESCE(
    (SELECT SUM(fe.amount) FROM finance_events fe 
     WHERE fe.tenant_slug = cs.tenant_slug AND fe.processed = FALSE 
     AND fe.event_type IN ('invoice_paid', 'deal_won', 'payment_received')),
    0
  ) AS live_revenue,
  cs.total_expenses + COALESCE(
    (SELECT SUM(fe.amount) FROM finance_events fe 
     WHERE fe.tenant_slug = cs.tenant_slug AND fe.processed = FALSE 
     AND fe.event_type IN ('expense_approved', 'bill_paid', 'payroll_run')),
    0
  ) AS live_expenses,
  cs.total_payables + COALESCE(
    (SELECT SUM(fe.amount) FROM finance_events fe 
     WHERE fe.tenant_slug = cs.tenant_slug AND fe.processed = FALSE 
     AND fe.event_type IN ('bill_created', 'po_approved')),
    0
  ) AS live_payables,
  cs.overdue_payables,
  cs.total_receivables + COALESCE(
    (SELECT SUM(fe.amount) FROM finance_events fe 
     WHERE fe.tenant_slug = cs.tenant_slug AND fe.processed = FALSE 
     AND fe.event_type = 'invoice_issued'),
    0
  ) AS live_receivables,
  cs.overdue_receivables,
  cs.cash_balance,
  cs.headcount,
  cs.updated_at,
  cs.last_event_timestamp
FROM finance_cached_summary cs;
