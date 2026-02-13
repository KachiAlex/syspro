-- Draft migration: create core finance tables
-- timestamp: 2026-02-13

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  parent_id UUID NULL,
  metadata JSONB NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coa_tenant_code ON chart_of_accounts (tenant_id, code);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  reference TEXT,
  description TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'draft',
  source TEXT,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  account_id UUID REFERENCES chart_of_accounts(id),
  amount NUMERIC NOT NULL,
  side TEXT NOT NULL,
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_journals_tenant_status ON journal_entries (tenant_id, status);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  number TEXT,
  customer_id UUID,
  amount_total NUMERIC NOT NULL,
  amount_due NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  due_date DATE,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  method TEXT,
  reference TEXT,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  diff JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
