/**
 * Recruitment Database Operations (requisitions, candidates, applications, interviews, offers, onboarding)
 */

import { randomUUID } from "crypto";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";
import type {
  JobRequisitionRecord,
  CandidateRecord,
  ApplicationRecord,
  InterviewRecord,
  OfferRecord,
  OnboardingTaskRecord,
  ScreeningResult,
  ScreeningConfigRecord,
  BatchScreeningResult,
} from "./types";

function serializeTextArray(values?: string[] | null): string {
  if (!values || values.length === 0) return "{}";
  const escaped = values.map((v) => {
    const safe = v.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${safe}"`;
  });
  return `{${escaped.join(",")}}`;
}

// ============================================================================
// TABLE CREATION
// ============================================================================

export async function ensureRecruitmentTables(sql: SqlClient = SQL) {
  // Job Requisitions
  await sql`
    create table if not exists admin_job_requisitions (
      id text primary key,
      tenant_slug text not null,
      title text not null,
      department_id text not null,
      branch_id text,
      headcount integer not null default 1,
      budget numeric(15,2),
      required_skills text[] default array[]::text[],
      min_experience_years integer,
      employment_type text not null check (employment_type in ('full-time','part-time','contract','intern')),
      description text not null,
      requirements text,
      location text,
      salary_range text,
      status text default 'draft' check (status in ('draft','pending_approval','approved','open','paused','closed','cancelled')),
      approval_flow_id text,
      requested_by text not null,
      approved_by text,
      approved_at timestamptz,
      posted_at timestamptz,
      closed_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_reqs_tenant on admin_job_requisitions(tenant_slug)`;
  await sql`create index if not exists idx_admin_reqs_status on admin_job_requisitions(status)`;
  await sql`create index if not exists idx_admin_reqs_dept on admin_job_requisitions(department_id)`;
  await sql`alter table admin_job_requisitions alter column requested_by drop not null`;
  // Add new columns for enhanced screening
  await sql`alter table admin_job_requisitions add column if not exists preferred_skills text[] default array[]::text[]`;
  await sql`alter table admin_job_requisitions add column if not exists required_certifications text[] default array[]::text[]`;
  await sql`alter table admin_job_requisitions add column if not exists education_level text`;

  // Candidates
  await sql`
    create table if not exists admin_candidates (
      id text primary key,
      tenant_slug text not null,
      full_name text not null,
      email text not null,
      phone text,
      resume_url text,
      source text default 'manual' check (source in ('career_page','linkedin','indeed','referral','agency','job_fair','manual')),
      current_stage text default 'new' check (current_stage in ('new','screening','shortlist','interview','offer','hired','rejected','talent_pool')),
      skills text[] default array[]::text[],
      experience_years integer,
      education text,
      notes text,
      tags text[] default array[]::text[],
      overall_score numeric(5,2),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_candidates_tenant on admin_candidates(tenant_slug)`;
  await sql`create index if not exists idx_admin_candidates_stage on admin_candidates(current_stage)`;
  // Add new columns for enhanced screening
  await sql`alter table admin_candidates add column if not exists certifications text[] default array[]::text[]`;
  await sql`alter table admin_candidates add column if not exists expected_salary numeric(15,2)`;
  await sql`alter table admin_candidates add column if not exists location text`;

  // Applications
  await sql`
    create table if not exists admin_applications (
      id text primary key,
      tenant_slug text not null,
      candidate_id text not null,
      requisition_id text not null,
      status text default 'applied' check (status in ('applied','under_review','screened','shortlist','interview','offer_pending','offer_accepted','offer_rejected','withdrew')),
      ai_score numeric(5,2),
      screening_result jsonb,
      applied_at timestamptz default now(),
      reviewed_at timestamptz,
      decided_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_apps_tenant on admin_applications(tenant_slug)`;
  await sql`create index if not exists idx_admin_apps_candidate on admin_applications(candidate_id)`;
  await sql`create index if not exists idx_admin_apps_req on admin_applications(requisition_id)`;
  await sql`create index if not exists idx_admin_apps_status on admin_applications(status)`;

  // Interviews
  await sql`
    create table if not exists admin_interviews (
      id text primary key,
      tenant_slug text not null,
      application_id text not null,
      round_number integer not null default 1,
      type text not null check (type in ('technical','behavioral','cultural','executive','panel','phone_screen')),
      scheduled_at timestamptz not null,
      completed_at timestamptz,
      interviewer_ids text[] default array[]::text[],
      scorecard jsonb,
      notes text,
      recording_url text,
      status text default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show','rescheduled')),
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_interviews_tenant on admin_interviews(tenant_slug)`;
  await sql`create index if not exists idx_admin_interviews_app on admin_interviews(application_id)`;

  // Offers
  await sql`
    create table if not exists admin_offers (
      id text primary key,
      tenant_slug text not null,
      application_id text not null,
      salary numeric(15,2) not null,
      bonus numeric(15,2),
      benefits jsonb,
      start_date date not null,
      reporting_manager_id text not null,
      status text default 'draft' check (status in ('draft','sent','negotiated','accepted','rejected','expired','withdrawn')),
      candidate_response text,
      candidate_response_at timestamptz,
      sent_at timestamptz,
      expires_at timestamptz not null,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_offers_tenant on admin_offers(tenant_slug)`;
  await sql`create index if not exists idx_admin_offers_app on admin_offers(application_id)`;

  // Onboarding Tasks
  await sql`
    create table if not exists admin_onboarding_tasks (
      id text primary key,
      tenant_slug text not null,
      employee_id text not null,
      category text not null check (category in ('hr','it','admin','manager','compliance')),
      task text not null,
      assigned_to_user_id text not null,
      status text default 'pending' check (status in ('pending','in_progress','completed','overdue')),
      due_date date not null,
      completed_at timestamptz,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_onboarding_tenant on admin_onboarding_tasks(tenant_slug)`;
  await sql`create index if not exists idx_admin_onboarding_emp on admin_onboarding_tasks(employee_id)`;

  // Screening Config
  await sql`
    create table if not exists admin_requisition_screening_configs (
      requisition_id text primary key,
      tenant_slug text not null,
      selection_mode text not null check (selection_mode in ('percentage','fixed_number')),
      selection_value integer not null,
      min_score_threshold integer not null default 0,
      is_enabled boolean default true,
      custom_weights jsonb,
      auto_reject_rules jsonb default '[]'::jsonb,
      auto_reject_below_score integer not null default 0,
      auto_talent_pool_rejected boolean default false,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_screening_cfg_tenant on admin_requisition_screening_configs(tenant_slug)`;
  await sql`create index if not exists idx_admin_screening_cfg_req on admin_requisition_screening_configs(requisition_id)`;
  // Add new columns to existing screening configs (migration)
  await sql`alter table admin_requisition_screening_configs add column if not exists custom_weights jsonb`;
  await sql`alter table admin_requisition_screening_configs add column if not exists auto_reject_rules jsonb default '[]'::jsonb`;
  await sql`alter table admin_requisition_screening_configs add column if not exists auto_reject_below_score integer not null default 0`;
  await sql`alter table admin_requisition_screening_configs add column if not exists auto_talent_pool_rejected boolean default false`;

  // Application shortlist tracking
  await sql`alter table admin_applications add column if not exists shortlisted_at timestamptz`;
  await sql`alter table admin_applications add column if not exists shortlisted_by text default 'system' check (shortlisted_by in ('ai','hr','system'))`;

  // Screening History (audit trail)
  await sql`
    create table if not exists admin_screening_history (
      id text primary key,
      tenant_slug text not null,
      requisition_id text not null,
      application_id text not null,
      candidate_id text not null,
      candidate_name text,
      ai_score integer not null,
      confidence numeric(3,2) default 1.0,
      status text not null,
      auto_rejected boolean default false,
      auto_reject_reasons text[] default array[]::text[],
      breakdown jsonb,
      keyword_matches jsonb,
      config_snapshot jsonb,
      run_id text,
      created_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_screening_hist_tenant on admin_screening_history(tenant_slug)`;
  await sql`create index if not exists idx_admin_screening_hist_req on admin_screening_history(requisition_id)`;
  await sql`create index if not exists idx_admin_screening_hist_app on admin_screening_history(application_id)`;
  await sql`create index if not exists idx_admin_screening_hist_run on admin_screening_history(run_id)`;
}

// ============================================================================
// JOB REQUISITIONS
// ============================================================================

function normalizeRequisitionRow(row: any): JobRequisitionRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    title: row.title,
    departmentId: row.department_id,
    branchId: row.branch_id ?? null,
    headcount: row.headcount ?? 1,
    budget: row.budget ?? null,
    requiredSkills: Array.isArray(row.required_skills) ? row.required_skills : [],
    preferredSkills: Array.isArray(row.preferred_skills) ? row.preferred_skills : [],
    minExperienceYears: row.min_experience_years ?? null,
    employmentType: row.employment_type,
    description: row.description,
    requirements: row.requirements ?? null,
    location: row.location ?? null,
    salaryRange: row.salary_range ?? null,
    requiredCertifications: Array.isArray(row.required_certifications) ? row.required_certifications : [],
    educationLevel: row.education_level ?? null,
    status: row.status,
    approvalFlowId: row.approval_flow_id ?? null,
    requestedBy: row.requested_by,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    postedAt: row.posted_at ?? null,
    closedAt: row.closed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertRequisition(row: {
  tenantSlug: string;
  title: string;
  departmentId: string;
  branchId?: string | null;
  headcount?: number;
  budget?: number | null;
  requiredSkills?: string[];
  preferredSkills?: string[];
  minExperienceYears?: number | null;
  employmentType: string;
  description: string;
  requirements?: string | null;
  location?: string | null;
  salaryRange?: string | null;
  requiredCertifications?: string[];
  educationLevel?: string | null;
  requestedBy?: string;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const id = randomUUID();
  const skillsLit = serializeTextArray(row.requiredSkills);
  const preferredLit = serializeTextArray(row.preferredSkills);
  const certsLit = serializeTextArray(row.requiredCertifications);
  await sql`
    insert into admin_job_requisitions (
      id, tenant_slug, title, department_id, branch_id, headcount, budget,
      required_skills, preferred_skills, min_experience_years, employment_type, description,
      requirements, location, salary_range, required_certifications, education_level, status, requested_by
    ) values (
      ${id}, ${row.tenantSlug}, ${row.title}, ${row.departmentId}, ${row.branchId ?? null},
      ${row.headcount ?? 1}, ${row.budget ?? null}, ${skillsLit}::text[],
      ${preferredLit}::text[], ${row.minExperienceYears ?? null}, ${row.employmentType}, ${row.description},
      ${row.requirements ?? null}, ${row.location ?? null}, ${row.salaryRange ?? null},
      ${certsLit}::text[], ${row.educationLevel ?? null}, 'draft', ${row.requestedBy ?? 'system'}
    )
  `;
  const inserted = await sql`select * from admin_job_requisitions where id = ${id} limit 1`;
  return normalizeRequisitionRow((inserted as any[])[0]);
}

export async function updateRequisition(
  id: string,
  tenantSlug: string,
  updates: Partial<{
    title: string;
    departmentId: string;
    branchId: string | null;
    headcount: number;
    budget: number | null;
    requiredSkills: string[];
    preferredSkills: string[];
    minExperienceYears: number | null;
    employmentType: string;
    description: string;
    requirements: string | null;
    location: string | null;
    salaryRange: string | null;
    requiredCertifications: string[];
    educationLevel: string | null;
    status: string;
    postedAt: string | null;
    closedAt: string | null;
  }>
) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);

  const updated = await sql`
    update admin_job_requisitions set
      title = coalesce(${updates.title ?? null}, title),
      department_id = coalesce(${updates.departmentId ?? null}, department_id),
      branch_id = coalesce(${updates.branchId ?? null}, branch_id),
      headcount = coalesce(${updates.headcount ?? null}, headcount),
      budget = coalesce(${updates.budget ?? null}, budget),
      min_experience_years = coalesce(${updates.minExperienceYears ?? null}, min_experience_years),
      employment_type = coalesce(${updates.employmentType ?? null}, employment_type),
      description = coalesce(${updates.description ?? null}, description),
      requirements = coalesce(${updates.requirements ?? null}, requirements),
      location = coalesce(${updates.location ?? null}, location),
      salary_range = coalesce(${updates.salaryRange ?? null}, salary_range),
      education_level = coalesce(${updates.educationLevel ?? null}, education_level),
      status = coalesce(${updates.status ?? null}, status),
      posted_at = coalesce(${updates.postedAt ?? null}, posted_at),
      closed_at = coalesce(${updates.closedAt ?? null}, closed_at),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `;

  if (updates.requiredSkills !== undefined) {
    const skillsLit = serializeTextArray(updates.requiredSkills);
    await sql`update admin_job_requisitions set required_skills = ${skillsLit}::text[] where id = ${id}`;
  }
  if (updates.preferredSkills !== undefined) {
    const preferredLit = serializeTextArray(updates.preferredSkills);
    await sql`update admin_job_requisitions set preferred_skills = ${preferredLit}::text[] where id = ${id}`;
  }
  if (updates.requiredCertifications !== undefined) {
    const certsLit = serializeTextArray(updates.requiredCertifications);
    await sql`update admin_job_requisitions set required_certifications = ${certsLit}::text[] where id = ${id}`;
  }

  const rows = updated as any[];
  if (rows.length) {
    const refreshed = await sql`select * from admin_job_requisitions where id = ${id} limit 1`;
    return normalizeRequisitionRow((refreshed as any[])[0]);
  }
  return null;
}

export async function deleteRequisition(id: string, tenantSlug: string) {
  const sql = SQL;
  await sql`delete from admin_job_requisitions where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function listRequisitions(filters: {
  tenantSlug: string;
  status?: string;
  departmentId?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
  const offset = filters.offset ?? 0;

  let query = `select * from admin_job_requisitions where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }
  if (filters.departmentId) {
    params.push(filters.departmentId);
    query += ` and department_id = $${params.length}`;
  }

  query += ` order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeRequisitionRow);
}

export async function countRequisitions(filters: {
  tenantSlug: string;
  status?: string;
  departmentId?: string;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  let query = `select count(*)::int as cnt from admin_job_requisitions where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }
  if (filters.departmentId) {
    params.push(filters.departmentId);
    query += ` and department_id = $${params.length}`;
  }

  const res = await db.query(query, params);
  return res.rows.length ? Number(res.rows[0].cnt) : 0;
}

export async function getRequisitionById(id: string, tenantSlug: string) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const rows = await sql`select * from admin_job_requisitions where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeRequisitionRow(arr[0]) : null;
}

// ============================================================================
// CANDIDATES
// ============================================================================

function normalizeCandidateRow(row: any): CandidateRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone ?? null,
    resumeUrl: row.resume_url ?? null,
    source: row.source,
    currentStage: row.current_stage,
    skills: Array.isArray(row.skills) ? row.skills : [],
    experienceYears: row.experience_years ?? null,
    education: row.education ?? null,
    certifications: Array.isArray(row.certifications) ? row.certifications : [],
    expectedSalary: row.expected_salary ?? null,
    location: row.location ?? null,
    notes: row.notes ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    overallScore: row.overall_score ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertCandidate(row: {
  tenantSlug: string;
  fullName: string;
  email: string;
  phone?: string | null;
  resumeUrl?: string | null;
  source?: string;
  currentStage?: string;
  skills?: string[];
  experienceYears?: number | null;
  education?: string | null;
  certifications?: string[];
  expectedSalary?: number | null;
  location?: string | null;
  notes?: string | null;
  tags?: string[];
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const id = randomUUID();
  const skillsLit = serializeTextArray(row.skills);
  const tagsLit = serializeTextArray(row.tags);
  const certsLit = serializeTextArray(row.certifications);
  await sql`
    insert into admin_candidates (
      id, tenant_slug, full_name, email, phone, resume_url, source,
      current_stage, skills, experience_years, education, certifications,
      expected_salary, location, notes, tags
    ) values (
      ${id}, ${row.tenantSlug}, ${row.fullName}, ${row.email}, ${row.phone ?? null},
      ${row.resumeUrl ?? null}, ${row.source ?? "manual"}, ${row.currentStage ?? "new"},
      ${skillsLit}::text[], ${row.experienceYears ?? null}, ${row.education ?? null},
      ${certsLit}::text[], ${row.expectedSalary ?? null}, ${row.location ?? null},
      ${row.notes ?? null}, ${tagsLit}::text[]
    )
  `;
  const inserted = await sql`select * from admin_candidates where id = ${id} limit 1`;
  return normalizeCandidateRow((inserted as any[])[0]);
}

export async function updateCandidate(
  id: string,
  tenantSlug: string,
  updates: Partial<{
    fullName: string;
    email: string;
    phone: string | null;
    resumeUrl: string | null;
    source: string;
    currentStage: string;
    skills: string[];
    experienceYears: number | null;
    education: string | null;
    certifications: string[];
    expectedSalary: number | null;
    location: string | null;
    notes: string | null;
    tags: string[];
    overallScore: number | null;
  }>
) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);

  const updated = await sql`
    update admin_candidates set
      full_name = coalesce(${updates.fullName ?? null}, full_name),
      email = coalesce(${updates.email ?? null}, email),
      phone = coalesce(${updates.phone ?? null}, phone),
      resume_url = coalesce(${updates.resumeUrl ?? null}, resume_url),
      source = coalesce(${updates.source ?? null}, source),
      current_stage = coalesce(${updates.currentStage ?? null}, current_stage),
      experience_years = coalesce(${updates.experienceYears ?? null}, experience_years),
      education = coalesce(${updates.education ?? null}, education),
      expected_salary = coalesce(${updates.expectedSalary ?? null}, expected_salary),
      location = coalesce(${updates.location ?? null}, location),
      notes = coalesce(${updates.notes ?? null}, notes),
      overall_score = coalesce(${updates.overallScore ?? null}, overall_score),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `;

  if (updates.skills !== undefined) {
    const skillsLit = serializeTextArray(updates.skills);
    await sql`update admin_candidates set skills = ${skillsLit}::text[] where id = ${id}`;
  }
  if (updates.tags !== undefined) {
    const tagsLit = serializeTextArray(updates.tags);
    await sql`update admin_candidates set tags = ${tagsLit}::text[] where id = ${id}`;
  }
  if (updates.certifications !== undefined) {
    const certsLit = serializeTextArray(updates.certifications);
    await sql`update admin_candidates set certifications = ${certsLit}::text[] where id = ${id}`;
  }

  const rows = updated as any[];
  if (rows.length) {
    const refreshed = await sql`select * from admin_candidates where id = ${id} limit 1`;
    return normalizeCandidateRow((refreshed as any[])[0]);
  }
  return null;
}

export async function deleteCandidate(id: string, tenantSlug: string) {
  const sql = SQL;
  await sql`delete from admin_candidates where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function listCandidates(filters: {
  tenantSlug: string;
  currentStage?: string;
  source?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
  const offset = filters.offset ?? 0;

  let query = `select * from admin_candidates where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.currentStage) {
    params.push(filters.currentStage);
    query += ` and current_stage = $${params.length}`;
  }
  if (filters.source) {
    params.push(filters.source);
    query += ` and source = $${params.length}`;
  }

  query += ` order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeCandidateRow);
}

export async function countCandidates(filters: {
  tenantSlug: string;
  currentStage?: string;
  source?: string;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  let query = `select count(*)::int as cnt from admin_candidates where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.currentStage) {
    params.push(filters.currentStage);
    query += ` and current_stage = $${params.length}`;
  }
  if (filters.source) {
    params.push(filters.source);
    query += ` and source = $${params.length}`;
  }

  const res = await db.query(query, params);
  return res.rows.length ? Number(res.rows[0].cnt) : 0;
}

export async function getCandidateById(id: string, tenantSlug: string) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const rows = await sql`select * from admin_candidates where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeCandidateRow(arr[0]) : null;
}

// ============================================================================
// APPLICATIONS
// ============================================================================

function normalizeApplicationRow(row: any): ApplicationRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    candidateId: row.candidate_id,
    requisitionId: row.requisition_id,
    status: row.status,
    aiScore: row.ai_score ?? null,
    screeningResult: row.screening_result ?? null,
    appliedAt: row.applied_at,
    reviewedAt: row.reviewed_at ?? null,
    decidedAt: row.decided_at ?? null,
    shortlistedAt: row.shortlisted_at ?? null,
    shortlistedBy: row.shortlisted_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertApplication(row: {
  tenantSlug: string;
  candidateId: string;
  requisitionId: string;
  coverLetter?: string | null;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_applications (id, tenant_slug, candidate_id, requisition_id)
    values (${id}, ${row.tenantSlug}, ${row.candidateId}, ${row.requisitionId})
  `;
  const inserted = await sql`select * from admin_applications where id = ${id} limit 1`;
  return normalizeApplicationRow((inserted as any[])[0]);
}

export async function updateApplication(
  id: string,
  tenantSlug: string,
  updates: Partial<{
    status: string;
    aiScore: number | null;
    screeningResult: Record<string, any> | null;
    reviewedAt: string | null;
    decidedAt: string | null;
  }>
) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const updated = await sql`
    update admin_applications set
      status = coalesce(${updates.status ?? null}, status),
      ai_score = coalesce(${updates.aiScore ?? null}, ai_score),
      screening_result = coalesce(${updates.screeningResult ?? null}, screening_result),
      reviewed_at = coalesce(${updates.reviewedAt ?? null}, reviewed_at),
      decided_at = coalesce(${updates.decidedAt ?? null}, decided_at),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `;
  const rows = updated as any[];
  return rows.length ? normalizeApplicationRow(rows[0]) : null;
}

export async function deleteApplication(id: string, tenantSlug: string) {
  const sql = SQL;
  await sql`delete from admin_applications where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function listApplications(filters: {
  tenantSlug: string;
  candidateId?: string;
  requisitionId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
  const offset = filters.offset ?? 0;

  let query = `select * from admin_applications where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.candidateId) {
    params.push(filters.candidateId);
    query += ` and candidate_id = $${params.length}`;
  }
  if (filters.requisitionId) {
    params.push(filters.requisitionId);
    query += ` and requisition_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }

  query += ` order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeApplicationRow);
}

export async function countApplications(filters: {
  tenantSlug: string;
  requisitionId?: string;
  status?: string;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  let query = `select count(*)::int as cnt from admin_applications where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.requisitionId) {
    params.push(filters.requisitionId);
    query += ` and requisition_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }

  const res = await db.query(query, params);
  return res.rows.length ? Number(res.rows[0].cnt) : 0;
}

export async function getApplicationById(id: string, tenantSlug: string) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const rows = await sql`select * from admin_applications where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeApplicationRow(arr[0]) : null;
}

// ============================================================================
// INTERVIEWS
// ============================================================================

function normalizeInterviewRow(row: any): InterviewRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    applicationId: row.application_id,
    roundNumber: row.round_number ?? 1,
    type: row.type,
    scheduledAt: row.scheduled_at,
    completedAt: row.completed_at ?? null,
    interviewerIds: Array.isArray(row.interviewer_ids) ? row.interviewer_ids : [],
    scorecard: row.scorecard ?? null,
    notes: row.notes ?? null,
    recordingUrl: row.recording_url ?? null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertInterview(row: {
  tenantSlug: string;
  applicationId: string;
  roundNumber?: number;
  type: string;
  scheduledAt: string;
  interviewerIds: string[];
  notes?: string | null;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const id = randomUUID();
  const idsLit = serializeTextArray(row.interviewerIds);
  await sql`
    insert into admin_interviews (id, tenant_slug, application_id, round_number, type, scheduled_at, interviewer_ids, notes)
    values (${id}, ${row.tenantSlug}, ${row.applicationId}, ${row.roundNumber ?? 1}, ${row.type}, ${row.scheduledAt}, ${idsLit}::text[], ${row.notes ?? null})
  `;
  const inserted = await sql`select * from admin_interviews where id = ${id} limit 1`;
  return normalizeInterviewRow((inserted as any[])[0]);
}

export async function updateInterview(
  id: string,
  tenantSlug: string,
  updates: Partial<{
    type: string;
    scheduledAt: string;
    completedAt: string | null;
    interviewerIds: string[];
    scorecard: Record<string, any> | null;
    notes: string | null;
    recordingUrl: string | null;
    status: string;
  }>
) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);

  const updated = await sql`
    update admin_interviews set
      type = coalesce(${updates.type ?? null}, type),
      scheduled_at = coalesce(${updates.scheduledAt ?? null}, scheduled_at),
      completed_at = coalesce(${updates.completedAt ?? null}, completed_at),
      scorecard = coalesce(${updates.scorecard ?? null}, scorecard),
      notes = coalesce(${updates.notes ?? null}, notes),
      recording_url = coalesce(${updates.recordingUrl ?? null}, recording_url),
      status = coalesce(${updates.status ?? null}, status),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `;

  if (updates.interviewerIds !== undefined) {
    const idsLit = serializeTextArray(updates.interviewerIds);
    await sql`update admin_interviews set interviewer_ids = ${idsLit}::text[] where id = ${id}`;
  }

  const rows = updated as any[];
  if (rows.length) {
    const refreshed = await sql`select * from admin_interviews where id = ${id} limit 1`;
    return normalizeInterviewRow((refreshed as any[])[0]);
  }
  return null;
}

export async function deleteInterview(id: string, tenantSlug: string) {
  const sql = SQL;
  await sql`delete from admin_interviews where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function listInterviews(filters: {
  tenantSlug: string;
  applicationId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
  const offset = filters.offset ?? 0;

  let query = `select * from admin_interviews where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.applicationId) {
    params.push(filters.applicationId);
    query += ` and application_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }

  query += ` order by scheduled_at desc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeInterviewRow);
}

export async function getInterviewById(id: string, tenantSlug: string) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const rows = await sql`select * from admin_interviews where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeInterviewRow(arr[0]) : null;
}

// ============================================================================
// OFFERS
// ============================================================================

function normalizeOfferRow(row: any): OfferRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    applicationId: row.application_id,
    salary: row.salary,
    bonus: row.bonus ?? null,
    benefits: row.benefits ?? null,
    startDate: row.start_date,
    reportingManagerId: row.reporting_manager_id,
    status: row.status,
    candidateResponse: row.candidate_response ?? null,
    candidateResponseAt: row.candidate_response_at ?? null,
    sentAt: row.sent_at ?? null,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertOffer(row: {
  tenantSlug: string;
  applicationId: string;
  salary: number;
  bonus?: number | null;
  benefits?: Record<string, any> | null;
  startDate: string;
  reportingManagerId: string;
  expiresAt: string;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_offers (id, tenant_slug, application_id, salary, bonus, benefits, start_date, reporting_manager_id, expires_at)
    values (${id}, ${row.tenantSlug}, ${row.applicationId}, ${row.salary}, ${row.bonus ?? null}, ${row.benefits ?? null}, ${row.startDate}, ${row.reportingManagerId}, ${row.expiresAt})
  `;
  const inserted = await sql`select * from admin_offers where id = ${id} limit 1`;
  return normalizeOfferRow((inserted as any[])[0]);
}

export async function updateOffer(
  id: string,
  tenantSlug: string,
  updates: Partial<{
    salary: number;
    bonus: number | null;
    benefits: Record<string, any> | null;
    startDate: string;
    reportingManagerId: string;
    status: string;
    candidateResponse: string | null;
    candidateResponseAt: string | null;
    expiresAt: string;
    sentAt: string | null;
  }>
) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const updated = await sql`
    update admin_offers set
      salary = coalesce(${updates.salary ?? null}, salary),
      bonus = coalesce(${updates.bonus ?? null}, bonus),
      benefits = coalesce(${updates.benefits ?? null}, benefits),
      start_date = coalesce(${updates.startDate ?? null}, start_date),
      reporting_manager_id = coalesce(${updates.reportingManagerId ?? null}, reporting_manager_id),
      status = coalesce(${updates.status ?? null}, status),
      candidate_response = coalesce(${updates.candidateResponse ?? null}, candidate_response),
      candidate_response_at = coalesce(${updates.candidateResponseAt ?? null}, candidate_response_at),
      sent_at = coalesce(${updates.sentAt ?? null}, sent_at),
      expires_at = coalesce(${updates.expiresAt ?? null}, expires_at),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `;
  const rows = updated as any[];
  return rows.length ? normalizeOfferRow(rows[0]) : null;
}

export async function deleteOffer(id: string, tenantSlug: string) {
  const sql = SQL;
  await sql`delete from admin_offers where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function listOffers(filters: {
  tenantSlug: string;
  applicationId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
  const offset = filters.offset ?? 0;

  let query = `select * from admin_offers where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.applicationId) {
    params.push(filters.applicationId);
    query += ` and application_id = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }

  query += ` order by created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeOfferRow);
}

export async function getOfferById(id: string, tenantSlug: string) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const rows = await sql`select * from admin_offers where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeOfferRow(arr[0]) : null;
}

// ============================================================================
// ONBOARDING TASKS
// ============================================================================

function normalizeOnboardingRow(row: any): OnboardingTaskRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    employeeId: row.employee_id,
    category: row.category,
    task: row.task,
    assignedToUserId: row.assigned_to_user_id,
    status: row.status,
    dueDate: row.due_date,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertOnboardingTask(row: {
  tenantSlug: string;
  employeeId: string;
  category: string;
  task: string;
  assignedToUserId: string;
  dueDate: string;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_onboarding_tasks (id, tenant_slug, employee_id, category, task, assigned_to_user_id, due_date)
    values (${id}, ${row.tenantSlug}, ${row.employeeId}, ${row.category}, ${row.task}, ${row.assignedToUserId}, ${row.dueDate})
  `;
  const inserted = await sql`select * from admin_onboarding_tasks where id = ${id} limit 1`;
  return normalizeOnboardingRow((inserted as any[])[0]);
}

export async function updateOnboardingTask(
  id: string,
  tenantSlug: string,
  updates: Partial<{
    category: string;
    task: string;
    assignedToUserId: string;
    status: string;
    dueDate: string;
    completedAt: string | null;
  }>
) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const updated = await sql`
    update admin_onboarding_tasks set
      category = coalesce(${updates.category ?? null}, category),
      task = coalesce(${updates.task ?? null}, task),
      assigned_to_user_id = coalesce(${updates.assignedToUserId ?? null}, assigned_to_user_id),
      status = coalesce(${updates.status ?? null}, status),
      due_date = coalesce(${updates.dueDate ?? null}, due_date),
      completed_at = coalesce(${updates.completedAt ?? null}, completed_at),
      updated_at = now()
    where id = ${id} and tenant_slug = ${tenantSlug}
    returning *
  `;
  const rows = updated as any[];
  return rows.length ? normalizeOnboardingRow(rows[0]) : null;
}

export async function deleteOnboardingTask(id: string, tenantSlug: string) {
  const sql = SQL;
  await sql`delete from admin_onboarding_tasks where id = ${id} and tenant_slug = ${tenantSlug}`;
}

export async function listOnboardingTasks(filters: {
  tenantSlug: string;
  employeeId?: string;
  category?: string;
  status?: string;
  assignedToUserId?: string;
  limit?: number;
  offset?: number;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const limit = filters.limit ? Math.min(Math.max(filters.limit, 1), 100) : 50;
  const offset = filters.offset ?? 0;

  let query = `select * from admin_onboarding_tasks where tenant_slug = $1`;
  const params: any[] = [filters.tenantSlug];

  if (filters.employeeId) {
    params.push(filters.employeeId);
    query += ` and employee_id = $${params.length}`;
  }
  if (filters.category) {
    params.push(filters.category);
    query += ` and category = $${params.length}`;
  }
  if (filters.status) {
    params.push(filters.status);
    query += ` and status = $${params.length}`;
  }
  if (filters.assignedToUserId) {
    params.push(filters.assignedToUserId);
    query += ` and assigned_to_user_id = $${params.length}`;
  }

  query += ` order by due_date asc limit $${params.length + 1} offset $${params.length + 2}`;
  params.push(limit, offset);

  const res = await db.query(query, params);
  return (res.rows as any[]).map(normalizeOnboardingRow);
}

export async function getOnboardingTaskById(id: string, tenantSlug: string) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const rows = await sql`select * from admin_onboarding_tasks where id = ${id} and tenant_slug = ${tenantSlug} limit 1`;
  const arr = rows as any[];
  return arr.length ? normalizeOnboardingRow(arr[0]) : null;
}

// ============================================================================
// SCREENING (Deterministic, no LLM)
// ============================================================================

export async function runApplicationScreening(
  applicationId: string,
  tenantSlug: string
): Promise<ScreeningResult> {
  const sql = SQL;
  await ensureRecruitmentTables(sql);

  const appRows = await sql`select * from admin_applications where id = ${applicationId} and tenant_slug = ${tenantSlug} limit 1`;
  const app = (appRows as any[])[0];
  if (!app) throw new Error("Application not found");

  const candRows = await sql`select * from admin_candidates where id = ${app.candidate_id} and tenant_slug = ${tenantSlug} limit 1`;
  const candidate = (candRows as any[])[0];
  if (!candidate) throw new Error("Candidate not found");

  const reqRows = await sql`select * from admin_job_requisitions where id = ${app.requisition_id} and tenant_slug = ${tenantSlug} limit 1`;
  const requisition = (reqRows as any[])[0];
  if (!requisition) throw new Error("Requisition not found");

  const config = await getScreeningConfig(app.requisition_id, tenantSlug);
  const customWeights = config?.customWeights ?? null;
  const autoRejectRules = config?.autoRejectRules ?? [];
  const autoRejectBelowScore = config?.autoRejectBelowScore ?? 0;

  const result = scoreSingleApplication(candidate, requisition, customWeights, autoRejectRules, autoRejectBelowScore);

  const reasons: string[] = [];
  if (result.autoRejected) reasons.push(...result.autoRejectReasons);
  result.breakdown.forEach((c) => {
    if (c.score < c.maxScore * 0.5) reasons.push(`${c.criteria}: ${c.reason}`);
  });

  const passed = !result.autoRejected && result.score >= (config?.minScoreThreshold ?? 60);

  const screeningResult: ScreeningResult = {
    passed,
    score: result.score,
    maxScore: 100,
    confidence: result.confidence,
    autoRejected: result.autoRejected,
    autoRejectReasons: result.autoRejectReasons,
    breakdown: result.breakdown,
    reasons,
    keywordMatches: result.keywordMatches,
  };

  await sql`
    update admin_applications set
      ai_score = ${result.score},
      screening_result = ${screeningResult as any},
      status = ${result.autoRejected ? "screened" : (passed ? "screened" : "under_review")},
      reviewed_at = now(),
      updated_at = now()
    where id = ${applicationId} and tenant_slug = ${tenantSlug}
  `;

  return screeningResult;
}

// ============================================================================
// SCREENING CONFIG
// ============================================================================

function normalizeScreeningConfigRow(row: any): ScreeningConfigRecord {
  return {
    requisitionId: row.requisition_id,
    tenantSlug: row.tenant_slug,
    selectionMode: row.selection_mode,
    selectionValue: row.selection_value,
    minScoreThreshold: row.min_score_threshold,
    isEnabled: row.is_enabled ?? true,
    customWeights: row.custom_weights ?? null,
    autoRejectRules: row.auto_reject_rules ?? null,
    autoRejectBelowScore: row.auto_reject_below_score ?? 0,
    autoTalentPoolRejected: row.auto_talent_pool_rejected ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getScreeningConfig(requisitionId: string, tenantSlug: string) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const rows = await sql`
    select * from admin_requisition_screening_configs
    where requisition_id = ${requisitionId} and tenant_slug = ${tenantSlug}
    limit 1
  `;
  const arr = rows as any[];
  return arr.length ? normalizeScreeningConfigRow(arr[0]) : null;
}

export async function saveScreeningConfig(row: {
  requisitionId: string;
  tenantSlug: string;
  selectionMode: "percentage" | "fixed_number";
  selectionValue: number;
  minScoreThreshold?: number;
  isEnabled?: boolean;
  customWeights?: Record<string, number> | null;
  autoRejectRules?: Array<{ field: string; operator: string; value?: any }> | null;
  autoRejectBelowScore?: number;
  autoTalentPoolRejected?: boolean;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  await sql`
    insert into admin_requisition_screening_configs (
      requisition_id, tenant_slug, selection_mode, selection_value,
      min_score_threshold, is_enabled, custom_weights, auto_reject_rules,
      auto_reject_below_score, auto_talent_pool_rejected
    ) values (
      ${row.requisitionId}, ${row.tenantSlug}, ${row.selectionMode},
      ${row.selectionValue}, ${row.minScoreThreshold ?? 0}, ${row.isEnabled ?? true},
      ${row.customWeights ?? null}::jsonb, ${row.autoRejectRules ?? []}::jsonb,
      ${row.autoRejectBelowScore ?? 0}, ${row.autoTalentPoolRejected ?? false}
    )
    on conflict (requisition_id) do update set
      selection_mode = excluded.selection_mode,
      selection_value = excluded.selection_value,
      min_score_threshold = excluded.min_score_threshold,
      is_enabled = excluded.is_enabled,
      custom_weights = excluded.custom_weights,
      auto_reject_rules = excluded.auto_reject_rules,
      auto_reject_below_score = excluded.auto_reject_below_score,
      auto_talent_pool_rejected = excluded.auto_talent_pool_rejected,
      updated_at = now()
  `;
  return getScreeningConfig(row.requisitionId, row.tenantSlug);
}

// ============================================================================
// BATCH AI SCREENING
// ============================================================================

export async function runBatchAIScreening(
  requisitionId: string,
  tenantSlug: string,
  overrides?: { selectionMode?: "percentage" | "fixed_number"; selectionValue?: number; minScoreThreshold?: number }
): Promise<BatchScreeningResult> {
  const sql = SQL;
  await ensureRecruitmentTables(sql);

  // Fetch config (or defaults)
  const config = await getScreeningConfig(requisitionId, tenantSlug);
  const selectionMode = overrides?.selectionMode ?? config?.selectionMode ?? "percentage";
  const selectionValue = overrides?.selectionValue ?? config?.selectionValue ?? 20;
  const minScoreThreshold = overrides?.minScoreThreshold ?? config?.minScoreThreshold ?? 0;
  const customWeights = config?.customWeights ?? null;
  const autoRejectRules = config?.autoRejectRules ?? [];
  const autoRejectBelowScore = config?.autoRejectBelowScore ?? 0;
  const autoTalentPoolRejected = config?.autoTalentPoolRejected ?? false;

  // Fetch requisition
  const reqRows = await sql`select * from admin_job_requisitions where id = ${requisitionId} and tenant_slug = ${tenantSlug} limit 1`;
  const requisition = (reqRows as any[])[0];
  if (!requisition) throw new Error("Requisition not found");

  // Fetch all applications for this requisition with full candidate data
  const appRows = await sql`
    select a.*, c.full_name, c.skills, c.experience_years, c.education,
           c.resume_url, c.source, c.certifications, c.expected_salary, c.location,
           c.id as candidate_id
    from admin_applications a
    join admin_candidates c on c.id = a.candidate_id
    where a.requisition_id = ${requisitionId}
      and a.tenant_slug = ${tenantSlug}
      and a.status in ('applied', 'under_review', 'screened')
    order by a.applied_at desc
  `;
  const apps = appRows as any[];
  if (apps.length === 0) {
    return { screened: 0, shortlisted: 0, autoRejected: 0, talentPooled: 0, thresholdScore: 0, results: [] };
  }

  const configSnapshot = { selectionMode, selectionValue, minScoreThreshold, customWeights, autoRejectRules, autoRejectBelowScore, autoTalentPoolRejected };
  const runId = randomUUID();

  // Score each application with enhanced engine
  const scored = apps.map((app) => {
    const candidate = {
      id: app.candidate_id,
      experience_years: app.experience_years,
      skills: app.skills,
      education: app.education,
      resume_url: app.resume_url,
      source: app.source,
      certifications: app.certifications,
      expected_salary: app.expected_salary,
      location: app.location,
    };
    const result = scoreSingleApplication(candidate, requisition, customWeights, autoRejectRules, autoRejectBelowScore);
    return {
      applicationId: app.id,
      candidateId: app.candidate_id,
      candidateName: app.full_name,
      aiScore: result.score,
      confidence: result.confidence,
      autoRejected: result.autoRejected,
      autoRejectReasons: result.autoRejectReasons,
      breakdown: result.breakdown,
      keywordMatches: result.keywordMatches,
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.aiScore - a.aiScore);

  // Separate auto-rejected from candidates
  const autoRejected = scored.filter((s) => s.autoRejected);
  const eligible = scored.filter((s) => !s.autoRejected);

  // Determine cutoff from eligible (non-auto-rejected) candidates
  let cutoffCount: number;
  if (selectionMode === "percentage") {
    cutoffCount = Math.max(1, Math.round((selectionValue / 100) * eligible.length));
  } else {
    cutoffCount = Math.min(selectionValue, eligible.length);
  }

  // Apply threshold to shortlist
  const shortlisted = eligible.slice(0, cutoffCount).filter((s) => s.aiScore >= minScoreThreshold);
  const shortlistedIds = new Set(shortlisted.map((s) => s.applicationId));
  const autoRejectedIds = new Set(autoRejected.map((s) => s.applicationId));

  // Persist scores and statuses
  for (const s of scored) {
    let status: string;
    if (shortlistedIds.has(s.applicationId)) {
      status = "shortlist";
    } else if (autoRejectedIds.has(s.applicationId)) {
      status = autoTalentPoolRejected ? "screened" : "screened"; // Keep as screened; talent pool routing is on candidate
    } else {
      status = "screened";
    }

    const screeningData = {
      score: s.aiScore,
      confidence: s.confidence,
      autoRejected: s.autoRejected,
      autoRejectReasons: s.autoRejectReasons,
      breakdown: s.breakdown,
      keywordMatches: s.keywordMatches,
    };

    await sql`
      update admin_applications set
        ai_score = ${s.aiScore},
        screening_result = ${screeningData as any},
        status = ${status},
        shortlisted_at = ${shortlistedIds.has(s.applicationId) ? new Date().toISOString() : null},
        shortlisted_by = ${shortlistedIds.has(s.applicationId) ? "ai" : null},
        reviewed_at = now(),
        updated_at = now()
      where id = ${s.applicationId} and tenant_slug = ${tenantSlug}
    `;

    // Auto-route rejected candidates to talent pool
    if (s.autoRejected && autoTalentPoolRejected) {
      await sql`
        update admin_candidates set current_stage = 'talent_pool', updated_at = now()
        where id = ${s.candidateId} and tenant_slug = ${tenantSlug}
      `;
    }

    // Record screening history
    const histId = randomUUID();
    try {
      await sql`
        insert into admin_screening_history (
          id, tenant_slug, requisition_id, application_id, candidate_id, candidate_name,
          ai_score, confidence, status, auto_rejected, auto_reject_reasons,
          breakdown, keyword_matches, config_snapshot, run_id
        ) values (
          ${histId}, ${tenantSlug}, ${requisitionId}, ${s.applicationId}, ${s.candidateId}, ${s.candidateName},
          ${s.aiScore}, ${s.confidence}, ${status}, ${s.autoRejected},
          ${s.autoRejectReasons}::text[], ${s.breakdown as any}, ${s.keywordMatches as any},
          ${configSnapshot as any}, ${runId}
        )
      `;
    } catch (e) { console.error('Screening history insert failed:', (e as any)?.message); }
  }

  const talentPooled = autoRejected.filter((s) => autoTalentPoolRejected).length;

  return {
    screened: scored.length,
    shortlisted: shortlisted.length,
    autoRejected: autoRejected.length,
    talentPooled,
    thresholdScore: shortlisted.length > 0 ? shortlisted[shortlisted.length - 1].aiScore : 0,
    results: scored.map((s) => ({
      applicationId: s.applicationId,
      candidateId: s.candidateId,
      candidateName: s.candidateName,
      aiScore: s.aiScore,
      confidence: s.confidence,
      status: shortlistedIds.has(s.applicationId) ? "shortlist" : (s.autoRejected ? "auto_rejected" : "screened"),
      autoRejected: s.autoRejected,
      autoRejectReasons: s.autoRejectReasons,
      breakdown: s.breakdown,
      keywordMatches: s.keywordMatches,
    })),
  };
}

// ============================================================================
// SKILL SYNONYMS & SCORING HELPERS
// ============================================================================

const SKILL_SYNONYMS: Record<string, string[]> = {
  javascript: ["js", "javascript", "ecmascript"],
  typescript: ["ts", "typescript"],
  react: ["react", "reactjs", "react.js", "react js"],
  "react native": ["react native", "reactnative"],
  vue: ["vue", "vuejs", "vue.js", "vue js"],
  angular: ["angular", "angularjs", "angular.js", "angular js"],
  node: ["node", "nodejs", "node.js", "node js"],
  python: ["python", "py"],
  java: ["java", "j2ee", "jsp"],
  "c#": ["c#", "csharp", "c sharp", ".net", "dotnet"],
  "c++": ["c++", "cpp", "c plus plus"],
  go: ["go", "golang"],
  rust: ["rust", "rustlang"],
  php: ["php", "laravel", "symfony"],
  ruby: ["ruby", "rails", "ruby on rails", "ror"],
  swift: ["swift", "swiftlang"],
  kotlin: ["kotlin", "kotlinlang"],
  dart: ["dart", "dartlang", "flutter"],
  sql: ["sql", "mysql", "postgresql", "postgres", "sqlite", "t-sql", "plsql", "pl/sql"],
  mongodb: ["mongodb", "mongo", "mongoose"],
  redis: ["redis", "redis cache"],
  docker: ["docker", "containerization", "containers"],
  kubernetes: ["kubernetes", "k8s"],
  aws: ["aws", "amazon web services", "ec2", "s3", "lambda"],
  azure: ["azure", "microsoft azure"],
  gcp: ["gcp", "google cloud", "google cloud platform"],
  html: ["html", "html5"],
  css: ["css", "css3", "styling"],
  tailwind: ["tailwind", "tailwindcss", "tailwind css"],
  sass: ["sass", "scss"],
  graphql: ["graphql", "gql", "apollo"],
  rest: ["rest", "restful", "rest api", "api"],
  git: ["git", "github", "gitlab", "version control"],
  jenkins: ["jenkins", "ci/cd", "cicd", "continuous integration"],
  figma: ["figma", "ui design", "ux design"],
  excel: ["excel", "microsoft excel", "spreadsheets", "google sheets"],
  powerbi: ["powerbi", "power bi", "power query"],
  tableau: ["tableau", "data visualization"],
  salesforce: ["salesforce", "sfdc", "apex"],
  sap: ["sap", "sap erp", "sap hana"],
  quickbooks: ["quickbooks", "qb", "intuit"],
  "project management": ["project management", "pmp", "prince2", "pmi"],
  agile: ["agile", "scrum", "kanban", "sprint"],
  devops: ["devops", "devsecops", "site reliability", "sre"],
  "machine learning": ["machine learning", "ml", "ai", "artificial intelligence", "deep learning"],
  "data science": ["data science", "data analytics", "data analysis", "statistics"],
  tensorflow: ["tensorflow", "tf", "keras"],
  pytorch: ["pytorch", "torch"],
};

const EDUCATION_LEVELS: Record<string, number> = {
  none: 0, high_school: 1, ssce: 1, waec: 1, diploma: 2, hnd: 2,
  associate: 3, bachelor: 4, bsc: 4, ba: 4, "b.tech": 4, "b.eng": 4,
  master: 5, msc: 5, ma: 5, "m.tech": 5, "m.eng": 5, mba: 5,
  phd: 6, doctorate: 6,
};

function normalizeSkill(skill: string): string {
  return skill.toLowerCase().trim().replace(/[.\s]/g, "");
}

function skillsMatch(reqSkill: string, candSkills: string[]): boolean {
  const reqLower = reqSkill.toLowerCase().trim();
  const reqNorm = normalizeSkill(reqSkill);

  for (const cs of candSkills) {
    const csLower = cs.toLowerCase().trim();
    const csNorm = normalizeSkill(cs);
    if (csLower === reqLower || csNorm === reqNorm) return true;
    if (csLower.includes(reqLower) || reqLower.includes(csLower)) return true;
    if (csNorm.includes(reqNorm) || reqNorm.includes(csNorm)) return true;
  }

  for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    const allVariants = [canonical, ...synonyms];
    const reqIsVariant = allVariants.some((v) => v.toLowerCase() === reqLower || normalizeSkill(v) === reqNorm);
    if (reqIsVariant) {
      for (const cs of candSkills) {
        const csLower = cs.toLowerCase().trim();
        const csNorm = normalizeSkill(cs);
        if (allVariants.some((v) => v.toLowerCase() === csLower || normalizeSkill(v) === csNorm)) return true;
      }
    }
  }
  return false;
}

function extractEducationLevel(educationText: string): number {
  if (!educationText) return 0;
  const text = educationText.toLowerCase();
  let maxLevel = 0;
  for (const [keyword, level] of Object.entries(EDUCATION_LEVELS)) {
    if (text.includes(keyword)) maxLevel = Math.max(maxLevel, level);
  }
  if (/\bbachelor'?s?\b/.test(text)) maxLevel = Math.max(maxLevel, 4);
  if (/\bmaster'?s?\b/.test(text)) maxLevel = Math.max(maxLevel, 5);
  if (/\bdoctorate\b|\bph\.?d\b/.test(text)) maxLevel = Math.max(maxLevel, 6);
  if (/\bdiploma\b|\bassociate\b|\bhnd\b/.test(text)) maxLevel = Math.max(maxLevel, 2);
  return maxLevel;
}

function extractKeywordsFromJobDescription(description: string, requirements: string): string[] {
  const text = `${description} ${requirements || ""}`.toLowerCase();
  const keywords: string[] = [];
  for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
    const allVariants = [canonical, ...synonyms];
    if (allVariants.some((v) => text.includes(v.toLowerCase()))) {
      keywords.push(canonical);
    }
  }
  return keywords;
}

function parseSalaryRange(salaryRange: string): { min: number; max: number } | null {
  if (!salaryRange) return null;
  const nums = salaryRange.match(/[\d,]+/g);
  if (!nums || nums.length === 0) return null;
  const parsed = nums.map((n) => parseInt(n.replace(/,/g, ""), 10)).filter((n) => !isNaN(n));
  if (parsed.length === 0) return null;
  if (parsed.length === 1) return { min: parsed[0] * 0.8, max: parsed[0] * 1.2 };
  return { min: Math.min(...parsed), max: Math.max(...parsed) };
}

function locationsMatch(reqLocation: string, candLocation: string): boolean {
  if (!reqLocation || !candLocation) return false;
  const req = reqLocation.toLowerCase().trim();
  const cand = candLocation.toLowerCase().trim();
  if (cand === req) return true;
  if (cand.includes(req) || req.includes(cand)) return true;
  const reqParts = req.split(/[,\s]+/).filter((p) => p.length > 2);
  const candParts = cand.split(/[,\s]+/).filter((p) => p.length > 2);
  return reqParts.some((rp) => candParts.some((cp) => cp.includes(rp) || rp.includes(cp)));
}

// Default weights (sum = 1.0)
const DEFAULT_WEIGHTS: Record<string, number> = {
  experience: 0.15,
  requiredSkills: 0.25,
  preferredSkills: 0.10,
  education: 0.08,
  certifications: 0.07,
  source: 0.05,
  resume: 0.10,
  completeness: 0.07,
  location: 0.05,
  salary: 0.03,
  keywords: 0.05,
};

function getWeights(custom: Record<string, number> | null): Record<string, number> {
  if (!custom) return DEFAULT_WEIGHTS;
  const merged = { ...DEFAULT_WEIGHTS };
  for (const [key, val] of Object.entries(custom)) {
    if (key in merged && typeof val === "number") merged[key] = val;
  }
  // Normalize so they sum to 1.0
  const sum = Object.values(merged).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const key of Object.keys(merged)) merged[key] = merged[key] / sum;
  }
  return merged;
}

function scoreSingleApplication(
  candidate: any,
  requisition: any,
  customWeights?: Record<string, number> | null,
  autoRejectRules?: Array<{ field: string; operator: string; value?: any }> | null,
  autoRejectBelowScore?: number,
): {
  score: number;
  breakdown: ScreeningResult["breakdown"];
  confidence: number;
  autoRejected: boolean;
  autoRejectReasons: string[];
  keywordMatches: Array<{ keyword: string; found: boolean; source: string }>;
} {
  const weights = getWeights(customWeights ?? null);
  const checks: ScreeningResult["breakdown"] = [];
  const keywordMatches: Array<{ keyword: string; found: boolean; source: string }> = [];
  let totalScore = 0;
  let maxTotal = 0;
  let dataPoints = 0;
  let totalDataPoints = 0;

  const candSkills: string[] = Array.isArray(candidate.skills) ? candidate.skills : [];
  const reqSkills: string[] = Array.isArray(requisition.required_skills) ? requisition.required_skills : [];
  const prefSkills: string[] = Array.isArray(requisition.preferred_skills) ? requisition.preferred_skills : [];
  const reqCerts: string[] = Array.isArray(requisition.required_certifications) ? requisition.required_certifications : [];
  const candCerts: string[] = Array.isArray(candidate.certifications) ? candidate.certifications : [];

  // 1. Experience
  const reqMinExp = requisition.min_experience_years ?? 0;
  const candExp = candidate.experience_years ?? 0;
  const expMax = 100;
  const expScore = candExp >= reqMinExp ? expMax : Math.max(0, (candExp / Math.max(reqMinExp, 1)) * expMax);
  checks.push({
    criteria: "Years of Experience",
    weight: weights.experience,
    required: reqMinExp,
    actual: candExp,
    score: Math.round(expScore),
    maxScore: expMax,
    reason: candExp >= reqMinExp
      ? `Candidate has ${candExp} years (required: ${reqMinExp})`
      : `Candidate has ${candExp} years, below required ${reqMinExp}`,
  });
  totalScore += expScore * weights.experience;
  maxTotal += expMax * weights.experience;
  totalDataPoints++;
  if (candExp > 0) dataPoints++;

  // 2. Required Skills (with synonym matching)
  const skillsMax = 100;
  let reqMatched = 0;
  const reqMatchedSkills: string[] = [];
  reqSkills.forEach((skill: string) => {
    if (skillsMatch(skill, candSkills)) {
      reqMatched++;
      reqMatchedSkills.push(skill);
    }
  });
  const reqSkillsScore = reqSkills.length === 0 ? skillsMax : (reqMatched / reqSkills.length) * skillsMax;
  checks.push({
    criteria: "Required Skills Match",
    weight: weights.requiredSkills,
    required: reqSkills,
    actual: reqMatchedSkills,
    score: Math.round(reqSkillsScore),
    maxScore: skillsMax,
    reason: `${reqMatched}/${reqSkills.length} required skills matched${reqMatchedSkills.length > 0 ? `: ${reqMatchedSkills.join(", ")}` : ""}`,
  });
  totalScore += reqSkillsScore * weights.requiredSkills;
  maxTotal += skillsMax * weights.requiredSkills;
  totalDataPoints++;
  if (candSkills.length > 0) dataPoints++;

  // 3. Preferred Skills (bonus scoring)
  let prefMatched = 0;
  const prefMatchedSkills: string[] = [];
  prefSkills.forEach((skill: string) => {
    if (skillsMatch(skill, candSkills)) {
      prefMatched++;
      prefMatchedSkills.push(skill);
    }
  });
  const prefSkillsScore = prefSkills.length === 0 ? skillsMax : (prefMatched / prefSkills.length) * skillsMax;
  checks.push({
    criteria: "Preferred Skills Match",
    weight: weights.preferredSkills,
    required: prefSkills,
    actual: prefMatchedSkills,
    score: Math.round(prefSkillsScore),
    maxScore: skillsMax,
    reason: prefSkills.length === 0
      ? "No preferred skills specified"
      : `${prefMatched}/${prefSkills.length} preferred skills matched${prefMatchedSkills.length > 0 ? `: ${prefMatchedSkills.join(", ")}` : ""}`,
  });
  totalScore += prefSkillsScore * weights.preferredSkills;
  maxTotal += skillsMax * weights.preferredSkills;

  // 4. Education Level Matching
  const eduMax = 100;
  const candEduLevel = extractEducationLevel(candidate.education || "");
  const reqEduLevelStr = requisition.education_level || "";
  const reqEduLevel = reqEduLevelStr ? (EDUCATION_LEVELS[reqEduLevelStr.toLowerCase()] ?? extractEducationLevel(reqEduLevelStr)) : 0;
  let eduScore: number;
  let eduReason: string;
  if (reqEduLevel > 0) {
    if (candEduLevel >= reqEduLevel) {
      eduScore = eduMax;
      eduReason = `Education level meets requirement (${candidate.education || "N/A"})`;
    } else if (candEduLevel > 0) {
      eduScore = (candEduLevel / reqEduLevel) * eduMax * 0.7;
      eduReason = `Education level below requirement (has ${candEduLevel}, needs ${reqEduLevel})`;
    } else {
      eduScore = 20;
      eduReason = "No education information provided";
    }
  } else {
    eduScore = candEduLevel > 0 ? eduMax : 30;
    eduReason = candEduLevel > 0 ? `Education recorded: ${candidate.education}` : "No education details provided";
  }
  checks.push({
    criteria: "Education Level",
    weight: weights.education,
    required: reqEduLevel > 0 ? requisition.education_level : "Any degree",
    actual: candidate.education || "Not provided",
    score: Math.round(eduScore),
    maxScore: eduMax,
    reason: eduReason,
  });
  totalScore += eduScore * weights.education;
  maxTotal += eduMax * weights.education;
  totalDataPoints++;
  if (candEduLevel > 0) dataPoints++;

  // 5. Certifications Matching
  const certsMax = 100;
  let certMatched = 0;
  const certMatchedList: string[] = [];
  if (reqCerts.length > 0) {
    reqCerts.forEach((cert: string) => {
      const certLower = cert.toLowerCase();
      if (candCerts.some((cc: string) => cc.toLowerCase().includes(certLower) || certLower.includes(cc.toLowerCase()))) {
        certMatched++;
        certMatchedList.push(cert);
      }
    });
  }
  const certScore = reqCerts.length === 0 ? certsMax : (certMatched / reqCerts.length) * certsMax;
  checks.push({
    criteria: "Certifications",
    weight: weights.certifications,
    required: reqCerts.length > 0 ? reqCerts : "None required",
    actual: candCerts.length > 0 ? candCerts : "None listed",
    score: Math.round(certScore),
    maxScore: certsMax,
    reason: reqCerts.length === 0
      ? "No certifications required"
      : `${certMatched}/${reqCerts.length} certifications matched${certMatchedList.length > 0 ? `: ${certMatchedList.join(", ")}` : ""}`,
  });
  totalScore += certScore * weights.certifications;
  maxTotal += certsMax * weights.certifications;
  totalDataPoints++;
  if (candCerts.length > 0) dataPoints++;

  // 6. Source Quality
  const sourceMax = 100;
  const highQualitySources = ["referral", "linkedin", "career_page"];
  const mediumQualitySources = ["indeed", "agency"];
  let sourceScore: number;
  if (highQualitySources.includes(candidate.source)) sourceScore = sourceMax;
  else if (mediumQualitySources.includes(candidate.source)) sourceScore = 70;
  else sourceScore = 40;
  checks.push({
    criteria: "Source Quality",
    weight: weights.source,
    required: "Referral / LinkedIn / Career Page",
    actual: candidate.source,
    score: Math.round(sourceScore),
    maxScore: sourceMax,
    reason: `Source: ${candidate.source}`,
  });
  totalScore += sourceScore * weights.source;
  maxTotal += sourceMax * weights.source;

  // 7. Resume Presence
  const resumeMax = 100;
  const hasResume = !!(candidate.resume_url && candidate.resume_url.trim().length > 0);
  const resumeScore = hasResume ? resumeMax : 30;
  checks.push({
    criteria: "Resume Submitted",
    weight: weights.resume,
    required: true,
    actual: hasResume,
    score: Math.round(resumeScore),
    maxScore: resumeMax,
    reason: hasResume ? "Resume provided" : "No resume on file",
  });
  totalScore += resumeScore * weights.resume;
  maxTotal += resumeMax * weights.resume;
  totalDataPoints++;
  if (hasResume) dataPoints++;

  // 8. Application Completeness
  const completeMax = 100;
  const fields = [
    hasResume,
    !!candidate.education,
    candidate.experience_years !== null && candidate.experience_years !== undefined,
    candSkills.length > 0,
    !!candidate.location,
    candCerts.length > 0,
  ];
  const filledCount = fields.filter(Boolean).length;
  const completeScore = (filledCount / fields.length) * completeMax;
  checks.push({
    criteria: "Application Completeness",
    weight: weights.completeness,
    required: "All fields provided",
    actual: { hasResume, hasEducation: !!candidate.education, hasExperience: candidate.experience_years != null, hasSkills: candSkills.length > 0, hasLocation: !!candidate.location, hasCerts: candCerts.length > 0 },
    score: Math.round(completeScore),
    maxScore: completeMax,
    reason: `${filledCount}/${fields.length} key fields completed`,
  });
  totalScore += completeScore * weights.completeness;
  maxTotal += completeMax * weights.completeness;

  // 9. Location Match
  const locMax = 100;
  const reqLocation = requisition.location || "";
  const candLocation = candidate.location || "";
  let locScore: number;
  let locReason: string;
  if (!reqLocation) {
    locScore = locMax;
    locReason = "No location requirement specified";
  } else if (locationsMatch(reqLocation, candLocation)) {
    locScore = locMax;
    locReason = `Location matches: ${candLocation}`;
  } else if (candLocation) {
    locScore = 40;
    locReason = `Location mismatch (required: ${reqLocation}, candidate: ${candLocation})`;
  } else {
    locScore = 50;
    locReason = "Candidate location not provided";
  }
  checks.push({
    criteria: "Location Match",
    weight: weights.location,
    required: reqLocation || "Any",
    actual: candLocation || "Not provided",
    score: Math.round(locScore),
    maxScore: locMax,
    reason: locReason,
  });
  totalScore += locScore * weights.location;
  maxTotal += locMax * weights.location;
  totalDataPoints++;
  if (candLocation) dataPoints++;

  // 10. Salary Expectation Match
  const salaryMax = 100;
  const salaryRange = parseSalaryRange(requisition.salary_range || "");
  const candSalary = candidate.expected_salary ?? null;
  let salaryScore: number;
  let salaryReason: string;
  if (!salaryRange) {
    salaryScore = salaryMax;
    salaryReason = "No salary range specified";
  } else if (candSalary === null) {
    salaryScore = 50;
    salaryReason = "Candidate salary expectation not provided";
  } else if (candSalary <= salaryRange.max && candSalary >= salaryRange.min) {
    salaryScore = salaryMax;
    salaryReason = `Salary expectation (${candSalary}) within range (${salaryRange.min}-${salaryRange.max})`;
  } else if (candSalary < salaryRange.min) {
    salaryScore = 80;
    salaryReason = `Salary expectation below range (${candSalary} vs ${salaryRange.min}-${salaryRange.max})`;
  } else {
    const overage = (candSalary - salaryRange.max) / salaryRange.max;
    salaryScore = Math.max(20, salaryMax * (1 - overage));
    salaryReason = `Salary expectation above range (${candSalary} vs ${salaryRange.min}-${salaryRange.max})`;
  }
  checks.push({
    criteria: "Salary Expectation",
    weight: weights.salary,
    required: requisition.salary_range || "Any",
    actual: candSalary ?? "Not provided",
    score: Math.round(salaryScore),
    maxScore: salaryMax,
    reason: salaryReason,
  });
  totalScore += salaryScore * weights.salary;
  maxTotal += salaryMax * weights.salary;
  totalDataPoints++;
  if (candSalary !== null) dataPoints++;

  // 11. Keyword Extraction from Job Description
  const kwMax = 100;
  const jobKeywords = extractKeywordsFromJobDescription(requisition.description || "", requisition.requirements || "");
  let kwMatched = 0;
  if (jobKeywords.length > 0) {
    jobKeywords.forEach((kw) => {
      const found = skillsMatch(kw, candSkills) || skillsMatch(kw, candCerts);
      if (found) kwMatched++;
      keywordMatches.push({ keyword: kw, found, source: found ? "candidate profile" : "not found" });
    });
  }
  const kwScore = jobKeywords.length === 0 ? kwMax : (kwMatched / jobKeywords.length) * kwMax;
  checks.push({
    criteria: "Job Description Keywords",
    weight: weights.keywords,
    required: jobKeywords.length > 0 ? jobKeywords : "No keywords extracted",
    actual: `${kwMatched}/${jobKeywords.length} keywords found in candidate profile`,
    score: Math.round(kwScore),
    maxScore: kwMax,
    reason: jobKeywords.length === 0
      ? "No keywords could be extracted from job description"
      : `${kwMatched}/${jobKeywords.length} keywords from job description matched`,
  });
  totalScore += kwScore * weights.keywords;
  maxTotal += kwMax * weights.keywords;

  // Calculate final score
  const finalScore = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0;

  // Confidence = ratio of data points provided vs total expected
  const confidence = totalDataPoints > 0 ? Math.round((dataPoints / totalDataPoints) * 100) / 100 : 0;

  // Auto-reject evaluation
  const autoRejectReasons: string[] = [];
  let autoRejected = false;

  if (autoRejectRules && autoRejectRules.length > 0) {
    for (const rule of autoRejectRules) {
      let triggered = false;
      let reason = "";
      switch (rule.field) {
        case "experience":
          if (rule.operator === "lt" && candExp < (rule.value ?? reqMinExp)) {
            triggered = true;
            reason = `Experience below minimum (${candExp} < ${rule.value ?? reqMinExp})`;
          }
          break;
        case "requiredSkills":
          if (rule.operator === "lt" && reqMatched < (rule.value ?? 1)) {
            triggered = true;
            reason = `Insufficient required skills (${reqMatched} < ${rule.value ?? 1})`;
          }
          break;
        case "education":
          if (rule.operator === "lt" && candEduLevel < (rule.value ?? reqEduLevel)) {
            triggered = true;
            reason = `Education level below requirement`;
          } else if (rule.operator === "missing" && !candidate.education) {
            triggered = true;
            reason = "Education information missing";
          }
          break;
        case "certifications":
          if (rule.operator === "missing" && reqCerts.length > 0 && certMatched === 0) {
            triggered = true;
            reason = `Required certifications not found (${reqCerts.join(", ")})`;
          }
          break;
        case "resume":
          if (rule.operator === "missing" && !hasResume) {
            triggered = true;
            reason = "No resume submitted";
          }
          break;
      }
      if (triggered) {
        autoRejected = true;
        autoRejectReasons.push(reason);
      }
    }
  }

  // Auto-reject if score below threshold
  if (autoRejectBelowScore && autoRejectBelowScore > 0 && finalScore < autoRejectBelowScore) {
    autoRejected = true;
    autoRejectReasons.push(`Score below auto-reject threshold (${finalScore} < ${autoRejectBelowScore})`);
  }

  return {
    score: finalScore,
    breakdown: checks,
    confidence,
    autoRejected,
    autoRejectReasons,
    keywordMatches,
  };
}
