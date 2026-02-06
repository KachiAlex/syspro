import { randomUUID } from "crypto";

type ImpactLevel = "critical" | "high" | "medium" | "low";
type Priority = ImpactLevel;
export type TicketStatus =
  | "new"
  | "acknowledged"
  | "diagnosing"
  | "in_progress"
  | "awaiting_customer"
  | "awaiting_dependency"
  | "resolved"
  | "closed"
  | "reopened";

export type TicketSource = "erp" | "crm" | "email" | "api" | "mobile" | "monitoring";
export type TicketType = "internal" | "customer";

export interface SlaPolicy {
  id: string;
  tenantSlug: string;
  name: string;
  priority: Priority;
  impactLevel: ImpactLevel;
  responseMinutes: number;
  resolutionMinutes: number;
  escalationChain: string[];
  autoEscalate: boolean;
  active: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EngineerProfile {
  id: string;
  tenantSlug: string;
  employeeId: string;
  displayName: string;
  role: string;
  branchId?: string;
  region?: string;
  serviceAreas: string[];
  skills: string[];
  certifications: string[];
  onDuty: boolean;
  currentLoad: number;
  maxLoad: number;
  performanceScore: number;
  lastAssignmentAt?: string;
  availability?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicket {
  id: string;
  tenantSlug: string;
  ticketNumber: string;
  title: string;
  description?: string;
  ticketType: TicketType;
  source: TicketSource;
  impactLevel: ImpactLevel;
  priority: Priority;
  status: TicketStatus;
  departmentId?: string;
  serviceArea?: string;
  region?: string;
  branchId?: string;
  customerId?: string;
  projectId?: string;
  slaPolicyId?: string;
  assignedEngineerId?: string;
  backupEngineerId?: string;
  escalationLevel: number;
  tags: string[];
  attachments?: Record<string, unknown>;
  autoAssignment?: Record<string, unknown>;
  responseDueAt?: string;
  resolutionDueAt?: string;
  responseBreachedAt?: string;
  resolutionBreachedAt?: string;
  firstResponseAt?: string;
  acknowledgedAt?: string;
  diagnosingAt?: string;
  inProgressAt?: string;
  awaitingCustomerAt?: string;
  awaitingDependencyAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface TicketComment {
  id: string;
  tenantSlug: string;
  ticketId: string;
  commentType: "internal" | "customer" | "system";
  body: string;
  attachments?: Record<string, unknown>;
  authorId?: string;
  visibility: "internal" | "external";
  createdAt: string;
}

export interface TicketActivityLog {
  id: string;
  tenantSlug: string;
  ticketId: string;
  activityType: string;
  actorId?: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface FieldJob {
  id: string;
  tenantSlug: string;
  ticketId: string;
  engineerId?: string;
  status: "scheduled" | "dispatched" | "in_transit" | "on_site" | "completed" | "cancelled";
  location?: Record<string, unknown>;
  travelLog?: Record<string, unknown>;
  scheduledAt?: string;
  dispatchedAt?: string;
  arrivalConfirmedAt?: string;
  workStartedAt?: string;
  workCompletedAt?: string;
  customerSignoff?: Record<string, unknown>;
  beforeMedia?: Record<string, unknown>;
  afterMedia?: Record<string, unknown>;
  workNotes?: string;
  hoursWorked?: number;
  costCenterId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SupportIncident {
  id: string;
  tenantSlug: string;
  sourceSystem: string;
  incidentType?: string;
  severity: ImpactLevel;
  status: "open" | "monitoring" | "resolved" | "closed";
  detectedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  summary?: string;
  affectedServices: string[];
  region?: string;
  branchId?: string;
  linkedTicketId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseArticle {
  id: string;
  tenantSlug: string;
  title: string;
  category?: string;
  audience: "internal" | "customer" | "field";
  summary?: string;
  content: string;
  tags: string[];
  relatedTicketIds: string[];
  solutionSteps?: Record<string, unknown>;
  attachments?: Record<string, unknown>;
  effectivenessScore: number;
  publishStatus: "draft" | "published" | "retired";
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface TenantSupportData {
  slaPolicies: SlaPolicy[];
  engineers: EngineerProfile[];
  tickets: SupportTicket[];
  comments: TicketComment[];
  activities: TicketActivityLog[];
  fieldJobs: FieldJob[];
  incidents: SupportIncident[];
  knowledgeBase: KnowledgeBaseArticle[];
}

const store: Record<string, TenantSupportData> = {};

function seedTenant(tenantSlug: string): TenantSupportData {
  if (store[tenantSlug]) {
    return store[tenantSlug];
  }

  const now = new Date().toISOString();

  const slaPolicies: SlaPolicy[] = [
    {
      id: randomUUID(),
      tenantSlug,
      name: "Critical Uptime",
      priority: "critical",
      impactLevel: "critical",
      responseMinutes: 15,
      resolutionMinutes: 120,
      escalationChain: ["senior-engineer", "hod-ops", "ops-manager"],
      autoEscalate: true,
      active: true,
      description: "For outages affecting production network",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      tenantSlug,
      name: "High Impact",
      priority: "high",
      impactLevel: "high",
      responseMinutes: 60,
      resolutionMinutes: 360,
      escalationChain: ["duty-engineer", "regional-lead"],
      autoEscalate: true,
      active: true,
      description: "Major degradation with workarounds",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const engineers: EngineerProfile[] = [
    {
      id: "eng-ade",
      tenantSlug,
      employeeId: "emp-ade",
      displayName: "Adeola Bamidele",
      role: "Senior Network Engineer",
      branchId: undefined,
      region: "West Africa",
      serviceAreas: ["Core Network", "Fiber"],
      skills: ["mpls", "fiber", "routing"],
      certifications: ["CCNP"],
      onDuty: true,
      currentLoad: 3,
      maxLoad: 6,
      performanceScore: 92,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "eng-ife",
      tenantSlug,
      employeeId: "emp-ife",
      displayName: "Ifeoma Umeh",
      role: "Field Engineer",
      branchId: undefined,
      region: "West Africa",
      serviceAreas: ["Access", "Customer Sites"],
      skills: ["fiber", "last-mile", "power"],
      certifications: ["FiberTech"],
      onDuty: true,
      currentLoad: 2,
      maxLoad: 5,
      performanceScore: 87,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "eng-kay",
      tenantSlug,
      employeeId: "emp-kay",
      displayName: "Kayode Hassan",
      role: "Systems Engineer",
      branchId: undefined,
      region: "West Africa",
      serviceAreas: ["Internal IT"],
      skills: ["windows", "sso", "security"],
      certifications: ["Azure Admin"],
      onDuty: false,
      currentLoad: 1,
      maxLoad: 4,
      performanceScore: 80,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const tickets: SupportTicket[] = [
    {
      id: randomUUID(),
      tenantSlug,
      ticketNumber: "IT-2026-0001",
      title: "MetroWave POP outage",
      description: "Transport ring down on Abuja West",
      ticketType: "customer",
      source: "monitoring",
      impactLevel: "critical",
      priority: "critical",
      status: "diagnosing",
      serviceArea: "Core Network",
      region: "West Africa",
      slaPolicyId: slaPolicies[0].id,
      assignedEngineerId: engineers[0].id,
      escalationLevel: 1,
      tags: ["fiber", "backbone"],
      responseDueAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      diagnosingAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      tenantSlug,
      ticketNumber: "IT-2026-0002",
      title: "VPN auth failures",
      description: "Internal VPN refusing logins",
      ticketType: "internal",
      source: "erp",
      impactLevel: "high",
      priority: "high",
      status: "in_progress",
      departmentId: "it",
      serviceArea: "Internal IT",
      region: "West Africa",
      slaPolicyId: slaPolicies[1].id,
      assignedEngineerId: engineers[2].id,
      tags: ["vpn", "auth"],
      responseDueAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      resolutionDueAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      acknowledgedAt: now,
      inProgressAt: now,
      escalationLevel: 0,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const comments: TicketComment[] = [];
  const activities: TicketActivityLog[] = [];
  const fieldJobs: FieldJob[] = [];
  const incidents: SupportIncident[] = [
    {
      id: randomUUID(),
      tenantSlug,
      sourceSystem: "NMS",
      incidentType: "FiberBreak",
      severity: "critical",
      status: "open",
      detectedAt: now,
      summary: "Backbone outage on MetroWave ring",
      affectedServices: ["MetroWave Core", "Enterprise Fiber"],
      region: "West Africa",
      linkedTicketId: tickets[0].id,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const knowledgeBase: KnowledgeBaseArticle[] = [
    {
      id: randomUUID(),
      tenantSlug,
      title: "Fiber ring diagnostics checklist",
      category: "Network",
      audience: "internal",
      summary: "Steps to triage metro fiber outages",
      content: "1. Validate alarms...",
      tags: ["fiber", "diagnostics"],
      relatedTicketIds: [tickets[0].id],
      effectivenessScore: 86,
      publishStatus: "published",
      createdAt: now,
      updatedAt: now,
    },
  ];

  store[tenantSlug] = {
    slaPolicies,
    engineers,
    tickets,
    comments,
    activities,
    fieldJobs,
    incidents,
    knowledgeBase,
  };

  return store[tenantSlug];
}

function getTenantSupportData(tenantSlug: string): TenantSupportData {
  return store[tenantSlug] || seedTenant(tenantSlug);
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: Priority;
  ticketType?: TicketType;
  assignedEngineerId?: string;
  region?: string;
  serviceArea?: string;
}

export function listTickets(tenantSlug: string, filters: TicketFilters = {}): SupportTicket[] {
  const { tickets } = getTenantSupportData(tenantSlug);
  return tickets.filter((ticket) => {
    if (filters.status && ticket.status !== filters.status) {
      return false;
    }
    if (filters.priority && ticket.priority !== filters.priority) {
      return false;
    }
    if (filters.ticketType && ticket.ticketType !== filters.ticketType) {
      return false;
    }
    if (filters.assignedEngineerId && ticket.assignedEngineerId !== filters.assignedEngineerId) {
      return false;
    }
    if (filters.region && ticket.region !== filters.region) {
      return false;
    }
    if (filters.serviceArea && ticket.serviceArea !== filters.serviceArea) {
      return false;
    }
    return true;
  });
}

export interface CreateTicketInput {
  tenantSlug: string;
  title: string;
  description?: string;
  ticketType: TicketType;
  source: TicketSource;
  impactLevel: ImpactLevel;
  priority: Priority;
  departmentId?: string;
  serviceArea?: string;
  region?: string;
  branchId?: string;
  customerId?: string;
  projectId?: string;
  tags?: string[];
  createdBy?: string;
}

function generateTicketNumber(tenantSlug: string): string {
  const { tickets } = getTenantSupportData(tenantSlug);
  const total = tickets.length + 1;
  return `IT-${new Date().getFullYear()}-${total.toString().padStart(4, "0")}`;
}

function resolveSlaPolicy(tenantSlug: string, priority: Priority, impact: ImpactLevel): SlaPolicy | undefined {
  const { slaPolicies } = getTenantSupportData(tenantSlug);
  return (
    slaPolicies.find(
      (policy) =>
        policy.priority === priority &&
        policy.impactLevel === impact &&
        policy.active
    ) || slaPolicies.find((policy) => policy.priority === priority)
  );
}

export function createTicket(input: CreateTicketInput): SupportTicket {
  const {
    tenantSlug,
    title,
    description,
    ticketType,
    source,
    impactLevel,
    priority,
    departmentId,
    serviceArea,
    region,
    branchId,
    customerId,
    projectId,
    tags = [],
    createdBy,
  } = input;

  const data = getTenantSupportData(tenantSlug);
  const slaPolicy = resolveSlaPolicy(tenantSlug, priority, impactLevel);
  const now = new Date();

  const ticket: SupportTicket = {
    id: randomUUID(),
    tenantSlug,
    ticketNumber: generateTicketNumber(tenantSlug),
    title,
    description,
    ticketType,
    source,
    impactLevel,
    priority,
    status: "new",
    departmentId,
    serviceArea,
    region,
    branchId,
    customerId,
    projectId,
    slaPolicyId: slaPolicy?.id,
    escalationLevel: 0,
    tags,
    responseDueAt: slaPolicy ? new Date(now.getTime() + slaPolicy.responseMinutes * 60 * 1000).toISOString() : undefined,
    resolutionDueAt: slaPolicy ? new Date(now.getTime() + slaPolicy.resolutionMinutes * 60 * 1000).toISOString() : undefined,
    createdBy,
    updatedBy: createdBy,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  data.tickets.unshift(ticket);
  addTicketActivity(tenantSlug, ticket.id, {
    activityType: "ticket_created",
    actorId: createdBy,
    details: { source },
  });

  return ticket;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  assignedEngineerId?: string | null;
  backupEngineerId?: string | null;
  priority?: Priority;
  impactLevel?: ImpactLevel;
  tags?: string[];
  updatedBy?: string;
}

export function updateTicket(tenantSlug: string, ticketId: string, updates: UpdateTicketInput): SupportTicket | null {
  const data = getTenantSupportData(tenantSlug);
  const ticket = data.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return null;
  }

  const now = new Date().toISOString();

  if (updates.status && updates.status !== ticket.status) {
    const statusFieldMap: Record<TicketStatus, keyof SupportTicket | null> = {
      new: null,
      acknowledged: "acknowledgedAt",
      diagnosing: "diagnosingAt",
      in_progress: "inProgressAt",
      awaiting_customer: "awaitingCustomerAt",
      awaiting_dependency: "awaitingDependencyAt",
      resolved: "resolvedAt",
      closed: "closedAt",
      reopened: "reopenedAt",
    };
    const field = statusFieldMap[updates.status];
    if (field) {
      (ticket as Record<string, unknown>)[field] = now;
    }
    if (updates.status === "acknowledged" && !ticket.firstResponseAt) {
      ticket.firstResponseAt = now;
    }
    ticket.status = updates.status;
    addTicketActivity(tenantSlug, ticket.id, {
      activityType: "status_changed",
      actorId: updates.updatedBy,
      details: { from: ticket.status, to: updates.status },
    });
  }

  if (updates.assignedEngineerId !== undefined) {
    ticket.assignedEngineerId = updates.assignedEngineerId || undefined;
  }
  if (updates.backupEngineerId !== undefined) {
    ticket.backupEngineerId = updates.backupEngineerId || undefined;
  }
  if (updates.priority) {
    ticket.priority = updates.priority;
  }
  if (updates.impactLevel) {
    ticket.impactLevel = updates.impactLevel;
  }
  if (updates.tags) {
    ticket.tags = updates.tags;
  }

  ticket.updatedBy = updates.updatedBy;
  ticket.updatedAt = now;

  return ticket;
}

export interface CommentInput {
  tenantSlug: string;
  ticketId: string;
  body: string;
  authorId?: string;
  commentType?: "internal" | "customer" | "system";
  visibility?: "internal" | "external";
}

export function addTicketComment(input: CommentInput): TicketComment | null {
  const data = getTenantSupportData(input.tenantSlug);
  const ticketExists = data.tickets.some((ticket) => ticket.id === input.ticketId);
  if (!ticketExists) {
    return null;
  }

  const comment: TicketComment = {
    id: randomUUID(),
    tenantSlug: input.tenantSlug,
    ticketId: input.ticketId,
    commentType: input.commentType || "internal",
    body: input.body,
    authorId: input.authorId,
    visibility: input.visibility || "internal",
    createdAt: new Date().toISOString(),
  };

  data.comments.push(comment);
  addTicketActivity(input.tenantSlug, input.ticketId, {
    activityType: "comment_added",
    actorId: input.authorId,
    details: { commentType: comment.commentType },
  });

  return comment;
}

export interface ActivityInput {
  activityType: string;
  actorId?: string;
  details?: Record<string, unknown>;
}

export function addTicketActivity(
  tenantSlug: string,
  ticketId: string,
  activity: ActivityInput
): TicketActivityLog {
  const data = getTenantSupportData(tenantSlug);
  const log: TicketActivityLog = {
    id: randomUUID(),
    tenantSlug,
    ticketId,
    activityType: activity.activityType,
    actorId: activity.actorId,
    details: activity.details,
    createdAt: new Date().toISOString(),
  };
  data.activities.push(log);
  return log;
}

export interface FieldJobInput {
  tenantSlug: string;
  ticketId: string;
  engineerId?: string;
  scheduledAt?: string;
  location?: Record<string, unknown>;
  createdBy?: string;
}

export function addFieldJob(input: FieldJobInput): FieldJob | null {
  const data = getTenantSupportData(input.tenantSlug);
  const ticketExists = data.tickets.some((ticket) => ticket.id === input.ticketId);
  if (!ticketExists) {
    return null;
  }

  const now = new Date().toISOString();
  const job: FieldJob = {
    id: randomUUID(),
    tenantSlug: input.tenantSlug,
    ticketId: input.ticketId,
    engineerId: input.engineerId,
    status: "scheduled",
    location: input.location,
    scheduledAt: input.scheduledAt || now,
    createdAt: now,
    updatedAt: now,
  };

  data.fieldJobs.push(job);
  addTicketActivity(input.tenantSlug, input.ticketId, {
    activityType: "field_job_created",
    actorId: input.createdBy,
    details: { engineerId: input.engineerId },
  });

  return job;
}

export interface AssignmentRequest {
  tenantSlug: string;
  serviceArea?: string;
  departmentId?: string;
  skills?: string[];
  region?: string;
}

export function suggestAssignment(request: AssignmentRequest) {
  const data = getTenantSupportData(request.tenantSlug);
  const skills = (request.skills || []).map((skill) => skill.toLowerCase());

  const scored = data.engineers.map((engineer) => {
    const skillMatch = skills.length
      ? Math.round(
          (skills.filter((skill) => engineer.skills.includes(skill)).length / skills.length) * 100
        )
      : 70;
    const loadScore = Math.max(0, 100 - (engineer.currentLoad / engineer.maxLoad) * 100);
    const regionalBonus = request.region && engineer.region === request.region ? 10 : 0;
    const total = Math.min(100, Math.round(skillMatch * 0.45 + loadScore * 0.35 + engineer.performanceScore * 0.2 + regionalBonus));

    return {
      engineerId: engineer.id,
      engineerName: engineer.displayName,
      skillMatch,
      loadScore,
      performanceScore: engineer.performanceScore,
      onDuty: engineer.onDuty,
      total,
    };
  });

  scored.sort((a, b) => b.total - a.total);

  return {
    primary: scored[0],
    backup: scored[1] || null,
    ranked: scored,
  };
}

export function listSlaPolicies(tenantSlug: string): SlaPolicy[] {
  return getTenantSupportData(tenantSlug).slaPolicies;
}

export function createSlaPolicy(policy: Omit<SlaPolicy, "id" | "createdAt" | "updatedAt">): SlaPolicy {
  const data = getTenantSupportData(policy.tenantSlug);
  const now = new Date().toISOString();
  const record: SlaPolicy = {
    ...policy,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  data.slaPolicies.push(record);
  return record;
}

export function listIncidents(tenantSlug: string): SupportIncident[] {
  return getTenantSupportData(tenantSlug).incidents;
}

export interface IncidentInput {
  tenantSlug: string;
  sourceSystem: string;
  incidentType?: string;
  severity: ImpactLevel;
  summary?: string;
  affectedServices?: string[];
  region?: string;
  branchId?: string;
  linkedTicketId?: string;
}

export function createIncident(input: IncidentInput): SupportIncident {
  const data = getTenantSupportData(input.tenantSlug);
  const incident: SupportIncident = {
    id: randomUUID(),
    tenantSlug: input.tenantSlug,
    sourceSystem: input.sourceSystem,
    incidentType: input.incidentType,
    severity: input.severity,
    status: "open",
    detectedAt: new Date().toISOString(),
    summary: input.summary,
    affectedServices: input.affectedServices || [],
    region: input.region,
    branchId: input.branchId,
    linkedTicketId: input.linkedTicketId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  data.incidents.unshift(incident);
  if (incident.linkedTicketId) {
    addTicketActivity(input.tenantSlug, incident.linkedTicketId, {
      activityType: "incident_linked",
      details: { incidentId: incident.id },
    });
  }

  return incident;
}

export function getDashboardMetrics(tenantSlug: string) {
  const data = getTenantSupportData(tenantSlug);
  const now = Date.now();

  const openTickets = data.tickets.filter((ticket) =>
    ["new", "acknowledged", "diagnosing", "in_progress", "awaiting_customer", "awaiting_dependency"].includes(ticket.status)
  );

  const slaBreaches = data.tickets.filter((ticket) => {
    if (!ticket.resolutionDueAt || ["resolved", "closed"].includes(ticket.status)) {
      return false;
    }
    return new Date(ticket.resolutionDueAt).getTime() < now;
  });

  const assignmentLoad = data.engineers.map((engineer) => ({
    engineerId: engineer.id,
    engineerName: engineer.displayName,
    currentLoad: engineer.currentLoad,
    maxLoad: engineer.maxLoad,
    utilization: Math.round((engineer.currentLoad / engineer.maxLoad) * 100),
  }));

  const incidentsOpen = data.incidents.filter((incident) => incident.status === "open");

  return {
    totals: {
      ticketsOpen: openTickets.length,
      ticketsCritical: openTickets.filter((ticket) => ticket.priority === "critical").length,
      slaBreaches: slaBreaches.length,
      fieldJobsActive: data.fieldJobs.filter((job) => job.status !== "completed" && job.status !== "cancelled").length,
    },
    sla: {
      atRisk: slaBreaches.map((ticket) => ({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        resolutionDueAt: ticket.resolutionDueAt,
      })),
    },
    workload: assignmentLoad,
    incidents: {
      open: incidentsOpen.length,
      items: incidentsOpen.slice(0, 5).map((incident) => ({
        id: incident.id,
        summary: incident.summary,
        severity: incident.severity,
        detectedAt: incident.detectedAt,
      })),
    },
  };
}

export function getTicketById(tenantSlug: string, ticketId: string): SupportTicket | null {
  const data = getTenantSupportData(tenantSlug);
  return data.tickets.find((ticket) => ticket.id === ticketId) || null;
}

export function listTicketComments(tenantSlug: string, ticketId: string): TicketComment[] {
  const data = getTenantSupportData(tenantSlug);
  return data.comments.filter((comment) => comment.ticketId === ticketId);
}

export function listFieldJobs(tenantSlug: string, ticketId?: string): FieldJob[] {
  const data = getTenantSupportData(tenantSlug);
  return ticketId ? data.fieldJobs.filter((job) => job.ticketId === ticketId) : data.fieldJobs;
}

export function listTicketActivities(tenantSlug: string, ticketId: string): TicketActivityLog[] {
  const data = getTenantSupportData(tenantSlug);
  return data.activities.filter((activity) => activity.ticketId === ticketId);
}

export function listKnowledgeBaseArticles(tenantSlug: string): KnowledgeBaseArticle[] {
  const data = getTenantSupportData(tenantSlug);
  return data.knowledgeBase;
}

export interface KnowledgeBaseInput {
  tenantSlug: string;
  title: string;
  content: string;
  audience?: KnowledgeBaseArticle["audience"];
  category?: string;
  summary?: string;
  tags?: string[];
  relatedTicketIds?: string[];
  solutionSteps?: Record<string, unknown>;
  attachments?: Record<string, unknown>;
  createdBy?: string;
}

export function createKnowledgeBaseArticle(input: KnowledgeBaseInput): KnowledgeBaseArticle {
  const data = getTenantSupportData(input.tenantSlug);
  const now = new Date().toISOString();
  const article: KnowledgeBaseArticle = {
    id: randomUUID(),
    tenantSlug: input.tenantSlug,
    title: input.title,
    category: input.category,
    audience: input.audience || "internal",
    summary: input.summary,
    content: input.content,
    tags: input.tags || [],
    relatedTicketIds: input.relatedTicketIds || [],
    solutionSteps: input.solutionSteps,
    attachments: input.attachments,
    effectivenessScore: 0,
    publishStatus: "draft",
    createdBy: input.createdBy,
    updatedBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };

  data.knowledgeBase.unshift(article);
  return article;
}
