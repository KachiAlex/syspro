"use client";

import { useEffect, useState } from "react";

type AccessControl = {
  id: string;
  roleId: string;
  roleName: string;
  moduleAccess: { module: string; read: boolean; write: boolean; admin: boolean }[];
  tempGrants?: { grantId: string; module: string; expiresAt: string }[];
  createdAt: string;
};

const MODULES = ["crm", "finance", "people", "projects", "billing", "integrations"];

export default function AccessControlPanel({ tenantSlug }: { tenantSlug?: string | null }) {
  const [accessControls, setAccessControls] = useState<AccessControl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roleName, setRoleName] = useState("");
  const [selectedModules, setSelectedModules] = useState<{ module: string; read: boolean; write: boolean; admin: boolean }[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editModules, setEditModules] = useState<AccessControl["moduleAccess"]>([]);
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/access-control?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load access controls");
      const payload = await res.json();
      setAccessControls(Array.isArray(payload.accessControls) ? payload.accessControls : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
    if (!roleName.trim()) return;
    try {
      const payload = { roleName: roleName.trim(), moduleAccess: selectedModules };
      const res = await fetch(`/api/tenant/access-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Create failed");
      setRoleName("");
      setSelectedModules([]);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
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
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
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
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
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
          <div>
            <input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Role name" className="rounded-lg border px-3 py-2 w-full" required />
          </div>

          <div>
            <p className="mb-2 text-xs text-slate-500">Module permissions</p>
            <div className="grid gap-3 md:grid-cols-2">
              {MODULES.map((mod) => {
                const selected = selectedModules.find((m) => m.module === mod);
                return (
                  <div key={mod} className="rounded-lg border px-3 py-2">
                    <p className="mb-2 text-sm font-semibold text-slate-700">{mod}</p>
                    <div className="flex gap-3">
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={selected?.read ?? false} onChange={() => toggleModulePermission(mod, "read")} />
                        <span>Read</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={selected?.write ?? false} onChange={() => toggleModulePermission(mod, "write")} />
                        <span>Write</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input type="checkbox" checked={selected?.admin ?? false} onChange={() => toggleModulePermission(mod, "admin")} />
                        <span>Admin</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-white">Create access control</button>

          {error && <div className="text-sm text-rose-600">{error}</div>}
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Role access matrix</p>
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="text-sm text-slate-500">Loading access controls…</div>
          ) : accessControls.length === 0 ? (
            <div className="text-sm text-slate-500">No access controls defined.</div>
          ) : (
            accessControls.map((ac) => (
              <div key={ac.id} className={`rounded-2xl border px-4 py-3 ${editingId === ac.id ? "bg-slate-50" : ""}`}>
                {editingId === ac.id ? (
                  <div className="space-y-3">
                    <p className="font-semibold text-slate-900">{ac.roleName}</p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {MODULES.map((mod) => {
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
