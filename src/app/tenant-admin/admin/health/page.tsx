"use client";

import React, { useState, useEffect } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface HealthMetric {
  service: string;
  status: "healthy" | "degraded" | "down";
  uptime: string;
  lastChecked: string;
  latency?: number;
}

export default function AdminHealthPage() {
  const { tenantSlug } = useTenantContext();
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const res = await fetch(`/api/tenant/health?tenantSlug=${encodeURIComponent(tenantSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics || []);
        } else {
          throw new Error("Failed to fetch health metrics");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load health metrics");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  const statusColor = (status: string) => {
    switch (status) {
      case "healthy": return "text-green-600 bg-green-50";
      case "degraded": return "text-amber-600 bg-amber-50";
      case "down": return "text-red-600 bg-red-50";
      default: return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Health</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && metrics.length === 0 && <p>No health metrics found.</p>}
      {!loading && metrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div key={m.service} className={`rounded-lg border p-4 ${statusColor(m.status)}`}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{m.service}</h3>
                <span className="text-xs font-medium uppercase">{m.status}</span>
              </div>
              <p className="text-sm">Uptime: {m.uptime}</p>
              {m.latency !== undefined && <p className="text-sm">Latency: {m.latency}ms</p>}
              <p className="text-xs mt-2 opacity-75">Last checked: {new Date(m.lastChecked).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
