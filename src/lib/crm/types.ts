import { z } from "zod";

export const CRM_LEAD_SOURCES = ["website", "walk_in", "campaign", "referral", "api_import"] as const;
export const CRM_LEAD_STAGES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "converted",
  "lost",
] as const;
export const CRM_PIPELINE_STAGES = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
export const CRM_COMMUNICATION_CHANNELS = ["email", "sms", "call", "meeting", "whatsapp"] as const;
export const CRM_ROLES = ["ceo", "marketing_manager", "sales_officer", "customer_support"] as const;

export type CrmLeadSource = (typeof CRM_LEAD_SOURCES)[number];
export type CrmLeadStage = (typeof CRM_LEAD_STAGES)[number];
export type CrmPipelineStage = (typeof CRM_PIPELINE_STAGES)[number];
export type CrmChannel = (typeof CRM_COMMUNICATION_CHANNELS)[number];
export type CrmRole = (typeof CRM_ROLES)[number];

export type CrmFilters = {
  tenantSlug: string;
  regionId?: string;
  branchId?: string;
  salesOfficerId?: string;
  from?: string;
  to?: string;
};

export type CrmMetric = {
  label: string;
  value: number;
  delta?: number;
  deltaDirection?: "up" | "down";
  description?: string;
};

export type CrmLead = {
  id: string;
  tenantId: string;
  regionId: string;
  branchId: string;
  companyName: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  source: CrmLeadSource;
  stage: CrmLeadStage;
  score: number;
  assignedOfficerId?: string;
  expectedValue?: number;
  currency?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmLeadStatus = "overdue" | "pending" | "won";

export type CrmLeadSummary = {
  id: string;
  companyName: string;
  contactName: string;
  stage: CrmLeadStage;
  ownerName: string;
  value: number;
  currency: string;
  status: CrmLeadStatus;
};

export type CrmLeadActivity = {
  id: string;
  leadId: string;
  type: "note" | "call" | "email" | "sms" | "meeting" | "system";
  channel?: CrmChannel;
  subject?: string;
  body?: string;
  performedBy?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type CrmCustomer = {
  id: string;
  tenantId: string;
  name: string;
  regionId: string;
  branchId: string;
  industry?: string;
  status?: string;
  primaryContact?: {
    name: string;
    role?: string;
    email?: string;
    phone?: string;
  };
  companyInfo?: Record<string, unknown>;
  convertedFromLeadId?: string;
  createdAt: string;
};

export type CrmCustomerRecord = {
  id: string;
  tenant_slug: string;
  region_id: string;
  branch_id: string;
  name: string;
  primary_contact: Record<string, unknown> | null;
  status: string | null;
  created_at: string;
};

export type CrmDeal = {
  id: string;
  tenantId: string;
  customerId: string;
  leadId?: string;
  stage: CrmPipelineStage;
  value: number;
  currency: string;
  probability: number;
  expectedClose: string;
  assignedOfficerId?: string;
  status: "open" | "won" | "lost";
  linkedProjectId?: string;
  linkedInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmActivity = {
  id: string;
  entityType: "lead" | "customer" | "deal";
  entityId: string;
  channel: CrmChannel;
  subject: string;
  body?: string;
  metadata?: Record<string, unknown>;
  performedBy?: string;
  dueAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type CrmDashboardPayload = {
  metrics: CrmMetric[];
  totals: {
    totalLeads: number;
    qualifiedLeads: number;
    opportunities: number;
    dealsWon: number;
    dealsLost: number;
    revenue: number;
    conversionRate: number;
  };
  charts: {
    salesFunnel: Array<{ stage: string; value: number }>;
    revenueByOfficer: Array<{ officerId: string; officerName: string; value: number }>;
    lostReasons: Array<{ reason: string; count: number }>;
  };
  leads: CrmLeadSummary[];
  reminders: Array<{ id: string; label: string; dueAt: string; slaSeconds?: number }>;
  tasks: Array<{ id: string; title: string; due: string; assignee: string; status: "due" | "upcoming" }>;
  engagements: Array<{ id: string; title: string; detail: string; timestamp: string; channel: CrmChannel }>;
};

export const crmFiltersSchema = z.object({
  tenantSlug: z.string().min(1),
  regionId: z.string().optional(),
  branchId: z.string().optional(),
  salesOfficerId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CrmPermissions = {
  role: CrmRole;
  resources: Record<string, string[]>; // resource -> allowed actions
};
