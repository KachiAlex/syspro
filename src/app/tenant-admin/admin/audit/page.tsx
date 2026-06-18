"use client";

import React, { useState, useEffect } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface AuditLog {
  id: string;
  action: string;
  user: string;
  resource: string;
  timestamp: string;
  details?: string;
}

export default function AdminAuditPage() {
  const { tenantSlug } = useTenantContext();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const res = await fetch(`/api/tenant/audit?tenantSlug=${encodeURIComponent(tenantSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
        } else {
          throw new Error("Failed to fetch audit logs");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Audit</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && logs.length === 0 && <p>No audit logs found.</p>}
      {!loading && logs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Timestamp</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Action</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">User</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Resource</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-sm text-gray-900">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{log.action}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{log.user}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{log.resource}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{log.details || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
