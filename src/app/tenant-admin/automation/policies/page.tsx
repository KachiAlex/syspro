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
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Event Type</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-sm text-gray-900 font-medium">{rule.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{rule.eventType}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{rule.enabled ? "Enabled" : "Disabled"}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{rule.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
