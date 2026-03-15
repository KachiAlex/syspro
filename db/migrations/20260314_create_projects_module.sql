-- Projects Module
-- Supports: Project Management, Workstreams, Tasks, Smart Assignment, Capacity Planning

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'PLANNING' CHECK (status IN ('PLANNING', 'INITIATED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'ARCHIVED', 'CANCELLED')),
  priority VARCHAR(50) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  
  -- Timeline
  start_date DATE,
  planned_end_date DATE,
  actual_end_date DATE,
  
  -- Budget linkage
  budget_id UUID,
  total_budget_amount DECIMAL(19, 2),
  currency VARCHAR(3) DEFAULT 'NGN',
  
  -- Scope
  scope_description TEXT,
  deliverables TEXT,
  
  -- People
  project_manager_id UUID,
  sponsor_id UUID,
  department_id UUID,
  branch_id UUID,
  
  -- Governance
  approval_status VARCHAR(50) DEFAULT 'DRAFT' CHECK (approval_status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  approved_by UUID,
  approved_at TIMESTAMP,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (tenant_slug, code),
  INDEXES (
    (tenant_slug),
    (status),
    (project_manager_id),
    (department_id)
  )
);

-- ============================================================
-- WORKSTREAMS (Major work blocks within projects)
-- ============================================================

CREATE TABLE IF NOT EXISTS workstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_slug VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Timeline
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  
  -- Budget
  allocated_budget DECIMAL(19, 2),
  spent_amount DECIMAL(19, 2) DEFAULT 0,
  
  -- Status & Priority
  status VARCHAR(50) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
  priority INTEGER DEFAULT 100,
  
  -- Leadership
  workstream_lead_id UUID,
  owner_department_id UUID,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (project_id, code),
  INDEXES (
    (project_id),
    (tenant_slug),
    (status),
    (workstream_lead_id)
  )
);

-- ============================================================
-- TASKS (Granular work items)
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workstream_id UUID NOT NULL REFERENCES workstreams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_slug VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Timeline
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  duration_days INTEGER,
  
  -- Effort estimation
  estimated_hours DECIMAL(10, 2),
  estimated_cost DECIMAL(19, 2),
  actual_hours_spent DECIMAL(10, 2) DEFAULT 0,
  actual_cost DECIMAL(19, 2) DEFAULT 0,
  
  -- Status & Priority
  status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
  priority INTEGER DEFAULT 100,
  percent_complete INTEGER DEFAULT 0 CHECK (percent_complete >= 0 AND percent_complete <= 100),
  
  -- Dependencies
  depends_on_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  is_blockedby_active_risk BOOLEAN DEFAULT FALSE,
  
  -- Assignment status
  is_assigned BOOLEAN DEFAULT FALSE,
  assignment_deadline DATE,
  
  -- Skills required
  required_skills TEXT[], -- Array of skill codes
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE (workstream_id, code),
  INDEXES (
    (project_id),
    (workstream_id),
    (tenant_slug),
    (status),
    (is_assigned)
  )
);

-- ============================================================
-- TASK ASSIGNMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_slug VARCHAR(255) NOT NULL,
  employee_id UUID NOT NULL,
  
  -- Assignment details
  assigned_hours DECIMAL(10, 2),
  assigned_percentage DECIMAL(5, 2), -- 0-100 allocation %
  assignment_start_date DATE NOT NULL,
  assignment_end_date DATE,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'ACCEPTED', 'REJECTED', 'REASSIGNED', 'COMPLETED')),
  
  -- Approval
  approved_by UUID,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Performance
  actual_hours_logged DECIMAL(10, 2) DEFAULT 0,
  is_on_track BOOLEAN,
  risk_level VARCHAR(50) CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEXES (
    (task_id),
    (project_id),
    (employee_id),
    (tenant_slug),
    (status),
    (assignment_start_date)
  )
);

-- ============================================================
-- TIME LOGS (Actual time spent on tasks)
-- ============================================================

CREATE TABLE IF NOT EXISTS time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_assignment_id UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL,
  tenant_slug VARCHAR(255) NOT NULL,
  
  -- Time tracking
  log_date DATE NOT NULL,
  hours_logged DECIMAL(10, 2) NOT NULL,
  description TEXT,
  
  -- Categorization
  activity_type VARCHAR(100), -- e.g., 'Development', 'Testing', 'Documentation'
  billable BOOLEAN DEFAULT FALSE,
  
  -- Approval
  approval_status VARCHAR(50) DEFAULT 'SUBMITTED' CHECK (approval_status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  approved_by UUID,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEXES (
    (task_assignment_id),
    (task_id),
    (project_id),
    (employee_id),
    (tenant_slug),
    (log_date),
    (approval_status)
  )
);

-- ============================================================
-- CAPACITY SNAPSHOTS (Historical capacity data for forecasting)
-- ============================================================

CREATE TABLE IF NOT EXISTS capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  employee_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  
  -- Current allocation
  total_available_hours DECIMAL(10, 2),
  allocated_to_projects_hours DECIMAL(10, 2),
  allocated_to_maintenance_hours DECIMAL(10, 2),
  available_capacity_hours DECIMAL(10, 2),
  
  -- Utilization %
  utilization_percentage DECIMAL(5, 2),
  
  -- Forecast
  forecasted_allocation_next_30days DECIMAL(10, 2),
  forecasted_allocation_next_90days DECIMAL(10, 2),
  
  -- Risk indicators
  over_allocated_risk BOOLEAN,
  skill_gap_risk BOOLEAN,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEXES (
    (tenant_slug),
    (employee_id),
    (snapshot_date)
  )
);

-- ============================================================
-- EMPLOYEE SKILLS (Required skills registry)
-- ============================================================

CREATE TABLE IF NOT EXISTS employee_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_slug VARCHAR(255) NOT NULL,
  employee_id UUID NOT NULL,
  skill_code VARCHAR(100) NOT NULL,
  skill_name VARCHAR(255) NOT NULL,
  
  -- Proficiency level
  proficiency_level VARCHAR(50) DEFAULT 'INTERMEDIATE' CHECK (proficiency_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),
  
  -- Certification
  certified BOOLEAN DEFAULT FALSE,
  certified_at DATE,
  certification_expires_at DATE,
  
  -- Experience
  years_of_experience DECIMAL(4, 1),
  last_used_date DATE,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEXES (
    (tenant_slug),
    (employee_id),
    (skill_code)
  )
);

-- ============================================================
-- SMART ASSIGNMENT RECOMMENDATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS assignment_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_slug VARCHAR(255) NOT NULL,
  
  -- Recommendations
  recommended_employee_id UUID NOT NULL,
  fit_score DECIMAL(5, 2), -- 0-100 score
  recommendation_reason TEXT,
  
  -- Fit breakdown
  skills_match_score DECIMAL(5, 2),
  capacity_score DECIMAL(5, 2),
  availability_score DECIMAL(5, 2),
  performance_history_score DECIMAL(5, 2),
  
  -- Status
  status VARCHAR(50) DEFAULT 'NEW' CHECK (status IN ('NEW', 'VIEWED', 'ASSIGNED', 'REJECTED', 'EXPIRED')),
  viewed_at TIMESTAMP,
  assigned_at TIMESTAMP,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  
  INDEXES (
    (task_id),
    (project_id),
    (recommended_employee_id),
    (tenant_slug),
    (fit_score)
  )
);

-- ============================================================
-- INDEXES FOR COMMON QUERIES
-- ============================================================

CREATE INDEX idx_projects_tenant_status ON projects(tenant_slug, status);
CREATE INDEX idx_projects_dates ON projects(start_date, planned_end_date);
CREATE INDEX idx_workstreams_project_status ON workstreams(project_id, status);
CREATE INDEX idx_tasks_workstream_status ON tasks(workstream_id, status);
CREATE INDEX idx_task_assignments_employee ON task_assignments(employee_id, tenant_slug);
CREATE INDEX idx_time_logs_employee_date ON time_logs(employee_id, log_date);
CREATE INDEX idx_capacity_snapshots_recent ON capacity_snapshots(employee_id, snapshot_date DESC);
