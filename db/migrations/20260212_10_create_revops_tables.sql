-- Create RevOps tables: campaigns, lead_sources, campaign_costs, revenue_attributions,
-- sales_targets, sales_performance_snapshots, enablement_assets, revenue_forecasts

BEGIN;

CREATE TABLE IF NOT EXISTS revops_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  subsidiary text,
  region text,
  branch text,
  name text NOT NULL,
  channel text,
  status text NOT NULL DEFAULT 'draft',
  start_at timestamptz,
  end_at timestamptz,
  budget numeric DEFAULT 0,
  approved_by text,
  approved_at timestamptz,
  metadata jsonb,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS revops_campaigns_tenant_idx ON revops_campaigns (tenant_slug);

CREATE TABLE IF NOT EXISTS revops_lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  name text NOT NULL,
  channel text,
  campaign_id uuid REFERENCES revops_campaigns(id) ON DELETE SET NULL,
  cost_center text,
  region text,
  branch text,
  metadata jsonb,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS revops_lead_sources_tenant_idx ON revops_lead_sources (tenant_slug);

CREATE TABLE IF NOT EXISTS revops_campaign_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  campaign_id uuid REFERENCES revops_campaigns(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  currency text DEFAULT 'USD',
  category text,
  incurred_at timestamptz DEFAULT now(),
  metadata jsonb,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revops_revenue_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  campaign_id uuid REFERENCES revops_campaigns(id) ON DELETE SET NULL,
  lead_source_id uuid REFERENCES revops_lead_sources(id) ON DELETE SET NULL,
  opportunity_id uuid,
  invoice_id uuid,
  amount numeric,
  attribution_model text,
  attributed_at timestamptz DEFAULT now(),
  metadata jsonb,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revops_sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  region text,
  branch text,
  target_amount numeric NOT NULL,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revops_sales_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  snapshot_at timestamptz DEFAULT now(),
  region text,
  branch text,
  metrics jsonb,
  created_by text
);

CREATE TABLE IF NOT EXISTS revops_enablement_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  name text NOT NULL,
  type text,
  version integer DEFAULT 1,
  url text,
  metadata jsonb,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revops_revenue_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  forecast jsonb,
  generated_by text,
  generated_at timestamptz DEFAULT now()
);

COMMIT;
