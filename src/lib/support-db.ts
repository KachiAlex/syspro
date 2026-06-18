import { randomUUID } from "crypto";
import { db } from "./sql-client";
import type { SupportTicket, TicketComment, TicketActivityLog, FieldJob, SupportIncident, KnowledgeBaseArticle, SlaPolicy, EngineerProfile, TicketStatus, Priority, ImpactLevel, TicketSource, TicketType } from "./support-data";

function rowToTicket(r: any): SupportTicket {
  return {
    id: r.id, tenantSlug: r.tenant_slug, ticketNumber: r.ticket_number, title: r.title, description: r.description,
    ticketType: r.ticket_type, source: r.source, impactLevel: r.impact_level, priority: r.priority, status: r.status,
    departmentId: r.department_id, serviceArea: r.service_area, region: r.region, branchId: r.branch_id,
    customerId: r.customer_id, projectId: r.project_id, slaPolicyId: r.sla_policy_id,
    assignedEngineerId: r.assigned_engineer_id, backupEngineerId: r.backup_engineer_id,
    escalationLevel: r.escalation_level ?? 0, tags: r.tags ?? [], attachments: r.attachments,
    autoAssignment: r.auto_assignment, responseDueAt: r.response_due_at, resolutionDueAt: r.resolution_due_at,
    responseBreachedAt: r.response_breached_at, resolutionBreachedAt: r.resolution_breached_at,
    firstResponseAt: r.first_response_at, acknowledgedAt: r.acknowledged_at, diagnosingAt: r.diagnosing_at,
    inProgressAt: r.in_progress_at, awaitingCustomerAt: r.awaiting_customer_at,
    awaitingDependencyAt: r.awaiting_dependency_at, resolvedAt: r.resolved_at,
    closedAt: r.closed_at, reopenedAt: r.reopened_at, createdBy: r.created_by, updatedBy: r.updated_by,
    createdAt: r.created_at, updatedAt: r.updated_at, metadata: r.metadata,
  };
}

function rowToComment(r: any): TicketComment {
  return { id: r.id, tenantSlug: r.tenant_slug, ticketId: r.ticket_id, commentType: r.comment_type, body: r.body, authorId: r.author_id, visibility: r.visibility, createdAt: r.created_at };
}

function rowToActivity(r: any): TicketActivityLog {
  return { id: r.id, tenantSlug: r.tenant_slug, ticketId: r.ticket_id, activityType: r.activity_type, actorId: r.actor_id, details: r.details, createdAt: r.created_at };
}

function rowToFieldJob(r: any): FieldJob {
  return {
    id: r.id, tenantSlug: r.tenant_slug, ticketId: r.ticket_id, engineerId: r.engineer_id, status: r.status,
    location: r.location, travelLog: r.travel_log, scheduledAt: r.scheduled_at, dispatchedAt: r.dispatched_at,
    arrivalConfirmedAt: r.arrival_confirmed_at, workStartedAt: r.work_started_at, workCompletedAt: r.work_completed_at,
    customerSignoff: r.customer_signoff, beforeMedia: r.before_media, afterMedia: r.after_media,
    workNotes: r.work_notes, hoursWorked: r.hours_worked, costCenterId: r.cost_center_id, metadata: r.metadata,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function rowToIncident(r: any): SupportIncident {
  return {
    id: r.id, tenantSlug: r.tenant_slug, sourceSystem: r.source_system, incidentType: r.incident_type,
    severity: r.severity, status: r.status, detectedAt: r.detected_at, acknowledgedAt: r.acknowledged_at,
    resolvedAt: r.resolved_at, summary: r.summary, affectedServices: r.affected_services ?? [],
    region: r.region, branchId: r.branch_id, linkedTicketId: r.linked_ticket_id, metadata: r.metadata,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function rowToKb(r: any): KnowledgeBaseArticle {
  return {
    id: r.id, tenantSlug: r.tenant_slug, title: r.title, category: r.category, audience: r.audience,
    summary: r.summary, content: r.content, tags: r.tags ?? [], relatedTicketIds: r.related_ticket_ids ?? [],
    solutionSteps: r.solution_steps, attachments: r.attachments, effectivenessScore: r.effectiveness_score ?? 0,
    publishStatus: r.publish_status, createdBy: r.created_by, updatedBy: r.updated_by,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function rowToSla(r: any): SlaPolicy {
  return {
    id: r.id, tenantSlug: r.tenant_slug, name: r.name, priority: r.priority, impactLevel: r.impact_level,
    responseMinutes: r.response_minutes, resolutionMinutes: r.resolution_minutes,
    escalationChain: r.escalation_chain ?? [], autoEscalate: r.auto_escalate, active: r.active,
    description: r.description, metadata: r.metadata, createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function rowToEng(r: any): EngineerProfile {
  return {
    id: r.id, tenantSlug: r.tenant_slug, employeeId: r.employee_id, displayName: r.display_name, role: r.role,
    branchId: r.branch_id, region: r.region, serviceAreas: r.service_areas ?? [], skills: r.skills ?? [],
    certifications: r.certifications ?? [], onDuty: r.on_duty, currentLoad: r.current_load, maxLoad: r.max_load,
    performanceScore: r.performance_score, lastAssignmentAt: r.last_assignment_at, availability: r.availability,
    metadata: r.metadata, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// === Tickets ===

export interface TicketFilters { status?: TicketStatus; priority?: Priority; ticketType?: TicketType; assignedEngineerId?: string; region?: string; serviceArea?: string; }

export async function listTickets(tenantSlug: string, filters: TicketFilters = {}): Promise<SupportTicket[]> {
  const { rows } = await db.query(`select * from support_tickets where tenant_slug = $1 order by created_at desc`, [tenantSlug]);
  let t = (rows || []).map(rowToTicket);
  if (filters.status) t = t.filter((x) => x.status === filters.status);
  if (filters.priority) t = t.filter((x) => x.priority === filters.priority);
  if (filters.ticketType) t = t.filter((x) => x.ticketType === filters.ticketType);
  if (filters.assignedEngineerId) t = t.filter((x) => x.assignedEngineerId === filters.assignedEngineerId);
  if (filters.region) t = t.filter((x) => x.region === filters.region);
  if (filters.serviceArea) t = t.filter((x) => x.serviceArea === filters.serviceArea);
  return t;
}

export async function getTicketById(tenantSlug: string, ticketId: string): Promise<SupportTicket | null> {
  const { rows } = await db.query(`select * from support_tickets where tenant_slug = $1 and id = $2 limit 1`, [tenantSlug, ticketId]);
  return rows?.[0] ? rowToTicket(rows[0]) : null;
}

export interface CreateTicketInput {
  tenantSlug: string; title: string; description?: string; ticketType: TicketType; source: TicketSource;
  impactLevel: ImpactLevel; priority: Priority; departmentId?: string; serviceArea?: string; region?: string;
  branchId?: string; customerId?: string; projectId?: string; tags?: string[]; createdBy?: string;
}

export async function createTicket(input: CreateTicketInput): Promise<SupportTicket> {
  const { tenantSlug, title, description, ticketType, source, impactLevel, priority, departmentId, serviceArea, region, branchId, customerId, projectId, tags = [], createdBy } = input;
  const { rows: slaRows } = await db.query(`select * from sla_policies where tenant_slug = $1 and priority = $2 and active = true order by created_at desc limit 1`, [tenantSlug, priority]);
  const sla = slaRows?.[0];
  const id = randomUUID(); const now = new Date();
  const num = `IT-${now.getFullYear()}-${Math.floor(Math.random()*9000+1000)}`;
  const rDue = sla ? new Date(now.getTime() + sla.response_minutes*60000).toISOString() : null;
  const resDue = sla ? new Date(now.getTime() + sla.resolution_minutes*60000).toISOString() : null;
  await db.query(
    `insert into support_tickets (id,tenant_slug,ticket_number,title,description,ticket_type,source,impact_level,priority,status,department_id,service_area,region,branch_id,customer_id,project_id,sla_policy_id,escalation_level,tags,response_due_at,resolution_due_at,created_by,updated_by,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$24)`,
    [id, tenantSlug, num, title, description||null, ticketType, source, impactLevel, priority, "new", departmentId||null, serviceArea||null, region||null, branchId||null, customerId||null, projectId||null, sla?.id||null, 0, tags, rDue, resDue, createdBy||null, createdBy||null, now.toISOString()]
  );
  await addTicketActivity(tenantSlug, id, { activityType: "ticket_created", actorId: createdBy, details: { source } });
  return (await getTicketById(tenantSlug, id))!;
}

export interface UpdateTicketInput { status?: TicketStatus; assignedEngineerId?: string | null; backupEngineerId?: string | null; priority?: Priority; impactLevel?: ImpactLevel; tags?: string[]; updatedBy?: string; }

export async function updateTicket(tenantSlug: string, ticketId: string, updates: UpdateTicketInput): Promise<SupportTicket | null> {
  const existing = await getTicketById(tenantSlug, ticketId); if (!existing) return null;
  const now = new Date().toISOString();
  const map: Record<string, string> = { acknowledged: "acknowledged_at", diagnosing: "diagnosing_at", in_progress: "in_progress_at", awaiting_customer: "awaiting_customer_at", awaiting_dependency: "awaiting_dependency_at", resolved: "resolved_at", closed: "closed_at", reopened: "reopened_at" };
  const sets: string[] = []; const vals: any[] = []; let i = 1;
  if (updates.status) { sets.push(`status=$${i++}`); vals.push(updates.status); const col = map[updates.status]; if (col) { sets.push(`${col}=$${i++}`); vals.push(now); } if (updates.status === "acknowledged" && !existing.firstResponseAt) { sets.push(`first_response_at=$${i++}`); vals.push(now); } }
  if (updates.assignedEngineerId !== undefined) { sets.push(`assigned_engineer_id=$${i++}`); vals.push(updates.assignedEngineerId); }
  if (updates.backupEngineerId !== undefined) { sets.push(`backup_engineer_id=$${i++}`); vals.push(updates.backupEngineerId); }
  if (updates.priority) { sets.push(`priority=$${i++}`); vals.push(updates.priority); }
  if (updates.impactLevel) { sets.push(`impact_level=$${i++}`); vals.push(updates.impactLevel); }
  if (updates.tags) { sets.push(`tags=$${i++}`); vals.push(updates.tags); }
  sets.push(`updated_by=$${i++}`); vals.push(updates.updatedBy||null);
  sets.push(`updated_at=$${i++}`); vals.push(now);
  vals.push(ticketId, tenantSlug);
  const { rows } = await db.query(`update support_tickets set ${sets.join(", ")} where id=$${i++} and tenant_slug=$${i++} returning *`, vals);
  const updated = rows?.[0] ? rowToTicket(rows[0]) : null;
  if (updates.status && updated) await addTicketActivity(tenantSlug, ticketId, { activityType: "status_changed", actorId: updates.updatedBy, details: { from: existing.status, to: updates.status } });
  return updated;
}

// === Comments ===

export interface CommentInput { tenantSlug: string; ticketId: string; body: string; authorId?: string; commentType?: "internal" | "customer" | "system"; visibility?: "internal" | "external"; }

export async function addTicketComment(input: CommentInput): Promise<TicketComment | null> {
  const ticket = await getTicketById(input.tenantSlug, input.ticketId); if (!ticket) return null;
  const id = randomUUID(); const now = new Date().toISOString();
  await db.query(`insert into ticket_comments (id,tenant_slug,ticket_id,comment_type,body,author_id,visibility,created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, input.tenantSlug, input.ticketId, input.commentType||"internal", input.body, input.authorId||null, input.visibility||"internal", now]);
  await addTicketActivity(input.tenantSlug, input.ticketId, { activityType: "comment_added", actorId: input.authorId, details: { commentType: input.commentType||"internal" } });
  return { id, tenantSlug: input.tenantSlug, ticketId: input.ticketId, commentType: input.commentType||"internal", body: input.body, authorId: input.authorId, visibility: input.visibility||"internal", createdAt: now };
}

export async function listTicketComments(tenantSlug: string, ticketId: string): Promise<TicketComment[]> {
  const { rows } = await db.query(`select * from ticket_comments where tenant_slug=$1 and ticket_id=$2 order by created_at desc`, [tenantSlug, ticketId]);
  return (rows||[]).map(rowToComment);
}

// === Activities ===

export interface ActivityInput { activityType: string; actorId?: string; details?: Record<string, unknown>; }

export async function addTicketActivity(tenantSlug: string, ticketId: string, activity: ActivityInput): Promise<TicketActivityLog> {
  const id = randomUUID(); const now = new Date().toISOString();
  await db.query(`insert into ticket_activity_logs (id,tenant_slug,ticket_id,activity_type,actor_id,details,created_at) values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, tenantSlug, ticketId, activity.activityType, activity.actorId||null, JSON.stringify(activity.details||{}), now]);
  return { id, tenantSlug, ticketId, activityType: activity.activityType, actorId: activity.actorId, details: activity.details, createdAt: now };
}

export async function listTicketActivities(tenantSlug: string, ticketId: string): Promise<TicketActivityLog[]> {
  const { rows } = await db.query(`select * from ticket_activity_logs where tenant_slug=$1 and ticket_id=$2 order by created_at desc`, [tenantSlug, ticketId]);
  return (rows||[]).map(rowToActivity);
}

// === Field Jobs ===

export interface FieldJobInput { tenantSlug: string; ticketId: string; engineerId?: string; scheduledAt?: string; location?: Record<string, unknown>; createdBy?: string; }

export async function addFieldJob(input: FieldJobInput): Promise<FieldJob | null> {
  const ticket = await getTicketById(input.tenantSlug, input.ticketId); if (!ticket) return null;
  const id = randomUUID(); const now = new Date().toISOString();
  await db.query(`insert into field_jobs (id,tenant_slug,ticket_id,engineer_id,status,location,scheduled_at,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
    [id, input.tenantSlug, input.ticketId, input.engineerId||null, "scheduled", JSON.stringify(input.location||{}), input.scheduledAt||now, now]);
  await addTicketActivity(input.tenantSlug, input.ticketId, { activityType: "field_job_created", actorId: input.createdBy, details: { engineerId: input.engineerId } });
  return { id, tenantSlug: input.tenantSlug, ticketId: input.ticketId, engineerId: input.engineerId, status: "scheduled", location: input.location, scheduledAt: input.scheduledAt||now, createdAt: now, updatedAt: now };
}

export async function listFieldJobs(tenantSlug: string, ticketId?: string): Promise<FieldJob[]> {
  let q = `select * from field_jobs where tenant_slug=$1`; const p: any[] = [tenantSlug];
  if (ticketId) { q += ` and ticket_id=$2`; p.push(ticketId); }
  q += ` order by created_at desc`; const { rows } = await db.query(q, p);
  return (rows||[]).map(rowToFieldJob);
}

// === SLA ===

export async function listSlaPolicies(tenantSlug: string): Promise<SlaPolicy[]> {
  const { rows } = await db.query(`select * from sla_policies where tenant_slug=$1 order by created_at desc`, [tenantSlug]);
  return (rows||[]).map(rowToSla);
}

export async function createSlaPolicy(policy: Omit<SlaPolicy, "id" | "createdAt" | "updatedAt">): Promise<SlaPolicy> {
  const id = randomUUID(); const now = new Date().toISOString();
  await db.query(`insert into sla_policies (id,tenant_slug,name,priority,impact_level,response_minutes,resolution_minutes,escalation_chain,auto_escalate,active,description,metadata,created_by,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
    [id, policy.tenantSlug, policy.name, policy.priority, policy.impactLevel, policy.responseMinutes, policy.resolutionMinutes, policy.escalationChain, policy.autoEscalate, policy.active, policy.description||null, JSON.stringify(policy.metadata||{}), policy.createdBy||null, now]);
  return { ...policy, id, createdAt: now, updatedAt: now };
}

// === Incidents ===

export interface IncidentInput { tenantSlug: string; sourceSystem: string; incidentType?: string; severity: ImpactLevel; summary?: string; affectedServices?: string[]; region?: string; branchId?: string; linkedTicketId?: string; }

export async function createIncident(input: IncidentInput): Promise<SupportIncident> {
  const id = randomUUID(); const now = new Date().toISOString();
  await db.query(`insert into support_incidents (id,tenant_slug,source_system,incident_type,severity,status,detected_at,summary,affected_services,region,branch_id,linked_ticket_id,metadata,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)`,
    [id, input.tenantSlug, input.sourceSystem, input.incidentType||null, input.severity, "open", now, input.summary||null, input.affectedServices||[], input.region||null, input.branchId||null, input.linkedTicketId||null, JSON.stringify({}), now]);
  if (input.linkedTicketId) await addTicketActivity(input.tenantSlug, input.linkedTicketId, { activityType: "incident_linked", details: { incidentId: id } });
  return { id, tenantSlug: input.tenantSlug, sourceSystem: input.sourceSystem, incidentType: input.incidentType, severity: input.severity, status: "open", detectedAt: now, summary: input.summary, affectedServices: input.affectedServices||[], region: input.region, branchId: input.branchId, linkedTicketId: input.linkedTicketId, createdAt: now, updatedAt: now };
}

export async function listIncidents(tenantSlug: string): Promise<SupportIncident[]> {
  const { rows } = await db.query(`select * from support_incidents where tenant_slug=$1 order by created_at desc`, [tenantSlug]);
  return (rows||[]).map(rowToIncident);
}

// === Knowledge Base ===

export interface KnowledgeBaseInput { tenantSlug: string; title: string; content: string; audience?: KnowledgeBaseArticle["audience"]; category?: string; summary?: string; tags?: string[]; relatedTicketIds?: string[]; solutionSteps?: Record<string, unknown>; attachments?: Record<string, unknown>; createdBy?: string; }

export async function createKnowledgeBaseArticle(input: KnowledgeBaseInput): Promise<KnowledgeBaseArticle> {
  const id = randomUUID(); const now = new Date().toISOString();
  await db.query(`insert into knowledge_base_articles (id,tenant_slug,title,category,audience,summary,content,tags,related_ticket_ids,solution_steps,attachments,effectiveness_score,publish_status,created_by,updated_by,created_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)`,
    [id, input.tenantSlug, input.title, input.category||null, input.audience||"internal", input.summary||null, input.content, input.tags||[], input.relatedTicketIds||[], JSON.stringify(input.solutionSteps||{}), JSON.stringify(input.attachments||{}), 0, "draft", input.createdBy||null, input.createdBy||null, now]);
  return { id, tenantSlug: input.tenantSlug, title: input.title, category: input.category, audience: input.audience||"internal", summary: input.summary, content: input.content, tags: input.tags||[], relatedTicketIds: input.relatedTicketIds||[], solutionSteps: input.solutionSteps, attachments: input.attachments, effectivenessScore: 0, publishStatus: "draft", createdBy: input.createdBy, updatedBy: input.createdBy, createdAt: now, updatedAt: now };
}

export async function listKnowledgeBaseArticles(tenantSlug: string): Promise<KnowledgeBaseArticle[]> {
  const { rows } = await db.query(`select * from knowledge_base_articles where tenant_slug=$1 order by created_at desc`, [tenantSlug]);
  return (rows||[]).map(rowToKb);
}

// === Dashboard Metrics ===

export async function getDashboardMetrics(tenantSlug: string) {
  const { rows: tr } = await db.query(`select * from support_tickets where tenant_slug=$1`, [tenantSlug]);
  const tickets = (tr||[]).map(rowToTicket); const now = Date.now();
  const open = tickets.filter((t) => ["new","acknowledged","diagnosing","in_progress","awaiting_customer","awaiting_dependency"].includes(t.status));
  const breaches = tickets.filter((t) => t.resolutionDueAt && !["resolved","closed"].includes(t.status) && new Date(t.resolutionDueAt).getTime() < now);
  const { rows: er } = await db.query(`select * from engineer_profiles where tenant_slug=$1`, [tenantSlug]);
  const engineers = (er||[]).map(rowToEng);
  const workload = engineers.map((e) => ({ engineerId: e.id, engineerName: e.displayName, currentLoad: e.currentLoad, maxLoad: e.maxLoad, utilization: Math.round((e.currentLoad/e.maxLoad)*100) }));
  const { rows: jr } = await db.query(`select * from field_jobs where tenant_slug=$1`, [tenantSlug]);
  const jobs = (jr||[]).map(rowToFieldJob);
  const { rows: ir } = await db.query(`select * from support_incidents where tenant_slug=$1 and status='open' order by created_at desc`, [tenantSlug]);
  const incidents = (ir||[]).map(rowToIncident);
  return {
    totals: { ticketsOpen: open.length, ticketsCritical: open.filter((t) => t.priority==="critical").length, slaBreaches: breaches.length, fieldJobsActive: jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled").length },
    sla: { atRisk: breaches.map((t) => ({ ticketId: t.id, ticketNumber: t.ticketNumber, resolutionDueAt: t.resolutionDueAt })) },
    workload,
    incidents: { open: incidents.length, items: incidents.slice(0,5).map((i) => ({ id: i.id, summary: i.summary, severity: i.severity, detectedAt: i.detectedAt })) },
  };
}

// === Assignment ===

export interface AssignmentRequest { tenantSlug: string; serviceArea?: string; departmentId?: string; skills?: string[]; region?: string; }

export async function suggestAssignment(request: AssignmentRequest) {
  const { rows } = await db.query(`select * from engineer_profiles where tenant_slug=$1`, [request.tenantSlug]);
  const engineers = (rows||[]).map(rowToEng);
  const skills = (request.skills||[]).map((s) => s.toLowerCase());
  const scored = engineers.map((e) => {
    const skillMatch = skills.length ? Math.round((skills.filter((s) => (e.skills||[]).map((x) => x.toLowerCase()).includes(s)).length / skills.length)*100) : 70;
    const loadScore = Math.max(0, 100 - (e.currentLoad/e.maxLoad)*100);
    const regionalBonus = request.region && e.region === request.region ? 10 : 0;
    const total = Math.min(100, Math.round(skillMatch*0.45 + loadScore*0.35 + e.performanceScore*0.2 + regionalBonus));
    return { engineerId: e.id, engineerName: e.displayName, skillMatch, loadScore, performanceScore: e.performanceScore, onDuty: e.onDuty, total };
  });
  scored.sort((a, b) => b.total - a.total);
  return { primary: scored[0], backup: scored[1] || null, ranked: scored };
}

export async function listEngineers(tenantSlug: string): Promise<EngineerProfile[]> {
  const { rows } = await db.query(`select * from engineer_profiles where tenant_slug=$1`, [tenantSlug]);
  return (rows||[]).map(rowToEng);
}

// Legacy compatibility
export async function getTenantSupportData(tenantSlug: string) {
  return { slaPolicies: await listSlaPolicies(tenantSlug), engineers: await listEngineers(tenantSlug), tickets: await listTickets(tenantSlug), comments: [], activities: [], fieldJobs: await listFieldJobs(tenantSlug), incidents: await listIncidents(tenantSlug), knowledgeBase: await listKnowledgeBaseArticles(tenantSlug) };
}
