"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Unlock, AlertTriangle } from "lucide-react";
import { FormAlert } from "@/components/form";

const AVAILABLE_MODULES = [
  { id: "crm", label: "Sales & CRM", category: "Operations" },
  { id: "finance", label: "Finance & Accounting", category: "Finance" },
  { id: "people", label: "People & HR", category: "Operations" },
  { id: "projects", label: "Projects", category: "Operations" },
  { id: "billing", label: "Billing", category: "Finance" },
  { id: "inventory", label: "Inventory", category: "Operations" },
  { id: "procurement", label: "Procurement", category: "Operations" },
  { id: "itsupport", label: "IT Support", category: "Admin" },
  { id: "revops", label: "RevOps", category: "Analytics" },
  { id: "automation", label: "Automation & Workflows", category: "Admin" },
  { id: "integrations", label: "Integrations", category: "Admin" },
  { id: "analytics", label: "Analytics", category: "Analytics" },
  { id: "security", label: "Security", category: "Admin" },
  { id: "policies", label: "Policies", category: "Admin" },
  { id: "reports", label: "Reports", category: "Analytics" },
  { id: "dashboards", label: "Dashboards", category: "Analytics" },
];

export default function AdminRestrictions({ tenantSlug }: { tenantSlug?: string | null }) {
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const ts = tenantSlug ?? "kreatix-default";

  useEffect(() => {
    loadRestrictions();
  }, [ts]);

  async function loadRestrictions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tenant/access-restrictions?tenantSlug=${encodeURIComponent(ts)}`,
        { cache: "no-store" }
      );

      if (!res.ok) throw new Error("Failed to load restrictions");

      const data = await res.json();
      setRestrictions(data.restrictions || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load restrictions");
    } finally {
      setLoading(false);
    }
  }

  function toggleModule(moduleId: string) {
    const updated = restrictions.includes(moduleId)
      ? restrictions.filter((m) => m !== moduleId)
      : [...restrictions, moduleId];

    setRestrictions(updated);
    setHasChanges(true);
    setSuccess(null);
  }

  async function saveRestrictions() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/tenant/access-restrictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: ts,
          restrictions,
        }),
      });

      if (!res.ok) throw new Error("Failed to save restrictions");

      setHasChanges(false);
      setSuccess(
        `Access restrictions updated. ${restrictions.length} module(s) restricted.`
      );

      // Auto-clear success message
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save restrictions");
    } finally {
      setLoading(false);
    }
  }

  const categories = [
    ...new Set(AVAILABLE_MODULES.map((m) => m.category)),
  ].sort();

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Module Access Restrictions
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            Restrict modules from all users. Restricted modules will not appear
            in navigation or be accessible.
          </p>
        </div>
      </div>

      {/* Alerts */}
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
          title="Success"
          message={success}
          onClose={() => setSuccess(null)}
        />
      )}

      {/* Warning */}
      {restrictions.length > 0 && (
        <div className="mb-6 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-900">
              {restrictions.length} module(s) currently restricted
            </p>
            <p className="text-sm text-amber-700 mt-1">
              All users will have these modules hidden. Admins cannot override this.
            </p>
          </div>
        </div>
      )}

      {/* Module List by Category */}
      <div className="space-y-8">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
              {category}
            </h3>

            <div className="grid gap-3">
              {AVAILABLE_MODULES.filter((m) => m.category === category).map(
                (module) => {
                  const isRestricted = restrictions.includes(module.id);

                  return (
                    <button
                      key={module.id}
                      onClick={() => toggleModule(module.id)}
                      className={`flex items-center justify-between rounded-2xl border-2 p-4 transition ${
                        isRestricted
                          ? "border-rose-200 bg-rose-50"
                          : "border-slate-100 bg-white hover:border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isRestricted ? (
                          <Lock className="h-5 w-5 text-rose-600" />
                        ) : (
                          <Unlock className="h-5 w-5 text-slate-400" />
                        )}
                        <div className="text-left">
                          <p
                            className={`font-medium ${
                              isRestricted
                                ? "text-rose-900"
                                : "text-slate-900"
                            }`}
                          >
                            {module.label}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isRestricted ? "Restricted" : "Available"}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                          isRestricted
                            ? "bg-rose-100 text-rose-600"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {isRestricted ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            Hide
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            Show
                          </>
                        )}
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap gap-3 pt-8 border-t border-slate-100">
        <button
          onClick={() => {
            loadRestrictions();
            setHasChanges(false);
          }}
          disabled={!hasChanges || loading}
          className="rounded-full border border-slate-200 px-6 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Discard Changes
        </button>

        <button
          onClick={saveRestrictions}
          disabled={!hasChanges || loading}
          className="rounded-full bg-blue-600 text-white px-6 py-2 font-medium hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Restrictions"}
        </button>

        {AVAILABLE_MODULES.length > 0 && (
          <div className="ml-auto text-sm text-slate-500">
            {restrictions.length} of {AVAILABLE_MODULES.length} modules restricted
          </div>
        )}
      </div>
    </div>
  );
}
