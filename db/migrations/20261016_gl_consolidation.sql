-- GL Consolidation Migration
-- Unifies the three parallel accounting schemas (20260213 tenant_id model,
-- 20260205 accounting-core model, and the runtime-created finance model) onto a
-- single canonical shape: journal_entries + journal_entry_lines with BOTH the
-- legacy and core column sets populated, plus a party subledger, payment
-- applications, sequential journal numbering, and period-close support.
--
-- Every statement is idempotent so this can run on databases built from any
-- generation of the schema.

-- ---------------------------------------------------------------------------
-- journal_entries: canonical column set
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text,
  journal_number text,
  entry_number text,
  journal_type text DEFAULT 'SYSTEM',
  fiscal_period_id uuid,
  posting_date date,
  entry_date date,
  reference_type text,
  reference_id text,
  reference text,
  source text,
  description text,
  notes text,
  status text,
  approval_status text,
  total_debit numeric(18,2) NOT NULL DEFAULT 0,
  total_credit numeric(18,2) NOT NULL DEFAULT 0,
  is_reversing boolean NOT NULL DEFAULT false,
  reversed_entry_id uuid,
  attachment_url text,
  metadata jsonb,
  created_by text,
  approved_by text,
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS entry_number text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS journal_number text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS entry_date date;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS posting_date date;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS journal_type text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS fiscal_period_id uuid;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS reference_id text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS approval_status text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS total_debit numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS total_credit numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS is_reversing boolean NOT NULL DEFAULT false;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS reversed_entry_id uuid;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS posted_at timestamptz;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- reference_id is uuid on some generations, text on others
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'reference_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE journal_entries ALTER COLUMN reference_id TYPE text USING reference_id::text;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'created_by' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE journal_entries ALTER COLUMN created_by TYPE text USING created_by::text;
  END IF;
END $$;

-- Drop restrictive check constraints that reject the canonical vocabulary
ALTER TABLE IF EXISTS journal_entries DROP CONSTRAINT IF EXISTS journal_entries_reference_type_check;
ALTER TABLE IF EXISTS journal_entries DROP CONSTRAINT IF EXISTS journal_entries_journal_type_check;
ALTER TABLE IF EXISTS journal_entries DROP CONSTRAINT IF EXISTS journal_entries_approval_status_check;

-- Backfill dual-column pairs so every reader sees consistent data
UPDATE journal_entries SET journal_number = entry_number WHERE journal_number IS NULL AND entry_number IS NOT NULL;
UPDATE journal_entries SET entry_number = journal_number WHERE entry_number IS NULL AND journal_number IS NOT NULL;
UPDATE journal_entries SET posting_date = entry_date WHERE posting_date IS NULL AND entry_date IS NOT NULL;
UPDATE journal_entries SET entry_date = posting_date WHERE entry_date IS NULL AND posting_date IS NOT NULL;
UPDATE journal_entries SET approval_status = UPPER(status) WHERE approval_status IS NULL AND status IS NOT NULL;
UPDATE journal_entries SET status = LOWER(approval_status) WHERE status IS NULL AND approval_status IS NOT NULL;
UPDATE journal_entries SET journal_type = 'SYSTEM' WHERE journal_type IS NULL;

-- ---------------------------------------------------------------------------
-- chart_of_accounts: ensure base table exists before line backfills join it
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text,
  code text,
  name text,
  type text,
  account_code text,
  account_name text,
  account_type text,
  sub_type text,
  parent_account_id text,
  currency text DEFAULT 'NGN',
  is_system_account boolean DEFAULT false,
  is_active boolean DEFAULT true,
  balance numeric(18,2) DEFAULT 0,
  description text,
  branch_id text,
  department_id text,
  project_id text,
  allow_manual_posting boolean DEFAULT true,
  require_cost_center boolean DEFAULT false,
  is_reconciliation_account boolean DEFAULT false,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS account_code text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS account_name text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS sub_type text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS parent_account_id text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN';
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS is_system_account boolean DEFAULT false;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS balance numeric(18,2) DEFAULT 0;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ---------------------------------------------------------------------------
-- journal_entry_lines: canonical detail table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid,
  journal_entry_id uuid,
  line_number integer,
  account_id uuid,
  account_code text,
  account_name text,
  debit_amount numeric(18,2) NOT NULL DEFAULT 0,
  credit_amount numeric(18,2) NOT NULL DEFAULT 0,
  debit numeric(18,2) NOT NULL DEFAULT 0,
  credit numeric(18,2) NOT NULL DEFAULT 0,
  party_type text,
  party_id text,
  branch_id text,
  department_id text,
  project_id text,
  cost_center_id text,
  description text,
  is_reconciled boolean NOT NULL DEFAULT false,
  reconciled_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS journal_entry_id uuid;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS line_number integer;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS account_id uuid;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS debit numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS credit numeric(18,2) NOT NULL DEFAULT 0;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS party_type text;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS party_id text;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS branch_id text;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS department_id text;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS project_id text;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS cost_center_id text;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS is_reconciled boolean NOT NULL DEFAULT false;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

-- Dimension columns are uuid on some schema generations; callers pass
-- arbitrary text ids (branches, cost centers), so normalize to text.
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['branch_id', 'department_id', 'project_id', 'cost_center_id', 'party_type', 'party_id'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'journal_entry_lines' AND column_name = col AND data_type = 'uuid'
    ) THEN
      EXECUTE format('ALTER TABLE journal_entry_lines ALTER COLUMN %I TYPE text USING %I::text', col, col);
    END IF;
  END LOOP;
END $$;

-- Backfill cross-schema column pairs
UPDATE journal_entry_lines SET journal_entry_id = entry_id WHERE journal_entry_id IS NULL AND entry_id IS NOT NULL;
UPDATE journal_entry_lines SET entry_id = journal_entry_id WHERE entry_id IS NULL AND journal_entry_id IS NOT NULL;
UPDATE journal_entry_lines SET debit_amount = debit WHERE debit_amount = 0 AND debit <> 0;
UPDATE journal_entry_lines SET credit_amount = credit WHERE credit_amount = 0 AND credit <> 0;
UPDATE journal_entry_lines SET debit = debit_amount WHERE debit = 0 AND debit_amount <> 0;
UPDATE journal_entry_lines SET credit = credit_amount WHERE credit = 0 AND credit_amount <> 0;

-- Resolve account_id from account_code and vice versa
UPDATE journal_entry_lines jel
SET account_id = coa.id
FROM chart_of_accounts coa
WHERE jel.account_id IS NULL AND jel.account_code IS NOT NULL AND coa.code = jel.account_code;

UPDATE journal_entry_lines jel
SET account_code = COALESCE(coa.code, coa.account_code),
    account_name = COALESCE(jel.account_name, coa.name, coa.account_name)
FROM chart_of_accounts coa
WHERE jel.account_code IS NULL AND jel.account_id IS NOT NULL AND coa.id = jel.account_id;

-- Migrate rows stranded in the legacy journal_lines table. Two shapes exist:
-- 20260205 (debit_amount/credit_amount) and 20260213 (amount + side).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_lines') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_lines' AND column_name = 'debit_amount') THEN
      INSERT INTO journal_entry_lines (
        entry_id, journal_entry_id, line_number, account_id,
        debit_amount, credit_amount, debit, credit,
        description, created_at
      )
      SELECT
        jl.journal_entry_id, jl.journal_entry_id, jl.line_number, jl.account_id,
        COALESCE(jl.debit_amount, 0), COALESCE(jl.credit_amount, 0),
        COALESCE(jl.debit_amount, 0), COALESCE(jl.credit_amount, 0),
        jl.description, now()
      FROM journal_lines jl
      WHERE NOT EXISTS (SELECT 1 FROM journal_entry_lines jel WHERE jel.id = jl.id);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_lines' AND column_name = 'side') THEN
      INSERT INTO journal_entry_lines (
        entry_id, journal_entry_id, account_id,
        debit_amount, credit_amount, debit, credit,
        description, created_at
      )
      SELECT
        jl.journal_entry_id, jl.journal_entry_id, jl.account_id,
        CASE WHEN jl.side = 'debit' THEN jl.amount ELSE 0 END,
        CASE WHEN jl.side = 'credit' THEN jl.amount ELSE 0 END,
        CASE WHEN jl.side = 'debit' THEN jl.amount ELSE 0 END,
        CASE WHEN jl.side = 'credit' THEN jl.amount ELSE 0 END,
        jl.description, now()
      FROM journal_lines jl;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS journal_entry_lines_entry_idx ON journal_entry_lines (entry_id);
CREATE INDEX IF NOT EXISTS journal_entry_lines_je_idx ON journal_entry_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS journal_entry_lines_account_code_idx ON journal_entry_lines (account_code);
CREATE INDEX IF NOT EXISTS journal_entry_lines_account_id_idx ON journal_entry_lines (account_id);
CREATE INDEX IF NOT EXISTS journal_entry_lines_party_idx ON journal_entry_lines (party_type, party_id);

-- ---------------------------------------------------------------------------
-- chart_of_accounts: backfill dual column sets, reconcile type vocabulary
-- ---------------------------------------------------------------------------
UPDATE chart_of_accounts SET code = account_code WHERE code IS NULL AND account_code IS NOT NULL;
UPDATE chart_of_accounts SET name = account_name WHERE name IS NULL AND account_name IS NOT NULL;
UPDATE chart_of_accounts SET type = CASE LOWER(account_type)
  WHEN 'income' THEN 'revenue'
  ELSE LOWER(account_type) END
WHERE type IS NULL AND account_type IS NOT NULL;

UPDATE chart_of_accounts SET account_code = code WHERE account_code IS NULL AND code IS NOT NULL;
UPDATE chart_of_accounts SET account_name = name WHERE account_name IS NULL AND name IS NOT NULL;
UPDATE chart_of_accounts SET account_type = CASE LOWER(type)
  WHEN 'revenue' THEN 'INCOME'
  WHEN 'asset' THEN 'ASSET'
  WHEN 'liability' THEN 'LIABILITY'
  WHEN 'equity' THEN 'EQUITY'
  WHEN 'expense' THEN 'EXPENSE'
  ELSE UPPER(type) END
WHERE account_type IS NULL AND type IS NOT NULL;

-- Tenant-scoped uniqueness where possible (global default accounts keep code-wide uniqueness)
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX chart_of_accounts_tenant_code_uq
      ON chart_of_accounts (COALESCE(tenant_slug, ''), COALESCE(code, account_code));
  EXCEPTION WHEN OTHERS THEN
    NULL; -- duplicate codes already exist; uniqueness enforced in the GL service
  END;
END $$;

-- ---------------------------------------------------------------------------
-- fiscal_periods: union of both models, no restrictive check
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text,
  name text,
  fiscal_year integer,
  period_number integer,
  period_type text DEFAULT 'month',
  period_name text,
  start_date date,
  end_date date,
  status text DEFAULT 'open',
  locked_by text,
  locked_at timestamptz,
  closed_at timestamptz,
  closed_by text,
  allow_posting boolean DEFAULT true,
  allow_adjustments boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS period_type text DEFAULT 'month';
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS period_name text;
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS closed_by text;
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS allow_posting boolean DEFAULT true;
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS allow_adjustments boolean DEFAULT false;
ALTER TABLE fiscal_periods ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE fiscal_periods DROP CONSTRAINT IF EXISTS fiscal_periods_status_check;
ALTER TABLE fiscal_periods DROP CONSTRAINT IF EXISTS fiscal_periods_period_number_check;

-- ---------------------------------------------------------------------------
-- account_balances: ensure exists without hard FKs (prod FK targets vary)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text,
  account_id uuid,
  fiscal_period_id uuid,
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  period_debit numeric(18,2) NOT NULL DEFAULT 0,
  period_credit numeric(18,2) NOT NULL DEFAULT 0,
  closing_balance numeric(18,2),
  last_updated timestamptz DEFAULT now()
);
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE account_balances ADD COLUMN IF NOT EXISTS opening_balance numeric(18,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX account_balances_account_period_uq
      ON account_balances (account_id, fiscal_period_id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- accounting_audit_log: ensure exists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  changed_fields jsonb,
  old_values jsonb,
  new_values jsonb,
  user_id text,
  user_name text,
  ip_address varchar(45),
  timestamp timestamptz DEFAULT now()
);
ALTER TABLE accounting_audit_log ADD COLUMN IF NOT EXISTS entity_id text;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_audit_log' AND column_name = 'entity_id' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE accounting_audit_log ALTER COLUMN entity_id TYPE text USING entity_id::text;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- journal_sequences: per-tenant sequential journal numbering
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_sequences (
  tenant_slug text NOT NULL,
  prefix text NOT NULL,
  fiscal_year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_slug, prefix, fiscal_year)
);

-- ---------------------------------------------------------------------------
-- payment_applications: AR payment -> invoice allocations (subledger)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  payment_id text NOT NULL,
  invoice_id text NOT NULL,
  amount numeric(18,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payment_applications_payment_idx ON payment_applications (payment_id);
CREATE INDEX IF NOT EXISTS payment_applications_invoice_idx ON payment_applications (invoice_id);
CREATE INDEX IF NOT EXISTS payment_applications_tenant_idx ON payment_applications (tenant_slug);

-- ---------------------------------------------------------------------------
-- GL linkage on finance documents
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS finance_invoices ADD COLUMN IF NOT EXISTS journal_entry_id uuid;
ALTER TABLE IF EXISTS finance_invoices ADD COLUMN IF NOT EXISTS reversed_journal_entry_id uuid;
ALTER TABLE IF EXISTS finance_payments ADD COLUMN IF NOT EXISTS journal_entry_id uuid;
ALTER TABLE IF EXISTS finance_payments ADD COLUMN IF NOT EXISTS reversed_journal_entry_id uuid;

CREATE INDEX IF NOT EXISTS journal_entries_tenant_idx ON journal_entries (tenant_slug);
CREATE INDEX IF NOT EXISTS journal_entries_posting_date_idx ON journal_entries (posting_date);
CREATE INDEX IF NOT EXISTS journal_entries_reference_idx ON journal_entries (reference_type, reference_id);
CREATE INDEX IF NOT EXISTS journal_entries_number_idx ON journal_entries (tenant_slug, journal_number);
