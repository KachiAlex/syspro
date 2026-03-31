/**
 * Smart Assignment Service
 * Intelligent project team assignment with capacity planning
 */

import { 
  getEmployeeSkills,
  getAssignmentsForEmployee, 
  createCapacitySnapshot,
  getLatestCapacitySnapshot,
  getTasksForWorkstream,
  getUnassignedTasks,
  createAssignmentRecommendation,
  getAssignmentRecommendations
} from "./db";
import {
  TaskFitSuggestion,
  AssignmentRecommendation,
  Task,
  EmployeeSkill,
  TaskAssignment,
  DetailedSuggestion,
} from "./types";

// ============================================================
// CAPACITY CALCULATION
// ============================================================

interface EmployeeCapacity {
  employeeId: string;
  totalHoursPerMonth: number;
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
  isOverAllocated: boolean;
  currentAssignments: TaskAssignment[];
}

async function calculateEmployeeCapacity(
  employeeId: string,
  tenantSlug: string
): Promise<EmployeeCapacity> {
  try {
    // Get current assignments
    const assignments = await getAssignmentsForEmployee(employeeId, tenantSlug);
    
    // Calculate allocated hours (assuming 30-day month, 8 hours/day)
    const totalHoursPerMonth = 160; // 20 working days * 8 hours
    let allocatedHours = 0;

    for (const assignment of assignments) {
      if (assignment.assignedHours) {
        allocatedHours += assignment.assignedHours;
      } else if (assignment.assignedPercentage) {
        allocatedHours += (totalHoursPerMonth * assignment.assignedPercentage) / 100;
      }
    }

    const availableHours = totalHoursPerMonth - allocatedHours;
    const utilizationPercent = (allocatedHours / totalHoursPerMonth) * 100;

    // Create capacity snapshot for trending
    await createCapacitySnapshot(tenantSlug, employeeId, {
      totalAvailableHours: totalHoursPerMonth,
      allocatedToProjectsHours: allocatedHours,
      availableCapacityHours: Math.max(0, availableHours),
      utilizationPercentage: utilizationPercent,
      overAllocatedRisk: utilizationPercent > 100,
    });

    return {
      employeeId,
      totalHoursPerMonth,
      allocatedHours,
      availableHours: Math.max(0, availableHours),
      utilizationPercent,
      isOverAllocated: utilizationPercent > 100,
      currentAssignments: assignments,
    };
  } catch (error) {
    console.error(`Error calculating capacity for ${employeeId}:`, error);
    throw error;
  }
}

// ============================================================
// SKILL MATCHING
// ============================================================

interface SkillMatchResult {
  matchedSkills: string[];
  missingSkills: string[];
  matchScore: number;
}

async function evaluateSkillMatch(
  employeeId: string,
  requiredSkills: string[],
  tenantSlug: string
): Promise<SkillMatchResult> {
  try {
    const employeeSkills = await getEmployeeSkills(employeeId, tenantSlug);
    const employeeSkillCodes = employeeSkills.map((s) => s.skillCode);

    const matchedSkills = requiredSkills.filter((skill) =>
      employeeSkillCodes.includes(skill)
    );

    const missingSkills = requiredSkills.filter(
      (skill) => !employeeSkillCodes.includes(skill)
    );

    // Calculate match score (0-100)
    // Full match = 100, Each missing skill = -10
    const matchScore = Math.max(
      0,
      100 - missingSkills.length * 10
    );

    return {
      matchedSkills,
      missingSkills,
      matchScore,
    };
  } catch (error) {
    console.error(`Error evaluating skill match for ${employeeId}:`, error);
    throw error;
  }
}

// ============================================================
// RECOMMENDATION ENGINE
// ============================================================

interface RecommendationFactors {
  skillsMatchScore: number;
  capacityScore: number;
  availabilityScore: number;
  performanceHistoryScore: number;
  departmentAlignmentScore: number;
}

async function scoreEmployee(
  employeeId: string,
  tenantSlug: string,
  task: Task,
  employeeCapacity: EmployeeCapacity,
  skillMatch: SkillMatchResult
): Promise<DetailedSuggestion | null> {
  try {
    // Skills Match Score (40% weight)
    const skillsMatchScore = skillMatch.matchScore;

    // Capacity Score (30% weight)
    // Available hours vs estimated task hours
    const requiredHours = task.estimatedHours || 40;
    const capacityScore = Math.min(
      100,
      (employeeCapacity.availableHours / requiredHours) * 100
    );

    // Availability Score (20% weight)
    // Based on utilization
    const availabilityScore = Math.max(0, 100 - employeeCapacity.utilizationPercent);

    // Performance History Score (10% weight) - placeholder
    const performanceHistoryScore = 75; // TODO: Fetch from performance module

    // Calculate weighted fit score
    const fitScore =
      skillsMatchScore * 0.4 +
      capacityScore * 0.3 +
      availabilityScore * 0.2 +
      performanceHistoryScore * 0.1;

    // Identify risk flags
    const riskFlags: string[] = [];
    if (employeeCapacity.isOverAllocated) {
      riskFlags.push("OVER_ALLOCATED");
    }
    if (skillMatch.missingSkills.length > 0) {
      riskFlags.push("SKILL_GAP");
    }
    if (capacityScore < 50) {
      riskFlags.push("LOW_CAPACITY");
    }

    // Build recommendation reason
    const reasons = [];
    if (skillsMatchScore === 100) {
      reasons.push("Perfect skill match");
    } else if (skillsMatchScore >= 80) {
      reasons.push("Strong skill match");
    }
    if (capacityScore >= 80) {
      reasons.push("High availability");
    }
    if (performanceHistoryScore >= 80) {
      reasons.push("Strong track record");
    }

    return {
      employeeId,
      taskId: task.id,
      projectId: task.projectId,
      fitScore: Math.round((skillsMatchScore + capacityScore + availabilityScore + performanceHistoryScore) / 4),
      recommendationReason: reasons.join(", "),
      skillsMatchScore,
      capacityScore,
      availabilityScore,
      performanceHistoryScore,
    };
  } catch (error) {
    console.error(`Error scoring employee ${employeeId}:`, error);
    return null;
  }
}

// ============================================================
// PUBLIC API
// ============================================================

export async function getSmartAssignmentRecommendations(
  taskId: string,
  task: Task,
  tenantSlug: string,
  candidateEmployeeIds?: string[]
): Promise<DetailedSuggestion[]> {
  try {
    const suggestions: DetailedSuggestion[] = [];

    // If candidate IDs provided, use those; otherwise would need to query all employees
    const employeesToEvaluate = candidateEmployeeIds || [];

    for (const employeeId of employeesToEvaluate) {
      try {
        const capacity = await calculateEmployeeCapacity(employeeId, tenantSlug);
        const skillMatch = await evaluateSkillMatch(
          employeeId,
          task.requiredSkills,
          tenantSlug
        );

        const suggestion = await scoreEmployee(
          employeeId,
          tenantSlug,
          task,
          capacity,
          skillMatch
        );

        if (suggestion && suggestion.fitScore >= 60) {
          suggestions.push(suggestion);
        }
      } catch (error) {
        console.error(`Error evaluating employee ${employeeId}:`, error);
        continue;
      }
    }

    // Sort by fit score descending
    suggestions.sort((a, b) => b.fitScore - a.fitScore);

    return suggestions.slice(0, 5); // Return top 5
  } catch (error) {
    console.error("Error getting assignment recommendations:", error);
    throw error;
  }
}

export async function detectCapacityConflicts(
  tenantSlug: string,
  projectId: string
): Promise<Array<{ employeeId: string; conflictDescription: string }>> {
  try {
    const conflicts: Array<{ employeeId: string; conflictDescription: string }> = [];

    // TODO: Get all assignments for this project
    // Check for over-allocations
    // Check for skill gaps
    // Check for timeline conflicts

    return conflicts;
  } catch (error) {
    console.error("Error detecting capacity conflicts:", error);
    throw error;
  }
}

export async function suggestCapacityRebalancing(
  tenantSlug: string,
  projectId: string
): Promise<Array<{ from: string; to: string; hours: number; reason: string }>> {
  try {
    const rebalancingActions: Array<{
      from: string;
      to: string;
      hours: number;
      reason: string;
    }> = [];

    // TODO: Analyze current assignments
    // TODO: Identify over/under-allocated resources
    // TODO: Suggest transfers
    // TODO: Validate against skill requirements

    return rebalancingActions;
  } catch (error) {
    console.error("Error suggesting capacity rebalancing:", error);
    throw error;
  }
}

export async function monitorUtilizationRisk(
  tenantSlug: string,
  dayHorizon = 30
): Promise<Array<{ employeeId: string; riskLevel: string; forecast: number }>> {
  try {
    const riskReport: Array<{
      employeeId: string;
      riskLevel: string;
      forecast: number;
    }> = [];

    // TODO: Get all employees
    // TODO: Calculate forecasted allocation
    // TODO: Flag high-risk scenarios

    return riskReport;
  } catch (error) {
    console.error("Error monitoring utilization risk:", error);
    throw error;
  }
}

export async function autoOptimizeAssignments(
  tenantSlug: string,
  projectId: string
): Promise<{
  optimizationApplied: boolean;
  changesCount: number;
  improvementPercent: number;
}> {
  try {
    // TODO: Get all unassigned tasks
    // TODO: Get all employees
    // TODO: Run recommendation engine for each task
    // TODO: Apply highest-confidence recommendations
    // TODO: Return summary

    return {
      optimizationApplied: false,
      changesCount: 0,
      improvementPercent: 0,
    };
  } catch (error) {
    console.error("Error auto-optimizing assignments:", error);
    throw error;
  }
}
