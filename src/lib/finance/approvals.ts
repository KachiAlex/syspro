/**
 * Approval Workflow Service
 * Manages configurable approval workflows for POs, bills, and payments
 */

import { randomUUID } from "node:crypto";
import { db, sql as SQL, SqlClient } from "@/lib/sql-client";

export interface ApprovalRule {
  id: string;
  tenantSlug: string;
  entityType: "purchase_order" | "bill" | "payment";
  ruleType: "amount_based" | "department_based" | "project_based" | "vendor_based";
  conditions: {
    minAmount?: number;
    maxAmount?: number;
    departmentId?: string;
    projectId?: string;
    vendorId?: string;
  };
  approvers: ApproverStep[];
  isActive: boolean;
  priority: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApproverStep {
  step: number;
  userId: string;
  role?: string;
  required: boolean;
  order: number;
}

export interface Approval {
  id: string;
  tenantSlug: string;
  entityType: "purchase_order" | "bill" | "payment";
  entityId: string;
  ruleId?: string;
  status: "pending" | "approved" | "rejected" | "escalated" | "cancelled";
  requestedBy: string;
  approverChain: ApproverStep[];
  decisions: ApprovalDecision[];
  currentStep: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalDecision {
  step: number;
  userId: string;
  decision: "approved" | "rejected" | "escalated";
  comments?: string;
  timestamp: string;
}

// using SQL imported from sql-client

export async function ensureApprovalTables(sql = SQL) {
  try {
    // Approval rules table
    await sql`
      create table if not exists approval_rules (
        id uuid primary key default gen_random_uuid(),
        tenant_slug text not null,
        entity_type text not null check (entity_type in ('purchase_order', 'bill', 'payment')),
        rule_type text not null check (rule_type in ('amount_based', 'department_based', 'project_based', 'vendor_based')),
        conditions jsonb not null,
        approvers jsonb not null,
        is_active boolean default true,
        priority integer default 0,
        metadata jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;

    // Approvals table (already exists from migration, but ensure structure)
    await sql`
      alter table approvals add column if not exists rule_id uuid
    `;

    // Create indexes
    await Promise.all([
      sql`create index if not exists approval_rules_tenant_idx on approval_rules (tenant_slug)`,
      sql`create index if not exists approval_rules_entity_idx on approval_rules (entity_type)`,
      sql`create index if not exists approval_rules_active_idx on approval_rules (is_active)`,
      sql`create index if not exists approvals_rule_idx on approvals (rule_id)`
    ]);

  } catch (error) {
    console.error("Failed to ensure approval tables:", error);
  }
}

export async function createApprovalRule(payload: {
  tenantSlug: string;
  entityType: "purchase_order" | "bill" | "payment";
  ruleType: "amount_based" | "department_based" | "project_based" | "vendor_based";
  conditions: Record<string, any>;
  approvers: ApproverStep[];
  priority?: number;
  metadata?: Record<string, unknown>;
}): Promise<ApprovalRule> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  const id = randomUUID();

  const [record] = (await sql`
    insert into approval_rules (
      id, tenant_slug, entity_type, rule_type, conditions, approvers,
      is_active, priority, metadata, created_at, updated_at
    ) values (
      ${id}, ${payload.tenantSlug}, ${payload.entityType}, ${payload.ruleType},
      ${JSON.stringify(payload.conditions)}, ${JSON.stringify(payload.approvers)},
      true, ${payload.priority || 0}, ${payload.metadata || null}, now(), now()
    ) returning *
  `) as any[];

  return {
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    ruleType: record.rule_type,
    conditions: record.conditions,
    approvers: record.approvers,
    isActive: record.is_active,
    priority: record.priority,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export async function getApprovalRules(filters: {
  tenantSlug: string;
  entityType?: string;
  isActive?: boolean;
}): Promise<ApprovalRule[]> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  const whereConditions: any[] = [];
  whereConditions.push(sql`tenant_slug = ${filters.tenantSlug}`);
  
  if (filters.entityType) {
    whereConditions.push(sql`entity_type = ${filters.entityType}`);
  }
  
  if (filters.isActive !== undefined) {
    whereConditions.push(sql`is_active = ${filters.isActive}`);
  }

    const whereClause = whereConditions.length > 0 
      ? sql`where ${db.join(whereConditions, ' and ')}`
    : sql``;

  const records = (await sql`
    select * from approval_rules 
    ${whereClause}
    order by priority desc, created_at asc
  `) as any[];

  return records.map(record => ({
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    ruleType: record.rule_type,
    conditions: record.conditions,
    approvers: record.approvers,
    isActive: record.is_active,
    priority: record.priority,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }));
}

export async function findMatchingRule(
  tenantSlug: string,
  entityType: "purchase_order" | "bill" | "payment",
  entityData: Record<string, any>
): Promise<ApprovalRule | null> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  const rules = await getApprovalRules({ tenantSlug, entityType, isActive: true });

  for (const rule of rules) {
    if (matchesRule(rule, entityData)) {
      return rule;
    }
  }

  return null;
}

function matchesRule(rule: ApprovalRule, entityData: Record<string, any>): boolean {
  const { conditions } = rule;

  switch (rule.ruleType) {
    case "amount_based":
      const amount = entityData.amount || entityData.total || 0;
      if (conditions.minAmount && amount < conditions.minAmount) return false;
      if (conditions.maxAmount && amount > conditions.maxAmount) return false;
      break;

    case "department_based":
      if (conditions.departmentId && entityData.departmentId !== conditions.departmentId) return false;
      break;

    case "project_based":
      if (conditions.projectId && entityData.projectId !== conditions.projectId) return false;
      break;

    case "vendor_based":
      if (conditions.vendorId && entityData.vendorId !== conditions.vendorId) return false;
      break;
  }

  return true;
}

export async function initiateApproval(payload: {
  tenantSlug: string;
  entityType: "purchase_order" | "bill" | "payment";
  entityId: string;
  requestedBy: string;
  entityData: Record<string, any>;
}): Promise<Approval> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  // Find matching approval rule
  const rule = await findMatchingRule(payload.tenantSlug, payload.entityType, payload.entityData);

  const id = randomUUID();
  const approverChain = rule?.approvers || [];
  
  const [record] = (await sql`
    insert into approvals (
      id, tenant_slug, entity_type, entity_id, rule_id, status,
      requested_by, approver_chain, decisions, current_step, metadata,
      created_at, updated_at
    ) values (
      ${id}, ${payload.tenantSlug}, ${payload.entityType}, ${payload.entityId},
      ${rule?.id || null}, 'pending', ${payload.requestedBy},
      ${JSON.stringify(approverChain)}, ${JSON.stringify([])}, 0,
      ${JSON.stringify(payload.entityData)}, now(), now()
    ) returning *
  `) as any[];

  return {
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    entityId: record.entity_id,
    ruleId: record.rule_id,
    status: record.status,
    requestedBy: record.requested_by,
    approverChain: record.approver_chain,
    decisions: record.decisions || [],
    currentStep: record.current_step,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export async function processApprovalDecision(payload: {
  approvalId: string;
  userId: string;
  decision: "approved" | "rejected" | "escalated";
  comments?: string;
}): Promise<Approval | null> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  // Get current approval
  const [current] = (await sql`
    select * from approvals where id = ${payload.approvalId} limit 1
  `) as any[];

  if (!current) return null;

  const approverChain = current.approver_chain;
  const decisions = current.decisions || [];
  const currentStep = current.current_step;

  // Check if user is authorized to make decision at current step
  const currentStepApprovers = approverChain.filter((step: ApproverStep) => step.step === currentStep);
  const isAuthorized = currentStepApprovers.some((step: ApproverStep) => step.userId === payload.userId);

  if (!isAuthorized) {
    throw new Error("User not authorized to approve at current step");
  }

  // Add decision
  const newDecision: ApprovalDecision = {
    step: currentStep,
    userId: payload.userId,
    decision: payload.decision,
    comments: payload.comments,
    timestamp: new Date().toISOString()
  };

  decisions.push(newDecision);

  // Determine new status and step
  let newStatus = current.status;
  let newStep = currentStep;

  if (payload.decision === "rejected") {
    newStatus = "rejected";
  } else if (payload.decision === "escalated") {
    newStatus = "escalated";
    newStep = Math.min(currentStep + 1, approverChain.length - 1);
  } else if (payload.decision === "approved") {
    // Check if all required approvers at current step have approved
    const stepDecisions = decisions.filter((d: ApprovalDecision) => d.step === currentStep && d.decision === "approved");
    const requiredApprovers = currentStepApprovers.filter((step: ApproverStep) => step.required);
    
    if (stepDecisions.length >= requiredApprovers.length) {
      // Move to next step or complete approval
      if (currentStep >= approverChain.length - 1) {
        newStatus = "approved";
      } else {
        newStep = currentStep + 1;
      }
    }
  }

  // Update approval
  const [updated] = (await sql`
    update approvals set
      status = ${newStatus},
      decisions = ${JSON.stringify(decisions)},
      current_step = ${newStep},
      updated_at = now()
    where id = ${payload.approvalId}
    returning *
  `) as any[];

  return {
    id: updated.id,
    tenantSlug: updated.tenant_slug,
    entityType: updated.entity_type,
    entityId: updated.entity_id,
    ruleId: updated.rule_id,
    status: updated.status,
    requestedBy: updated.requested_by,
    approverChain: updated.approver_chain,
    decisions: updated.decisions,
    currentStep: updated.current_step,
    metadata: updated.metadata,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at
  };
}

export async function getApprovals(filters: {
  tenantSlug: string;
  entityType?: string;
  entityId?: string;
  status?: string;
  userId?: string; // Approvals where user is an approver
  limit?: number;
  offset?: number;
}): Promise<Approval[]> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const whereConditions: any[] = [];
  whereConditions.push(sql`tenant_slug = ${filters.tenantSlug}`);
  
  if (filters.entityType) {
    whereConditions.push(sql`entity_type = ${filters.entityType}`);
  }
  
  if (filters.entityId) {
    whereConditions.push(sql`entity_id = ${filters.entityId}`);
  }
  
  if (filters.status) {
    whereConditions.push(sql`status = ${filters.status}`);
  }

  const whereClause = whereConditions.length > 0 
    ? sql`where ${db.join(whereConditions, ' and ')}`
    : sql``;

  const records = (await sql`
    select * from approvals 
    ${whereClause}
    order by created_at desc
    limit ${limit} offset ${offset}
  `) as any[];

  return records.map(record => ({
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    entityId: record.entity_id,
    ruleId: record.rule_id,
    status: record.status,
    requestedBy: record.requested_by,
    approverChain: record.approver_chain,
    decisions: record.decisions || [],
    currentStep: record.current_step,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }));
}

export async function getPendingApprovalsForUser(
  tenantSlug: string,
  userId: string
): Promise<Approval[]> {
  const sql = SQL;
  await ensureApprovalTables(sql);

  const records = (await sql`
    select * from approvals 
    where tenant_slug = ${tenantSlug}
    and status = 'pending'
    and approver_chain @> '[{"userId": ' || ${userId} || '}]'
    order by created_at asc
  `) as any[];

  return records.map(record => ({
    id: record.id,
    tenantSlug: record.tenant_slug,
    entityType: record.entity_type,
    entityId: record.entity_id,
    ruleId: record.rule_id,
    status: record.status,
    requestedBy: record.requested_by,
    approverChain: record.approver_chain,
    decisions: record.decisions || [],
    currentStep: record.current_step,
    metadata: record.metadata,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  }));
}
