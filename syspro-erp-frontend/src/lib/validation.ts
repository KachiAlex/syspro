import { z } from "zod";

/**
 * Request validation schemas using Zod for tenant admin APIs.
 */

// Department schemas
export const CreateDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100),
  description: z.string().optional(),
});

export type CreateDepartmentInput = z.infer<typeof CreateDepartmentSchema>;

// Role schemas
export const CreateRoleSchema = z.object({
  name: z.string().min(1, "Role name is required").max(100),
  scope: z.enum(["tenant", "region", "branch"]).default("tenant"),
  permissions: z.array(z.string()).default([]),
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scope: z.enum(["tenant", "region", "branch"]).optional(),
  permissions: z.array(z.string()).optional(),
});

export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;

// Employee schemas
export const CreateEmployeeSchema = z.object({
  name: z.string().min(1, "Employee name is required").max(100),
  email: z.string().email("Invalid email address"),
  department: z.string().optional(),
  branch: z.string().optional(),
  region: z.string().optional(),
});

export const UpdateEmployeeSchema = z.object({
  department: z.string().optional(),
  branch: z.string().optional(),
  region: z.string().optional(),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

// Approval route schemas
export const ApprovalStepSchema = z.object({
  step: z.number().min(1),
  owners: z.array(z.string()),
  slaHours: z.number().optional(),
});

export const CreateApprovalRouteSchema = z.object({
  name: z.string().min(1, "Approval route name is required").max(100),
  steps: z.array(ApprovalStepSchema).min(1, "At least one step is required"),
});

export const UpdateApprovalRouteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  steps: z.array(ApprovalStepSchema).optional(),
});

export type CreateApprovalRouteInput = z.infer<typeof CreateApprovalRouteSchema>;
export type UpdateApprovalRouteInput = z.infer<typeof UpdateApprovalRouteSchema>;

// Access control schemas
export const ModuleAccessSchema = z.object({
  module: z.string(),
  read: z.boolean(),
  write: z.boolean(),
  admin: z.boolean(),
});

export const CreateAccessControlSchema = z.object({
  roleName: z.string().min(1, "Role name is required").max(100),
  moduleAccess: z.array(ModuleAccessSchema),
});

export const UpdateAccessControlSchema = z.object({
  moduleAccess: z.array(ModuleAccessSchema).optional(),
});

export type CreateAccessControlInput = z.infer<typeof CreateAccessControlSchema>;
export type UpdateAccessControlInput = z.infer<typeof UpdateAccessControlSchema>;

// Workflow schemas
export const WorkflowStepSchema = z.object({
  step: z.number().min(1),
  title: z.string().min(1),
  assignee: z.string().optional(),
  daysAfter: z.number().optional(),
});

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required").max(100),
  type: z.enum(["onboarding", "transfer", "promotion", "exit"]),
  steps: z.array(WorkflowStepSchema).min(1),
});

export const UpdateWorkflowSchema = z.object({
  steps: z.array(WorkflowStepSchema).optional(),
});

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>;

// Module schemas
export const CreateModuleSchema = z.object({
  key: z.string().min(1, "Module key is required").max(50),
  name: z.string().min(1, "Module name is required").max(100),
  enabled: z.boolean().default(false),
  regions: z.array(z.string()).optional(),
  flags: z.record(z.boolean()).optional(),
});

export const UpdateModuleSchema = z.object({
  enabled: z.boolean().optional(),
  flags: z.record(z.boolean()).optional(),
});

export type CreateModuleInput = z.infer<typeof CreateModuleSchema>;
export type UpdateModuleInput = z.infer<typeof UpdateModuleSchema>;

// Automation schemas
const ConditionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    all: z.array(ConditionSchema).optional(),
    any: z.array(ConditionSchema).optional(),
    field: z.string().optional(),
    op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "includes", "excludes", "exists", "missing"]).optional(),
    value: z.any().optional(),
  })
);

export const AutomationActionSchema = z.object({
  type: z.string().min(1, "Action type is required"),
  params: z.record(z.any()).optional(),
  targetModule: z.string().optional(),
});

export const CreateRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required").max(200),
  description: z.string().optional(),
  eventType: z.string().min(1, "Event type is required"),
  condition: ConditionSchema,
  actions: z.array(AutomationActionSchema).min(1, "At least one action is required"),
  scope: z.record(z.any()).optional(),
  enabled: z.boolean().optional(),
  simulationOnly: z.boolean().optional(),
});

export const UpdateRuleSchema = CreateRuleSchema.partial();

// Policy schemas
export const CreatePolicySchema = z.object({
  key: z.string().min(1, "Policy key is required").max(100),
  name: z.string().min(1, "Policy name is required").max(200),
  category: z.string().optional(),
  scope: z.record(z.any()).optional(),
  document: z.record(z.any()),
  effectiveAt: z.string().optional(),
});

export const UpdatePolicySchema = z.object({
  status: z.enum(["draft", "published", "deprecated"]).optional(),
  document: z.record(z.any()).optional(),
  effectiveAt: z.string().optional(),
});

export const PolicyOverrideSchema = z.object({
  scope: z.record(z.any()).optional(),
  reason: z.string().optional(),
  createdBy: z.string().optional(),
});

// Report schemas
export const CreateReportSchema = z.object({
  name: z.string().min(1, "Report name is required"),
  reportType: z.string().min(1, "Report type is required"),
  definition: z.record(z.any()),
  filters: z.record(z.any()).optional(),
  schedule: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const UpdateReportSchema = z.object({
  name: z.string().optional(),
  reportType: z.string().optional(),
  definition: z.record(z.any()).optional(),
  filters: z.record(z.any()).optional(),
  schedule: z.string().optional(),
  enabled: z.boolean().optional(),
});

/**
 * Safe parsing wrapper that returns error or data.
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  return result.success ? { success: true, data: result.data as T } : { success: false, error: result.error };
}
