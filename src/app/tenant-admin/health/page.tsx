'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Server, AlertTriangle, CheckCircle, XCircle, Activity, RefreshCw, Download, Wifi } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface HealthMetric {
  service: string;
  status: 'healthy' | 'down' | string;
  uptime: string;
  lastChecked: string;
  latency: number | null;
}

export default function HealthPage() {
  const { tenantSlug } = useTenantContext();
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const loadHealth = useCallback(async () => {
    if (!tenantSlug) return;
    setError(null);
    try {
      const res = await fetch(`/api/tenant/health?tenantSlug=${encodeURIComponent(tenantSlug)}`, { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to load health status');
      setMetrics(Array.isArray(payload.metrics) ? payload.metrics : []);
      setLastFetchedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health status');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    setLoading(true);
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadHealth, 30000);
    return () => clearInterval(id);
  }, [autoRefresh, loadHealth]);

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'down': return 'text-red-600 bg-red-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-theme-text-secondary bg-theme-muted';
    }
  };

  const getServiceStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'down':
      case 'error': return <XCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const healthyServices = metrics.filter((m) => m.status === 'healthy').length;
  const downServices = metrics.filter((m) => m.status !== 'healthy');
  const latencies = metrics.map((m) => m.latency).filter((v): v is number => typeof v === 'number');
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;
  const overallHealthy = metrics.length > 0 && downServices.length === 0;

  const exportHealthReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      tenantSlug,
      metrics,
    };
    const dataStr = JSON.stringify(report, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', 'health_report.json');
    linkElement.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">System Health</h1>
          <p className="text-sm text-theme-text-secondary mt-1">
            System monitoring and diagnostics
            {lastFetchedAt ? ` — last checked ${lastFetchedAt.toLocaleTimeString()}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-theme-text-secondary">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-theme-border text-theme-accent focus:ring-theme-accent"
          />
          Auto-refresh every 30s
        </label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); loadHealth(); }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportHealthReport}
            disabled={metrics.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">System Status</p>
              <p className={`text-3xl font-bold mt-2 ${metrics.length === 0 ? 'text-theme-text-secondary' : overallHealthy ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.length === 0 ? '—' : overallHealthy ? 'Healthy' : 'Degraded'}
              </p>
              <p className={`text-xs mt-2 ${overallHealthy ? 'text-green-600' : 'text-red-600'}`}>
                {overallHealthy ? 'All services operational' : `${downServices.length} service${downServices.length === 1 ? '' : 's'} down`}
              </p>
            </div>
            <Activity className={`w-12 h-12 ${overallHealthy ? 'text-green-100' : 'text-red-100'}`} />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Services Up</p>
              <p className="text-3xl font-bold text-theme-accent mt-2">
                {metrics.length === 0 ? '—' : `${healthyServices}/${metrics.length}`}
              </p>
              <p className="text-xs text-theme-accent mt-2">Monitored services</p>
            </div>
            <Server className="w-12 h-12 text-blue-100" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Active Alerts</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{downServices.length}</p>
              <p className="text-xs text-amber-600 mt-2">Unhealthy services</p>
            </div>
            <AlertTriangle className="w-12 h-12 text-amber-100" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Avg Latency</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {avgLatency === null ? '—' : `${avgLatency}ms`}
              </p>
              <p className="text-xs text-purple-600 mt-2">Across measured services</p>
            </div>
            <Wifi className="w-12 h-12 text-purple-100" />
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Service Status</h3>
        {loading && (
          <p className="text-sm text-theme-text-secondary">Checking service health…</p>
        )}
        {!loading && metrics.length === 0 && !error && (
          <p className="text-sm text-theme-text-secondary">No health data available.</p>
        )}
        <div className="space-y-4">
          {metrics.map((service) => (
            <div key={service.service} className="border border-theme-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getServiceStatusColor(service.status)}`}>
                    {getServiceStatusIcon(service.status)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-theme-text-primary">{service.service}</p>
                    <p className="text-xs text-theme-text-secondary">
                      {service.latency !== null ? `Latency: ${service.latency}ms` : 'Latency: —'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getServiceStatusColor(service.status)}`}>
                    {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                  </span>
                  <p className="text-xs text-theme-text-tertiary mt-1">
                    Checked {new Date(service.lastChecked).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Active Alerts</h3>
          <div className="space-y-3">
            {downServices.length === 0 && !loading && (
              <p className="text-sm text-theme-text-secondary">No active alerts — all services are healthy.</p>
            )}
            {downServices.map((service) => (
              <div key={service.service} className="border rounded-lg p-4 bg-red-50 text-red-800 border-red-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <h4 className="text-sm font-medium">{service.service} is {service.status}</h4>
                </div>
                <p className="text-sm mt-1 text-red-700">
                  Detected at {new Date(service.lastChecked).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
