-- FINANCIAL REPORTS MODULE
-- Reporting views and helpers for P&L, Balance Sheet, Cash Flow, Aged Receivables/Payables

-- ============================================================================
-- PROFIT & LOSS REPORT VIEW
-- ============================================================================

CREATE OR REPLACE VIEW p_and_l_view AS
WITH revenue_actuals AS (
  -- Get all revenue transactions (positive income accounts)
  SELECT
    ca.id as chart_account_id,
    ca.account_code,
    ca.account_name,
    'INCOME' as account_type,
    SUM(jl.debit_amount - jl.credit_amount) as amount_total
  FROM chart_of_accounts ca
  JOIN journal_lines jl ON ca.id = jl.account_id
  JOIN journal_entries je ON jl.journal_entry_id = je.id
  WHERE ca.account_type = 'INCOME'
  AND je.approval_status = 'POSTED'
  GROUP BY ca.id, ca.account_code, ca.account_name
),
expense_actuals AS (
  -- Get all expense transactions
  SELECT
    ca.id as chart_account_id,
    ca.account_code,
    ca.account_name,
    'EXPENSE' as account_type,
    SUM(jl.debit_amount - jl.credit_amount) as amount_total
  FROM chart_of_accounts ca
  JOIN journal_lines jl ON ca.id = jl.account_id
  JOIN journal_entries je ON jl.journal_entry_id = je.id
  WHERE ca.account_type = 'EXPENSE'
  AND je.approval_status = 'POSTED'
  GROUP BY ca.id, ca.account_code, ca.account_name
)
SELECT
  'REVENUE' as section,
  account_code,
  account_name,
  amount_total,
  'INCOME' as account_type
FROM revenue_actuals
UNION ALL
SELECT
  'EXPENSES' as section,
  account_code,
  account_name,
  amount_total,
  'EXPENSE' as account_type
FROM expense_actuals;

-- ============================================================================
-- BALANCE SHEET REPORT VIEW
-- ============================================================================

CREATE OR REPLACE VIEW balance_sheet_view AS
WITH asset_balances AS (
  SELECT
    'ASSETS' as section,
    ca.account_code,
    ca.account_name,
    'ASSET' as account_type,
    COALESCE(ab.closing_balance, 0) as balance
  FROM chart_of_accounts ca
  LEFT JOIN account_balances ab ON ca.id = ab.account_id
  WHERE ca.account_type = 'ASSET'
),
liability_balances AS (
  SELECT
    'LIABILITIES' as section,
    ca.account_code,
    ca.account_name,
    'LIABILITY' as account_type,
    COALESCE(ab.closing_balance, 0) as balance
  FROM chart_of_accounts ca
  LEFT JOIN account_balances ab ON ca.id = ab.account_id
  WHERE ca.account_type = 'LIABILITY'
),
equity_balances AS (
  SELECT
    'EQUITY' as section,
    ca.account_code,
    ca.account_name,
    'EQUITY' as account_type,
    COALESCE(ab.closing_balance, 0) as balance
  FROM chart_of_accounts ca
  LEFT JOIN account_balances ab ON ca.id = ab.account_id
  WHERE ca.account_type = 'EQUITY'
)
SELECT * FROM asset_balances
UNION ALL
SELECT * FROM liability_balances
UNION ALL
SELECT * FROM equity_balances;

-- ============================================================================
-- CASH FLOW REPORT VIEW
-- ============================================================================

CREATE OR REPLACE VIEW cash_flow_view AS
SELECT
  je.created_at::DATE as transaction_date,
  CASE
    WHEN ca.account_type = 'ASSET' AND ca.account_code LIKE '1010%' THEN 'OPERATING'
    WHEN ca.account_type = 'ASSET' AND ca.account_code LIKE '1%' THEN 'INVESTING'
    WHEN ca.account_type = 'LIABILITY' THEN 'FINANCING'
    ELSE 'OPERATING'
  END as cash_flow_category,
  ca.account_code,
  ca.account_name,
  SUM(jl.debit_amount - jl.credit_amount) as net_cash_flow
FROM journal_entries je
JOIN journal_lines jl ON je.id = jl.journal_entry_id
JOIN chart_of_accounts ca ON jl.account_id = ca.id
WHERE je.approval_status = 'POSTED'
AND ca.account_type IN ('ASSET', 'LIABILITY')
GROUP BY je.created_at::DATE, cash_flow_category, ca.account_code, ca.account_name;

-- ============================================================================
-- AGED RECEIVABLES (Accounts Receivable Aging)
-- ============================================================================

CREATE OR REPLACE VIEW aged_receivables_view AS
SELECT
  ar.id,
  ar.invoice_id,
  ar.customer_name,
  ar.amount,
  CURRENT_DATE - ar.invoice_date as days_outstanding,
  CASE
    WHEN CURRENT_DATE - ar.invoice_date <= 30 THEN 'Current'
    WHEN CURRENT_DATE - ar.invoice_date <= 60 THEN '31-60 days'
    WHEN CURRENT_DATE - ar.invoice_date <= 90 THEN '61-90 days'
    WHEN CURRENT_DATE - ar.invoice_date <= 120 THEN '91-120 days'
    ELSE 'Over 120 days'
  END as aging_bucket,
  ar.invoice_date,
  ar.due_date,
  ar.amount - COALESCE(ar.paid_amount, 0) as outstanding_amount
FROM (
  -- Reconstruct AR from invoice and payment journals
  SELECT DISTINCT
    ROW_NUMBER() OVER (ORDER BY je.id) as id,
    je.id as invoice_id,
    'Customer XYZ' as customer_name,  -- Would join to customer table
    SUM(jl.debit_amount) as amount,
    je.created_at::DATE as invoice_date,
    (je.created_at::DATE + INTERVAL '30 days') as due_date,
    0 as paid_amount
  FROM journal_entries je
  JOIN journal_lines jl ON je.id = jl.journal_entry_id
  WHERE je.description LIKE '%Invoice%'
  GROUP BY je.id, je.created_at
) ar;

-- ============================================================================
-- AGED PAYABLES (Accounts Payable Aging)
-- ============================================================================

CREATE OR REPLACE VIEW aged_payables_view AS
SELECT
  ap.id,
  ap.invoice_id,
  ap.vendor_name,
  ap.amount,
  CURRENT_DATE - ap.invoice_date as days_outstanding,
  CASE
    WHEN CURRENT_DATE - ap.invoice_date <= 30 THEN 'Current'
    WHEN CURRENT_DATE - ap.invoice_date <= 60 THEN '31-60 days'
    WHEN CURRENT_DATE - ap.invoice_date <= 90 THEN '61-90 days'
    WHEN CURRENT_DATE - ap.invoice_date <= 120 THEN '91-120 days'
    ELSE 'Over 120 days'
  END as aging_bucket,
  ap.invoice_date,
  ap.due_date,
  ap.amount - COALESCE(ap.paid_amount, 0) as outstanding_amount
FROM (
  -- Reconstruct AP from invoice and payment journals
  SELECT DISTINCT
    ROW_NUMBER() OVER (ORDER BY je.id) as id,
    je.id as invoice_id,
    'Vendor XYZ' as vendor_name,  -- Would join to vendor table
    SUM(jl.credit_amount) as amount,
    je.created_at::DATE as invoice_date,
    (je.created_at::DATE + INTERVAL '30 days') as due_date,
    0 as paid_amount
  FROM journal_entries je
  JOIN journal_lines jl ON je.id = jl.journal_entry_id
  WHERE je.description LIKE '%Invoice%'
  GROUP BY je.id, je.created_at
) ap;

-- ============================================================================
-- TRIAL BALANCE ENHANCED VIEW
-- ============================================================================

CREATE OR REPLACE VIEW trial_balance_extended_view AS
SELECT
  ca.id,
  ca.account_code,
  ca.account_name,
  ca.account_type,
  ca.sub_type,
  tb.debit_balance,
  tb.credit_balance,
  tb.debit_balance - tb.credit_balance as net_balance
FROM chart_of_accounts ca
LEFT JOIN (
  SELECT
    account_id,
    SUM(debit_amount) as debit_balance,
    SUM(credit_amount) as credit_balance
  FROM journal_lines
  WHERE journal_entry_id IN (
    SELECT id FROM journal_entries WHERE approval_status = 'POSTED'
  )
  GROUP BY account_id
) tb ON ca.id = tb.account_id
ORDER BY ca.account_type, ca.account_code;

-- ============================================================================
-- GENERAL LEDGER EXTENDED VIEW
-- ============================================================================

CREATE OR REPLACE VIEW general_ledger_extended_view AS
SELECT
  ca.account_code,
  ca.account_name,
  ca.account_type,
  je.created_at::DATE as transaction_date,
  jl.description,
  jl.debit_amount,
  jl.credit_amount
FROM journal_lines jl
JOIN journal_entries je ON jl.journal_entry_id = je.id
JOIN chart_of_accounts ca ON jl.account_id = ca.id
WHERE je.approval_status = 'POSTED'
ORDER BY ca.account_code, je.created_at;

-- ============================================================================
-- INDEXES FOR REPORT QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(approval_status);
CREATE INDEX idx_journal_entries_created_at ON journal_entries(created_at DESC);
CREATE INDEX idx_journal_lines_account_id ON journal_lines(account_id);
CREATE INDEX idx_journal_lines_journal_entry_id ON journal_lines(journal_entry_id);
CREATE INDEX idx_chart_of_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX idx_account_balances_account_id ON account_balances(account_id);
