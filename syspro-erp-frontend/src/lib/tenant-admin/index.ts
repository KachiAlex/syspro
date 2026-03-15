/**
 * Tenant Admin Module - Barrel Exports
 * Central export point for all tenant-admin features
 */

export * from "./types";
export * from "./service";
export * from "./validation";
export * from "./utils";

// Re-export service instances
export { DepartmentService, RoleService, EmployeeService, AccessControlService, ApprovalFlowService, WorkflowService, ModuleService, AuditService } from "./service";
