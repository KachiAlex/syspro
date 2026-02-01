"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "@/lib/use-form";
import { TextInput, FormButton, FormAlert } from "@/components/form";

type AccessControl = {
  id: string;
  roleId: string;
  roleName: string;
  moduleAccess: { module: string; read: boolean; write: boolean; admin: boolean }[];
  tempGrants?: { grantId: string; module: string; expiresAt: string }[];
  createdAt: string;
};

const MODULES = ["crm", "finance", "people", "projects", "billing", "integrations"];

const accessControlSchema = z.object({
  roleName: z.string().min(1, "Role name is required").min(2, "Name must be at least 2 characters"),
});

type AccessControlFormData = z.infer<typeof accessControlSchema>;

export default function AccessControlPanel({ tenantSlug }: { tenantSlug?: string | null }) {
  const [accessControls, setAccessControls] = useState<AccessControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedModules, setSelectedModules] = useState<{ module: string; read: boolean; write: boolean; admin: boolean }[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editModules, setEditModules] = useState<AccessControl["moduleAccess"]>([]);
  const ts = tenantSlug ?? "kreatix-default";

  const form = useForm<AccessControlFormData>({
    initialValues: {
      roleName: "",
    },
    schema: accessControlSchema,
  });

  async function load() {
    setLoading(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/tenant/access-control?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load access controls");
      const payload = await res.json();
      setAccessControls(Array.isArray(payload.accessControls) ? payload.accessControls : []);
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

  function toggleModulePermission(module: string, permission: "read" | "write" | "admin") {
    setSelectedModules((prev) => {
      const existing = prev.find((m) => m.module === module);
      if (existing) {
        return prev.map((m) => (m.module === module ? { ...m, [permission]: !m[permission] } : m));
      } else {
        return [...prev, { module, read: permission === "read", write: permission === "write", admin: permission === "admin" }];
      }
    });
  }

  function toggleEditModulePermission(module: string, permission: "read" | "write" | "admin") {
    setEditModules((prev) => {
      const existing = prev.find((m) => m.module === module);
      if (existing) {
        return prev.map((m) => (m.module === module ? { ...m, [permission]: !m[permission] } : m));
      } else {
        return [...prev, { module, read: permission === "read", write: permission === "write", admin: permission === "admin" }];
      }
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const errors = form.validate();
    if (errors.length > 0) return;

    try {
      const payload = { roleName: form.values.roleName.trim(), moduleAccess: selectedModules };
      const res = await fetch(`/api/tenant/access-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Create failed");
      form.resetForm();
      setSelectedModules([]);
      setSuccessMessage("Access control created successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  function startEdit(ac: AccessControl) {
    setEditingId(ac.id);
    setEditModules([...ac.moduleAccess]);
  }

  async function saveEdit(id: string) {
    try {
      const payload = { moduleAccess: editModules };
      const res = await fetch(`/api/tenant/access-control/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Update failed");
      setEditingId(null);
      setSuccessMessage("Access control updated successfully");
      setTimeout(() => setSuccessMessage(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setServerError(err instanceof Error ? err.message : String(err));
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditModules([]);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete access control?")) return;
    try {
      const res = await fetch(`/api/tenant/access-control/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setSuccessMessage("Access control deleted successfully");
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">People & Access</p>
            <h2 className="text-xl font-semibold text-slate-900">Access control panel</h2>
            <p className="mt-1 text-sm text-slate-500">Manage role/module-based access and define permission levels.</p>
          </div>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <TextInput
            label="Role Name"
            placeholder="e.g., Regional Manager"
            required
            {...form.getFieldProps("roleName")}
            error={form.errorMap.roleName}
            hint="Enter the name of the role to configure access"
          />

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-3">Module Permissions</label>
            <div className="grid gap-3 md:grid-cols-2">
              {(MODULES ?? []).map((mod) => {
                const selected = selectedModules.find((m) => m.module === mod);
                return (
                  <div key={mod} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="mb-2 text-sm font-semibold text-slate-900 capitalize">{mod}</p>
                    <div className="flex gap-4">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected?.read ?? false}
                          onChange={() => toggleModulePermission(mod, "read")}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-slate-700">Read</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected?.write ?? false}
                          onChange={() => toggleModulePermission(mod, "write")}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-slate-700">Write</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected?.admin ?? false}
                          onChange={() => toggleModulePermission(mod, "admin")}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-slate-700">Admin</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <FormButton type="submit" loading={form.isSubmitting}>
              Create access control
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
              message={successMessage}
              onClose={() => setSuccessMessage(null)}
            />
          )}
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Role access matrix</p>
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="text-sm text-slate-500">Loading access controls…</div>
          ) : (accessControls ?? []).length === 0 ? (
            <div className="text-sm text-slate-500">No access controls defined.</div>
          ) : (
            accessControls.map((ac) => (
              <div key={ac.id} className={`rounded-2xl border px-4 py-3 ${editingId === ac.id ? "bg-slate-50" : ""}`}>
                {editingId === ac.id ? (
                  <div className="space-y-3">
                    <p className="font-semibold text-slate-900">{ac.roleName}</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {(MODULES ?? []).map((mod) => {
                        const selected = editModules.find((m) => m.module === mod);
                        return (
                          <div key={mod} className="rounded-lg border px-3 py-2">
                            <p className="mb-2 text-sm font-semibold text-slate-700">{mod}</p>
                            <div className="flex gap-3">
                              <label className="inline-flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={selected?.read ?? false} onChange={() => toggleEditModulePermission(mod, "read")} />
                                <span>Read</span>
                              </label>
                              <label className="inline-flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={selected?.write ?? false} onChange={() => toggleEditModulePermission(mod, "write")} />
                                <span>Write</span>
                              </label>
                              <label className="inline-flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={selected?.admin ?? false} onChange={() => toggleEditModulePermission(mod, "admin")} />
                                <span>Admin</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(ac.id)} className="rounded-full bg-emerald-600 px-3 py-1 text-xs text-white">Save</button>
                      <button onClick={cancelEdit} className="rounded-full border px-3 py-1 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-900">{ac.roleName}</p>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(ac)} className="rounded-full border px-3 py-1 text-xs">Edit</button>
                        <button onClick={() => handleDelete(ac.id)} className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700">Delete</button>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                      {ac.moduleAccess.map((ma) => (
                        <div key={ma.module} className="rounded-lg bg-slate-50 px-2 py-1">
                          <span className="font-semibold">{ma.module}:</span> {[ma.read && "Read", ma.write && "Write", ma.admin && "Admin"].filter(Boolean).join(", ")}
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
