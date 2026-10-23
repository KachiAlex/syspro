"use client";

import { useEffect, useState, useCallback } from "react";
import { z } from "zod";
import { useForm } from "@/lib/use-form";
import { usePermissions, useCanAction } from "@/hooks/use-permissions";

type Employee = {
  id: string;
  name: string;
  email: string;
  department?: string;
  branch?: string;
  region?: string;
  status: "active" | "inactive";
  createdAt: string;
};

const employeeSchema = z.object({
  name: z.string().min(1, "Name is required").min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  department: z.string().optional(),
  branch: z.string().optional(),
  region: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export default function EmployeeConsole({ tenantSlug }: { tenantSlug?: string | null }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const ts = tenantSlug ;
  
  // Get user permissions
  const permissions = usePermissions();
  const { canCreate, canEdit, canDelete } = useCanAction(permissions, "people");

  const form = useForm<EmployeeFormData>({
    initialValues: {
      name: "",
      email: "",
      department: "",
      branch: "",
      region: "",
    },
    schema: employeeSchema,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts ?? '')}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load employees");
      const payload = await res.json();
      setEmployees(Array.isArray(payload.employees) ? payload.employees : []);
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ts]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errors = form.validate();
    if (errors.length > 0) return;

    try {
      const payload = { name: form.values.name.trim(), email: form.values.email.trim(), department: form.values.department || undefined, branch: form.values.branch || undefined, region: form.values.region || undefined };
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts ?? '')}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Create failed");
      }
      form.resetForm();
      setServerError(null);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id);
    setEditForm({
      department: emp.department ?? "",
      branch: emp.branch ?? "",
      region: emp.region ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({
      department: "",
      branch: "",
      region: "",
    });
  }

  async function saveEdit(id: string) {
    try {
      const payload = { department: editForm.department || undefined, branch: editForm.branch || undefined, region: editForm.region || undefined };
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts ?? '')}&id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Update failed");
      }
      setEditingId(null);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete employee?")) return;
    try {
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts ?? '')}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Delete failed");
      }
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    department: "",
    branch: "",
    region: "",
  });

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-theme-border bg-theme-muted p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-theme-text-secondary">People & Access</p>
            <h2 className="text-xl font-semibold text-theme-text-primary">Employee assignment console</h2>
            <p className="mt-1 text-sm text-theme-text-tertiary">Manage employee records and assign to departments, branches, and regions.</p>
          </div>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <input
                {...form.getFieldProps("name")}
                placeholder="Full name"
                className={`bg-theme-surface w-full rounded-lg border px-3 py-2 ${form.errorMap.name ? "border-rose-300" : "border-theme-border"} text-theme-text-primary`}
              />
              {form.errorMap.name && <p className="mt-1 text-xs text-rose-600">{form.errorMap.name}</p>}
            </div>
            <div>
              <input
                {...form.getFieldProps("email")}
                placeholder="Email"
                type="email"
                className={`bg-theme-surface w-full rounded-lg border px-3 py-2 ${form.errorMap.email ? "border-rose-300" : "border-theme-border"} text-theme-text-primary`}
              />
              {form.errorMap.email && <p className="mt-1 text-xs text-rose-600">{form.errorMap.email}</p>}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <input
              value={form.values.department}
              onChange={(e) => form.setValue("department", e.target.value)}
              placeholder="Department"
              className="bg-theme-surface rounded-lg border px-3 py-2 text-theme-text-primary"
            />
            <input
              value={form.values.branch}
              onChange={(e) => form.setValue("branch", e.target.value)}
              placeholder="Branch"
              className="bg-theme-surface rounded-lg border px-3 py-2 text-theme-text-primary"
            />
            <input
              value={form.values.region}
              onChange={(e) => form.setValue("region", e.target.value)}
              placeholder="Region"
              className="bg-theme-surface rounded-lg border px-3 py-2 text-theme-text-primary"
            />
          </div>
          <button
            type="submit"
            disabled={form.isSubmitting || !canCreate || permissions.loading}
            className="rounded-full bg-theme-surface px-4 py-2 text-sm font-semibold text-theme-text-primary transition hover:bg-theme-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-border disabled:cursor-not-allowed disabled:opacity-50"
            title={!canCreate ? "You don't have permission to create employees" : undefined}
          >
            {form.isSubmitting ? "Adding..." : "Add employee"}
          </button>

          {serverError && <div className="text-sm text-rose-600">{serverError}</div>}
        </form>
      </div>

      <div className="rounded-3xl border border-theme-border bg-theme-muted p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-theme-text-secondary">Employee roster</p>
        <div className="mt-4 overflow-auto">
          {loading ? (
            <div className="text-sm text-theme-text-tertiary">Loading employees…</div>
          ) : (
            <table className="w-full text-left text-sm text-theme-text-secondary">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-theme-text-secondary">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Department</th>
                  <th className="pb-2">Branch</th>
                  <th className="pb-2">Region</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(employees ?? []).map((emp) => (
                  editingId === emp.id ? (
                    <tr key={emp.id} className="border-t border-theme-border bg-theme-muted">
                      <td className="py-3 font-semibold">{emp.name}</td>
                      <td>{emp.email}</td>
                      <td>
                        <input
                          value={editForm.department}
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                          className="bg-theme-surface rounded-lg border px-2 py-1 w-full text-theme-text-primary"
                        />
                      </td>
                      <td>
                        <input
                          value={editForm.branch}
                          onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                          className="bg-theme-surface rounded-lg border px-2 py-1 w-full text-theme-text-primary"
                        />
                      </td>
                      <td>
                        <input
                          value={editForm.region}
                          onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                          className="bg-theme-surface rounded-lg border px-2 py-1 w-full text-theme-text-primary"
                        />
                      </td>
                      <td className="text-xs">{emp.status}</td>
                      <td className="flex gap-2">
                        <button onClick={() => saveEdit(emp.id)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white">Save</button>
                        <button onClick={cancelEdit} className="rounded-full border px-3 py-1 text-xs">Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={emp.id} className="border-t border-theme-border">
                      <td className="py-3 font-semibold text-theme-text-primary">{emp.name}</td>
                      <td>{emp.email}</td>
                      <td>{emp.department ?? "—"}</td>
                      <td>{emp.branch ?? "—"}</td>
                      <td>{emp.region ?? "—"}</td>
                      <td>
                        <span className={`text-xs font-semibold rounded-full px-2 py-1 ${emp.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-theme-muted text-theme-text-secondary"}`}>{emp.status}</span>
                      </td>
                      <td className="flex gap-2">
                        <button 
                          onClick={() => startEdit(emp)} 
                          disabled={!canEdit || permissions.loading}
                          className="rounded-full border px-3 py-1 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!canEdit ? "You don't have permission to edit employees" : undefined}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(emp.id)} 
                          disabled={!canDelete || permissions.loading}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          title={!canDelete ? "You don't have permission to delete employees" : undefined}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                ))}
                {(employees ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-4 text-sm text-theme-text-tertiary">No employees yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
