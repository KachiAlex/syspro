/**
 * Database operations for employee appraisals, peer feedback, and goals.
 */

import { randomUUID } from "crypto";
import { sql as SQL, SqlClient } from "@/lib/sql-client";
import { ensureHrTables } from "@/lib/hr/db";
import type { AppraisalResult, AppraisalWeights, AppraisalPeriod } from "@/lib/ai/appraisal-engine";

function serializeTextArray(values?: string[] | null): string {
  if (!values || values.length === 0) return "{}";
  const escaped = values.map((v) => v.replace(/\\/g, "\\\\").replace(/"/g, '\\"'));
  return `{${escaped.map((v) => `"${v}"`).join(",")}}`;
}

// ─── Appraisals ───

export async function saveAppraisal(
  tenantSlug: string,
  result: AppraisalResult,
  generatedByName?: string,
): Promise<string> {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();

  await sql`
    insert into admin_employee_appraisals (
      id, tenant_slug, employee_id, employee_name, department_id,
      period, period_start, period_end,
      overall_score, rating, categories,
      strengths, improvements, recommendation,
      sentiment_score, anomalies,
      trend_delta, previous_score, department_average, percentile_rank,
      generated_by, weights_used, metrics,
      peer_feedback, goal_alignment,
      generated_by_name
    ) values (
      ${id}, ${tenantSlug}, ${result.employeeId}, null, null,
      ${result.period}, ${result.periodStart}, ${result.periodEnd},
      ${result.overallScore}, ${result.rating}, ${JSON.stringify(result.categories)}::jsonb,
      ${serializeTextArray(result.strengths)}, ${serializeTextArray(result.improvements)}, ${result.recommendation},
      ${result.sentimentScore}, ${serializeTextArray(result.anomalies)},
      ${result.trendDelta ?? null}, ${result.previousScore ?? null}, ${result.departmentAverage ?? null}, ${result.percentileRank ?? null},
      ${result.generatedBy}, ${JSON.stringify(result.weightsUsed)}::jsonb, ${JSON.stringify(result.metrics)}::jsonb,
      ${result.peerFeedback ? JSON.stringify(result.peerFeedback) : null}::jsonb,
      ${result.goalAlignment ? JSON.stringify(result.goalAlignment) : null}::jsonb,
      ${generatedByName ?? null}
    )
  `;
  return id;
}

export async function getAppraisalHistory(
  tenantSlug: string,
  employeeId: string,
  limit = 20,
): Promise<AppraisalResult[]> {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_employee_appraisals
    where tenant_slug = ${tenantSlug} and employee_id = ${employeeId}
    order by created_at desc
    limit ${limit}
  `;
  return (rows as any[]).map(normalizeAppraisalRow);
}

export async function getAppraisalById(
  tenantSlug: string,
  appraisalId: string,
): Promise<AppraisalResult | null> {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_employee_appraisals
    where tenant_slug = ${tenantSlug} and id = ${appraisalId}
    limit 1
  `;
  const row = (rows as any[])[0];
  return row ? normalizeAppraisalRow(row) : null;
}

export async function getLatestAppraisal(
  tenantSlug: string,
  employeeId: string,
): Promise<AppraisalResult | null> {
  const rows = await getAppraisalHistory(tenantSlug, employeeId, 1);
  return rows[0] || null;
}

export async function getDepartmentAppraisals(
  tenantSlug: string,
  departmentId: string,
  limit = 50,
): Promise<AppraisalResult[]> {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_employee_appraisals
    where tenant_slug = ${tenantSlug} and department_id = ${departmentId}
    order by created_at desc
    limit ${limit}
  `;
  return (rows as any[]).map(normalizeAppraisalRow);
}

export async function getTenantAppraisals(
  tenantSlug: string,
  limit = 100,
): Promise<AppraisalResult[]> {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_employee_appraisals
    where tenant_slug = ${tenantSlug}
    order by created_at desc
    limit ${limit}
  `;
  return (rows as any[]).map(normalizeAppraisalRow);
}

export async function shareAppraisalWithEmployee(
  tenantSlug: string,
  appraisalId: string,
): Promise<void> {
  const sql = SQL;
  await sql`
    update admin_employee_appraisals
    set is_shared = true
    where tenant_slug = ${tenantSlug} and id = ${appraisalId}
  `;
}

export async function acknowledgeAppraisal(
  tenantSlug: string,
  appraisalId: string,
): Promise<void> {
  const sql = SQL;
  await sql`
    update admin_employee_appraisals
    set employee_acknowledged = true, acknowledged_at = now()
    where tenant_slug = ${tenantSlug} and id = ${appraisalId}
  `;
}

export async function getEmployeeSharedAppraisals(
  tenantSlug: string,
  employeeId: string,
): Promise<AppraisalResult[]> {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_employee_appraisals
    where tenant_slug = ${tenantSlug} and employee_id = ${employeeId} and is_shared = true
    order by created_at desc
  `;
  return (rows as any[]).map(normalizeAppraisalRow);
}

function normalizeAppraisalRow(row: any): AppraisalResult {
  const categories = typeof row.categories === 'string' ? JSON.parse(row.categories) : row.categories;
  const weightsUsed = typeof row.weights_used === 'string' ? JSON.parse(row.weights_used) : row.weights_used;
  const metrics = typeof row.metrics === 'string' ? JSON.parse(row.metrics) : row.metrics;
  const peerFeedback = row.peer_feedback
    ? (typeof row.peer_feedback === 'string' ? JSON.parse(row.peer_feedback) : row.peer_feedback)
    : undefined;
  const goalAlignment = row.goal_alignment
    ? (typeof row.goal_alignment === 'string' ? JSON.parse(row.goal_alignment) : row.goal_alignment)
    : undefined;

  return {
    id: row.id,
    employeeId: row.employee_id,
    tenantSlug: row.tenant_slug,
    period: row.period as AppraisalPeriod,
    periodStart: row.period_start?.toISOString?.() || row.period_start,
    periodEnd: row.period_end?.toISOString?.() || row.period_end,
    overallScore: row.overall_score,
    rating: row.rating as AppraisalResult['rating'],
    categories,
    strengths: row.strengths || [],
    improvements: row.improvements || [],
    recommendation: row.recommendation || '',
    sentimentScore: Number(row.sentiment_score) || 0,
    anomalies: row.anomalies || [],
    trendDelta: row.trend_delta ?? null,
    previousScore: row.previous_score ?? null,
    departmentAverage: row.department_average ?? null,
    percentileRank: row.percentile_rank ?? null,
    generatedBy: row.generated_by as 'ai' | 'deterministic' | 'hybrid',
    generatedAt: row.created_at?.toISOString?.() || row.created_at,
    weightsUsed,
    metrics,
    peerFeedback,
    goalAlignment,
  };
}

// ─── Appraisal Config ───

export interface AppraisalConfigRecord {
  id: string;
  tenantSlug: string;
  weights: AppraisalWeights;
  autoGenerate: boolean;
  autoGenerateFrequency: string;
  autoGenerateDay: number;
  useAI: boolean;
  roleTemplates: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export async function getAppraisalConfig(
  tenantSlug: string,
): Promise<AppraisalConfigRecord | null> {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_appraisal_config
    where tenant_slug = ${tenantSlug}
    limit 1
  `;
  const row = (rows as any[])[0];
  if (!row) return null;
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    weights: typeof row.weights === 'string' ? JSON.parse(row.weights) : row.weights,
    autoGenerate: row.auto_generate ?? false,
    autoGenerateFrequency: row.auto_generate_frequency || 'monthly',
    autoGenerateDay: row.auto_generate_day || 1,
    useAI: row.use_ai ?? true,
    roleTemplates: typeof row.role_templates === 'string' ? JSON.parse(row.role_templates) : (row.role_templates || {}),
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}

export async function saveAppraisalConfig(
  tenantSlug: string,
  config: Partial<AppraisalConfigRecord>,
): Promise<void> {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  const weightsJson = JSON.stringify(config.weights || {});
  const roleTemplatesJson = JSON.stringify(config.roleTemplates || {});

  await sql`
    insert into admin_appraisal_config (id, tenant_slug, weights, auto_generate, auto_generate_frequency, auto_generate_day, use_ai, role_templates, updated_at)
    values (${id}, ${tenantSlug}, ${weightsJson}::jsonb, ${config.autoGenerate ?? false}, ${config.autoGenerateFrequency || 'monthly'}, ${config.autoGenerateDay || 1}, ${config.useAI ?? true}, ${roleTemplatesJson}::jsonb, now())
    on conflict (tenant_slug) do update set
      weights = excluded.weights,
      auto_generate = excluded.auto_generate,
      auto_generate_frequency = excluded.auto_generate_frequency,
      auto_generate_day = excluded.auto_generate_day,
      use_ai = excluded.use_ai,
      role_templates = excluded.role_templates,
      updated_at = now()
  `;
}

// ─── Peer Feedback ───

export interface PeerFeedbackRecord {
  id: string;
  tenantSlug: string;
  employeeId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  rating: number;
  collaborationScore?: number;
  communicationScore?: number;
  reliabilityScore?: number;
  strengths: string[];
  improvements: string[];
  comments: string;
  period: string;
  isAnonymous: boolean;
  createdAt: string;
}

export async function insertPeerFeedback(
  row: Omit<PeerFeedbackRecord, 'id' | 'createdAt'>,
): Promise<string> {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_peer_feedback (
      id, tenant_slug, employee_id, reviewer_id, reviewer_name, reviewer_role,
      rating, collaboration_score, communication_score, reliability_score,
      strengths, improvements, comments, period, is_anonymous
    ) values (
      ${id}, ${row.tenantSlug}, ${row.employeeId}, ${row.reviewerId}, ${row.reviewerName || null}, ${row.reviewerRole || 'peer'},
      ${row.rating}, ${row.collaborationScore ?? null}, ${row.communicationScore ?? null}, ${row.reliabilityScore ?? null},
      ${serializeTextArray(row.strengths)}, ${serializeTextArray(row.improvements)}, ${row.comments || null},
      ${row.period || 'monthly'}, ${row.isAnonymous ?? false}
    )
  `;
  return id;
}

export async function getPeerFeedbackForEmployee(
  tenantSlug: string,
  employeeId: string,
  period = 'monthly',
): Promise<PeerFeedbackRecord[]> {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_peer_feedback
    where tenant_slug = ${tenantSlug} and employee_id = ${employeeId}
    order by created_at desc
    limit 50
  `;
  return (rows as any[]).map(normalizePeerFeedbackRow);
}

function normalizePeerFeedbackRow(row: any): PeerFeedbackRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    employeeId: row.employee_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.reviewer_name || '',
    reviewerRole: row.reviewer_role || 'peer',
    rating: row.rating,
    collaborationScore: row.collaboration_score ?? undefined,
    communicationScore: row.communication_score ?? undefined,
    reliabilityScore: row.reliability_score ?? undefined,
    strengths: row.strengths || [],
    improvements: row.improvements || [],
    comments: row.comments || '',
    period: row.period || 'monthly',
    isAnonymous: row.is_anonymous ?? false,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

// ─── Goals / OKRs ───

export interface GoalRecord {
  id: string;
  tenantSlug: string;
  employeeId: string;
  title: string;
  description: string;
  targetMetric: string;
  targetValue: number;
  actualValue: number;
  status: string;
  priority: string;
  startDate: string;
  dueDate: string;
  completedAt: string | null;
  linkedTaskIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function insertGoal(
  row: Omit<GoalRecord, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const sql = SQL;
  await ensureHrTables(sql);
  const id = randomUUID();
  await sql`
    insert into admin_employee_goals (
      id, tenant_slug, employee_id, title, description,
      target_metric, target_value, actual_value, status, priority,
      start_date, due_date, linked_task_ids, created_by
    ) values (
      ${id}, ${row.tenantSlug}, ${row.employeeId}, ${row.title}, ${row.description || null},
      ${row.targetMetric || null}, ${row.targetValue ?? null}, ${row.actualValue ?? 0},
      ${row.status || 'not_started'}, ${row.priority || 'medium'},
      ${row.startDate || null}, ${row.dueDate || null},
      ${serializeTextArray(row.linkedTaskIds)}, ${row.createdBy || null}
    )
  `;
  return id;
}

export async function getEmployeeGoals(
  tenantSlug: string,
  employeeId: string,
): Promise<GoalRecord[]> {
  const sql = SQL;
  await ensureHrTables(sql);
  const rows = await sql`
    select * from admin_employee_goals
    where tenant_slug = ${tenantSlug} and employee_id = ${employeeId}
    order by created_at desc
  `;
  return (rows as any[]).map(normalizeGoalRow);
}

export async function updateGoalStatus(
  tenantSlug: string,
  goalId: string,
  status: string,
  actualValue?: number,
): Promise<void> {
  const sql = SQL;
  await ensureHrTables(sql);
  if (actualValue !== undefined) {
    await sql`
      update admin_employee_goals
      set status = ${status}, actual_value = ${actualValue}, updated_at = now()
      where tenant_slug = ${tenantSlug} and id = ${goalId}
    `;
  } else {
    await sql`
      update admin_employee_goals
      set status = ${status}, updated_at = now()
      where tenant_slug = ${tenantSlug} and id = ${goalId}
    `;
  }
}

function normalizeGoalRow(row: any): GoalRecord {
  return {
    id: row.id,
    tenantSlug: row.tenant_slug,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description || '',
    targetMetric: row.target_metric || '',
    targetValue: Number(row.target_value) || 0,
    actualValue: Number(row.actual_value) || 0,
    status: row.status || 'not_started',
    priority: row.priority || 'medium',
    startDate: row.start_date?.toISOString?.() || row.start_date || '',
    dueDate: row.due_date?.toISOString?.() || row.due_date || '',
    completedAt: row.completed_at?.toISOString?.() || null,
    linkedTaskIds: row.linked_task_ids || [],
    createdBy: row.created_by || '',
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at,
  };
}
