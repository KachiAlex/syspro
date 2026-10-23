"use client";

import React, { useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AutomationService } from "@/app/tenant-admin/services/automation-service";

interface Trigger {
  key: string;
  module: string;
  description: string;
}

export default function WorkflowTriggersPage() {
  const { tenantSlug } = useTenantContext();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const data = await AutomationService.getTriggers(tenantSlug);
        setTriggers(data.triggers || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load triggers");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Workflow Triggers</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && triggers.length === 0 && <p>No triggers found.</p>}
      {!loading && triggers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-theme-surface border border-theme-border rounded-lg">
            <thead>
              <tr className="bg-theme-muted">
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Key</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Module</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Description</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((trigger) => (
                <tr key={trigger.key} className="border-t border-theme-border">
                  <td className="px-4 py-2 text-sm text-theme-text-primary font-medium">{trigger.key}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{trigger.module}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{trigger.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
