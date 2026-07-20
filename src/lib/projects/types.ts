/**
 * Projects Module Types
 * TypeScript interfaces for all project-related entities
 */

import { z } from "zod";

// ============================================================
// ENUMS & CONSTANTS
// ============================================================

export const PROJECT_STATUSES = ["PLANNING", "INITIATED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "ARCHIVED", "CANCELLED"] as const;
export type ProjectStatus = typeof PROJECT_STATUSES[number];

export const WORKSTREAM_STATUSES = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;
export type WorkstreamStatus = typeof WORKSTREAM_STATUSES[number];

export const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];

export const ASSIGNMENT_STATUSES = ["PROPOSED", "ACCEPTED", "REJECTED", "REASSIGNED", "COMPLETED"] as const;
export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number];

export const TIME_LOG_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;
export type TimeLogStatus = typeof TIME_LOG_STATUSES[number];

export const APPROVAL_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const;
export type ApprovalStatus = typeof APPROVAL_STATUSES[number];

export const PRIORITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type PriorityLevel = typeof PRIORITY_LEVELS[number];

export const PROFICIENCY_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
export type ProficiencyLevel = typeof PROFICIENCY_LEVELS[number];

export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskLevel = typeof RISK_LEVELS[number];

export const RECOMMENDATION_STATUSES = ["NEW", "VIEWED", "ASSIGNED", "REJECTED", "EXPIRED"] as const;
export type RecommendationStatus = typeof RECOMMENDATION_STATUSES[number];

// ============================================================
// PROJECT TYPES
// ============================================================

export interface Project {
  id: string;
  tenantSlug: string;
  code: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  startDate?: Date;
  plannedEndDate?: Date;
  actualEndDate?: Date;
  budgetId?: string;
  totalBudgetAmount?: number;
  currency: string;
  scopeDescription?: string;
  deliverables?: string;
  projectManagerId?: string;
  sponsorId?: string;
  departmentId?: string;
  branchId?: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workstream {
  id: string;
  projectId: string;
  tenantSlug: string;
  code: string;
  name: string;
  description?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  allocatedBudget?: number;
  spentAmount: number;
  status: WorkstreamStatus;
  priority: number;
  workstreamLeadId?: string;
  ownerDepartmentId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  workstreamId: string;
  projectId: string;
  tenantSlug: string;
  code: string;
  title: string;
  description?: string;
  plannedStartDate?: Date;
  plannedEndDate?: Date;
  actualStartDate?: Date;
  actualEndDate?: Date;
  durationDays?: number;
  estimatedHours?: number;
  estimatedCost?: number;
  actualHoursSpent: number;
  actualCost: number;
  status: TaskStatus;
  priority: number;
  percentComplete: number;
  dependsOnTaskId?: string;
  isBlockedByActiveRisk: boolean;
  isAssigned: boolean;
  assignmentDeadline?: Date;
  requiredSkills: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  projectId: string;
  tenantSlug: string;
  employeeId: string;
  assignedHours?: number;
  assignedPercentage?: number;
  assignmentStartDate: Date;
  assignmentEndDate?: Date;
  status: AssignmentStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  actualHoursLogged: number;
  isOnTrack?: boolean;
  riskLevel?: RiskLevel;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeLog {
  id: string;
  taskAssignmentId: string;
  taskId: string;
  projectId: string;
  employeeId: string;
  tenantSlug: string;
  logDate: Date;
  hoursLogged: number;
  description?: string;
  activityType?: string;
  billable: boolean;
  approvalStatus: TimeLogStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CapacitySnapshot {
  id: string;
  tenantSlug: string;
  employeeId: string;
  snapshotDate: Date;
  totalAvailableHours: number;
  allocatedToProjectsHours: number;
  allocatedToMaintenanceHours: number;
  availableCapacityHours: number;
  utilizationPercentage: number;
  forecastedAllocationNext30Days: number;
  forecastedAllocationNext90Days: number;
  overAllocatedRisk: boolean;
  skillGapRisk: boolean;
  createdAt: Date;
}

export interface EmployeeSkill {
  id: string;
  tenantSlug: string;
  employeeId: string;
  skillCode: string;
  skillName: string;
  proficiencyLevel: ProficiencyLevel;
  certified: boolean;
  certifiedAt?: Date;
  certificationExpiresAt?: Date;
  yearsOfExperience?: number;
  lastUsedDate?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentRecommendation {
  id: string;
  taskId: string;
  projectId: string;
  tenantSlug: string;
  recommendedEmployeeId: string;
  fitScore?: number;
  recommendationReason?: string;
  skillsMatchScore?: number;
  capacityScore?: number;
  availabilityScore?: number;
  performanceHistoryScore?: number;
  status: RecommendationStatus;
  viewedAt?: Date;
  assignedAt?: Date;
  createdBy: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface TaskFitSuggestion {
  employeeId: string;
  taskId: string;
  fitScore: number;
  reasons: string[];
  skillsMatch: number;
  capacityAvailable: number;
  availabilityScore: number;
}

export interface DetailedSuggestion {
  employeeId: string;
  taskId: string;
  projectId: string;
  fitScore: number;
  recommendationReason?: string;
  skillsMatchScore?: number;
  capacityScore?: number;
  availabilityScore?: number;
  performanceHistoryScore?: number;
}

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

export const projectCreateSchema = z.object({
  code: z.string().min(3).max(50),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(PROJECT_STATUSES).default("PLANNING"),
  priority: z.enum(PRIORITY_LEVELS).default("MEDIUM"),
  startDate: z.date().optional(),
  plannedEndDate: z.date().optional(),
  budgetId: z.string().uuid().optional(),
  totalBudgetAmount: z.number().optional(),
  scopeDescription: z.string().optional(),
  deliverables: z.string().optional(),
  projectManagerId: z.string().uuid().optional(),
  sponsorId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial().extend({
  approvalStatus: z.enum(APPROVAL_STATUSES).optional(),
});

export const workstreamCreateSchema = z.object({
  projectId: z.string().uuid(),
  code: z.string().min(3).max(50),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  plannedStartDate: z.date().optional(),
  plannedEndDate: z.date().optional(),
  allocatedBudget: z.number().optional(),
  status: z.enum(WORKSTREAM_STATUSES).default("PLANNED"),
  priority: z.number().default(100),
  workstreamLeadId: z.string().uuid().optional(),
  ownerDepartmentId: z.string().uuid().optional(),
});

export const taskCreateSchema = z.object({
  workstreamId: z.string().uuid(),
  projectId: z.string().uuid(),
  code: z.string().min(3).max(50),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  plannedStartDate: z.date().optional(),
  plannedEndDate: z.date().optional(),
  durationDays: z.number().optional(),
  estimatedHours: z.number().optional(),
  estimatedCost: z.number().optional(),
  status: z.enum(TASK_STATUSES).default("NOT_STARTED"),
  priority: z.number().default(100),
  percentComplete: z.number().min(0).max(100).default(0),
  requiredSkills: z.array(z.string()).default([]),
});

export const taskAssignmentCreateSchema = z.object({
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  employeeId: z.string().uuid(),
  assignedHours: z.number().optional(),
  assignedPercentage: z.number().optional(),
  assignmentStartDate: z.date(),
  assignmentEndDate: z.date().optional(),
  status: z.enum(ASSIGNMENT_STATUSES).default("PROPOSED"),
});

export const timeLogCreateSchema = z.object({
  taskAssignmentId: z.string().uuid(),
  taskId: z.string().uuid(),
  projectId: z.string().uuid(),
  logDate: z.date(),
  hoursLogged: z.number().positive(),
  description: z.string().optional(),
  activityType: z.string().optional(),
  billable: z.boolean().default(false),
});

export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;
export type WorkstreamCreateInput = z.infer<typeof workstreamCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskAssignmentCreateInput = z.infer<typeof taskAssignmentCreateSchema>;
export type TimeLogCreateInput = z.infer<typeof timeLogCreateSchema>;
