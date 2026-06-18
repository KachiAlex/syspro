"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "@/lib/use-form";
import { TextInput, SelectInput, FormButton, FormAlert } from "@/components/form";
import { usePermissions, useCanAction } from "@/hooks/use-permissions";
import { 
  Play, 
  Pause, 
  Square, 
  Settings, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Activity,
  FileText,
  Zap,
  GitBranch,
  Timer,
  Calendar,
  User,
  Building,
  Target,
  ArrowRight,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Download
} from "lucide-react";

type Workflow = {
  id: string;
  name: string;
  type: "onboarding" | "transfer" | "promotion" | "exit" | "approval" | "notification" | "automation";
  steps: { step: number; title: string; assignee?: string; daysAfter?: number; status?: "pending" | "completed" | "failed" }[];
  status: "active" | "paused" | "draft";
  createdAt: string;
  lastRun?: string;
  nextRun?: string;
  executionCount?: number;
  successRate?: number;
};

const WORKFLOW_TYPES = [
  { value: "onboarding", label: "Employee Onboarding", icon: Users, description: "New hire onboarding process" },
  { value: "transfer", label: "Department Transfer", icon: ArrowRight, description: "Employee transfer workflow" },
  { value: "promotion", label: "Promotion Process", icon: TrendingUp, description: "Employee promotion workflow" },
  { value: "exit", label: "Employee Exit", icon: Square, description: "Employee offboarding process" },
  { value: "approval", label: "Approval Chain", icon: CheckCircle, description: "Multi-level approval process" },
  { value: "notification", label: "Notification Flow", icon: AlertCircle, description: "Automated notifications" },
  { value: "automation", label: "Business Automation", icon: Zap, description: "Custom business process" }
] as const;

const workflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required").min(3, "Name must be at least 3 characters"),
  type: z.enum(["onboarding", "transfer", "promotion", "exit", "approval", "notification", "automation"]),
});

type WorkflowFormData = z.infer<typeof workflowSchema>;

export default function LifecycleWorkflows({ tenantSlug }: { tenantSlug?: string | null }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [steps, setSteps] = useState<{ title: string; assignee?: string; daysAfter?: number }[]>([{ title: "", assignee: "", daysAfter: 0 }]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSteps, setEditSteps] = useState<Workflow["steps"]>([]);
  const ts = tenantSlug ;
  
  // Get user permissions
  const permissions = usePermissions();
  const { canCreate, canEdit, canDelete } = useCanAction(permissions, "automation");

  const form = useForm<WorkflowFormData>({
    initialValues: {
      name: "",
      type: "onboarding",
    },
    schema: workflowSchema,
  });

  async function load() {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/tenant/workflows?tenantSlug=${encodeURIComponent(ts ?? '')}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load workflows");
      const payload = await res.json();
      setWorkflows(Array.isArray(payload.workflows) ? payload.workflows : []);
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  function updateStep(idx: number, field: string, value: string | number) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, { title: "", assignee: "", daysAfter: 0 }]);
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateEditStep(idx: number, field: string, value: string | number) {
    setEditSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function addEditStep() {
    setEditSteps((prev) => [...prev, { step: prev.length + 1, title: "", assignee: "", daysAfter: 0 }]);
  }

  function removeEditStep(idx: number) {
    setEditSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errors = form.validate();
    if (errors.length > 0) return;

    try {
      const payload = {
        name: form.values.name.trim(),
        type: form.values.type,
        steps: steps.map((s, i) => ({ step: i + 1, title: s.title, assignee: s.assignee || undefined, daysAfter: s.daysAfter })),
      };
      const res = await fetch(`/api/tenant/workflows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Create failed");
      form.resetForm();
      setSteps([{ title: "", assignee: "", daysAfter: 0 }]);
      setSuccessMessage("Workflow created successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  function startEdit(wf: Workflow) {
    setEditingId(wf.id);
    setEditName(wf.name);
    setEditSteps([...wf.steps]);
  }

  async function saveEdit(id: string) {
    try {
      const payload = { name: editName.trim(), steps: editSteps };
      const res = await fetch(`/api/tenant/workflows/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Update failed");
      setEditingId(null);
      setSuccessMessage("Workflow updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditSteps([]);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete workflow? This action cannot be undone.")) return;
    try {
      const res = await fetch(`/api/tenant/workflows/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSuccessMessage("Workflow deleted successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  async function toggleWorkflowStatus(id: string, status: "active" | "paused") {
    try {
      const res = await fetch(`/api/tenant/workflows/${encodeURIComponent(id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Status update failed");
      setSuccessMessage(`Workflow ${status === "active" ? "activated" : "paused"} successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  async function duplicateWorkflow(id: string) {
    try {
      const res = await fetch(`/api/tenant/workflows/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Duplication failed");
      setSuccessMessage("Workflow duplicated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  // Mock analytics data
  const workflowAnalytics = {
    totalWorkflows: workflows.length,
    activeWorkflows: workflows.filter(w => w.status === "active").length,
    totalExecutions: workflows.reduce((sum, w) => sum + (w.executionCount || 0), 0),
    averageSuccessRate: workflows.length > 0 
      ? workflows.reduce((sum, w) => sum + (w.successRate || 0), 0) / workflows.length 
      : 0,
    recentExecutions: [
      { workflow: "New Hire Onboarding", status: "completed", duration: "2h 15m", timestamp: "2 hours ago" },
      { workflow: "Purchase Approval", status: "completed", duration: "45m", timestamp: "3 hours ago" },
      { workflow: "Employee Exit", status: "failed", duration: "1h 30m", timestamp: "5 hours ago" },
      { workflow: "Department Transfer", status: "completed", duration: "1h", timestamp: "6 hours ago" }
    ]
  };

  return (
    <div className="space-y-6">
      {serverError && (
        <FormAlert
          type="error"
          title="Error"
          message={serverError}
          onClose={() => setServerError(null)}
        />
      )}
      {successMessage && (
        <FormAlert
          type="success"
          title="Success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Workflow Analytics Dashboard */}
      <div className="rounded-3xl border border-slate-100 bg-theme-muted p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Dashboard</p>
            <h2 className="text-lg font-semibold text-gray-900">Workflow Analytics</h2>
            <p className="mt-1 text-sm text-slate-600">Monitor workflow performance and execution metrics</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAnalytics(!showAnalytics)}
              className="whitespace-nowrap rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Activity className="w-4 h-4 mr-2 inline" />
              {showAnalytics ? "Hide" : "Show"} Analytics
            </button>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <FileText className="w-4 h-4 mr-2 inline" />
              {showTemplates ? "Hide" : "Show"} Templates
            </button>
          </div>
        </div>

        {showAnalytics && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Workflows</p>
                  <p className="text-2xl font-bold text-gray-900">{workflowAnalytics.totalWorkflows}</p>
                </div>
                <GitBranch className="w-8 h-8 text-blue-600 opacity-20" />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Active Workflows</p>
                  <p className="text-2xl font-bold text-gray-900">{workflowAnalytics.activeWorkflows}</p>
                </div>
                <Play className="w-8 h-8 text-green-600 opacity-20" />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Executions</p>
                  <p className="text-2xl font-bold text-gray-900">{workflowAnalytics.totalExecutions}</p>
                </div>
                <Timer className="w-8 h-8 text-purple-600 opacity-20" />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{workflowAnalytics.averageSuccessRate.toFixed(1)}%</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600 opacity-20" />
              </div>
            </div>
          </div>
        )}

        {showAnalytics && (
          <div className="mt-6">
            <h3 className="text-md font-semibold text-gray-900 mb-3">Recent Executions</h3>
            <div className="space-y-2">
              {workflowAnalytics.recentExecutions.map((execution, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      execution.status === "completed" ? "bg-green-500" : "bg-red-500"
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{execution.workflow}</p>
                      <p className="text-sm text-slate-600">{execution.timestamp}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-600">{execution.duration}</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      execution.status === "completed" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {execution.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Workflow Templates */}
      {showTemplates && (
        <div className="rounded-3xl border border-slate-100 bg-theme-muted p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Templates</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {WORKFLOW_TYPES.map((type) => (
              <div key={type.value} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <type.icon className="w-6 h-6 text-blue-600" />
                  <div>
                    <h4 className="font-medium text-gray-900">{type.label}</h4>
                    <p className="text-sm text-slate-600">{type.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    form.setValue("type", type.value as any);
                    setShowTemplates(false);
                  }}
                  className="w-full rounded-lg border border-blue-200 text-blue-700 px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                >
                  Use Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Workflow */}
      <div className="rounded-3xl border border-slate-100 bg-theme-muted p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <h2 className="text-xl font-semibold text-gray-900">Create Workflow</h2>
            <p className="mt-1 text-sm text-slate-500">Design custom workflows for your business processes</p>
          </div>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Workflow Name"
              placeholder="e.g., New Hire Onboarding"
              required
              {...form.getFieldProps("name")}
              error={form.errorMap.name}
            />
            <SelectInput
              label="Workflow Type"
              value={form.values.type}
              onChange={(e) => form.setValue("type", e.target.value as Workflow["type"])}
              options={WORKFLOW_TYPES.map(t => ({ value: t.value, label: t.label }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Workflow Steps</label>
            <div className="space-y-2">
              {(steps ?? []).map((s, idx) => (
                <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                  <div className="w-8 text-sm font-medium text-slate-600">#{idx + 1}</div>
                  <input
                    value={s.title}
                    onChange={(e) => updateStep(idx, "title", e.target.value)}
                    placeholder="Step title"
                    className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex-1 text-sm"
                  />
                  <input
                    value={s.assignee}
                    onChange={(e) => updateStep(idx, "assignee", e.target.value)}
                    placeholder="Assignee"
                    className="bg-white w-32 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={s.daysAfter ?? 0}
                    onChange={(e) => updateStep(idx, "daysAfter", Number(e.target.value))}
                    placeholder="Days"
                    className="bg-white w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeStep(idx)}
                    className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addStep}
                className="rounded-full border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                + Add step
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <FormButton 
              type="submit" 
              loading={form.isSubmitting}
              disabled={!canCreate || permissions.loading}
              title={!canCreate ? "You don't have permission to create workflows" : undefined}
            >
              <Zap className="w-4 h-4 mr-2 inline" />
              Create workflow
            </FormButton>
          </div>
        </form>
      </div>

      {/* Active Workflows */}
      <div className="rounded-3xl border border-slate-100 bg-theme-muted p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Active Workflows</p>
            <h2 className="text-lg font-semibold text-gray-900">Workflow Management</h2>
            <p className="mt-1 text-sm text-slate-600">Monitor and manage your automated workflows</p>
          </div>
        </div>
        
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="text-sm text-slate-500">Loading workflows…</div>
          ) : (workflows ?? []).length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No workflows defined yet.</p>
              <p className="text-xs text-slate-400 mt-1">Create your first workflow to get started</p>
            </div>
          ) : (
            workflows.map((wf) => (
              <div key={wf.id} className={`rounded-2xl border px-4 py-4 ${editingId === wf.id ? "bg-slate-50" : ""}`}>
                {editingId === wf.id ? (
                  <div className="space-y-3">
                    <input 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      className="bg-white rounded-lg border px-3 py-2 w-full text-black" 
                    />
                    <div className="space-y-2">
                      {(editSteps ?? []).map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-8 text-sm text-slate-600">Step {idx + 1}</div>
                          <input 
                            value={s.title} 
                            onChange={(e) => updateEditStep(idx, "title", e.target.value)} 
                            className="bg-white rounded-lg border px-3 py-2 flex-1 text-black" 
                          />
                          <input 
                            value={s.assignee ?? ""} 
                            onChange={(e) => updateEditStep(idx, "assignee", e.target.value)} 
                            className="bg-white w-32 rounded-lg border px-2 py-2 text-black" 
                          />
                          <input 
                            type="number" 
                            value={s.daysAfter ?? 0} 
                            onChange={(e) => updateEditStep(idx, "daysAfter", Number(e.target.value))} 
                            className="bg-white w-20 rounded-lg border px-2 py-2 text-black" 
                          />
                          <button 
                            type="button" 
                            onClick={() => removeEditStep(idx)} 
                            className="rounded-full border px-3 py-1 text-xs text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button" 
                        onClick={addEditStep} 
                        className="rounded-full border px-3 py-1 text-sm"
                      >
                        Add step
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => saveEdit(wf.id)} 
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white"
                      >
                        Save
                      </button>
                      <button 
                        onClick={cancelEdit} 
                        className="rounded-full border px-3 py-1 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          wf.status === "active" ? "bg-green-500" : 
                          wf.status === "paused" ? "bg-yellow-500" : "bg-gray-500"
                        }`}></div>
                        <div>
                          <p className="font-semibold text-gray-900">{wf.name}</p>
                          <p className="text-xs text-slate-500 capitalize">{wf.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          wf.status === "active" ? "bg-green-100 text-green-800" :
                          wf.status === "paused" ? "bg-yellow-100 text-yellow-800" :
                          "bg-gray-100 text-gray-900"
                        }`}>
                          {wf.status}
                        </span>
                        <div className="flex gap-1">
                          {wf.status === "active" ? (
                            <button
                              onClick={() => toggleWorkflowStatus(wf.id, "paused")}
                              className="p-1 rounded hover:bg-slate-100"
                              title="Pause workflow"
                            >
                              <Pause className="w-4 h-4 text-slate-600" />
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleWorkflowStatus(wf.id, "active")}
                              className="p-1 rounded hover:bg-slate-100"
                              title="Activate workflow"
                            >
                              <Play className="w-4 h-4 text-slate-600" />
                            </button>
                          )}
                          <button
                            onClick={() => duplicateWorkflow(wf.id)}
                            className="p-1 rounded hover:bg-slate-100"
                            title="Duplicate workflow"
                          >
                            <Copy className="w-4 h-4 text-slate-600" />
                          </button>
                          <button 
                            onClick={() => startEdit(wf)} 
                            disabled={!canEdit || permissions.loading}
                            className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!canEdit ? "You don't have permission to edit workflows" : "Edit workflow"}
                          >
                            <Edit className="w-4 h-4 text-slate-600" />
                          </button>
                          <button 
                            onClick={() => handleDelete(wf.id)} 
                            disabled={!canDelete || permissions.loading}
                            className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!canDelete ? "You don't have permission to delete workflows" : "Delete workflow"}
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-600">Steps</p>
                        <p className="font-medium text-gray-900">{wf.steps.length} steps</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Executions</p>
                        <p className="font-medium text-gray-900">{wf.executionCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-slate-600">Success Rate</p>
                        <p className="font-medium text-gray-900">{wf.successRate || 0}%</p>
                      </div>
                    </div>
                    
                    <div className="mt-3 space-y-1 text-sm text-slate-600">
                      {wf.steps.map((s) => (
                        <div key={s.step} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              s.status === "completed" ? "bg-green-500" :
                              s.status === "failed" ? "bg-red-500" : "bg-gray-400"
                            }`}></div>
                            <span>{s.step}. {s.title}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {s.assignee && `${s.assignee} · `}
                            Day {s.daysAfter ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
