export type TenantScoped = { tenantSlug: string; region?: string; branch?: string };

export type Campaign = TenantScoped & {
  id: string;
  name: string;
  type?: string;
  objective?: string;
  channels?: any;
  budget?: number;
  ownerId?: string;
  status?: string;
  approvalState?: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type LeadSource = TenantScoped & {
  id: string;
  key: string;
  name: string;
  type?: string;
  metadata?: any;
  createdAt?: string;
};

export type Lead = TenantScoped & {
  id: string;
  campaignId?: string | null;
  sourceId?: string | null;
  costCenter?: string;
  contactId?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
  score?: number;
  attribution?: any;
  createdAt?: string;
  convertedAt?: string | null;
};

export type Opportunity = TenantScoped & {
  id: string;
  leadId?: string | null;
  accountId?: string | null;
  campaignId?: string | null;
  value?: number;
  currency?: string;
  stage?: string;
  assignedTo?: string | null;
  createdAt?: string;
  closedAt?: string | null;
  won?: boolean;
};

export type CampaignCost = TenantScoped & {
  id: string;
  campaignId: string;
  amount: number;
  currency?: string;
  date?: string | null;
  note?: string;
  createdBy?: string;
  createdAt?: string;
};

export type AttributionRecord = TenantScoped & {
  id: string;
  opportunityId?: string | null;
  model: string;
  attribution: any;
  total: number;
  calculatedAt?: string;
};
