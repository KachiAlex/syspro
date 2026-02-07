"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";

type ModuleItem = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  description?: string;
  regions?: string[];
  flags?: Record<string, boolean>;
  createdAt: string;
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  crm: "Manage customer relationships, leads, and sales",
  finance: "Financial management and accounting",
  people: "Employee and HR management",
  projects: "Project tracking and management",
  billing: "Billing and invoicing",
  integrations: "Third-party integrations",
};

const REGION_OPTIONS = ["Global HQ", "Americas", "EMEA", "APAC"];

export default function ModuleRegistry({ tenantSlug }: { tenantSlug?: string | null }) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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

  useEffect(() => {
    load();
  }, [ts]);

  async function toggleModule(m: ModuleItem) {
    try {
      const res = await fetch(`/api/tenant/modules/${encodeURIComponent(m.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !m.enabled }),
      });
      if (!res.ok) throw new Error("Failed to update module");
      setSuccess(`${m.name} ${!m.enabled ? "enabled" : "disabled"}`);
      setTimeout(() => setSuccess(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function toggleFlag(m: ModuleItem, flag: string, label: string) {
    try {
      const res = await fetch(`/api/tenant/modules/${encodeURIComponent(m.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flags: { [flag]: !(m.flags?.[flag] ?? false) } }),
      });
      if (!res.ok) throw new Error("Failed to update setting");
      setSuccess(`${label} ${!(m.flags?.[flag] ?? false) ? "enabled" : "disabled"}`);
      setTimeout(() => setSuccess(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Modules</p>
            <h2 className="text-2xl font-semibold text-slate-900">System Modules & Features</h2>
            <p className="mt-2 text-sm text-slate-600">
              Enable or disable modules for your organization and configure feature flags per region.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <button
              onClick={load}
              className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <FormAlert
            type="error"
            title="Error"
            message={error}
            onClose={() => setError(null)}
          />
        )}
        {success && (
          <FormAlert
            type="success"
            message={success}
            onClose={() => setSuccess(null)}
          />
        )}

        <div className="mt-6">
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
              <p className="mt-2">Loading modules…</p>
            </div>
          ) : (modules ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <p className="font-medium text-blue-900">No modules registered</p>
              <p className="mt-1 text-blue-700">Modules will appear here once configured</p>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-slate-900">
                          {m.enabled ? "✓" : "○"} {m.name}
                        </h4>
                        {m.enabled && (
                          <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        {MODULE_DESCRIPTIONS[m.key.toLowerCase()] || m.key}
                      </p>
                      {m.regions && m.regions.length > 0 && (
                        <p className="mt-2 text-xs text-slate-500">
                          <span className="font-medium">Regions:</span> {m.regions.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={m.enabled}
                          onChange={() => toggleModule(m)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {m.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </label>
                    </div>
                  </div>

                  {m.flags && Object.keys(m.flags).length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <p className="mb-3 text-xs font-semibold text-slate-900">Feature Flags</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(m.flags).map(([key, value]) => {
                          const label = key === "beta" ? "🧪 Beta Features" : key === "ai_assist" ? "🤖 AI Assist" : key;
                          return (
                            <button
                              key={key}
                              onClick={() => toggleFlag(m, key, label)}
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                value
                                  ? "bg-blue-100 text-blue-900 hover:bg-blue-200"
                                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {label} {value ? "✓" : "○"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
