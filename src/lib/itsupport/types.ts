// IT Support Data Models (TypeScript)
// Multi-tenant, with all required fields for traceability, SLA, assignment, and learning

export type TicketType = 'internal' | 'customer';
export type TicketStatus =
  | 'new'
  | 'acknowledged'
  | 'diagnosing'
  | 'in_progress'
  | 'awaiting_customer'
  | 'awaiting_dependency'
  | 'resolved'
  | 'closed'
  | 'reopened';

export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';
export type SLACategory = 'critical' | 'high' | 'medium' | 'low';

export interface Ticket {
  id: string;
  tenantId: string;
  branchId: string;
  department: string;
  type: TicketType;
  impact: ImpactLevel;
  slaCategory: SLACategory;
  title: string;
  description: string;
  status: TicketStatus;
  createdBy: string;
  assignedTo?: string;
  backupEngineerId?: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  diagnosingAt?: string;
  inProgressAt?: string;
  awaitingCustomerAt?: string;
  awaitingDependencyAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  reopenedAt?: string;
  slaResponseDue: string;
  slaResolutionDue: string;
  slaBreached?: boolean;
  escalationLevel?: string;
  incidentId?: string;
  fieldJobId?: string;
  tags?: string[];
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface TicketActivityLog {
  id: string;
  ticketId: string;
  action: string;
  actorId: string;
  fromStatus?: TicketStatus;
  toStatus?: TicketStatus;
  timestamp: string;
  details?: any;
}

export interface SLA {
  id: string;
  tenantId: string;
  category: SLACategory;
  responseMinutes: number;
  resolutionMinutes: number;
  createdAt: string;
}

export interface EngineerProfile {
  id: string;
  tenantId: string;
  name: string;
  skills: string[];
  branchId: string;
  onDuty: boolean;
  workload: number;
  performanceScore: number;
  location?: { lat: number; lng: number };
}

export interface FieldJob {
  id: string;
  ticketId: string;
  engineerId: string;
  assignedAt: string;
  startedAt?: string;
  arrivedAt?: string;
  completedAt?: string;
  gpsStart?: { lat: number; lng: number };
  gpsArrive?: { lat: number; lng: number };
  workLog?: string;
  images?: string[];
  customerSignoff?: boolean;
}

export interface Incident {
  id: string;
  tenantId: string;
  serviceType: string;
  region: string;
  detectedAt: string;
  resolvedAt?: string;
  linkedTicketIds: string[];
  description: string;
  severity: ImpactLevel;
}

export interface KnowledgeBaseArticle {
  id: string;
  tenantId: string;
  type: 'internal' | 'customer' | 'field';
  title: string;
  body: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  relatedTicketIds?: string[];
}
