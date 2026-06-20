/**
 * Recruitment Database Operations (requisitions, candidates, applications, interviews, offers, onboarding)
 */

import { randomUUID } from "node:crypto";
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
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    )
  `;
  await sql`create index if not exists idx_admin_screening_cfg_tenant on admin_requisition_screening_configs(tenant_slug)`;
  await sql`create index if not exists idx_admin_screening_cfg_req on admin_requisition_screening_configs(requisition_id)`;

  // Application shortlist tracking
  await sql`alter table admin_applications add column if not exists shortlisted_at timestamptz`;
  await sql`alter table admin_applications add column if not exists shortlisted_by text default 'system' check (shortlisted_by in ('ai','hr','system'))`;
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
    minExperienceYears: row.min_experience_years ?? null,
    employmentType: row.employment_type,
    description: row.description,
    requirements: row.requirements ?? null,
    location: row.location ?? null,
    salaryRange: row.salary_range ?? null,
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
  minExperienceYears?: number | null;
  employmentType: string;
  description: string;
  requirements?: string | null;
  location?: string | null;
  salaryRange?: string | null;
  requestedBy?: string;
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const id = randomUUID();
  const skillsLit = serializeTextArray(row.requiredSkills);
  await sql`
    insert into admin_job_requisitions (
      id, tenant_slug, title, department_id, branch_id, headcount, budget,
      required_skills, min_experience_years, employment_type, description,
      requirements, location, salary_range, status, requested_by
    ) values (
      ${id}, ${row.tenantSlug}, ${row.title}, ${row.departmentId}, ${row.branchId ?? null},
      ${row.headcount ?? 1}, ${row.budget ?? null}, ${skillsLit}::text[],
      ${row.minExperienceYears ?? null}, ${row.employmentType}, ${row.description},
      ${row.requirements ?? null}, ${row.location ?? null}, ${row.salaryRange ?? null},
      'draft', ${row.requestedBy ?? 'system'}
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
    minExperienceYears: number | null;
    employmentType: string;
    description: string;
    requirements: string | null;
    location: string | null;
    salaryRange: string | null;
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
  notes?: string | null;
  tags?: string[];
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  const id = randomUUID();
  const skillsLit = serializeTextArray(row.skills);
  const tagsLit = serializeTextArray(row.tags);
  await sql`
    insert into admin_candidates (
      id, tenant_slug, full_name, email, phone, resume_url, source,
      current_stage, skills, experience_years, education, notes, tags
    ) values (
      ${id}, ${row.tenantSlug}, ${row.fullName}, ${row.email}, ${row.phone ?? null},
      ${row.resumeUrl ?? null}, ${row.source ?? "manual"}, ${row.currentStage ?? "new"},
      ${skillsLit}::text[], ${row.experienceYears ?? null}, ${row.education ?? null},
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

  const checks: ScreeningResult["breakdown"] = [];
  const reasons: string[] = [];
  let totalScore = 0;
  let maxTotal = 0;

  // Experience check
  const reqMinExp = requisition.min_experience_years ?? 0;
  const candExp = candidate.experience_years ?? 0;
  const expWeight = 0.25;
  const expMax = 100;
  const expScore = candExp >= reqMinExp ? expMax : Math.max(0, (candExp / Math.max(reqMinExp, 1)) * expMax);
  checks.push({
    criteria: "Years of Experience",
    weight: expWeight,
    required: reqMinExp,
    actual: candExp,
    score: Math.round(expScore),
    maxScore: expMax,
    reason: candExp >= reqMinExp
      ? `Candidate has ${candExp} years (required: ${reqMinExp})`
      : `Candidate has ${candExp} years, below required ${reqMinExp}`,
  });
  totalScore += expScore * expWeight;
  maxTotal += expMax * expWeight;
  if (candExp < reqMinExp) reasons.push(`Experience below minimum (${candExp} < ${reqMinExp})`);

  // Skills match
  const reqSkills: string[] = Array.isArray(requisition.required_skills) ? requisition.required_skills : [];
  const candSkills: string[] = Array.isArray(candidate.skills) ? candidate.skills : [];
  const skillsWeight = 0.35;
  const skillsMax = 100;
  let matched = 0;
  reqSkills.forEach((skill: string) => {
    const s = skill.toLowerCase();
    if (candSkills.some((cs: string) => cs.toLowerCase().includes(s) || s.includes(cs.toLowerCase()))) {
      matched++;
    }
  });
  const skillsScore = reqSkills.length === 0 ? skillsMax : (matched / reqSkills.length) * skillsMax;
  checks.push({
    criteria: "Skills Match",
    weight: skillsWeight,
    required: reqSkills,
    actual: candSkills,
    score: Math.round(skillsScore),
    maxScore: skillsMax,
    reason: `${matched}/${reqSkills.length} required skills matched`,
  });
  totalScore += skillsScore * skillsWeight;
  maxTotal += skillsMax * skillsWeight;
  if (matched < reqSkills.length) reasons.push(`Missing ${reqSkills.length - matched} required skill(s)`);

  // Education (optional)
  const eduWeight = 0.15;
  const eduMax = 100;
  const hasEdu = !!(candidate.education && candidate.education.trim().length > 0);
  const eduScore = hasEdu ? eduMax : 0;
  checks.push({
    criteria: "Education",
    weight: eduWeight,
    required: "Any post-secondary",
    actual: candidate.education || "Not provided",
    score: Math.round(eduScore),
    maxScore: eduMax,
    reason: hasEdu ? "Education record present" : "No education details provided",
  });
  totalScore += eduScore * eduWeight;
  maxTotal += eduMax * eduWeight;
  if (!hasEdu) reasons.push("No education details provided");

  // Source quality (lightweight signal)
  const sourceWeight = 0.05;
  const sourceMax = 100;
  const highQualitySources = ["referral", "linkedin", "career_page"];
  const sourceScore = highQualitySources.includes(candidate.source) ? sourceMax : 50;
  checks.push({
    criteria: "Source Quality",
    weight: sourceWeight,
    required: "Referral / LinkedIn / Career Page",
    actual: candidate.source,
    score: Math.round(sourceScore),
    maxScore: sourceMax,
    reason: `Source: ${candidate.source}`,
  });
  totalScore += sourceScore * sourceWeight;
  maxTotal += sourceMax * sourceWeight;

  // Resume presence
  const resumeWeight = 0.20;
  const resumeMax = 100;
  const hasResume = !!(candidate.resume_url && candidate.resume_url.trim().length > 0);
  const resumeScore = hasResume ? resumeMax : 30;
  checks.push({
    criteria: "Resume Submitted",
    weight: resumeWeight,
    required: true,
    actual: hasResume,
    score: Math.round(resumeScore),
    maxScore: resumeMax,
    reason: hasResume ? "Resume provided" : "No resume on file",
  });
  totalScore += resumeScore * resumeWeight;
  maxTotal += resumeMax * resumeWeight;
  if (!hasResume) reasons.push("No resume on file");

  const finalScore = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0;
  const passed = finalScore >= 60;

  const result: ScreeningResult = {
    passed,
    score: finalScore,
    maxScore: 100,
    breakdown: checks,
    reasons,
  };

  // Persist result
  await sql`
    update admin_applications set
      ai_score = ${finalScore},
      screening_result = ${result as any},
      status = ${passed ? "screened" : "under_review"},
      reviewed_at = now(),
      updated_at = now()
    where id = ${applicationId} and tenant_slug = ${tenantSlug}
  `;

  return result;
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
}) {
  const sql = SQL;
  await ensureRecruitmentTables(sql);
  await sql`
    insert into admin_requisition_screening_configs (
      requisition_id, tenant_slug, selection_mode, selection_value,
      min_score_threshold, is_enabled
    ) values (
      ${row.requisitionId}, ${row.tenantSlug}, ${row.selectionMode},
      ${row.selectionValue}, ${row.minScoreThreshold ?? 0}, ${row.isEnabled ?? true}
    )
    on conflict (requisition_id) do update set
      selection_mode = excluded.selection_mode,
      selection_value = excluded.selection_value,
      min_score_threshold = excluded.min_score_threshold,
      is_enabled = excluded.is_enabled,
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

  // Fetch requisition
  const reqRows = await sql`select * from admin_job_requisitions where id = ${requisitionId} and tenant_slug = ${tenantSlug} limit 1`;
  const requisition = (reqRows as any[])[0];
  if (!requisition) throw new Error("Requisition not found");

  // Fetch all unscreened applications for this requisition
  const appRows = await sql`
    select a.*, c.full_name, c.skills, c.experience_years, c.education, c.resume_url, c.source
    from admin_applications a
    join admin_candidates c on c.id = a.candidate_id
    where a.requisition_id = ${requisitionId}
      and a.tenant_slug = ${tenantSlug}
      and a.status in ('applied', 'under_review', 'screened')
    order by a.applied_at desc
  `;
  const apps = appRows as any[];
  if (apps.length === 0) {
    return { screened: 0, shortlisted: 0, thresholdScore: 0, results: [] };
  }

  // Score each application
  const scored = apps.map((app) => {
    const candidate = {
      experience_years: app.experience_years,
      skills: app.skills,
      education: app.education,
      resume_url: app.resume_url,
      source: app.source,
    };
    const result = scoreSingleApplication(candidate, requisition);
    return {
      applicationId: app.id,
      candidateName: app.full_name,
      aiScore: result.score,
      breakdown: result.breakdown,
    };
  });

  // Sort descending by score
  scored.sort((a, b) => b.aiScore - a.aiScore);

  // Determine cutoff
  let cutoffCount: number;
  if (selectionMode === "percentage") {
    cutoffCount = Math.max(1, Math.round((selectionValue / 100) * scored.length));
  } else {
    cutoffCount = Math.min(selectionValue, scored.length);
  }

  // Apply threshold
  const shortlisted = scored.slice(0, cutoffCount).filter((s) => s.aiScore >= minScoreThreshold);
  const nonShortlisted = scored.filter((s) => !shortlisted.includes(s));

  // Persist scores
  for (const s of scored) {
    await sql`
      update admin_applications set
        ai_score = ${s.aiScore},
        screening_result = ${{ score: s.aiScore, breakdown: s.breakdown } as any},
        status = ${shortlisted.includes(s) ? "shortlist" : "screened"},
        shortlisted_at = ${shortlisted.includes(s) ? new Date().toISOString() : null},
        shortlisted_by = ${shortlisted.includes(s) ? "ai" : null},
        reviewed_at = now(),
        updated_at = now()
      where id = ${s.applicationId} and tenant_slug = ${tenantSlug}
    `;
  }

  return {
    screened: scored.length,
    shortlisted: shortlisted.length,
    thresholdScore: shortlisted.length > 0 ? shortlisted[shortlisted.length - 1].aiScore : 0,
    results: scored.map((s) => ({
      applicationId: s.applicationId,
      candidateName: s.candidateName,
      aiScore: s.aiScore,
      status: shortlisted.includes(s) ? "shortlist" : "screened",
      breakdown: s.breakdown,
    })),
  };
}

function scoreSingleApplication(candidate: any, requisition: any): { score: number; breakdown: ScreeningResult["breakdown"] } {
  const checks: ScreeningResult["breakdown"] = [];
  let totalScore = 0;
  let maxTotal = 0;

  // Experience check
  const reqMinExp = requisition.min_experience_years ?? 0;
  const candExp = candidate.experience_years ?? 0;
  const expWeight = 0.20;
  const expMax = 100;
  const expScore = candExp >= reqMinExp ? expMax : Math.max(0, (candExp / Math.max(reqMinExp, 1)) * expMax);
  checks.push({
    criteria: "Years of Experience",
    weight: expWeight,
    required: reqMinExp,
    actual: candExp,
    score: Math.round(expScore),
    maxScore: expMax,
    reason: candExp >= reqMinExp
      ? `Candidate has ${candExp} years (required: ${reqMinExp})`
      : `Candidate has ${candExp} years, below required ${reqMinExp}`,
  });
  totalScore += expScore * expWeight;
  maxTotal += expMax * expWeight;

  // Skills match
  const reqSkills: string[] = Array.isArray(requisition.required_skills) ? requisition.required_skills : [];
  const candSkills: string[] = Array.isArray(candidate.skills) ? candidate.skills : [];
  const skillsWeight = 0.35;
  const skillsMax = 100;
  let matched = 0;
  reqSkills.forEach((skill: string) => {
    const s = skill.toLowerCase();
    if (candSkills.some((cs: string) => cs.toLowerCase().includes(s) || s.includes(cs.toLowerCase()))) {
      matched++;
    }
  });
  const skillsScore = reqSkills.length === 0 ? skillsMax : (matched / reqSkills.length) * skillsMax;
  checks.push({
    criteria: "Skills Match",
    weight: skillsWeight,
    required: reqSkills,
    actual: candSkills,
    score: Math.round(skillsScore),
    maxScore: skillsMax,
    reason: `${matched}/${reqSkills.length} required skills matched`,
  });
  totalScore += skillsScore * skillsWeight;
  maxTotal += skillsMax * skillsWeight;

  // Education relevance
  const eduWeight = 0.10;
  const eduMax = 100;
  const eduText = (candidate.education || "").toLowerCase();
  const hasDegree = /\b(bsc|b\.s\.?|ba|b\.a\.?|msc|m\.s\.?|ma|m\.a\.?|phd|mba|bachelor|master|doctorate|degree)\b/.test(eduText);
  const eduScore = hasDegree ? eduMax : 30;
  checks.push({
    criteria: "Education Relevance",
    weight: eduWeight,
    required: "Post-secondary degree",
    actual: candidate.education || "Not provided",
    score: Math.round(eduScore),
    maxScore: eduMax,
    reason: hasDegree ? "Education record with degree present" : "No education details provided",
  });
  totalScore += eduScore * eduWeight;
  maxTotal += eduMax * eduWeight;

  // Source quality
  const sourceWeight = 0.05;
  const sourceMax = 100;
  const highQualitySources = ["referral", "linkedin", "career_page"];
  const sourceScore = highQualitySources.includes(candidate.source) ? sourceMax : 50;
  checks.push({
    criteria: "Source Quality",
    weight: sourceWeight,
    required: "Referral / LinkedIn / Career Page",
    actual: candidate.source,
    score: Math.round(sourceScore),
    maxScore: sourceMax,
    reason: `Source: ${candidate.source}`,
  });
  totalScore += sourceScore * sourceWeight;
  maxTotal += sourceMax * sourceWeight;

  // Resume presence
  const resumeWeight = 0.20;
  const resumeMax = 100;
  const hasResume = !!(candidate.resume_url && candidate.resume_url.trim().length > 0);
  const resumeScore = hasResume ? resumeMax : 30;
  checks.push({
    criteria: "Resume Submitted",
    weight: resumeWeight,
    required: true,
    actual: hasResume,
    score: Math.round(resumeScore),
    maxScore: resumeMax,
    reason: hasResume ? "Resume provided" : "No resume on file",
  });
  totalScore += resumeScore * resumeWeight;
  maxTotal += resumeMax * resumeWeight;

  // Application completeness
  const completeWeight = 0.10;
  const completeMax = 100;
  const completeScore = hasResume && candidate.education && candidate.experience_years !== null ? completeMax : 50;
  checks.push({
    criteria: "Application Completeness",
    weight: completeWeight,
    required: "All fields provided",
    actual: { hasResume, hasEducation: !!candidate.education, hasExperience: candidate.experience_years !== null },
    score: Math.round(completeScore),
    maxScore: completeMax,
    reason: completeScore === completeMax ? "All key fields completed" : "Some fields missing",
  });
  totalScore += completeScore * completeWeight;
  maxTotal += completeMax * completeWeight;

  const finalScore = maxTotal > 0 ? Math.round((totalScore / maxTotal) * 100) : 0;
  return { score: finalScore, breakdown: checks };
}
