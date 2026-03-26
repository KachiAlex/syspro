"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCcw, UploadCloud } from "lucide-react";

type Policy = {
  id: string;
  key: string;
  name: string;
  category?: string;
  status: string;
  versions?: Array<{ id: string; version: number; effectiveAt?: string; createdAt?: string; document: any }>;
};

export default function PoliciesSection({ tenantSlug }: { tenantSlug: string }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ key: "", name: "", category: "", document: '{"rules": []}' });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/policies?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      if (!res.ok) throw new Error("Unable to load policies");
      const json = await res.json();
      setPolicies(json.policies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantSlug]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const document = JSON.parse(form.document || "{}");
      const res = await fetch(`/api/policies?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: form.key, name: form.name, category: form.category, document }),
      });
      if (!res.ok) throw new Error("Create failed");
      setForm({ key: "", name: "", category: form.category, document: form.document });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function publish(policy: Policy) {
    setSaving(true);
    try {
      const res = await fetch(`/api/policies/${policy.id}?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) throw new Error("Publish failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Policies</p>
            <h2 className="text-xl font-semibold text-slate-900">Central rules</h2>
            <p className="mt-1 text-sm text-slate-500">Define attendance, finance, SLA, and approval thresholds with versioning.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" disabled={loading}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>
        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Key</label>
              <input value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="attendance.rules" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Name</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Category</label>
              <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="attendance / finance / sla" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Document (JSON)</label>
            <textarea value={form.document} onChange={(e) => setForm((p) => ({ ...p, document: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" rows={4} />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Create policy
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Catalog</p>
            <h3 className="text-lg font-semibold text-slate-900">Policies</h3>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading policies…</div>
        ) : policies.length === 0 ? (
          <div className="text-sm text-slate-500">No policies yet. Create one above.</div>
        ) : (
          <div className="space-y-3">
            {policies.map((p) => (
              <div key={p.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.key} · {p.category || "Uncategorized"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-medium text-slate-700">{p.status}</span>
                    {p.status !== "published" && (
                      <button onClick={() => publish(p)} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-white">Publish</button>
                    )}
                  </div>
                </div>
                {p.versions && p.versions.length > 0 && (
                  <div className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-700">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">Versions</div>
                    {p.versions.map((v) => (
                      <div key={v.id} className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0">
                        <span>v{v.version}</span>
                        <span className="text-slate-500">{v.effectiveAt || "draft"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
