/**
 * Projects Database Service Layer
 * Handles all project-related database operations
 */

import { db } from "../sql-client";
import {
  Project,
  Workstream,
  Task,
  TaskAssignment,
  TimeLog,
  CapacitySnapshot,
  EmployeeSkill,
  AssignmentRecommendation,
  ProjectCreateInput,
  ProjectUpdateInput,
  WorkstreamCreateInput,
  TaskCreateInput,
  TaskAssignmentCreateInput,
  TimeLogCreateInput,
} from "./types";

// ============================================================
// PROJECT OPERATIONS
// ============================================================

export async function createProject(
  tenantSlug: string,
  input: ProjectCreateInput,
  createdBy: string
): Promise<Project | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO projects (
        tenant_slug, code, name, description, status, priority,
        start_date, planned_end_date, budget_id, total_budget_amount,
        scope_description, deliverables, project_manager_id, sponsor_id,
        department_id, branch_id, approval_status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
      `,
      [
        tenantSlug,
        input.code,
        input.name,
        input.description || null,
        input.status || "PLANNING",
        input.priority || "MEDIUM",
        input.startDate || null,
        input.plannedEndDate || null,
        input.budgetId || null,
        input.totalBudgetAmount || null,
        input.scopeDescription || null,
        input.deliverables || null,
        input.projectManagerId || null,
        input.sponsorId || null,
        input.departmentId || null,
        input.branchId || null,
        "DRAFT",
        createdBy,
      ]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error creating project:", error);
    throw error;
  }
}

export async function getProject(id: string, tenantSlug: string): Promise<Project | null> {
  try {
    const result = await db.query(
      `SELECT * FROM projects WHERE id = $1 AND tenant_slug = $2`,
      [id, tenantSlug]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error fetching project:", error);
    throw error;
  }
}

export async function getProjectsByStatus(
  tenantSlug: string,
  status: string,
  limit = 50,
  offset = 0
): Promise<Project[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM projects 
      WHERE tenant_slug = $1 AND status = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
      `,
      [tenantSlug, status, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching projects by status:", error);
    throw error;
  }
}

export async function getAllProjectsForTenant(
  tenantSlug: string,
  limit = 100,
  offset = 0
): Promise<Project[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM projects 
      WHERE tenant_slug = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [tenantSlug, limit, offset]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching all projects:", error);
    throw error;
  }
}

export async function updateProject(
  id: string,
  tenantSlug: string,
  input: ProjectUpdateInput
): Promise<Project | null> {
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.name) {
      updates.push(`name = $${paramCount}`);
      values.push(input.name);
      paramCount++;
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(input.description);
      paramCount++;
    }
    if (input.status) {
      updates.push(`status = $${paramCount}`);
      values.push(input.status);
      paramCount++;
    }
    if (input.priority) {
      updates.push(`priority = $${paramCount}`);
      values.push(input.priority);
      paramCount++;
    }
    if (input.startDate) {
      updates.push(`start_date = $${paramCount}`);
      values.push(input.startDate);
      paramCount++;
    }
    if (input.plannedEndDate) {
      updates.push(`planned_end_date = $${paramCount}`);
      values.push(input.plannedEndDate);
      paramCount++;
    }
    if (input.totalBudgetAmount !== undefined) {
      updates.push(`total_budget_amount = $${paramCount}`);
      values.push(input.totalBudgetAmount);
      paramCount++;
    }
    if (input.projectManagerId !== undefined) {
      updates.push(`project_manager_id = $${paramCount}`);
      values.push(input.projectManagerId);
      paramCount++;
    }
    if (input.approvalStatus) {
      updates.push(`approval_status = $${paramCount}`);
      values.push(input.approvalStatus);
      paramCount++;
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id, tenantSlug);

    if (updates.length === 1) return getProject(id, tenantSlug);

    const result = await db.query(
      `
      UPDATE projects 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount} AND tenant_slug = $${paramCount + 1}
      RETURNING *
      `,
      values
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
}

export async function deleteProject(
  id: string,
  tenantSlug: string
): Promise<boolean> {
  try {
    const result = await db.query(
      `DELETE FROM projects WHERE id = $1 AND tenant_slug = $2 RETURNING id`,
      [id, tenantSlug]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
}

// ============================================================
// API RESPONSE MAPPING
// ============================================================

export function toProjectResponse(project: Project) {
  const statusLabels: Record<string, string> = {
    PLANNING: "Planning",
    INITIATED: "Initiated",
    IN_PROGRESS: "In Progress",
    ON_HOLD: "On Hold",
    COMPLETED: "Completed",
    ARCHIVED: "Archived",
    CANCELLED: "Cancelled",
  };
  const priorityLabels: Record<string, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    CRITICAL: "Critical",
  };
  const progressFromStatus = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "ARCHIVED":
        return 100;
      case "IN_PROGRESS":
        return 50;
      case "ON_HOLD":
        return 25;
      case "INITIATED":
        return 10;
      default:
        return 0;
    }
  };
  const toDateString = (value: any) => {
    if (!value) return undefined;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  };
  const formatCurrency = (amount: number | null | undefined) => {
    const n = Number(amount) || 0;
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  };

  return {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    objective: project.description ?? project.scopeDescription ?? "",
    status: statusLabels[project.status] ?? project.status,
    priority: priorityLabels[project.priority] ?? project.priority,
    progress: progressFromStatus(project.status),
    startDate: toDateString(project.startDate),
    start: toDateString(project.startDate),
    dueDate: toDateString(project.plannedEndDate),
    endDate: toDateString(project.plannedEndDate),
    end: toDateString(project.plannedEndDate),
    teamMembers: 0,
    budget: formatCurrency(project.totalBudgetAmount),
    budgetApproved: Number(project.totalBudgetAmount ?? 0),
    budgetSpent: 0,
    subsidiary: "",
    departments: [],
    region: "",
    owner: project.projectManagerId ?? project.createdBy ?? "Unassigned",
    manager: project.projectManagerId ?? project.createdBy ?? "Unassigned",
    approvalStatus: project.approvalStatus ?? "DRAFT",
    createdAt: toDateString(project.createdAt),
    updatedAt: toDateString(project.updatedAt),
  };
}

// ============================================================
// WORKSTREAM OPERATIONS
// ============================================================

export async function createWorkstream(
  tenantSlug: string,
  input: WorkstreamCreateInput,
  createdBy: string
): Promise<Workstream | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO workstreams (
        project_id, tenant_slug, code, name, description,
        planned_start_date, planned_end_date, allocated_budget,
        status, priority, workstream_lead_id, owner_department_id, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
      `,
      [
        input.projectId,
        tenantSlug,
        input.code,
        input.name,
        input.description || null,
        input.plannedStartDate || null,
        input.plannedEndDate || null,
        input.allocatedBudget || null,
        input.status || "PLANNED",
        input.priority || 100,
        input.workstreamLeadId || null,
        input.ownerDepartmentId || null,
        createdBy,
      ]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error creating workstream:", error);
    throw error;
  }
}

export async function getWorkstreamsForProject(
  projectId: string,
  tenantSlug: string
): Promise<Workstream[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM workstreams 
      WHERE project_id = $1 AND tenant_slug = $2
      ORDER BY priority ASC, created_at ASC
      `,
      [projectId, tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching workstreams:", error);
    throw error;
  }
}

export async function getAllWorkstreamsForTenant(
  tenantSlug: string
): Promise<Workstream[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM workstreams 
      WHERE tenant_slug = $1
      ORDER BY priority ASC, created_at ASC
      `,
      [tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching tenant workstreams:", error);
    throw error;
  }
}

// ============================================================
// TASK OPERATIONS
// ============================================================

export async function createTask(
  tenantSlug: string,
  input: TaskCreateInput,
  createdBy: string
): Promise<Task | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO tasks (
        workstream_id, project_id, tenant_slug, code, title, description,
        planned_start_date, planned_end_date, duration_days,
        estimated_hours, estimated_cost, status, priority, percent_complete,
        required_skills, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
      `,
      [
        input.workstreamId,
        input.projectId,
        tenantSlug,
        input.code,
        input.title,
        input.description || null,
        input.plannedStartDate || null,
        input.plannedEndDate || null,
        input.durationDays || null,
        input.estimatedHours || null,
        input.estimatedCost || null,
        input.status || "NOT_STARTED",
        input.priority || 100,
        input.percentComplete || 0,
        input.requiredSkills || [],
        createdBy,
      ]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error creating task:", error);
    throw error;
  }
}

export async function getTasksForWorkstream(
  workstreamId: string,
  tenantSlug: string
): Promise<Task[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM tasks 
      WHERE workstream_id = $1 AND tenant_slug = $2
      ORDER BY priority ASC, created_at ASC
      `,
      [workstreamId, tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    throw error;
  }
}

export async function getUnassignedTasks(
  projectId: string,
  tenantSlug: string
): Promise<Task[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM tasks 
      WHERE project_id = $1 AND tenant_slug = $2 AND is_assigned = false
      ORDER BY priority DESC, created_at ASC
      `,
      [projectId, tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching unassigned tasks:", error);
    throw error;
  }
}

export async function getTasksForProject(
  projectId: string,
  tenantSlug: string
): Promise<Task[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM tasks 
      WHERE project_id = $1 AND tenant_slug = $2
      ORDER BY priority ASC, created_at ASC
      `,
      [projectId, tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching project tasks:", error);
    throw error;
  }
}

export async function getAllTasksForTenant(
  tenantSlug: string
): Promise<Task[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM tasks 
      WHERE tenant_slug = $1
      ORDER BY priority ASC, created_at ASC
      `,
      [tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching tenant tasks:", error);
    throw error;
  }
}

export async function getTaskById(
  id: string,
  tenantSlug: string
): Promise<Task | null> {
  try {
    const result = await db.query(
      `SELECT * FROM tasks WHERE id = $1 AND tenant_slug = $2`,
      [id, tenantSlug]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error fetching task:", error);
    throw error;
  }
}

export async function updateTask(
  id: string,
  tenantSlug: string,
  input: Partial<TaskCreateInput>
): Promise<Task | null> {
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramCount}`);
      values.push(input.title);
      paramCount++;
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramCount}`);
      values.push(input.description);
      paramCount++;
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(input.status);
      paramCount++;
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${paramCount}`);
      values.push(input.priority);
      paramCount++;
    }
    if (input.percentComplete !== undefined) {
      updates.push(`percent_complete = $${paramCount}`);
      values.push(input.percentComplete);
      paramCount++;
    }
    if (input.plannedEndDate !== undefined) {
      updates.push(`planned_end_date = $${paramCount}`);
      values.push(input.plannedEndDate);
      paramCount++;
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id, tenantSlug);

    if (updates.length === 1) return getTaskById(id, tenantSlug);

    const result = await db.query(
      `
      UPDATE tasks 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount} AND tenant_slug = $${paramCount + 1}
      RETURNING *
      `,
      values
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error updating task:", error);
    throw error;
  }
}

export async function deleteTask(id: string, tenantSlug: string): Promise<boolean> {
  try {
    const result = await db.query(
      `DELETE FROM tasks WHERE id = $1 AND tenant_slug = $2 RETURNING id`,
      [id, tenantSlug]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    console.error("Error deleting task:", error);
    throw error;
  }
}

export async function getOrCreateDefaultWorkstream(
  projectId: string,
  tenantSlug: string,
  createdBy: string
): Promise<Workstream | null> {
  try {
    const existing = await db.query(
      `SELECT * FROM workstreams WHERE project_id = $1 AND tenant_slug = $2 ORDER BY created_at ASC LIMIT 1`,
      [projectId, tenantSlug]
    );
    if (existing.rows[0]) return existing.rows[0];

    const result = await db.query(
      `
      INSERT INTO workstreams (
        project_id, tenant_slug, code, name, description, status, priority, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [projectId, tenantSlug, "WS-DEFAULT", "Default Workstream", "Auto-created workstream", "ACTIVE", 1, createdBy]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error ensuring default workstream:", error);
    throw error;
  }
}

// ============================================================
// TASK ASSIGNMENT OPERATIONS
// ============================================================

export async function createTaskAssignment(
  tenantSlug: string,
  input: TaskAssignmentCreateInput,
  createdBy: string
): Promise<TaskAssignment | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO task_assignments (
        task_id, project_id, tenant_slug, employee_id,
        assigned_hours, assigned_percentage, assignment_start_date,
        assignment_end_date, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        input.taskId,
        input.projectId,
        tenantSlug,
        input.employeeId,
        input.assignedHours || null,
        input.assignedPercentage || null,
        input.assignmentStartDate,
        input.assignmentEndDate || null,
        input.status || "PROPOSED",
        createdBy,
      ]
    );

    // Mark task as assigned
    await db.query(
      `UPDATE tasks SET is_assigned = true WHERE id = $1`,
      [input.taskId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error creating task assignment:", error);
    throw error;
  }
}

export async function getAssignmentsForEmployee(
  employeeId: string,
  tenantSlug: string
): Promise<TaskAssignment[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM task_assignments 
      WHERE employee_id = $1 AND tenant_slug = $2 AND status = 'ACCEPTED'
      ORDER BY assignment_start_date ASC
      `,
      [employeeId, tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching assignments:", error);
    throw error;
  }
}

export async function approveTaskAssignment(
  id: string,
  tenantSlug: string,
  approvedBy: string
): Promise<TaskAssignment | null> {
  try {
    const result = await db.query(
      `
      UPDATE task_assignments 
      SET status = 'ACCEPTED', approved_by = $1, approved_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_slug = $3
      RETURNING *
      `,
      [approvedBy, id, tenantSlug]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error approving assignment:", error);
    throw error;
  }
}

// ============================================================
// TIME LOG OPERATIONS
// ============================================================

export async function logTime(
  tenantSlug: string,
  input: TimeLogCreateInput,
  createdBy: string
): Promise<TimeLog | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO time_logs (
        task_assignment_id, task_id, project_id, employee_id, tenant_slug,
        log_date, hours_logged, description, activity_type, billable,
        approval_status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        input.taskAssignmentId,
        input.taskId,
        input.projectId,
        tenantSlug,
        input.logDate,
        input.hoursLogged,
        input.description || null,
        input.activityType || null,
        input.billable || false,
        createdBy || "SUBMITTED",
      ]
    );

    // Update assignment's actual hours
    await db.query(
      `
      UPDATE task_assignments 
      SET actual_hours_logged = actual_hours_logged + $1
      WHERE id = $2
      `,
      [input.hoursLogged, input.taskAssignmentId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error logging time:", error);
    throw error;
  }
}

export async function getTimeLogsForEmployee(
  employeeId: string,
  tenantSlug: string,
  fromDate: Date,
  toDate: Date
): Promise<TimeLog[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM time_logs 
      WHERE employee_id = $1 AND tenant_slug = $2 
        AND log_date >= $3 AND log_date <= $4
      ORDER BY log_date DESC
      `,
      [employeeId, tenantSlug, fromDate, toDate]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching time logs:", error);
    throw error;
  }
}

export async function getTimeLogsForProject(
  projectId: string,
  tenantSlug: string
): Promise<TimeLog[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM time_logs 
      WHERE project_id = $1 AND tenant_slug = $2
      ORDER BY log_date DESC
      `,
      [projectId, tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching project time logs:", error);
    throw error;
  }
}

export async function approveTimeLog(
  id: string,
  tenantSlug: string,
  approvedBy: string
): Promise<TimeLog | null> {
  try {
    const result = await db.query(
      `
      UPDATE time_logs 
      SET approval_status = 'APPROVED', approved_by = $1, approved_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_slug = $3
      RETURNING *
      `,
      [approvedBy, id, tenantSlug]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error approving time log:", error);
    throw error;
  }
}

// ============================================================
// CAPACITY SNAPSHOT OPERATIONS
// ============================================================

export async function getLatestCapacitySnapshot(
  employeeId: string,
  tenantSlug: string
): Promise<CapacitySnapshot | null> {
  try {
    const result = await db.query(
      `
      SELECT * FROM capacity_snapshots 
      WHERE employee_id = $1 AND tenant_slug = $2
      ORDER BY snapshot_date DESC
      LIMIT 1
      `,
      [employeeId, tenantSlug]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error fetching capacity snapshot:", error);
    throw error;
  }
}

export async function createCapacitySnapshot(
  tenantSlug: string,
  employeeId: string,
  data: Partial<CapacitySnapshot>
): Promise<CapacitySnapshot | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO capacity_snapshots (
        tenant_slug, employee_id, snapshot_date,
        total_available_hours, allocated_to_projects_hours,
        allocated_to_maintenance_hours, available_capacity_hours,
        utilization_percentage, forecasted_allocation_next_30days,
        forecasted_allocation_next_90days, over_allocated_risk,
        skill_gap_risk
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
      `,
      [
        tenantSlug,
        employeeId,
        data.snapshotDate || new Date(),
        data.totalAvailableHours || 160,
        data.allocatedToProjectsHours || 0,
        data.allocatedToMaintenanceHours || 0,
        data.availableCapacityHours || 160,
        data.utilizationPercentage || 0,
        data.forecastedAllocationNext30Days || 0,
        data.forecastedAllocationNext90Days || 0,
        data.overAllocatedRisk || false,
        data.skillGapRisk || false,
      ]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error creating capacity snapshot:", error);
    throw error;
  }
}

// ============================================================
// SKILL OPERATIONS
// ============================================================

export async function getEmployeeSkills(
  employeeId: string,
  tenantSlug: string
): Promise<EmployeeSkill[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM employee_skills 
      WHERE employee_id = $1 AND tenant_slug = $2
      ORDER BY proficiency_level DESC, years_of_experience DESC
      `,
      [employeeId, tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching employee skills:", error);
    throw error;
  }
}

// ============================================================
// ASSIGNMENT RECOMMENDATION OPERATIONS
// ============================================================

export async function createAssignmentRecommendation(
  tenantSlug: string,
  taskId: string,
  projectId: string,
  recommendedEmployeeId: string,
  data: {
    fitScore?: number;
    reason?: string;
    skillsMatchScore?: number;
    capacityScore?: number;
    availabilityScore?: number;
    performanceHistoryScore?: number;
  },
  createdBy: string
): Promise<AssignmentRecommendation | null> {
  try {
    const result = await db.query(
      `
      INSERT INTO assignment_recommendations (
        task_id, project_id, tenant_slug, recommended_employee_id,
        fit_score, recommendation_reason,
        skills_match_score, capacity_score, availability_score,
        performance_history_score, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        taskId,
        projectId,
        tenantSlug,
        recommendedEmployeeId,
        data.fitScore || null,
        data.reason || null,
        data.skillsMatchScore || null,
        data.capacityScore || null,
        data.availabilityScore || null,
        data.performanceHistoryScore || null,
        createdBy,
      ]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.error("Error creating assignment recommendation:", error);
    throw error;
  }
}

export async function getAssignmentRecommendations(
  taskId: string,
  tenantSlug: string
): Promise<AssignmentRecommendation[]> {
  try {
    const result = await db.query(
      `
      SELECT * FROM assignment_recommendations 
      WHERE task_id = $1 AND tenant_slug = $2 AND status IN ('NEW', 'VIEWED')
      ORDER BY fit_score DESC
      `,
      [taskId, tenantSlug]
    );
    return result.rows;
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    throw error;
  }
}

// ============================================================
// PROJECT TEAM OPERATIONS
// ============================================================

async function ensureProjectTeamTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_team (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL,
      tenant_slug TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getProjectTeam(
  projectId: string,
  tenantSlug: string
): Promise<any[]> {
  await ensureProjectTeamTable();
  const result = await db.query(
    `SELECT * FROM project_team WHERE project_id = $1 AND tenant_slug = $2 ORDER BY created_at DESC`,
    [projectId, tenantSlug]
  );
  return result.rows;
}

export async function addProjectTeamMember(
  projectId: string,
  tenantSlug: string,
  data: { email: string; role: string },
  createdBy: string
): Promise<any | null> {
  await ensureProjectTeamTable();
  const result = await db.query(
    `
    INSERT INTO project_team (project_id, tenant_slug, email, role, created_by)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [projectId, tenantSlug, data.email, data.role, createdBy]
  );
  return result.rows[0] || null;
}

export async function updateProjectTeamMember(
  id: string,
  tenantSlug: string,
  data: { role?: string; email?: string }
): Promise<any | null> {
  await ensureProjectTeamTable();
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (data.role !== undefined) {
    updates.push(`role = $${paramCount}`);
    values.push(data.role);
    paramCount++;
  }
  if (data.email !== undefined) {
    updates.push(`email = $${paramCount}`);
    values.push(data.email);
    paramCount++;
  }
  if (updates.length === 0) {
    const existing = await db.query(`SELECT * FROM project_team WHERE id = $1 AND tenant_slug = $2`, [id, tenantSlug]);
    return existing.rows[0] || null;
  }
  updates.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id, tenantSlug);

  const result = await db.query(
    `
    UPDATE project_team
    SET ${updates.join(", ")}
    WHERE id = $${paramCount} AND tenant_slug = $${paramCount + 1}
    RETURNING *
    `,
    values
  );
  return result.rows[0] || null;
}

export async function removeProjectTeamMember(
  id: string,
  tenantSlug: string
): Promise<boolean> {
  await ensureProjectTeamTable();
  const result = await db.query(
    `DELETE FROM project_team WHERE id = $1 AND tenant_slug = $2 RETURNING id`,
    [id, tenantSlug]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================
// PROJECT BUDGET OPERATIONS
// ============================================================

async function ensureBudgetAllocationsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_budget_allocations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id TEXT NOT NULL,
      tenant_slug TEXT NOT NULL,
      category TEXT NOT NULL,
      allocated NUMERIC(15,2) NOT NULL DEFAULT 0,
      spent NUMERIC(15,2) NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getBudgetAllocationsForProject(
  projectId: string,
  tenantSlug: string
): Promise<any[]> {
  await ensureBudgetAllocationsTable();
  const result = await db.query(
    `SELECT * FROM project_budget_allocations WHERE project_id = $1 AND tenant_slug = $2 ORDER BY created_at DESC`,
    [projectId, tenantSlug]
  );
  return result.rows;
}

export async function createBudgetAllocation(
  projectId: string,
  tenantSlug: string,
  data: { category: string; allocated: number; spent?: number },
  createdBy: string
): Promise<any | null> {
  await ensureBudgetAllocationsTable();
  const result = await db.query(
    `
    INSERT INTO project_budget_allocations (project_id, tenant_slug, category, allocated, spent, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [projectId, tenantSlug, data.category, data.allocated, data.spent ?? 0, createdBy]
  );
  return result.rows[0] || null;
}

export async function deleteBudgetAllocation(
  id: string,
  tenantSlug: string
): Promise<boolean> {
  await ensureBudgetAllocationsTable();
  const result = await db.query(
    `DELETE FROM project_budget_allocations WHERE id = $1 AND tenant_slug = $2 RETURNING id`,
    [id, tenantSlug]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================
// PROJECT CAPACITY OPERATIONS
// ============================================================

async function ensureCapacitySnapshotsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_capacity_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_slug TEXT NOT NULL,
      department TEXT NOT NULL,
      week_of DATE NOT NULL,
      available_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      assigned_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
      utilization NUMERIC(5,2) NOT NULL DEFAULT 0,
      under_utilized BOOLEAN NOT NULL DEFAULT false,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getProjectCapacitySnapshots(
  tenantSlug: string
): Promise<any[]> {
  await ensureCapacitySnapshotsTable();
  const result = await db.query(
    `SELECT * FROM project_capacity_snapshots WHERE tenant_slug = $1 ORDER BY created_at DESC`,
    [tenantSlug]
  );
  return result.rows;
}

export async function upsertProjectCapacitySnapshot(
  tenantSlug: string,
  data: {
    department: string;
    weekOf: string;
    availableHours: number;
    assignedHours: number;
    utilization: number;
    underUtilized: boolean;
  },
  createdBy: string
): Promise<any | null> {
  await ensureCapacitySnapshotsTable();
  const result = await db.query(
    `
    INSERT INTO project_capacity_snapshots (tenant_slug, department, week_of, available_hours, assigned_hours, utilization, under_utilized, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (tenant_slug, department, week_of) DO UPDATE SET
      available_hours = EXCLUDED.available_hours,
      assigned_hours = EXCLUDED.assigned_hours,
      utilization = EXCLUDED.utilization,
      under_utilized = EXCLUDED.under_utilized,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [tenantSlug, data.department, data.weekOf, data.availableHours, data.assignedHours, data.utilization, data.underUtilized, createdBy]
  );
  return result.rows[0] || null;
}

// ============================================================
// PROJECT INVOICE OPERATIONS
// ============================================================

async function ensureProjectInvoicesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS project_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_slug TEXT NOT NULL,
      project_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      amount NUMERIC(15,2) NOT NULL,
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'draft',
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getProjectInvoices(
  tenantSlug: string
): Promise<any[]> {
  await ensureProjectInvoicesTable();
  const result = await db.query(
    `SELECT * FROM project_invoices WHERE tenant_slug = $1 ORDER BY created_at DESC`,
    [tenantSlug]
  );
  return result.rows;
}

export async function createProjectInvoice(
  tenantSlug: string,
  data: {
    projectId: string;
    amount: number;
    dueDate: string;
  },
  createdBy: string
): Promise<any | null> {
  await ensureProjectInvoicesTable();
  const invoiceNumber = `INV-${Date.now()}`;
  const result = await db.query(
    `
    INSERT INTO project_invoices (tenant_slug, project_id, invoice_number, amount, due_date, status, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [tenantSlug, data.projectId, invoiceNumber, data.amount, data.dueDate, "draft", createdBy]
  );
  return result.rows[0] || null;
}
