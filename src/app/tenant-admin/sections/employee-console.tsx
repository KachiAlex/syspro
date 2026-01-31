"use client";

import { useEffect, useState } from "react";

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

export default function EmployeeConsole({ tenantSlug }: { tenantSlug?: string | null }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [branch, setBranch] = useState("");
  const [region, setRegion] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDept, setEditDept] = useState("");
  const [editBranch, setEditBranch] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load employees");
      const payload = await res.json();
      setEmployees(Array.isArray(payload.employees) ? payload.employees : []);
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    try {
      const payload = { name: name.trim(), email: email.trim(), department: department || undefined, branch: branch || undefined, region: region || undefined };
      const res = await fetch(`/api/tenant/employees?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Create failed");
      }
      setName("");
      setEmail("");
      setDepartment("");
      setBranch("");
      setRegion("");
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id);
    setEditDept(emp.department ?? "");
    setEditBranch(emp.branch ?? "");
    setEditRegion(emp.region ?? "");
  }

  async function saveEdit(id: string) {
    try {
      const payload = { department: editDept || undefined, branch: editBranch || undefined, region: editRegion || undefined };
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
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDept("");
    setEditBranch("");
    setEditRegion("");
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
      setError(err instanceof Error ? err.message : String(err));
    }
  }

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
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="rounded-lg border px-3 py-2" required />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="rounded-lg border px-3 py-2" required />
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department" className="rounded-lg border px-3 py-2" />
            <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Branch" className="rounded-lg border px-3 py-2" />
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Region" className="rounded-lg border px-3 py-2" />
          </div>
          <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-white">Add employee</button>

          {error && <div className="text-sm text-rose-600">{error}</div>}
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
                {employees.map((emp) => (
                  editingId === emp.id ? (
                    <tr key={emp.id} className="border-t border-slate-100 bg-slate-50">
                      <td className="py-3 font-semibold">{emp.name}</td>
                      <td>{emp.email}</td>
                      <td>
                        <input value={editDept} onChange={(e) => setEditDept(e.target.value)} className="rounded-lg border px-2 py-1 w-full" />
                      </td>
                      <td>
                        <input value={editBranch} onChange={(e) => setEditBranch(e.target.value)} className="rounded-lg border px-2 py-1 w-full" />
                      </td>
                      <td>
                        <input value={editRegion} onChange={(e) => setEditRegion(e.target.value)} className="rounded-lg border px-2 py-1 w-full" />
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
                        <button onClick={() => startEdit(emp)} className="rounded-full border px-3 py-1 text-xs">Edit</button>
                        <button onClick={() => handleDelete(emp.id)} className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700">Delete</button>
                      </td>
                    </tr>
                  )
                ))}
                {employees.length === 0 && (
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
