"use client";

import { useEffect, useState } from "react";

type Approval = {
  id: string;
  name: string;
  steps: { step: number; owners: string[]; slaHours?: number }[];
  createdAt: string;
};

export default function ApprovalDesigner({ tenantSlug }: { tenantSlug?: string | null }) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [steps, setSteps] = useState<{ owners: string; slaHours?: number }[]>([{ owners: "", slaHours: 4 }]);
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/approvals?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApprovals([]);
        setError(payload?.error ?? "Failed to load approvals");
        return;
      }
      setApprovals(Array.isArray(payload.approvals) ? payload.approvals : []);
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

  function updateStep(idx: number, field: string, value: string | number) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function addStep() {
    setSteps((prev) => [...prev, { owners: "", slaHours: 4 }]);
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const payload = {
        name: name.trim(),
        steps: steps.map((s, i) => ({ step: i + 1, owners: s.owners.split(/[,;|]/).map((o) => o.trim()).filter(Boolean), slaHours: s.slaHours })),
      };
      const res = await fetch(`/api/tenant/approvals?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const errData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errData?.error || "Create failed");
      setName("");
      setSteps([{ owners: "", slaHours: 4 }]);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete approval route?")) return;
    try {
      const res = await fetch(`/api/tenant/approvals?tenantSlug=${encodeURIComponent(ts)}&id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const errData = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errData?.error || "Delete failed");
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Approvals</p>
            <h2 className="text-xl font-semibold text-slate-900">Approval flow designer</h2>
            <p className="mt-1 text-sm text-slate-500">Define multi-step approval routes with owners and SLAs.</p>
          </div>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="flex items-center gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Route name" className="rounded-lg border px-3 py-2 w-full" />
            <button type="submit" className="rounded-full bg-slate-900 px-4 py-2 text-white">Create</button>
          </div>

          <div className="space-y-2">
            {(steps ?? []).map((s, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-8 text-sm text-slate-600">Step {idx + 1}</div>
                <input value={s.owners} onChange={(e) => updateStep(idx, "owners", e.target.value)} placeholder="Owners (comma-separated)" className="rounded-lg border px-3 py-2 flex-1" />
                <input type="number" value={s.slaHours} onChange={(e) => updateStep(idx, "slaHours", Number(e.target.value))} className="w-28 rounded-lg border px-2 py-2" />
                <button type="button" onClick={() => removeStep(idx)} className="rounded-full border px-3 py-1 text-xs text-rose-700">Remove</button>
              </div>
            ))}
            <button type="button" onClick={addStep} className="rounded-full border px-3 py-1 text-sm">Add step</button>
          </div>

          {error && <div className="text-sm text-rose-600">{error}</div>}
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Existing routes</p>
        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-sm text-slate-500">Loading routes…</div>
          ) : (approvals ?? []).length === 0 ? (
            <div className="text-sm text-slate-500">No routes defined.</div>
          ) : (
            approvals.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{a.name}</p>
                    <p className="text-xs text-slate-500">Created {new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDelete(a.id)} className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700">Delete</button>
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  {(Array.isArray(a.steps) ? a.steps : []).map((s) => (
                    <div key={s.step} className="flex items-center justify-between">
                      <div>Step {s.step} · {Array.isArray(s.owners) ? s.owners.join(", ") : String(s.owners ?? "")}</div>
                      <div className="text-xs text-slate-500">SLA {s.slaHours ?? "—"}h</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
