"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock8,
  Compass,
  LineChart,
  Loader2,
  Network,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

type Project = {
  id: string;
  name: string;
  objective: string;
  subsidiary: string;
  departments: string[];
  priority: "Low" | "Medium" | "High" | "Critical";
  budget: { approved: number; spent: number };
  status: "Planned" | "Active" | "On Hold" | "Completed";
  owner: string;
  approvalStatus: "Pending" | "Approved" | "Rejected";
  start: string;
  end: string;
  region: string;
};

type Workstream = {
  id: string;
  projectId: string;
  name: string;
  department: string;
  lead: string;
  progress: number;
  timeline: { start: string; end: string };
  dependencies: string[];
  automation: "Monitoring" | "Escalating" | "Stable";
};

type Task = {
  id: string;
  projectId: string;
  workstreamId: string;
  department: string;
  title: string;
  status: "Todo" | "In Progress" | "Review" | "Done";
  requiredSkills: string[];
  dueDate: string;
  effortHours: number;
  assignedTo: string;
  assignedEmployeeIds: string[];
  contributionWeight: number;
  priority: "Low" | "Medium" | "High" | "Critical";
};

type AssignmentSuggestion = {
  employeeId: string;
  employeeName: string;
  department: string;
  skillMatch: number;
  availability: number;
  currentLoad: number;
  performanceScore: number;
  fitScore: number;
};

type CapacitySnapshot = {
  id: string;
  department: string;
  availableHours: number;
  assignedHours: number;
  utilization: number;
  underUtilized: boolean;
};

type AutomationAlert = {
  id: string;
  type: "Risk" | "Escalation" | "Rebalance";
  message: string;
  owner: string;
  due: string;
};

const statusColor: Record<Project["status"], string> = {
  Planned: "bg-sky-500/10 text-sky-200",
  Active: "bg-emerald-500/10 text-emerald-200",
  "On Hold": "bg-amber-500/10 text-amber-200",
  Completed: "bg-slate-500/10 text-slate-300",
};

const priorityColor: Record<Project["priority"], string> = {
  Low: "text-slate-300",
  Medium: "text-sky-300",
  High: "text-amber-300",
  Critical: "text-rose-300",
};

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const formatMillions = (value: number) => `${(value / 1_000_000).toFixed(1)}M`;

const deriveAutomationAlerts = (
  workstreams: Workstream[],
  capacity: CapacitySnapshot[],
  tasks: Task[]
): AutomationAlert[] => {
  const alerts: AutomationAlert[] = [];

  workstreams
    .filter((ws) => ws.automation !== "Stable")
    .forEach((ws) =>
      alerts.push({
        id: `ws-${ws.id}`,
        type: ws.automation === "Escalating" ? "Escalation" : "Risk",
        message: `${ws.name} (${ws.department}) needs intervention — ${ws.progress}% complete`,
        owner: ws.lead,
        due: ws.timeline.end,
      })
    );

  capacity
    .filter((cap) => cap.underUtilized || cap.utilization > 95)
    .forEach((cap) =>
      alerts.push({
        id: `capacity-${cap.id}`,
        type: cap.underUtilized ? "Rebalance" : "Escalation",
        message: cap.underUtilized
          ? `${cap.department} has ${cap.availableHours - cap.assignedHours} idle hours`
          : `${cap.department} running hot at ${cap.utilization}% utilization`,
        owner: `${cap.department} HOD`,
        due: new Date().toISOString().split("T")[0],
      })
    );

  tasks
    .filter((task) => task.assignedEmployeeIds.length === 0)
    .slice(0, 3)
    .forEach((task) =>
      alerts.push({
        id: `task-${task.id}`,
        type: "Risk",
        message: `${task.title} is unassigned (${task.department})`,
        owner: `${task.department} PM`,
        due: task.dueDate,
      })
    );

  return alerts.slice(0, 5);
};

export default function PlannerPage() {
  const tenantSlug = "default";
  const [projects, setProjects] = useState<Project[]>([]);
  const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [capacitySnapshots, setCapacitySnapshots] = useState<CapacitySnapshot[]>([]);
  const [assignmentSuggestions, setAssignmentSuggestions] = useState<AssignmentSuggestion[]>([]);
  const [automationAlerts, setAutomationAlerts] = useState<AutomationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const [projectsRes, workstreamsRes, tasksRes, capacityRes] = await Promise.all([
          fetch(`/api/projects?tenantSlug=${tenantSlug}`),
          fetch(`/api/projects/workstreams?tenantSlug=${tenantSlug}`),
          fetch(`/api/projects/tasks?tenantSlug=${tenantSlug}`),
          fetch(`/api/projects/capacity?tenantSlug=${tenantSlug}`),
        ]);

        if (!projectsRes.ok || !workstreamsRes.ok || !tasksRes.ok || !capacityRes.ok) {
          throw new Error("Failed to load planner data");
        }

        const projectsPayload = await projectsRes.json();
        const workstreamsPayload = await workstreamsRes.json();
        const tasksPayload = await tasksRes.json();
        const capacityPayload = await capacityRes.json();

        if (cancelled) {
          return;
        }

        const normalizedProjects: Project[] = projectsPayload.projects.map((project: any) => ({
          id: project.id,
          name: project.name,
          objective: project.objective,
          subsidiary: project.subsidiary,
          departments: project.departments,
          priority: project.priority,
          budget: { approved: project.budgetApproved, spent: project.budgetSpent },
          status: project.status,
          owner: project.owner,
          approvalStatus: project.approvalStatus,
          start: project.startDate,
          end: project.endDate,
          region: project.region,
        }));

        const normalizedWorkstreams: Workstream[] = workstreamsPayload.workstreams.map((ws: any) => ({
          id: ws.id,
          projectId: ws.projectId,
          name: ws.name,
          department: ws.department,
          lead: ws.lead,
          progress: ws.progress,
          timeline: { start: ws.startDate, end: ws.endDate },
          dependencies: ws.dependencies,
          automation: ws.automationState,
        }));

        const normalizedTasks: Task[] = tasksPayload.tasks.map((task: any) => ({
          id: task.id,
          projectId: task.projectId,
          workstreamId: task.workstreamId,
          department: task.department,
          title: task.title,
          status: task.status,
          requiredSkills: task.requiredSkills || [],
          dueDate: task.dueDate,
          effortHours: task.estimatedHours,
          assignedTo: task.assignedEmployees?.[0] || "Unassigned",
          assignedEmployeeIds: task.assignedEmployees || [],
          contributionWeight: task.contributionWeight,
          priority: task.priority,
        }));

        const normalizedCapacity: CapacitySnapshot[] = capacityPayload.capacity.map((snapshot: any) => ({
          id: snapshot.id || snapshot.department,
          department: snapshot.department,
          availableHours: snapshot.availableHours,
          assignedHours: snapshot.assignedHours,
          utilization: snapshot.utilization,
          underUtilized: snapshot.underUtilized,
        }));

        setProjects(normalizedProjects);
        setWorkstreams(normalizedWorkstreams);
        setTasks(normalizedTasks);
        setCapacitySnapshots(normalizedCapacity);
        setAutomationAlerts(deriveAutomationAlerts(normalizedWorkstreams, normalizedCapacity, normalizedTasks));
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Unable to load planner data right now.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  useEffect(() => {
    if (!tasks.length) {
      setAssignmentSuggestions([]);
      return;
    }

    const unassignedTask = tasks.find((task) => task.assignedEmployeeIds.length === 0);
    if (!unassignedTask) {
      setAssignmentSuggestions([]);
      return;
    }

    let cancelled = false;

    const fetchSuggestions = async () => {
      try {
        const res = await fetch("/api/projects/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantSlug,
            taskId: unassignedTask.id,
            department: unassignedTask.department,
            requiredSkills: unassignedTask.requiredSkills,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to fetch assignment suggestions");
        }

        const payload = await res.json();
        if (!cancelled) {
          setAssignmentSuggestions(
            (payload.suggestions || []).map((suggestion: any) => ({
              employeeId: suggestion.employeeId,
              employeeName: suggestion.employeeName,
              department: suggestion.department,
              skillMatch: suggestion.skillMatch,
              availability: suggestion.availability,
              currentLoad: suggestion.currentLoad,
              performanceScore: suggestion.performanceScore,
              fitScore: suggestion.fitScore,
            }))
          );
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setAssignmentSuggestions([]);
        }
      }
    };

    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [tasks, tenantSlug]);

  const portfolioStats = useMemo(() => {
    const departments = new Set<string>();
    projects.forEach((project) => project.departments.forEach((dept) => departments.add(dept)));
    const approvedBudget = projects.reduce((acc, project) => acc + project.budget.approved, 0);
    const spentBudget = projects.reduce((acc, project) => acc + project.budget.spent, 0);
    const automationPlaybooks = workstreams.filter((ws) => ws.automation !== "Stable").length;
    const escalationsQueued = automationAlerts.filter((alert) => alert.type !== "Rebalance").length;

    return {
      activeDepartments: departments.size,
      approvedBudget,
      spentBudget,
      automationPlaybooks,
      escalationsQueued,
    };
  }, [projects, workstreams, automationAlerts]);

  const kanbanColumns: Task["status"][] = ["Todo", "In Progress", "Review", "Done"];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030314] pb-20">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 pt-20 text-center text-white/70">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-white" />
          <p>Pulling live project telemetry…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#030314] pb-20">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 pt-20 text-center text-white/80">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-300" />
          <p>{error}</p>
          <p className="text-sm text-slate-400">Refresh the page to retry once connectivity stabilizes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030314] pb-20">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6 pt-10 lg:px-10">
        <header className="rounded-3xl border border-white/5 bg-gradient-to-br from-[#0c1530] via-[#050a1d] to-[#0b1128] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-sky-200/80">Project Intelligence Mesh</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">Tenant Project Control</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Projects → Workstreams → Tasks → Outcomes. Department-led orchestration with capacity senses,
                automation hooks, and finance-aware guardrails.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-white/80 hover:border-white/30">
                <Sparkles className="h-4 w-4" /> New Project Canvas
              </button>
              <button className="flex items-center gap-2 rounded-full bg-emerald-300/90 px-5 py-2 text-sm font-semibold text-[#041013]">
                <ShieldCheck className="h-4 w-4" /> Approve Workstream
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Active Departments</p>
              <p className="mt-2 text-3xl font-semibold text-white">{portfolioStats.activeDepartments}</p>
              <p className="text-xs text-slate-400">Across {projects.length} projects</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Budget Coverage</p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {currency.format(portfolioStats.spentBudget)} / {currency.format(portfolioStats.approvedBudget)}
              </p>
              <p className="text-xs text-emerald-300">
                {portfolioStats.approvedBudget > 0
                  ? `${Math.round((portfolioStats.spentBudget / portfolioStats.approvedBudget) * 100)}% utilized`
                  : "Awaiting allocations"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Automation Health</p>
              <p className="mt-2 text-3xl font-semibold text-white">{portfolioStats.automationPlaybooks} live playbooks</p>
              <p className="text-xs text-amber-300">{portfolioStats.escalationsQueued} escalations queued</p>
            </div>
          </div>
        </header>

        <section className="rounded-3xl border border-white/5 bg-[#050a1d] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Project Portfolio</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Department-Led Workstreams</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-300">
              <button className="rounded-full border border-white/10 px-3 py-1">Dept</button>
              <button className="rounded-full border border-white/10 px-3 py-1">Priority</button>
              <button className="rounded-full border border-white/10 px-3 py-1">Status</button>
              <button className="rounded-full border border-white/10 px-3 py-1">Owner</button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div key={project.id} className="rounded-2xl border border-white/5 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColor[project.status]}`}>
                    {project.status}
                  </span>
                  <span className={`text-xs font-semibold ${priorityColor[project.priority]}`}>{project.priority}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">{project.name}</h3>
                <p className="mt-1 text-sm text-slate-300">{project.objective}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  {project.departments.map((dept) => (
                    <span key={dept} className="rounded-full bg-white/10 px-3 py-1">
                      {dept}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <span>Owner: {project.owner}</span>
                  <span>{project.approvalStatus}</span>
                </div>
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Budget</p>
                  <div className="mt-1 h-2 w-full rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500"
                      style={{
                        width: `${project.budget.approved > 0 ? (project.budget.spent / project.budget.approved) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-sm text-white">
                    ₦{formatMillions(project.budget.spent)} / ₦{formatMillions(project.budget.approved)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/5 bg-[#050a1d] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Timeline + Dependencies</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Gantt Signal</h2>
              </div>
              <LineChart className="h-5 w-5 text-emerald-200" />
            </div>
            <div className="mt-6 space-y-4">
              {workstreams.map((ws) => (
                <div key={ws.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">{ws.name}</p>
                      <p className="text-xs text-slate-300">
                        {ws.department} • Lead: {ws.lead}
                      </p>
                    </div>
                    <span className="text-xs text-slate-300">
                      {ws.timeline.start} → {ws.timeline.end}
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-sky-300 to-emerald-400"
                      style={{ width: `${ws.progress}%` }}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-300">
                    <span>Progress {ws.progress}%</span>
                    <span className="flex items-center gap-1">
                      <Network className="h-3 w-3" /> Dependencies: {ws.dependencies.length || "Base"}
                    </span>
                    <span>{ws.automation} automation</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-[#050a1d] p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workstream Board</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Department Controls</h2>
              </div>
              <Compass className="h-5 w-5 text-sky-200" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {workstreams.slice(0, 4).map((ws) => (
                <div key={ws.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{ws.name}</p>
                    <span className="text-xs text-slate-300">{ws.department}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Lead: {ws.lead}</p>
                  <p className="mt-2 text-xs text-slate-400">Automation: {ws.automation}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                    <span>{ws.dependencies.length || "No"} dependency</span>
                    <button className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white">
                      Inspect
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-[#050a1d] p-6">
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Task Kanban</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Execution Stream</h2>
                </div>
                <Target className="h-5 w-5 text-rose-200" />
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-4">
                {kanbanColumns.map((status) => {
                  const columnTasks = tasks.filter((task) => task.status === status);
                  return (
                    <div key={status} className="rounded-2xl border border-white/5 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-300">{status}</p>
                      <div className="mt-3 space-y-3">
                        {columnTasks.map((task) => (
                          <div key={task.id} className="rounded-xl border border-white/10 bg-[#0a142b] p-3">
                            <p className="text-sm font-semibold text-white">{task.title}</p>
                            <p className="text-xs text-slate-400">Due {task.dueDate}</p>
                            <p className="mt-1 text-xs text-slate-400">Effort: {task.effortHours}h</p>
                            <p className="mt-1 text-xs text-slate-300">{task.assignedTo || "Unassigned"}</p>
                            <p className="mt-1 text-[10px] text-slate-500">Skills: {task.requiredSkills.join(", ")}</p>
                          </div>
                        ))}
                        {columnTasks.length === 0 && <p className="text-xs text-slate-500">No cards</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-full rounded-3xl border border-white/5 bg-white/5 p-5 lg:w-80">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Smart Assignment</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Suggested Owners</h3>
              <p className="mt-1 text-xs text-slate-400">Blends skills, attendance signals, utilization, performance.</p>
              <div className="mt-4 space-y-4">
                {assignmentSuggestions.length === 0 && (
                  <p className="text-xs text-slate-400">No recommendations available. Assign manually for now.</p>
                )}
                {assignmentSuggestions.map((suggestion) => (
                  <div key={suggestion.employeeId} className="rounded-2xl border border-white/10 bg-[#0a152f] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{suggestion.employeeName}</p>
                        <p className="text-xs text-slate-400">{suggestion.department}</p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-300">{suggestion.fitScore.toFixed(1)}%</span>
                    </div>
                    <div className="mt-3 space-y-2 text-[11px] text-slate-400">
                      <p>Skill match {suggestion.skillMatch}%</p>
                      <p>Availability {suggestion.availability}%</p>
                      <p>Current load {suggestion.currentLoad}%</p>
                      <p>Performance {suggestion.performanceScore}%</p>
                    </div>
                    <button className="mt-3 flex w-full items-center justify-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs text-white">
                      Assign with override log <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/5 bg-[#050a1d] p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Capacity Heatmap</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Utilization Radar</h2>
              </div>
              <BarChart3 className="h-5 w-5 text-amber-200" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {capacitySnapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{snapshot.department}</p>
                    <span className="text-xs text-slate-400">{snapshot.utilization}% util</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-white/10">
                    <div
                      className={`h-2 rounded-full ${snapshot.utilization > 90 ? "bg-rose-400" : "bg-emerald-400"}`}
                      style={{ width: `${snapshot.utilization}%` }}
                    />
                  </div>
                  <div className="mt-3 text-xs text-slate-300">
                    <p>
                      Avail: {snapshot.availableHours}h • Assigned: {snapshot.assignedHours}h
                    </p>
                    {snapshot.underUtilized ? (
                      <p className="text-amber-300">Flag: Underutilized — send rebalancing signal</p>
                    ) : (
                      <p className="text-emerald-300">Healthy utilization</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/5 bg-[#050a1d] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Automation Feed</p>
                <Clock8 className="h-5 w-5 text-slate-200" />
              </div>
              <div className="mt-4 space-y-4">
                {automationAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                    <p className="text-sm font-semibold text-white">{alert.type}</p>
                    <p className="mt-1 text-xs text-slate-300">{alert.message}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                      <span>Owner: {alert.owner}</span>
                      <span>Due {alert.due}</span>
                    </div>
                    <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white">
                      Trigger playbook
                      <Loader2 className="h-3 w-3 animate-spin" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-[#050a1d] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Attendance + Finance Hooks</p>
                <Users className="h-5 w-5 text-emerald-200" />
              </div>
              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">Attendance Signals</p>
                  <p className="mt-1">9 task completions posted to HR attendance feed today.</p>
                  <p className="text-emerald-300">+3 performance boosts awaiting review.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">Finance Sync</p>
                  <p className="mt-1">₦24.5M booked as billable via managed services tasks.</p>
                  <p className="text-amber-300">Budget alerts: Fiber project spends 6% above forecast.</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                <p className="font-semibold text-white">Audit + Overrides</p>
                <p className="mt-1">3 manual overrides logged today. All routed to PMO for sign-off.</p>
                <p className="mt-1 text-rose-300">Ensure overrides reference justification + capacity snapshot.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/5 bg-[#050a1d] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Next Automations</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Work-Intelligent Actions</h2>
            </div>
            <div className="flex gap-2 text-xs text-slate-300">
              <button className="rounded-full border border-white/10 px-3 py-1">Attendance</button>
              <button className="rounded-full border border-white/10 px-3 py-1">Performance</button>
              <button className="rounded-full border border-white/10 px-3 py-1">Finance</button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {["Auto-escalate stalled tasks", "Predict delay risk", "Notify finance of scope delta"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/5 bg-white/5 p-4 text-sm text-slate-200">
                <p className="font-semibold text-white">{item}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Wired into attendance + performance signals to calculate contribution impact and financial exposure.
                </p>
                <button className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-300">
                  Configure playbook <CheckCircle2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
