import { randomUUID } from "crypto";

export type Priority = "Low" | "Medium" | "High" | "Critical";
export type ProjectStatus = "Planned" | "Active" | "On Hold" | "Completed";

export interface ProjectEntity {
  id: string;
  tenantSlug: string;
  name: string;
  description: string;
  objective: string;
  subsidiary: string;
  branch: string;
  departments: string[];
  startDate: string;
  endDate: string;
  priority: Priority;
  budgetApproved: number;
  budgetSpent: number;
  status: ProjectStatus;
  owner: string;
  approvalStatus: "Pending" | "Approved" | "Rejected";
  region: string;
  createdBy: string;
  approvedBy?: string;
}

export interface WorkstreamEntity {
  id: string;
  projectId: string;
  tenantSlug: string;
  name: string;
  description: string;
  department: string;
  lead: string;
  startDate: string;
  endDate: string;
  progress: number;
  dependencies: string[];
  automationState: "Monitoring" | "Escalating" | "Stable";
  createdBy: string;
}

export interface TaskEntity {
  id: string;
  tenantSlug: string;
  projectId: string;
  workstreamId: string;
  department: string;
  title: string;
  description: string;
  requiredSkills: string[];
  estimatedHours: number;
  priority: Priority;
  dependencyStatus: "blocked" | "unblocked";
  dueDate: string;
  assignedEmployees: string[];
  contributionWeight: number;
  status: "Todo" | "In Progress" | "Review" | "Done";
  createdBy: string;
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  employeeId: string;
  fitScore: number;
  overrideReason?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface TimeLog {
  id: string;
  taskId: string;
  projectId: string;
  workstreamId: string;
  employeeId: string;
  hours: number;
  date: string;
  billable: boolean;
  tenantSlug: string;
}

export interface SkillProfile {
  employeeId: string;
  employeeName: string;
  department: string;
  skills: string[];
  availability: number; // percentage
  currentLoad: number; // percentage
  performanceScore: number; // percentage
}

export interface CapacitySnapshot {
  id: string;
  tenantSlug: string;
  department: string;
  weekOf: string;
  availableHours: number;
  assignedHours: number;
  utilization: number;
  underUtilized: boolean;
}

interface TenantProjectData {
  projects: ProjectEntity[];
  workstreams: WorkstreamEntity[];
  tasks: TaskEntity[];
  assignments: TaskAssignment[];
  timeLogs: TimeLog[];
  capacity: CapacitySnapshot[];
  skills: SkillProfile[];
}

const tenantStore: Record<string, TenantProjectData> = {};

function seedTenant(tenantSlug: string) {
  if (tenantStore[tenantSlug]) {
    return tenantStore[tenantSlug];
  }

  tenantStore[tenantSlug] = {
    projects: [],
    workstreams: [],
    tasks: [],
    assignments: [],
    timeLogs: [],
    capacity: [],
    skills: [],
  };

  return tenantStore[tenantSlug];
}

function getTenantStore(tenantSlug: string): TenantProjectData {
  return tenantStore[tenantSlug] || seedTenant(tenantSlug);
}

export function listProjects(tenantSlug: string) {
  return getTenantStore(tenantSlug).projects;
}

export function createProject(tenantSlug: string, payload: Omit<ProjectEntity, "id" | "tenantSlug">) {
  const store = getTenantStore(tenantSlug);
  const project: ProjectEntity = {
    ...payload,
    id: randomUUID(),
    tenantSlug,
  };
  store.projects.push(project);
  return project;
}

export function listWorkstreams(tenantSlug: string, projectId?: string) {
  const store = getTenantStore(tenantSlug);
  return projectId ? store.workstreams.filter((ws) => ws.projectId === projectId) : store.workstreams;
}

export function createWorkstream(tenantSlug: string, payload: Omit<WorkstreamEntity, "id" | "tenantSlug">) {
  const store = getTenantStore(tenantSlug);
  const workstream: WorkstreamEntity = {
    ...payload,
    id: randomUUID(),
    tenantSlug,
  };
  store.workstreams.push(workstream);
  return workstream;
}

export function listTasks(params: { tenantSlug: string; projectId?: string; workstreamId?: string; status?: TaskEntity["status"]; }) {
  const store = getTenantStore(params.tenantSlug);
  return store.tasks.filter((task) => {
    if (params.projectId && task.projectId !== params.projectId) {
      return false;
    }
    if (params.workstreamId && task.workstreamId !== params.workstreamId) {
      return false;
    }
    if (params.status && task.status !== params.status) {
      return false;
    }
    return true;
  });
}

export function createTask(tenantSlug: string, payload: Omit<TaskEntity, "id" | "tenantSlug">) {
  const store = getTenantStore(tenantSlug);
  const task: TaskEntity = {
    ...payload,
    id: randomUUID(),
    tenantSlug,
  };
  store.tasks.push(task);
  return task;
}

export function updateTaskStatus(tenantSlug: string, taskId: string, status: TaskEntity["status"], dependencyStatus?: TaskEntity["dependencyStatus"]) {
  const store = getTenantStore(tenantSlug);
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) {
    return undefined;
  }
  task.status = status;
  if (dependencyStatus) {
    task.dependencyStatus = dependencyStatus;
  }
  return task;
}

export function recordAssignment(tenantSlug: string, payload: Omit<TaskAssignment, "id" | "createdAt">) {
  const store = getTenantStore(tenantSlug);
  const assignment: TaskAssignment = {
    ...payload,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  store.assignments.push(assignment);
  return assignment;
}

export function listCapacity(tenantSlug: string) {
  return getTenantStore(tenantSlug).capacity;
}

export function upsertCapacitySnapshot(tenantSlug: string, snapshot: Omit<CapacitySnapshot, "id" | "tenantSlug"> & { id?: string }) {
  const store = getTenantStore(tenantSlug);
  if (snapshot.id) {
    const existing = store.capacity.find((cap) => cap.id === snapshot.id);
    if (existing) {
      Object.assign(existing, snapshot);
      existing.tenantSlug = tenantSlug;
      return existing;
    }
  }

  const created: CapacitySnapshot = {
    ...snapshot,
    id: randomUUID(),
    tenantSlug,
  };
  store.capacity.push(created);
  return created;
}

export function listSkills(tenantSlug: string) {
  return getTenantStore(tenantSlug).skills;
}

export function listAssignments(tenantSlug: string) {
  return getTenantStore(tenantSlug).assignments;
}

export function logTimeEntry(tenantSlug: string, payload: Omit<TimeLog, "id" | "tenantSlug">) {
  const store = getTenantStore(tenantSlug);
  const entry: TimeLog = {
    ...payload,
    id: randomUUID(),
    tenantSlug,
  };
  store.timeLogs.push(entry);
  return entry;
}

export function listTimeEntries(tenantSlug: string, projectId?: string) {
  const store = getTenantStore(tenantSlug);
  return projectId ? store.timeLogs.filter((log) => log.projectId === projectId) : store.timeLogs;
}

export function deleteProject(tenantSlug: string, projectId: string) {
  const store = getTenantStore(tenantSlug);
  const index = store.projects.findIndex((p) => p.id === projectId);
  if (index === -1) {
    throw new Error("Project not found");
  }
  store.projects.splice(index, 1);
  return true;
}
