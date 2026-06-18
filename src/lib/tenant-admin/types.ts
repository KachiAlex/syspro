/**
 * Tenant Admin Module Types & Interfaces
 * Comprehensive data models for all tenant-admin features
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export type TenantSlug = string & { readonly __brand: "TenantSlug" };
export type ResourceId = string & { readonly __brand: "ResourceId" };
export type UserId = string & { readonly __brand: "UserId" };

export interface AuditFields {
  createdAt: Date;
  updatedAt: Date;
  createdBy?: UserId;
  updatedBy?: UserId;
}

export interface TenantResource extends AuditFields {
  id: ResourceId;
  tenantSlug: TenantSlug;
}

// ============================================================================
// DEPARTMENT MANAGEMENT
// ============================================================================

export interface Department extends TenantResource {
  name: string;
  description?: string;
  parentDepartmentId?: ResourceId;
  budget?: number;
  costCenter?: string;
  manager?: UserId;
}

export interface DepartmentCreateRequest {
  name: string;
  description?: string;
  parentDepartmentId?: ResourceId;
  costCenter?: string;
  manager?: UserId;
}

export interface DepartmentUpdateRequest {
  name?: string;
  description?: string;
  parentDepartmentId?: ResourceId;
  budget?: number;
  costCenter?: string;
  manager?: UserId;
}

// ============================================================================
// ROLE BUILDER & RBAC
// ============================================================================

export type PermissionScope = "read" | "write" | "delete" | "admin";
export type RoleScope = "tenant" | "region" | "branch" | "custom";

export interface Permission {
  id: string;
  module: string;
  action: PermissionScope;
  description: string;
}

export interface Role extends TenantResource {
  name: string;
  scope: RoleScope;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
}

export interface RoleCreateRequest {
  name: string;
  scope: RoleScope;
  permissions: string[];
  description?: string;
}

export interface RoleUpdateRequest {
  name?: string;
  permissions?: string[];
  description?: string;
}

export interface RoleAssignment extends TenantResource {
  userId: UserId;
  roleId: ResourceId;
  scope: RoleScope;
  scopeId?: string;
  expiresAt?: Date;
  justification?: string;
}

// ============================================================================
// EMPLOYEE ASSIGNMENT & LIFECYCLE
// ============================================================================

export type EmployeeStatus = "active" | "inactive" | "on-leave" | "terminated";

export interface Employee extends TenantResource {
  name: string;
  email: string;
  phone?: string;
  departmentId: ResourceId;
  reportingManagerId?: UserId;
  branchId?: ResourceId;
  regionId?: ResourceId;
  status: EmployeeStatus;
  costCenter?: string;
  jobTitle?: string;
  hireDate?: Date;
}

export interface EmployeeCreateRequest {
  name: string;
  email: string;
  departmentId: ResourceId;
  phone?: string;
  jobTitle?: string;
  reportingManagerId?: UserId;
  hireDate?: Date;
}

export interface EmployeeUpdateRequest {
  name?: string;
  departmentId?: ResourceId;
  reportingManagerId?: UserId;
  jobTitle?: string;
  status?: EmployeeStatus;
}

// ============================================================================
// ACCESS CONTROL & PERMISSIONS
// ============================================================================

export interface ModuleAccessRule {
  moduleKey: string;
  moduleName: string;
  permissions: PermissionScope[];
  restricted: boolean;
  dataFilter?: Record<string, any>;
}

export interface AccessAccount extends TenantResource {
  roleId: ResourceId;
  roleName: string;
  moduleAccess: ModuleAccessRule[];
  temporaryGrants?: TemporaryAccess[];
}

export interface TemporaryAccess {
  id: string;
  grantedTo: UserId;
  moduleKey: string;
  permissions: PermissionScope[];
  expiresAt: Date;
  justification: string;
  approvedBy: UserId;
}

// ============================================================================
// APPROVAL FLOWS
// ============================================================================

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";
export type ApprovalAction = "approve" | "reject" | "request_info" | "escalate";

export interface ApprovalStep {
  id: string;
  name: string;
  approverRole?: ResourceId;
  approverUsers?: UserId[];
  rejectionReason?: string;
  autoApproveAfterDays?: number;
  notificationTemplate?: string;
}

export interface ApprovalFlow extends TenantResource {
  name: string;
  type: string; // e.g., "expense", "purchase-order", "leave"
  steps: ApprovalStep[];
  description?: string;
  isActive: boolean;
}

export interface ApprovalRequest extends TenantResource {
  flowId: ResourceId;
  flowType: string;
  requesterId: UserId;
  subjectId: ResourceId;
  status: ApprovalStatus;
  currentStepIndex: number;
  history: ApprovalHistory[];
  documents?: Attachment[];
}

export interface ApprovalHistory {
  stepId: string;
  actionBy: UserId;
  action: ApprovalAction;
  timestamp: Date;
  comment?: string;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date;
}

// ============================================================================
// WORKFLOWS & AUTOMATION
// ============================================================================

export type WorkflowStatus = "draft" | "active" | "archived";
export type WorkflowTrigger = "manual" | "event" | "schedule" | "condition";

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  action: Record<string, any>;
  conditions?: WorkflowCondition[];
  nextStepId?: string;
}

export interface WorkflowCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "gte" | "lte";
  value: any;
}

export interface Workflow extends TenantResource {
  name: string;
  type: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  description?: string;
  isActive: boolean;
}

export interface WorkflowExecution extends TenantResource {
  workflowId: ResourceId;
  triggeredBy: UserId;
  currentStepId: string;
  executionHistory: ExecutionLog[];
  status: "running" | "completed" | "failed";
}

export interface ExecutionLog {
  timestamp: Date;
  stepId: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: Record<string, any>;
  error?: string;
}

// ============================================================================
// MODULE REGISTRY & FEATURE FLAGS
// ============================================================================

export interface Module extends TenantResource {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  regions?: string[];
  branches?: string[];
  featureFlags: FeatureFlag[];
  requiredModules?: string[];
}

export interface FeatureFlag {
  key: string;
  name: string;
  enabled: boolean;
  value?: any;
  rolloutPercentage?: number;
  targetUsers?: UserId[];
}

// ============================================================================
// BILLING & SUBSCRIPTION
// ============================================================================

export type BillingCycle = "monthly" | "quarterly" | "annual";
export type SubscriptionStatus = "trial" | "active" | "suspended" | "cancelled";

export interface SubscriptionPlan extends TenantResource {
  name: string;
  description?: string;
  cycle: BillingCycle;
  price: number;
  features: string[];
  userLimit?: number;
  storageLimit?: number; // in GB
  modules: string[];
}

export interface Subscription extends TenantResource {
  planId: ResourceId;
  status: SubscriptionStatus;
  startDate: Date;
  nextBillingDate: Date;
  usageMetrics: UsageMetrics;
  addons?: SubscriptionAddon[];
}

export interface UsageMetrics {
  activeUsers: number;
  storageUsedGB: number;
  apiCallsThisMonth: number;
  maxApiCalls?: number;
}

export interface SubscriptionAddon {
  key: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// ============================================================================
// INTEGRATIONS & API
// ============================================================================

export type IntegrationStatus = "active" | "inactive" | "error" | "pending";
export type IntegrationType = "webhook" | "oauth" | "api_key" | "custom";

export interface Integration extends TenantResource {
  name: string;
  type: IntegrationType;
  status: IntegrationStatus;
  provider?: string;
  config: Record<string, any>;
  webhookUrl?: string;
  events: string[];
  lastSyncAt?: Date;
  errorMessage?: string;
}

export interface APIKey extends TenantResource {
  name: string;
  key: string;
  secret: string;
  permissions: Permission[];
  rateLimit?: number;
  expiresAt?: Date;
  lastUsed?: Date;
}

// ============================================================================
// ANALYTICS & REPORTING
// ============================================================================

export interface AnalyticsMetric {
  key: string;
  name: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "stable";
  trendPercent?: number;
}

export interface AnalyticsReport extends TenantResource {
  name: string;
  type: string; // e.g., "usage", "performance", "financial"
  metrics: AnalyticsMetric[];
  period: "daily" | "weekly" | "monthly";
  generatedAt: Date;
  nextGenerationAt: Date;
}

// ============================================================================
// SECURITY & COMPLIANCE
// ============================================================================

export type AuditAction = "create" | "read" | "update" | "delete" | "export" | "permission_change";

export interface AuditLog extends AuditFields {
  id: ResourceId;
  tenantSlug: TenantSlug;
  userId: UserId;
  action: AuditAction;
  resource: string;
  resourceId: ResourceId;
  changes?: Record<string, { before: any; after: any }>;
  ipAddress?: string;
  userAgent?: string;
}

export interface SecurityPolicy extends TenantResource {
  name: string;
  description?: string;
  rules: SecurityRule[];
  isActive: boolean;
}

export interface SecurityRule {
  id: string;
  name: string;
  type: string; // e.g., "password_policy", "mfa_required", "ip_whitelist"
  conditions: Record<string, any>;
  action: "allow" | "deny" | "require";
}
