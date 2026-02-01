"use client";

import { useEffect, useState } from "react";

type Department = {
  id: string;
  name: string;
  scope: "global" | "branch";
  createdAt: string;
};

export default function DepartmentManagement({ tenantSlug }: { tenantSlug?: string | null }) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<Department["scope"]>("global");
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/departments?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load departments");
      const payload = await res.json();
      setDepartments(Array.isArray(payload.departments) ? payload.departments : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const payload = { name: name.trim(), scope };
      const res = await fetch(`/api/tenant/departments?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
       if (!res.ok) {
         const errData = await res.json().catch(() => ({}));
         throw new Error(errData.error || "Create failed");
       }
      setName("");
      setScope("global");
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete department?")) return;
    try {
       const res = await fetch(`/api/tenant/departments?tenantSlug=${encodeURIComponent(ts)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
       if (!res.ok) {
         const errData = await res.json().catch(() => ({}));
         throw new Error(errData.error || "Delete failed");
       }
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Structure</p>
            <h2 className="text-xl font-semibold text-slate-900">Department management</h2>
            <p className="mt-1 text-sm text-slate-500">Create and manage tenant departments (global or branch-scoped).</p>
          </div>
        </div>

        <form className="mt-4 flex items-center gap-3" onSubmit={handleCreate}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Department name" className="rounded-lg border px-3 py-2" />
          <select value={scope} onChange={(e) => setScope(e.target.value as Department["scope"])} className="rounded-lg border px-3 py-2">
            <option value="global">Global</option>
            <option value="branch">Branch</option>
          </select>
          <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-white">Create</button>
        </form>

        {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}

        <div className="mt-6 overflow-auto">
          {loading ? (
            <div className="text-sm text-slate-500">Loading departments…</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="text-xs uppercase tracking-[0.3em] text-slate-400">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Scope</th>
                  <th className="pb-2">Created</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(departments ?? []).map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="py-3 font-semibold text-slate-900">{d.name}</td>
                    <td>{d.scope}</td>
                    <td>{new Date(d.createdAt).toLocaleString()}</td>
                    <td>
                      <button onClick={() => handleDelete(d.id)} className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700">Delete</button>
                    </td>
                  </tr>
                ))}
                {(departments ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-slate-500">No departments yet.</td>
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
