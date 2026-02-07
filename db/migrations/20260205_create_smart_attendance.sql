-- Smart Attendance System Schema
-- Multi-tenant, department & branch aware

-- Work Mode enum
CREATE TYPE work_mode AS ENUM ('ONSITE', 'REMOTE', 'HYBRID', 'FIELD', 'LEAVE', 'TRAINING');

-- Attendance Signal Type enum
CREATE TYPE signal_type AS ENUM (
  'CHECK_IN',
  'CHECK_OUT',
  'TASK_UPDATE',
  'TIME_LOG',
  'MEETING_ATTENDED',
  'LMS_ACTIVITY',
  'MANAGER_OVERRIDE',
  'AVAILABILITY_CONFIRMATION'
);

-- Attendance Status enum
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'PRESENT_LOW_CONFIDENCE', 'ABSENT', 'ON_LEAVE', 'TRAINING');

-- Attendance records - daily attendance per employee
CREATE TABLE attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  department_id UUID,
  branch_id UUID,
  work_date DATE NOT NULL,
  work_mode work_mode NOT NULL,
  
  -- Attendance confidence score (0-100)
  confidence_score DECIMAL(5, 2) DEFAULT 0,
  attendance_status attendance_status DEFAULT 'ABSENT',
  
  -- Explicit signals
  check_in_time TIMESTAMP,
  check_out_time TIMESTAMP,
  shift_confirmed BOOLEAN DEFAULT FALSE,
  
  -- Activity metrics (from implicit signals)
  task_activity_count INTEGER DEFAULT 0,
  time_logged_hours DECIMAL(8, 2) DEFAULT 0,
  meetings_attended INTEGER DEFAULT 0,
  lms_activity_score DECIMAL(5, 2) DEFAULT 0,
  
  -- Manager notes and corrections
  manager_notes TEXT,
  is_override BOOLEAN DEFAULT FALSE,
  override_reason TEXT,
  override_by_user_id UUID,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_attendance_per_day UNIQUE (tenant_id, employee_id, work_date)
);

-- Attendance signals - individual events/activities
CREATE TABLE attendance_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
  
  signal_type signal_type NOT NULL,
  
  -- Signal specific data
  signal_data JSONB,
  confidence_weight DECIMAL(5, 2), -- How much this signal contributes to ACS
  
  -- Source metadata
  source TEXT, -- 'web', 'mobile', 'api', 'auto'
  source_reference_id UUID, -- Reference to task, meeting, LMS activity, etc.
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Attendance policies - configurable per tenant
CREATE TABLE attendance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Confidence score thresholds
  present_threshold DECIMAL(5, 2) DEFAULT 70,      -- >= 70 = Present
  low_confidence_threshold DECIMAL(5, 2) DEFAULT 40, -- 40-69 = Present (Low Confidence)
  
  -- Scoring weights (percentages that sum to 100)
  check_in_weight DECIMAL(5, 2) DEFAULT 30,
  task_activity_weight DECIMAL(5, 2) DEFAULT 25,
  time_logged_weight DECIMAL(5, 2) DEFAULT 25,
  meetings_weight DECIMAL(5, 2) DEFAULT 10,
  training_weight DECIMAL(5, 2) DEFAULT 10,
  
  -- Role-based mode defaults
  default_mode_for_role VARCHAR(50), -- null, 'ONSITE', 'REMOTE', 'HYBRID', etc.
  
  -- Configurations
  requires_check_in BOOLEAN DEFAULT TRUE,
  allows_late_check_in BOOLEAN DEFAULT TRUE,
  late_check_in_window_minutes INTEGER DEFAULT 30,
  requires_shift_confirmation BOOLEAN DEFAULT FALSE,
  requires_weekly_availability_confirmation BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_policy_per_tenant UNIQUE (tenant_id, name)
);

-- Attendance override log - audit trail for manual corrections
CREATE TABLE attendance_override_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  attendance_record_id UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
  
  overridden_by_user_id UUID NOT NULL,
  override_timestamp TIMESTAMP DEFAULT NOW(),
  
  -- What was changed
  previous_status attendance_status,
  new_status attendance_status NOT NULL,
  previous_confidence_score DECIMAL(5, 2),
  new_confidence_score DECIMAL(5, 2),
  previous_work_mode work_mode,
  new_work_mode work_mode,
  
  reason TEXT NOT NULL,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Role defaults for work modes
CREATE TABLE role_work_mode_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  role_name VARCHAR(100) NOT NULL,
  default_work_mode work_mode NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT unique_role_defaults UNIQUE (tenant_id, role_name)
);

-- Indexes for performance
CREATE INDEX idx_attendance_records_tenant_date ON attendance_records(tenant_id, work_date);
CREATE INDEX idx_attendance_records_employee_date ON attendance_records(employee_id, work_date);
CREATE INDEX idx_attendance_records_dept_date ON attendance_records(department_id, work_date);
CREATE INDEX idx_attendance_signals_record ON attendance_signals(attendance_record_id);
CREATE INDEX idx_attendance_signals_employee ON attendance_signals(employee_id);
CREATE INDEX idx_override_logs_record ON attendance_override_logs(attendance_record_id);
CREATE INDEX idx_policies_tenant ON attendance_policies(tenant_id);
