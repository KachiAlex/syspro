/**
 * HR & Talent Acquisition Types and Zod Schemas
 */

import { z } from "zod";

// ============================================================================
// EMPLOYEE
// ============================================================================

export const employeeStatusEnum = z.enum(["active", "inactive", "on-leave", "terminated"]);
export const employmentTypeEnum = z.enum(["full-time", "part-time", "contract", "intern"]);
export const employeeRoleEnum = z.enum(["staff", "hod", "admin", "executive"]);

export const employeeCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  departmentId: z.string().min(1),
  jobTitle: z.string().min(1),
  reportingManagerId: z.string().optional(),
  branchId: z.string().optional(),
  regionId: z.string().optional(),
  costCenter: z.string().optional(),
  hireDate: z.string().datetime().optional(),
  salary: z.number().nonnegative().optional(),
  employmentType: employmentTypeEnum.optional(),
  status: employeeStatusEnum.optional(),
  role: employeeRoleEnum.optional(),
});

export const employeeUpdateSchema = employeeCreateSchema.partial().omit({ tenantSlug: true });

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

export interface EmployeeRecord {
  id: string;
  tenantSlug: string;
  name: string;
  email: string;
  phone: string | null;
  departmentId: string;
  jobTitle: string;
  reportingManagerId: string | null;
  branchId: string | null;
  regionId: string | null;
  costCenter: string | null;
  hireDate: string | null;
  salary: number | null;
  employmentType: string | null;
  role: string | null;
  status: string;
  passwordHash: string | null;
  isPortalActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  portalPermissions: Record<string, boolean> | null;
}

// ============================================================================
// DEPARTMENT
// ============================================================================

export interface DepartmentRecord {
  id: string;
  tenantSlug: string;
  name: string;
  description: string | null;
  parentDepartmentId: string | null;
  budget: number | null;
  costCenter: string | null;
  managerId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// ATTENDANCE
// ============================================================================

export const attendanceStatusEnum = z.enum(["present", "absent", "late", "half_day"]);

export const attendanceCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  status: attendanceStatusEnum,
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  notes: z.string().optional(),
});

export type AttendanceCreateInput = z.infer<typeof attendanceCreateSchema>;

export interface AttendanceRecord {
  id: string;
  tenantSlug: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  notes: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  createdAt: string;
}

// ============================================================================
// LEAVE
// ============================================================================

export const leaveTypeEnum = z.enum(["annual", "sick", "personal", "maternity", "paternity", "unpaid"]);
export const leaveStatusEnum = z.enum(["pending", "approved", "rejected", "cancelled"]);

export const leaveCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  leaveType: leaveTypeEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(1),
});

export const leaveUpdateSchema = z.object({
  tenantSlug: z.string().min(1),
  status: leaveStatusEnum,
});

export type LeaveCreateInput = z.infer<typeof leaveCreateSchema>;
export type LeaveUpdateInput = z.infer<typeof leaveUpdateSchema>;

export interface LeaveRecord {
  id: string;
  tenantSlug: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// JOB REQUISITION
// ============================================================================

export const requisitionStatusEnum = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "open",
  "paused",
  "closed",
  "cancelled",
]);

export const requisitionCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  title: z.string().min(1),
  departmentId: z.string().min(1),
  branchId: z.string().optional(),
  headcount: z.number().int().positive().default(1),
  budget: z.number().nonnegative().optional(),
  requiredSkills: z.array(z.string()).default([]),
  minExperienceYears: z.number().int().nonnegative().optional(),
  employmentType: employmentTypeEnum,
  description: z.string().min(1),
  requirements: z.string().optional(),
  location: z.string().optional(),
  salaryRange: z.string().optional(),
  postedAt: z.string().datetime().optional(),
  requestedBy: z.string().optional().default('system'),
});

export const requisitionUpdateSchema = z.object({
  tenantSlug: z.string().min(1),
  title: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  branchId: z.string().optional(),
  headcount: z.number().int().positive().optional(),
  budget: z.number().nonnegative().optional(),
  requiredSkills: z.array(z.string()).optional(),
  minExperienceYears: z.number().int().nonnegative().optional(),
  employmentType: employmentTypeEnum.optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  location: z.string().optional(),
  salaryRange: z.string().optional(),
  status: requisitionStatusEnum.optional(),
  postedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
});

export type RequisitionCreateInput = z.infer<typeof requisitionCreateSchema>;
export type RequisitionUpdateInput = z.infer<typeof requisitionUpdateSchema>;

export interface JobRequisitionRecord {
  id: string;
  tenantSlug: string;
  title: string;
  departmentId: string;
  branchId: string | null;
  headcount: number;
  budget: number | null;
  requiredSkills: string[];
  minExperienceYears: number | null;
  employmentType: string;
  description: string;
  requirements: string | null;
  location: string | null;
  salaryRange: string | null;
  status: string;
  approvalFlowId: string | null;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CANDIDATE
// ============================================================================

export const candidateSourceEnum = z.enum([
  "career_page",
  "linkedin",
  "indeed",
  "referral",
  "agency",
  "job_fair",
  "manual",
]);

export const candidateStageEnum = z.enum([
  "new",
  "screening",
  "shortlist",
  "interview",
  "offer",
  "hired",
  "rejected",
  "talent_pool",
]);

export const candidateCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  source: candidateSourceEnum.default("manual"),
  currentStage: candidateStageEnum.default("new"),
  skills: z.array(z.string()).default([]),
  experienceYears: z.number().nonnegative().optional(),
  education: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const candidateUpdateSchema = z.object({
  tenantSlug: z.string().min(1),
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  source: candidateSourceEnum.optional(),
  currentStage: candidateStageEnum.optional(),
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().nonnegative().optional(),
  education: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  overallScore: z.number().min(0).max(100).optional(),
});

export type CandidateCreateInput = z.infer<typeof candidateCreateSchema>;
export type CandidateUpdateInput = z.infer<typeof candidateUpdateSchema>;

export interface CandidateRecord {
  id: string;
  tenantSlug: string;
  fullName: string;
  email: string;
  phone: string | null;
  resumeUrl: string | null;
  source: string;
  currentStage: string;
  skills: string[];
  experienceYears: number | null;
  education: string | null;
  notes: string | null;
  tags: string[];
  overallScore: number | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// APPLICATION
// ============================================================================

export const applicationStatusEnum = z.enum([
  "applied",
  "under_review",
  "screened",
  "shortlist",
  "interview",
  "offer_pending",
  "offer_accepted",
  "offer_rejected",
  "withdrew",
]);

export const applicationCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  candidateId: z.string().min(1),
  requisitionId: z.string().min(1),
  coverLetter: z.string().optional(),
});

export const applicationUpdateSchema = z.object({
  tenantSlug: z.string().min(1),
  status: applicationStatusEnum.optional(),
  aiScore: z.number().min(0).max(100).optional(),
  screeningResult: z.record(z.any()).optional(),
  reviewedAt: z.string().datetime().optional(),
  decidedAt: z.string().datetime().optional(),
});

export type ApplicationCreateInput = z.infer<typeof applicationCreateSchema>;
export type ApplicationUpdateInput = z.infer<typeof applicationUpdateSchema>;

export interface ApplicationRecord {
  id: string;
  tenantSlug: string;
  candidateId: string;
  requisitionId: string;
  status: string;
  aiScore: number | null;
  screeningResult: Record<string, any> | null;
  appliedAt: string;
  reviewedAt: string | null;
  decidedAt: string | null;
  shortlistedAt: string | null;
  shortlistedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// INTERVIEW
// ============================================================================

export const interviewTypeEnum = z.enum([
  "technical",
  "behavioral",
  "cultural",
  "executive",
  "panel",
  "phone_screen",
]);

export const interviewStatusEnum = z.enum([
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
]);

export const interviewCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  applicationId: z.string().min(1),
  roundNumber: z.number().int().positive().default(1),
  type: interviewTypeEnum,
  scheduledAt: z.string().datetime(),
  interviewerIds: z.array(z.string()).min(1),
  notes: z.string().optional(),
});

export const interviewUpdateSchema = z.object({
  tenantSlug: z.string().min(1),
  type: interviewTypeEnum.optional(),
  scheduledAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  interviewerIds: z.array(z.string()).optional(),
  scorecard: z.record(z.any()).optional(),
  notes: z.string().optional(),
  recordingUrl: z.string().url().optional(),
  status: interviewStatusEnum.optional(),
});

export type InterviewCreateInput = z.infer<typeof interviewCreateSchema>;
export type InterviewUpdateInput = z.infer<typeof interviewUpdateSchema>;

export interface InterviewRecord {
  id: string;
  tenantSlug: string;
  applicationId: string;
  roundNumber: number;
  type: string;
  scheduledAt: string;
  completedAt: string | null;
  interviewerIds: string[];
  scorecard: Record<string, any> | null;
  notes: string | null;
  recordingUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// OFFER
// ============================================================================

export const offerStatusEnum = z.enum([
  "draft",
  "sent",
  "negotiated",
  "accepted",
  "rejected",
  "expired",
  "withdrawn",
]);

export const offerCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  applicationId: z.string().min(1),
  salary: z.number().nonnegative(),
  bonus: z.number().nonnegative().optional(),
  benefits: z.record(z.any()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportingManagerId: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export const offerUpdateSchema = z.object({
  tenantSlug: z.string().min(1),
  salary: z.number().nonnegative().optional(),
  bonus: z.number().nonnegative().optional(),
  benefits: z.record(z.any()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reportingManagerId: z.string().optional(),
  status: offerStatusEnum.optional(),
  candidateResponse: z.string().optional(),
  candidateResponseAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

export type OfferCreateInput = z.infer<typeof offerCreateSchema>;
export type OfferUpdateInput = z.infer<typeof offerUpdateSchema>;

export interface OfferRecord {
  id: string;
  tenantSlug: string;
  applicationId: string;
  salary: number;
  bonus: number | null;
  benefits: Record<string, any> | null;
  startDate: string;
  reportingManagerId: string;
  status: string;
  candidateResponse: string | null;
  candidateResponseAt: string | null;
  sentAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// ONBOARDING TASK
// ============================================================================

export const onboardingCategoryEnum = z.enum(["hr", "it", "admin", "manager", "compliance"]);
export const onboardingStatusEnum = z.enum(["pending", "in_progress", "completed", "overdue"]);

export const onboardingTaskCreateSchema = z.object({
  tenantSlug: z.string().min(1),
  employeeId: z.string().min(1),
  category: onboardingCategoryEnum,
  task: z.string().min(1),
  assignedToUserId: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const onboardingTaskUpdateSchema = z.object({
  tenantSlug: z.string().min(1),
  category: onboardingCategoryEnum.optional(),
  task: z.string().min(1).optional(),
  assignedToUserId: z.string().optional(),
  status: onboardingStatusEnum.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  completedAt: z.string().datetime().optional(),
});

export type OnboardingTaskCreateInput = z.infer<typeof onboardingTaskCreateSchema>;
export type OnboardingTaskUpdateInput = z.infer<typeof onboardingTaskUpdateSchema>;

export interface OnboardingTaskRecord {
  id: string;
  tenantSlug: string;
  employeeId: string;
  category: string;
  task: string;
  assignedToUserId: string;
  status: string;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// SCREENING
// ============================================================================

export interface ScreeningResult {
  passed: boolean;
  score: number;
  maxScore: number;
  breakdown: Array<{
    criteria: string;
    weight: number;
    required: any;
    actual: any;
    score: number;
    maxScore: number;
    reason: string;
  }>;
  reasons: string[];
}

export const screeningConfigSchema = z.object({
  tenantSlug: z.string().min(1),
  requisitionId: z.string().min(1),
  selectionMode: z.enum(["percentage", "fixed_number"]),
  selectionValue: z.number().int().positive(),
  minScoreThreshold: z.number().int().min(0).max(100).default(0),
  isEnabled: z.boolean().default(true),
});

export type ScreeningConfigInput = z.infer<typeof screeningConfigSchema>;

export interface ScreeningConfigRecord {
  requisitionId: string;
  tenantSlug: string;
  selectionMode: "percentage" | "fixed_number";
  selectionValue: number;
  minScoreThreshold: number;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BatchScreeningResult {
  screened: number;
  shortlisted: number;
  thresholdScore: number;
  results: Array<{
    applicationId: string;
    candidateName: string;
    aiScore: number;
    status: string;
    breakdown: ScreeningResult["breakdown"];
  }>;
}
