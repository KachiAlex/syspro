
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ============================================================================
-- SLA POLICIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  name text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('critical','high','medium','low')),
  impact_level text NOT NULL CHECK (impact_level IN ('critical','high','medium','low')),
  response_minutes integer NOT NULL CHECK (response_minutes > 0),
  resolution_minutes integer NOT NULL CHECK (resolution_minutes > 0),
  escalation_chain jsonb,
  auto_escalate boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  description text,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sla_policies_unique_name UNIQUE (tenant_slug, name)
);
CREATE INDEX IF NOT EXISTS idx_sla_policies_tenant ON sla_policies (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_sla_policies_priority ON sla_policies (tenant_slug, priority);

-- ============================================================================
-- ENGINEER PROFILES
-- ============================================================================
CREATE TABLE IF NOT EXISTS engineer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  employee_id uuid NOT NULL,
  display_name text,
  role text,
  branch_id uuid,
  region text,
  service_areas text[] NOT NULL DEFAULT '{}'::text[],
  skills text[] NOT NULL DEFAULT '{}'::text[],
  certifications text[] NOT NULL DEFAULT '{}'::text[],
  on_duty boolean NOT NULL DEFAULT false,
  current_load integer NOT NULL DEFAULT 0,
  max_load integer NOT NULL DEFAULT 5,
  performance_score numeric(5,2) NOT NULL DEFAULT 0,
  last_assignment_at timestamptz,
  availability jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engineer_profiles_employee_unique UNIQUE (tenant_slug, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_engineer_profiles_tenant ON engineer_profiles (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_engineer_profiles_branch ON engineer_profiles (branch_id);
CREATE INDEX IF NOT EXISTS idx_engineer_profiles_duty ON engineer_profiles (tenant_slug, on_duty);

-- ============================================================================
-- SUPPORT TICKETS
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  ticket_number text NOT NULL,
  title text NOT NULL,
  description text,
  ticket_type text NOT NULL CHECK (ticket_type IN ('internal','customer')),
  source text NOT NULL CHECK (source IN ('erp','crm','email','api','mobile','monitoring')),
  impact_level text NOT NULL CHECK (impact_level IN ('critical','high','medium','low')),
  priority text NOT NULL CHECK (priority IN ('critical','high','medium','low')),
  status text NOT NULL CHECK (status IN ('new','acknowledged','diagnosing','in_progress','awaiting_customer','awaiting_dependency','resolved','closed','reopened')) DEFAULT 'new',
  department_id uuid,
  service_area text,
  region text,
  branch_id uuid,
  customer_id uuid,
  project_id uuid,
  sla_policy_id uuid REFERENCES sla_policies(id) ON DELETE SET NULL,
  assigned_engineer_id uuid REFERENCES engineer_profiles(id) ON DELETE SET NULL,
  backup_engineer_id uuid REFERENCES engineer_profiles(id) ON DELETE SET NULL,
  escalation_level integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  attachments jsonb,
  auto_assignment jsonb,
  response_due_at timestamptz,
  resolution_due_at timestamptz,
  response_breached_at timestamptz,
  resolution_breached_at timestamptz,
  first_response_at timestamptz,
  acknowledged_at timestamptz,
  diagnosing_at timestamptz,
  in_progress_at timestamptz,
  awaiting_customer_at timestamptz,
  awaiting_dependency_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  reopened_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb,
  CONSTRAINT support_tickets_unique_number UNIQUE (tenant_slug, ticket_number)
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (tenant_slug, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets (tenant_slug, priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_engineer ON support_tickets (assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_sla ON support_tickets (sla_policy_id);

-- ============================================================================
-- TICKET COMMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  comment_type text NOT NULL CHECK (comment_type IN ('internal','customer','system')),
  body text NOT NULL,
  attachments jsonb,
  author_id uuid,
  visibility text NOT NULL DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_tenant ON ticket_comments (tenant_slug);

-- ============================================================================
-- TICKET ACTIVITY LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  actor_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_ticket ON ticket_activity_logs (ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_activity_type ON ticket_activity_logs (tenant_slug, activity_type);

-- ============================================================================
-- FIELD JOBS / DISPATCH
-- ============================================================================
CREATE TABLE IF NOT EXISTS field_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  engineer_id uuid REFERENCES engineer_profiles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('scheduled','dispatched','in_transit','on_site','completed','cancelled')) DEFAULT 'scheduled',
  location jsonb,
  travel_log jsonb,
  scheduled_at timestamptz,
  dispatched_at timestamptz,
  arrival_confirmed_at timestamptz,
  work_started_at timestamptz,
  work_completed_at timestamptz,
  customer_signoff jsonb,
  before_media jsonb,
  after_media jsonb,
  work_notes text,
  hours_worked numeric(10,2),
  cost_center_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_field_jobs_ticket ON field_jobs (ticket_id);
CREATE INDEX IF NOT EXISTS idx_field_jobs_status ON field_jobs (status);
CREATE INDEX IF NOT EXISTS idx_field_jobs_engineer ON field_jobs (engineer_id);

-- ============================================================================
-- INCIDENT INGEST
-- ============================================================================
CREATE TABLE IF NOT EXISTS support_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  source_system text NOT NULL,
  incident_type text,
  severity text NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  status text NOT NULL CHECK (status IN ('open','monitoring','resolved','closed')) DEFAULT 'open',
  detected_at timestamptz NOT NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  summary text,
  affected_services text[] NOT NULL DEFAULT '{}'::text[],
  region text,
  branch_id uuid,
  linked_ticket_id uuid REFERENCES support_tickets(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_incidents_tenant ON support_incidents (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_support_incidents_status ON support_incidents (tenant_slug, status);
CREATE INDEX IF NOT EXISTS idx_support_incidents_ticket ON support_incidents (linked_ticket_id);

-- ============================================================================
-- KNOWLEDGE BASE
-- ============================================================================
CREATE TABLE IF NOT EXISTS knowledge_base_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug text NOT NULL,
  title text NOT NULL,
  category text,
  audience text NOT NULL CHECK (audience IN ('internal','customer','field')),
  summary text,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  related_ticket_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  solution_steps jsonb,
  attachments jsonb,
  effectiveness_score numeric(5,2) NOT NULL DEFAULT 0,
  publish_status text NOT NULL CHECK (publish_status IN ('draft','published','retired')) DEFAULT 'draft',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tenant ON knowledge_base_articles (tenant_slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_status ON knowledge_base_articles (publish_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_tags ON knowledge_base_articles USING GIN (tags);
