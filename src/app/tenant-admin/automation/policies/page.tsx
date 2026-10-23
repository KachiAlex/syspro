"use client";

import React, { useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AutomationService } from "@/app/tenant-admin/services/automation-service";

interface AutomationRule {
  id: string;
  name: string;
  eventType: string;
  enabled: boolean;
  description?: string;
}

export default function PoliciesPage() {
  const { tenantSlug } = useTenantContext();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const data = await AutomationService.getRules(tenantSlug);
        setRules(data.rules || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load policies");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Automation Policies</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && rules.length === 0 && <p>No policies found.</p>}
      {!loading && rules.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-theme-surface border border-theme-border rounded-lg">
            <thead>
              <tr className="bg-theme-muted">
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Event Type</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Description</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-theme-border">
                  <td className="px-4 py-2 text-sm text-theme-text-primary font-medium">{rule.name}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{rule.eventType}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{rule.enabled ? "Enabled" : "Disabled"}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{rule.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
