-- Nigeria localization pack: annualized PAYE (with consolidated relief),
-- employer statutory contributions, WHT on vendor bills, and a per-entry
-- employer-cost breakdown on payroll lines.

ALTER TABLE IF EXISTS admin_statutory_profiles
  ADD COLUMN IF NOT EXISTS paye_annualize boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paye_relief jsonb,
  ADD COLUMN IF NOT EXISTS employer_contributions jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS bills
  ADD COLUMN IF NOT EXISTS wht_rate numeric(5,2),
  ADD COLUMN IF NOT EXISTS wht_amount numeric(18,2) NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS admin_payroll_entries
  ADD COLUMN IF NOT EXISTS employer_cost numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS employer_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS statutory_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tax_transactions') THEN
    CREATE INDEX IF NOT EXISTS tax_transactions_source_idx
      ON tax_transactions (tenant_slug, source_type, source_id);
  END IF;
END $$;
