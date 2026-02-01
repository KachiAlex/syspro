"use client";

import { useEffect } from "react";
import { z } from "zod";
import { useForm } from "@/lib/use-form";
import { useState } from "react";

type Role = {
  id: string;
  name: string;
  scope: "tenant" | "region" | "branch";
  permissions: string[];
  createdAt: string;
};

const PERMISSIONS = [
  "crm.read",
  "crm.write",
  "finance.read",
  "finance.write",
  "people.read",
  "people.write",
  "billing.read",
  "billing.write",
  "all",
];

const roleSchema = z.object({
  name: z.string().min(1, "Role name is required").min(3, "Name must be at least 3 characters"),
  scope: z.enum(["tenant", "region", "branch"]),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});

type RoleFormData = z.infer<typeof roleSchema>;

export default function RoleBuilder({ tenantSlug }: { tenantSlug?: string | null }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const ts = tenantSlug ?? "kreatix-default";

  const form = useForm<RoleFormData>({
    initialValues: {
      name: "",
      scope: "tenant",
      permissions: [],
    },
    schema: roleSchema,
  });

  async function load() {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/tenant/roles?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load roles");
      const payload = await res.json();
      setRoles(Array.isArray(payload.roles) ? payload.roles : []);
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RoleFormData>({
    name: "",
    scope: "tenant",
    permissions: [],
  });

  function startEdit(role: Role) {
    setEditingId(role.id);
    setEditForm({
      name: role.name,
      scope: role.scope,
      permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({
      name: "",
      scope: "tenant",
      permissions: [],
    });
  }

  async function saveEdit(id: string) {
    try {
      const payload = { name: editForm.name.trim(), scope: editForm.scope, permissions: editForm.permissions };
      const res = await fetch(`/api/tenant/roles?id=${encodeURIComponent(id)}&type=role&tenantSlug=${encodeURIComponent(ts)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Update failed");
      cancelEdit();
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  function togglePerm(perm: string) {
    form.setFieldValues({
      permissions: form.values.permissions.includes(perm)
        ? form.values.permissions.filter((p) => p !== perm)
        : [...form.values.permissions, perm],
    });
  }

  function toggleEditPerm(perm: string) {
    setEditForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errors = form.validate();
    if (errors.length > 0) return;

    try {
      const payload = { name: form.values.name.trim(), scope: form.values.scope, permissions: form.values.permissions };
      const res = await fetch(`/api/tenant/roles?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Create failed");
      form.resetForm();
      setServerError(null);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete role?")) return;
    try {
      const res = await fetch(`/api/tenant/roles?id=${encodeURIComponent(id)}&type=role&tenantSlug=${encodeURIComponent(ts)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">People & Access</p>
            <h2 className="text-xl font-semibold text-slate-900">Role builder</h2>
            <p className="mt-1 text-sm text-slate-500">Create roles scoped to tenant/region/branch and assign permission sets.</p>
          </div>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                {...form.getFieldProps("name")}
                placeholder="Role name"
                className={`w-full rounded-lg border px-3 py-2 ${form.errorMap.name ? "border-rose-300" : "border-slate-200"}`}
              />
              {form.errorMap.name && <p className="mt-1 text-xs text-rose-600">{form.errorMap.name}</p>}
            </div>
            <select
              value={form.values.scope}
              onChange={(e) => form.setValue("scope", e.target.value as Role["scope"])}
              className="rounded-lg border px-3 py-2"
            >
              <option value="tenant">Tenant</option>
              <option value="region">Region</option>
              <option value="branch">Branch</option>
            </select>
            <button type="submit" disabled={form.isSubmitting} className="rounded-full bg-slate-900 px-4 py-2 text-white disabled:opacity-50">
              {form.isSubmitting ? "Creating..." : "Create"}
            </button>
          </div>

          <div>
            <p className="text-xs text-slate-500">Permissions</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(PERMISSIONS ?? []).map((perm) => (
                <label key={perm} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.values.permissions.includes(perm)}
                    onChange={() => togglePerm(perm)}
                  />
                  <span className="text-slate-700">{perm}</span>
                </label>
              ))}
            </div>
            {form.errorMap.permissions && <p className="mt-1 text-xs text-rose-600">{form.errorMap.permissions}</p>}
          </div>

          {serverError && <div className="text-sm text-rose-600">{serverError}</div>}
        </form>

        <div className="mt-6">
          {loading ? (
            <div className="text-sm text-slate-500">Loading roles…</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Scope</th>
                  <th className="pb-2">Permissions</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(roles ?? []).map((r) => (
                  editingId === r.id ? (
                    <tr key={r.id} className="border-t border-slate-100 bg-slate-50">
                      <td className="py-3">
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="rounded-lg border px-2 py-1 w-full"
                        />
                      </td>
                      <td>
                        <select
                          value={editForm.scope}
                          onChange={(e) => setEditForm({ ...editForm, scope: e.target.value as Role["scope"] })}
                          className="rounded-lg border px-2 py-1"
                        >
                          <option value="tenant">Tenant</option>
                          <option value="region">Region</option>
                          <option value="branch">Branch</option>
                        </select>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {(PERMISSIONS ?? []).map((perm) => (
                            <label key={perm} className="inline-flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={editForm.permissions.includes(perm)}
                                onChange={() => toggleEditPerm(perm)}
                              />
                              <span className="text-slate-700">{perm}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="flex gap-2 py-2">
                        <button onClick={() => saveEdit(r.id)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white">Save</button>
                        <button onClick={cancelEdit} className="rounded-full border px-3 py-1 text-xs">Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-3 font-semibold text-slate-900">{r.name}</td>
                      <td>{r.scope}</td>
                      <td>{r.permissions.join(", ")}</td>
                      <td className="flex gap-2">
                        <button onClick={() => startEdit(r)} className="rounded-full border border-slate-200 px-3 py-1 text-xs">Edit</button>
                        <button onClick={() => handleDelete(r.id)} className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700">Delete</button>
                      </td>
                    </tr>
                  )
                ))}
                {(roles ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-slate-500">No roles yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">RBAC matrix (preview)</p>
        <p className="mt-2 text-sm text-slate-500">Permission matrix placeholder — expand with role/permission mapping UI as next step.</p>
      </div>
    </div>
  );
}
