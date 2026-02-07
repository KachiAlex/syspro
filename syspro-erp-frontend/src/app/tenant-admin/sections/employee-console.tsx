"use client";

import { useEffect, useState } from "react";
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
  const ts = tenantSlug ?? "kreatix-default";
  
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

  async function load() {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load employees");
      const payload = await res.json();
      setEmployees(Array.isArray(payload.employees) ? payload.employees : []);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errors = form.validate();
    if (errors.length > 0) return;

    try {
      const payload = { name: form.values.name.trim(), email: form.values.email.trim(), department: form.values.department || undefined, branch: form.values.branch || undefined, region: form.values.region || undefined };
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts)}`, {
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
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts)}&id=${encodeURIComponent(id)}`, {
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
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">People & Access</p>
            <h2 className="text-xl font-semibold text-slate-900">Employee assignment console</h2>
            <p className="mt-1 text-sm text-slate-500">Manage employee records and assign to departments, branches, and regions.</p>
          </div>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <input
                {...form.getFieldProps("name")}
                placeholder="Full name"
                className={`w-full rounded-lg border px-3 py-2 ${form.errorMap.name ? "border-rose-300" : "border-slate-200"}`}
              />
              {form.errorMap.name && <p className="mt-1 text-xs text-rose-600">{form.errorMap.name}</p>}
            </div>
            <div>
              <input
                {...form.getFieldProps("email")}
                placeholder="Email"
                type="email"
                className={`w-full rounded-lg border px-3 py-2 ${form.errorMap.email ? "border-rose-300" : "border-slate-200"}`}
              />
              {form.errorMap.email && <p className="mt-1 text-xs text-rose-600">{form.errorMap.email}</p>}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <input
              value={form.values.department}
              onChange={(e) => form.setValue("department", e.target.value)}
              placeholder="Department"
              className="rounded-lg border px-3 py-2"
            />
            <input
              value={form.values.branch}
              onChange={(e) => form.setValue("branch", e.target.value)}
              placeholder="Branch"
              className="rounded-lg border px-3 py-2"
            />
            <input
              value={form.values.region}
              onChange={(e) => form.setValue("region", e.target.value)}
              placeholder="Region"
              className="rounded-lg border px-3 py-2"
            />
          </div>
          <button 
            type="submit" 
            disabled={form.isSubmitting || !canCreate || permissions.loading} 
            className="rounded-full bg-slate-900 px-4 py-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canCreate ? "You don't have permission to create employees" : undefined}
          >
            {form.isSubmitting ? "Adding..." : "Add employee"}
          </button>

          {serverError && <div className="text-sm text-rose-600">{serverError}</div>}
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Employee roster</p>
        <div className="mt-4 overflow-auto">
          {loading ? (
            <div className="text-sm text-slate-500">Loading employees…</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-400">
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
                    <tr key={emp.id} className="border-t border-slate-100 bg-slate-50">
                      <td className="py-3 font-semibold">{emp.name}</td>
                      <td>{emp.email}</td>
                      <td>
                        <input
                          value={editForm.department}
                          onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                          className="rounded-lg border px-2 py-1 w-full"
                        />
                      </td>
                      <td>
                        <input
                          value={editForm.branch}
                          onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                          className="rounded-lg border px-2 py-1 w-full"
                        />
                      </td>
                      <td>
                        <input
                          value={editForm.region}
                          onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                          className="rounded-lg border px-2 py-1 w-full"
                        />
                      </td>
                      <td className="text-xs">{emp.status}</td>
                      <td className="flex gap-2">
                        <button onClick={() => saveEdit(emp.id)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white">Save</button>
                        <button onClick={cancelEdit} className="rounded-full border px-3 py-1 text-xs">Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={emp.id} className="border-t border-slate-100">
                      <td className="py-3 font-semibold text-slate-900">{emp.name}</td>
                      <td>{emp.email}</td>
                      <td>{emp.department ?? "—"}</td>
                      <td>{emp.branch ?? "—"}</td>
                      <td>{emp.region ?? "—"}</td>
                      <td>
                        <span className={`text-xs font-semibold rounded-full px-2 py-1 ${emp.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>{emp.status}</span>
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
                    <td colSpan={7} className="py-4 text-sm text-slate-500">No employees yet.</td>
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
