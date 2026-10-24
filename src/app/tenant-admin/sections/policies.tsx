"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCcw, UploadCloud } from "lucide-react";
import { KvEditor, rowsToObject, type KvRow } from "@/app/tenant-admin/components/kv-editor";

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
  const [form, setForm] = useState({ key: "", name: "", category: "" });
  const [docRows, setDocRows] = useState<KvRow[]>([{ key: "rules", value: "[]" }]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/policies?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}`);
      if (!res.ok) throw new Error("Unable to load policies");
      const json = await res.json();
      setPolicies(json.policies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const document = rowsToObject(docRows);
      const res = await fetch(`/api/policies?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: form.key, name: form.name, category: form.category, document }),
      });
      if (!res.ok) throw new Error("Create failed");
      setForm({ key: "", name: "", category: form.category });
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
      const res = await fetch(`/api/policies/${policy.id}?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}`, {
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
      <div className="rounded-3xl border border-theme-border bg-theme-muted p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-theme-text-secondary">Policies</p>
            <h2 className="text-xl font-semibold text-theme-text-primary">Central rules</h2>
            <p className="mt-1 text-sm text-theme-text-tertiary">Define attendance, finance, SLA, and approval thresholds with versioning.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-full border border-theme-border px-3 py-2 text-sm text-theme-text-primary hover:bg-theme-muted" disabled={loading}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>
        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Key</label>
              <input value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} required className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm" placeholder="attendance.rules" />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Name</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Category</label>
              <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="bg-theme-surface w-full rounded-lg border border-theme-border px-3 py-2 text-sm" placeholder="attendance / finance / sla" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">Document entries</label>
            <div className="rounded-lg border border-theme-border bg-theme-surface p-3">
              <KvEditor
                rows={docRows}
                onChange={setDocRows}
                hint='list values go in brackets, e.g. rules → [{ "type": "max" }]'
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-theme-surface px-4 py-2 text-sm font-medium text-theme-text-primary shadow-sm hover:bg-theme-muted">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} Create policy
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-theme-border bg-theme-muted p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-theme-text-secondary">Catalog</p>
            <h3 className="text-lg font-semibold text-theme-text-primary">Policies</h3>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-theme-text-tertiary"><Loader2 className="h-4 w-4 animate-spin" /> Loading policies…</div>
        ) : policies.length === 0 ? (
          <div className="text-sm text-theme-text-tertiary">No policies yet. Create one above.</div>
        ) : (
          <div className="space-y-3">
            {policies.map((p) => (
              <div key={p.id} className="rounded-2xl border border-theme-border bg-theme-muted p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-theme-text-primary">{p.name}</p>
                    <p className="text-xs text-theme-text-tertiary">{p.key} · {p.category || "Uncategorized"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-theme-surface/5 px-3 py-1 text-xs font-medium text-theme-text-primary">{p.status}</span>
                    {p.status !== "published" && (
                      <button onClick={() => publish(p)} className="rounded-full border border-theme-border px-3 py-1 text-xs text-theme-text-primary hover:bg-theme-muted">Publish</button>
                    )}
                  </div>
                </div>
                {p.versions && p.versions.length > 0 && (
                  <div className="mt-3 rounded-xl bg-theme-muted p-3 text-xs text-theme-text-primary">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-theme-text-secondary">Versions</div>
                    {p.versions.map((v) => (
                      <div key={v.id} className="flex items-center justify-between border-b border-theme-border py-1 last:border-0">
                        <span>v{v.version}</span>
                        <span className="text-theme-text-tertiary">{v.effectiveAt || "draft"}</span>
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
