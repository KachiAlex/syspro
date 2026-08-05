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

type IndustryProfile = {
  key: string;
  label: string;
  description: string;
  modules: string[];
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  crm: "Manage customer relationships, leads, and sales",
  finance: "Financial management and accounting",
  people: "Employee and HR management",
  projects: "Project tracking and management",
  billing: "Billing and invoicing",
  integrations: "Third-party integrations",
  inventory: "Stock management and product catalog",
  procurement: "Purchase orders and supplier management",
  vendors: "Vendor and supplier directory",
  manufacturing: "BOM, work orders, MRP, and production",
};

const INDUSTRY_PROFILE_OPTIONS: IndustryProfile[] = [
  { key: "services", label: "Services", description: "Consulting, professional services, agencies", modules: ["crm", "projects", "billing", "finance", "hr", "people"] },
  { key: "trading", label: "Trading / Distribution", description: "Wholesale, retail, distribution, import/export", modules: ["inventory", "procurement", "vendors", "billing", "finance", "hr", "crm"] },
  { key: "manufacturing", label: "Manufacturing", description: "Production, assembly, and manufacturing operations", modules: ["inventory", "procurement", "vendors", "manufacturing", "billing", "finance", "hr", "crm"] },
  { key: "mixed", label: "Mixed / Diversified", description: "Companies operating across multiple industries", modules: ["crm", "projects", "inventory", "procurement", "vendors", "manufacturing", "billing", "finance", "hr", "people"] },
];

const REGION_OPTIONS = ["Global HQ", "Americas", "EMEA", "APAC"];

export default function ModuleRegistry({ tenantSlug }: { tenantSlug?: string | null }) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [industryProfiles, setIndustryProfiles] = useState<string[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [region, setRegion] = useState<string>("Global HQ");
  const ts = tenantSlug ;

  async function loadIndustryProfiles() {
    setProfilesLoading(true);
    try {
      const res = await fetch(`/api/tenant/industry-profiles?tenantSlug=${encodeURIComponent(ts ?? '')}`, { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json();
      if (payload.success && payload.data?.profiles) {
        setIndustryProfiles(payload.data.profiles);
      }
    } catch (err) {
      console.error("Failed to load industry profiles:", err);
    } finally {
      setProfilesLoading(false);
    }
  }

  async function toggleIndustryProfile(key: string) {
    const newProfiles = industryProfiles.includes(key)
      ? industryProfiles.filter((p) => p !== key)
      : [...industryProfiles, key];
    setIndustryProfiles(newProfiles);
    try {
      const res = await fetch(`/api/tenant/industry-profiles?tenantSlug=${encodeURIComponent(ts ?? '')}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industryProfiles: newProfiles }),
      });
      if (!res.ok) throw new Error("Failed to update industry profiles");
      setSuccess(`Industry profile ${newProfiles.includes(key) ? "enabled" : "disabled"}`);
      setTimeout(() => setSuccess(null), 3000);
      await load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/modules?tenantSlug=${encodeURIComponent(ts ?? '')}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load modules");
      const payload = await res.json();
      setModules(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadIndustryProfiles();
  }, [ts]);

  async function toggleModule(m: ModuleItem) {
    try {
      const res = await fetch(`/api/tenant/modules/${encodeURIComponent(m.id)}?tenantSlug=${encodeURIComponent(ts ?? '')}`, {
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
      const res = await fetch(`/api/tenant/modules/${encodeURIComponent(m.id)}?tenantSlug=${encodeURIComponent(ts ?? '')}`, {
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
      <div className="rounded-3xl border border-slate-100 bg-theme-muted p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Modules</p>
            <h2 className="text-2xl font-semibold text-gray-900">System Modules & Features</h2>
            <p className="mt-2 text-sm text-slate-600">
              Enable or disable modules for your organization and configure feature flags per region.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-sm"
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

        {/* Industry Profiles Section */}
        <div className="mt-6 mb-6 rounded-lg border border-slate-200 p-4 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Industry Profiles</h3>
              <p className="text-xs text-slate-600 mt-0.5">Select industry profiles to auto-enable relevant modules. Multiple profiles can be active simultaneously.</p>
            </div>
            {profilesLoading && (
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {INDUSTRY_PROFILE_OPTIONS.map((profile) => {
              const isActive = industryProfiles.includes(profile.key);
              return (
                <button
                  key={profile.key}
                  onClick={() => toggleIndustryProfile(profile.key)}
                  className={`text-left rounded-lg border p-3 transition-all ${
                    isActive
                      ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-900">
                      {isActive ? "✓" : "○"} {profile.label}
                    </span>
                    {isActive && (
                      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{profile.description}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    <span className="font-medium">Modules:</span> {profile.modules.join(", ")}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
              <p className="mt-2">Loading modules…</p>
            </div>
          ) : (modules ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <p className="font-medium text-gray-900">No modules registered</p>
              <p className="mt-1 text-blue-700">Modules will appear here once configured</p>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((m) => (
                <div key={m.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">
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
                          className="bg-white h-4 w-4 rounded border-slate-300 text-black"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          {m.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </label>
                    </div>
                  </div>

                  {m.flags && Object.keys(m.flags).length > 0 && (
                    <div className="mt-4 border-t pt-4">
                      <p className="mb-3 text-xs font-semibold text-gray-900">Feature Flags</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(m.flags).map(([key, value]) => {
                          const label = key === "beta" ? "🧪 Beta Features" : key === "ai_assist" ? "🤖 AI Assist" : key;
                          return (
                            <button
                              key={key}
                              onClick={() => toggleFlag(m, key, label)}
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-medium transition-all ${
                                value
                                  ? "bg-blue-100 text-gray-900 hover:bg-blue-200"
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
