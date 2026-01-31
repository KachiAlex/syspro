"use client";

import { useEffect, useState } from "react";

type ModuleItem = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  regions?: string[];
  flags?: Record<string, boolean>;
  createdAt: string;
};

const REGION_OPTIONS = ["Global HQ", "Americas", "EMEA", "APAC"];

export default function ModuleRegistry({ tenantSlug }: { tenantSlug?: string | null }) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<string>("Global HQ");
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/modules?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load modules");
      const payload = await res.json();
      setModules(Array.isArray(payload.modules) ? payload.modules : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleModule(m: ModuleItem) {
    try {
      const res = await fetch(`/api/tenant/modules/${encodeURIComponent(m.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !m.enabled }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function toggleFlag(m: ModuleItem, flag: string) {
    try {
      const res = await fetch(`/api/tenant/modules/${encodeURIComponent(m.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags: { [flag]: !(m.flags?.[flag] ?? false) } }),
      });
      if (!res.ok) throw new Error("Flag update failed");
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Modules</p>
            <h2 className="text-xl font-semibold text-slate-900">Module registry & feature flags</h2>
            <p className="mt-1 text-sm text-slate-500">Enable/disable modules per tenant/region and toggle feature flags.</p>
          </div>
          <div className="flex items-center gap-3">
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-lg border px-3 py-2">
              {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={load} className="rounded-full border px-3 py-2">Refresh</button>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="text-sm text-slate-500">Loading modules…</div>
          ) : modules.length === 0 ? (
            <div className="text-sm text-slate-500">No modules registered.</div>
          ) : (
            modules.map((m) => (
              <div key={m.id} className="rounded-2xl border border-slate-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-500">Key: {m.key} · Regions: {(m.regions || []).join(", ") || "All"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={m.enabled} onChange={() => toggleModule(m)} />
                      <span>Enabled</span>
                    </label>
                    <button onClick={() => toggleFlag(m, "beta")} className="rounded-full border px-3 py-1 text-xs">Toggle Beta</button>
                    <button onClick={() => toggleFlag(m, "ai_assist")} className="rounded-full border px-3 py-1 text-xs">Toggle AI</button>
                  </div>
                </div>
                {m.flags && (
                  <div className="mt-3 text-sm text-slate-600">
                    Flags: {Object.entries(m.flags).map(([k, v]) => `${k}=${v}`).join(", ")}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
      </div>
    </div>
  );
}
