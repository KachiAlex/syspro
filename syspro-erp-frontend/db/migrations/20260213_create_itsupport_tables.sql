-- IT Support: Ticket Table
CREATE TABLE IF NOT EXISTS itsupport_ticket (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  department TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('internal', 'customer')),
  impact TEXT NOT NULL CHECK (impact IN ('critical', 'high', 'medium', 'low')),
  sla_category TEXT NOT NULL CHECK (sla_category IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by UUID NOT NULL,
  assigned_to UUID,
  backup_engineer_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  diagnosing_at TIMESTAMPTZ,
  in_progress_at TIMESTAMPTZ,
  awaiting_customer_at TIMESTAMPTZ,
  awaiting_dependency_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  reopened_at TIMESTAMPTZ,
  sla_response_due TIMESTAMPTZ NOT NULL,
  sla_resolution_due TIMESTAMPTZ NOT NULL,
  sla_breached BOOLEAN,
  escalation_level TEXT,
  incident_id UUID,
  field_job_id UUID,
  tags TEXT[],
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT fk_branch FOREIGN KEY (branch_id) REFERENCES branch(id)
);

-- IT Support: Ticket Comment
CREATE TABLE IF NOT EXISTS itsupport_ticket_comment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES itsupport_ticket(id),
  author_id UUID NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IT Support: Ticket Activity Log
CREATE TABLE IF NOT EXISTS itsupport_ticket_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES itsupport_ticket(id),
  action TEXT NOT NULL,
  actor_id UUID NOT NULL,
  from_status TEXT,
  to_status TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB
);

-- IT Support: SLA
CREATE TABLE IF NOT EXISTS itsupport_sla (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category TEXT NOT NULL,
  response_minutes INT NOT NULL,
  resolution_minutes INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IT Support: Engineer Profile
CREATE TABLE IF NOT EXISTS itsupport_engineer_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  skills TEXT[] NOT NULL,
  branch_id UUID NOT NULL,
  on_duty BOOLEAN NOT NULL DEFAULT false,
  workload INT NOT NULL DEFAULT 0,
  performance_score INT NOT NULL DEFAULT 0,
  location GEOGRAPHY(POINT, 4326)
);

-- IT Support: Field Job
CREATE TABLE IF NOT EXISTS itsupport_field_job (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES itsupport_ticket(id),
  engineer_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  gps_start GEOGRAPHY(POINT, 4326),
  gps_arrive GEOGRAPHY(POINT, 4326),
  work_log TEXT,
  images TEXT[],
  customer_signoff BOOLEAN
);

-- IT Support: Incident
CREATE TABLE IF NOT EXISTS itsupport_incident (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  region TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  linked_ticket_ids UUID[],
  description TEXT NOT NULL,
  severity TEXT NOT NULL
);

-- IT Support: Knowledge Base Article
CREATE TABLE IF NOT EXISTS itsupport_kb_article (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT[] NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  related_ticket_ids UUID[]
);
