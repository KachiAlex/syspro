-- REVENUE OPERATIONS MODULE
-- Campaigns, lead sources, attribution, enablement, and forecasting artifacts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- CAMPAIGNS & DEMAND PROGRAMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS revops_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  subsidiary text NOT NULL,
  region text NOT NULL,
  branch text,
  campaign_code text NOT NULL,
  name text NOT NULL,
  objective text,
  status text NOT NULL CHECK (status IN (
    'draft','planned','pending_approval','approved','active','paused','completed'
  )),
  channel text NOT NULL CHECK (channel IN (
    'email','social','events','partnerships','referrals','advocacy','paid_search','sponsorships'
  )),
  start_date date NOT NULL,
  end_date date,
  budget numeric(18,2) NOT NULL,
  committed_spend numeric(18,2) NOT NULL DEFAULT 0,
  actual_spend numeric(18,2) NOT NULL DEFAULT 0,
  expected_pipeline numeric(18,2) NOT NULL DEFAULT 0,
  pipeline_influenced numeric(18,2) NOT NULL DEFAULT 0,
  revenue_attributed numeric(18,2) NOT NULL DEFAULT 0,
  roi numeric(10,2) NOT NULL DEFAULT 0,
  attribution_model text NOT NULL CHECK (attribution_model IN ('first_touch','last_touch','linear')),
  target_segments text[] NOT NULL DEFAULT '{}'::text[],
  approval jsonb,
  metadata jsonb,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_slug, campaign_code)
);
CREATE INDEX IF NOT EXISTS idx_revops_campaigns_tenant ON revops_campaigns (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_revops_campaigns_status ON revops_campaigns (tenant_slug, status);
CREATE INDEX IF NOT EXISTS idx_revops_campaigns_channel ON revops_campaigns (tenant_slug, channel);

CREATE TABLE IF NOT EXISTS revops_campaign_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  campaign_id uuid NOT NULL REFERENCES revops_campaigns(id) ON DELETE CASCADE,
  subsidiary text NOT NULL,
  region text NOT NULL,
  branch text,
  cost_center text NOT NULL,
  description text NOT NULL,
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL,
  spend_date date NOT NULL,
  recorded_by uuid,
  approved_by uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revops_campaign_costs_campaign ON revops_campaign_costs (campaign_id);
CREATE INDEX IF NOT EXISTS idx_revops_campaign_costs_tenant ON revops_campaign_costs (tenant_slug);

CREATE TABLE IF NOT EXISTS revops_lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  name text NOT NULL,
  channel text NOT NULL CHECK (channel IN (
    'email','social','events','partnerships','referrals','advocacy','paid_search','sponsorships'
  )),
  campaign_id uuid REFERENCES revops_campaigns(id) ON DELETE SET NULL,
  cost_center text NOT NULL,
  subsidiary text NOT NULL,
  region text NOT NULL,
  branch text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  metadata jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revops_lead_sources_tenant ON revops_lead_sources (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_revops_lead_sources_channel ON revops_lead_sources (tenant_slug, channel);

-- ============================================================================
-- ATTRIBUTION + FINANCIAL ALIGNMENT
-- ============================================================================
CREATE TABLE IF NOT EXISTS revops_revenue_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  campaign_id uuid REFERENCES revops_campaigns(id) ON DELETE SET NULL,
  lead_source_id uuid REFERENCES revops_lead_sources(id) ON DELETE SET NULL,
  crm_opportunity_id text NOT NULL,
  crm_deal_id text,
  crm_value numeric(18,2) NOT NULL,
  recognized_revenue numeric(18,2) NOT NULL,
  allocation_weight numeric(5,2) NOT NULL DEFAULT 1,
  model text NOT NULL CHECK (model IN ('first_touch','last_touch','linear')),
  channel text NOT NULL,
  region text NOT NULL,
  branch text,
  subsidiary text NOT NULL,
  closed_date date NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revops_attribution_tenant ON revops_revenue_attributions (tenant_slug, model);
CREATE INDEX IF NOT EXISTS idx_revops_attribution_campaign ON revops_revenue_attributions (campaign_id);

-- ============================================================================
-- TARGETS + PERFORMANCE
-- ============================================================================
CREATE TABLE IF NOT EXISTS revops_sales_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  period text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly','quarterly')),
  region text NOT NULL,
  branch text,
  subsidiary text NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('team','rep')),
  owner_id text NOT NULL,
  owner_name text NOT NULL,
  target_amount numeric(18,2) NOT NULL,
  achieved_amount numeric(18,2) NOT NULL DEFAULT 0,
  currency text NOT NULL,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revops_sales_targets_tenant ON revops_sales_targets (tenant_slug, period_type);

CREATE TABLE IF NOT EXISTS revops_sales_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  period text NOT NULL,
  period_label text NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revops_performance_tenant ON revops_sales_performance_snapshots (tenant_slug);

-- ============================================================================
-- ENABLEMENT + FORECASTING
-- ============================================================================
CREATE TABLE IF NOT EXISTS revops_enablement_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  title text NOT NULL,
  asset_type text NOT NULL CHECK (asset_type IN ('deck','playbook','case_study','template','pricing')),
  audience text NOT NULL CHECK (audience IN ('sales','revops','executive','partner')),
  version text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','published','archived')),
  tags text[] NOT NULL DEFAULT '{}'::text[],
  summary text,
  storage_url text NOT NULL,
  owner text NOT NULL,
  subsidiary text NOT NULL,
  region text,
  usage_metrics jsonb NOT NULL,
  created_by uuid,
  approved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revops_enablement_tenant ON revops_enablement_assets (tenant_slug);

CREATE TABLE IF NOT EXISTS revops_revenue_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  subsidiary text NOT NULL,
  region text NOT NULL,
  branch text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  forecast_low numeric(18,2) NOT NULL,
  forecast_likely numeric(18,2) NOT NULL,
  forecast_high numeric(18,2) NOT NULL,
  confidence numeric(5,2) NOT NULL,
  methodology text,
  assumptions text[] NOT NULL DEFAULT '{}'::text[],
  risk_alerts jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_revops_forecasts_tenant ON revops_revenue_forecasts (tenant_slug);

-- ============================================================================
-- VIEWS / MATERIALIZED AGG SOURCES CAN BE ADDED IN SUBSEQUENT MIGRATIONS
-- ============================================================================
