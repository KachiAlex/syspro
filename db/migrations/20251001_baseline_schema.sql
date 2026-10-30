--
-- PostgreSQL database dump
--

\restrict kFWLxqQG0LeE46RZnZR4OZbvzOGE1MlrwSiHk9nIZ4vFnMk6iaOLmOy1QvWidPd

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: archive; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA archive;


--
-- Name: SCHEMA archive; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA archive IS 'Retired legacy tables pending verified backup + cooling-off before drop';


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA public;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendance_status AS ENUM (
    'PRESENT',
    'PRESENT_LOW_CONFIDENCE',
    'ABSENT',
    'ON_LEAVE',
    'TRAINING'
);


--
-- Name: signal_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.signal_type AS ENUM (
    'CHECK_IN',
    'CHECK_OUT',
    'TASK_UPDATE',
    'TIME_LOG',
    'MEETING_ATTENDED',
    'LMS_ACTIVITY',
    'MANAGER_OVERRIDE',
    'AVAILABILITY_CONFIRMATION'
);


--
-- Name: subscription_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status_enum AS ENUM (
    'active',
    'canceled',
    'past_due',
    'unpaid',
    'trialing'
);


--
-- Name: user_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status_enum AS ENUM (
    'active',
    'inactive',
    'suspended',
    'pending_verification'
);


--
-- Name: work_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.work_mode AS ENUM (
    'ONSITE',
    'REMOTE',
    'HYBRID',
    'FIELD',
    'LEAVE',
    'TRAINING'
);


--
-- Name: sync_sales_order_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_sales_order_items() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  it jsonb;
  n integer := 0;
begin
  if tg_op = 'UPDATE' then
    if new.items is not distinct from old.items then
      return new;
    end if;
    delete from sales_order_items where order_id = old.id;
  end if;

  if new.items is null then
    return new;
  end if;

  for it in
    select value from jsonb_array_elements(
      case
        when pg_input_is_valid(new.items, 'jsonb')
             and jsonb_typeof(new.items::jsonb) = 'array'
          then new.items::jsonb
        else '[]'::jsonb
      end
    )
  loop
    n := n + 1;
    insert into sales_order_items
      (tenant_slug, order_id, line_no, sku, product_name, quantity, unit_price, line_total)
    values (
      new.tenant_slug,
      new.id,
      n,
      coalesce(it->>'sku', it->>'productSku', it->>'product_sku'),
      coalesce(it->>'name', it->>'productName', it->>'product_name'),
      case when pg_input_is_valid(it->>'quantity', 'numeric')
            then (it->>'quantity')::numeric
           when pg_input_is_valid(it->>'qty', 'numeric')
            then (it->>'qty')::numeric
           else 0 end,
      case when pg_input_is_valid(it->>'unitPrice', 'numeric')
            then (it->>'unitPrice')::numeric
           when pg_input_is_valid(it->>'unit_price', 'numeric')
            then (it->>'unit_price')::numeric
           when pg_input_is_valid(it->>'price', 'numeric')
            then (it->>'price')::numeric
           else 0 end,
      case when pg_input_is_valid(it->>'total', 'numeric')
            then (it->>'total')::numeric
           when pg_input_is_valid(it->>'lineTotal', 'numeric')
            then (it->>'lineTotal')::numeric
           else 0 end
    );
  end loop;
  return new;
end;
$$;


--
-- Name: update_finance_cached_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_finance_cached_summary() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Upsert cached summary row for tenant
  INSERT INTO finance_cached_summary (tenant_slug)
  VALUES (NEW.tenant_slug)
  ON CONFLICT (tenant_slug) DO NOTHING;

  -- Mark event as processed
  NEW.processed := TRUE;
  
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text,
    account_id uuid,
    fiscal_period_id uuid,
    opening_balance numeric(18,2) DEFAULT 0 NOT NULL,
    period_debit numeric(18,2) DEFAULT 0 NOT NULL,
    period_credit numeric(18,2) DEFAULT 0 NOT NULL,
    closing_balance numeric(18,2),
    last_updated timestamp with time zone DEFAULT now()
);


--
-- Name: account_closing_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_closing_balance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    fiscal_period_id uuid NOT NULL,
    account_id uuid,
    account_code text,
    account_name text,
    debit numeric(18,2) DEFAULT 0 NOT NULL,
    credit numeric(18,2) DEFAULT 0 NOT NULL,
    closing_balance numeric(18,2) DEFAULT 0 NOT NULL,
    finance_book text DEFAULT 'main'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: accounting_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text,
    entity_type text NOT NULL,
    entity_id text,
    action text NOT NULL,
    changed_fields jsonb,
    old_values jsonb,
    new_values jsonb,
    user_id text,
    user_name text,
    ip_address character varying(45),
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: accounting_dimensions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_dimensions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    dimension_key text NOT NULL,
    label text NOT NULL,
    required_for jsonb DEFAULT '[]'::jsonb NOT NULL,
    allowed_values jsonb,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_costs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    activity_type_id uuid NOT NULL,
    employee_id text,
    billing_rate numeric DEFAULT 0 NOT NULL,
    cost_rate numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    default_rate numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_access_controls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_access_controls (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    role_id text NOT NULL,
    role_name text NOT NULL,
    module_access jsonb NOT NULL,
    temp_grants jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_announcements (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    audience text DEFAULT 'all'::text,
    target_id text,
    priority text DEFAULT 'medium'::text,
    created_by text,
    created_by_name text,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    CONSTRAINT admin_announcements_audience_check CHECK ((audience = ANY (ARRAY['all'::text, 'department'::text, 'role'::text]))),
    CONSTRAINT admin_announcements_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text])))
);


--
-- Name: admin_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_api_keys (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    key text,
    secret text,
    permissions jsonb NOT NULL,
    rate_limit integer,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    created_by text,
    key_hash text,
    key_prefix text,
    secret_hash text,
    revoked_at timestamp with time zone
);


--
-- Name: admin_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_applications (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    candidate_id text NOT NULL,
    requisition_id text NOT NULL,
    status text DEFAULT 'applied'::text,
    ai_score numeric(5,2),
    screening_result jsonb,
    applied_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    shortlisted_at timestamp with time zone,
    shortlisted_by text DEFAULT 'system'::text,
    CONSTRAINT admin_applications_shortlisted_by_check CHECK ((shortlisted_by = ANY (ARRAY['ai'::text, 'hr'::text, 'system'::text]))),
    CONSTRAINT admin_applications_status_check CHECK ((status = ANY (ARRAY['applied'::text, 'under_review'::text, 'screened'::text, 'shortlist'::text, 'interview'::text, 'offer_pending'::text, 'offer_accepted'::text, 'offer_rejected'::text, 'withdrew'::text])))
);


--
-- Name: admin_appraisal_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_appraisal_config (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    weights jsonb DEFAULT '{}'::jsonb NOT NULL,
    auto_generate boolean DEFAULT false,
    auto_generate_frequency text DEFAULT 'monthly'::text,
    auto_generate_day integer DEFAULT 1,
    use_ai boolean DEFAULT true,
    role_templates jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_appraisal_config_auto_generate_frequency_check CHECK ((auto_generate_frequency = ANY (ARRAY['weekly'::text, 'monthly'::text, 'quarterly'::text, 'annual'::text])))
);


--
-- Name: admin_approval_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_approval_flows (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    steps jsonb NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text,
    updated_by text
);


--
-- Name: admin_approval_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_approval_requests (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    flow_id text NOT NULL,
    flow_type text NOT NULL,
    requester_id text NOT NULL,
    subject_id text NOT NULL,
    status text DEFAULT 'pending'::text,
    current_step_index integer DEFAULT 0,
    history jsonb DEFAULT '[]'::jsonb,
    documents jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_approval_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: admin_approval_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_approval_routes (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    steps jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id text NOT NULL,
    tenant_id text NOT NULL,
    employee_id text NOT NULL,
    work_date date NOT NULL,
    attendance_status text,
    work_mode text,
    check_in_time text,
    check_out_time text,
    employee_name text,
    notes text,
    check_in_lat numeric(10,7),
    check_in_lng numeric(10,7),
    check_out_lat numeric(10,7),
    check_out_lng numeric(10,7),
    confidence_score numeric,
    task_activity_count integer DEFAULT 0,
    time_logged_hours numeric DEFAULT 0,
    meetings_attended integer DEFAULT 0,
    lms_activity_score numeric,
    is_override boolean DEFAULT false,
    override_reason text,
    override_by_user_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    check_in_method text,
    check_in_distance_m numeric,
    check_in_accuracy_m numeric,
    check_in_flagged boolean DEFAULT false,
    flag_reason text,
    location_id text
);


--
-- Name: admin_attendance; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_attendance AS
 SELECT id,
    tenant_id AS tenant_slug,
    employee_id,
    employee_name,
    work_date AS date,
    attendance_status AS status,
    check_in_time AS check_in,
    check_out_time AS check_out,
    notes,
    check_in_lat,
    check_in_lng,
    check_out_lat,
    check_out_lng,
    created_at,
    work_mode,
    check_in_method,
    check_in_distance_m,
    check_in_flagged,
    flag_reason,
    location_id,
    is_override,
    override_reason,
    override_by_user_id
   FROM public.attendance_records;


--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_logs (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    user_id text NOT NULL,
    action text NOT NULL,
    resource text NOT NULL,
    resource_id text NOT NULL,
    changes jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_candidates (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    resume_url text,
    source text DEFAULT 'manual'::text,
    current_stage text DEFAULT 'new'::text,
    skills text[] DEFAULT ARRAY[]::text[],
    experience_years integer,
    education text,
    notes text,
    tags text[] DEFAULT ARRAY[]::text[],
    overall_score numeric(5,2),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    certifications text[] DEFAULT ARRAY[]::text[],
    expected_salary numeric(15,2),
    location text,
    CONSTRAINT admin_candidates_current_stage_check CHECK ((current_stage = ANY (ARRAY['new'::text, 'screening'::text, 'shortlist'::text, 'interview'::text, 'offer'::text, 'hired'::text, 'rejected'::text, 'talent_pool'::text]))),
    CONSTRAINT admin_candidates_source_check CHECK ((source = ANY (ARRAY['career_page'::text, 'linkedin'::text, 'indeed'::text, 'referral'::text, 'agency'::text, 'job_fair'::text, 'manual'::text])))
);


--
-- Name: admin_departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_departments (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_department_id text,
    budget numeric(15,2),
    cost_center text,
    manager_id text,
    created_by text,
    updated_by text
);


--
-- Name: admin_employee_appraisals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_employee_appraisals (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    employee_name text,
    department_id text,
    period text DEFAULT 'monthly'::text NOT NULL,
    period_start timestamp with time zone NOT NULL,
    period_end timestamp with time zone NOT NULL,
    overall_score integer NOT NULL,
    rating text NOT NULL,
    categories jsonb NOT NULL,
    strengths text[] DEFAULT '{}'::text[],
    improvements text[] DEFAULT '{}'::text[],
    recommendation text,
    sentiment_score numeric(3,2) DEFAULT 0,
    anomalies text[] DEFAULT '{}'::text[],
    trend_delta integer,
    previous_score integer,
    department_average integer,
    percentile_rank integer,
    generated_by text DEFAULT 'deterministic'::text NOT NULL,
    weights_used jsonb NOT NULL,
    metrics jsonb NOT NULL,
    peer_feedback jsonb,
    goal_alignment jsonb,
    generated_by_name text,
    is_shared boolean DEFAULT false,
    employee_acknowledged boolean DEFAULT false,
    acknowledged_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_employee_appraisals_generated_by_check CHECK ((generated_by = ANY (ARRAY['ai'::text, 'deterministic'::text, 'hybrid'::text]))),
    CONSTRAINT admin_employee_appraisals_period_check CHECK ((period = ANY (ARRAY['weekly'::text, 'monthly'::text, 'quarterly'::text, 'annual'::text, 'custom'::text])))
);


--
-- Name: admin_employee_components; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_employee_components (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    employee_name text,
    name text NOT NULL,
    component_type text NOT NULL,
    amount_type text DEFAULT 'fixed'::text NOT NULL,
    amount numeric(15,2) NOT NULL,
    is_recurring boolean DEFAULT true,
    is_active boolean DEFAULT true,
    start_period text,
    end_period text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_employee_components_amount_type_check CHECK ((amount_type = ANY (ARRAY['fixed'::text, 'percent_of_base'::text]))),
    CONSTRAINT admin_employee_components_component_type_check CHECK ((component_type = ANY (ARRAY['earning'::text, 'deduction'::text])))
);


--
-- Name: admin_employee_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_employee_expenses (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    employee_name text NOT NULL,
    department_id text,
    category text NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    currency text DEFAULT 'NGN'::text,
    date text NOT NULL,
    receipt_url text,
    status text DEFAULT 'pending'::text NOT NULL,
    approver_id text,
    approver_name text,
    approver_comment text,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    journal_entry_id text,
    approval_id text,
    CONSTRAINT admin_employee_expenses_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'paid'::text])))
);


--
-- Name: admin_employee_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_employee_goals (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    title text NOT NULL,
    description text,
    target_metric text,
    target_value numeric,
    actual_value numeric DEFAULT 0,
    status text DEFAULT 'not_started'::text,
    priority text DEFAULT 'medium'::text,
    start_date timestamp with time zone,
    due_date timestamp with time zone,
    completed_at timestamp with time zone,
    linked_task_ids text[] DEFAULT '{}'::text[],
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_employee_goals_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT admin_employee_goals_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'on_track'::text, 'ahead'::text, 'behind'::text, 'achieved'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: admin_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_employees (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    department_id text,
    branch_id text,
    region_id text,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    salary numeric(15,2),
    employment_type text DEFAULT 'full-time'::text,
    phone text,
    job_title text,
    reporting_manager_id text,
    cost_center text,
    hire_date timestamp with time zone,
    created_by text,
    updated_by text,
    role text DEFAULT 'staff'::text,
    password_hash text,
    is_portal_active boolean DEFAULT false,
    last_login timestamp with time zone,
    address text,
    marital_status text,
    profile_picture text,
    gender text,
    date_of_birth text,
    emergency_contact_name text,
    emergency_contact_phone text,
    nationality text,
    state_of_origin text,
    city text,
    portal_permissions jsonb,
    work_mode text DEFAULT 'ONSITE'::text,
    bank_name text,
    bank_account_number text,
    bank_account_name text,
    termination_date date,
    metadata jsonb,
    pending_salary numeric,
    pending_bank_details jsonb,
    bank_details_changed_at timestamp with time zone,
    CONSTRAINT admin_employees_employment_type_check CHECK ((employment_type = ANY (ARRAY['full-time'::text, 'part-time'::text, 'contract'::text, 'intern'::text]))),
    CONSTRAINT admin_employees_role_check CHECK ((role = ANY (ARRAY['staff'::text, 'hod'::text, 'admin'::text, 'executive'::text])))
);


--
-- Name: admin_holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_holidays (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    holiday_date date NOT NULL,
    name text NOT NULL,
    weekly_off boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_integrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_integrations (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'inactive'::text,
    provider text,
    config jsonb NOT NULL,
    webhook_url text,
    events text[] DEFAULT ARRAY[]::text[],
    last_sync_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text,
    updated_by text,
    CONSTRAINT admin_integrations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text, 'error'::text, 'pending'::text]))),
    CONSTRAINT admin_integrations_type_check CHECK ((type = ANY (ARRAY['webhook'::text, 'oauth'::text, 'api_key'::text, 'custom'::text])))
);


--
-- Name: admin_interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_interviews (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    application_id text NOT NULL,
    round_number integer DEFAULT 1 NOT NULL,
    type text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    completed_at timestamp with time zone,
    interviewer_ids text[] DEFAULT ARRAY[]::text[],
    scorecard jsonb,
    notes text,
    recording_url text,
    status text DEFAULT 'scheduled'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_interviews_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text, 'rescheduled'::text]))),
    CONSTRAINT admin_interviews_type_check CHECK ((type = ANY (ARRAY['technical'::text, 'behavioral'::text, 'cultural'::text, 'executive'::text, 'panel'::text, 'phone_screen'::text])))
);


--
-- Name: admin_job_requisitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_job_requisitions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    title text NOT NULL,
    department_id text NOT NULL,
    branch_id text,
    headcount integer DEFAULT 1 NOT NULL,
    budget numeric(15,2),
    required_skills text[] DEFAULT ARRAY[]::text[],
    min_experience_years integer,
    employment_type text NOT NULL,
    description text NOT NULL,
    requirements text,
    location text,
    salary_range text,
    status text DEFAULT 'draft'::text,
    approval_flow_id text,
    requested_by text,
    approved_by text,
    approved_at timestamp with time zone,
    posted_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    preferred_skills text[] DEFAULT ARRAY[]::text[],
    required_certifications text[] DEFAULT ARRAY[]::text[],
    education_level text,
    CONSTRAINT admin_job_requisitions_employment_type_check CHECK ((employment_type = ANY (ARRAY['full-time'::text, 'part-time'::text, 'contract'::text, 'intern'::text]))),
    CONSTRAINT admin_job_requisitions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'open'::text, 'paused'::text, 'closed'::text, 'cancelled'::text])))
);


--
-- Name: admin_leave; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_leave (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    employee_name text NOT NULL,
    leave_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text,
    approved_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reviewer_id text,
    reviewer_comment text,
    reviewed_at timestamp with time zone,
    approval_id text,
    CONSTRAINT admin_leave_leave_type_check CHECK ((leave_type = ANY (ARRAY['annual'::text, 'sick'::text, 'personal'::text, 'maternity'::text, 'paternity'::text, 'unpaid'::text]))),
    CONSTRAINT admin_leave_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: admin_leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_leave_balances (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    employee_name text,
    leave_type text NOT NULL,
    year integer NOT NULL,
    entitled numeric(6,2) DEFAULT 0 NOT NULL,
    used numeric(6,2) DEFAULT 0 NOT NULL,
    pending numeric(6,2) DEFAULT 0 NOT NULL,
    carried_over numeric(6,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    entitlement_set boolean DEFAULT false NOT NULL
);


--
-- Name: admin_leave_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_leave_policies (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    leave_type text NOT NULL,
    entitled_days numeric(6,2) NOT NULL,
    carryover_cap numeric(6,2) DEFAULT 0 NOT NULL,
    accrual text DEFAULT 'annual'::text NOT NULL,
    effective_from date NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    country_code text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_leave_policies_accrual_check CHECK ((accrual = ANY (ARRAY['annual'::text, 'monthly'::text, 'immediate'::text])))
);


--
-- Name: admin_leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_leave_requests (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    employee_name text NOT NULL,
    leave_type text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text,
    reviewer_id text,
    reviewer_name text,
    reviewer_comment text,
    reviewed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_leave_requests_leave_type_check CHECK ((leave_type = ANY (ARRAY['annual'::text, 'sick'::text, 'personal'::text, 'maternity'::text, 'paternity'::text, 'unpaid'::text]))),
    CONSTRAINT admin_leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: admin_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_modules (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    enabled boolean DEFAULT false,
    regions text[] DEFAULT ARRAY[]::text[],
    flags jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_notifications (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    type text DEFAULT 'info'::text NOT NULL,
    category text DEFAULT 'hr'::text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    action_url text,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    read_at timestamp with time zone,
    CONSTRAINT admin_notifications_category_check CHECK ((category = ANY (ARRAY['hr'::text, 'finance'::text, 'crm'::text, 'projects'::text, 'system'::text, 'general'::text]))),
    CONSTRAINT admin_notifications_type_check CHECK ((type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])))
);


--
-- Name: admin_offboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_offboarding (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    employee_name text,
    reason text,
    last_working_day date,
    status text DEFAULT 'initiated'::text NOT NULL,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    initiated_by text,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_offboarding_status_check CHECK ((status = ANY (ARRAY['initiated'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: admin_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_offers (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    application_id text NOT NULL,
    salary numeric(15,2) NOT NULL,
    bonus numeric(15,2),
    benefits jsonb,
    start_date date NOT NULL,
    reporting_manager_id text NOT NULL,
    status text DEFAULT 'draft'::text,
    candidate_response text,
    candidate_response_at timestamp with time zone,
    sent_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_offers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'negotiated'::text, 'accepted'::text, 'rejected'::text, 'expired'::text, 'withdrawn'::text])))
);


--
-- Name: admin_onboarding_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_onboarding_tasks (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    category text NOT NULL,
    task text NOT NULL,
    assigned_to_user_id text NOT NULL,
    status text DEFAULT 'pending'::text,
    due_date date NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_onboarding_tasks_category_check CHECK ((category = ANY (ARRAY['hr'::text, 'it'::text, 'admin'::text, 'manager'::text, 'compliance'::text]))),
    CONSTRAINT admin_onboarding_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'overdue'::text])))
);


--
-- Name: admin_password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_password_reset_tokens (
    id integer NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone
);


--
-- Name: admin_password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admin_password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admin_password_reset_tokens_id_seq OWNED BY public.admin_password_reset_tokens.id;


--
-- Name: admin_payroll_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_payroll_adjustments (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    type text NOT NULL,
    category text NOT NULL,
    amount numeric(15,2) NOT NULL,
    reason text,
    effective_period text NOT NULL,
    status text DEFAULT 'pending'::text,
    approved_by text,
    created_at timestamp with time zone DEFAULT now(),
    applied_at timestamp with time zone,
    CONSTRAINT admin_payroll_adjustments_category_check CHECK ((category = ANY (ARRAY['bonus'::text, 'promotion'::text, 'fine'::text, 'loan_repayment'::text, 'other'::text]))),
    CONSTRAINT admin_payroll_adjustments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'rejected'::text]))),
    CONSTRAINT admin_payroll_adjustments_type_check CHECK ((type = ANY (ARRAY['increment'::text, 'deduction'::text])))
);


--
-- Name: admin_payroll_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_payroll_entries (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    run_id text NOT NULL,
    employee_id text NOT NULL,
    employee_name text NOT NULL,
    department text,
    "position" text,
    base_salary numeric(15,2) DEFAULT 0,
    transport_allowance numeric(15,2) DEFAULT 0,
    housing_allowance numeric(15,2) DEFAULT 0,
    meal_allowance numeric(15,2) DEFAULT 0,
    bonus numeric(15,2) DEFAULT 0,
    tax numeric(15,2) DEFAULT 0,
    pension numeric(15,2) DEFAULT 0,
    health_insurance numeric(15,2) DEFAULT 0,
    other_deductions numeric(15,2) DEFAULT 0,
    total_deductions numeric(15,2) DEFAULT 0,
    gross_pay numeric(15,2) DEFAULT 0,
    net_pay numeric(15,2) DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    employer_cost numeric(15,2) DEFAULT 0 NOT NULL,
    employer_breakdown jsonb DEFAULT '[]'::jsonb NOT NULL,
    statutory_breakdown jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: admin_payroll_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_payroll_runs (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    period text NOT NULL,
    status text DEFAULT 'draft'::text,
    total_gross numeric(15,2) DEFAULT 0,
    total_deductions numeric(15,2) DEFAULT 0,
    total_net numeric(15,2) DEFAULT 0,
    config jsonb DEFAULT '{}'::jsonb,
    anomalies jsonb DEFAULT '[]'::jsonb,
    compliance_passed boolean DEFAULT false,
    processed_at timestamp with time zone,
    processed_by text,
    created_at timestamp with time zone DEFAULT now(),
    approved_by text,
    approved_at timestamp with time zone,
    journal_entry_id text,
    paid_at timestamp with time zone,
    payment_journal_entry_id text,
    approval_id text,
    CONSTRAINT admin_payroll_runs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'processing'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: admin_peer_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_peer_feedback (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    reviewer_id text NOT NULL,
    reviewer_name text,
    reviewer_role text DEFAULT 'peer'::text,
    rating integer NOT NULL,
    collaboration_score integer,
    communication_score integer,
    reliability_score integer,
    strengths text[] DEFAULT '{}'::text[],
    improvements text[] DEFAULT '{}'::text[],
    comments text,
    period text DEFAULT 'monthly'::text,
    is_anonymous boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_peer_feedback_collaboration_score_check CHECK (((collaboration_score >= 1) AND (collaboration_score <= 100))),
    CONSTRAINT admin_peer_feedback_communication_score_check CHECK (((communication_score >= 1) AND (communication_score <= 100))),
    CONSTRAINT admin_peer_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5))),
    CONSTRAINT admin_peer_feedback_reliability_score_check CHECK (((reliability_score >= 1) AND (reliability_score <= 100)))
);


--
-- Name: admin_requisition_screening_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_requisition_screening_configs (
    requisition_id text NOT NULL,
    tenant_slug text NOT NULL,
    selection_mode text NOT NULL,
    selection_value integer NOT NULL,
    min_score_threshold integer DEFAULT 0 NOT NULL,
    is_enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    custom_weights jsonb,
    auto_reject_rules jsonb DEFAULT '[]'::jsonb,
    auto_reject_below_score integer DEFAULT 0 NOT NULL,
    auto_talent_pool_rejected boolean DEFAULT false,
    CONSTRAINT admin_requisition_screening_configs_selection_mode_check CHECK ((selection_mode = ANY (ARRAY['percentage'::text, 'fixed_number'::text])))
);


--
-- Name: admin_review_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_review_cycles (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_review_cycles_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: admin_role_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_role_history (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    user_id text NOT NULL,
    user_email text,
    old_role_id text,
    new_role_id text NOT NULL,
    justification text,
    expires_at timestamp with time zone,
    assigned_by_user_id text,
    assigned_by_email text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_roles (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    scope text NOT NULL,
    permissions text[] DEFAULT ARRAY[]::text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    description text,
    is_system boolean DEFAULT false
);


--
-- Name: admin_screening_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_screening_history (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    requisition_id text NOT NULL,
    application_id text NOT NULL,
    candidate_id text NOT NULL,
    candidate_name text,
    ai_score integer NOT NULL,
    confidence numeric(3,2) DEFAULT 1.0,
    status text NOT NULL,
    auto_rejected boolean DEFAULT false,
    auto_reject_reasons text[] DEFAULT ARRAY[]::text[],
    breakdown jsonb,
    keyword_matches jsonb,
    config_snapshot jsonb,
    run_id text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_security_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_security_policies (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    rules jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text,
    updated_by text
);


--
-- Name: admin_shift_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_shift_assignments (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    shift_id text NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_shifts (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    days_of_week integer[] DEFAULT '{1,2,3,4,5}'::integer[] NOT NULL,
    grace_minutes integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_staff_report_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_staff_report_templates (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    report_type text NOT NULL,
    name text NOT NULL,
    is_default boolean DEFAULT false,
    sections jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT admin_staff_report_templates_report_type_check CHECK ((report_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text])))
);


--
-- Name: admin_staff_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_staff_reports (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    report_type text NOT NULL,
    report_date text NOT NULL,
    objectives text NOT NULL,
    achievements text NOT NULL,
    challenges text,
    next_steps text,
    additional_notes text,
    head_of_department text NOT NULL,
    team_members text[] DEFAULT '{}'::text[],
    submitted_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'pending'::text,
    template_id text,
    template_snapshot jsonb,
    department_id text,
    hod_comment text,
    hod_action_at timestamp with time zone,
    version integer DEFAULT 1,
    resubmission_of_id text,
    rejected_at timestamp with time zone,
    submitter_role text DEFAULT 'staff'::text,
    approver_role text DEFAULT 'hod'::text,
    approver_id text,
    title text,
    raw_transcript text,
    refined_text text,
    meetings text,
    blockers text,
    activities text,
    appraisal jsonb,
    CONSTRAINT admin_staff_reports_report_type_check CHECK ((report_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text]))),
    CONSTRAINT admin_staff_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'approved'::text])))
);


--
-- Name: admin_staff_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_staff_tasks (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    title text NOT NULL,
    description text,
    frequency text NOT NULL,
    due_date text NOT NULL,
    status text DEFAULT 'pending'::text,
    assigned_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    expected_outcome text,
    weight integer DEFAULT 1,
    is_kpi boolean DEFAULT false,
    completion_note text,
    completed_at timestamp with time zone,
    CONSTRAINT admin_staff_tasks_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text, 'annual'::text, 'one-time'::text]))),
    CONSTRAINT admin_staff_tasks_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text, 'overdue'::text])))
);


--
-- Name: admin_statutory_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_statutory_profiles (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    country_code text,
    tax_bands jsonb DEFAULT '[]'::jsonb NOT NULL,
    pension_employee_rate numeric(6,3) DEFAULT 8 NOT NULL,
    pension_employer_rate numeric(6,3) DEFAULT 0 NOT NULL,
    other_deductions jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    paye_annualize boolean DEFAULT false NOT NULL,
    paye_relief jsonb,
    employer_contributions jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: admin_temporary_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_temporary_access (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    granted_to text NOT NULL,
    module_key text NOT NULL,
    permissions text[] NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    justification text NOT NULL,
    approved_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by text
);


--
-- Name: admin_user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_user_roles (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    user_id text NOT NULL,
    role_id text NOT NULL,
    scope text DEFAULT 'tenant'::text,
    scope_id text,
    expires_at timestamp with time zone,
    justification text,
    approved_by text,
    created_at timestamp with time zone DEFAULT now(),
    created_by text
);


--
-- Name: admin_workflow_executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_workflow_executions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    workflow_id text NOT NULL,
    triggered_by text NOT NULL,
    current_step_id text,
    status text DEFAULT 'running'::text,
    execution_history jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: admin_workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_workflows (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    steps jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    trigger text DEFAULT 'manual'::text,
    status text DEFAULT 'draft'::text,
    is_active boolean DEFAULT false,
    description text,
    created_by text,
    updated_by text
);


--
-- Name: advance_taxes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.advance_taxes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    payment_id text NOT NULL,
    tax_code text NOT NULL,
    description text,
    rate numeric DEFAULT 0 NOT NULL,
    tax_amount numeric DEFAULT 0 NOT NULL,
    account_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_conversations (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    turns jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_pending_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_pending_actions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    actor_id text,
    actor_role text,
    action text NOT NULL,
    params jsonb NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    result jsonb,
    error text,
    created_at timestamp with time zone DEFAULT now(),
    executed_at timestamp with time zone,
    expires_at timestamp with time zone,
    CONSTRAINT ai_pending_actions_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'executed'::text, 'rejected'::text, 'expired'::text])))
);


--
-- Name: ai_usage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_log (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    capability text NOT NULL,
    source text NOT NULL,
    success boolean DEFAULT true NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    model text,
    conversation_id text,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: api_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_rate_limits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    reset_time bigint NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: app_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    user_id text NOT NULL,
    event_type text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_delegates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_delegates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    delegator_id text NOT NULL,
    delegate_id text NOT NULL,
    entity_type text,
    valid_from timestamp with time zone DEFAULT now() NOT NULL,
    valid_to timestamp with time zone,
    active boolean DEFAULT true,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    entity_type text NOT NULL,
    rule_type text NOT NULL,
    conditions jsonb NOT NULL,
    approvers jsonb NOT NULL,
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    rule_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by text,
    approver_chain jsonb,
    decisions jsonb,
    current_step integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id text NOT NULL,
    activity_type text NOT NULL,
    reading_value numeric,
    notes text,
    logged_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_capitalizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_capitalizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id text,
    capitalization_date date NOT NULL,
    source_account_code text NOT NULL,
    amount numeric NOT NULL,
    journal_entry_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_depreciation_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_depreciation_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id text NOT NULL,
    period_date date NOT NULL,
    amount numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    journal_entry_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finance_book text DEFAULT 'main'::text NOT NULL
);


--
-- Name: asset_finance_books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_finance_books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id text NOT NULL,
    finance_book text NOT NULL,
    method text DEFAULT 'straight_line'::text NOT NULL,
    useful_life_months integer,
    total_expected_units numeric,
    depreciated_units numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    parent_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_maintenance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_maintenance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id text NOT NULL,
    kind text DEFAULT 'preventive'::text NOT NULL,
    team_name text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_date date,
    completed_date date,
    description text,
    cost numeric DEFAULT 0 NOT NULL,
    journal_entry_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    parts jsonb DEFAULT '[]'::jsonb NOT NULL,
    purchase_invoice_id text
);


--
-- Name: asset_maintenance_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_maintenance_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    members jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id text NOT NULL,
    from_location text,
    to_location text,
    custodian text,
    moved_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: asset_shift_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_shift_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id text NOT NULL,
    employee_id text,
    shift_id text,
    from_date date NOT NULL,
    to_date date,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT asset_shift_allocations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text])))
);


--
-- Name: asset_usage_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_usage_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id text NOT NULL,
    period_date date NOT NULL,
    units numeric NOT NULL,
    finance_book text DEFAULT 'main'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_value_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_value_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id text NOT NULL,
    adjustment_date date NOT NULL,
    old_nbv numeric NOT NULL,
    new_nbv numeric NOT NULL,
    delta numeric NOT NULL,
    reason text,
    journal_entry_id text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: assignment_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignment_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    recommended_employee_id uuid NOT NULL,
    fit_score numeric(5,2),
    recommendation_reason text,
    skills_match_score numeric(5,2),
    capacity_score numeric(5,2),
    availability_score numeric(5,2),
    performance_history_score numeric(5,2),
    status character varying(50) DEFAULT 'NEW'::character varying,
    viewed_at timestamp without time zone,
    assigned_at timestamp without time zone,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone,
    CONSTRAINT assignment_recommendations_status_check CHECK (((status)::text = ANY ((ARRAY['NEW'::character varying, 'VIEWED'::character varying, 'ASSIGNED'::character varying, 'REJECTED'::character varying, 'EXPIRED'::character varying])::text[])))
);


--
-- Name: attendance_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_locations (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    latitude numeric(10,7) NOT NULL,
    longitude numeric(10,7) NOT NULL,
    radius_m integer DEFAULT 500 NOT NULL,
    branch_id text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: attendance_qr_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_qr_tokens (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    location_id text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text NOT NULL,
    actor_id text,
    action text NOT NULL,
    target_table text,
    target_id text,
    diff jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: automation_action_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_action_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid,
    tenant_slug text NOT NULL,
    action_type text NOT NULL,
    action_payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error text,
    scheduled_for timestamp with time zone DEFAULT now(),
    attempt_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT automation_action_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: automation_event_dedup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_event_dedup (
    tenant_slug text NOT NULL,
    event_type text NOT NULL,
    dedup_key text NOT NULL,
    emitted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: automation_rule_audits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_rule_audits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rule_id uuid,
    tenant_slug text NOT NULL,
    trigger_event jsonb,
    matched boolean,
    result jsonb,
    actor text,
    scope jsonb,
    simulation boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    event_type text NOT NULL,
    condition jsonb NOT NULL,
    actions jsonb NOT NULL,
    scope jsonb,
    enabled boolean DEFAULT true,
    simulation_only boolean DEFAULT false,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: bank_guarantees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_guarantees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    direction text NOT NULL,
    beneficiary text NOT NULL,
    bank text NOT NULL,
    amount numeric NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    margin_amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    journal_entry_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_guarantees_direction_check CHECK ((direction = ANY (ARRAY['issued'::text, 'received'::text]))),
    CONSTRAINT bank_guarantees_status_check CHECK ((status = ANY (ARRAY['open'::text, 'pending_approval'::text, 'claimed'::text, 'released'::text, 'expired'::text, 'rejected'::text])))
);


--
-- Name: bank_recon_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_recon_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    match_field text DEFAULT 'description'::text NOT NULL,
    pattern text NOT NULL,
    account_code text,
    party_type text,
    party_id text,
    amount_tolerance numeric,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bank_recon_rules_match_field_check CHECK ((match_field = ANY (ARRAY['description'::text, 'reference'::text]))),
    CONSTRAINT bank_recon_rules_party_type_check CHECK ((party_type = ANY (ARRAY['customer'::text, 'vendor'::text])))
);


--
-- Name: bank_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_reconciliations (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    account_id text NOT NULL,
    statement_date date NOT NULL,
    statement_balance numeric NOT NULL,
    book_balance numeric NOT NULL,
    adjusted_book_balance numeric DEFAULT 0 NOT NULL,
    difference numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    reconciled_items integer DEFAULT 0 NOT NULL,
    unreconciled_items integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bank_reconciliations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_progress'::text, 'reconciled'::text, 'discrepancy'::text])))
);


--
-- Name: bank_statement_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_statement_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    bank_account_code text NOT NULL,
    line_date date NOT NULL,
    description text,
    reference text,
    amount numeric NOT NULL,
    status text DEFAULT 'unmatched'::text NOT NULL,
    matched_entity text,
    matched_id text,
    journal_entry_id uuid,
    reconciliation_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    clearance_date date,
    cleared boolean DEFAULT false NOT NULL,
    CONSTRAINT bank_statement_lines_status_check CHECK ((status = ANY (ARRAY['unmatched'::text, 'matched'::text, 'ignored'::text, 'posted'::text])))
);


--
-- Name: bill_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bill_id uuid NOT NULL,
    description text,
    quantity numeric(12,4) DEFAULT 1 NOT NULL,
    unit_price numeric(18,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,2),
    line_amount numeric(18,2) DEFAULT 0 NOT NULL,
    account_code text,
    metadata jsonb
);


--
-- Name: bill_payment_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_payment_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    bill_id text NOT NULL,
    due_date date NOT NULL,
    amount numeric NOT NULL,
    paid_amount numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    bill_number text NOT NULL,
    vendor_id uuid NOT NULL,
    po_id uuid,
    created_by uuid,
    branch_id uuid,
    bill_date date NOT NULL,
    due_date date,
    currency text DEFAULT 'NGN'::text NOT NULL,
    subtotal numeric(18,2) DEFAULT 0 NOT NULL,
    taxes numeric(18,2) DEFAULT 0 NOT NULL,
    total numeric(18,2) DEFAULT 0 NOT NULL,
    balance_due numeric(18,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    wht_rate numeric(5,2),
    wht_amount numeric(18,2) DEFAULT 0 NOT NULL,
    transaction_currency text,
    exchange_rate numeric,
    approval_id text,
    payment_term_id uuid
);


--
-- Name: bom_headers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_headers (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    product_sku text NOT NULL,
    product_name text NOT NULL,
    revision text DEFAULT '1'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    unit text DEFAULT 'pcs'::text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    routing_id uuid,
    material_cost numeric,
    CONSTRAINT bom_headers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'deprecated'::text])))
);


--
-- Name: bom_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bom_lines (
    id text NOT NULL,
    bom_id text NOT NULL,
    component_sku text NOT NULL,
    component_name text NOT NULL,
    quantity numeric NOT NULL,
    unit text DEFAULT 'pcs'::text NOT NULL,
    component_type text DEFAULT 'raw_material'::text NOT NULL,
    scrap_percentage numeric DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bom_lines_component_type_check CHECK ((component_type = ANY (ARRAY['raw_material'::text, 'subassembly'::text, 'finished_good'::text])))
);


--
-- Name: budget_actuals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_actuals (
    id bigint NOT NULL,
    budget_id bigint NOT NULL,
    budget_line_id bigint,
    tenant_slug text NOT NULL,
    actual_type character varying(50) NOT NULL,
    transaction_id bigint,
    transaction_code character varying(255),
    actual_amount numeric(19,2) NOT NULL,
    committed_amount numeric(19,2) DEFAULT 0,
    account_id bigint,
    account_code character varying(50),
    cost_center_id bigint,
    project_id bigint,
    transaction_date date,
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    CONSTRAINT budget_actuals_actual_type_check CHECK (((actual_type)::text = ANY ((ARRAY['EXPENSE'::character varying, 'INVOICE'::character varying, 'PURCHASE_ORDER'::character varying, 'PAYMENT'::character varying])::text[])))
);


--
-- Name: budget_actuals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_actuals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_actuals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_actuals_id_seq OWNED BY public.budget_actuals.id;


--
-- Name: budget_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_approvals (
    id bigint NOT NULL,
    budget_id bigint NOT NULL,
    tenant_slug text NOT NULL,
    approval_sequence integer NOT NULL,
    approver_role character varying(100) NOT NULL,
    approver_id character varying(255),
    approver_name character varying(255),
    status character varying(20) NOT NULL,
    comment text,
    approved_at timestamp without time zone,
    CONSTRAINT budget_approvals_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: budget_approvals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_approvals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_approvals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_approvals_id_seq OWNED BY public.budget_approvals.id;


--
-- Name: budget_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_forecasts (
    id bigint NOT NULL,
    budget_id bigint NOT NULL,
    tenant_slug text NOT NULL,
    forecast_type character varying(30) NOT NULL,
    forecast_period_start date,
    forecast_period_end date,
    forecast_lines jsonb NOT NULL,
    scenario_name character varying(255),
    scenario_description text,
    methodology character varying(255),
    base_periods integer,
    confidence_level character varying(20),
    variance_percent numeric(5,2),
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT budget_forecasts_confidence_level_check CHECK (((confidence_level)::text = ANY ((ARRAY['HIGH'::character varying, 'MEDIUM'::character varying, 'LOW'::character varying])::text[]))),
    CONSTRAINT budget_forecasts_forecast_type_check CHECK (((forecast_type)::text = ANY ((ARRAY['ROLLING'::character varying, 'TREND_BASED'::character varying, 'SCENARIO'::character varying])::text[])))
);


--
-- Name: budget_forecasts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_forecasts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_forecasts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_forecasts_id_seq OWNED BY public.budget_forecasts.id;


--
-- Name: budget_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_lines (
    id bigint NOT NULL,
    budget_id bigint NOT NULL,
    tenant_slug text NOT NULL,
    line_number integer NOT NULL,
    account_id bigint,
    account_code character varying(50),
    account_name character varying(255),
    cost_center_id bigint,
    cost_center_name character varying(255),
    project_id bigint,
    project_name character varying(255),
    budgeted_amount numeric(19,2) DEFAULT 0 NOT NULL,
    allocation_percent numeric(5,2),
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: budget_line_variance_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.budget_line_variance_view AS
 SELECT bl.id AS budget_line_id,
    bl.budget_id,
    bl.tenant_slug,
    bl.account_code,
    bl.account_name,
    bl.budgeted_amount,
    COALESCE(sum(ba.actual_amount), (0)::numeric) AS actual_amount,
    COALESCE(sum(ba.committed_amount), (0)::numeric) AS committed_amount,
    (bl.budgeted_amount - (COALESCE(sum(ba.actual_amount), (0)::numeric) + COALESCE(sum(ba.committed_amount), (0)::numeric))) AS remaining_balance,
    round((((COALESCE(sum(ba.actual_amount), (0)::numeric) + COALESCE(sum(ba.committed_amount), (0)::numeric)) / NULLIF(bl.budgeted_amount, (0)::numeric)) * (100)::numeric), 2) AS percent_utilized
   FROM (public.budget_lines bl
     LEFT JOIN public.budget_actuals ba ON ((bl.id = ba.budget_line_id)))
  GROUP BY bl.id, bl.budget_id, bl.tenant_slug, bl.account_code, bl.account_name, bl.budgeted_amount;


--
-- Name: budget_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_lines_id_seq OWNED BY public.budget_lines.id;


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id bigint NOT NULL,
    tenant_slug text NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    budget_type character varying(20) NOT NULL,
    scope_entity_id bigint,
    scope_entity_name character varying(255),
    period_type character varying(20) NOT NULL,
    fiscal_year integer NOT NULL,
    quarter_num integer,
    month_num integer,
    total_budget_amount numeric(19,2) DEFAULT 0 NOT NULL,
    status character varying(20) NOT NULL,
    enforcement_mode character varying(20) DEFAULT 'SOFT_WARNING'::character varying NOT NULL,
    allow_overrun boolean DEFAULT false,
    overrun_threshold_percent numeric(5,2) DEFAULT 110,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    approved_by character varying(255),
    approved_at timestamp without time zone,
    version_number integer DEFAULT 1,
    notes text,
    CONSTRAINT budgets_budget_type_check CHECK (((budget_type)::text = ANY ((ARRAY['DEPARTMENT'::character varying, 'PROJECT'::character varying, 'BRANCH'::character varying, 'ACCOUNT_CATEGORY'::character varying])::text[]))),
    CONSTRAINT budgets_enforcement_mode_check CHECK (((enforcement_mode)::text = ANY ((ARRAY['SOFT_WARNING'::character varying, 'HARD_BLOCK'::character varying, 'AUDIT_ONLY'::character varying])::text[]))),
    CONSTRAINT budgets_month_num_check CHECK (((month_num IS NULL) OR ((month_num >= 1) AND (month_num <= 12)))),
    CONSTRAINT budgets_period_type_check CHECK (((period_type)::text = ANY ((ARRAY['ANNUAL'::character varying, 'QUARTERLY'::character varying, 'MONTHLY'::character varying])::text[]))),
    CONSTRAINT budgets_quarter_num_check CHECK (((quarter_num IS NULL) OR ((quarter_num >= 1) AND (quarter_num <= 4)))),
    CONSTRAINT budgets_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'APPROVED'::character varying, 'ACTIVE'::character varying, 'CLOSED'::character varying, 'ARCHIVED'::character varying])::text[])))
);


--
-- Name: budget_summary_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.budget_summary_view AS
 SELECT b.id,
    b.tenant_slug,
    b.code,
    b.name,
    b.budget_type,
    b.period_type,
    b.fiscal_year,
    b.status,
    b.total_budget_amount,
    COALESCE(sum(ba.actual_amount), (0)::numeric) AS total_actual,
    COALESCE(sum(ba.committed_amount), (0)::numeric) AS total_committed,
    (b.total_budget_amount - (COALESCE(sum(ba.actual_amount), (0)::numeric) + COALESCE(sum(ba.committed_amount), (0)::numeric))) AS remaining_balance,
    round((((COALESCE(sum(ba.actual_amount), (0)::numeric) + COALESCE(sum(ba.committed_amount), (0)::numeric)) / NULLIF(b.total_budget_amount, (0)::numeric)) * (100)::numeric), 2) AS percent_utilized,
    b.created_at,
    b.approved_at
   FROM (public.budgets b
     LEFT JOIN public.budget_actuals ba ON ((b.id = ba.budget_id)))
  GROUP BY b.id, b.tenant_slug, b.code, b.name, b.budget_type, b.period_type, b.fiscal_year, b.status, b.total_budget_amount, b.created_at, b.approved_at;


--
-- Name: budget_variances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_variances (
    id bigint NOT NULL,
    budget_id bigint NOT NULL,
    budget_line_id bigint,
    tenant_slug text NOT NULL,
    variance_type character varying(30) NOT NULL,
    budgeted_amount numeric(19,2),
    actual_amount numeric(19,2),
    committed_amount numeric(19,2) DEFAULT 0,
    variance_amount numeric(19,2),
    variance_percent numeric(5,2),
    alert_level character varying(20),
    is_acknowledged boolean DEFAULT false,
    acknowledged_by character varying(255),
    acknowledged_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT budget_variances_alert_level_check CHECK (((alert_level)::text = ANY ((ARRAY['INFO'::character varying, 'WARNING'::character varying, 'CRITICAL'::character varying])::text[]))),
    CONSTRAINT budget_variances_variance_type_check CHECK (((variance_type)::text = ANY ((ARRAY['OVER_BUDGET'::character varying, 'UNDER_BUDGET'::character varying, 'THRESHOLD_WARNING'::character varying])::text[])))
);


--
-- Name: budget_variances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_variances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_variances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_variances_id_seq OWNED BY public.budget_variances.id;


--
-- Name: budget_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_versions (
    id bigint NOT NULL,
    budget_id bigint NOT NULL,
    tenant_slug text NOT NULL,
    version_number integer NOT NULL,
    status character varying(20) NOT NULL,
    total_budget_amount numeric(19,2) NOT NULL,
    change_reason character varying(255),
    changed_by character varying(255),
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    budget_snapshot jsonb
);


--
-- Name: budget_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budget_versions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budget_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budget_versions_id_seq OWNED BY public.budget_versions.id;


--
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.budgets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.budgets_id_seq OWNED BY public.budgets.id;


--
-- Name: capacity_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.capacity_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    employee_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    total_available_hours numeric(10,2),
    allocated_to_projects_hours numeric(10,2),
    allocated_to_maintenance_hours numeric(10,2),
    available_capacity_hours numeric(10,2),
    utilization_percentage numeric(5,2),
    forecasted_allocation_next_30days numeric(10,2),
    forecasted_allocation_next_90days numeric(10,2),
    over_allocated_risk boolean,
    skill_gap_risk boolean,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chart_of_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    parent_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    account_code text,
    account_name text,
    account_type text,
    sub_type text,
    subtype text,
    balance numeric(18,2) DEFAULT 0,
    description text,
    parent_account_id text,
    parent_accounts_id text,
    currency text DEFAULT 'NGN'::text,
    is_system_account boolean DEFAULT false,
    branch_id text,
    department_id text,
    project_id text,
    allow_manual_posting boolean DEFAULT true,
    require_cost_center boolean DEFAULT false,
    is_reconciliation_account boolean DEFAULT false,
    created_by text,
    tenant_slug text,
    is_active boolean DEFAULT true
);


--
-- Name: cheque_print_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cheque_print_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    bank text,
    fields jsonb NOT NULL,
    scan_url text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cms_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    content text NOT NULL,
    published boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cms_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    content text NOT NULL,
    excerpt text,
    category text,
    cover_image text,
    published boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    author text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cost_center_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_center_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    account_code text NOT NULL,
    allocations jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: coupon_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coupon_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    code text NOT NULL,
    description text,
    discount_type text DEFAULT 'percent'::text NOT NULL,
    discount_value numeric NOT NULL,
    min_order_value numeric,
    valid_from date,
    valid_to date,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coupon_codes_discount_type_check CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text])))
);


--
-- Name: crm_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_activities (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    description text,
    related_to text,
    related_id text,
    related_name text,
    assigned_to text,
    due_date timestamp with time zone,
    completed_at timestamp with time zone,
    status text DEFAULT 'pending'::text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_activity_log (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    title text NOT NULL,
    party_type text,
    party_id text,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 30 NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    attendees jsonb DEFAULT '[]'::jsonb NOT NULL,
    location text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_appointments_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])))
);


--
-- Name: crm_campaign_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_campaign_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    sequence integer NOT NULL,
    delay_days integer DEFAULT 0 NOT NULL,
    subject text NOT NULL,
    body_html text NOT NULL,
    body_text text
);


--
-- Name: crm_campaign_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_campaign_enrollments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid NOT NULL,
    tenant_slug text NOT NULL,
    recipient_type text DEFAULT 'lead'::text NOT NULL,
    recipient_id text,
    recipient_email text NOT NULL,
    recipient_name text,
    status text DEFAULT 'active'::text NOT NULL,
    current_step integer DEFAULT 0 NOT NULL,
    next_send_at timestamp with time zone,
    enrolled_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_campaign_enrollments_recipient_type_check CHECK ((recipient_type = ANY (ARRAY['lead'::text, 'contact'::text, 'customer'::text, 'manual'::text]))),
    CONSTRAINT crm_campaign_enrollments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'unsubscribed'::text, 'bounced'::text])))
);


--
-- Name: crm_campaign_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_campaign_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    enrollment_id uuid NOT NULL,
    campaign_email_id uuid NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    message_id text,
    error text
);


--
-- Name: crm_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    website text,
    strengths text,
    weaknesses text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_contacts (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    company text NOT NULL,
    contact_name text NOT NULL,
    contact_email text,
    contact_phone text,
    source text,
    status text DEFAULT 'New'::text,
    tags text[] DEFAULT ARRAY[]::text[],
    imported_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text
);


--
-- Name: crm_contract_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_contract_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    body text NOT NULL,
    fulfilment_terms jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    contract_number text NOT NULL,
    template_id uuid,
    customer_id text NOT NULL,
    customer_name text NOT NULL,
    deal_id text,
    project_id text,
    status text DEFAULT 'draft'::text NOT NULL,
    start_date date,
    end_date date,
    signed_date date,
    contract_value numeric,
    currency text DEFAULT 'NGN'::text NOT NULL,
    body text,
    fulfilment_checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    document_url text,
    renewal_reminded boolean DEFAULT false NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'unsigned'::text, 'active'::text, 'fulfilled'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: crm_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_conversions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    lead_id text NOT NULL,
    customer_id text,
    source_stage text,
    converted_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_customers (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    region_id text NOT NULL,
    branch_id text NOT NULL,
    name text NOT NULL,
    primary_contact jsonb,
    status text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    converted_from_lead_id text
);


--
-- Name: crm_deal_competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_deal_competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    deal_id text NOT NULL,
    competitor_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_deal_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_deal_items (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    deal_id text NOT NULL,
    sku text,
    description text NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_deals (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    customer_id text,
    lead_id text,
    stage text NOT NULL,
    value numeric NOT NULL,
    currency text NOT NULL,
    probability integer,
    expected_close date,
    assigned_officer_id text,
    status text DEFAULT 'open'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contact_id text,
    name text,
    created_by text,
    stage_id uuid,
    lost_reason text
);


--
-- Name: crm_email_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_email_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    trigger_event text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_email_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'completed'::text])))
);


--
-- Name: crm_industry_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_industry_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_leads (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    region_id text NOT NULL,
    branch_id text NOT NULL,
    company_name text NOT NULL,
    contact_name text NOT NULL,
    contact_email text,
    contact_phone text,
    source text NOT NULL,
    stage text NOT NULL,
    score integer DEFAULT 0,
    assigned_officer_id text,
    expected_value numeric,
    currency text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contact_id text,
    created_by text,
    prospect_id uuid,
    lead_source_id text
);


--
-- Name: crm_market_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_market_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    title text,
    content text NOT NULL,
    party_type text,
    party_id text,
    notify_on_login boolean DEFAULT false NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_prospects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_prospects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    company_name text,
    email text,
    phone text,
    industry text,
    market_segment text,
    website text,
    status text DEFAULT 'open'::text NOT NULL,
    lead_id text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT crm_prospects_status_check CHECK ((status = ANY (ARRAY['open'::text, 'converted'::text, 'lost'::text])))
);


--
-- Name: crm_sales_stages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_sales_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    sequence integer DEFAULT 0 NOT NULL,
    probability numeric DEFAULT 0 NOT NULL,
    is_won boolean DEFAULT false NOT NULL,
    is_lost boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: crm_territories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_territories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    is_group boolean DEFAULT false NOT NULL,
    territory_manager text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: custom_field_defs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_field_defs (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    doctype text NOT NULL,
    field_name text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL,
    options jsonb,
    required boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_field_defs_field_type_check CHECK ((field_type = ANY (ARRAY['text'::text, 'number'::text, 'date'::text, 'boolean'::text, 'select'::text])))
);


--
-- Name: custom_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_reports (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    table_name text NOT NULL,
    columns jsonb DEFAULT '[]'::jsonb NOT NULL,
    filters jsonb DEFAULT '[]'::jsonb NOT NULL,
    sort jsonb,
    row_limit integer DEFAULT 500 NOT NULL,
    is_shared boolean DEFAULT false NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: data_imports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    entity text NOT NULL,
    file_name text,
    column_map jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    imported_rows integer DEFAULT 0 NOT NULL,
    failed_rows integer DEFAULT 0 NOT NULL,
    errors jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: deferred_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deferred_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    direction text NOT NULL,
    document_type text NOT NULL,
    document_id text NOT NULL,
    line_no integer,
    party text,
    item text,
    total_amount numeric NOT NULL,
    recognized_amount numeric DEFAULT 0 NOT NULL,
    service_start_date date NOT NULL,
    service_end_date date NOT NULL,
    deferred_account_code text NOT NULL,
    recognition_account_code text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT deferred_items_direction_check CHECK ((direction = ANY (ARRAY['revenue'::text, 'expense'::text]))),
    CONSTRAINT deferred_items_status_check CHECK ((status = ANY (ARRAY['open'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: deferred_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deferred_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    deferred_item_id uuid NOT NULL,
    period_date date NOT NULL,
    amount numeric NOT NULL,
    journal_entry_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT deferred_schedule_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'posted'::text])))
);


--
-- Name: delivery_note_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_note_items (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    note_id text NOT NULL,
    so_line_key text,
    product_id text,
    sku text,
    description text,
    ordered_qty numeric DEFAULT 0 NOT NULL,
    delivered_qty numeric DEFAULT 0 NOT NULL,
    rejected_qty numeric DEFAULT 0 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    uom text
);


--
-- Name: delivery_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_notes (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    note_number text NOT NULL,
    sales_order_id text,
    customer_id text,
    customer_name text,
    warehouse_id text,
    delivery_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_amount numeric DEFAULT 0 NOT NULL,
    approval_id text,
    driver text,
    vehicle text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT delivery_notes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'delivered'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: doc_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doc_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    doc_type text NOT NULL,
    doc_id text NOT NULL,
    shared_with text NOT NULL,
    permission text DEFAULT 'read'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT doc_shares_permission_check CHECK ((permission = ANY (ARRAY['read'::text, 'write'::text, 'share'::text])))
);


--
-- Name: document_due_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_due_schedule (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    document_type text NOT NULL,
    document_id text NOT NULL,
    term_id text,
    sequence integer DEFAULT 0 NOT NULL,
    due_date date NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    paid_amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT document_due_schedule_document_type_check CHECK ((document_type = ANY (ARRAY['invoice'::text, 'bill'::text]))),
    CONSTRAINT document_due_schedule_status_check CHECK ((status = ANY (ARRAY['open'::text, 'partial'::text, 'paid'::text, 'void'::text])))
);


--
-- Name: document_merges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_merges (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    doc_type text NOT NULL,
    source_id text NOT NULL,
    target_id text NOT NULL,
    rewrote jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_merges_doc_type_check CHECK ((doc_type = ANY (ARRAY['customer'::text, 'vendor'::text])))
);


--
-- Name: domain_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.domain_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    event_type text NOT NULL,
    source_module text,
    source_record_id text,
    actor_id text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: downtime_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.downtime_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    workstation_id uuid,
    work_order_id text,
    plant_floor_id uuid,
    from_ts timestamp with time zone NOT NULL,
    to_ts timestamp with time zone,
    reason text NOT NULL,
    category text,
    operator text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dunning_notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dunning_notices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    invoice_id text NOT NULL,
    level integer NOT NULL,
    issue_date date NOT NULL,
    method text DEFAULT 'letter'::text NOT NULL,
    fee_amount numeric DEFAULT 0 NOT NULL,
    journal_entry_id uuid,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: einvoice_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.einvoice_submissions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    invoice_id text NOT NULL,
    provider text DEFAULT 'firs-sandbox'::text NOT NULL,
    irn text NOT NULL,
    status text NOT NULL,
    payload jsonb,
    response jsonb,
    submitted_by text,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_grievances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_grievances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    grievance_type text NOT NULL,
    subject text NOT NULL,
    description text,
    raised_on date DEFAULT CURRENT_DATE NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    assigned_to text,
    resolution text,
    resolved_on date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_grievances_status_check CHECK ((status = ANY (ARRAY['open'::text, 'investigating'::text, 'resolved'::text, 'closed'::text, 'dismissed'::text])))
);


--
-- Name: employee_skill_maps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_skill_maps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    skill text NOT NULL,
    proficiency integer DEFAULT 1 NOT NULL,
    evaluated_on date DEFAULT CURRENT_DATE NOT NULL,
    evaluator text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_skill_maps_proficiency_check CHECK (((proficiency >= 1) AND (proficiency <= 5)))
);


--
-- Name: employee_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    employee_id uuid NOT NULL,
    skill_code character varying(100) NOT NULL,
    skill_name character varying(255) NOT NULL,
    proficiency_level character varying(50) DEFAULT 'INTERMEDIATE'::character varying,
    certified boolean DEFAULT false,
    certified_at date,
    certification_expires_at date,
    years_of_experience numeric(4,1),
    last_used_date date,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT employee_skills_proficiency_level_check CHECK (((proficiency_level)::text = ANY ((ARRAY['BEGINNER'::character varying, 'INTERMEDIATE'::character varying, 'ADVANCED'::character varying, 'EXPERT'::character varying])::text[])))
);


--
-- Name: employee_tax_declarations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_tax_declarations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    tax_year integer NOT NULL,
    reliefs jsonb DEFAULT '{}'::jsonb NOT NULL,
    declared_amount numeric DEFAULT 0 NOT NULL,
    proof_document text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_tax_declarations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: employee_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    from_department_id text,
    to_department_id text,
    from_branch_id text,
    to_branch_id text,
    transfer_date date NOT NULL,
    reason text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_transfers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: energy_point_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.energy_point_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    user_id text NOT NULL,
    points integer NOT NULL,
    reason text NOT NULL,
    doc_type text,
    doc_id text,
    reverted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: engineer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engineer_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id uuid NOT NULL,
    display_name text,
    role text,
    branch_id uuid,
    region text,
    service_areas text[] DEFAULT '{}'::text[] NOT NULL,
    skills text[] DEFAULT '{}'::text[] NOT NULL,
    certifications text[] DEFAULT '{}'::text[] NOT NULL,
    on_duty boolean DEFAULT false NOT NULL,
    current_load integer DEFAULT 0 NOT NULL,
    max_load integer DEFAULT 5 NOT NULL,
    performance_score numeric(5,2) DEFAULT 0 NOT NULL,
    last_assignment_at timestamp with time zone,
    availability jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exchange_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    currency text NOT NULL,
    rate_date date NOT NULL,
    rate numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    CONSTRAINT exchange_rates_rate_check CHECK ((rate > (0)::numeric))
);


--
-- Name: expense_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_approvals (
    id text NOT NULL,
    expense_id text NOT NULL,
    approver_role text NOT NULL,
    approver_id text NOT NULL,
    approver_name text NOT NULL,
    action text NOT NULL,
    reason text,
    "timestamp" timestamp with time zone DEFAULT now(),
    amount_threshold numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT expense_approvals_action_check CHECK ((action = ANY (ARRAY['APPROVED'::text, 'REJECTED'::text, 'PENDING'::text, 'CLARIFY_NEEDED'::text]))),
    CONSTRAINT expense_approvals_approver_role_check CHECK ((approver_role = ANY (ARRAY['MANAGER'::text, 'FINANCE'::text, 'EXECUTIVE'::text])))
);


--
-- Name: expense_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_audit_logs (
    id text NOT NULL,
    expense_id text NOT NULL,
    action text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    user_id text NOT NULL,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_categories (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    account_id text NOT NULL,
    requires_vendor boolean DEFAULT false,
    requires_receipt boolean DEFAULT false,
    category_limit numeric,
    policy_description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: expense_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_receipts (
    id text NOT NULL,
    expense_id text NOT NULL,
    filename text NOT NULL,
    mime_type text NOT NULL,
    data text NOT NULL,
    size_bytes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expenses (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    region_id text,
    branch_id text,
    type text NOT NULL,
    amount numeric NOT NULL,
    tax_amount numeric DEFAULT 0 NOT NULL,
    total_amount numeric NOT NULL,
    tax_type text NOT NULL,
    category text NOT NULL,
    category_id text NOT NULL,
    description text NOT NULL,
    vendor text,
    date date NOT NULL,
    approval_status text DEFAULT 'DRAFT'::text NOT NULL,
    payment_status text DEFAULT 'UNPAID'::text NOT NULL,
    gl_account_id text,
    notes text,
    attachments text[] DEFAULT ARRAY[]::text[],
    prepaid_schedule jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text NOT NULL,
    department_id text,
    submitter_employee_id text,
    approval_id text,
    journal_entry_id text,
    CONSTRAINT expenses_approval_status_check CHECK ((approval_status = ANY (ARRAY['DRAFT'::text, 'PENDING'::text, 'APPROVED'::text, 'REJECTED'::text, 'CLARIFY_NEEDED'::text]))),
    CONSTRAINT expenses_payment_status_check CHECK ((payment_status = ANY (ARRAY['UNPAID'::text, 'PAID'::text, 'REIMBURSED'::text, 'PENDING'::text]))),
    CONSTRAINT expenses_tax_type_check CHECK ((tax_type = ANY (ARRAY['VAT'::text, 'WHT'::text, 'NONE'::text]))),
    CONSTRAINT expenses_type_check CHECK ((type = ANY (ARRAY['vendor'::text, 'reimbursement'::text, 'cash'::text, 'prepaid'::text])))
);


--
-- Name: field_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    ticket_id uuid NOT NULL,
    engineer_id uuid,
    status text DEFAULT 'scheduled'::text NOT NULL,
    location jsonb,
    travel_log jsonb,
    scheduled_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    arrival_confirmed_at timestamp with time zone,
    work_started_at timestamp with time zone,
    work_completed_at timestamp with time zone,
    customer_signoff jsonb,
    before_media jsonb,
    after_media jsonb,
    work_notes text,
    hours_worked numeric(10,2),
    cost_center_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT field_jobs_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'dispatched'::text, 'in_transit'::text, 'on_site'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: finance_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_accounts (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    region_id text,
    branch_id text,
    name text NOT NULL,
    type text NOT NULL,
    currency text DEFAULT '₦'::text NOT NULL,
    balance numeric DEFAULT 0 NOT NULL,
    change_value numeric,
    change_period text,
    trend text DEFAULT 'up'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    bank_name text,
    bank_code text,
    account_number text,
    account_name text,
    swift_code text,
    CONSTRAINT finance_accounts_trend_check CHECK ((trend = ANY (ARRAY['up'::text, 'down'::text]))),
    CONSTRAINT finance_accounts_type_check CHECK ((type = ANY (ARRAY['bank'::text, 'cash'::text])))
);


--
-- Name: finance_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_allocations (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    expense_id text NOT NULL,
    cost_center_id text NOT NULL,
    amount numeric DEFAULT 0,
    percentage numeric DEFAULT 100,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: finance_cached_summary; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_cached_summary (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    total_revenue numeric(19,2) DEFAULT 0,
    revenue_this_month numeric(19,2) DEFAULT 0,
    revenue_last_month numeric(19,2) DEFAULT 0,
    total_expenses numeric(19,2) DEFAULT 0,
    expenses_this_month numeric(19,2) DEFAULT 0,
    expenses_last_month numeric(19,2) DEFAULT 0,
    total_payables numeric(19,2) DEFAULT 0,
    overdue_payables numeric(19,2) DEFAULT 0,
    total_receivables numeric(19,2) DEFAULT 0,
    overdue_receivables numeric(19,2) DEFAULT 0,
    payroll_this_month numeric(19,2) DEFAULT 0,
    headcount integer DEFAULT 0,
    cash_balance numeric(19,2) DEFAULT 0,
    total_budget numeric(19,2) DEFAULT 0,
    budget_utilized numeric(19,2) DEFAULT 0,
    last_event_id uuid,
    last_event_timestamp timestamp without time zone,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_cost_centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_cost_centers (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    region text,
    budget numeric DEFAULT 0,
    spent numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: finance_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    customer_code text NOT NULL,
    name text NOT NULL,
    credit_limit numeric,
    credit_hold boolean DEFAULT false NOT NULL,
    payment_term_id uuid,
    default_currency text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    pending_credit_limit numeric,
    merged_into text
);


--
-- Name: finance_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    event_type character varying(100) NOT NULL,
    source_module character varying(50) NOT NULL,
    source_record_id character varying(255),
    user_id character varying(255),
    amount numeric(19,2),
    currency character varying(3) DEFAULT 'NGN'::character varying,
    gl_account_code character varying(50),
    branch_id uuid,
    region_id uuid,
    metadata jsonb,
    event_timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: finance_dashboard_metrics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.finance_dashboard_metrics AS
 SELECT tenant_slug,
    (total_revenue + COALESCE(( SELECT sum(fe.amount) AS sum
           FROM public.finance_events fe
          WHERE (((fe.tenant_slug)::text = (cs.tenant_slug)::text) AND (fe.processed = false) AND ((fe.event_type)::text = ANY ((ARRAY['invoice_paid'::character varying, 'deal_won'::character varying, 'payment_received'::character varying])::text[])))), (0)::numeric)) AS live_revenue,
    (total_expenses + COALESCE(( SELECT sum(fe.amount) AS sum
           FROM public.finance_events fe
          WHERE (((fe.tenant_slug)::text = (cs.tenant_slug)::text) AND (fe.processed = false) AND ((fe.event_type)::text = ANY ((ARRAY['expense_approved'::character varying, 'bill_paid'::character varying, 'payroll_run'::character varying])::text[])))), (0)::numeric)) AS live_expenses,
    (total_payables + COALESCE(( SELECT sum(fe.amount) AS sum
           FROM public.finance_events fe
          WHERE (((fe.tenant_slug)::text = (cs.tenant_slug)::text) AND (fe.processed = false) AND ((fe.event_type)::text = ANY ((ARRAY['bill_created'::character varying, 'po_approved'::character varying])::text[])))), (0)::numeric)) AS live_payables,
    overdue_payables,
    (total_receivables + COALESCE(( SELECT sum(fe.amount) AS sum
           FROM public.finance_events fe
          WHERE (((fe.tenant_slug)::text = (cs.tenant_slug)::text) AND (fe.processed = false) AND ((fe.event_type)::text = 'invoice_issued'::text))), (0)::numeric)) AS live_receivables,
    overdue_receivables,
    cash_balance,
    headcount,
    updated_at,
    last_event_timestamp
   FROM public.finance_cached_summary cs;


--
-- Name: finance_expense_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_expense_categories (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    region_id text,
    branch_id text,
    label text NOT NULL,
    amount numeric NOT NULL,
    delta_percent numeric NOT NULL,
    direction text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT finance_expense_categories_direction_check CHECK ((direction = ANY (ARRAY['up'::text, 'down'::text])))
);


--
-- Name: finance_invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_invoice_lines (
    id text NOT NULL,
    invoice_id text NOT NULL,
    description text NOT NULL,
    quantity numeric NOT NULL,
    unit_price numeric NOT NULL,
    amount numeric NOT NULL,
    account_code text,
    tax_rate numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: finance_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_invoices (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    region_id text,
    branch_id text,
    customer_name text NOT NULL,
    customer_code text,
    invoice_number text NOT NULL,
    purchase_order text,
    issued_date date NOT NULL,
    due_date date NOT NULL,
    currency text DEFAULT '₦'::text NOT NULL,
    amount numeric NOT NULL,
    balance_due numeric NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    payment_terms text,
    notes text,
    tags text[],
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    journal_entry_id uuid,
    reversed_journal_entry_id uuid,
    payment_term_id uuid,
    customer_id uuid,
    transaction_currency text,
    exchange_rate numeric,
    einvoice_status text,
    einvoice_irn text,
    customer_email text,
    sales_partner_id uuid,
    CONSTRAINT finance_invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'partially_paid'::text, 'paid'::text, 'overdue'::text, 'void'::text]))),
    CONSTRAINT finance_invoices_tags_check CHECK (((tags IS NULL) OR (array_length(tags, 1) <= 32)))
);


--
-- Name: finance_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_payments (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    customer_id text,
    invoice_id text,
    reference text NOT NULL,
    gross_amount numeric NOT NULL,
    fees numeric DEFAULT 0 NOT NULL,
    net_amount numeric NOT NULL,
    method text NOT NULL,
    gateway text,
    gateway_reference text,
    payment_date date NOT NULL,
    settlement_date date,
    confirmation_details text,
    status text DEFAULT 'pending'::text NOT NULL,
    linked_invoices text[],
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    journal_entry_id uuid,
    reversed_journal_entry_id uuid,
    transaction_currency text,
    exchange_rate numeric,
    CONSTRAINT finance_payments_gateway_check CHECK ((gateway = ANY (ARRAY['paystack'::text, 'flutterwave'::text, 'stripe'::text, 'manual'::text]))),
    CONSTRAINT finance_payments_method_check CHECK ((method = ANY (ARRAY['bank_transfer'::text, 'check'::text, 'cash'::text, 'pos'::text, 'mobile_money'::text, 'wire'::text, 'paystack'::text, 'flutterwave'::text, 'stripe'::text]))),
    CONSTRAINT finance_payments_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'successful'::text, 'failed'::text, 'reversed'::text])))
);


--
-- Name: finance_posting_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_posting_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    setting_key text NOT NULL,
    account_code text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_returns (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    direction text NOT NULL,
    source_document_id text NOT NULL,
    document_no text NOT NULL,
    status text DEFAULT 'posted'::text NOT NULL,
    items jsonb NOT NULL,
    net_amount numeric NOT NULL,
    tax_amount numeric DEFAULT 0 NOT NULL,
    total_amount numeric NOT NULL,
    reason text,
    restock boolean DEFAULT false NOT NULL,
    journal_entry_id text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    warehouse_id text,
    metadata jsonb,
    CONSTRAINT finance_returns_direction_check CHECK ((direction = ANY (ARRAY['sales'::text, 'purchase'::text])))
);


--
-- Name: finance_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_schedules (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    region_id text,
    branch_id text,
    entity_name text NOT NULL,
    amount numeric NOT NULL,
    currency text DEFAULT '₦'::text NOT NULL,
    due_date date NOT NULL,
    status text DEFAULT 'current'::text NOT NULL,
    document_type text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT finance_schedules_document_type_check CHECK ((document_type = ANY (ARRAY['receivable'::text, 'payable'::text]))),
    CONSTRAINT finance_schedules_status_check CHECK ((status = ANY (ARRAY['current'::text, 'due_soon'::text, 'overdue'::text])))
);


--
-- Name: finance_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_settings (
    tenant_slug text NOT NULL,
    accounts_frozen_until date,
    credit_check_mode text DEFAULT 'block'::text NOT NULL,
    auto_exchange_revaluation boolean DEFAULT false NOT NULL,
    default_payment_terms_days integer DEFAULT 30 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: finance_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_subscriptions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    plan text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    seats integer DEFAULT 1 NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    features text[] DEFAULT ARRAY[]::text[],
    next_billing_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT finance_subscriptions_status_check CHECK ((status = ANY (ARRAY['trial'::text, 'active'::text, 'suspended'::text, 'cancelled'::text])))
);


--
-- Name: finance_trend_points; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_trend_points (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    region_id text,
    branch_id text,
    timeframe text NOT NULL,
    label text NOT NULL,
    revenue numeric NOT NULL,
    expenses numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: fiscal_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_periods (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    fiscal_year integer NOT NULL,
    period_number integer NOT NULL,
    period_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    closed_at timestamp with time zone,
    closed_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    period_name text,
    allow_posting boolean DEFAULT true,
    allow_adjustments boolean DEFAULT false,
    locked_at timestamp with time zone,
    locked_by text,
    CONSTRAINT fiscal_periods_period_type_check CHECK ((period_type = ANY (ARRAY['month'::text, 'quarter'::text, 'year'::text])))
);


--
-- Name: fixed_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixed_assets (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    asset_no text NOT NULL,
    name text NOT NULL,
    category text,
    acquisition_date date NOT NULL,
    cost numeric NOT NULL,
    salvage_value numeric DEFAULT 0 NOT NULL,
    useful_life_months integer NOT NULL,
    method text DEFAULT 'straight_line'::text NOT NULL,
    depreciation_start_date date NOT NULL,
    accumulated_depreciation numeric DEFAULT 0 NOT NULL,
    net_book_value numeric NOT NULL,
    asset_account_code text DEFAULT '1600'::text NOT NULL,
    dep_expense_account_code text DEFAULT '6400'::text NOT NULL,
    accum_dep_account_code text DEFAULT '1700'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    disposal_date date,
    disposal_method text,
    disposal_proceeds numeric,
    disposal_journal_entry_id text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    location text,
    custodian text,
    finance_book text DEFAULT 'main'::text NOT NULL
);


--
-- Name: fx_revaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fx_revaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    currency text NOT NULL,
    direction text NOT NULL,
    as_of date NOT NULL,
    closing_rate numeric NOT NULL,
    delta numeric NOT NULL,
    journal_entry_id text,
    reversed_journal_entry_id text,
    status text DEFAULT 'posted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gate_test_scratch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_test_scratch (
    id text NOT NULL,
    tenant_slug text,
    note text
);


--
-- Name: hr_advance_repayments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_advance_repayments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    advance_id uuid NOT NULL,
    amount numeric NOT NULL,
    method text DEFAULT 'payroll'::text NOT NULL,
    journal_entry_id uuid,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_advance_repayments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: hr_employee_advances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_advances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    advance_number text NOT NULL,
    employee_id text NOT NULL,
    employee_name text,
    amount numeric NOT NULL,
    purpose text,
    status text DEFAULT 'requested'::text NOT NULL,
    approved_by text,
    disbursed_at timestamp with time zone,
    disburse_journal_id uuid,
    repaid_amount numeric DEFAULT 0 NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_employee_advances_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT hr_employee_advances_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'approved'::text, 'disbursed'::text, 'partially_repaid'::text, 'repaid'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: hr_employee_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_checkins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    log_type text NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    device_id text,
    shift_id uuid,
    skip_auto_attendance boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_employee_checkins_log_type_check CHECK ((log_type = ANY (ARRAY['in'::text, 'out'::text])))
);


--
-- Name: hr_employee_lifecycle; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employee_lifecycle (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    kind text NOT NULL,
    employee_id text NOT NULL,
    employee_name text,
    status text DEFAULT 'in_progress'::text NOT NULL,
    designation text,
    department_id text,
    start_date date,
    separation_date date,
    reason text,
    checklist jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_employee_lifecycle_kind_check CHECK ((kind = ANY (ARRAY['onboarding'::text, 'separation'::text]))),
    CONSTRAINT hr_employee_lifecycle_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: hr_leave_accrual_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_leave_accrual_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    leave_type text NOT NULL,
    period text NOT NULL,
    days_accrued numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_leave_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_leave_allocations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    leave_type text NOT NULL,
    year integer NOT NULL,
    allocated_days numeric DEFAULT 0 NOT NULL,
    carried_over_days numeric DEFAULT 0 NOT NULL,
    expires_at date,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_leave_allocations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_jobs (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    entity text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    imported integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    errors jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: imprest_funds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imprest_funds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    custodian text,
    float_amount numeric DEFAULT 0 NOT NULL,
    petty_cash_account_code text DEFAULT '1040'::text NOT NULL,
    bank_account_code text DEFAULT '1110'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imprest_funds_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text])))
);


--
-- Name: imprest_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imprest_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    fund_id uuid NOT NULL,
    txn_type text NOT NULL,
    txn_date date NOT NULL,
    amount numeric NOT NULL,
    expense_account_code text,
    description text,
    journal_entry_id uuid,
    status text DEFAULT 'posted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imprest_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT imprest_transactions_status_check CHECK ((status = ANY (ARRAY['posted'::text, 'reversed'::text]))),
    CONSTRAINT imprest_transactions_txn_type_check CHECK ((txn_type = ANY (ARRAY['replenishment'::text, 'disbursement'::text, 'adjustment'::text])))
);


--
-- Name: installation_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.installation_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    note_number text NOT NULL,
    customer_id text,
    customer_name text NOT NULL,
    invoice_id text,
    sales_order_id text,
    installation_date date DEFAULT CURRENT_DATE NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    remarks text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT installation_notes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'cancelled'::text])))
);


--
-- Name: inventory_item_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_attributes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    "values" text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: inventory_item_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    is_group boolean DEFAULT false NOT NULL
);


--
-- Name: inventory_item_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    template_product_id text NOT NULL,
    variant_sku text NOT NULL,
    attributes jsonb DEFAULT '{}'::jsonb NOT NULL,
    sale_price numeric,
    unit_cost numeric,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_lot_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_lot_stock (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    sku text NOT NULL,
    lot_no text NOT NULL,
    warehouse_id text NOT NULL,
    qty_on_hand numeric(14,4) DEFAULT 0 NOT NULL,
    expiry_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_product_bundle_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_product_bundle_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bundle_id uuid NOT NULL,
    product_sku text NOT NULL,
    quantity numeric NOT NULL,
    CONSTRAINT inventory_product_bundle_items_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: inventory_product_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_product_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    bundle_sku text NOT NULL,
    name text NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_products (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    sku text NOT NULL,
    category text NOT NULL,
    current_stock integer DEFAULT 0 NOT NULL,
    min_stock integer DEFAULT 0 NOT NULL,
    unit_cost numeric DEFAULT 0,
    sale_price numeric DEFAULT 0,
    supplier text,
    description text,
    location text,
    created_at timestamp with time zone DEFAULT now(),
    tracking text DEFAULT 'none'::text NOT NULL,
    metadata jsonb,
    allow_negative_stock boolean DEFAULT false NOT NULL,
    stock_uom text DEFAULT 'Unit'::text,
    item_group_id uuid
);


--
-- Name: inventory_quality_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_quality_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    inspection_number text NOT NULL,
    reference_type text DEFAULT 'purchase_receipt'::text NOT NULL,
    reference_id text,
    product_sku text NOT NULL,
    warehouse_id text,
    inspected_quantity numeric NOT NULL,
    accepted_quantity numeric DEFAULT 0 NOT NULL,
    rejected_quantity numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    inspector text,
    readings jsonb,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_quality_inspections_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'partial'::text])))
);


--
-- Name: inventory_reorder_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_reorder_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    product_sku text NOT NULL,
    warehouse_id text DEFAULT 'main'::text NOT NULL,
    reorder_level numeric NOT NULL,
    reorder_quantity numeric NOT NULL,
    request_type text DEFAULT 'purchase'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    last_triggered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_reorder_rules_request_type_check CHECK ((request_type = ANY (ARRAY['purchase'::text, 'manufacture'::text, 'transfer'::text])))
);


--
-- Name: inventory_serials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_serials (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    sku text NOT NULL,
    serial_no text NOT NULL,
    warehouse_id text,
    status text DEFAULT 'in_stock'::text NOT NULL,
    received_movement_id text,
    issued_movement_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    product_sku text NOT NULL,
    warehouse_id text NOT NULL,
    quantity numeric DEFAULT 0 NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_stock_layers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_layers (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    product_sku text NOT NULL,
    warehouse_id text,
    received_qty numeric DEFAULT 0 NOT NULL,
    remaining_qty numeric DEFAULT 0 NOT NULL,
    unit_cost numeric DEFAULT 0 NOT NULL,
    reference_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inventory_stock_reconciliation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_reconciliation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reconciliation_id uuid NOT NULL,
    product_sku text NOT NULL,
    book_quantity numeric DEFAULT 0 NOT NULL,
    counted_quantity numeric,
    variance numeric,
    valuation_rate numeric DEFAULT 0 NOT NULL,
    variance_value numeric
);


--
-- Name: inventory_stock_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_reconciliations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    rec_number text NOT NULL,
    warehouse_id text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    count_date date DEFAULT CURRENT_DATE NOT NULL,
    remarks text,
    journal_entry_id uuid,
    submitted_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_stock_reconciliations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'cancelled'::text])))
);


--
-- Name: inventory_stock_reservations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_reservations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    product_sku text NOT NULL,
    warehouse_id text DEFAULT 'main'::text NOT NULL,
    quantity numeric NOT NULL,
    sales_order_id text,
    status text DEFAULT 'active'::text NOT NULL,
    reserved_by text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_stock_reservations_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT inventory_stock_reservations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'released'::text, 'consumed'::text])))
);


--
-- Name: inventory_stock_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_transfers (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    product_id text NOT NULL,
    quantity integer NOT NULL,
    from_location text NOT NULL,
    to_location text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    from_warehouse_id text,
    to_warehouse_id text,
    serial_nos jsonb,
    lot_no text,
    CONSTRAINT inventory_stock_transfers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: inventory_uom_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_uom_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL
);


--
-- Name: inventory_uom_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_uom_conversions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    from_uom text NOT NULL,
    to_uom text NOT NULL,
    factor numeric NOT NULL,
    CONSTRAINT inventory_uom_conversions_factor_check CHECK ((factor > (0)::numeric))
);


--
-- Name: inventory_uoms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_uoms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    category_id uuid,
    must_be_whole boolean DEFAULT false NOT NULL
);


--
-- Name: inventory_warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_warehouses (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    code text,
    name text NOT NULL,
    parent_warehouse_id text,
    branch_id text,
    type text DEFAULT 'warehouse'::text NOT NULL,
    is_group boolean DEFAULT false NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer NOT NULL,
    email text NOT NULL,
    invited_by uuid,
    invited_at timestamp with time zone DEFAULT now() NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone,
    accepted boolean DEFAULT false NOT NULL
);


--
-- Name: invoice_discountings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_discountings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    invoice_id text NOT NULL,
    bank text NOT NULL,
    loan_amount numeric NOT NULL,
    disbursement_date date NOT NULL,
    period_days integer DEFAULT 90 NOT NULL,
    status text DEFAULT 'sanctioned'::text NOT NULL,
    journal_entry_id text,
    settled_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoice_discountings_status_check CHECK ((status = ANY (ARRAY['sanctioned'::text, 'pending_approval'::text, 'settled'::text, 'closed'::text, 'rejected'::text])))
);


--
-- Name: invoice_payment_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_payment_schedule (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    invoice_id text NOT NULL,
    due_date date NOT NULL,
    amount numeric NOT NULL,
    paid_amount numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: it_field_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.it_field_jobs (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    ticket_id text,
    engineer_id text,
    engineer_name text,
    title text,
    site_address text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    arrived_at timestamp with time zone,
    completed_at timestamp with time zone,
    work_log text,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    customer_signoff boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: item_party_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_party_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    product_sku text NOT NULL,
    party_type text NOT NULL,
    party_id text,
    party_code text NOT NULL,
    party_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT item_party_codes_party_type_check CHECK ((party_type = ANY (ARRAY['customer'::text, 'manufacturer'::text, 'supplier'::text])))
);


--
-- Name: item_tax_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.item_tax_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    item text NOT NULL,
    tax_template_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    reference text,
    description text,
    posted_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    source text,
    metadata jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    journal_number text,
    journal_type text,
    fiscal_period_id uuid,
    posting_date date,
    total_debit numeric(18,2) DEFAULT 0 NOT NULL,
    total_credit numeric(18,2) DEFAULT 0 NOT NULL,
    notes text,
    approval_status text,
    approved_by text,
    approved_at timestamp with time zone,
    reversed_entry_id uuid,
    is_reversing boolean DEFAULT false,
    attachment_url text,
    tenant_slug text,
    entry_number text,
    entry_date date,
    reference_type text,
    reference_id text,
    finance_book text DEFAULT 'main'::text NOT NULL
);


--
-- Name: journal_entry_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id uuid NOT NULL,
    account_code text NOT NULL,
    account_name text,
    debit_amount numeric(18,2) DEFAULT 0 NOT NULL,
    credit_amount numeric(18,2) DEFAULT 0 NOT NULL,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    journal_entry_id uuid,
    line_number integer,
    account_id uuid,
    branch_id text,
    department_id text,
    project_id text,
    cost_center_id text,
    is_reconciled boolean DEFAULT false,
    reconciled_at timestamp with time zone,
    debit numeric(18,2) DEFAULT 0,
    credit numeric(18,2) DEFAULT 0,
    party_type text,
    party_id text,
    dimensions jsonb
);


--
-- Name: journal_entry_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_entry_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    journal_type text DEFAULT 'MANUAL'::text NOT NULL,
    lines jsonb DEFAULT '[]'::jsonb NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: journal_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    journal_entry_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    account_id uuid,
    amount numeric NOT NULL,
    side text NOT NULL,
    description text
);


--
-- Name: journal_sequences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.journal_sequences (
    tenant_slug text NOT NULL,
    prefix text NOT NULL,
    fiscal_year integer NOT NULL,
    last_number integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_base_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_base_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    title text NOT NULL,
    category text,
    audience text NOT NULL,
    summary text,
    content text NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    related_ticket_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    solution_steps jsonb,
    attachments jsonb,
    effectiveness_score numeric(5,2) DEFAULT 0 NOT NULL,
    publish_status text DEFAULT 'draft'::text NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_base_articles_audience_check CHECK ((audience = ANY (ARRAY['internal'::text, 'customer'::text, 'field'::text]))),
    CONSTRAINT knowledge_base_articles_publish_status_check CHECK ((publish_status = ANY (ARRAY['draft'::text, 'published'::text, 'retired'::text])))
);


--
-- Name: landed_cost_charges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landed_cost_charges (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    voucher_id text NOT NULL,
    charge_type text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    account_code text,
    vendor_name text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: landed_cost_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landed_cost_vouchers (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    reference_id text NOT NULL,
    charge_type text NOT NULL,
    total_amount numeric NOT NULL,
    allocation_method text DEFAULT 'value'::text NOT NULL,
    allocations jsonb,
    expense_account_code text,
    journal_entry_id text,
    status text DEFAULT 'posted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT landed_cost_vouchers_allocation_method_check CHECK ((allocation_method = ANY (ARRAY['value'::text, 'quantity'::text, 'manual'::text]))),
    CONSTRAINT landed_cost_vouchers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'posted'::text, 'void'::text])))
);


--
-- Name: leave_encashments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_encashments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    leave_type text NOT NULL,
    encashment_date date DEFAULT CURRENT_DATE NOT NULL,
    encashable_days numeric NOT NULL,
    rate_per_day numeric DEFAULT 0 NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    payroll_run_id text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_encashments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'approved'::text, 'paid'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: license_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.license_tiers (
    id integer NOT NULL,
    key character varying(50) NOT NULL,
    label character varying(100) NOT NULL,
    description text,
    min_seats integer DEFAULT 1 NOT NULL,
    max_seats integer DEFAULT 100000 NOT NULL,
    default_seats integer DEFAULT 1 NOT NULL,
    price_per_seat numeric(10,2) DEFAULT 0 NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: license_tiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.license_tiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: license_tiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.license_tiers_id_seq OWNED BY public.license_tiers.id;


--
-- Name: licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.licenses (
    id integer NOT NULL,
    tenant_id integer,
    license_key character varying(255),
    status character varying(50),
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    type character varying(50),
    seats integer,
    expiry date,
    updated_at timestamp without time zone
);


--
-- Name: licenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.licenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: licenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.licenses_id_seq OWNED BY public.licenses.id;


--
-- Name: loyalty_point_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_point_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    program_id uuid NOT NULL,
    customer_code text NOT NULL,
    invoice_id text,
    type text NOT NULL,
    points numeric NOT NULL,
    discount_amount numeric,
    expiry_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_point_entries_type_check CHECK ((type = ANY (ARRAY['earn'::text, 'redeem'::text])))
);


--
-- Name: loyalty_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    earn_rate numeric NOT NULL,
    redeem_value numeric NOT NULL,
    min_points_to_redeem integer DEFAULT 0 NOT NULL,
    max_redeem_pct numeric DEFAULT 100 NOT NULL,
    expense_account_code text DEFAULT '6100'::text NOT NULL,
    expiry_days integer,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: maintenance_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    asset_id uuid,
    asset_name text NOT NULL,
    item_name text,
    frequency text DEFAULT 'monthly'::text NOT NULL,
    next_due date NOT NULL,
    last_completed date,
    assigned_to text,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: maintenance_visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    schedule_id uuid NOT NULL,
    scheduled_date date NOT NULL,
    completed_date date,
    status text DEFAULT 'scheduled'::text NOT NULL,
    engineer text,
    work_done text,
    ticket_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: manufacturing_job_card_time_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_job_card_time_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_card_id uuid NOT NULL,
    employee_id text,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    minutes numeric,
    completed_quantity numeric DEFAULT 0 NOT NULL,
    notes text
);


--
-- Name: manufacturing_job_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_job_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    job_card_number text NOT NULL,
    work_order_id text NOT NULL,
    operation_id text,
    operation_name text NOT NULL,
    workstation_id uuid,
    employee_id text,
    status text DEFAULT 'open'::text NOT NULL,
    planned_quantity numeric DEFAULT 0 NOT NULL,
    completed_quantity numeric DEFAULT 0 NOT NULL,
    rejected_quantity numeric DEFAULT 0 NOT NULL,
    planned_minutes numeric DEFAULT 0 NOT NULL,
    actual_minutes numeric DEFAULT 0 NOT NULL,
    labor_cost numeric DEFAULT 0 NOT NULL,
    overhead_cost numeric DEFAULT 0 NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT manufacturing_job_cards_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'paused'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: manufacturing_production_plan_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_production_plan_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid NOT NULL,
    product_sku text NOT NULL,
    product_name text,
    demanded_quantity numeric DEFAULT 0 NOT NULL,
    sales_order_quantity numeric DEFAULT 0 NOT NULL,
    forecast_quantity numeric DEFAULT 0 NOT NULL,
    on_hand_quantity numeric DEFAULT 0 NOT NULL,
    wip_quantity numeric DEFAULT 0 NOT NULL,
    planned_quantity numeric DEFAULT 0 NOT NULL,
    bom_id text,
    work_order_id text,
    material_request_id uuid
);


--
-- Name: manufacturing_production_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_production_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    plan_number text NOT NULL,
    plan_name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    period_start date,
    period_end date,
    include_sales_orders boolean DEFAULT true NOT NULL,
    include_forecasts boolean DEFAULT true NOT NULL,
    generated_work_orders integer DEFAULT 0 NOT NULL,
    generated_material_requests integer DEFAULT 0 NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT manufacturing_production_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: manufacturing_routing_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_routing_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    routing_id uuid NOT NULL,
    sequence integer NOT NULL,
    name text NOT NULL,
    workstation_id uuid,
    standard_minutes numeric DEFAULT 0 NOT NULL
);


--
-- Name: manufacturing_routings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_routings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: manufacturing_sales_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_sales_forecasts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    product_sku text NOT NULL,
    forecast_date date NOT NULL,
    forecast_quantity numeric NOT NULL,
    consumed_quantity numeric DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: manufacturing_workstations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manufacturing_workstations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    workstation_type text,
    labor_rate numeric DEFAULT 0 NOT NULL,
    overhead_rate numeric DEFAULT 0 NOT NULL,
    electricity_rate numeric DEFAULT 0 NOT NULL,
    rent_rate numeric DEFAULT 0 NOT NULL,
    capacity_hours_per_day numeric DEFAULT 8 NOT NULL,
    working_hours jsonb,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: master_production_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_production_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    period_from date NOT NULL,
    period_to date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT master_production_schedules_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'closed'::text])))
);


--
-- Name: material_request_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_request_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    material_request_id uuid NOT NULL,
    product_id text NOT NULL,
    product_name text,
    description text,
    quantity numeric NOT NULL,
    ordered_quantity numeric DEFAULT 0 NOT NULL,
    uom text,
    warehouse_id text
);


--
-- Name: material_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.material_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    mr_number text NOT NULL,
    request_type text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    requested_by text,
    required_by date,
    notes text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT material_requests_request_type_check CHECK ((request_type = ANY (ARRAY['purchase'::text, 'manufacture'::text, 'transfer'::text]))),
    CONSTRAINT material_requests_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'partially_ordered'::text, 'ordered'::text, 'cancelled'::text])))
);


--
-- Name: mfg_sub_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mfg_sub_operations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    work_order_id text NOT NULL,
    operation_id text NOT NULL,
    name text NOT NULL,
    workstation_id uuid,
    planned_minutes integer,
    actual_minutes integer,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mode_of_payment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mode_of_payment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'cash'::text NOT NULL,
    account_code text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: monthly_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_distributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    percentages jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mps_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mps_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    mps_id uuid NOT NULL,
    product_sku text NOT NULL,
    forecast_qty numeric DEFAULT 0 NOT NULL,
    order_qty numeric DEFAULT 0 NOT NULL,
    on_hand numeric DEFAULT 0 NOT NULL,
    planned_qty numeric DEFAULT 0 NOT NULL
);


--
-- Name: notification_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    dedupe_key text NOT NULL,
    channel text DEFAULT 'email'::text NOT NULL,
    event_type text NOT NULL,
    recipient text NOT NULL,
    recipient_name text,
    subject text,
    body_html text,
    body_text text,
    link text,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    event_type text NOT NULL,
    channels jsonb DEFAULT '["email"]'::jsonb NOT NULL,
    recipients jsonb DEFAULT '[]'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    subject_override text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    event_type text NOT NULL,
    subject_template text,
    body_template text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: org_admin_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.org_admin_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    node_id text NOT NULL,
    user_email text NOT NULL,
    display_name text,
    role text,
    scope text NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: overtime_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    work_date date NOT NULL,
    hours numeric NOT NULL,
    rate_multiplier numeric DEFAULT 1.5 NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    approved_by text,
    payroll_run_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT overtime_entries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'paid'::text])))
);


--
-- Name: packing_slips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packing_slips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    slip_number text NOT NULL,
    sales_order_id text,
    delivery_reference text,
    from_case_no integer DEFAULT 1 NOT NULL,
    to_case_no integer,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    gross_weight numeric,
    net_weight numeric,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: party_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    primary_type text NOT NULL,
    primary_id text NOT NULL,
    secondary_type text NOT NULL,
    secondary_id text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: party_tax_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_tax_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    party_type text NOT NULL,
    party_id text NOT NULL,
    tax_category text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    payment_id text NOT NULL,
    invoice_id text NOT NULL,
    amount numeric(18,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_gateway_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_gateway_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    provider text NOT NULL,
    public_key text,
    secret_key text NOT NULL,
    webhook_secret text,
    mode text DEFAULT 'test'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    provider text NOT NULL,
    reference text NOT NULL,
    amount numeric(18,2) NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    invoice_id uuid,
    payment_request_id uuid,
    customer_email text,
    checkout_url text,
    gateway_response jsonb,
    payment_entry_id uuid,
    paid_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    payment_date date,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    invoice_id text NOT NULL,
    provider text NOT NULL,
    reference text NOT NULL,
    amount numeric NOT NULL,
    currency text,
    status text DEFAULT 'pending'::text NOT NULL,
    link_url text,
    provider_reference text,
    paid_payment_id text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_requests_provider_check CHECK ((provider = ANY (ARRAY['paystack'::text, 'flutterwave'::text, 'stripe'::text, 'manual'::text]))),
    CONSTRAINT payment_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'expired'::text])))
);


--
-- Name: payment_term_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_term_lines (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    term_id text NOT NULL,
    sequence integer DEFAULT 0 NOT NULL,
    percent numeric DEFAULT 0 NOT NULL,
    days integer DEFAULT 0 NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: payment_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    terms jsonb NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pegged_currencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pegged_currencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    currency text NOT NULL,
    pegged_to text NOT NULL,
    rate numeric NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT pegged_currencies_check CHECK ((currency <> pegged_to))
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    module text,
    action text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plant_floors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plant_floors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    code text,
    warehouse_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: portal_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_tokens (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    party_type text NOT NULL,
    party_id text,
    party_name text NOT NULL,
    email text,
    token text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    expires_at timestamp with time zone,
    last_accessed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT portal_tokens_party_type_check CHECK ((party_type = ANY (ARRAY['customer'::text, 'vendor'::text]))),
    CONSTRAINT portal_tokens_status_check CHECK ((status = ANY (ARRAY['active'::text, 'revoked'::text])))
);


--
-- Name: pos_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_audit_log (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    actor text,
    action text NOT NULL,
    entity_type text,
    entity_id text,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pos_cash_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_cash_movements (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    shift_id text NOT NULL,
    register_id text,
    type text NOT NULL,
    amount numeric NOT NULL,
    reason text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pos_cash_movements_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT pos_cash_movements_type_check CHECK ((type = ANY (ARRAY['pay_in'::text, 'pay_out'::text, 'drop'::text])))
);


--
-- Name: pos_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_counters (
    tenant_slug text NOT NULL,
    counter_key text NOT NULL,
    next_seq bigint DEFAULT 1 NOT NULL
);


--
-- Name: pos_held_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_held_sales (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    register_id text,
    label text,
    cart jsonb NOT NULL,
    customer_code text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pos_loyalty_txns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_loyalty_txns (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    customer_code text NOT NULL,
    sale_id text,
    type text NOT NULL,
    points numeric NOT NULL,
    value numeric,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pos_loyalty_txns_type_check CHECK ((type = ANY (ARRAY['earn'::text, 'redeem'::text, 'adjust'::text])))
);


--
-- Name: pos_price_list_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_price_list_items (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    price_list_id text NOT NULL,
    sku text NOT NULL,
    price numeric NOT NULL,
    CONSTRAINT pos_price_list_items_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: pos_price_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_price_lists (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pos_promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_promotions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    percent numeric,
    amount numeric,
    buy_qty integer,
    get_qty integer,
    min_qty integer,
    bundle_price numeric,
    skus text[],
    active_from timestamp with time zone NOT NULL,
    active_to timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pos_promotions_type_check CHECK ((type = ANY (ARRAY['percent'::text, 'amount'::text, 'bogo'::text, 'bundle'::text])))
);


--
-- Name: pos_registers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_registers (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    warehouse_id text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    branch_id text
);


--
-- Name: pos_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_returns (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    sale_id text NOT NULL,
    invoice_id text,
    credit_note_id text,
    items jsonb NOT NULL,
    refund_method text DEFAULT 'cash'::text NOT NULL,
    refund_amount numeric NOT NULL,
    restocked boolean DEFAULT false NOT NULL,
    reason text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pos_sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_sales (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    invoice_id text,
    warehouse_id text,
    payment_method text DEFAULT 'cash'::text NOT NULL,
    customer_name text,
    items jsonb NOT NULL,
    net_amount numeric NOT NULL,
    tax_amount numeric DEFAULT 0 NOT NULL,
    total_amount numeric NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    shift_id text,
    receipt_no text,
    receipt_seq bigint,
    register_id text,
    status text DEFAULT 'completed'::text NOT NULL,
    tenders jsonb,
    amount_tendered numeric,
    change_due numeric,
    discount_amount numeric DEFAULT 0 NOT NULL,
    discount_reason text,
    rounding_amount numeric DEFAULT 0 NOT NULL,
    card_fees numeric DEFAULT 0 NOT NULL,
    customer_code text,
    idempotency_key text,
    error text,
    promotions text[],
    ereceipt_sent_at timestamp with time zone,
    ereceipt_to text,
    branch_id text,
    local_invoice_no text
);


--
-- Name: pos_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pos_shifts (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    opened_by text,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    opening_float numeric DEFAULT 0 NOT NULL,
    closed_by text,
    closed_at timestamp with time zone,
    closing_counted numeric,
    expected_cash numeric,
    variance numeric,
    notes text,
    register_id text,
    flagged boolean DEFAULT false NOT NULL,
    variance_reason text,
    CONSTRAINT pos_shifts_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: pricing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_plans (
    id integer NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    tagline text,
    price_label text,
    price_monthly numeric(12,2),
    price_annual numeric(12,2),
    currency text DEFAULT 'NGN'::text,
    period_label text DEFAULT '/month'::text,
    max_users integer,
    features jsonb DEFAULT '[]'::jsonb,
    cta_label text DEFAULT 'Get started'::text,
    cta_href text DEFAULT '/signup'::text,
    is_featured boolean DEFAULT false,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pricing_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pricing_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pricing_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pricing_plans_id_seq OWNED BY public.pricing_plans.id;


--
-- Name: pricing_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    item text,
    item_category text,
    party_type text,
    party_id text,
    min_qty numeric,
    valid_from date,
    valid_to date,
    mode text DEFAULT 'discount_pct'::text NOT NULL,
    value numeric NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pricing_rules_mode_check CHECK ((mode = ANY (ARRAY['price'::text, 'discount_pct'::text, 'margin'::text])))
);


--
-- Name: print_formats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.print_formats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    doc_type text NOT NULL,
    name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    header_html text,
    body_html text NOT NULL,
    footer_html text,
    css text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: process_run_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.process_run_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    process text NOT NULL,
    params jsonb,
    result jsonb,
    item_count integer,
    status text NOT NULL,
    error text,
    duration_ms integer,
    run_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT process_run_logs_status_check CHECK ((status = ANY (ARRAY['success'::text, 'partial'::text, 'failed'::text])))
);


--
-- Name: procurement_goods_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_goods_receipts (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    po_id text,
    receipt_number text,
    vendor_id text,
    items jsonb,
    total_amount numeric DEFAULT 0,
    status text DEFAULT 'received'::text,
    received_date timestamp with time zone DEFAULT now(),
    notes text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: procurement_requisitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_requisitions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    requisition_number text NOT NULL,
    items jsonb NOT NULL,
    total_amount numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    notes text,
    requested_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    approval_id text,
    CONSTRAINT procurement_requisitions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'converted'::text])))
);


--
-- Name: procurement_rfq_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_rfq_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rfq_id uuid NOT NULL,
    product_id text,
    sku text,
    description text NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    uom text,
    target_price numeric
);


--
-- Name: procurement_rfq_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_rfq_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rfq_id uuid NOT NULL,
    vendor_id uuid NOT NULL
);


--
-- Name: procurement_rfqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_rfqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    rfq_number text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    required_by date,
    metadata jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT procurement_rfqs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'closed'::text, 'cancelled'::text])))
);


--
-- Name: procurement_supplier_quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_supplier_quotation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    rfq_item_id uuid,
    product_id text,
    description text NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    uom text,
    unit_price numeric DEFAULT 0 NOT NULL,
    line_amount numeric DEFAULT 0 NOT NULL
);


--
-- Name: procurement_supplier_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement_supplier_quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    rfq_id uuid NOT NULL,
    vendor_id uuid NOT NULL,
    vendor_name text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    tax_total numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    valid_until date,
    notes text,
    purchase_order_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT procurement_supplier_quotations_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'awarded'::text, 'rejected'::text, 'withdrawn'::text])))
);


--
-- Name: production_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_runs (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    run_number text NOT NULL,
    product_sku text NOT NULL,
    product_name text NOT NULL,
    total_quantity numeric NOT NULL,
    batch_size numeric NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT production_runs_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: project_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    project_id text NOT NULL,
    update_date date DEFAULT CURRENT_DATE NOT NULL,
    summary text NOT NULL,
    status text,
    blockers text,
    percent_complete numeric,
    sent_to text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'PLANNING'::character varying NOT NULL,
    priority character varying(50) DEFAULT 'MEDIUM'::character varying,
    start_date date,
    planned_end_date date,
    actual_end_date date,
    budget_id uuid,
    total_budget_amount numeric(19,2),
    currency character varying(3) DEFAULT 'NGN'::character varying,
    scope_description text,
    deliverables text,
    project_manager_id uuid,
    sponsor_id uuid,
    department_id uuid,
    branch_id uuid,
    approval_status character varying(50) DEFAULT 'DRAFT'::character varying,
    approved_by uuid,
    approved_at timestamp without time zone,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    over_budget_alerted_at timestamp with time zone,
    customer_name text,
    customer_id text,
    billing_rate numeric,
    metadata jsonb,
    CONSTRAINT projects_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT projects_priority_check CHECK (((priority)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying, 'CRITICAL'::character varying])::text[]))),
    CONSTRAINT projects_status_check CHECK (((status)::text = ANY ((ARRAY['PLANNING'::character varying, 'INITIATED'::character varying, 'IN_PROGRESS'::character varying, 'ON_HOLD'::character varying, 'COMPLETED'::character varying, 'ARCHIVED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: promotional_schemes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotional_schemes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    rules jsonb DEFAULT '[]'::jsonb NOT NULL,
    valid_from date,
    valid_to date,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_items (
    id text NOT NULL,
    purchase_order_id text NOT NULL,
    sku text,
    description text NOT NULL,
    quantity numeric NOT NULL,
    unit_price numeric NOT NULL,
    amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    po_id text,
    product_id text,
    line_total numeric DEFAULT 0 NOT NULL,
    received_quantity numeric DEFAULT 0 NOT NULL,
    tax_rate numeric,
    account_code text
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    po_number text,
    supplier_id text,
    supplier_name text,
    order_date text,
    delivery_date text,
    items text,
    quantity numeric DEFAULT 0,
    total numeric DEFAULT 0,
    status text DEFAULT 'Pending'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    vendor_id text,
    order_number text,
    expected_delivery_date text,
    issued_date date,
    due_date date,
    total_amount numeric DEFAULT 0,
    balance_due numeric DEFAULT 0,
    currency text DEFAULT 'NGN'::text,
    branch_id text,
    metadata jsonb,
    created_by text,
    updated_at timestamp with time zone DEFAULT now(),
    material_request_id uuid,
    rfq_id uuid,
    supplier_quotation_id uuid
);


--
-- Name: purchase_receipt_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_receipt_items (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    receipt_id text NOT NULL,
    po_item_id text,
    product_id text,
    sku text,
    description text,
    ordered_qty numeric DEFAULT 0 NOT NULL,
    received_qty numeric DEFAULT 0 NOT NULL,
    rejected_qty numeric DEFAULT 0 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    landed_cost numeric DEFAULT 0 NOT NULL,
    uom text
);


--
-- Name: purchase_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_receipts (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    receipt_number text NOT NULL,
    purchase_order_id text,
    vendor_id text,
    vendor_name text,
    warehouse_id text,
    location text,
    received_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    total_amount numeric DEFAULT 0 NOT NULL,
    approval_id text,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT purchase_receipts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'received'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: putaway_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.putaway_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    product_sku text NOT NULL,
    warehouse_id uuid NOT NULL,
    bin text,
    capacity numeric DEFAULT 0 NOT NULL,
    priority integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quality_inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quality_inspections (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    work_order_id text NOT NULL,
    inspection_number text NOT NULL,
    inspector text NOT NULL,
    result text NOT NULL,
    defects_found integer DEFAULT 0 NOT NULL,
    units_inspected integer DEFAULT 0 NOT NULL,
    units_rejected integer DEFAULT 0 NOT NULL,
    defect_types text[] DEFAULT ARRAY[]::text[],
    notes text,
    inspected_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT quality_inspections_result_check CHECK ((result = ANY (ARRAY['pass'::text, 'fail'::text, 'conditional'::text])))
);


--
-- Name: reconciliation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reconciliation_items (
    id text NOT NULL,
    reconciliation_id text NOT NULL,
    transaction_type text NOT NULL,
    transaction_date date NOT NULL,
    description text NOT NULL,
    amount numeric NOT NULL,
    book_entry_id text,
    is_reconciled boolean DEFAULT false NOT NULL,
    reconciled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reconciliation_items_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['deposit'::text, 'withdrawal'::text, 'bank_charge'::text, 'interest'::text, 'transfer'::text])))
);


--
-- Name: recurring_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurring_invoices (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    customer_name text NOT NULL,
    customer_code text,
    frequency text NOT NULL,
    next_run_date date NOT NULL,
    end_date date,
    status text DEFAULT 'active'::text NOT NULL,
    template jsonb NOT NULL,
    last_invoice_id text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT recurring_invoices_frequency_check CHECK ((frequency = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text]))),
    CONSTRAINT recurring_invoices_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'completed'::text])))
);


--
-- Name: remote_day_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.remote_day_requests (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    employee_name text,
    work_date date NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT remote_day_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: report_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.report_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    tenant_slug text NOT NULL,
    requested_by text,
    status text DEFAULT 'queued'::text NOT NULL,
    filters jsonb,
    output_location text,
    error text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    output_data jsonb,
    CONSTRAINT report_jobs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text])))
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    report_type text NOT NULL,
    definition jsonb NOT NULL,
    filters jsonb,
    schedule text,
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: revops_campaign_costs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revops_campaign_costs (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    campaign_id text NOT NULL,
    subsidiary text,
    region text,
    branch text,
    cost_center text,
    description text,
    amount numeric DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    spend_date text,
    recorded_by text,
    approved_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: revops_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revops_campaigns (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    subsidiary text,
    region text,
    branch text,
    campaign_code text,
    name text NOT NULL,
    objective text,
    status text DEFAULT 'draft'::text,
    channel text,
    start_date text,
    end_date text,
    budget numeric DEFAULT 0,
    committed_spend numeric DEFAULT 0,
    actual_spend numeric DEFAULT 0,
    expected_pipeline numeric DEFAULT 0,
    pipeline_influenced numeric DEFAULT 0,
    revenue_attributed numeric DEFAULT 0,
    roi numeric DEFAULT 0,
    approval_status text,
    approved_by text,
    approved_at timestamp with time zone,
    target_segments jsonb DEFAULT '[]'::jsonb,
    attribution_model text DEFAULT 'linear'::text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb
);


--
-- Name: revops_enablement_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revops_enablement_assets (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    title text NOT NULL,
    asset_type text,
    audience text,
    version text,
    status text DEFAULT 'published'::text,
    tags jsonb DEFAULT '[]'::jsonb,
    summary text,
    storage_url text,
    owner text,
    subsidiary text,
    region text,
    usage_metrics jsonb DEFAULT '{}'::jsonb,
    created_by text,
    approved_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: revops_lead_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revops_lead_sources (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    channel text,
    campaign_id text,
    cost_center text,
    region text,
    branch text,
    subsidiary text,
    status text DEFAULT 'active'::text,
    metadata jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: revops_revenue_attributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revops_revenue_attributions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    campaign_id text,
    lead_source_id text,
    crm_opportunity_id text,
    crm_deal_id text,
    crm_value numeric DEFAULT 0,
    recognized_revenue numeric DEFAULT 0,
    allocation_weight numeric DEFAULT 0,
    model text,
    region text,
    branch text,
    channel text,
    subsidiary text,
    closed_date text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: revops_revenue_forecasts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revops_revenue_forecasts (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    period_start text,
    period_end text,
    region text,
    branch text,
    subsidiary text,
    forecast_low numeric DEFAULT 0,
    forecast_likely numeric DEFAULT 0,
    forecast_high numeric DEFAULT 0,
    confidence numeric DEFAULT 0,
    methodology text,
    assumptions jsonb DEFAULT '[]'::jsonb,
    risk_alerts jsonb DEFAULT '[]'::jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: revops_sales_performance_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revops_sales_performance_snapshots (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    period text,
    period_label text,
    win_rate numeric DEFAULT 0,
    revenue_achieved numeric DEFAULT 0,
    revenue_target numeric DEFAULT 0,
    deal_velocity_days numeric DEFAULT 0,
    avg_deal_size numeric DEFAULT 0,
    pipeline_coverage numeric DEFAULT 0,
    rep_productivity jsonb DEFAULT '[]'::jsonb,
    regional_performance jsonb DEFAULT '[]'::jsonb,
    funnel_leakage jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: revops_sales_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revops_sales_targets (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    period text,
    period_type text,
    region text,
    branch text,
    subsidiary text,
    owner_type text,
    owner_id text,
    owner_name text,
    target_amount numeric DEFAULT 0,
    achieved_amount numeric DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    created_by text,
    approved_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer NOT NULL,
    name text NOT NULL,
    description text,
    is_predefined boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sales_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    order_id text NOT NULL,
    line_no integer NOT NULL,
    sku text,
    product_name text,
    quantity numeric DEFAULT 0 NOT NULL,
    unit_price numeric DEFAULT 0 NOT NULL,
    line_total numeric DEFAULT 0 NOT NULL
);


--
-- Name: sales_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_orders (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    order_number text NOT NULL,
    customer_id text,
    customer_name text,
    order_date text,
    due_date text,
    items text,
    quantity numeric DEFAULT 0,
    total numeric DEFAULT 0,
    status text DEFAULT 'Pending'::text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    deal_id text,
    invoice_id text,
    metadata jsonb,
    quotation_id uuid,
    material_request_id uuid
);


--
-- Name: sales_partner_commissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_partner_commissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    partner_id uuid NOT NULL,
    invoice_id text NOT NULL,
    invoice_amount numeric NOT NULL,
    commission_rate numeric NOT NULL,
    commission_amount numeric NOT NULL,
    status text DEFAULT 'accrued'::text NOT NULL,
    accrual_journal_entry_id text,
    payout_journal_entry_id text,
    paid_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_partner_commissions_status_check CHECK ((status = ANY (ARRAY['accrued'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: sales_partners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_partners (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    partner_type text DEFAULT 'agent'::text NOT NULL,
    commission_rate numeric NOT NULL,
    email text,
    phone text,
    territory text,
    expense_account_code text DEFAULT '6500'::text NOT NULL,
    payable_account_code text DEFAULT '2350'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_partners_partner_type_check CHECK ((partner_type = ANY (ARRAY['agent'::text, 'reseller'::text, 'referrer'::text, 'distributor'::text])))
);


--
-- Name: sales_quotation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotation_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quotation_id uuid NOT NULL,
    product_id text,
    sku text,
    description text NOT NULL,
    quantity numeric DEFAULT 1 NOT NULL,
    uom text,
    unit_price numeric DEFAULT 0 NOT NULL,
    tax_rate numeric,
    line_amount numeric DEFAULT 0 NOT NULL,
    metadata jsonb
);


--
-- Name: sales_quotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales_quotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    quotation_number text NOT NULL,
    customer_id text,
    customer_name text NOT NULL,
    quotation_date date DEFAULT CURRENT_DATE NOT NULL,
    valid_until date,
    status text DEFAULT 'draft'::text NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    subtotal numeric DEFAULT 0 NOT NULL,
    tax_total numeric DEFAULT 0 NOT NULL,
    total numeric DEFAULT 0 NOT NULL,
    notes text,
    sales_order_id text,
    lost_reason text,
    metadata jsonb,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_quotations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text, 'expired'::text, 'converted'::text, 'lost'::text])))
);


--
-- Name: saved_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    report_key text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text,
    is_shared boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    filename text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: share_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    transfer_type text NOT NULL,
    share_type_id uuid NOT NULL,
    from_shareholder_id uuid,
    to_shareholder_id uuid,
    qty numeric NOT NULL,
    rate numeric NOT NULL,
    posting_date date NOT NULL,
    bank_account_code text DEFAULT '1100'::text NOT NULL,
    journal_entry_id text,
    status text DEFAULT 'posted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT share_transfers_status_check CHECK ((status = ANY (ARRAY['posted'::text, 'cancelled'::text]))),
    CONSTRAINT share_transfers_transfer_type_check CHECK ((transfer_type = ANY (ARRAY['issue'::text, 'purchase'::text, 'transfer'::text])))
);


--
-- Name: share_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.share_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    face_value numeric NOT NULL,
    premium numeric DEFAULT 0 NOT NULL,
    capital_account_code text DEFAULT '3210'::text NOT NULL,
    premium_account_code text DEFAULT '3220'::text NOT NULL
);


--
-- Name: shareholders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shareholders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    email text,
    address text,
    folio_no text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: shipping_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shipping_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    min_value numeric,
    max_value numeric,
    min_weight numeric,
    max_weight numeric,
    charge_type text DEFAULT 'flat'::text NOT NULL,
    charge_value numeric NOT NULL,
    account_code text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shipping_rules_charge_type_check CHECK ((charge_type = ANY (ARRAY['flat'::text, 'percent'::text])))
);


--
-- Name: sla_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sla_policies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    priority text NOT NULL,
    impact_level text NOT NULL,
    response_minutes integer NOT NULL,
    resolution_minutes integer NOT NULL,
    escalation_chain jsonb,
    auto_escalate boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    description text,
    metadata jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    service_days jsonb DEFAULT '["mon", "tue", "wed", "thu", "fri"]'::jsonb NOT NULL,
    business_start time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    business_end time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    pause_on_statuses text[] DEFAULT '{}'::text[] NOT NULL,
    fulfil_on_statuses text[] DEFAULT '{resolved,closed}'::text[] NOT NULL,
    CONSTRAINT sla_policies_impact_level_check CHECK ((impact_level = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT sla_policies_priority_check CHECK ((priority = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT sla_policies_resolution_minutes_check CHECK ((resolution_minutes > 0)),
    CONSTRAINT sla_policies_response_minutes_check CHECK ((response_minutes > 0))
);


--
-- Name: sms_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sms_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    to_number text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    provider text,
    provider_ref text,
    error text,
    related_type text,
    related_id text,
    sent_by text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sms_messages_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'delivered'::text])))
);


--
-- Name: staff_advance_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_advance_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    advance_id uuid NOT NULL,
    expense_id text,
    amount numeric NOT NULL,
    journal_entry_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_advance_applications_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: staff_advances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_advances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    advance_number text NOT NULL,
    employee_name text NOT NULL,
    employee_id text,
    fund_id uuid,
    amount numeric NOT NULL,
    purpose text,
    status text DEFAULT 'issued'::text NOT NULL,
    issue_date date NOT NULL,
    journal_entry_id uuid,
    applied_amount numeric DEFAULT 0 NOT NULL,
    refunded_amount numeric DEFAULT 0 NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_advances_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT staff_advances_status_check CHECK ((status = ANY (ARRAY['issued'::text, 'partially_settled'::text, 'settled'::text, 'refunded'::text])))
);


--
-- Name: staffing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staffing_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    department_id text,
    period_from date,
    period_to date,
    designations jsonb DEFAULT '[]'::jsonb NOT NULL,
    total_estimated_cost numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staffing_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'approved'::text, 'cancelled'::text])))
);


--
-- Name: statement_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statement_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    party_type text NOT NULL,
    as_of date NOT NULL,
    emailed integer DEFAULT 0 NOT NULL,
    failed integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    product_sku text NOT NULL,
    product_name text,
    movement_type text NOT NULL,
    quantity integer NOT NULL,
    unit_cost numeric DEFAULT 0 NOT NULL,
    reference_type text,
    reference_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    warehouse_id text,
    branch_id text,
    lot_no text,
    serial_nos jsonb,
    cogs_amount numeric
);


--
-- Name: storefront_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.storefront_orders (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    order_number text NOT NULL,
    customer_name text NOT NULL,
    customer_email text,
    customer_phone text,
    items jsonb NOT NULL,
    total numeric NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    sales_order_id text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT storefront_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'fulfilled'::text, 'cancelled'::text])))
);


--
-- Name: subcontract_material_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontract_material_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subcontract_material_id text NOT NULL,
    tenant_slug text NOT NULL,
    movement_type text NOT NULL,
    quantity numeric NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subcontract_material_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['issue'::text, 'consume'::text, 'return'::text]))),
    CONSTRAINT subcontract_material_movements_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: subcontract_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontract_materials (
    id text NOT NULL,
    subcontract_order_id text NOT NULL,
    tenant_slug text NOT NULL,
    component_sku text NOT NULL,
    component_name text,
    quantity numeric NOT NULL,
    unit_cost numeric DEFAULT 0 NOT NULL,
    issued_at timestamp with time zone,
    consumed_quantity numeric DEFAULT 0 NOT NULL,
    returned_quantity numeric DEFAULT 0 NOT NULL
);


--
-- Name: subcontract_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcontract_orders (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    order_number text NOT NULL,
    subcontractor text NOT NULL,
    product_sku text NOT NULL,
    product_name text NOT NULL,
    quantity numeric NOT NULL,
    fee_per_unit numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    expected_date date,
    received_qty numeric DEFAULT 0 NOT NULL,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT subcontract_orders_status_check CHECK ((status = ANY (ARRAY['open'::text, 'materials_issued'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: subscription_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    subscription_id uuid NOT NULL,
    invoice_id text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    item text NOT NULL,
    unit_price numeric NOT NULL,
    qty numeric DEFAULT 1 NOT NULL,
    "interval" text DEFAULT 'monthly'::text NOT NULL,
    revenue_account_code text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_plans_interval_check CHECK (("interval" = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'quarterly'::text, 'yearly'::text])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    customer_id text NOT NULL,
    plan_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    next_invoice_date date NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    party_account_code text,
    bank_account_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'cancelled'::text, 'ended'::text])))
);


--
-- Name: superadmins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.superadmins (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: superadmins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.superadmins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: superadmins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.superadmins_id_seq OWNED BY public.superadmins.id;


--
-- Name: support_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    source_system text NOT NULL,
    incident_type text,
    severity text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    detected_at timestamp with time zone NOT NULL,
    acknowledged_at timestamp with time zone,
    resolved_at timestamp with time zone,
    summary text,
    affected_services text[] DEFAULT '{}'::text[] NOT NULL,
    region text,
    branch_id uuid,
    linked_ticket_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_incidents_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT support_incidents_status_check CHECK ((status = ANY (ARRAY['open'::text, 'monitoring'::text, 'resolved'::text, 'closed'::text])))
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    ticket_number text NOT NULL,
    title text NOT NULL,
    description text,
    ticket_type text NOT NULL,
    source text NOT NULL,
    impact_level text NOT NULL,
    priority text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    department_id uuid,
    service_area text,
    region text,
    branch_id uuid,
    customer_id uuid,
    project_id uuid,
    sla_policy_id uuid,
    assigned_engineer_id uuid,
    backup_engineer_id uuid,
    escalation_level integer DEFAULT 0 NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    attachments jsonb,
    auto_assignment jsonb,
    response_due_at timestamp with time zone,
    resolution_due_at timestamp with time zone,
    response_breached_at timestamp with time zone,
    resolution_breached_at timestamp with time zone,
    first_response_at timestamp with time zone,
    acknowledged_at timestamp with time zone,
    diagnosing_at timestamp with time zone,
    in_progress_at timestamp with time zone,
    awaiting_customer_at timestamp with time zone,
    awaiting_dependency_at timestamp with time zone,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    reopened_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb,
    sla_paused boolean DEFAULT false NOT NULL,
    sla_paused_at timestamp with time zone,
    sla_paused_total_minutes integer DEFAULT 0 NOT NULL,
    sla_breached boolean DEFAULT false NOT NULL,
    sla_breach_type text,
    CONSTRAINT support_tickets_impact_level_check CHECK ((impact_level = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT support_tickets_priority_check CHECK ((priority = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text]))),
    CONSTRAINT support_tickets_source_check CHECK ((source = ANY (ARRAY['erp'::text, 'crm'::text, 'email'::text, 'api'::text, 'mobile'::text, 'monitoring'::text]))),
    CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['new'::text, 'acknowledged'::text, 'diagnosing'::text, 'in_progress'::text, 'awaiting_customer'::text, 'awaiting_dependency'::text, 'resolved'::text, 'closed'::text, 'reopened'::text]))),
    CONSTRAINT support_tickets_ticket_type_check CHECK ((ticket_type = ANY (ARRAY['internal'::text, 'customer'::text])))
);


--
-- Name: support_warranty_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_warranty_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    claim_number text NOT NULL,
    serial_no text,
    product_sku text,
    customer_id text,
    customer_name text,
    issue_date date DEFAULT CURRENT_DATE NOT NULL,
    warranty_expiry date,
    status text DEFAULT 'open'::text NOT NULL,
    complaint text NOT NULL,
    resolution text,
    ticket_id text,
    resolved_at timestamp with time zone,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_warranty_claims_status_check CHECK ((status = ANY (ARRAY['open'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'work_done'::text, 'closed'::text])))
);


--
-- Name: task_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    employee_id uuid NOT NULL,
    assigned_hours numeric(10,2),
    assigned_percentage numeric(5,2),
    assignment_start_date date NOT NULL,
    assignment_end_date date,
    status character varying(50) DEFAULT 'PROPOSED'::character varying NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    rejection_reason text,
    actual_hours_logged numeric(10,2) DEFAULT 0,
    is_on_track boolean,
    risk_level character varying(50),
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT task_assignments_risk_level_check CHECK (((risk_level)::text = ANY ((ARRAY['LOW'::character varying, 'MEDIUM'::character varying, 'HIGH'::character varying])::text[]))),
    CONSTRAINT task_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['PROPOSED'::character varying, 'ACCEPTED'::character varying, 'REJECTED'::character varying, 'REASSIGNED'::character varying, 'COMPLETED'::character varying])::text[])))
);


--
-- Name: task_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workstream_id uuid NOT NULL,
    project_id uuid NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    planned_start_date date,
    planned_end_date date,
    actual_start_date date,
    actual_end_date date,
    duration_days integer,
    estimated_hours numeric(10,2),
    estimated_cost numeric(19,2),
    actual_hours_spent numeric(10,2) DEFAULT 0,
    actual_cost numeric(19,2) DEFAULT 0,
    status character varying(50) DEFAULT 'NOT_STARTED'::character varying NOT NULL,
    priority integer DEFAULT 100,
    percent_complete integer DEFAULT 0,
    depends_on_task_id uuid,
    is_blockedby_active_risk boolean DEFAULT false,
    is_assigned boolean DEFAULT false,
    assignment_deadline date,
    required_skills text[],
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tasks_percent_complete_check CHECK (((percent_complete >= 0) AND (percent_complete <= 100))),
    CONSTRAINT tasks_status_check CHECK (((status)::text = ANY ((ARRAY['NOT_STARTED'::character varying, 'IN_PROGRESS'::character varying, 'BLOCKED'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: tax_pack_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_pack_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    pack_code text NOT NULL,
    applied_by text,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_rates (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    tax_type text NOT NULL,
    name text NOT NULL,
    rate numeric NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tax_rates_tax_type_check CHECK ((tax_type = ANY (ARRAY['vat'::text, 'wht'::text, 'paye'::text, 'company_tax'::text, 'custom'::text])))
);


--
-- Name: tax_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_returns (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    tax_type text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_tax_collected numeric DEFAULT 0 NOT NULL,
    total_tax_paid numeric DEFAULT 0 NOT NULL,
    total_tax_withheld numeric DEFAULT 0 NOT NULL,
    net_tax_payable numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    filed_date date,
    paid_date date,
    reference text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tax_returns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'filed'::text, 'paid'::text, 'overdue'::text])))
);


--
-- Name: tax_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    direction text DEFAULT 'sales'::text NOT NULL,
    tax_category text,
    party_type text,
    party_id text,
    item text,
    min_amount numeric,
    max_amount numeric,
    valid_from date,
    valid_to date,
    tax_template_id uuid,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tax_rules_direction_check CHECK ((direction = ANY (ARRAY['sales'::text, 'purchase'::text])))
);


--
-- Name: tax_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    direction text DEFAULT 'sales'::text NOT NULL,
    lines jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tax_templates_direction_check CHECK ((direction = ANY (ARRAY['sales'::text, 'purchase'::text, 'both'::text])))
);


--
-- Name: tax_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_transactions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    tax_return_id text,
    transaction_type text NOT NULL,
    source_type text NOT NULL,
    source_id text,
    transaction_date date NOT NULL,
    description text NOT NULL,
    base_amount numeric NOT NULL,
    tax_rate numeric NOT NULL,
    tax_amount numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tax_transactions_source_type_check CHECK ((source_type = ANY (ARRAY['invoice'::text, 'bill'::text, 'payment'::text, 'manual'::text]))),
    CONSTRAINT tax_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['sales'::text, 'purchase'::text, 'wht_deducted'::text, 'wht_received'::text, 'vat_output'::text, 'vat_input'::text])))
);


--
-- Name: tax_withholding_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_withholding_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    rates jsonb NOT NULL,
    account_code text DEFAULT '2210'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tax_withholding_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_withholding_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    category_id uuid NOT NULL,
    party_type text NOT NULL,
    party_id text NOT NULL,
    document_type text NOT NULL,
    document_id text NOT NULL,
    fiscal_year integer NOT NULL,
    taxable_amount numeric NOT NULL,
    withheld_amount numeric NOT NULL,
    rate numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_access_restrictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_access_restrictions (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    restrictions text[] DEFAULT ARRAY[]::text[],
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenant_admin_password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_admin_password_reset_tokens (
    id integer NOT NULL,
    admin_id integer NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    used_at timestamp with time zone
);


--
-- Name: tenant_admin_password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_admin_password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_admin_password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_admin_password_reset_tokens_id_seq OWNED BY public.tenant_admin_password_reset_tokens.id;


--
-- Name: tenant_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_admins (
    id integer NOT NULL,
    tenant_id integer,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    password_hash character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    role character varying(50),
    updated_at timestamp without time zone,
    tenant_slug text
);


--
-- Name: tenant_admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenant_admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenant_admins_id_seq OWNED BY public.tenant_admins.id;


--
-- Name: tenant_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_branches (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    code text,
    name text NOT NULL,
    kind text DEFAULT 'branch'::text NOT NULL,
    parent_branch_id text,
    region text,
    country text,
    state text,
    city text,
    timezone text,
    currency text,
    status text DEFAULT 'active'::text NOT NULL,
    manager text,
    headcount integer DEFAULT 0 NOT NULL,
    org_node_id text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_onboarding_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_onboarding_state (
    tenant_slug text NOT NULL,
    steps jsonb DEFAULT '{}'::jsonb NOT NULL,
    current_step text,
    dismissed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_org_structures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_org_structures (
    slug text NOT NULL,
    tree jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenant_performance_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_performance_reviews (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    employee_id text NOT NULL,
    employee_name text,
    reviewer_id text,
    reviewer_name text,
    rating numeric(3,1) NOT NULL,
    comments text,
    review_date date,
    review_period text,
    status text DEFAULT 'in_progress'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cycle_id text,
    CONSTRAINT tenant_performance_reviews_status_check CHECK ((status = ANY (ARRAY['in_progress'::text, 'completed'::text])))
);


--
-- Name: tenant_security_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_security_settings (
    tenant_slug text NOT NULL,
    mfa_settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    security_metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_usage_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_usage_daily (
    tenant_slug text NOT NULL,
    usage_date date DEFAULT CURRENT_DATE NOT NULL,
    metric text NOT NULL,
    value bigint DEFAULT 0 NOT NULL
);


--
-- Name: tenant_user_branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_user_branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    user_id text NOT NULL,
    branch_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    seats integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    region text,
    industry text,
    status text DEFAULT 'Pending'::text,
    ledger_delta text DEFAULT '₦0'::text,
    admin_name text,
    admin_email text,
    admin_password_hash text,
    admin_notes text,
    default_region_id text,
    default_region_name text,
    default_branch_id text,
    default_branch_name text,
    settings jsonb DEFAULT '{}'::jsonb,
    "isActive" boolean DEFAULT false,
    industry_profiles jsonb DEFAULT '[]'::jsonb,
    code text,
    domain text,
    "schemaName" text,
    "createdAt" timestamp with time zone DEFAULT now(),
    "updatedAt" timestamp with time zone DEFAULT now(),
    "deletedAt" timestamp with time zone,
    consolidation_group text
);


--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: ticket_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    ticket_id uuid NOT NULL,
    activity_type text NOT NULL,
    actor_id uuid,
    details jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    ticket_id uuid NOT NULL,
    comment_type text NOT NULL,
    body text NOT NULL,
    attachments jsonb,
    author_id uuid,
    visibility text DEFAULT 'internal'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_comments_comment_type_check CHECK ((comment_type = ANY (ARRAY['internal'::text, 'customer'::text, 'system'::text])))
);


--
-- Name: time_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_assignment_id uuid NOT NULL,
    task_id uuid NOT NULL,
    project_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    log_date date NOT NULL,
    hours_logged numeric(10,2) NOT NULL,
    description text,
    activity_type character varying(100),
    billable boolean DEFAULT false,
    approval_status character varying(50) DEFAULT 'SUBMITTED'::character varying,
    approved_by uuid,
    approved_at timestamp without time zone,
    rejection_reason text,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    invoice_id text,
    CONSTRAINT time_logs_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: training_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    program_id uuid,
    event_name text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    venue text,
    trainer text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    attendees jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT training_events_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'ongoing'::text, 'completed'::text, 'cancelled'::text])))
);


--
-- Name: training_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    description text,
    supplier text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transaction_deletion_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction_deletion_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    document_type text NOT NULL,
    document_id text NOT NULL,
    document_data jsonb,
    reason text,
    deleted_by text,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notification_preferences (
    user_id text NOT NULL,
    tenant_slug text,
    preferences jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id integer NOT NULL,
    email text NOT NULL,
    name text,
    status text DEFAULT 'invited'::text NOT NULL,
    contract_type text DEFAULT 'full_time'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    primary_role_id uuid,
    CONSTRAINT users_contract_type_check CHECK ((contract_type = ANY (ARRAY['full_time'::text, 'part_time'::text, 'contractor'::text, 'intern'::text]))),
    CONSTRAINT users_status_check CHECK ((status = ANY (ARRAY['invited'::text, 'active'::text, 'suspended'::text, 'terminated'::text])))
);


--
-- Name: vendor_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_balances (
    vendor_id text NOT NULL,
    tenant_slug text,
    balance numeric(18,2) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendor_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_contacts (
    id text NOT NULL,
    vendor_id text NOT NULL,
    name text NOT NULL,
    role text,
    phone text,
    email text,
    address jsonb,
    is_primary boolean DEFAULT false,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendor_payment_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_payment_applications (
    id text NOT NULL,
    payment_id text NOT NULL,
    bill_id uuid NOT NULL,
    applied_amount numeric(18,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vendor_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendor_payments (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    payment_number text NOT NULL,
    vendor_id text NOT NULL,
    method text DEFAULT 'bank_transfer'::text NOT NULL,
    currency text DEFAULT 'NGN'::text NOT NULL,
    amount numeric(18,2) DEFAULT 0 NOT NULL,
    applied_amount numeric(18,2) DEFAULT 0 NOT NULL,
    unapplied_amount numeric(18,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    bank_details jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_id text
);


--
-- Name: vendors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vendors (
    id text NOT NULL,
    code text,
    name text,
    email text,
    phone text,
    address text,
    city text,
    state text,
    country text,
    tax_id text,
    account_number text,
    bank_code text,
    bank_name text,
    payment_terms text DEFAULT 'net30'::text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tenant_slug text,
    vendor_code text,
    legal_name text,
    display_name text,
    vendor_type text DEFAULT 'goods'::text,
    status text DEFAULT 'active'::text,
    default_currency text DEFAULT 'NGN'::text,
    default_payment_terms text,
    default_expense_account text,
    default_tax_rules jsonb,
    bank_details jsonb,
    metadata jsonb,
    created_by text,
    pending_bank_details jsonb,
    bank_details_changed_at timestamp with time zone,
    merged_into text
);


--
-- Name: web_form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    tenant_slug text NOT NULL,
    data jsonb NOT NULL,
    record_type text,
    record_id text,
    ip inet,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: web_forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.web_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    target_entity text NOT NULL,
    schema jsonb DEFAULT '[]'::jsonb NOT NULL,
    success_message text DEFAULT 'Submitted successfully'::text,
    is_active boolean DEFAULT true NOT NULL,
    notify_email text,
    submit_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subscription_id uuid NOT NULL,
    tenant_slug text NOT NULL,
    event text NOT NULL,
    doc_type text NOT NULL,
    doc_id text,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    response_code integer,
    last_error text,
    next_retry_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: webhook_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    name text NOT NULL,
    target_url text NOT NULL,
    secret text,
    doc_types text[] DEFAULT '{}'::text[] NOT NULL,
    events text[] DEFAULT '{create,update,submit}'::text[] NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    max_retries integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: work_order_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_materials (
    id text NOT NULL,
    work_order_id text NOT NULL,
    component_sku text NOT NULL,
    component_name text NOT NULL,
    required_quantity numeric NOT NULL,
    consumed_quantity numeric DEFAULT 0 NOT NULL,
    unit_cost numeric DEFAULT 0 NOT NULL,
    unit text DEFAULT 'pcs'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT work_order_materials_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'consumed'::text, 'short'::text])))
);


--
-- Name: work_order_operations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_order_operations (
    id text NOT NULL,
    work_order_id text NOT NULL,
    sequence integer NOT NULL,
    name text NOT NULL,
    work_center text,
    standard_minutes numeric DEFAULT 0 NOT NULL,
    actual_minutes numeric,
    labor_rate numeric DEFAULT 0 NOT NULL,
    overhead_rate numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    completed_at timestamp with time zone,
    completed_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    CONSTRAINT work_order_operations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'completed'::text])))
);


--
-- Name: work_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_orders (
    id text NOT NULL,
    tenant_slug text NOT NULL,
    order_number text NOT NULL,
    product_sku text NOT NULL,
    product_name text NOT NULL,
    bom_id text,
    quantity numeric NOT NULL,
    unit text DEFAULT 'pcs'::text NOT NULL,
    status text DEFAULT 'planned'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    scheduled_start date,
    scheduled_end date,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    material_cost numeric DEFAULT 0 NOT NULL,
    labor_cost numeric DEFAULT 0 NOT NULL,
    overhead_cost numeric DEFAULT 0 NOT NULL,
    total_cost numeric DEFAULT 0 NOT NULL,
    unit_cost numeric DEFAULT 0 NOT NULL,
    notes text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    production_run_id text,
    lot_no text,
    CONSTRAINT work_orders_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT work_orders_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'released'::text, 'in_progress'::text, 'completed'::text, 'closed'::text, 'cancelled'::text])))
);


--
-- Name: workflow_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_slug text NOT NULL,
    doc_type text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    status_field text DEFAULT 'status'::text NOT NULL,
    states jsonb DEFAULT '[]'::jsonb NOT NULL,
    transitions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workstreams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workstreams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    tenant_slug character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    planned_start_date date,
    planned_end_date date,
    actual_start_date date,
    actual_end_date date,
    allocated_budget numeric(19,2),
    spent_amount numeric(19,2) DEFAULT 0,
    status character varying(50) DEFAULT 'PLANNED'::character varying NOT NULL,
    priority integer DEFAULT 100,
    workstream_lead_id uuid,
    owner_department_id uuid,
    created_by character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workstreams_status_check CHECK (((status)::text = ANY ((ARRAY['PLANNED'::character varying, 'ACTIVE'::character varying, 'ON_HOLD'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: admin_password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.admin_password_reset_tokens_id_seq'::regclass);


--
-- Name: budget_actuals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_actuals ALTER COLUMN id SET DEFAULT nextval('public.budget_actuals_id_seq'::regclass);


--
-- Name: budget_approvals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_approvals ALTER COLUMN id SET DEFAULT nextval('public.budget_approvals_id_seq'::regclass);


--
-- Name: budget_forecasts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_forecasts ALTER COLUMN id SET DEFAULT nextval('public.budget_forecasts_id_seq'::regclass);


--
-- Name: budget_lines id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines ALTER COLUMN id SET DEFAULT nextval('public.budget_lines_id_seq'::regclass);


--
-- Name: budget_variances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_variances ALTER COLUMN id SET DEFAULT nextval('public.budget_variances_id_seq'::regclass);


--
-- Name: budget_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_versions ALTER COLUMN id SET DEFAULT nextval('public.budget_versions_id_seq'::regclass);


--
-- Name: budgets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets ALTER COLUMN id SET DEFAULT nextval('public.budgets_id_seq'::regclass);


--
-- Name: license_tiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_tiers ALTER COLUMN id SET DEFAULT nextval('public.license_tiers_id_seq'::regclass);


--
-- Name: licenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses ALTER COLUMN id SET DEFAULT nextval('public.licenses_id_seq'::regclass);


--
-- Name: pricing_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plans ALTER COLUMN id SET DEFAULT nextval('public.pricing_plans_id_seq'::regclass);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: superadmins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superadmins ALTER COLUMN id SET DEFAULT nextval('public.superadmins_id_seq'::regclass);


--
-- Name: tenant_admin_password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_admin_password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.tenant_admin_password_reset_tokens_id_seq'::regclass);


--
-- Name: tenant_admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_admins ALTER COLUMN id SET DEFAULT nextval('public.tenant_admins_id_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: account_balances account_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_balances
    ADD CONSTRAINT account_balances_pkey PRIMARY KEY (id);


--
-- Name: account_closing_balance account_closing_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_closing_balance
    ADD CONSTRAINT account_closing_balance_pkey PRIMARY KEY (id);


--
-- Name: account_closing_balance account_closing_balance_tenant_slug_fiscal_period_id_accoun_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_closing_balance
    ADD CONSTRAINT account_closing_balance_tenant_slug_fiscal_period_id_accoun_key UNIQUE (tenant_slug, fiscal_period_id, account_id, finance_book);


--
-- Name: accounting_audit_log accounting_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_audit_log
    ADD CONSTRAINT accounting_audit_log_pkey PRIMARY KEY (id);


--
-- Name: accounting_dimensions accounting_dimensions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_dimensions
    ADD CONSTRAINT accounting_dimensions_pkey PRIMARY KEY (id);


--
-- Name: accounting_dimensions accounting_dimensions_tenant_slug_dimension_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_dimensions
    ADD CONSTRAINT accounting_dimensions_tenant_slug_dimension_key_key UNIQUE (tenant_slug, dimension_key);


--
-- Name: activity_costs activity_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_costs
    ADD CONSTRAINT activity_costs_pkey PRIMARY KEY (id);


--
-- Name: activity_types activity_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_types
    ADD CONSTRAINT activity_types_pkey PRIMARY KEY (id);


--
-- Name: activity_types activity_types_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_types
    ADD CONSTRAINT activity_types_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: admin_access_controls admin_access_controls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_access_controls
    ADD CONSTRAINT admin_access_controls_pkey PRIMARY KEY (id);


--
-- Name: admin_announcements admin_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_announcements
    ADD CONSTRAINT admin_announcements_pkey PRIMARY KEY (id);


--
-- Name: admin_api_keys admin_api_keys_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_api_keys
    ADD CONSTRAINT admin_api_keys_key_key UNIQUE (key);


--
-- Name: admin_api_keys admin_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_api_keys
    ADD CONSTRAINT admin_api_keys_pkey PRIMARY KEY (id);


--
-- Name: admin_applications admin_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_applications
    ADD CONSTRAINT admin_applications_pkey PRIMARY KEY (id);


--
-- Name: admin_appraisal_config admin_appraisal_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_appraisal_config
    ADD CONSTRAINT admin_appraisal_config_pkey PRIMARY KEY (id);


--
-- Name: admin_appraisal_config admin_appraisal_config_tenant_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_appraisal_config
    ADD CONSTRAINT admin_appraisal_config_tenant_slug_key UNIQUE (tenant_slug);


--
-- Name: admin_approval_flows admin_approval_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_approval_flows
    ADD CONSTRAINT admin_approval_flows_pkey PRIMARY KEY (id);


--
-- Name: admin_approval_requests admin_approval_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_approval_requests
    ADD CONSTRAINT admin_approval_requests_pkey PRIMARY KEY (id);


--
-- Name: admin_approval_routes admin_approval_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_approval_routes
    ADD CONSTRAINT admin_approval_routes_pkey PRIMARY KEY (id);


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_candidates admin_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_candidates
    ADD CONSTRAINT admin_candidates_pkey PRIMARY KEY (id);


--
-- Name: admin_departments admin_departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_departments
    ADD CONSTRAINT admin_departments_pkey PRIMARY KEY (id);


--
-- Name: admin_employee_appraisals admin_employee_appraisals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_employee_appraisals
    ADD CONSTRAINT admin_employee_appraisals_pkey PRIMARY KEY (id);


--
-- Name: admin_employee_components admin_employee_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_employee_components
    ADD CONSTRAINT admin_employee_components_pkey PRIMARY KEY (id);


--
-- Name: admin_employee_expenses admin_employee_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_employee_expenses
    ADD CONSTRAINT admin_employee_expenses_pkey PRIMARY KEY (id);


--
-- Name: admin_employee_goals admin_employee_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_employee_goals
    ADD CONSTRAINT admin_employee_goals_pkey PRIMARY KEY (id);


--
-- Name: admin_employees admin_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_employees
    ADD CONSTRAINT admin_employees_pkey PRIMARY KEY (id);


--
-- Name: admin_holidays admin_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_holidays
    ADD CONSTRAINT admin_holidays_pkey PRIMARY KEY (id);


--
-- Name: admin_holidays admin_holidays_tenant_slug_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_holidays
    ADD CONSTRAINT admin_holidays_tenant_slug_holiday_date_key UNIQUE (tenant_slug, holiday_date);


--
-- Name: admin_integrations admin_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_integrations
    ADD CONSTRAINT admin_integrations_pkey PRIMARY KEY (id);


--
-- Name: admin_interviews admin_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_interviews
    ADD CONSTRAINT admin_interviews_pkey PRIMARY KEY (id);


--
-- Name: admin_job_requisitions admin_job_requisitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_job_requisitions
    ADD CONSTRAINT admin_job_requisitions_pkey PRIMARY KEY (id);


--
-- Name: admin_leave_balances admin_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_leave_balances
    ADD CONSTRAINT admin_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: admin_leave_balances admin_leave_balances_tenant_slug_employee_id_leave_type_yea_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_leave_balances
    ADD CONSTRAINT admin_leave_balances_tenant_slug_employee_id_leave_type_yea_key UNIQUE (tenant_slug, employee_id, leave_type, year);


--
-- Name: admin_leave admin_leave_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_leave
    ADD CONSTRAINT admin_leave_pkey PRIMARY KEY (id);


--
-- Name: admin_leave_policies admin_leave_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_leave_policies
    ADD CONSTRAINT admin_leave_policies_pkey PRIMARY KEY (id);


--
-- Name: admin_leave_requests admin_leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_leave_requests
    ADD CONSTRAINT admin_leave_requests_pkey PRIMARY KEY (id);


--
-- Name: admin_modules admin_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_modules
    ADD CONSTRAINT admin_modules_pkey PRIMARY KEY (id);


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_notifications
    ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);


--
-- Name: admin_offboarding admin_offboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_offboarding
    ADD CONSTRAINT admin_offboarding_pkey PRIMARY KEY (id);


--
-- Name: admin_offers admin_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_offers
    ADD CONSTRAINT admin_offers_pkey PRIMARY KEY (id);


--
-- Name: admin_onboarding_tasks admin_onboarding_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_onboarding_tasks
    ADD CONSTRAINT admin_onboarding_tasks_pkey PRIMARY KEY (id);


--
-- Name: admin_password_reset_tokens admin_password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_password_reset_tokens
    ADD CONSTRAINT admin_password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: admin_payroll_adjustments admin_payroll_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_payroll_adjustments
    ADD CONSTRAINT admin_payroll_adjustments_pkey PRIMARY KEY (id);


--
-- Name: admin_payroll_entries admin_payroll_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_payroll_entries
    ADD CONSTRAINT admin_payroll_entries_pkey PRIMARY KEY (id);


--
-- Name: admin_payroll_runs admin_payroll_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_payroll_runs
    ADD CONSTRAINT admin_payroll_runs_pkey PRIMARY KEY (id);


--
-- Name: admin_peer_feedback admin_peer_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_peer_feedback
    ADD CONSTRAINT admin_peer_feedback_pkey PRIMARY KEY (id);


--
-- Name: admin_requisition_screening_configs admin_requisition_screening_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_requisition_screening_configs
    ADD CONSTRAINT admin_requisition_screening_configs_pkey PRIMARY KEY (requisition_id);


--
-- Name: admin_review_cycles admin_review_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_review_cycles
    ADD CONSTRAINT admin_review_cycles_pkey PRIMARY KEY (id);


--
-- Name: admin_role_history admin_role_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_role_history
    ADD CONSTRAINT admin_role_history_pkey PRIMARY KEY (id);


--
-- Name: admin_roles admin_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_roles
    ADD CONSTRAINT admin_roles_pkey PRIMARY KEY (id);


--
-- Name: admin_screening_history admin_screening_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_screening_history
    ADD CONSTRAINT admin_screening_history_pkey PRIMARY KEY (id);


--
-- Name: admin_security_policies admin_security_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_security_policies
    ADD CONSTRAINT admin_security_policies_pkey PRIMARY KEY (id);


--
-- Name: admin_shift_assignments admin_shift_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_shift_assignments
    ADD CONSTRAINT admin_shift_assignments_pkey PRIMARY KEY (id);


--
-- Name: admin_shifts admin_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_shifts
    ADD CONSTRAINT admin_shifts_pkey PRIMARY KEY (id);


--
-- Name: admin_staff_report_templates admin_staff_report_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_staff_report_templates
    ADD CONSTRAINT admin_staff_report_templates_pkey PRIMARY KEY (id);


--
-- Name: admin_staff_reports admin_staff_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_staff_reports
    ADD CONSTRAINT admin_staff_reports_pkey PRIMARY KEY (id);


--
-- Name: admin_staff_tasks admin_staff_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_staff_tasks
    ADD CONSTRAINT admin_staff_tasks_pkey PRIMARY KEY (id);


--
-- Name: admin_statutory_profiles admin_statutory_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_statutory_profiles
    ADD CONSTRAINT admin_statutory_profiles_pkey PRIMARY KEY (id);


--
-- Name: admin_statutory_profiles admin_statutory_profiles_tenant_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_statutory_profiles
    ADD CONSTRAINT admin_statutory_profiles_tenant_slug_key UNIQUE (tenant_slug);


--
-- Name: admin_temporary_access admin_temporary_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_temporary_access
    ADD CONSTRAINT admin_temporary_access_pkey PRIMARY KEY (id);


--
-- Name: admin_user_roles admin_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user_roles
    ADD CONSTRAINT admin_user_roles_pkey PRIMARY KEY (id);


--
-- Name: admin_workflow_executions admin_workflow_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_workflow_executions
    ADD CONSTRAINT admin_workflow_executions_pkey PRIMARY KEY (id);


--
-- Name: admin_workflows admin_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_workflows
    ADD CONSTRAINT admin_workflows_pkey PRIMARY KEY (id);


--
-- Name: advance_taxes advance_taxes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advance_taxes
    ADD CONSTRAINT advance_taxes_pkey PRIMARY KEY (id);


--
-- Name: ai_conversations ai_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_conversations
    ADD CONSTRAINT ai_conversations_pkey PRIMARY KEY (id);


--
-- Name: ai_pending_actions ai_pending_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_pending_actions
    ADD CONSTRAINT ai_pending_actions_pkey PRIMARY KEY (id);


--
-- Name: ai_usage_log ai_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_log
    ADD CONSTRAINT ai_usage_log_pkey PRIMARY KEY (id);


--
-- Name: api_rate_limits api_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_rate_limits
    ADD CONSTRAINT api_rate_limits_pkey PRIMARY KEY (key);


--
-- Name: app_notifications app_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_notifications
    ADD CONSTRAINT app_notifications_pkey PRIMARY KEY (id);


--
-- Name: approval_delegates approval_delegates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_delegates
    ADD CONSTRAINT approval_delegates_pkey PRIMARY KEY (id);


--
-- Name: approval_rules approval_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_rules
    ADD CONSTRAINT approval_rules_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: asset_activity_logs asset_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_activity_logs
    ADD CONSTRAINT asset_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: asset_capitalizations asset_capitalizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_capitalizations
    ADD CONSTRAINT asset_capitalizations_pkey PRIMARY KEY (id);


--
-- Name: asset_depreciation_schedule asset_depreciation_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_depreciation_schedule
    ADD CONSTRAINT asset_depreciation_schedule_pkey PRIMARY KEY (id);


--
-- Name: asset_finance_books asset_finance_books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_finance_books
    ADD CONSTRAINT asset_finance_books_pkey PRIMARY KEY (id);


--
-- Name: asset_finance_books asset_finance_books_tenant_slug_asset_id_finance_book_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_finance_books
    ADD CONSTRAINT asset_finance_books_tenant_slug_asset_id_finance_book_key UNIQUE (tenant_slug, asset_id, finance_book);


--
-- Name: asset_locations asset_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_locations
    ADD CONSTRAINT asset_locations_pkey PRIMARY KEY (id);


--
-- Name: asset_locations asset_locations_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_locations
    ADD CONSTRAINT asset_locations_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: asset_maintenance asset_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_pkey PRIMARY KEY (id);


--
-- Name: asset_maintenance_teams asset_maintenance_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenance_teams
    ADD CONSTRAINT asset_maintenance_teams_pkey PRIMARY KEY (id);


--
-- Name: asset_maintenance_teams asset_maintenance_teams_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenance_teams
    ADD CONSTRAINT asset_maintenance_teams_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: asset_movements asset_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_pkey PRIMARY KEY (id);


--
-- Name: asset_shift_allocations asset_shift_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_shift_allocations
    ADD CONSTRAINT asset_shift_allocations_pkey PRIMARY KEY (id);


--
-- Name: asset_usage_log asset_usage_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_usage_log
    ADD CONSTRAINT asset_usage_log_pkey PRIMARY KEY (id);


--
-- Name: asset_value_adjustments asset_value_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_value_adjustments
    ADD CONSTRAINT asset_value_adjustments_pkey PRIMARY KEY (id);


--
-- Name: assignment_recommendations assignment_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_recommendations
    ADD CONSTRAINT assignment_recommendations_pkey PRIMARY KEY (id);


--
-- Name: attendance_locations attendance_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_locations
    ADD CONSTRAINT attendance_locations_pkey PRIMARY KEY (id);


--
-- Name: attendance_qr_tokens attendance_qr_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_qr_tokens
    ADD CONSTRAINT attendance_qr_tokens_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: automation_action_queue automation_action_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_action_queue
    ADD CONSTRAINT automation_action_queue_pkey PRIMARY KEY (id);


--
-- Name: automation_event_dedup automation_event_dedup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_event_dedup
    ADD CONSTRAINT automation_event_dedup_pkey PRIMARY KEY (tenant_slug, event_type, dedup_key);


--
-- Name: automation_rule_audits automation_rule_audits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rule_audits
    ADD CONSTRAINT automation_rule_audits_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: bank_guarantees bank_guarantees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_guarantees
    ADD CONSTRAINT bank_guarantees_pkey PRIMARY KEY (id);


--
-- Name: bank_recon_rules bank_recon_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_recon_rules
    ADD CONSTRAINT bank_recon_rules_pkey PRIMARY KEY (id);


--
-- Name: bank_reconciliations bank_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_reconciliations
    ADD CONSTRAINT bank_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: bank_statement_lines bank_statement_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_statement_lines
    ADD CONSTRAINT bank_statement_lines_pkey PRIMARY KEY (id);


--
-- Name: bill_items bill_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_items
    ADD CONSTRAINT bill_items_pkey PRIMARY KEY (id);


--
-- Name: bill_payment_schedule bill_payment_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_payment_schedule
    ADD CONSTRAINT bill_payment_schedule_pkey PRIMARY KEY (id);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: bom_headers bom_headers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_headers
    ADD CONSTRAINT bom_headers_pkey PRIMARY KEY (id);


--
-- Name: bom_lines bom_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_lines
    ADD CONSTRAINT bom_lines_pkey PRIMARY KEY (id);


--
-- Name: budget_actuals budget_actuals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_actuals
    ADD CONSTRAINT budget_actuals_pkey PRIMARY KEY (id);


--
-- Name: budget_approvals budget_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_approvals
    ADD CONSTRAINT budget_approvals_pkey PRIMARY KEY (id);


--
-- Name: budget_forecasts budget_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_forecasts
    ADD CONSTRAINT budget_forecasts_pkey PRIMARY KEY (id);


--
-- Name: budget_lines budget_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_pkey PRIMARY KEY (id);


--
-- Name: budget_variances budget_variances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_variances
    ADD CONSTRAINT budget_variances_pkey PRIMARY KEY (id);


--
-- Name: budget_versions budget_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_versions
    ADD CONSTRAINT budget_versions_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: capacity_snapshots capacity_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.capacity_snapshots
    ADD CONSTRAINT capacity_snapshots_pkey PRIMARY KEY (id);


--
-- Name: chart_of_accounts chart_of_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);


--
-- Name: cheque_print_templates cheque_print_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheque_print_templates
    ADD CONSTRAINT cheque_print_templates_pkey PRIMARY KEY (id);


--
-- Name: cheque_print_templates cheque_print_templates_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cheque_print_templates
    ADD CONSTRAINT cheque_print_templates_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: cms_pages cms_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_pages
    ADD CONSTRAINT cms_pages_pkey PRIMARY KEY (id);


--
-- Name: cms_pages cms_pages_tenant_slug_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_pages
    ADD CONSTRAINT cms_pages_tenant_slug_slug_key UNIQUE (tenant_slug, slug);


--
-- Name: cms_posts cms_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_pkey PRIMARY KEY (id);


--
-- Name: cms_posts cms_posts_tenant_slug_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_posts
    ADD CONSTRAINT cms_posts_tenant_slug_slug_key UNIQUE (tenant_slug, slug);


--
-- Name: cost_center_allocations cost_center_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_center_allocations
    ADD CONSTRAINT cost_center_allocations_pkey PRIMARY KEY (id);


--
-- Name: cost_center_allocations cost_center_allocations_tenant_slug_account_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_center_allocations
    ADD CONSTRAINT cost_center_allocations_tenant_slug_account_code_key UNIQUE (tenant_slug, account_code);


--
-- Name: coupon_codes coupon_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_codes
    ADD CONSTRAINT coupon_codes_pkey PRIMARY KEY (id);


--
-- Name: coupon_codes coupon_codes_tenant_slug_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coupon_codes
    ADD CONSTRAINT coupon_codes_tenant_slug_code_key UNIQUE (tenant_slug, code);


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_activity_log crm_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_activity_log
    ADD CONSTRAINT crm_activity_log_pkey PRIMARY KEY (id);


--
-- Name: crm_appointments crm_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_appointments
    ADD CONSTRAINT crm_appointments_pkey PRIMARY KEY (id);


--
-- Name: crm_campaign_emails crm_campaign_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_emails
    ADD CONSTRAINT crm_campaign_emails_pkey PRIMARY KEY (id);


--
-- Name: crm_campaign_enrollments crm_campaign_enrollments_campaign_id_recipient_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_enrollments
    ADD CONSTRAINT crm_campaign_enrollments_campaign_id_recipient_email_key UNIQUE (campaign_id, recipient_email);


--
-- Name: crm_campaign_enrollments crm_campaign_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_enrollments
    ADD CONSTRAINT crm_campaign_enrollments_pkey PRIMARY KEY (id);


--
-- Name: crm_campaign_sends crm_campaign_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_sends
    ADD CONSTRAINT crm_campaign_sends_pkey PRIMARY KEY (id);


--
-- Name: crm_competitors crm_competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_competitors
    ADD CONSTRAINT crm_competitors_pkey PRIMARY KEY (id);


--
-- Name: crm_competitors crm_competitors_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_competitors
    ADD CONSTRAINT crm_competitors_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: crm_contacts crm_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contacts
    ADD CONSTRAINT crm_contacts_pkey PRIMARY KEY (id);


--
-- Name: crm_contract_templates crm_contract_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contract_templates
    ADD CONSTRAINT crm_contract_templates_pkey PRIMARY KEY (id);


--
-- Name: crm_contract_templates crm_contract_templates_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contract_templates
    ADD CONSTRAINT crm_contract_templates_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: crm_contracts crm_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contracts
    ADD CONSTRAINT crm_contracts_pkey PRIMARY KEY (id);


--
-- Name: crm_contracts crm_contracts_tenant_slug_contract_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_contracts
    ADD CONSTRAINT crm_contracts_tenant_slug_contract_number_key UNIQUE (tenant_slug, contract_number);


--
-- Name: crm_conversions crm_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_conversions
    ADD CONSTRAINT crm_conversions_pkey PRIMARY KEY (id);


--
-- Name: crm_customers crm_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_customers
    ADD CONSTRAINT crm_customers_pkey PRIMARY KEY (id);


--
-- Name: crm_deal_competitors crm_deal_competitors_deal_id_competitor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_deal_competitors
    ADD CONSTRAINT crm_deal_competitors_deal_id_competitor_id_key UNIQUE (deal_id, competitor_id);


--
-- Name: crm_deal_competitors crm_deal_competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_deal_competitors
    ADD CONSTRAINT crm_deal_competitors_pkey PRIMARY KEY (id);


--
-- Name: crm_deal_items crm_deal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_deal_items
    ADD CONSTRAINT crm_deal_items_pkey PRIMARY KEY (id);


--
-- Name: crm_deals crm_deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_deals
    ADD CONSTRAINT crm_deals_pkey PRIMARY KEY (id);


--
-- Name: crm_email_campaigns crm_email_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_email_campaigns
    ADD CONSTRAINT crm_email_campaigns_pkey PRIMARY KEY (id);


--
-- Name: crm_email_campaigns crm_email_campaigns_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_email_campaigns
    ADD CONSTRAINT crm_email_campaigns_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: crm_industry_types crm_industry_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_industry_types
    ADD CONSTRAINT crm_industry_types_pkey PRIMARY KEY (id);


--
-- Name: crm_industry_types crm_industry_types_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_industry_types
    ADD CONSTRAINT crm_industry_types_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: crm_leads crm_leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_leads
    ADD CONSTRAINT crm_leads_pkey PRIMARY KEY (id);


--
-- Name: crm_market_segments crm_market_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_market_segments
    ADD CONSTRAINT crm_market_segments_pkey PRIMARY KEY (id);


--
-- Name: crm_market_segments crm_market_segments_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_market_segments
    ADD CONSTRAINT crm_market_segments_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: crm_notes crm_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_notes
    ADD CONSTRAINT crm_notes_pkey PRIMARY KEY (id);


--
-- Name: crm_prospects crm_prospects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_prospects
    ADD CONSTRAINT crm_prospects_pkey PRIMARY KEY (id);


--
-- Name: crm_sales_stages crm_sales_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_sales_stages
    ADD CONSTRAINT crm_sales_stages_pkey PRIMARY KEY (id);


--
-- Name: crm_sales_stages crm_sales_stages_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_sales_stages
    ADD CONSTRAINT crm_sales_stages_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: crm_territories crm_territories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_territories
    ADD CONSTRAINT crm_territories_pkey PRIMARY KEY (id);


--
-- Name: crm_territories crm_territories_tenant_slug_name_parent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_territories
    ADD CONSTRAINT crm_territories_tenant_slug_name_parent_id_key UNIQUE (tenant_slug, name, parent_id);


--
-- Name: custom_field_defs custom_field_defs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_field_defs
    ADD CONSTRAINT custom_field_defs_pkey PRIMARY KEY (id);


--
-- Name: custom_field_defs custom_field_defs_tenant_slug_doctype_field_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_field_defs
    ADD CONSTRAINT custom_field_defs_tenant_slug_doctype_field_name_key UNIQUE (tenant_slug, doctype, field_name);


--
-- Name: custom_reports custom_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_reports
    ADD CONSTRAINT custom_reports_pkey PRIMARY KEY (id);


--
-- Name: data_imports data_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_imports
    ADD CONSTRAINT data_imports_pkey PRIMARY KEY (id);


--
-- Name: deferred_items deferred_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deferred_items
    ADD CONSTRAINT deferred_items_pkey PRIMARY KEY (id);


--
-- Name: deferred_schedule deferred_schedule_deferred_item_id_period_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deferred_schedule
    ADD CONSTRAINT deferred_schedule_deferred_item_id_period_date_key UNIQUE (deferred_item_id, period_date);


--
-- Name: deferred_schedule deferred_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deferred_schedule
    ADD CONSTRAINT deferred_schedule_pkey PRIMARY KEY (id);


--
-- Name: delivery_note_items delivery_note_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_note_items
    ADD CONSTRAINT delivery_note_items_pkey PRIMARY KEY (id);


--
-- Name: delivery_notes delivery_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_notes
    ADD CONSTRAINT delivery_notes_pkey PRIMARY KEY (id);


--
-- Name: doc_shares doc_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_shares
    ADD CONSTRAINT doc_shares_pkey PRIMARY KEY (id);


--
-- Name: doc_shares doc_shares_tenant_slug_doc_type_doc_id_shared_with_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doc_shares
    ADD CONSTRAINT doc_shares_tenant_slug_doc_type_doc_id_shared_with_key UNIQUE (tenant_slug, doc_type, doc_id, shared_with);


--
-- Name: document_due_schedule document_due_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_due_schedule
    ADD CONSTRAINT document_due_schedule_pkey PRIMARY KEY (id);


--
-- Name: document_merges document_merges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_merges
    ADD CONSTRAINT document_merges_pkey PRIMARY KEY (id);


--
-- Name: domain_events domain_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.domain_events
    ADD CONSTRAINT domain_events_pkey PRIMARY KEY (id);


--
-- Name: downtime_entries downtime_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_entries
    ADD CONSTRAINT downtime_entries_pkey PRIMARY KEY (id);


--
-- Name: dunning_notices dunning_notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dunning_notices
    ADD CONSTRAINT dunning_notices_pkey PRIMARY KEY (id);


--
-- Name: einvoice_submissions einvoice_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.einvoice_submissions
    ADD CONSTRAINT einvoice_submissions_pkey PRIMARY KEY (id);


--
-- Name: employee_grievances employee_grievances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_grievances
    ADD CONSTRAINT employee_grievances_pkey PRIMARY KEY (id);


--
-- Name: employee_skill_maps employee_skill_maps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_skill_maps
    ADD CONSTRAINT employee_skill_maps_pkey PRIMARY KEY (id);


--
-- Name: employee_skill_maps employee_skill_maps_tenant_slug_employee_id_skill_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_skill_maps
    ADD CONSTRAINT employee_skill_maps_tenant_slug_employee_id_skill_key UNIQUE (tenant_slug, employee_id, skill);


--
-- Name: employee_skills employee_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_skills
    ADD CONSTRAINT employee_skills_pkey PRIMARY KEY (id);


--
-- Name: employee_tax_declarations employee_tax_declarations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_tax_declarations
    ADD CONSTRAINT employee_tax_declarations_pkey PRIMARY KEY (id);


--
-- Name: employee_tax_declarations employee_tax_declarations_tenant_slug_employee_id_tax_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_tax_declarations
    ADD CONSTRAINT employee_tax_declarations_tenant_slug_employee_id_tax_year_key UNIQUE (tenant_slug, employee_id, tax_year);


--
-- Name: employee_transfers employee_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_transfers
    ADD CONSTRAINT employee_transfers_pkey PRIMARY KEY (id);


--
-- Name: energy_point_logs energy_point_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energy_point_logs
    ADD CONSTRAINT energy_point_logs_pkey PRIMARY KEY (id);


--
-- Name: engineer_profiles engineer_profiles_employee_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_profiles
    ADD CONSTRAINT engineer_profiles_employee_unique UNIQUE (tenant_slug, employee_id);


--
-- Name: engineer_profiles engineer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineer_profiles
    ADD CONSTRAINT engineer_profiles_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_tenant_slug_currency_rate_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rates
    ADD CONSTRAINT exchange_rates_tenant_slug_currency_rate_date_key UNIQUE (tenant_slug, currency, rate_date);


--
-- Name: expense_approvals expense_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_approvals
    ADD CONSTRAINT expense_approvals_pkey PRIMARY KEY (id);


--
-- Name: expense_audit_logs expense_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_audit_logs
    ADD CONSTRAINT expense_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: expense_categories expense_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_code_key UNIQUE (code);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expense_receipts expense_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_receipts
    ADD CONSTRAINT expense_receipts_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: field_jobs field_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_jobs
    ADD CONSTRAINT field_jobs_pkey PRIMARY KEY (id);


--
-- Name: finance_accounts finance_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_accounts
    ADD CONSTRAINT finance_accounts_pkey PRIMARY KEY (id);


--
-- Name: finance_allocations finance_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_allocations
    ADD CONSTRAINT finance_allocations_pkey PRIMARY KEY (id);


--
-- Name: finance_cached_summary finance_cached_summary_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cached_summary
    ADD CONSTRAINT finance_cached_summary_pkey PRIMARY KEY (id);


--
-- Name: finance_cached_summary finance_cached_summary_tenant_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cached_summary
    ADD CONSTRAINT finance_cached_summary_tenant_slug_key UNIQUE (tenant_slug);


--
-- Name: finance_cost_centers finance_cost_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_cost_centers
    ADD CONSTRAINT finance_cost_centers_pkey PRIMARY KEY (id);


--
-- Name: finance_customers finance_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_customers
    ADD CONSTRAINT finance_customers_pkey PRIMARY KEY (id);


--
-- Name: finance_customers finance_customers_tenant_slug_customer_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_customers
    ADD CONSTRAINT finance_customers_tenant_slug_customer_code_key UNIQUE (tenant_slug, customer_code);


--
-- Name: finance_events finance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_events
    ADD CONSTRAINT finance_events_pkey PRIMARY KEY (id);


--
-- Name: finance_expense_categories finance_expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_expense_categories
    ADD CONSTRAINT finance_expense_categories_pkey PRIMARY KEY (id);


--
-- Name: finance_invoice_lines finance_invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoice_lines
    ADD CONSTRAINT finance_invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: finance_invoices finance_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoices
    ADD CONSTRAINT finance_invoices_pkey PRIMARY KEY (id);


--
-- Name: finance_payments finance_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_payments
    ADD CONSTRAINT finance_payments_pkey PRIMARY KEY (id);


--
-- Name: finance_posting_settings finance_posting_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_posting_settings
    ADD CONSTRAINT finance_posting_settings_pkey PRIMARY KEY (id);


--
-- Name: finance_posting_settings finance_posting_settings_tenant_slug_setting_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_posting_settings
    ADD CONSTRAINT finance_posting_settings_tenant_slug_setting_key_key UNIQUE (tenant_slug, setting_key);


--
-- Name: finance_returns finance_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_returns
    ADD CONSTRAINT finance_returns_pkey PRIMARY KEY (id);


--
-- Name: finance_schedules finance_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_schedules
    ADD CONSTRAINT finance_schedules_pkey PRIMARY KEY (id);


--
-- Name: finance_settings finance_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_settings
    ADD CONSTRAINT finance_settings_pkey PRIMARY KEY (tenant_slug);


--
-- Name: finance_subscriptions finance_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_subscriptions
    ADD CONSTRAINT finance_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: finance_trend_points finance_trend_points_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_trend_points
    ADD CONSTRAINT finance_trend_points_pkey PRIMARY KEY (id);


--
-- Name: fiscal_periods fiscal_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT fiscal_periods_pkey PRIMARY KEY (id);


--
-- Name: fixed_assets fixed_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_pkey PRIMARY KEY (id);


--
-- Name: fixed_assets fixed_assets_tenant_slug_asset_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixed_assets
    ADD CONSTRAINT fixed_assets_tenant_slug_asset_no_key UNIQUE (tenant_slug, asset_no);


--
-- Name: fx_revaluations fx_revaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fx_revaluations
    ADD CONSTRAINT fx_revaluations_pkey PRIMARY KEY (id);


--
-- Name: gate_test_scratch gate_test_scratch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_test_scratch
    ADD CONSTRAINT gate_test_scratch_pkey PRIMARY KEY (id);


--
-- Name: hr_advance_repayments hr_advance_repayments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_advance_repayments
    ADD CONSTRAINT hr_advance_repayments_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_advances hr_employee_advances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_advances
    ADD CONSTRAINT hr_employee_advances_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_advances hr_employee_advances_tenant_slug_advance_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_advances
    ADD CONSTRAINT hr_employee_advances_tenant_slug_advance_number_key UNIQUE (tenant_slug, advance_number);


--
-- Name: hr_employee_checkins hr_employee_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_checkins
    ADD CONSTRAINT hr_employee_checkins_pkey PRIMARY KEY (id);


--
-- Name: hr_employee_lifecycle hr_employee_lifecycle_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employee_lifecycle
    ADD CONSTRAINT hr_employee_lifecycle_pkey PRIMARY KEY (id);


--
-- Name: hr_leave_accrual_log hr_leave_accrual_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_accrual_log
    ADD CONSTRAINT hr_leave_accrual_log_pkey PRIMARY KEY (id);


--
-- Name: hr_leave_accrual_log hr_leave_accrual_log_tenant_slug_employee_id_leave_type_per_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_accrual_log
    ADD CONSTRAINT hr_leave_accrual_log_tenant_slug_employee_id_leave_type_per_key UNIQUE (tenant_slug, employee_id, leave_type, period);


--
-- Name: hr_leave_allocations hr_leave_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_allocations
    ADD CONSTRAINT hr_leave_allocations_pkey PRIMARY KEY (id);


--
-- Name: hr_leave_allocations hr_leave_allocations_tenant_slug_employee_id_leave_type_yea_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_leave_allocations
    ADD CONSTRAINT hr_leave_allocations_tenant_slug_employee_id_leave_type_yea_key UNIQUE (tenant_slug, employee_id, leave_type, year);


--
-- Name: import_jobs import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);


--
-- Name: imprest_funds imprest_funds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imprest_funds
    ADD CONSTRAINT imprest_funds_pkey PRIMARY KEY (id);


--
-- Name: imprest_transactions imprest_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imprest_transactions
    ADD CONSTRAINT imprest_transactions_pkey PRIMARY KEY (id);


--
-- Name: installation_notes installation_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installation_notes
    ADD CONSTRAINT installation_notes_pkey PRIMARY KEY (id);


--
-- Name: installation_notes installation_notes_tenant_slug_note_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.installation_notes
    ADD CONSTRAINT installation_notes_tenant_slug_note_number_key UNIQUE (tenant_slug, note_number);


--
-- Name: inventory_item_attributes inventory_item_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_attributes
    ADD CONSTRAINT inventory_item_attributes_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_attributes inventory_item_attributes_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_attributes
    ADD CONSTRAINT inventory_item_attributes_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: inventory_item_groups inventory_item_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_groups
    ADD CONSTRAINT inventory_item_groups_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_groups inventory_item_groups_tenant_slug_name_parent_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_groups
    ADD CONSTRAINT inventory_item_groups_tenant_slug_name_parent_id_key UNIQUE (tenant_slug, name, parent_id);


--
-- Name: inventory_item_variants inventory_item_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_variants
    ADD CONSTRAINT inventory_item_variants_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_variants inventory_item_variants_tenant_slug_variant_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_variants
    ADD CONSTRAINT inventory_item_variants_tenant_slug_variant_sku_key UNIQUE (tenant_slug, variant_sku);


--
-- Name: inventory_lot_stock inventory_lot_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lot_stock
    ADD CONSTRAINT inventory_lot_stock_pkey PRIMARY KEY (id);


--
-- Name: inventory_lot_stock inventory_lot_stock_tenant_slug_sku_lot_no_warehouse_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_lot_stock
    ADD CONSTRAINT inventory_lot_stock_tenant_slug_sku_lot_no_warehouse_id_key UNIQUE (tenant_slug, sku, lot_no, warehouse_id);


--
-- Name: inventory_product_bundle_items inventory_product_bundle_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_bundle_items
    ADD CONSTRAINT inventory_product_bundle_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_product_bundles inventory_product_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_bundles
    ADD CONSTRAINT inventory_product_bundles_pkey PRIMARY KEY (id);


--
-- Name: inventory_product_bundles inventory_product_bundles_tenant_slug_bundle_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_bundles
    ADD CONSTRAINT inventory_product_bundles_tenant_slug_bundle_sku_key UNIQUE (tenant_slug, bundle_sku);


--
-- Name: inventory_products inventory_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_products
    ADD CONSTRAINT inventory_products_pkey PRIMARY KEY (id);


--
-- Name: inventory_products inventory_products_tenant_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_products
    ADD CONSTRAINT inventory_products_tenant_sku_key UNIQUE (tenant_slug, sku);


--
-- Name: inventory_quality_inspections inventory_quality_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_quality_inspections
    ADD CONSTRAINT inventory_quality_inspections_pkey PRIMARY KEY (id);


--
-- Name: inventory_quality_inspections inventory_quality_inspections_tenant_slug_inspection_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_quality_inspections
    ADD CONSTRAINT inventory_quality_inspections_tenant_slug_inspection_number_key UNIQUE (tenant_slug, inspection_number);


--
-- Name: inventory_reorder_rules inventory_reorder_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reorder_rules
    ADD CONSTRAINT inventory_reorder_rules_pkey PRIMARY KEY (id);


--
-- Name: inventory_reorder_rules inventory_reorder_rules_tenant_slug_product_sku_warehouse_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_reorder_rules
    ADD CONSTRAINT inventory_reorder_rules_tenant_slug_product_sku_warehouse_i_key UNIQUE (tenant_slug, product_sku, warehouse_id);


--
-- Name: inventory_serials inventory_serials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_serials
    ADD CONSTRAINT inventory_serials_pkey PRIMARY KEY (id);


--
-- Name: inventory_serials inventory_serials_tenant_slug_sku_serial_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_serials
    ADD CONSTRAINT inventory_serials_tenant_slug_sku_serial_no_key UNIQUE (tenant_slug, sku, serial_no);


--
-- Name: inventory_stock_balances inventory_stock_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_balances
    ADD CONSTRAINT inventory_stock_balances_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_balances inventory_stock_balances_tenant_slug_product_sku_warehouse__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_balances
    ADD CONSTRAINT inventory_stock_balances_tenant_slug_product_sku_warehouse__key UNIQUE (tenant_slug, product_sku, warehouse_id);


--
-- Name: inventory_stock_layers inventory_stock_layers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_layers
    ADD CONSTRAINT inventory_stock_layers_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_reconciliation_items inventory_stock_reconciliation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_reconciliation_items
    ADD CONSTRAINT inventory_stock_reconciliation_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_reconciliations inventory_stock_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_reconciliations
    ADD CONSTRAINT inventory_stock_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_reconciliations inventory_stock_reconciliations_tenant_slug_rec_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_reconciliations
    ADD CONSTRAINT inventory_stock_reconciliations_tenant_slug_rec_number_key UNIQUE (tenant_slug, rec_number);


--
-- Name: inventory_stock_reservations inventory_stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_reservations
    ADD CONSTRAINT inventory_stock_reservations_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_transfers inventory_stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_transfers
    ADD CONSTRAINT inventory_stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: inventory_uom_categories inventory_uom_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_uom_categories
    ADD CONSTRAINT inventory_uom_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_uom_categories inventory_uom_categories_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_uom_categories
    ADD CONSTRAINT inventory_uom_categories_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: inventory_uom_conversions inventory_uom_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_uom_conversions
    ADD CONSTRAINT inventory_uom_conversions_pkey PRIMARY KEY (id);


--
-- Name: inventory_uom_conversions inventory_uom_conversions_tenant_slug_from_uom_to_uom_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_uom_conversions
    ADD CONSTRAINT inventory_uom_conversions_tenant_slug_from_uom_to_uom_key UNIQUE (tenant_slug, from_uom, to_uom);


--
-- Name: inventory_uoms inventory_uoms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_uoms
    ADD CONSTRAINT inventory_uoms_pkey PRIMARY KEY (id);


--
-- Name: inventory_uoms inventory_uoms_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_uoms
    ADD CONSTRAINT inventory_uoms_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: inventory_warehouses inventory_warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_pkey PRIMARY KEY (id);


--
-- Name: inventory_warehouses inventory_warehouses_tenant_slug_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_tenant_slug_code_key UNIQUE (tenant_slug, code);


--
-- Name: invitations invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invitations
    ADD CONSTRAINT invitations_pkey PRIMARY KEY (id);


--
-- Name: invoice_discountings invoice_discountings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_discountings
    ADD CONSTRAINT invoice_discountings_pkey PRIMARY KEY (id);


--
-- Name: invoice_payment_schedule invoice_payment_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payment_schedule
    ADD CONSTRAINT invoice_payment_schedule_pkey PRIMARY KEY (id);


--
-- Name: it_field_jobs it_field_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.it_field_jobs
    ADD CONSTRAINT it_field_jobs_pkey PRIMARY KEY (id);


--
-- Name: item_party_codes item_party_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_party_codes
    ADD CONSTRAINT item_party_codes_pkey PRIMARY KEY (id);


--
-- Name: item_party_codes item_party_codes_tenant_slug_product_sku_party_type_party_c_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_party_codes
    ADD CONSTRAINT item_party_codes_tenant_slug_product_sku_party_type_party_c_key UNIQUE (tenant_slug, product_sku, party_type, party_code);


--
-- Name: item_tax_templates item_tax_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_tax_templates
    ADD CONSTRAINT item_tax_templates_pkey PRIMARY KEY (id);


--
-- Name: item_tax_templates item_tax_templates_tenant_slug_item_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_tax_templates
    ADD CONSTRAINT item_tax_templates_tenant_slug_item_key UNIQUE (tenant_slug, item);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_entry_lines journal_entry_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_pkey PRIMARY KEY (id);


--
-- Name: journal_entry_templates journal_entry_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_templates
    ADD CONSTRAINT journal_entry_templates_pkey PRIMARY KEY (id);


--
-- Name: journal_entry_templates journal_entry_templates_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_templates
    ADD CONSTRAINT journal_entry_templates_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: journal_lines journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_pkey PRIMARY KEY (id);


--
-- Name: journal_sequences journal_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_sequences
    ADD CONSTRAINT journal_sequences_pkey PRIMARY KEY (tenant_slug, prefix, fiscal_year);


--
-- Name: knowledge_base_articles knowledge_base_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_base_articles
    ADD CONSTRAINT knowledge_base_articles_pkey PRIMARY KEY (id);


--
-- Name: landed_cost_charges landed_cost_charges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landed_cost_charges
    ADD CONSTRAINT landed_cost_charges_pkey PRIMARY KEY (id);


--
-- Name: landed_cost_vouchers landed_cost_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landed_cost_vouchers
    ADD CONSTRAINT landed_cost_vouchers_pkey PRIMARY KEY (id);


--
-- Name: leave_encashments leave_encashments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_encashments
    ADD CONSTRAINT leave_encashments_pkey PRIMARY KEY (id);


--
-- Name: license_tiers license_tiers_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_tiers
    ADD CONSTRAINT license_tiers_key_key UNIQUE (key);


--
-- Name: license_tiers license_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.license_tiers
    ADD CONSTRAINT license_tiers_pkey PRIMARY KEY (id);


--
-- Name: licenses licenses_license_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_license_key_key UNIQUE (license_key);


--
-- Name: licenses licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_pkey PRIMARY KEY (id);


--
-- Name: loyalty_point_entries loyalty_point_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_entries
    ADD CONSTRAINT loyalty_point_entries_pkey PRIMARY KEY (id);


--
-- Name: loyalty_point_entries loyalty_point_entries_tenant_slug_program_id_invoice_id_typ_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_entries
    ADD CONSTRAINT loyalty_point_entries_tenant_slug_program_id_invoice_id_typ_key UNIQUE (tenant_slug, program_id, invoice_id, type);


--
-- Name: loyalty_programs loyalty_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_pkey PRIMARY KEY (id);


--
-- Name: loyalty_programs loyalty_programs_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: maintenance_schedules maintenance_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_schedules
    ADD CONSTRAINT maintenance_schedules_pkey PRIMARY KEY (id);


--
-- Name: maintenance_visits maintenance_visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_visits
    ADD CONSTRAINT maintenance_visits_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_job_card_time_logs manufacturing_job_card_time_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_job_card_time_logs
    ADD CONSTRAINT manufacturing_job_card_time_logs_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_job_cards manufacturing_job_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_job_cards
    ADD CONSTRAINT manufacturing_job_cards_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_job_cards manufacturing_job_cards_tenant_slug_job_card_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_job_cards
    ADD CONSTRAINT manufacturing_job_cards_tenant_slug_job_card_number_key UNIQUE (tenant_slug, job_card_number);


--
-- Name: manufacturing_production_plan_items manufacturing_production_plan_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_production_plan_items
    ADD CONSTRAINT manufacturing_production_plan_items_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_production_plans manufacturing_production_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_production_plans
    ADD CONSTRAINT manufacturing_production_plans_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_production_plans manufacturing_production_plans_tenant_slug_plan_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_production_plans
    ADD CONSTRAINT manufacturing_production_plans_tenant_slug_plan_number_key UNIQUE (tenant_slug, plan_number);


--
-- Name: manufacturing_routing_operations manufacturing_routing_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_routing_operations
    ADD CONSTRAINT manufacturing_routing_operations_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_routings manufacturing_routings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_routings
    ADD CONSTRAINT manufacturing_routings_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_routings manufacturing_routings_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_routings
    ADD CONSTRAINT manufacturing_routings_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: manufacturing_sales_forecasts manufacturing_sales_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_sales_forecasts
    ADD CONSTRAINT manufacturing_sales_forecasts_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_workstations manufacturing_workstations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_workstations
    ADD CONSTRAINT manufacturing_workstations_pkey PRIMARY KEY (id);


--
-- Name: manufacturing_workstations manufacturing_workstations_tenant_slug_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_workstations
    ADD CONSTRAINT manufacturing_workstations_tenant_slug_code_key UNIQUE (tenant_slug, code);


--
-- Name: master_production_schedules master_production_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_production_schedules
    ADD CONSTRAINT master_production_schedules_pkey PRIMARY KEY (id);


--
-- Name: master_production_schedules master_production_schedules_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_production_schedules
    ADD CONSTRAINT master_production_schedules_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: material_request_items material_request_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_pkey PRIMARY KEY (id);


--
-- Name: material_requests material_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_requests
    ADD CONSTRAINT material_requests_pkey PRIMARY KEY (id);


--
-- Name: mfg_sub_operations mfg_sub_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mfg_sub_operations
    ADD CONSTRAINT mfg_sub_operations_pkey PRIMARY KEY (id);


--
-- Name: mode_of_payment mode_of_payment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mode_of_payment
    ADD CONSTRAINT mode_of_payment_pkey PRIMARY KEY (id);


--
-- Name: mode_of_payment mode_of_payment_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mode_of_payment
    ADD CONSTRAINT mode_of_payment_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: monthly_distributions monthly_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_distributions
    ADD CONSTRAINT monthly_distributions_pkey PRIMARY KEY (id);


--
-- Name: monthly_distributions monthly_distributions_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_distributions
    ADD CONSTRAINT monthly_distributions_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: mps_items mps_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mps_items
    ADD CONSTRAINT mps_items_pkey PRIMARY KEY (id);


--
-- Name: notification_outbox notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: notification_outbox notification_outbox_tenant_slug_dedupe_key_channel_recipien_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_outbox
    ADD CONSTRAINT notification_outbox_tenant_slug_dedupe_key_channel_recipien_key UNIQUE (tenant_slug, dedupe_key, channel, recipient);


--
-- Name: notification_rules notification_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_rules
    ADD CONSTRAINT notification_rules_pkey PRIMARY KEY (id);


--
-- Name: notification_rules notification_rules_tenant_slug_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_rules
    ADD CONSTRAINT notification_rules_tenant_slug_event_type_key UNIQUE (tenant_slug, event_type);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_tenant_slug_event_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_tenant_slug_event_type_key UNIQUE (tenant_slug, event_type);


--
-- Name: org_admin_assignments org_admin_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.org_admin_assignments
    ADD CONSTRAINT org_admin_assignments_pkey PRIMARY KEY (id);


--
-- Name: overtime_entries overtime_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_entries
    ADD CONSTRAINT overtime_entries_pkey PRIMARY KEY (id);


--
-- Name: packing_slips packing_slips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packing_slips
    ADD CONSTRAINT packing_slips_pkey PRIMARY KEY (id);


--
-- Name: packing_slips packing_slips_tenant_slug_slip_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packing_slips
    ADD CONSTRAINT packing_slips_tenant_slug_slip_number_key UNIQUE (tenant_slug, slip_number);


--
-- Name: party_links party_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_links
    ADD CONSTRAINT party_links_pkey PRIMARY KEY (id);


--
-- Name: party_links party_links_tenant_slug_primary_type_primary_id_secondary_t_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_links
    ADD CONSTRAINT party_links_tenant_slug_primary_type_primary_id_secondary_t_key UNIQUE (tenant_slug, primary_type, primary_id, secondary_type, secondary_id);


--
-- Name: party_tax_categories party_tax_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_tax_categories
    ADD CONSTRAINT party_tax_categories_pkey PRIMARY KEY (id);


--
-- Name: party_tax_categories party_tax_categories_tenant_slug_party_type_party_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_tax_categories
    ADD CONSTRAINT party_tax_categories_tenant_slug_party_type_party_id_key UNIQUE (tenant_slug, party_type, party_id);


--
-- Name: payment_applications payment_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_applications
    ADD CONSTRAINT payment_applications_pkey PRIMARY KEY (id);


--
-- Name: payment_gateway_configs payment_gateway_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_configs
    ADD CONSTRAINT payment_gateway_configs_pkey PRIMARY KEY (id);


--
-- Name: payment_gateway_configs payment_gateway_configs_tenant_slug_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_gateway_configs
    ADD CONSTRAINT payment_gateway_configs_tenant_slug_provider_key UNIQUE (tenant_slug, provider);


--
-- Name: payment_links payment_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_links
    ADD CONSTRAINT payment_links_pkey PRIMARY KEY (id);


--
-- Name: payment_links payment_links_tenant_slug_provider_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_links
    ADD CONSTRAINT payment_links_tenant_slug_provider_reference_key UNIQUE (tenant_slug, provider, reference);


--
-- Name: payment_orders payment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_pkey PRIMARY KEY (id);


--
-- Name: payment_requests payment_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_pkey PRIMARY KEY (id);


--
-- Name: payment_requests payment_requests_tenant_slug_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_tenant_slug_reference_key UNIQUE (tenant_slug, reference);


--
-- Name: payment_term_lines payment_term_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_term_lines
    ADD CONSTRAINT payment_term_lines_pkey PRIMARY KEY (id);


--
-- Name: payment_terms payment_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_terms
    ADD CONSTRAINT payment_terms_pkey PRIMARY KEY (id);


--
-- Name: pegged_currencies pegged_currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pegged_currencies
    ADD CONSTRAINT pegged_currencies_pkey PRIMARY KEY (id);


--
-- Name: pegged_currencies pegged_currencies_tenant_slug_currency_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pegged_currencies
    ADD CONSTRAINT pegged_currencies_tenant_slug_currency_key UNIQUE (tenant_slug, currency);


--
-- Name: permissions permissions_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_key_key UNIQUE (key);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: plant_floors plant_floors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_floors
    ADD CONSTRAINT plant_floors_pkey PRIMARY KEY (id);


--
-- Name: plant_floors plant_floors_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plant_floors
    ADD CONSTRAINT plant_floors_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: portal_tokens portal_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_tokens
    ADD CONSTRAINT portal_tokens_pkey PRIMARY KEY (id);


--
-- Name: portal_tokens portal_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_tokens
    ADD CONSTRAINT portal_tokens_token_key UNIQUE (token);


--
-- Name: pos_audit_log pos_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_audit_log
    ADD CONSTRAINT pos_audit_log_pkey PRIMARY KEY (id);


--
-- Name: pos_cash_movements pos_cash_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_cash_movements
    ADD CONSTRAINT pos_cash_movements_pkey PRIMARY KEY (id);


--
-- Name: pos_counters pos_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_counters
    ADD CONSTRAINT pos_counters_pkey PRIMARY KEY (tenant_slug, counter_key);


--
-- Name: pos_held_sales pos_held_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_held_sales
    ADD CONSTRAINT pos_held_sales_pkey PRIMARY KEY (id);


--
-- Name: pos_loyalty_txns pos_loyalty_txns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_loyalty_txns
    ADD CONSTRAINT pos_loyalty_txns_pkey PRIMARY KEY (id);


--
-- Name: pos_price_list_items pos_price_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_price_list_items
    ADD CONSTRAINT pos_price_list_items_pkey PRIMARY KEY (id);


--
-- Name: pos_price_list_items pos_price_list_items_price_list_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_price_list_items
    ADD CONSTRAINT pos_price_list_items_price_list_id_sku_key UNIQUE (price_list_id, sku);


--
-- Name: pos_price_lists pos_price_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_price_lists
    ADD CONSTRAINT pos_price_lists_pkey PRIMARY KEY (id);


--
-- Name: pos_promotions pos_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_promotions
    ADD CONSTRAINT pos_promotions_pkey PRIMARY KEY (id);


--
-- Name: pos_promotions pos_promotions_tenant_slug_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_promotions
    ADD CONSTRAINT pos_promotions_tenant_slug_code_key UNIQUE (tenant_slug, code);


--
-- Name: pos_registers pos_registers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_registers
    ADD CONSTRAINT pos_registers_pkey PRIMARY KEY (id);


--
-- Name: pos_registers pos_registers_tenant_slug_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_registers
    ADD CONSTRAINT pos_registers_tenant_slug_code_key UNIQUE (tenant_slug, code);


--
-- Name: pos_returns pos_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_returns
    ADD CONSTRAINT pos_returns_pkey PRIMARY KEY (id);


--
-- Name: pos_sales pos_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_sales
    ADD CONSTRAINT pos_sales_pkey PRIMARY KEY (id);


--
-- Name: pos_shifts pos_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_shifts
    ADD CONSTRAINT pos_shifts_pkey PRIMARY KEY (id);


--
-- Name: pricing_plans pricing_plans_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plans
    ADD CONSTRAINT pricing_plans_key_key UNIQUE (key);


--
-- Name: pricing_plans pricing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plans
    ADD CONSTRAINT pricing_plans_pkey PRIMARY KEY (id);


--
-- Name: pricing_rules pricing_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_rules
    ADD CONSTRAINT pricing_rules_pkey PRIMARY KEY (id);


--
-- Name: print_formats print_formats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_formats
    ADD CONSTRAINT print_formats_pkey PRIMARY KEY (id);


--
-- Name: print_formats print_formats_tenant_slug_doc_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.print_formats
    ADD CONSTRAINT print_formats_tenant_slug_doc_type_name_key UNIQUE (tenant_slug, doc_type, name);


--
-- Name: process_run_logs process_run_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.process_run_logs
    ADD CONSTRAINT process_run_logs_pkey PRIMARY KEY (id);


--
-- Name: procurement_goods_receipts procurement_goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_goods_receipts
    ADD CONSTRAINT procurement_goods_receipts_pkey PRIMARY KEY (id);


--
-- Name: procurement_requisitions procurement_requisitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_requisitions
    ADD CONSTRAINT procurement_requisitions_pkey PRIMARY KEY (id);


--
-- Name: procurement_rfq_items procurement_rfq_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_rfq_items
    ADD CONSTRAINT procurement_rfq_items_pkey PRIMARY KEY (id);


--
-- Name: procurement_rfq_suppliers procurement_rfq_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_rfq_suppliers
    ADD CONSTRAINT procurement_rfq_suppliers_pkey PRIMARY KEY (id);


--
-- Name: procurement_rfq_suppliers procurement_rfq_suppliers_rfq_id_vendor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_rfq_suppliers
    ADD CONSTRAINT procurement_rfq_suppliers_rfq_id_vendor_id_key UNIQUE (rfq_id, vendor_id);


--
-- Name: procurement_rfqs procurement_rfqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_rfqs
    ADD CONSTRAINT procurement_rfqs_pkey PRIMARY KEY (id);


--
-- Name: procurement_supplier_quotation_items procurement_supplier_quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_supplier_quotation_items
    ADD CONSTRAINT procurement_supplier_quotation_items_pkey PRIMARY KEY (id);


--
-- Name: procurement_supplier_quotations procurement_supplier_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_supplier_quotations
    ADD CONSTRAINT procurement_supplier_quotations_pkey PRIMARY KEY (id);


--
-- Name: production_runs production_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_runs
    ADD CONSTRAINT production_runs_pkey PRIMARY KEY (id);


--
-- Name: production_runs production_runs_tenant_slug_run_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_runs
    ADD CONSTRAINT production_runs_tenant_slug_run_number_key UNIQUE (tenant_slug, run_number);


--
-- Name: project_updates project_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_updates
    ADD CONSTRAINT project_updates_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: projects projects_tenant_slug_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_tenant_slug_code_key UNIQUE (tenant_slug, code);


--
-- Name: promotional_schemes promotional_schemes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotional_schemes
    ADD CONSTRAINT promotional_schemes_pkey PRIMARY KEY (id);


--
-- Name: promotional_schemes promotional_schemes_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotional_schemes
    ADD CONSTRAINT promotional_schemes_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipt_items purchase_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipt_items
    ADD CONSTRAINT purchase_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_receipts purchase_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_receipts
    ADD CONSTRAINT purchase_receipts_pkey PRIMARY KEY (id);


--
-- Name: putaway_rules putaway_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.putaway_rules
    ADD CONSTRAINT putaway_rules_pkey PRIMARY KEY (id);


--
-- Name: quality_inspections quality_inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quality_inspections
    ADD CONSTRAINT quality_inspections_pkey PRIMARY KEY (id);


--
-- Name: reconciliation_items reconciliation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_items
    ADD CONSTRAINT reconciliation_items_pkey PRIMARY KEY (id);


--
-- Name: recurring_invoices recurring_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurring_invoices
    ADD CONSTRAINT recurring_invoices_pkey PRIMARY KEY (id);


--
-- Name: remote_day_requests remote_day_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remote_day_requests
    ADD CONSTRAINT remote_day_requests_pkey PRIMARY KEY (id);


--
-- Name: remote_day_requests remote_day_requests_tenant_slug_employee_id_work_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remote_day_requests
    ADD CONSTRAINT remote_day_requests_tenant_slug_employee_id_work_date_key UNIQUE (tenant_slug, employee_id, work_date);


--
-- Name: report_jobs report_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_jobs
    ADD CONSTRAINT report_jobs_pkey PRIMARY KEY (id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: revops_campaign_costs revops_campaign_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revops_campaign_costs
    ADD CONSTRAINT revops_campaign_costs_pkey PRIMARY KEY (id);


--
-- Name: revops_campaigns revops_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revops_campaigns
    ADD CONSTRAINT revops_campaigns_pkey PRIMARY KEY (id);


--
-- Name: revops_enablement_assets revops_enablement_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revops_enablement_assets
    ADD CONSTRAINT revops_enablement_assets_pkey PRIMARY KEY (id);


--
-- Name: revops_lead_sources revops_lead_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revops_lead_sources
    ADD CONSTRAINT revops_lead_sources_pkey PRIMARY KEY (id);


--
-- Name: revops_revenue_attributions revops_revenue_attributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revops_revenue_attributions
    ADD CONSTRAINT revops_revenue_attributions_pkey PRIMARY KEY (id);


--
-- Name: revops_revenue_forecasts revops_revenue_forecasts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revops_revenue_forecasts
    ADD CONSTRAINT revops_revenue_forecasts_pkey PRIMARY KEY (id);


--
-- Name: revops_sales_performance_snapshots revops_sales_performance_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revops_sales_performance_snapshots
    ADD CONSTRAINT revops_sales_performance_snapshots_pkey PRIMARY KEY (id);


--
-- Name: revops_sales_targets revops_sales_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revops_sales_targets
    ADD CONSTRAINT revops_sales_targets_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sales_order_items sales_order_items_order_id_line_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_order_id_line_no_key UNIQUE (order_id, line_no);


--
-- Name: sales_order_items sales_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_pkey PRIMARY KEY (id);


--
-- Name: sales_orders sales_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_orders
    ADD CONSTRAINT sales_orders_pkey PRIMARY KEY (id);


--
-- Name: sales_partner_commissions sales_partner_commissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_partner_commissions
    ADD CONSTRAINT sales_partner_commissions_pkey PRIMARY KEY (id);


--
-- Name: sales_partner_commissions sales_partner_commissions_tenant_slug_partner_id_invoice_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_partner_commissions
    ADD CONSTRAINT sales_partner_commissions_tenant_slug_partner_id_invoice_id_key UNIQUE (tenant_slug, partner_id, invoice_id);


--
-- Name: sales_partners sales_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_partners
    ADD CONSTRAINT sales_partners_pkey PRIMARY KEY (id);


--
-- Name: sales_partners sales_partners_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_partners
    ADD CONSTRAINT sales_partners_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: sales_quotation_items sales_quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_pkey PRIMARY KEY (id);


--
-- Name: sales_quotations sales_quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotations
    ADD CONSTRAINT sales_quotations_pkey PRIMARY KEY (id);


--
-- Name: saved_reports saved_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_reports
    ADD CONSTRAINT saved_reports_pkey PRIMARY KEY (id);


--
-- Name: saved_reports saved_reports_tenant_slug_name_report_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_reports
    ADD CONSTRAINT saved_reports_tenant_slug_name_report_key_key UNIQUE (tenant_slug, name, report_key);


--
-- Name: schema_migrations schema_migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_filename_key UNIQUE (filename);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: share_transfers share_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_pkey PRIMARY KEY (id);


--
-- Name: share_types share_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_types
    ADD CONSTRAINT share_types_pkey PRIMARY KEY (id);


--
-- Name: share_types share_types_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_types
    ADD CONSTRAINT share_types_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: shareholders shareholders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_pkey PRIMARY KEY (id);


--
-- Name: shareholders shareholders_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shareholders
    ADD CONSTRAINT shareholders_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: shipping_rules shipping_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rules
    ADD CONSTRAINT shipping_rules_pkey PRIMARY KEY (id);


--
-- Name: shipping_rules shipping_rules_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shipping_rules
    ADD CONSTRAINT shipping_rules_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: sla_policies sla_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_pkey PRIMARY KEY (id);


--
-- Name: sla_policies sla_policies_unique_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sla_policies
    ADD CONSTRAINT sla_policies_unique_name UNIQUE (tenant_slug, name);


--
-- Name: sms_messages sms_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sms_messages
    ADD CONSTRAINT sms_messages_pkey PRIMARY KEY (id);


--
-- Name: staff_advance_applications staff_advance_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_advance_applications
    ADD CONSTRAINT staff_advance_applications_pkey PRIMARY KEY (id);


--
-- Name: staff_advances staff_advances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_advances
    ADD CONSTRAINT staff_advances_pkey PRIMARY KEY (id);


--
-- Name: staffing_plans staffing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staffing_plans
    ADD CONSTRAINT staffing_plans_pkey PRIMARY KEY (id);


--
-- Name: statement_runs statement_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statement_runs
    ADD CONSTRAINT statement_runs_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: storefront_orders storefront_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.storefront_orders
    ADD CONSTRAINT storefront_orders_pkey PRIMARY KEY (id);


--
-- Name: subcontract_material_movements subcontract_material_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontract_material_movements
    ADD CONSTRAINT subcontract_material_movements_pkey PRIMARY KEY (id);


--
-- Name: subcontract_materials subcontract_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontract_materials
    ADD CONSTRAINT subcontract_materials_pkey PRIMARY KEY (id);


--
-- Name: subcontract_orders subcontract_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontract_orders
    ADD CONSTRAINT subcontract_orders_pkey PRIMARY KEY (id);


--
-- Name: subcontract_orders subcontract_orders_tenant_slug_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontract_orders
    ADD CONSTRAINT subcontract_orders_tenant_slug_order_number_key UNIQUE (tenant_slug, order_number);


--
-- Name: subscription_invoices subscription_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_pkey PRIMARY KEY (id);


--
-- Name: subscription_invoices subscription_invoices_subscription_id_period_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_subscription_id_period_start_key UNIQUE (subscription_id, period_start);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: superadmins superadmins_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superadmins
    ADD CONSTRAINT superadmins_email_key UNIQUE (email);


--
-- Name: superadmins superadmins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.superadmins
    ADD CONSTRAINT superadmins_pkey PRIMARY KEY (id);


--
-- Name: support_incidents support_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_incidents
    ADD CONSTRAINT support_incidents_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_unique_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_unique_number UNIQUE (tenant_slug, ticket_number);


--
-- Name: support_warranty_claims support_warranty_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_warranty_claims
    ADD CONSTRAINT support_warranty_claims_pkey PRIMARY KEY (id);


--
-- Name: support_warranty_claims support_warranty_claims_tenant_slug_claim_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_warranty_claims
    ADD CONSTRAINT support_warranty_claims_tenant_slug_claim_number_key UNIQUE (tenant_slug, claim_number);


--
-- Name: task_assignments task_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_pkey PRIMARY KEY (id);


--
-- Name: task_types task_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_types
    ADD CONSTRAINT task_types_pkey PRIMARY KEY (id);


--
-- Name: task_types task_types_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_types
    ADD CONSTRAINT task_types_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_workstream_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_workstream_id_code_key UNIQUE (workstream_id, code);


--
-- Name: tax_pack_applications tax_pack_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_pack_applications
    ADD CONSTRAINT tax_pack_applications_pkey PRIMARY KEY (id);


--
-- Name: tax_pack_applications tax_pack_applications_tenant_slug_pack_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_pack_applications
    ADD CONSTRAINT tax_pack_applications_tenant_slug_pack_code_key UNIQUE (tenant_slug, pack_code);


--
-- Name: tax_rates tax_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rates
    ADD CONSTRAINT tax_rates_pkey PRIMARY KEY (id);


--
-- Name: tax_returns tax_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_returns
    ADD CONSTRAINT tax_returns_pkey PRIMARY KEY (id);


--
-- Name: tax_rules tax_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT tax_rules_pkey PRIMARY KEY (id);


--
-- Name: tax_templates tax_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_templates
    ADD CONSTRAINT tax_templates_pkey PRIMARY KEY (id);


--
-- Name: tax_templates tax_templates_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_templates
    ADD CONSTRAINT tax_templates_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: tax_transactions tax_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_transactions
    ADD CONSTRAINT tax_transactions_pkey PRIMARY KEY (id);


--
-- Name: tax_withholding_categories tax_withholding_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_withholding_categories
    ADD CONSTRAINT tax_withholding_categories_pkey PRIMARY KEY (id);


--
-- Name: tax_withholding_categories tax_withholding_categories_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_withholding_categories
    ADD CONSTRAINT tax_withholding_categories_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: tax_withholding_entries tax_withholding_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_withholding_entries
    ADD CONSTRAINT tax_withholding_entries_pkey PRIMARY KEY (id);


--
-- Name: tenant_access_restrictions tenant_access_restrictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_access_restrictions
    ADD CONSTRAINT tenant_access_restrictions_pkey PRIMARY KEY (id);


--
-- Name: tenant_access_restrictions tenant_access_restrictions_tenant_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_access_restrictions
    ADD CONSTRAINT tenant_access_restrictions_tenant_slug_key UNIQUE (tenant_slug);


--
-- Name: tenant_admin_password_reset_tokens tenant_admin_password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_admin_password_reset_tokens
    ADD CONSTRAINT tenant_admin_password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: tenant_admins tenant_admins_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_admins
    ADD CONSTRAINT tenant_admins_email_key UNIQUE (email);


--
-- Name: tenant_admins tenant_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_admins
    ADD CONSTRAINT tenant_admins_pkey PRIMARY KEY (id);


--
-- Name: tenant_branches tenant_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_branches
    ADD CONSTRAINT tenant_branches_pkey PRIMARY KEY (id);


--
-- Name: tenant_branches tenant_branches_tenant_slug_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_branches
    ADD CONSTRAINT tenant_branches_tenant_slug_code_key UNIQUE (tenant_slug, code);


--
-- Name: tenant_onboarding_state tenant_onboarding_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_onboarding_state
    ADD CONSTRAINT tenant_onboarding_state_pkey PRIMARY KEY (tenant_slug);


--
-- Name: tenant_org_structures tenant_org_structures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_org_structures
    ADD CONSTRAINT tenant_org_structures_pkey PRIMARY KEY (slug);


--
-- Name: tenant_performance_reviews tenant_performance_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_performance_reviews
    ADD CONSTRAINT tenant_performance_reviews_pkey PRIMARY KEY (id);


--
-- Name: tenant_security_settings tenant_security_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_security_settings
    ADD CONSTRAINT tenant_security_settings_pkey PRIMARY KEY (tenant_slug);


--
-- Name: tenant_usage_daily tenant_usage_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_usage_daily
    ADD CONSTRAINT tenant_usage_daily_pkey PRIMARY KEY (tenant_slug, usage_date, metric);


--
-- Name: tenant_user_branches tenant_user_branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_branches
    ADD CONSTRAINT tenant_user_branches_pkey PRIMARY KEY (id);


--
-- Name: tenant_user_branches tenant_user_branches_tenant_slug_user_id_branch_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_branches
    ADD CONSTRAINT tenant_user_branches_tenant_slug_user_id_branch_id_key UNIQUE (tenant_slug, user_id, branch_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: ticket_activity_logs ticket_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_activity_logs
    ADD CONSTRAINT ticket_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: ticket_comments ticket_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_pkey PRIMARY KEY (id);


--
-- Name: time_logs time_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_pkey PRIMARY KEY (id);


--
-- Name: training_events training_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_events
    ADD CONSTRAINT training_events_pkey PRIMARY KEY (id);


--
-- Name: training_programs training_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_pkey PRIMARY KEY (id);


--
-- Name: training_programs training_programs_tenant_slug_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_programs
    ADD CONSTRAINT training_programs_tenant_slug_name_key UNIQUE (tenant_slug, name);


--
-- Name: transaction_deletion_records transaction_deletion_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction_deletion_records
    ADD CONSTRAINT transaction_deletion_records_pkey PRIMARY KEY (id);


--
-- Name: bom_headers unique_bom; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_headers
    ADD CONSTRAINT unique_bom UNIQUE (tenant_slug, product_sku, revision);


--
-- Name: budget_approvals unique_budget_approval; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_approvals
    ADD CONSTRAINT unique_budget_approval UNIQUE (budget_id, approval_sequence);


--
-- Name: budgets unique_budget_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT unique_budget_code UNIQUE (tenant_slug, code);


--
-- Name: budget_lines unique_budget_line; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT unique_budget_line UNIQUE (budget_id, line_number);


--
-- Name: budget_versions unique_budget_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_versions
    ADD CONSTRAINT unique_budget_version UNIQUE (budget_id, version_number);


--
-- Name: admin_employees unique_employee_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_employees
    ADD CONSTRAINT unique_employee_email UNIQUE (tenant_slug, email);


--
-- Name: admin_user_roles uq_user_role; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user_roles
    ADD CONSTRAINT uq_user_role UNIQUE (user_id, role_id);


--
-- Name: user_notification_preferences user_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_preferences
    ADD CONSTRAINT user_notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_balances vendor_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_balances
    ADD CONSTRAINT vendor_balances_pkey PRIMARY KEY (vendor_id);


--
-- Name: vendor_contacts vendor_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_contacts
    ADD CONSTRAINT vendor_contacts_pkey PRIMARY KEY (id);


--
-- Name: vendor_payment_applications vendor_payment_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payment_applications
    ADD CONSTRAINT vendor_payment_applications_pkey PRIMARY KEY (id);


--
-- Name: vendor_payments vendor_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payments
    ADD CONSTRAINT vendor_payments_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: web_form_submissions web_form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_form_submissions
    ADD CONSTRAINT web_form_submissions_pkey PRIMARY KEY (id);


--
-- Name: web_forms web_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_forms
    ADD CONSTRAINT web_forms_pkey PRIMARY KEY (id);


--
-- Name: web_forms web_forms_tenant_slug_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_forms
    ADD CONSTRAINT web_forms_tenant_slug_slug_key UNIQUE (tenant_slug, slug);


--
-- Name: webhook_deliveries webhook_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_pkey PRIMARY KEY (id);


--
-- Name: webhook_subscriptions webhook_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_subscriptions
    ADD CONSTRAINT webhook_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: work_order_materials work_order_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_materials
    ADD CONSTRAINT work_order_materials_pkey PRIMARY KEY (id);


--
-- Name: work_order_operations work_order_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_operations
    ADD CONSTRAINT work_order_operations_pkey PRIMARY KEY (id);


--
-- Name: work_orders work_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_orders
    ADD CONSTRAINT work_orders_pkey PRIMARY KEY (id);


--
-- Name: workflow_definitions workflow_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_pkey PRIMARY KEY (id);


--
-- Name: workflow_definitions workflow_definitions_tenant_slug_doc_type_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_tenant_slug_doc_type_name_key UNIQUE (tenant_slug, doc_type, name);


--
-- Name: workstreams workstreams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workstreams
    ADD CONSTRAINT workstreams_pkey PRIMARY KEY (id);


--
-- Name: workstreams workstreams_project_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workstreams
    ADD CONSTRAINT workstreams_project_id_code_key UNIQUE (project_id, code);


--
-- Name: account_balances_account_period_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX account_balances_account_period_uq ON public.account_balances USING btree (account_id, fiscal_period_id);


--
-- Name: admin_password_reset_tokens_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_password_reset_tokens_tenant_idx ON public.admin_password_reset_tokens USING btree (tenant_slug);


--
-- Name: admin_password_reset_tokens_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_password_reset_tokens_token_idx ON public.admin_password_reset_tokens USING btree (token);


--
-- Name: advance_taxes_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX advance_taxes_payment_idx ON public.advance_taxes USING btree (payment_id);


--
-- Name: ai_conversations_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_conversations_tenant_idx ON public.ai_conversations USING btree (tenant_slug);


--
-- Name: ai_usage_log_capability_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_log_capability_idx ON public.ai_usage_log USING btree (capability);


--
-- Name: ai_usage_log_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_log_created_idx ON public.ai_usage_log USING btree (created_at);


--
-- Name: ai_usage_log_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_log_tenant_idx ON public.ai_usage_log USING btree (tenant_slug);


--
-- Name: app_notifications_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_notifications_user_idx ON public.app_notifications USING btree (tenant_slug, user_id, read_at, created_at DESC);


--
-- Name: approval_delegates_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_delegates_lookup_idx ON public.approval_delegates USING btree (tenant_slug, delegate_id, delegator_id);


--
-- Name: approval_rules_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_rules_active_idx ON public.approval_rules USING btree (is_active);


--
-- Name: approval_rules_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_rules_entity_idx ON public.approval_rules USING btree (entity_type);


--
-- Name: approval_rules_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approval_rules_tenant_idx ON public.approval_rules USING btree (tenant_slug);


--
-- Name: approvals_entity_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approvals_entity_lookup_idx ON public.approvals USING btree (tenant_slug, entity_type, entity_id, status);


--
-- Name: approvals_rule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approvals_rule_idx ON public.approvals USING btree (rule_id);


--
-- Name: approvals_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approvals_status_idx ON public.approvals USING btree (status);


--
-- Name: approvals_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX approvals_tenant_idx ON public.approvals USING btree (tenant_slug);


--
-- Name: asset_activity_logs_asset_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_activity_logs_asset_idx ON public.asset_activity_logs USING btree (tenant_slug, asset_id);


--
-- Name: asset_maint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_maint_idx ON public.asset_maintenance USING btree (tenant_slug, asset_id, status);


--
-- Name: asset_move_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_move_idx ON public.asset_movements USING btree (tenant_slug, asset_id);


--
-- Name: asset_usage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_usage_idx ON public.asset_usage_log USING btree (tenant_slug, asset_id);


--
-- Name: automation_action_queue_rule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_action_queue_rule_idx ON public.automation_action_queue USING btree (rule_id);


--
-- Name: automation_action_queue_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_action_queue_status_idx ON public.automation_action_queue USING btree (status);


--
-- Name: automation_action_queue_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_action_queue_tenant_idx ON public.automation_action_queue USING btree (tenant_slug);


--
-- Name: automation_rule_audits_rule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_rule_audits_rule_idx ON public.automation_rule_audits USING btree (rule_id);


--
-- Name: automation_rule_audits_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_rule_audits_tenant_idx ON public.automation_rule_audits USING btree (tenant_slug);


--
-- Name: automation_rules_event_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_rules_event_idx ON public.automation_rules USING btree (event_type);


--
-- Name: automation_rules_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_rules_tenant_idx ON public.automation_rules USING btree (tenant_slug);


--
-- Name: bank_recon_rules_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bank_recon_rules_idx ON public.bank_recon_rules USING btree (tenant_slug, priority);


--
-- Name: bank_recon_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bank_recon_tenant_idx ON public.bank_reconciliations USING btree (tenant_slug);


--
-- Name: bank_stmt_lines_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bank_stmt_lines_idx ON public.bank_statement_lines USING btree (tenant_slug, bank_account_code, line_date);


--
-- Name: bank_stmt_lines_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bank_stmt_lines_status_idx ON public.bank_statement_lines USING btree (tenant_slug, status);


--
-- Name: bill_items_bill_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bill_items_bill_idx ON public.bill_items USING btree (bill_id);


--
-- Name: bill_sched_bill_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bill_sched_bill_idx ON public.bill_payment_schedule USING btree (tenant_slug, bill_id);


--
-- Name: bill_tenant_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bill_tenant_number_uq ON public.bills USING btree (tenant_slug, bill_number);


--
-- Name: bills_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bills_status_idx ON public.bills USING btree (status);


--
-- Name: bills_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bills_tenant_idx ON public.bills USING btree (tenant_slug);


--
-- Name: bills_vendor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bills_vendor_idx ON public.bills USING btree (vendor_id);


--
-- Name: bom_headers_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bom_headers_product_idx ON public.bom_headers USING btree (tenant_slug, product_sku);


--
-- Name: bom_headers_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bom_headers_tenant_idx ON public.bom_headers USING btree (tenant_slug, status);


--
-- Name: bom_lines_bom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bom_lines_bom_idx ON public.bom_lines USING btree (bom_id);


--
-- Name: bom_lines_component_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bom_lines_component_idx ON public.bom_lines USING btree (component_sku);


--
-- Name: bundle_items_bundle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bundle_items_bundle_idx ON public.inventory_product_bundle_items USING btree (bundle_id);


--
-- Name: campaign_emails_campaign_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_emails_campaign_idx ON public.crm_campaign_emails USING btree (campaign_id);


--
-- Name: campaign_enroll_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campaign_enroll_due_idx ON public.crm_campaign_enrollments USING btree (tenant_slug, status, next_send_at);


--
-- Name: chart_of_accounts_code_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chart_of_accounts_code_uq ON public.chart_of_accounts USING btree (code);


--
-- Name: chart_of_accounts_tenant_code_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX chart_of_accounts_tenant_code_uq ON public.chart_of_accounts USING btree (COALESCE(tenant_slug, ''::text), COALESCE(code, account_code));


--
-- Name: coa_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coa_tenant_idx ON public.chart_of_accounts USING btree (tenant_slug);


--
-- Name: crm_activities_related_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_activities_related_idx ON public.crm_activities USING btree (tenant_slug, related_to, related_id);


--
-- Name: crm_activities_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_activities_tenant_idx ON public.crm_activities USING btree (tenant_slug);


--
-- Name: crm_appointments_when_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_appointments_when_idx ON public.crm_appointments USING btree (tenant_slug, scheduled_at);


--
-- Name: crm_contracts_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_contracts_tenant_idx ON public.crm_contracts USING btree (tenant_slug, status);


--
-- Name: crm_notes_party_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_notes_party_idx ON public.crm_notes USING btree (tenant_slug, party_type, party_id);


--
-- Name: crm_prospects_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX crm_prospects_tenant_idx ON public.crm_prospects USING btree (tenant_slug, status);


--
-- Name: deferred_items_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deferred_items_idx ON public.deferred_items USING btree (tenant_slug, status, service_end_date);


--
-- Name: deferred_sched_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deferred_sched_idx ON public.deferred_schedule USING btree (tenant_slug, status, period_date);


--
-- Name: delivery_notes_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_notes_tenant_idx ON public.delivery_notes USING btree (tenant_slug, status);


--
-- Name: dni_note_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dni_note_idx ON public.delivery_note_items USING btree (note_id);


--
-- Name: domain_events_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX domain_events_tenant_idx ON public.domain_events USING btree (tenant_slug, event_type, created_at DESC);


--
-- Name: downtime_entries_ws_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX downtime_entries_ws_idx ON public.downtime_entries USING btree (tenant_slug, workstation_id);


--
-- Name: due_sched_doc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX due_sched_doc_idx ON public.document_due_schedule USING btree (tenant_slug, document_type, document_id);


--
-- Name: dunning_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dunning_invoice_idx ON public.dunning_notices USING btree (tenant_slug, invoice_id, level);


--
-- Name: einvoice_submissions_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX einvoice_submissions_invoice_idx ON public.einvoice_submissions USING btree (tenant_slug, invoice_id);


--
-- Name: energy_point_logs_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX energy_point_logs_user_idx ON public.energy_point_logs USING btree (tenant_slug, user_id);


--
-- Name: expense_approvals_expense_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expense_approvals_expense_idx ON public.expense_approvals USING btree (expense_id);


--
-- Name: expense_audit_logs_expense_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expense_audit_logs_expense_idx ON public.expense_audit_logs USING btree (expense_id);


--
-- Name: expense_receipts_expense_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expense_receipts_expense_idx ON public.expense_receipts USING btree (expense_id);


--
-- Name: expenses_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_category_idx ON public.expenses USING btree (category_id, approval_status);


--
-- Name: expenses_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_date_idx ON public.expenses USING btree (date);


--
-- Name: expenses_department_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_department_idx ON public.expenses USING btree (tenant_slug, department_id);


--
-- Name: expenses_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expenses_tenant_idx ON public.expenses USING btree (tenant_slug, approval_status);


--
-- Name: fad_asset_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fad_asset_idx ON public.asset_depreciation_schedule USING btree (tenant_slug, asset_id, period_date);


--
-- Name: finance_accounts_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_accounts_tenant_idx ON public.finance_accounts USING btree (tenant_slug);


--
-- Name: finance_customers_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_customers_name_idx ON public.finance_customers USING btree (tenant_slug, name);


--
-- Name: finance_expense_categories_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_expense_categories_tenant_idx ON public.finance_expense_categories USING btree (tenant_slug);


--
-- Name: finance_invoice_lines_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_invoice_lines_invoice_idx ON public.finance_invoice_lines USING btree (invoice_id);


--
-- Name: finance_invoices_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_invoices_tenant_idx ON public.finance_invoices USING btree (tenant_slug, status);


--
-- Name: finance_payments_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_payments_invoice_idx ON public.finance_payments USING btree (invoice_id);


--
-- Name: finance_payments_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_payments_tenant_idx ON public.finance_payments USING btree (tenant_slug, status);


--
-- Name: finance_posting_settings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_posting_settings_tenant ON public.finance_posting_settings USING btree (tenant_slug);


--
-- Name: finance_returns_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_returns_source_idx ON public.finance_returns USING btree (tenant_slug, source_document_id);


--
-- Name: finance_returns_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_returns_tenant_idx ON public.finance_returns USING btree (tenant_slug, direction, created_at);


--
-- Name: finance_schedules_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_schedules_tenant_idx ON public.finance_schedules USING btree (tenant_slug, document_type);


--
-- Name: finance_subscriptions_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_subscriptions_tenant_idx ON public.finance_subscriptions USING btree (tenant_slug, status);


--
-- Name: finance_trend_points_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX finance_trend_points_tenant_idx ON public.finance_trend_points USING btree (tenant_slug, timeframe);


--
-- Name: fiscal_periods_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fiscal_periods_status_idx ON public.fiscal_periods USING btree (tenant_slug, status);


--
-- Name: fiscal_periods_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fiscal_periods_tenant_idx ON public.fiscal_periods USING btree (tenant_slug, fiscal_year);


--
-- Name: fixed_assets_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fixed_assets_tenant_idx ON public.fixed_assets USING btree (tenant_slug, status);


--
-- Name: hr_checkins_emp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_checkins_emp_idx ON public.hr_employee_checkins USING btree (tenant_slug, employee_id, "timestamp");


--
-- Name: hr_checkins_unprocessed_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_checkins_unprocessed_idx ON public.hr_employee_checkins USING btree (tenant_slug, "timestamp") WHERE (NOT skip_auto_attendance);


--
-- Name: hr_lifecycle_emp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_lifecycle_emp_idx ON public.hr_employee_lifecycle USING btree (tenant_slug, employee_id);


--
-- Name: idx_account_balances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_balances_tenant ON public.account_balances USING btree (tenant_slug);


--
-- Name: idx_accounting_audit_log_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounting_audit_log_tenant ON public.accounting_audit_log USING btree (tenant_slug);


--
-- Name: idx_activity_costs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_costs_tenant ON public.activity_costs USING btree (tenant_slug);


--
-- Name: idx_admin_access_controls_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_access_controls_role ON public.admin_access_controls USING btree (role_id);


--
-- Name: idx_admin_access_controls_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_access_controls_tenant ON public.admin_access_controls USING btree (tenant_slug);


--
-- Name: idx_admin_announcements_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_announcements_tenant ON public.admin_announcements USING btree (tenant_slug, is_active, created_at DESC);


--
-- Name: idx_admin_api_keys_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_api_keys_key ON public.admin_api_keys USING btree (key);


--
-- Name: idx_admin_api_keys_key_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_api_keys_key_hash ON public.admin_api_keys USING btree (key_hash);


--
-- Name: idx_admin_api_keys_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_api_keys_tenant ON public.admin_api_keys USING btree (tenant_slug);


--
-- Name: idx_admin_appraisals_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_appraisals_dept ON public.admin_employee_appraisals USING btree (tenant_slug, department_id);


--
-- Name: idx_admin_appraisals_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_appraisals_emp ON public.admin_employee_appraisals USING btree (tenant_slug, employee_id, created_at DESC);


--
-- Name: idx_admin_appraisals_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_appraisals_period ON public.admin_employee_appraisals USING btree (tenant_slug, employee_id, period);


--
-- Name: idx_admin_appraisals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_appraisals_tenant ON public.admin_employee_appraisals USING btree (tenant_slug);


--
-- Name: idx_admin_approval_flows_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_approval_flows_tenant ON public.admin_approval_flows USING btree (tenant_slug);


--
-- Name: idx_admin_approval_flows_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_approval_flows_type ON public.admin_approval_flows USING btree (type);


--
-- Name: idx_admin_approval_requests_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_approval_requests_requester ON public.admin_approval_requests USING btree (requester_id);


--
-- Name: idx_admin_approval_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_approval_requests_status ON public.admin_approval_requests USING btree (status);


--
-- Name: idx_admin_approval_requests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_approval_requests_tenant ON public.admin_approval_requests USING btree (tenant_slug);


--
-- Name: idx_admin_approval_routes_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_approval_routes_tenant ON public.admin_approval_routes USING btree (tenant_slug);


--
-- Name: idx_admin_apps_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_apps_candidate ON public.admin_applications USING btree (candidate_id);


--
-- Name: idx_admin_apps_req; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_apps_req ON public.admin_applications USING btree (requisition_id);


--
-- Name: idx_admin_apps_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_apps_status ON public.admin_applications USING btree (status);


--
-- Name: idx_admin_apps_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_apps_tenant ON public.admin_applications USING btree (tenant_slug);


--
-- Name: idx_admin_audit_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_logs_created ON public.admin_audit_logs USING btree (created_at DESC);


--
-- Name: idx_admin_audit_logs_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_logs_resource ON public.admin_audit_logs USING btree (resource, resource_id);


--
-- Name: idx_admin_audit_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_logs_tenant ON public.admin_audit_logs USING btree (tenant_slug);


--
-- Name: idx_admin_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_audit_logs_user ON public.admin_audit_logs USING btree (user_id);


--
-- Name: idx_admin_candidates_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_candidates_stage ON public.admin_candidates USING btree (current_stage);


--
-- Name: idx_admin_candidates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_candidates_tenant ON public.admin_candidates USING btree (tenant_slug);


--
-- Name: idx_admin_departments_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_departments_parent ON public.admin_departments USING btree (parent_department_id);


--
-- Name: idx_admin_departments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_departments_tenant ON public.admin_departments USING btree (tenant_slug);


--
-- Name: idx_admin_emp_components_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_emp_components_emp ON public.admin_employee_components USING btree (tenant_slug, employee_id);


--
-- Name: idx_admin_emp_components_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_emp_components_tenant ON public.admin_employee_components USING btree (tenant_slug);


--
-- Name: idx_admin_employees_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_employees_dept ON public.admin_employees USING btree (department_id);


--
-- Name: idx_admin_employees_manager; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_employees_manager ON public.admin_employees USING btree (reporting_manager_id);


--
-- Name: idx_admin_employees_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_employees_tenant ON public.admin_employees USING btree (tenant_slug);


--
-- Name: idx_admin_goals_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_goals_emp ON public.admin_employee_goals USING btree (tenant_slug, employee_id, status);


--
-- Name: idx_admin_goals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_goals_tenant ON public.admin_employee_goals USING btree (tenant_slug);


--
-- Name: idx_admin_holidays_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_holidays_tenant ON public.admin_holidays USING btree (tenant_slug, holiday_date);


--
-- Name: idx_admin_integrations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_integrations_status ON public.admin_integrations USING btree (status);


--
-- Name: idx_admin_integrations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_integrations_tenant ON public.admin_integrations USING btree (tenant_slug);


--
-- Name: idx_admin_interviews_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_interviews_app ON public.admin_interviews USING btree (application_id);


--
-- Name: idx_admin_interviews_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_interviews_tenant ON public.admin_interviews USING btree (tenant_slug);


--
-- Name: idx_admin_leave_bal_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_leave_bal_emp ON public.admin_leave_balances USING btree (tenant_slug, employee_id);


--
-- Name: idx_admin_leave_bal_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_leave_bal_tenant ON public.admin_leave_balances USING btree (tenant_slug);


--
-- Name: idx_admin_leave_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_leave_emp ON public.admin_leave USING btree (employee_id);


--
-- Name: idx_admin_leave_pol_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_leave_pol_tenant ON public.admin_leave_policies USING btree (tenant_slug, leave_type, is_active);


--
-- Name: idx_admin_leave_requests_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_leave_requests_emp ON public.admin_leave_requests USING btree (tenant_slug, employee_id);


--
-- Name: idx_admin_leave_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_leave_requests_status ON public.admin_leave_requests USING btree (status);


--
-- Name: idx_admin_leave_requests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_leave_requests_tenant ON public.admin_leave_requests USING btree (tenant_slug);


--
-- Name: idx_admin_leave_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_leave_status ON public.admin_leave USING btree (status);


--
-- Name: idx_admin_leave_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_leave_tenant ON public.admin_leave USING btree (tenant_slug);


--
-- Name: idx_admin_modules_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_modules_enabled ON public.admin_modules USING btree (enabled);


--
-- Name: idx_admin_modules_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_modules_tenant ON public.admin_modules USING btree (tenant_slug);


--
-- Name: idx_admin_notifications_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notifications_created ON public.admin_notifications USING btree (created_at DESC);


--
-- Name: idx_admin_notifications_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_notifications_emp ON public.admin_notifications USING btree (tenant_slug, employee_id, is_read);


--
-- Name: idx_admin_offboarding_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_offboarding_tenant ON public.admin_offboarding USING btree (tenant_slug);


--
-- Name: idx_admin_offers_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_offers_app ON public.admin_offers USING btree (application_id);


--
-- Name: idx_admin_offers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_offers_tenant ON public.admin_offers USING btree (tenant_slug);


--
-- Name: idx_admin_onboarding_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_onboarding_emp ON public.admin_onboarding_tasks USING btree (employee_id);


--
-- Name: idx_admin_onboarding_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_onboarding_tenant ON public.admin_onboarding_tasks USING btree (tenant_slug);


--
-- Name: idx_admin_payroll_adjustments_emp_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_payroll_adjustments_emp_period ON public.admin_payroll_adjustments USING btree (tenant_slug, employee_id, effective_period);


--
-- Name: idx_admin_payroll_adjustments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_payroll_adjustments_status ON public.admin_payroll_adjustments USING btree (status);


--
-- Name: idx_admin_payroll_adjustments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_payroll_adjustments_tenant ON public.admin_payroll_adjustments USING btree (tenant_slug);


--
-- Name: idx_admin_payroll_entries_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_payroll_entries_emp ON public.admin_payroll_entries USING btree (tenant_slug, employee_id);


--
-- Name: idx_admin_payroll_entries_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_payroll_entries_run ON public.admin_payroll_entries USING btree (run_id);


--
-- Name: idx_admin_payroll_runs_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_payroll_runs_period ON public.admin_payroll_runs USING btree (tenant_slug, period);


--
-- Name: idx_admin_payroll_runs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_payroll_runs_tenant ON public.admin_payroll_runs USING btree (tenant_slug);


--
-- Name: idx_admin_payroll_runs_tenant_period_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_admin_payroll_runs_tenant_period_active ON public.admin_payroll_runs USING btree (tenant_slug, period) WHERE (status <> 'cancelled'::text);


--
-- Name: idx_admin_peer_feedback_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_peer_feedback_emp ON public.admin_peer_feedback USING btree (tenant_slug, employee_id, created_at DESC);


--
-- Name: idx_admin_peer_feedback_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_peer_feedback_reviewer ON public.admin_peer_feedback USING btree (tenant_slug, reviewer_id);


--
-- Name: idx_admin_reqs_dept; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_reqs_dept ON public.admin_job_requisitions USING btree (department_id);


--
-- Name: idx_admin_reqs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_reqs_status ON public.admin_job_requisitions USING btree (status);


--
-- Name: idx_admin_reqs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_reqs_tenant ON public.admin_job_requisitions USING btree (tenant_slug);


--
-- Name: idx_admin_review_cycles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_review_cycles_tenant ON public.admin_review_cycles USING btree (tenant_slug);


--
-- Name: idx_admin_role_history_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_role_history_tenant ON public.admin_role_history USING btree (tenant_slug);


--
-- Name: idx_admin_role_history_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_role_history_user ON public.admin_role_history USING btree (user_id);


--
-- Name: idx_admin_roles_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_roles_name ON public.admin_roles USING btree (name);


--
-- Name: idx_admin_roles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_roles_tenant ON public.admin_roles USING btree (tenant_slug);


--
-- Name: idx_admin_screening_cfg_req; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_screening_cfg_req ON public.admin_requisition_screening_configs USING btree (requisition_id);


--
-- Name: idx_admin_screening_cfg_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_screening_cfg_tenant ON public.admin_requisition_screening_configs USING btree (tenant_slug);


--
-- Name: idx_admin_screening_hist_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_screening_hist_app ON public.admin_screening_history USING btree (application_id);


--
-- Name: idx_admin_screening_hist_req; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_screening_hist_req ON public.admin_screening_history USING btree (requisition_id);


--
-- Name: idx_admin_screening_hist_run; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_screening_hist_run ON public.admin_screening_history USING btree (run_id);


--
-- Name: idx_admin_screening_hist_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_screening_hist_tenant ON public.admin_screening_history USING btree (tenant_slug);


--
-- Name: idx_admin_security_policies_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_security_policies_tenant ON public.admin_security_policies USING btree (tenant_slug);


--
-- Name: idx_admin_shift_assign_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_shift_assign_emp ON public.admin_shift_assignments USING btree (tenant_slug, employee_id);


--
-- Name: idx_admin_shift_assign_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_shift_assign_tenant ON public.admin_shift_assignments USING btree (tenant_slug);


--
-- Name: idx_admin_shifts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_shifts_tenant ON public.admin_shifts USING btree (tenant_slug);


--
-- Name: idx_admin_staff_report_templates_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_report_templates_tenant ON public.admin_staff_report_templates USING btree (tenant_slug);


--
-- Name: idx_admin_staff_report_templates_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_report_templates_type ON public.admin_staff_report_templates USING btree (tenant_slug, report_type);


--
-- Name: idx_admin_staff_reports_approver; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_reports_approver ON public.admin_staff_reports USING btree (tenant_slug, approver_role, approver_id);


--
-- Name: idx_admin_staff_reports_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_reports_emp ON public.admin_staff_reports USING btree (tenant_slug, employee_id);


--
-- Name: idx_admin_staff_reports_hod; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_reports_hod ON public.admin_staff_reports USING btree (tenant_slug, head_of_department);


--
-- Name: idx_admin_staff_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_reports_status ON public.admin_staff_reports USING btree (status);


--
-- Name: idx_admin_staff_reports_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_reports_tenant ON public.admin_staff_reports USING btree (tenant_slug);


--
-- Name: idx_admin_staff_tasks_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_tasks_due ON public.admin_staff_tasks USING btree (tenant_slug, due_date);


--
-- Name: idx_admin_staff_tasks_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_tasks_emp ON public.admin_staff_tasks USING btree (tenant_slug, employee_id);


--
-- Name: idx_admin_staff_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_tasks_status ON public.admin_staff_tasks USING btree (status);


--
-- Name: idx_admin_staff_tasks_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_staff_tasks_tenant ON public.admin_staff_tasks USING btree (tenant_slug);


--
-- Name: idx_admin_temp_access_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_temp_access_expires ON public.admin_temporary_access USING btree (expires_at);


--
-- Name: idx_admin_temp_access_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_temp_access_tenant ON public.admin_temporary_access USING btree (tenant_slug);


--
-- Name: idx_admin_temp_access_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_temp_access_user ON public.admin_temporary_access USING btree (granted_to);


--
-- Name: idx_admin_user_roles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_user_roles_tenant ON public.admin_user_roles USING btree (tenant_slug);


--
-- Name: idx_admin_user_roles_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_user_roles_user ON public.admin_user_roles USING btree (user_id);


--
-- Name: idx_admin_user_roles_user_role; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_admin_user_roles_user_role ON public.admin_user_roles USING btree (user_id, role_id);


--
-- Name: idx_admin_workflow_executions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_workflow_executions_status ON public.admin_workflow_executions USING btree (status);


--
-- Name: idx_admin_workflow_executions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_workflow_executions_tenant ON public.admin_workflow_executions USING btree (tenant_slug);


--
-- Name: idx_admin_workflows_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_workflows_active ON public.admin_workflows USING btree (is_active);


--
-- Name: idx_admin_workflows_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_workflows_tenant ON public.admin_workflows USING btree (tenant_slug);


--
-- Name: idx_advance_taxes_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_advance_taxes_tenant ON public.advance_taxes USING btree (tenant_slug);


--
-- Name: idx_ai_pending_actions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_pending_actions_tenant ON public.ai_pending_actions USING btree (tenant_slug, status, created_at DESC);


--
-- Name: idx_asset_capitalizations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_capitalizations_tenant ON public.asset_capitalizations USING btree (tenant_slug);


--
-- Name: idx_asset_shift_allocations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_shift_allocations_tenant ON public.asset_shift_allocations USING btree (tenant_slug);


--
-- Name: idx_asset_value_adjustments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_value_adjustments_tenant ON public.asset_value_adjustments USING btree (tenant_slug);


--
-- Name: idx_assignment_recommendations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignment_recommendations_tenant ON public.assignment_recommendations USING btree (tenant_slug);


--
-- Name: idx_attendance_locations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_locations_tenant ON public.attendance_locations USING btree (tenant_slug);


--
-- Name: idx_attendance_qr_tokens_loc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_qr_tokens_loc ON public.attendance_qr_tokens USING btree (location_id, expires_at);


--
-- Name: idx_attendance_qr_tokens_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_qr_tokens_tenant ON public.attendance_qr_tokens USING btree (tenant_slug);


--
-- Name: idx_attendance_records_emp_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_emp_date ON public.attendance_records USING btree (employee_id, work_date);


--
-- Name: idx_attendance_records_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_tenant ON public.attendance_records USING btree (tenant_id);


--
-- Name: idx_attendance_records_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_attendance_records_uniq ON public.attendance_records USING btree (tenant_id, employee_id, work_date);


--
-- Name: idx_bank_guarantees_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_guarantees_tenant ON public.bank_guarantees USING btree (tenant_slug);


--
-- Name: idx_budget_actuals_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_actuals_account_id ON public.budget_actuals USING btree (account_id);


--
-- Name: idx_budget_actuals_budget_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_actuals_budget_id ON public.budget_actuals USING btree (budget_id);


--
-- Name: idx_budget_actuals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_actuals_tenant ON public.budget_actuals USING btree (tenant_slug);


--
-- Name: idx_budget_actuals_transaction_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_actuals_transaction_date ON public.budget_actuals USING btree (transaction_date DESC);


--
-- Name: idx_budget_actuals_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_actuals_transaction_id ON public.budget_actuals USING btree (transaction_id);


--
-- Name: idx_budget_actuals_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_actuals_type ON public.budget_actuals USING btree (actual_type);


--
-- Name: idx_budget_approvals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_approvals_tenant ON public.budget_approvals USING btree (tenant_slug);


--
-- Name: idx_budget_forecasts_budget_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_forecasts_budget_id ON public.budget_forecasts USING btree (budget_id);


--
-- Name: idx_budget_forecasts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_forecasts_tenant ON public.budget_forecasts USING btree (tenant_slug);


--
-- Name: idx_budget_forecasts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_forecasts_type ON public.budget_forecasts USING btree (forecast_type);


--
-- Name: idx_budget_lines_account_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_lines_account_id ON public.budget_lines USING btree (account_id);


--
-- Name: idx_budget_lines_budget_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_lines_budget_id ON public.budget_lines USING btree (budget_id);


--
-- Name: idx_budget_lines_cost_center; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_lines_cost_center ON public.budget_lines USING btree (cost_center_id);


--
-- Name: idx_budget_lines_project_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_lines_project_id ON public.budget_lines USING btree (project_id);


--
-- Name: idx_budget_lines_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_lines_tenant ON public.budget_lines USING btree (tenant_slug);


--
-- Name: idx_budget_variances_alert_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_variances_alert_level ON public.budget_variances USING btree (alert_level);


--
-- Name: idx_budget_variances_budget_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_variances_budget_id ON public.budget_variances USING btree (budget_id);


--
-- Name: idx_budget_variances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_variances_tenant ON public.budget_variances USING btree (tenant_slug);


--
-- Name: idx_budget_variances_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_variances_type ON public.budget_variances USING btree (variance_type);


--
-- Name: idx_budget_versions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budget_versions_tenant ON public.budget_versions USING btree (tenant_slug);


--
-- Name: idx_budgets_budget_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_budget_type ON public.budgets USING btree (budget_type);


--
-- Name: idx_budgets_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_created_at ON public.budgets USING btree (created_at DESC);


--
-- Name: idx_budgets_fiscal_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_fiscal_year ON public.budgets USING btree (fiscal_year);


--
-- Name: idx_budgets_scope_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_scope_entity ON public.budgets USING btree (scope_entity_id);


--
-- Name: idx_budgets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_status ON public.budgets USING btree (status);


--
-- Name: idx_budgets_tenant_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_budgets_tenant_slug ON public.budgets USING btree (tenant_slug);


--
-- Name: idx_cached_summary_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cached_summary_tenant ON public.finance_cached_summary USING btree (tenant_slug);


--
-- Name: idx_capacity_snapshots_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capacity_snapshots_recent ON public.capacity_snapshots USING btree (employee_id, snapshot_date DESC);


--
-- Name: idx_capacity_snapshots_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_capacity_snapshots_tenant ON public.capacity_snapshots USING btree (tenant_slug);


--
-- Name: idx_coa_tenant_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coa_tenant_code ON public.chart_of_accounts USING btree (tenant_id, code);


--
-- Name: idx_crm_activity_log_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_activity_log_tenant ON public.crm_activity_log USING btree (tenant_slug);


--
-- Name: idx_crm_contacts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_contacts_tenant ON public.crm_contacts USING btree (tenant_slug);


--
-- Name: idx_crm_conversions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_conversions_tenant ON public.crm_conversions USING btree (tenant_slug);


--
-- Name: idx_crm_customers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_customers_tenant ON public.crm_customers USING btree (tenant_slug);


--
-- Name: idx_crm_deal_competitors_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_deal_competitors_tenant ON public.crm_deal_competitors USING btree (tenant_slug);


--
-- Name: idx_crm_deal_items_deal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_deal_items_deal ON public.crm_deal_items USING btree (tenant_slug, deal_id);


--
-- Name: idx_crm_deals_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_deals_tenant ON public.crm_deals USING btree (tenant_slug);


--
-- Name: idx_crm_deals_tenant_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_deals_tenant_stage ON public.crm_deals USING btree (tenant_slug, stage);


--
-- Name: idx_crm_leads_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_leads_tenant ON public.crm_leads USING btree (tenant_slug);


--
-- Name: idx_data_imports_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_imports_tenant ON public.data_imports USING btree (tenant_slug);


--
-- Name: idx_emp_expenses_emp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emp_expenses_emp ON public.admin_employee_expenses USING btree (tenant_slug, employee_id);


--
-- Name: idx_emp_expenses_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emp_expenses_status ON public.admin_employee_expenses USING btree (status);


--
-- Name: idx_emp_expenses_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_emp_expenses_tenant ON public.admin_employee_expenses USING btree (tenant_slug);


--
-- Name: idx_employee_grievances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_grievances_tenant ON public.employee_grievances USING btree (tenant_slug);


--
-- Name: idx_employee_skills_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_skills_tenant ON public.employee_skills USING btree (tenant_slug);


--
-- Name: idx_employee_transfers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_transfers_tenant ON public.employee_transfers USING btree (tenant_slug);


--
-- Name: idx_engineer_profiles_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engineer_profiles_branch ON public.engineer_profiles USING btree (branch_id);


--
-- Name: idx_engineer_profiles_duty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engineer_profiles_duty ON public.engineer_profiles USING btree (tenant_slug, on_duty);


--
-- Name: idx_engineer_profiles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_engineer_profiles_tenant ON public.engineer_profiles USING btree (tenant_slug);


--
-- Name: idx_field_jobs_engineer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_jobs_engineer ON public.field_jobs USING btree (engineer_id);


--
-- Name: idx_field_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_jobs_status ON public.field_jobs USING btree (status);


--
-- Name: idx_field_jobs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_jobs_tenant ON public.field_jobs USING btree (tenant_slug);


--
-- Name: idx_field_jobs_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_jobs_ticket ON public.field_jobs USING btree (ticket_id);


--
-- Name: idx_finance_allocations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_allocations_tenant ON public.finance_allocations USING btree (tenant_slug);


--
-- Name: idx_finance_cost_centers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_cost_centers_tenant ON public.finance_cost_centers USING btree (tenant_slug);


--
-- Name: idx_finance_events_gl; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_events_gl ON public.finance_events USING btree (tenant_slug, gl_account_code, event_timestamp);


--
-- Name: idx_finance_events_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_events_module ON public.finance_events USING btree (source_module);


--
-- Name: idx_finance_events_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_events_tenant ON public.finance_events USING btree (tenant_slug);


--
-- Name: idx_finance_events_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_events_timestamp ON public.finance_events USING btree (event_timestamp);


--
-- Name: idx_finance_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_events_type ON public.finance_events USING btree (event_type);


--
-- Name: idx_finance_events_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_events_unprocessed ON public.finance_events USING btree (tenant_slug, processed) WHERE (processed = false);


--
-- Name: idx_finance_invoices_tenant_issued; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_invoices_tenant_issued ON public.finance_invoices USING btree (tenant_slug, issued_date);


--
-- Name: idx_fx_revaluations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fx_revaluations_tenant ON public.fx_revaluations USING btree (tenant_slug);


--
-- Name: idx_inventory_products_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_products_category ON public.inventory_products USING btree (tenant_slug, category);


--
-- Name: idx_inventory_products_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_products_tenant ON public.inventory_products USING btree (tenant_slug);


--
-- Name: idx_inventory_warehouses_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_warehouses_branch ON public.inventory_warehouses USING btree (branch_id);


--
-- Name: idx_inventory_warehouses_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inventory_warehouses_tenant ON public.inventory_warehouses USING btree (tenant_slug);


--
-- Name: idx_invoice_discountings_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_discountings_tenant ON public.invoice_discountings USING btree (tenant_slug);


--
-- Name: idx_it_field_jobs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_it_field_jobs_tenant ON public.it_field_jobs USING btree (tenant_slug);


--
-- Name: idx_journal_entries_tenant_entry_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_tenant_entry_date ON public.journal_entries USING btree (tenant_slug, entry_date);


--
-- Name: idx_journal_entries_tenant_posting_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journal_entries_tenant_posting_date ON public.journal_entries USING btree (tenant_slug, posting_date);


--
-- Name: idx_journals_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_journals_tenant_status ON public.journal_entries USING btree (tenant_id, status);


--
-- Name: idx_knowledge_articles_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_articles_status ON public.knowledge_base_articles USING btree (publish_status);


--
-- Name: idx_knowledge_articles_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_articles_tags ON public.knowledge_base_articles USING gin (tags);


--
-- Name: idx_knowledge_articles_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_knowledge_articles_tenant ON public.knowledge_base_articles USING btree (tenant_slug);


--
-- Name: idx_leave_encashments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leave_encashments_tenant ON public.leave_encashments USING btree (tenant_slug);


--
-- Name: idx_maintenance_visits_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_maintenance_visits_tenant ON public.maintenance_visits USING btree (tenant_slug);


--
-- Name: idx_mfg_sub_operations_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mfg_sub_operations_tenant ON public.mfg_sub_operations USING btree (tenant_slug);


--
-- Name: idx_mps_items_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mps_items_tenant ON public.mps_items USING btree (tenant_slug);


--
-- Name: idx_overtime_entries_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_overtime_entries_tenant ON public.overtime_entries USING btree (tenant_slug);


--
-- Name: idx_payment_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payment_orders_tenant ON public.payment_orders USING btree (tenant_slug);


--
-- Name: idx_pos_held_sales_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_held_sales_tenant ON public.pos_held_sales USING btree (tenant_slug);


--
-- Name: idx_pos_price_list_items_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_price_list_items_tenant ON public.pos_price_list_items USING btree (tenant_slug);


--
-- Name: idx_pos_price_lists_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pos_price_lists_tenant ON public.pos_price_lists USING btree (tenant_slug);


--
-- Name: idx_projects_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_dates ON public.projects USING btree (start_date, planned_end_date);


--
-- Name: idx_projects_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_tenant_status ON public.projects USING btree (tenant_slug, status);


--
-- Name: idx_purchase_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_orders_tenant ON public.purchase_orders USING btree (tenant_slug);


--
-- Name: idx_remote_day_requests_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_remote_day_requests_tenant ON public.remote_day_requests USING btree (tenant_slug, status);


--
-- Name: idx_report_jobs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_report_jobs_tenant ON public.report_jobs USING btree (tenant_slug);


--
-- Name: idx_reports_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_tenant ON public.reports USING btree (tenant_slug);


--
-- Name: idx_revops_campaign_costs_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revops_campaign_costs_campaign ON public.revops_campaign_costs USING btree (campaign_id);


--
-- Name: idx_revops_campaign_costs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revops_campaign_costs_tenant ON public.revops_campaign_costs USING btree (tenant_slug);


--
-- Name: idx_revops_campaigns_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revops_campaigns_tenant ON public.revops_campaigns USING btree (tenant_slug);


--
-- Name: idx_revops_enablement_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revops_enablement_tenant ON public.revops_enablement_assets USING btree (tenant_slug);


--
-- Name: idx_revops_forecasts_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revops_forecasts_tenant ON public.revops_revenue_forecasts USING btree (tenant_slug);


--
-- Name: idx_revops_lead_sources_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revops_lead_sources_tenant ON public.revops_lead_sources USING btree (tenant_slug);


--
-- Name: idx_revops_revenue_attributions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revops_revenue_attributions_tenant ON public.revops_revenue_attributions USING btree (tenant_slug);


--
-- Name: idx_revops_sales_perf_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revops_sales_perf_tenant ON public.revops_sales_performance_snapshots USING btree (tenant_slug);


--
-- Name: idx_revops_sales_targets_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_revops_sales_targets_tenant ON public.revops_sales_targets USING btree (tenant_slug);


--
-- Name: idx_sales_order_items_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_order ON public.sales_order_items USING btree (order_id);


--
-- Name: idx_sales_order_items_tenant_sku; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_order_items_tenant_sku ON public.sales_order_items USING btree (tenant_slug, sku);


--
-- Name: idx_sales_orders_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_tenant ON public.sales_orders USING btree (tenant_slug);


--
-- Name: idx_sales_orders_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sales_orders_tenant_status ON public.sales_orders USING btree (tenant_slug, status);


--
-- Name: idx_sla_policies_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_policies_priority ON public.sla_policies USING btree (tenant_slug, priority);


--
-- Name: idx_sla_policies_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sla_policies_tenant ON public.sla_policies USING btree (tenant_slug);


--
-- Name: idx_sms_messages_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sms_messages_tenant ON public.sms_messages USING btree (tenant_slug);


--
-- Name: idx_staff_advance_applications_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_advance_applications_tenant ON public.staff_advance_applications USING btree (tenant_slug);


--
-- Name: idx_staffing_plans_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staffing_plans_tenant ON public.staffing_plans USING btree (tenant_slug);


--
-- Name: idx_statement_runs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_statement_runs_tenant ON public.statement_runs USING btree (tenant_slug);


--
-- Name: idx_stock_balances_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_balances_tenant ON public.inventory_stock_balances USING btree (tenant_slug);


--
-- Name: idx_stock_movements_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_warehouse ON public.stock_movements USING btree (tenant_slug, warehouse_id);


--
-- Name: idx_stock_transfers_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_transfers_tenant ON public.inventory_stock_transfers USING btree (tenant_slug);


--
-- Name: idx_subcontract_material_movements_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontract_material_movements_tenant ON public.subcontract_material_movements USING btree (tenant_slug);


--
-- Name: idx_subcontract_materials_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subcontract_materials_tenant ON public.subcontract_materials USING btree (tenant_slug);


--
-- Name: idx_subscription_invoices_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscription_invoices_tenant ON public.subscription_invoices USING btree (tenant_slug);


--
-- Name: idx_support_incidents_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_incidents_status ON public.support_incidents USING btree (tenant_slug, status);


--
-- Name: idx_support_incidents_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_incidents_tenant ON public.support_incidents USING btree (tenant_slug);


--
-- Name: idx_support_incidents_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_incidents_ticket ON public.support_incidents USING btree (linked_ticket_id);


--
-- Name: idx_support_tickets_engineer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_engineer ON public.support_tickets USING btree (assigned_engineer_id);


--
-- Name: idx_support_tickets_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_priority ON public.support_tickets USING btree (tenant_slug, priority);


--
-- Name: idx_support_tickets_sla; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_sla ON public.support_tickets USING btree (sla_policy_id);


--
-- Name: idx_support_tickets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_status ON public.support_tickets USING btree (tenant_slug, status);


--
-- Name: idx_support_tickets_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_tickets_tenant ON public.support_tickets USING btree (tenant_slug);


--
-- Name: idx_task_assignments_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_assignments_employee ON public.task_assignments USING btree (employee_id, tenant_slug);


--
-- Name: idx_tasks_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_tenant ON public.tasks USING btree (tenant_slug);


--
-- Name: idx_tasks_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_tenant_status ON public.tasks USING btree (tenant_slug, status);


--
-- Name: idx_tasks_workstream_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_workstream_status ON public.tasks USING btree (workstream_id, status);


--
-- Name: idx_tenant_branches_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_branches_status ON public.tenant_branches USING btree (tenant_slug, status);


--
-- Name: idx_tenant_branches_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_branches_tenant ON public.tenant_branches USING btree (tenant_slug);


--
-- Name: idx_tenant_reviews; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_reviews ON public.tenant_performance_reviews USING btree (tenant_slug);


--
-- Name: idx_ticket_activity_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_activity_ticket ON public.ticket_activity_logs USING btree (ticket_id);


--
-- Name: idx_ticket_activity_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_activity_type ON public.ticket_activity_logs USING btree (tenant_slug, activity_type);


--
-- Name: idx_ticket_comments_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_tenant ON public.ticket_comments USING btree (tenant_slug);


--
-- Name: idx_ticket_comments_ticket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments USING btree (ticket_id);


--
-- Name: idx_time_logs_employee_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_logs_employee_date ON public.time_logs USING btree (employee_id, log_date);


--
-- Name: idx_time_logs_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_logs_tenant ON public.time_logs USING btree (tenant_slug);


--
-- Name: idx_training_events_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_events_tenant ON public.training_events USING btree (tenant_slug);


--
-- Name: idx_user_branches_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_branches_branch ON public.tenant_user_branches USING btree (tenant_slug, branch_id);


--
-- Name: idx_user_branches_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_branches_user ON public.tenant_user_branches USING btree (tenant_slug, user_id);


--
-- Name: idx_user_notification_preferences_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_notification_preferences_tenant ON public.user_notification_preferences USING btree (tenant_slug);


--
-- Name: idx_users_tenant_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_tenant_email ON public.users USING btree (tenant_id, lower(email));


--
-- Name: idx_vendors_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vendors_tenant ON public.vendors USING btree (tenant_slug);


--
-- Name: idx_web_form_submissions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_web_form_submissions_tenant ON public.web_form_submissions USING btree (tenant_slug);


--
-- Name: idx_webhook_deliveries_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_tenant ON public.webhook_deliveries USING btree (tenant_slug);


--
-- Name: idx_webhook_deliveries_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_deliveries_tenant_status ON public.webhook_deliveries USING btree (tenant_slug, status);


--
-- Name: idx_webhook_subscriptions_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_subscriptions_tenant ON public.webhook_subscriptions USING btree (tenant_slug);


--
-- Name: idx_workstreams_project_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workstreams_project_status ON public.workstreams USING btree (project_id, status);


--
-- Name: idx_workstreams_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workstreams_tenant ON public.workstreams USING btree (tenant_slug);


--
-- Name: import_jobs_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX import_jobs_tenant_idx ON public.import_jobs USING btree (tenant_slug, created_at);


--
-- Name: imprest_funds_tenant_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX imprest_funds_tenant_name_uq ON public.imprest_funds USING btree (tenant_slug, name);


--
-- Name: imprest_txn_fund_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imprest_txn_fund_idx ON public.imprest_transactions USING btree (fund_id, txn_date);


--
-- Name: imprest_txn_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imprest_txn_tenant_idx ON public.imprest_transactions USING btree (tenant_slug);


--
-- Name: inventory_item_variants_template_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_variants_template_idx ON public.inventory_item_variants USING btree (tenant_slug, template_product_id);


--
-- Name: inventory_lot_stock_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_lot_stock_expiry_idx ON public.inventory_lot_stock USING btree (tenant_slug, expiry_date);


--
-- Name: inventory_reorder_rules_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_reorder_rules_tenant_idx ON public.inventory_reorder_rules USING btree (tenant_slug) WHERE enabled;


--
-- Name: inventory_serials_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_serials_tenant_idx ON public.inventory_serials USING btree (tenant_slug, sku, status);


--
-- Name: invoice_pay_sched_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_pay_sched_due_idx ON public.invoice_payment_schedule USING btree (tenant_slug, due_date) WHERE (paid_amount < amount);


--
-- Name: invoice_pay_sched_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_pay_sched_idx ON public.invoice_payment_schedule USING btree (invoice_id, due_date);


--
-- Name: isl_fifo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX isl_fifo_idx ON public.inventory_stock_layers USING btree (tenant_slug, product_sku, warehouse_id, created_at) WHERE (remaining_qty > (0)::numeric);


--
-- Name: job_card_time_logs_jc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_card_time_logs_jc_idx ON public.manufacturing_job_card_time_logs USING btree (job_card_id);


--
-- Name: job_cards_wo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_cards_wo_idx ON public.manufacturing_job_cards USING btree (work_order_id);


--
-- Name: journal_entries_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entries_number_idx ON public.journal_entries USING btree (tenant_slug, journal_number);


--
-- Name: journal_entries_posting_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entries_posting_date_idx ON public.journal_entries USING btree (posting_date);


--
-- Name: journal_entries_reference_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entries_reference_idx ON public.journal_entries USING btree (reference_type, reference_id);


--
-- Name: journal_entries_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entries_tenant_idx ON public.journal_entries USING btree (tenant_slug);


--
-- Name: journal_entry_lines_account_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entry_lines_account_code_idx ON public.journal_entry_lines USING btree (account_code);


--
-- Name: journal_entry_lines_account_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entry_lines_account_id_idx ON public.journal_entry_lines USING btree (account_id);


--
-- Name: journal_entry_lines_account_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entry_lines_account_idx ON public.journal_entry_lines USING btree (account_code);


--
-- Name: journal_entry_lines_entry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entry_lines_entry_idx ON public.journal_entry_lines USING btree (entry_id);


--
-- Name: journal_entry_lines_je_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entry_lines_je_idx ON public.journal_entry_lines USING btree (journal_entry_id);


--
-- Name: journal_entry_lines_party_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX journal_entry_lines_party_idx ON public.journal_entry_lines USING btree (party_type, party_id);


--
-- Name: landed_cost_vouchers_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX landed_cost_vouchers_tenant_idx ON public.landed_cost_vouchers USING btree (tenant_slug);


--
-- Name: lcc_voucher_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lcc_voucher_idx ON public.landed_cost_charges USING btree (voucher_id);


--
-- Name: lcv_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lcv_tenant_idx ON public.landed_cost_vouchers USING btree (tenant_slug, status);


--
-- Name: maintenance_schedules_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX maintenance_schedules_due_idx ON public.maintenance_schedules USING btree (tenant_slug, next_due) WHERE is_active;


--
-- Name: material_request_items_mr_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX material_request_items_mr_idx ON public.material_request_items USING btree (material_request_id);


--
-- Name: material_requests_tenant_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX material_requests_tenant_number_uq ON public.material_requests USING btree (tenant_slug, mr_number);


--
-- Name: notification_outbox_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notification_outbox_pending_idx ON public.notification_outbox USING btree (next_retry_at) WHERE (status = 'pending'::text);


--
-- Name: org_admin_assignments_node_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_admin_assignments_node_idx ON public.org_admin_assignments USING btree (tenant_slug, node_id);


--
-- Name: org_admin_assignments_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_admin_assignments_tenant_idx ON public.org_admin_assignments USING btree (tenant_slug);


--
-- Name: org_admin_assignments_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX org_admin_assignments_user_idx ON public.org_admin_assignments USING btree (tenant_slug, user_email);


--
-- Name: payment_applications_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_applications_invoice_idx ON public.payment_applications USING btree (invoice_id);


--
-- Name: payment_applications_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_applications_payment_idx ON public.payment_applications USING btree (payment_id);


--
-- Name: payment_applications_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_applications_tenant_idx ON public.payment_applications USING btree (tenant_slug);


--
-- Name: payment_links_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_links_invoice_idx ON public.payment_links USING btree (invoice_id, status);


--
-- Name: payment_requests_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_requests_invoice_idx ON public.payment_requests USING btree (invoice_id, status);


--
-- Name: payment_terms_tenant_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_terms_tenant_name_uq ON public.payment_terms USING btree (tenant_slug, name);


--
-- Name: poi_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX poi_order_idx ON public.purchase_order_items USING btree (purchase_order_id);


--
-- Name: portal_tokens_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portal_tokens_tenant_idx ON public.portal_tokens USING btree (tenant_slug, party_type, party_id);


--
-- Name: pos_audit_log_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pos_audit_log_tenant ON public.pos_audit_log USING btree (tenant_slug, created_at DESC);


--
-- Name: pos_cash_movements_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pos_cash_movements_shift ON public.pos_cash_movements USING btree (tenant_slug, shift_id);


--
-- Name: pos_loyalty_txns_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pos_loyalty_txns_customer ON public.pos_loyalty_txns USING btree (tenant_slug, customer_code);


--
-- Name: pos_returns_sale; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pos_returns_sale ON public.pos_returns USING btree (tenant_slug, sale_id);


--
-- Name: pos_sales_branch; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pos_sales_branch ON public.pos_sales USING btree (tenant_slug, branch_id) WHERE (branch_id IS NOT NULL);


--
-- Name: pos_sales_idem; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pos_sales_idem ON public.pos_sales USING btree (tenant_slug, idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: pos_sales_local_inv; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pos_sales_local_inv ON public.pos_sales USING btree (tenant_slug, local_invoice_no) WHERE (local_invoice_no IS NOT NULL);


--
-- Name: pos_sales_receipt; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pos_sales_receipt ON public.pos_sales USING btree (tenant_slug, receipt_no);


--
-- Name: pos_sales_shift_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pos_sales_shift_idx ON public.pos_sales USING btree (tenant_slug, shift_id);


--
-- Name: pos_sales_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pos_sales_tenant_idx ON public.pos_sales USING btree (tenant_slug, created_at);


--
-- Name: pos_shifts_one_open; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pos_shifts_one_open ON public.pos_shifts USING btree (tenant_slug, COALESCE(register_id, ''::text)) WHERE (status = 'open'::text);


--
-- Name: pos_shifts_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pos_shifts_tenant_idx ON public.pos_shifts USING btree (tenant_slug, opened_at);


--
-- Name: pri_receipt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pri_receipt_idx ON public.purchase_receipt_items USING btree (receipt_id);


--
-- Name: pricing_rules_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pricing_rules_idx ON public.pricing_rules USING btree (tenant_slug, priority);


--
-- Name: process_run_logs_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX process_run_logs_idx ON public.process_run_logs USING btree (tenant_slug, process, created_at DESC);


--
-- Name: procurement_goods_receipts_po_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_goods_receipts_po_idx ON public.procurement_goods_receipts USING btree (po_id);


--
-- Name: procurement_goods_receipts_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_goods_receipts_tenant_idx ON public.procurement_goods_receipts USING btree (tenant_slug);


--
-- Name: procurement_requisitions_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_requisitions_tenant_idx ON public.procurement_requisitions USING btree (tenant_slug, status);


--
-- Name: procurement_rfq_items_rfq_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_rfq_items_rfq_idx ON public.procurement_rfq_items USING btree (rfq_id);


--
-- Name: procurement_rfq_suppliers_rfq_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_rfq_suppliers_rfq_idx ON public.procurement_rfq_suppliers USING btree (rfq_id);


--
-- Name: procurement_rfqs_tenant_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX procurement_rfqs_tenant_number_uq ON public.procurement_rfqs USING btree (tenant_slug, rfq_number);


--
-- Name: procurement_sq_items_quotation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_sq_items_quotation_idx ON public.procurement_supplier_quotation_items USING btree (quotation_id);


--
-- Name: procurement_sq_rfq_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_sq_rfq_idx ON public.procurement_supplier_quotations USING btree (rfq_id);


--
-- Name: procurement_sq_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX procurement_sq_tenant_idx ON public.procurement_supplier_quotations USING btree (tenant_slug, status);


--
-- Name: production_plan_items_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_plan_items_plan_idx ON public.manufacturing_production_plan_items USING btree (plan_id);


--
-- Name: project_updates_proj_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_updates_proj_idx ON public.project_updates USING btree (tenant_slug, project_id);


--
-- Name: ptl_term_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ptl_term_idx ON public.payment_term_lines USING btree (term_id);


--
-- Name: purchase_orders_supplier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_orders_supplier_idx ON public.purchase_orders USING btree (supplier_id);


--
-- Name: purchase_orders_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_orders_tenant_idx ON public.purchase_orders USING btree (tenant_slug);


--
-- Name: purchase_receipts_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_receipts_tenant_idx ON public.purchase_receipts USING btree (tenant_slug, status);


--
-- Name: putaway_rules_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX putaway_rules_sku_idx ON public.putaway_rules USING btree (tenant_slug, product_sku);


--
-- Name: quality_inspections_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quality_inspections_tenant_idx ON public.quality_inspections USING btree (tenant_slug);


--
-- Name: quality_inspections_wo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX quality_inspections_wo_idx ON public.quality_inspections USING btree (work_order_id);


--
-- Name: recon_items_recon_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recon_items_recon_idx ON public.reconciliation_items USING btree (reconciliation_id);


--
-- Name: recurring_invoices_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX recurring_invoices_due_idx ON public.recurring_invoices USING btree (tenant_slug, status, next_run_date);


--
-- Name: routing_ops_routing_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX routing_ops_routing_idx ON public.manufacturing_routing_operations USING btree (routing_id);


--
-- Name: sales_forecasts_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_forecasts_tenant_idx ON public.manufacturing_sales_forecasts USING btree (tenant_slug, product_sku, forecast_date);


--
-- Name: sales_quotation_items_quotation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_quotation_items_quotation_idx ON public.sales_quotation_items USING btree (quotation_id);


--
-- Name: sales_quotations_tenant_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX sales_quotations_tenant_number_uq ON public.sales_quotations USING btree (tenant_slug, quotation_number);


--
-- Name: sales_quotations_tenant_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sales_quotations_tenant_status_idx ON public.sales_quotations USING btree (tenant_slug, status);


--
-- Name: saved_reports_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX saved_reports_tenant_idx ON public.saved_reports USING btree (tenant_slug);


--
-- Name: share_transfers_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX share_transfers_idx ON public.share_transfers USING btree (tenant_slug, posting_date);


--
-- Name: staff_advance_app_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_advance_app_idx ON public.staff_advance_applications USING btree (advance_id);


--
-- Name: staff_advances_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX staff_advances_number_uq ON public.staff_advances USING btree (tenant_slug, advance_number);


--
-- Name: staff_advances_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_advances_tenant_idx ON public.staff_advances USING btree (tenant_slug, status);


--
-- Name: stock_movements_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_sku_idx ON public.stock_movements USING btree (tenant_slug, product_sku);


--
-- Name: stock_movements_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_movements_tenant_idx ON public.stock_movements USING btree (tenant_slug);


--
-- Name: stock_rec_items_rec_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_rec_items_rec_idx ON public.inventory_stock_reconciliation_items USING btree (reconciliation_id);


--
-- Name: stock_reservations_so_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_reservations_so_idx ON public.inventory_stock_reservations USING btree (sales_order_id) WHERE (status = 'active'::text);


--
-- Name: stock_reservations_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_reservations_tenant_idx ON public.inventory_stock_reservations USING btree (tenant_slug, product_sku) WHERE (status = 'active'::text);


--
-- Name: storefront_orders_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX storefront_orders_tenant_idx ON public.storefront_orders USING btree (tenant_slug, status);


--
-- Name: subcontract_mat_mov_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subcontract_mat_mov_idx ON public.subcontract_material_movements USING btree (subcontract_material_id);


--
-- Name: subcontract_orders_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subcontract_orders_tenant_idx ON public.subcontract_orders USING btree (tenant_slug, status);


--
-- Name: subscriptions_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subscriptions_due_idx ON public.subscriptions USING btree (tenant_slug, status, next_invoice_date);


--
-- Name: tax_rates_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_rates_tenant_idx ON public.tax_rates USING btree (tenant_slug);


--
-- Name: tax_returns_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_returns_tenant_idx ON public.tax_returns USING btree (tenant_slug, status);


--
-- Name: tax_rules_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_rules_idx ON public.tax_rules USING btree (tenant_slug, direction, priority);


--
-- Name: tax_transactions_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_transactions_source_idx ON public.tax_transactions USING btree (tenant_slug, source_type, source_id);


--
-- Name: tax_transactions_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tax_transactions_tenant_idx ON public.tax_transactions USING btree (tenant_slug, transaction_date);


--
-- Name: tdr_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tdr_idx ON public.transaction_deletion_records USING btree (tenant_slug, document_type, created_at);


--
-- Name: tds_entries_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tds_entries_idx ON public.tax_withholding_entries USING btree (tenant_slug, party_id, fiscal_year);


--
-- Name: tenant_admin_reset_tokens_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_admin_reset_tokens_token_idx ON public.tenant_admin_password_reset_tokens USING btree (token);


--
-- Name: tenant_admins_tenant_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_admins_tenant_slug_idx ON public.tenant_admins USING btree (tenant_slug);


--
-- Name: tenant_usage_daily_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenant_usage_daily_date_idx ON public.tenant_usage_daily USING btree (usage_date);


--
-- Name: txn_del_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX txn_del_idx ON public.transaction_deletion_records USING btree (tenant_slug, document_type);


--
-- Name: vendor_balances_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendor_balances_tenant_idx ON public.vendor_balances USING btree (tenant_slug);


--
-- Name: vendor_contacts_vendor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendor_contacts_vendor_idx ON public.vendor_contacts USING btree (vendor_id);


--
-- Name: vendor_payment_applications_bill_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendor_payment_applications_bill_idx ON public.vendor_payment_applications USING btree (bill_id);


--
-- Name: vendor_payment_applications_payment_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendor_payment_applications_payment_idx ON public.vendor_payment_applications USING btree (payment_id);


--
-- Name: vendor_payment_number_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX vendor_payment_number_uq ON public.vendor_payments USING btree (tenant_slug, payment_number);


--
-- Name: vendor_payments_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendor_payments_tenant_idx ON public.vendor_payments USING btree (tenant_slug);


--
-- Name: vendor_payments_vendor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendor_payments_vendor_idx ON public.vendor_payments USING btree (vendor_id);


--
-- Name: vendors_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_code_idx ON public.vendors USING btree (code);


--
-- Name: vendors_display_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_display_name_idx ON public.vendors USING btree (display_name);


--
-- Name: vendors_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_name_idx ON public.vendors USING btree (name);


--
-- Name: vendors_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_tenant_idx ON public.vendors USING btree (country);


--
-- Name: vendors_vendor_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX vendors_vendor_code_idx ON public.vendors USING btree (vendor_code);


--
-- Name: webhook_deliveries_retry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhook_deliveries_retry_idx ON public.webhook_deliveries USING btree (status, next_retry_at) WHERE (status = 'pending'::text);


--
-- Name: work_order_materials_wo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_materials_wo_idx ON public.work_order_materials USING btree (work_order_id);


--
-- Name: work_order_operations_wo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_order_operations_wo_idx ON public.work_order_operations USING btree (work_order_id);


--
-- Name: work_orders_product_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_orders_product_idx ON public.work_orders USING btree (tenant_slug, product_sku);


--
-- Name: work_orders_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_orders_run_idx ON public.work_orders USING btree (tenant_slug, production_run_id);


--
-- Name: work_orders_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_orders_tenant_idx ON public.work_orders USING btree (tenant_slug, status);


--
-- Name: workflow_definitions_doc_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_definitions_doc_idx ON public.workflow_definitions USING btree (tenant_slug, doc_type) WHERE is_active;


--
-- Name: finance_events trg_finance_events_process; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_finance_events_process BEFORE INSERT ON public.finance_events FOR EACH ROW EXECUTE FUNCTION public.update_finance_cached_summary();


--
-- Name: sales_orders trg_sales_order_items; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sales_order_items AFTER INSERT OR UPDATE OF items ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.sync_sales_order_items();


--
-- Name: activity_costs activity_costs_activity_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_costs
    ADD CONSTRAINT activity_costs_activity_type_id_fkey FOREIGN KEY (activity_type_id) REFERENCES public.activity_types(id) ON DELETE CASCADE;


--
-- Name: admin_payroll_entries admin_payroll_entries_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_payroll_entries
    ADD CONSTRAINT admin_payroll_entries_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.admin_payroll_runs(id) ON DELETE CASCADE;


--
-- Name: asset_capitalizations asset_capitalizations_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_capitalizations
    ADD CONSTRAINT asset_capitalizations_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE SET NULL;


--
-- Name: asset_depreciation_schedule asset_depreciation_schedule_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_depreciation_schedule
    ADD CONSTRAINT asset_depreciation_schedule_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE CASCADE;


--
-- Name: asset_maintenance asset_maintenance_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_maintenance
    ADD CONSTRAINT asset_maintenance_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE CASCADE;


--
-- Name: asset_movements asset_movements_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_movements
    ADD CONSTRAINT asset_movements_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE CASCADE;


--
-- Name: asset_value_adjustments asset_value_adjustments_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_value_adjustments
    ADD CONSTRAINT asset_value_adjustments_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.fixed_assets(id) ON DELETE CASCADE;


--
-- Name: assignment_recommendations assignment_recommendations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_recommendations
    ADD CONSTRAINT assignment_recommendations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: assignment_recommendations assignment_recommendations_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignment_recommendations
    ADD CONSTRAINT assignment_recommendations_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: attendance_qr_tokens attendance_qr_tokens_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_qr_tokens
    ADD CONSTRAINT attendance_qr_tokens_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.attendance_locations(id) ON DELETE CASCADE;


--
-- Name: automation_action_queue automation_action_queue_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_action_queue
    ADD CONSTRAINT automation_action_queue_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL;


--
-- Name: automation_rule_audits automation_rule_audits_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rule_audits
    ADD CONSTRAINT automation_rule_audits_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.automation_rules(id) ON DELETE SET NULL;


--
-- Name: bill_items bill_items_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_items
    ADD CONSTRAINT bill_items_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;


--
-- Name: bom_lines bom_lines_bom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bom_lines
    ADD CONSTRAINT bom_lines_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES public.bom_headers(id) ON DELETE CASCADE;


--
-- Name: budget_actuals budget_actuals_budget_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_actuals
    ADD CONSTRAINT budget_actuals_budget_fk FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: budget_actuals budget_actuals_budget_line_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_actuals
    ADD CONSTRAINT budget_actuals_budget_line_fk FOREIGN KEY (budget_line_id) REFERENCES public.budget_lines(id) ON DELETE SET NULL;


--
-- Name: budget_approvals budget_approvals_budget_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_approvals
    ADD CONSTRAINT budget_approvals_budget_fk FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: budget_forecasts budget_forecasts_budget_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_forecasts
    ADD CONSTRAINT budget_forecasts_budget_fk FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: budget_lines budget_lines_budget_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_lines
    ADD CONSTRAINT budget_lines_budget_fk FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: budget_variances budget_variances_budget_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_variances
    ADD CONSTRAINT budget_variances_budget_fk FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: budget_variances budget_variances_budget_line_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_variances
    ADD CONSTRAINT budget_variances_budget_line_fk FOREIGN KEY (budget_line_id) REFERENCES public.budget_lines(id) ON DELETE SET NULL;


--
-- Name: budget_versions budget_versions_budget_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_versions
    ADD CONSTRAINT budget_versions_budget_fk FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;


--
-- Name: crm_campaign_emails crm_campaign_emails_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_emails
    ADD CONSTRAINT crm_campaign_emails_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.crm_email_campaigns(id) ON DELETE CASCADE;


--
-- Name: crm_campaign_enrollments crm_campaign_enrollments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_enrollments
    ADD CONSTRAINT crm_campaign_enrollments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.crm_email_campaigns(id) ON DELETE CASCADE;


--
-- Name: crm_campaign_sends crm_campaign_sends_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_sends
    ADD CONSTRAINT crm_campaign_sends_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.crm_campaign_enrollments(id) ON DELETE CASCADE;


--
-- Name: crm_deal_competitors crm_deal_competitors_competitor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_deal_competitors
    ADD CONSTRAINT crm_deal_competitors_competitor_id_fkey FOREIGN KEY (competitor_id) REFERENCES public.crm_competitors(id) ON DELETE CASCADE;


--
-- Name: crm_deal_items crm_deal_items_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_deal_items
    ADD CONSTRAINT crm_deal_items_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.crm_deals(id) ON DELETE CASCADE;


--
-- Name: crm_territories crm_territories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_territories
    ADD CONSTRAINT crm_territories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.crm_territories(id) ON DELETE SET NULL;


--
-- Name: deferred_schedule deferred_schedule_deferred_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deferred_schedule
    ADD CONSTRAINT deferred_schedule_deferred_item_id_fkey FOREIGN KEY (deferred_item_id) REFERENCES public.deferred_items(id) ON DELETE CASCADE;


--
-- Name: downtime_entries downtime_entries_plant_floor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.downtime_entries
    ADD CONSTRAINT downtime_entries_plant_floor_id_fkey FOREIGN KEY (plant_floor_id) REFERENCES public.plant_floors(id) ON DELETE SET NULL;


--
-- Name: dunning_notices dunning_notices_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dunning_notices
    ADD CONSTRAINT dunning_notices_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_invoices(id);


--
-- Name: expense_approvals expense_approvals_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_approvals
    ADD CONSTRAINT expense_approvals_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;


--
-- Name: expense_audit_logs expense_audit_logs_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_audit_logs
    ADD CONSTRAINT expense_audit_logs_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;


--
-- Name: expense_receipts expense_receipts_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_receipts
    ADD CONSTRAINT expense_receipts_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.expenses(id) ON DELETE CASCADE;


--
-- Name: expenses expenses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id);


--
-- Name: field_jobs field_jobs_engineer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_jobs
    ADD CONSTRAINT field_jobs_engineer_id_fkey FOREIGN KEY (engineer_id) REFERENCES public.engineer_profiles(id) ON DELETE SET NULL;


--
-- Name: field_jobs field_jobs_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_jobs
    ADD CONSTRAINT field_jobs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: finance_allocations finance_allocations_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_allocations
    ADD CONSTRAINT finance_allocations_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.finance_cost_centers(id);


--
-- Name: finance_customers finance_customers_payment_term_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_customers
    ADD CONSTRAINT finance_customers_payment_term_id_fkey FOREIGN KEY (payment_term_id) REFERENCES public.payment_terms(id);


--
-- Name: finance_invoice_lines finance_invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_invoice_lines
    ADD CONSTRAINT finance_invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_invoices(id) ON DELETE CASCADE;


--
-- Name: admin_approval_requests fk_approval_flow; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_approval_requests
    ADD CONSTRAINT fk_approval_flow FOREIGN KEY (flow_id) REFERENCES public.admin_approval_flows(id) ON DELETE CASCADE;


--
-- Name: admin_user_roles fk_role; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_user_roles
    ADD CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES public.admin_roles(id) ON DELETE CASCADE;


--
-- Name: hr_advance_repayments hr_advance_repayments_advance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_advance_repayments
    ADD CONSTRAINT hr_advance_repayments_advance_id_fkey FOREIGN KEY (advance_id) REFERENCES public.hr_employee_advances(id) ON DELETE CASCADE;


--
-- Name: imprest_transactions imprest_transactions_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imprest_transactions
    ADD CONSTRAINT imprest_transactions_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.imprest_funds(id);


--
-- Name: inventory_item_groups inventory_item_groups_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_groups
    ADD CONSTRAINT inventory_item_groups_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.inventory_item_groups(id);


--
-- Name: inventory_product_bundle_items inventory_product_bundle_items_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_bundle_items
    ADD CONSTRAINT inventory_product_bundle_items_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.inventory_product_bundles(id) ON DELETE CASCADE;


--
-- Name: inventory_stock_reconciliation_items inventory_stock_reconciliation_items_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_reconciliation_items
    ADD CONSTRAINT inventory_stock_reconciliation_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES public.inventory_stock_reconciliations(id) ON DELETE CASCADE;


--
-- Name: inventory_uoms inventory_uoms_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_uoms
    ADD CONSTRAINT inventory_uoms_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.inventory_uom_categories(id);


--
-- Name: inventory_warehouses inventory_warehouses_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE SET NULL;


--
-- Name: inventory_warehouses inventory_warehouses_parent_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_parent_warehouse_id_fkey FOREIGN KEY (parent_warehouse_id) REFERENCES public.inventory_warehouses(id) ON DELETE SET NULL;


--
-- Name: invoice_payment_schedule invoice_payment_schedule_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_payment_schedule
    ADD CONSTRAINT invoice_payment_schedule_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_invoices(id) ON DELETE CASCADE;


--
-- Name: item_tax_templates item_tax_templates_tax_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.item_tax_templates
    ADD CONSTRAINT item_tax_templates_tax_template_id_fkey FOREIGN KEY (tax_template_id) REFERENCES public.tax_templates(id) ON DELETE CASCADE;


--
-- Name: journal_entry_lines journal_entry_lines_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_entry_lines
    ADD CONSTRAINT journal_entry_lines_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: journal_lines journal_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: journal_lines journal_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.journal_entries(id) ON DELETE CASCADE;


--
-- Name: licenses licenses_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: loyalty_point_entries loyalty_point_entries_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_point_entries
    ADD CONSTRAINT loyalty_point_entries_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.loyalty_programs(id) ON DELETE CASCADE;


--
-- Name: maintenance_visits maintenance_visits_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_visits
    ADD CONSTRAINT maintenance_visits_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.maintenance_schedules(id) ON DELETE CASCADE;


--
-- Name: manufacturing_job_card_time_logs manufacturing_job_card_time_logs_job_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_job_card_time_logs
    ADD CONSTRAINT manufacturing_job_card_time_logs_job_card_id_fkey FOREIGN KEY (job_card_id) REFERENCES public.manufacturing_job_cards(id) ON DELETE CASCADE;


--
-- Name: manufacturing_production_plan_items manufacturing_production_plan_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_production_plan_items
    ADD CONSTRAINT manufacturing_production_plan_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.manufacturing_production_plans(id) ON DELETE CASCADE;


--
-- Name: manufacturing_routing_operations manufacturing_routing_operations_routing_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_routing_operations
    ADD CONSTRAINT manufacturing_routing_operations_routing_id_fkey FOREIGN KEY (routing_id) REFERENCES public.manufacturing_routings(id) ON DELETE CASCADE;


--
-- Name: manufacturing_routing_operations manufacturing_routing_operations_workstation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturing_routing_operations
    ADD CONSTRAINT manufacturing_routing_operations_workstation_id_fkey FOREIGN KEY (workstation_id) REFERENCES public.manufacturing_workstations(id);


--
-- Name: material_request_items material_request_items_material_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.material_request_items
    ADD CONSTRAINT material_request_items_material_request_id_fkey FOREIGN KEY (material_request_id) REFERENCES public.material_requests(id) ON DELETE CASCADE;


--
-- Name: mps_items mps_items_mps_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mps_items
    ADD CONSTRAINT mps_items_mps_id_fkey FOREIGN KEY (mps_id) REFERENCES public.master_production_schedules(id) ON DELETE CASCADE;


--
-- Name: payment_requests payment_requests_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_requests
    ADD CONSTRAINT payment_requests_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_invoices(id);


--
-- Name: pos_price_list_items pos_price_list_items_price_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pos_price_list_items
    ADD CONSTRAINT pos_price_list_items_price_list_id_fkey FOREIGN KEY (price_list_id) REFERENCES public.pos_price_lists(id) ON DELETE CASCADE;


--
-- Name: procurement_rfq_items procurement_rfq_items_rfq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_rfq_items
    ADD CONSTRAINT procurement_rfq_items_rfq_id_fkey FOREIGN KEY (rfq_id) REFERENCES public.procurement_rfqs(id) ON DELETE CASCADE;


--
-- Name: procurement_rfq_suppliers procurement_rfq_suppliers_rfq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_rfq_suppliers
    ADD CONSTRAINT procurement_rfq_suppliers_rfq_id_fkey FOREIGN KEY (rfq_id) REFERENCES public.procurement_rfqs(id) ON DELETE CASCADE;


--
-- Name: procurement_supplier_quotation_items procurement_supplier_quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_supplier_quotation_items
    ADD CONSTRAINT procurement_supplier_quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.procurement_supplier_quotations(id) ON DELETE CASCADE;


--
-- Name: procurement_supplier_quotations procurement_supplier_quotations_rfq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement_supplier_quotations
    ADD CONSTRAINT procurement_supplier_quotations_rfq_id_fkey FOREIGN KEY (rfq_id) REFERENCES public.procurement_rfqs(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: reconciliation_items reconciliation_items_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reconciliation_items
    ADD CONSTRAINT reconciliation_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE;


--
-- Name: report_jobs report_jobs_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.report_jobs
    ADD CONSTRAINT report_jobs_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: sales_order_items sales_order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_order_items
    ADD CONSTRAINT sales_order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sales_orders(id) ON DELETE CASCADE;


--
-- Name: sales_partner_commissions sales_partner_commissions_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_partner_commissions
    ADD CONSTRAINT sales_partner_commissions_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES public.sales_partners(id) ON DELETE CASCADE;


--
-- Name: sales_quotation_items sales_quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales_quotation_items
    ADD CONSTRAINT sales_quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.sales_quotations(id) ON DELETE CASCADE;


--
-- Name: share_transfers share_transfers_from_shareholder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_from_shareholder_id_fkey FOREIGN KEY (from_shareholder_id) REFERENCES public.shareholders(id);


--
-- Name: share_transfers share_transfers_share_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_share_type_id_fkey FOREIGN KEY (share_type_id) REFERENCES public.share_types(id);


--
-- Name: share_transfers share_transfers_to_shareholder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.share_transfers
    ADD CONSTRAINT share_transfers_to_shareholder_id_fkey FOREIGN KEY (to_shareholder_id) REFERENCES public.shareholders(id);


--
-- Name: staff_advance_applications staff_advance_applications_advance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_advance_applications
    ADD CONSTRAINT staff_advance_applications_advance_id_fkey FOREIGN KEY (advance_id) REFERENCES public.staff_advances(id);


--
-- Name: staff_advances staff_advances_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_advances
    ADD CONSTRAINT staff_advances_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.imprest_funds(id);


--
-- Name: subcontract_materials subcontract_materials_subcontract_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcontract_materials
    ADD CONSTRAINT subcontract_materials_subcontract_order_id_fkey FOREIGN KEY (subcontract_order_id) REFERENCES public.subcontract_orders(id) ON DELETE CASCADE;


--
-- Name: subscription_invoices subscription_invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_invoices
    ADD CONSTRAINT subscription_invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE CASCADE;


--
-- Name: support_incidents support_incidents_linked_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_incidents
    ADD CONSTRAINT support_incidents_linked_ticket_id_fkey FOREIGN KEY (linked_ticket_id) REFERENCES public.support_tickets(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_assigned_engineer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_assigned_engineer_id_fkey FOREIGN KEY (assigned_engineer_id) REFERENCES public.engineer_profiles(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_backup_engineer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_backup_engineer_id_fkey FOREIGN KEY (backup_engineer_id) REFERENCES public.engineer_profiles(id) ON DELETE SET NULL;


--
-- Name: support_tickets support_tickets_sla_policy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_sla_policy_id_fkey FOREIGN KEY (sla_policy_id) REFERENCES public.sla_policies(id) ON DELETE SET NULL;


--
-- Name: task_assignments task_assignments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: task_assignments task_assignments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_assignments
    ADD CONSTRAINT task_assignments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_depends_on_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_depends_on_task_id_fkey FOREIGN KEY (depends_on_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_workstream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_workstream_id_fkey FOREIGN KEY (workstream_id) REFERENCES public.workstreams(id) ON DELETE CASCADE;


--
-- Name: tax_rules tax_rules_tax_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_rules
    ADD CONSTRAINT tax_rules_tax_template_id_fkey FOREIGN KEY (tax_template_id) REFERENCES public.tax_templates(id) ON DELETE CASCADE;


--
-- Name: tax_transactions tax_transactions_tax_return_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_transactions
    ADD CONSTRAINT tax_transactions_tax_return_id_fkey FOREIGN KEY (tax_return_id) REFERENCES public.tax_returns(id) ON DELETE SET NULL;


--
-- Name: tax_withholding_entries tax_withholding_entries_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_withholding_entries
    ADD CONSTRAINT tax_withholding_entries_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.tax_withholding_categories(id) ON DELETE CASCADE;


--
-- Name: tenant_admins tenant_admins_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_admins
    ADD CONSTRAINT tenant_admins_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: tenant_branches tenant_branches_parent_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_branches
    ADD CONSTRAINT tenant_branches_parent_branch_id_fkey FOREIGN KEY (parent_branch_id) REFERENCES public.tenant_branches(id) ON DELETE SET NULL;


--
-- Name: tenant_user_branches tenant_user_branches_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_user_branches
    ADD CONSTRAINT tenant_user_branches_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.tenant_branches(id) ON DELETE CASCADE;


--
-- Name: ticket_activity_logs ticket_activity_logs_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_activity_logs
    ADD CONSTRAINT ticket_activity_logs_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: ticket_comments ticket_comments_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_comments
    ADD CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;


--
-- Name: time_logs time_logs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: time_logs time_logs_task_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_task_assignment_id_fkey FOREIGN KEY (task_assignment_id) REFERENCES public.task_assignments(id) ON DELETE CASCADE;


--
-- Name: time_logs time_logs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_logs
    ADD CONSTRAINT time_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: training_events training_events_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_events
    ADD CONSTRAINT training_events_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.training_programs(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vendor_payment_applications vendor_payment_applications_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vendor_payment_applications
    ADD CONSTRAINT vendor_payment_applications_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;


--
-- Name: web_form_submissions web_form_submissions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.web_form_submissions
    ADD CONSTRAINT web_form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.web_forms(id) ON DELETE CASCADE;


--
-- Name: webhook_deliveries webhook_deliveries_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_deliveries
    ADD CONSTRAINT webhook_deliveries_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.webhook_subscriptions(id) ON DELETE CASCADE;


--
-- Name: work_order_materials work_order_materials_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_materials
    ADD CONSTRAINT work_order_materials_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: work_order_operations work_order_operations_work_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_order_operations
    ADD CONSTRAINT work_order_operations_work_order_id_fkey FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE;


--
-- Name: workstreams workstreams_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workstreams
    ADD CONSTRAINT workstreams_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict kFWLxqQG0LeE46RZnZR4OZbvzOGE1MlrwSiHk9nIZ4vFnMk6iaOLmOy1QvWidPd

