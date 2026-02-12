export type Json = any;

export interface Automation {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  enabled: boolean;
  metadata?: Json;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRule {
  id: string;
  automationId: string;
  name: string;
  conditions: Json[];
  actions: Json[];
  priority: number;
  enabled: boolean;
  metadata?: Json;
  createdAt: string;
  updatedAt: string;
}

export type AutomationEventPayload = Record<string, any>;

export interface AutomationEvent {
  type: string;
  payload: AutomationEventPayload;
  receivedAt?: string;
}
export type Condition = {
  all?: Condition[];
  any?: Condition[];
  field?: string;
  op?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "includes" | "excludes" | "exists" | "missing";
  value?: any;
};

export type Action = {
  type: string;
  params?: Record<string, any>;
  targetModule?: "attendance" | "projects" | "it-support" | "finance" | "crm" | "revops" | string;
};

export type AutomationRule = {
  id: string;
  tenantSlug: string;
  name: string;
  description?: string | null;
  eventType: string;
  condition: Condition;
  actions: Action[];
  scope?: Record<string, any> | null;
  enabled: boolean;
  simulationOnly?: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type RuleSimulationResult = {
  matched: boolean;
  actions: Action[];
  details: Array<{ condition: Condition; result: boolean }>;
};

export type AutomationAction = {
  id: string;
  rule_id: string;
  tenant_slug: string;
  action_type: string;
  action_payload: any;
  status: "pending" | "processing" | "completed" | "failed";
  scheduled_for?: string | null;
  created_at?: string;
  updated_at?: string;
};
