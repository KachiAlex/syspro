"use client";

import { useEffect, useState } from "react";

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

export default function RoleBuilder({ tenantSlug }: { tenantSlug?: string | null }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Role["scope"]>("tenant");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/roles?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load roles");
      const payload = await res.json();
      setRoles(Array.isArray(payload.roles) ? payload.roles : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editScope, setEditScope] = useState<Role["scope"]>("tenant");
  const [editPerms, setEditPerms] = useState<string[]>([]);

  function startEdit(role: Role) {
    setEditingId(role.id);
    setEditName(role.name);
    setEditScope(role.scope);
    setEditPerms(Array.isArray(role.permissions) ? [...role.permissions] : []);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditScope("tenant");
    setEditPerms([]);
  }

  async function saveEdit(id: string) {
    try {
      const payload = { name: editName.trim(), scope: editScope, permissions: editPerms };
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
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  function togglePerm(perm: string) {
    setSelectedPerms((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const payload = { name: name.trim(), scope, permissions: selectedPerms };
      const res = await fetch(`/api/tenant/roles?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Create failed");
      setName("");
      setScope("tenant");
      setSelectedPerms([]);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
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
      setError(err instanceof Error ? err.message : String(err));
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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name" className="rounded-lg border px-3 py-2" />
            <select value={scope} onChange={(e) => setScope(e.target.value as Role["scope"])} className="rounded-lg border px-3 py-2">
              <option value="tenant">Tenant</option>
              <option value="region">Region</option>
              <option value="branch">Branch</option>
            </select>
            <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-white">Create</button>
          </div>

          <div>
            <p className="text-xs text-slate-500">Permissions</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(PERMISSIONS ?? []).map((perm) => (
                <label key={perm} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedPerms.includes(perm)} onChange={() => togglePerm(perm)} />
                  <span className="text-slate-700">{perm}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <div className="text-sm text-rose-600">{error}</div>}
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
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-lg border px-2 py-1 w-full" />
                      </td>
                      <td>
                        <select value={editScope} onChange={(e) => setEditScope(e.target.value as Role["scope"])} className="rounded-lg border px-2 py-1">
                          <option value="tenant">Tenant</option>
                          <option value="region">Region</option>
                          <option value="branch">Branch</option>
                        </select>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {(PERMISSIONS ?? []).map((perm) => (
                            <label key={perm} className="inline-flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={editPerms.includes(perm)} onChange={() => setEditPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm])} />
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
