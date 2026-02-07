import { listSkills, SkillProfile } from "./projects-data";

export interface TaskFitInput {
  tenantSlug: string;
  requiredSkills: string[];
  department: string;
  minAvailability?: number;
}

export interface TaskFitSuggestion {
  employeeId: string;
  employeeName: string;
  department: string;
  skillMatch: number;
  availability: number;
  currentLoad: number;
  performanceScore: number;
  fitScore: number;
}

function computeSkillMatch(skills: string[], required: string[]) {
  if (required.length === 0) {
    return 100;
  }
  const intersection = required.filter((req) => skills.includes(req)).length;
  return Math.round((intersection / required.length) * 100);
}

function calculateFit(profile: SkillProfile, requiredSkills: string[]) {
  const skillMatch = computeSkillMatch(profile.skills, requiredSkills);
  const availability = profile.availability;
  const inverseLoad = Math.max(0, 100 - profile.currentLoad);

  const fitScore =
    skillMatch * 0.4 +
    availability * 0.3 +
    inverseLoad * 0.2 +
    profile.performanceScore * 0.1;

  return {
    skillMatch,
    availability,
    currentLoad: profile.currentLoad,
    performanceScore: profile.performanceScore,
    fitScore: parseFloat(fitScore.toFixed(1)),
  };
}

export function suggestAssignments(input: TaskFitInput): TaskFitSuggestion[] {
  const { tenantSlug, department, requiredSkills, minAvailability = 30 } = input;
  const profiles = listSkills(tenantSlug);

  return profiles
    .filter((profile) => profile.department === department && profile.availability >= minAvailability)
    .map((profile) => ({
      employeeId: profile.employeeId,
      employeeName: profile.employeeName,
      department: profile.department,
      ...calculateFit(profile, requiredSkills),
    }))
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, 5);
}
