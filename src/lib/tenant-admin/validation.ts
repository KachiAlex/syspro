/**
 * Tenant Admin Validation Schemas
 * Zod schemas for all tenant-admin API requests
 */

import { z } from "zod";

// ============================================================================
// DEPARTMENT SCHEMAS
// ============================================================================

export const CreateDepartmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  description: z.string().max(500, "Description too long").optional(),
  parentDepartmentId: z.string().optional(),
  costCenter: z.string().max(50).optional(),
  manager: z.string().optional(),
});

export const UpdateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  parentDepartmentId: z.string().optional(),
  budget: z.number().positive().optional(),
  costCenter: z.string().max(50).optional(),
  manager: z.string().optional(),
});

// ============================================================================
// ROLE SCHEMAS
// ============================================================================

export const CreateRoleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  scope: z.enum(["tenant", "region", "branch", "custom"]),
  permissions: z.array(z.string()),
  description: z.string().max(500).optional(),
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
});

// ============================================================================
// EMPLOYEE SCHEMAS
// ============================================================================

export const CreateEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  departmentId: z.string(),
  phone: z.string().optional(),
  jobTitle: z.string().max(100).optional(),
  reportingManagerId: z.string().optional(),
  hireDate: z.string().datetime().optional(),
});

export const UpdateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  departmentId: z.string().optional(),
  reportingManagerId: z.string().optional(),
  jobTitle: z.string().max(100).optional(),
  status: z.enum(["active", "inactive", "on-leave", "terminated"]).optional(),
});

// ============================================================================
// ACCESS CONTROL SCHEMAS
// ============================================================================

export const ModuleAccessRuleSchema = z.object({
  moduleKey: z.string(),
  moduleName: z.string(),
  permissions: z.array(z.enum(["read", "write", "delete", "admin"])),
  restricted: z.boolean(),
  dataFilter: z.record(z.any()).optional(),
});

export const UpdateAccessControlSchema = z.object({
  moduleAccess: z.array(ModuleAccessRuleSchema),
});

export const GrantTemporaryAccessSchema = z.object({
  grantedTo: z.string(),
  moduleKey: z.string(),
  permissions: z.array(z.enum(["read", "write", "delete", "admin"])),
  expiresAt: z.string().datetime(),
  justification: z.string().min(10).max(500),
});

// ============================================================================
// APPROVAL FLOW SCHEMAS
// ============================================================================

export const ApprovalStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  approverRole: z.string().optional(),
  approverUsers: z.array(z.string()).optional(),
  autoApproveAfterDays: z.number().int().positive().optional(),
  notificationTemplate: z.string().optional(),
});

export const CreateApprovalFlowSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string(),
  steps: z.array(ApprovalStepSchema),
  description: z.string().max(500).optional(),
});

export const CreateApprovalRequestSchema = z.object({
  flowId: z.string(),
  subjectId: z.string(),
  requestNotes: z.string().max(1000).optional(),
  documents: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
  })).optional(),
});

export const ApproveRequestSchema = z.object({
  action: z.enum(["approve", "reject", "request_info", "escalate"]),
  comment: z.string().max(1000).optional(),
});

// ============================================================================
// WORKFLOW SCHEMAS
// ============================================================================

export const WorkflowConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(["equals", "not_equals", "contains", "gt", "lt", "gte", "lte"]),
  value: z.any(),
});

export const WorkflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  action: z.record(z.any()),
  conditions: z.array(WorkflowConditionSchema).optional(),
  nextStepId: z.string().optional(),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string(),
  trigger: z.enum(["manual", "event", "schedule", "condition"]),
  steps: z.array(WorkflowStepSchema),
  description: z.string().max(500).optional(),
});

// ============================================================================
// MODULE & FEATURE FLAG SCHEMAS
// ============================================================================

export const FeatureFlagSchema = z.object({
  key: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  value: z.any().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  targetUsers: z.array(z.string()).optional(),
});

export const UpdateModuleSchema = z.object({
  enabled: z.boolean().optional(),
  regions: z.array(z.string()).optional(),
  branches: z.array(z.string()).optional(),
});

export const SetFeatureFlagSchema = z.object({
  flag: FeatureFlagSchema,
});

// ============================================================================
// BILLING & SUBSCRIPTION SCHEMAS
// ============================================================================

export const CreateSubscriptionSchema = z.object({
  planId: z.string(),
  cycle: z.enum(["monthly", "quarterly", "annual"]),
  addons: z.array(z.object({
    key: z.string(),
    quantity: z.number().int().positive(),
  })).optional(),
});

export const UpdateSubscriptionSchema = z.object({
  status: z.enum(["trial", "active", "suspended", "cancelled"]).optional(),
  planId: z.string().optional(),
});

// ============================================================================
// INTEGRATION SCHEMAS
// ============================================================================

export const CreateIntegrationSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["webhook", "oauth", "api_key", "custom"]),
  provider: z.string().optional(),
  config: z.record(z.any()),
  webhookUrl: z.string().url().optional(),
  events: z.array(z.string()),
});

export const UpdateIntegrationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.any()).optional(),
  events: z.array(z.string()).optional(),
  status: z.enum(["active", "inactive", "error", "pending"]).optional(),
});

export const CreateAPIKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.object({
    module: z.string(),
    action: z.enum(["read", "write", "delete", "admin"]),
  })),
  rateLimit: z.number().positive().optional(),
  expiresIn: z.number().positive().optional(), // days
});

// ============================================================================
// SECURITY & COMPLIANCE SCHEMAS
// ============================================================================

export const UpdateSecurityPolicySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rules: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    conditions: z.record(z.any()),
    action: z.enum(["allow", "deny", "require"]),
  })),
  isActive: z.boolean(),
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

export function parseSchema<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
