"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "@/lib/use-form";
import { TextInput, SelectInput, FormButton, FormAlert } from "@/components/form";
import { usePermissions, useCanAction } from "@/hooks/use-permissions";

type Workflow = {
  id: string;
  name: string;
  type: "onboarding" | "transfer" | "promotion" | "exit";
  steps: { step: number; title: string; assignee?: string; daysAfter?: number }[];
  createdAt: string;
};

const WORKFLOW_TYPES = ["onboarding", "transfer", "promotion", "exit"] as const;

const workflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required").min(3, "Name must be at least 3 characters"),
  type: z.enum(WORKFLOW_TYPES),
});

type WorkflowFormData = z.infer<typeof workflowSchema>;

export default function LifecycleWorkflows({ tenantSlug }: { tenantSlug?: string | null }) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [steps, setSteps] = useState<{ title: string; assignee?: string; daysAfter?: number }[]>([{ title: "", assignee: "", daysAfter: 0 }]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSteps, setEditSteps] = useState<Workflow["steps"]>([]);
  const ts = tenantSlug ?? "kreatix-default";
  
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
      const res = await fetch(`/api/tenant/workflows?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
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
    if (!confirm("Delete workflow?")) return;
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <h2 className="text-xl font-semibold text-slate-900">Lifecycle workflows</h2>
            <p className="mt-1 text-sm text-slate-500">Define onboarding, transfer, promotion, and exit workflows.</p>
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
              options={[
                { value: "onboarding", label: "Onboarding" },
                { value: "transfer", label: "Transfer" },
                { value: "promotion", label: "Promotion" },
                { value: "exit", label: "Exit" },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Workflow Steps</label>
            <div className="space-y-2">
              {(steps ?? []).map((s, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                  <div className="w-8 text-sm font-medium text-slate-600">#{idx + 1}</div>
                  <input
                    value={s.title}
                    onChange={(e) => updateStep(idx, "title", e.target.value)}
                    placeholder="Step title"
                    className="rounded-lg border border-slate-200 px-3 py-2 flex-1 text-sm"
                  />
                  <input
                    value={s.assignee}
                    onChange={(e) => updateStep(idx, "assignee", e.target.value)}
                    placeholder="Assignee"
                    className="w-32 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  />
                  <input
                    type="number"
                    value={s.daysAfter ?? 0}
                    onChange={(e) => updateStep(idx, "daysAfter", Number(e.target.value))}
                    placeholder="Days"
                    className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm"
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
              Create workflow
            </FormButton>
          </div>

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
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workflow templates</p>
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="text-sm text-slate-500">Loading workflows…</div>
          ) : (workflows ?? []).length === 0 ? (
            <div className="text-sm text-slate-500">No workflows defined.</div>
          ) : (
            workflows.map((wf) => (
              <div key={wf.id} className={`rounded-2xl border px-4 py-3 ${editingId === wf.id ? "bg-slate-50" : ""}`}>
                {editingId === wf.id ? (
                  <div className="space-y-3">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-lg border px-3 py-2 w-full" />
                    <div className="space-y-2">
                      {(editSteps ?? []).map((s, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-8 text-sm text-slate-600">Step {idx + 1}</div>
                          <input value={s.title} onChange={(e) => updateEditStep(idx, "title", e.target.value)} className="rounded-lg border px-3 py-2 flex-1" />
                          <input value={s.assignee ?? ""} onChange={(e) => updateEditStep(idx, "assignee", e.target.value)} className="w-32 rounded-lg border px-2 py-2" />
                          <input type="number" value={s.daysAfter ?? 0} onChange={(e) => updateEditStep(idx, "daysAfter", Number(e.target.value))} className="w-20 rounded-lg border px-2 py-2" />
                          <button type="button" onClick={() => removeEditStep(idx)} className="rounded-full border px-3 py-1 text-xs text-rose-700">Remove</button>
                        </div>
                      ))}
                      <button type="button" onClick={addEditStep} className="rounded-full border px-3 py-1 text-sm">Add step</button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(wf.id)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white">Save</button>
                      <button onClick={cancelEdit} className="rounded-full border px-3 py-1 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{wf.name}</p>
                        <p className="text-xs text-slate-500">{wf.type}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => startEdit(wf)} 
                          disabled={!canEdit || permissions.loading}
                          className="rounded-full border px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!canEdit ? "You don't have permission to edit workflows" : undefined}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(wf.id)} 
                          disabled={!canDelete || permissions.loading}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!canDelete ? "You don't have permission to delete workflows" : undefined}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      {wf.steps.map((s) => (
                        <div key={s.step} className="flex items-center justify-between">
                          <span>{s.step}. {s.title}</span>
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
