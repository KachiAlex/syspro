-- Finance schema reconciliation for databases that carry legacy finance tables.
-- Production was built from an older generation of migrations: vendors uses
-- code/name/payment_terms/is_active, journal_entries/chart_of_accounts use
-- tenant_id instead of tenant_slug, and several newer tables are missing even
-- though schema_migrations records them as applied.
--
-- Every statement is idempotent. Legacy columns are kept and backfilled into
-- the newer columns the application code expects.

-- ---------------------------------------------------------------------------
-- vendors: bridge legacy columns to the vendor_code/legal_name/status model
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS vendor_code text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS vendor_type text DEFAULT 'goods';
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS default_currency text DEFAULT 'NGN';
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS default_payment_terms text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS default_expense_account text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS default_tax_rules jsonb;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS bank_details jsonb;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE IF EXISTS vendors ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Legacy schemas mark name/code NOT NULL; the code writes legal_name/vendor_code instead
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendors' AND column_name='name') THEN
    ALTER TABLE vendors ALTER COLUMN name DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendors' AND column_name='code') THEN
    ALTER TABLE vendors ALTER COLUMN code DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendors' AND column_name='code') THEN
    UPDATE vendors SET vendor_code = code WHERE vendor_code IS NULL AND code IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendors' AND column_name='name') THEN
    UPDATE vendors SET legal_name = name WHERE legal_name IS NULL AND name IS NOT NULL;
    UPDATE vendors SET display_name = COALESCE(display_name, name);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendors' AND column_name='payment_terms') THEN
    UPDATE vendors SET default_payment_terms = payment_terms WHERE default_payment_terms IS NULL AND payment_terms IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendors' AND column_name='is_active') THEN
    UPDATE vendors SET status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END WHERE status IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vendors' AND column_name='account_number') THEN
    UPDATE vendors SET bank_details = jsonb_build_object('accountNumber', account_number, 'bankCode', bank_code, 'bankName', bank_name)
      WHERE bank_details IS NULL AND (account_number IS NOT NULL OR bank_code IS NOT NULL OR bank_name IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS vendors_display_name_idx ON vendors (display_name);
CREATE INDEX IF NOT EXISTS vendors_vendor_code_idx ON vendors (vendor_code);
CREATE INDEX IF NOT EXISTS vendors_tenant_idx ON vendors (tenant_slug);

-- ---------------------------------------------------------------------------
-- journal_entries / chart_of_accounts: add tenant_slug model columns
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS journal_entries ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE IF EXISTS chart_of_accounts ALTER COLUMN tenant_id DROP NOT NULL;

ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS entry_number text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS entry_date date;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS reference_type text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS reference_id uuid;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE IF EXISTS journal_entries ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS code text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE IF EXISTS chart_of_accounts ADD COLUMN IF NOT EXISTS type text;

CREATE INDEX IF NOT EXISTS journal_entries_tenant_idx ON journal_entries (tenant_slug);
CREATE INDEX IF NOT EXISTS coa_tenant_idx ON chart_of_accounts (tenant_slug);

-- ---------------------------------------------------------------------------
-- approvals: used by src/lib/finance/approvals.ts (was only ever ALTERed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  rule_id uuid,
  status text NOT NULL DEFAULT 'pending',
  requested_by text,
  approver_chain jsonb,
  decisions jsonb,
  current_step integer NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE IF EXISTS approvals ADD COLUMN IF NOT EXISTS tenant_slug text;
ALTER TABLE IF EXISTS approvals ADD COLUMN IF NOT EXISTS rule_id uuid;
CREATE INDEX IF NOT EXISTS approvals_tenant_idx ON approvals (tenant_slug);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON approvals (status);

-- ---------------------------------------------------------------------------
-- vendor payments (accounts payable settlement)
-- ---------------------------------------------------------------------------
-- NOTE: vendor/PO ids are text in some DBs and uuid in others — no REFERENCES
-- constraints on the vendor side so this works on both generations.
CREATE TABLE IF NOT EXISTS vendor_payments (
  id text PRIMARY KEY,
  tenant_slug text NOT NULL,
  payment_number text NOT NULL,
  vendor_id text NOT NULL,
  method text NOT NULL DEFAULT 'bank_transfer',
  currency text NOT NULL DEFAULT 'NGN',
  amount numeric(18,2) NOT NULL DEFAULT 0,
  applied_amount numeric(18,2) NOT NULL DEFAULT 0,
  unapplied_amount numeric(18,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  bank_details jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_payments_tenant_idx ON vendor_payments (tenant_slug);
CREATE INDEX IF NOT EXISTS vendor_payments_vendor_idx ON vendor_payments (vendor_id);
CREATE UNIQUE INDEX IF NOT EXISTS vendor_payment_number_uq ON vendor_payments (tenant_slug, payment_number);

CREATE TABLE IF NOT EXISTS vendor_payment_applications (
  id text PRIMARY KEY,
  payment_id text NOT NULL,
  bill_id uuid NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  applied_amount numeric(18,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_payment_applications_payment_idx ON vendor_payment_applications (payment_id);
CREATE INDEX IF NOT EXISTS vendor_payment_applications_bill_idx ON vendor_payment_applications (bill_id);

CREATE TABLE IF NOT EXISTS vendor_balances (
  vendor_id text PRIMARY KEY,
  tenant_slug text,
  balance numeric(18,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_balances_tenant_idx ON vendor_balances (tenant_slug);

CREATE TABLE IF NOT EXISTS vendor_contacts (
  id text PRIMARY KEY,
  vendor_id text NOT NULL,
  name text NOT NULL,
  role text,
  phone text,
  email text,
  address jsonb,
  is_primary boolean DEFAULT false,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_contacts_vendor_idx ON vendor_contacts (vendor_id);
