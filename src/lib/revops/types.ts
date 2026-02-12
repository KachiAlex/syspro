export type TenantScoped = { tenantSlug: string; subsidiary?: string; region?: string; branch?: string };

export interface Campaign {
  id: string;
  tenantSlug: string;
  name: string;
  channel?: string;
  status?: string;
  startAt?: string | null;
  endAt?: string | null;
  budget?: number;
  approvedBy?: string | null;
  approvedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface LeadSource {
  id: string;
  tenantSlug: string;
  name: string;
  channel?: string;
  campaignId?: string | null;
  costCenter?: string | null;
  region?: string | null;
  branch?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface CampaignCost {
  id: string;
  tenantSlug: string;
  campaignId: string;
  amount: number;
  currency?: string;
  category?: string;
  incurredAt?: string;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface RevenueAttribution {
  id: string;
  tenantSlug: string;
  campaignId?: string | null;
  leadSourceId?: string | null;
  opportunityId?: string | null;
  invoiceId?: string | null;
  amount?: number | null;
  attributionModel?: string | null;
  attributedAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt?: string | null;
}

export interface EnablementAsset {
  id: string;
  tenantSlug: string;
  name: string;
  type?: string;
  version?: number;
  url?: string;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt?: string | null;
}
