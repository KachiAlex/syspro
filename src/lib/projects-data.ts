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

  const projects: ProjectEntity[] = [
    {
      id: "proj-fiber",
      tenantSlug,
      name: "Fiber Network Expansion",
      description: "Deploy fiber across 32 business districts",
      objective: "Unlock enterprise fiber upsell",
      subsidiary: "MetroWave Holdings",
      branch: "Lagos",
      departments: ["IT", "Operations", "Marketing"],
      startDate: "2026-01-05",
      endDate: "2026-06-30",
      priority: "Critical",
      budgetApproved: 420_000_000,
      budgetSpent: 170_000_000,
      status: "Active",
      owner: "Adaeze Obi (PMO)",
      approvalStatus: "Approved",
      region: "West Africa",
      createdBy: "system",
      approvedBy: "cfo",
    },
    {
      id: "proj-edge",
      tenantSlug,
      name: "Edge Data Center Retrofit",
      description: "Modernize DCs with Tier IV compliance",
      objective: "Improve latency and reliability",
      subsidiary: "Syspro Compute",
      branch: "Abuja",
      departments: ["Facilities", "Security", "Finance"],
      startDate: "2026-02-15",
      endDate: "2026-09-01",
      priority: "High",
      budgetApproved: 180_000_000,
      budgetSpent: 65_000_000,
      status: "Planned",
      owner: "Chima Okoye (Infra)",
      approvalStatus: "Pending",
      region: "West Africa",
      createdBy: "system",
    },
  ];

  const workstreams: WorkstreamEntity[] = [
    {
      id: "ws-design",
      tenantSlug,
      projectId: "proj-fiber",
      name: "Network Design",
      description: "Blueprint backbone routes and redundancy",
      department: "IT",
      lead: "Efe Idemudia",
      startDate: "2026-01-05",
      endDate: "2026-03-05",
      progress: 68,
      dependencies: [],
      automationState: "Monitoring",
      createdBy: "system",
    },
    {
      id: "ws-deployment",
      tenantSlug,
      projectId: "proj-fiber",
      name: "Field Deployment",
      description: "Street-level civil works and fiber lay",
      department: "Operations",
      lead: "Ngozi Maduka",
      startDate: "2026-02-10",
      endDate: "2026-06-15",
      progress: 41,
      dependencies: ["ws-design"],
      automationState: "Escalating",
      createdBy: "system",
    },
    {
      id: "ws-clients",
      tenantSlug,
      projectId: "proj-fiber",
      name: "Client Communication",
      description: "Migration messaging, CX comms",
      department: "Marketing",
      lead: "Ibrahim Afolabi",
      startDate: "2026-02-01",
      endDate: "2026-05-20",
      progress: 55,
      dependencies: ["ws-design"],
      automationState: "Stable",
      createdBy: "system",
    },
    {
      id: "ws-retrofit",
      tenantSlug,
      projectId: "proj-edge",
      name: "Facility Retrofit",
      description: "Tier upgrade rollout",
      department: "Facilities",
      lead: "Yemi Aderibigbe",
      startDate: "2026-02-20",
      endDate: "2026-08-20",
      progress: 12,
      dependencies: [],
      automationState: "Monitoring",
      createdBy: "system",
    },
  ];

  const tasks: TaskEntity[] = [
    {
      id: "task-site-survey",
      tenantSlug,
      projectId: "proj-fiber",
      workstreamId: "ws-deployment",
      department: "Operations",
      title: "Site survey for district 7",
      description: "Validate ducts and municipal permits",
      requiredSkills: ["Fiber Survey", "AutoCAD"],
      estimatedHours: 32,
      priority: "High",
      dependencyStatus: "unblocked",
      dueDate: "2026-02-18",
      assignedEmployees: ["emp-bolu"],
      contributionWeight: 0.15,
      status: "In Progress",
      createdBy: "system",
    },
    {
      id: "task-bid-pack",
      tenantSlug,
      projectId: "proj-fiber",
      workstreamId: "ws-design",
      department: "IT",
      title: "Finalize vendor bid pack",
      description: "Include BOM + rollout schedule",
      requiredSkills: ["Procurement", "Fiber BOM"],
      estimatedHours: 20,
      priority: "Critical",
      dependencyStatus: "blocked",
      dueDate: "2026-02-10",
      assignedEmployees: ["emp-chidera"],
      contributionWeight: 0.1,
      status: "Review",
      createdBy: "system",
    },
    {
      id: "task-content",
      tenantSlug,
      projectId: "proj-fiber",
      workstreamId: "ws-clients",
      department: "Marketing",
      title: "Draft client migration kit",
      description: "Segmented comms pack",
      requiredSkills: ["Content Strategy", "Telco"],
      estimatedHours: 16,
      priority: "Medium",
      dependencyStatus: "unblocked",
      dueDate: "2026-02-22",
      assignedEmployees: [],
      contributionWeight: 0.08,
      status: "Todo",
      createdBy: "system",
    },
    {
      id: "task-audit",
      tenantSlug,
      projectId: "proj-edge",
      workstreamId: "ws-retrofit",
      department: "Facilities",
      title: "Thermal load audit",
      description: "HVAC + load study",
      requiredSkills: ["HVAC", "Data Center"],
      estimatedHours: 24,
      priority: "High",
      dependencyStatus: "blocked",
      dueDate: "2026-03-05",
      assignedEmployees: [],
      contributionWeight: 0.12,
      status: "Todo",
      createdBy: "system",
    },
  ];

  const capacity: CapacitySnapshot[] = [
    {
      id: "cap-it",
      tenantSlug,
      department: "IT",
      weekOf: "2026-02-02",
      availableHours: 420,
      assignedHours: 360,
      utilization: 86,
      underUtilized: false,
    },
    {
      id: "cap-ops",
      tenantSlug,
      department: "Operations",
      weekOf: "2026-02-02",
      availableHours: 520,
      assignedHours: 505,
      utilization: 97,
      underUtilized: false,
    },
    {
      id: "cap-mkt",
      tenantSlug,
      department: "Marketing",
      weekOf: "2026-02-02",
      availableHours: 300,
      assignedHours: 180,
      utilization: 60,
      underUtilized: true,
    },
  ];

  const skills: SkillProfile[] = [
    {
      employeeId: "emp-zainab",
      employeeName: "Zainab Yusuf",
      department: "Marketing",
      skills: ["Content Strategy", "Enterprise Comms"],
      availability: 80,
      currentLoad: 35,
      performanceScore: 88,
    },
    {
      employeeId: "emp-yinka",
      employeeName: "Yinka Ojo",
      department: "Marketing",
      skills: ["Copy", "Field Enablement"],
      availability: 65,
      currentLoad: 45,
      performanceScore: 90,
    },
    {
      employeeId: "emp-somto",
      employeeName: "Somto Ezenwa",
      department: "Marketing",
      skills: ["UX Writing", "Product Marketing"],
      availability: 72,
      currentLoad: 55,
      performanceScore: 76,
    },
    {
      employeeId: "emp-chidera",
      employeeName: "Chidera Akintola",
      department: "IT",
      skills: ["Procurement", "Fiber BOM"],
      availability: 45,
      currentLoad: 70,
      performanceScore: 82,
    },
    {
      employeeId: "emp-bolu",
      employeeName: "Bolu Salami",
      department: "Operations",
      skills: ["Fiber Survey", "AutoCAD"],
      availability: 55,
      currentLoad: 60,
      performanceScore: 79,
    },
  ];

  tenantStore[tenantSlug] = {
    projects,
    workstreams,
    tasks,
    assignments: [],
    timeLogs: [],
    capacity,
    skills,
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
