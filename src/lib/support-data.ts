export type ImpactLevel = "critical" | "high" | "medium" | "low";
export type Priority = ImpactLevel;
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
