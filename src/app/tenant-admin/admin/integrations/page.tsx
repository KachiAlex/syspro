"use client";

import React, { useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AdminService } from "@/app/tenant-admin/services/admin-service";

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  description?: string;
  webhookUrl?: string;
}

export default function IntegrationsPage() {
  const { tenantSlug } = useTenantContext();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const data = await AdminService.getIntegrations(tenantSlug);
        setIntegrations(data.data?.integrations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load integrations");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Integrations</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && integrations.length === 0 && <p>No integrations found.</p>}
      {!loading && integrations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((integration) => (
                <tr key={integration.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-sm text-gray-900 font-medium">{integration.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{integration.type}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 capitalize">{integration.status}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{integration.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
