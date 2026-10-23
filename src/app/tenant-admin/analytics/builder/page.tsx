"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { FileBarChart, Play, Download, Trash2, Plus } from "lucide-react";

const MODULES = [
  { key: "finance", label: "Finance", types: ["summary", "receivables", "invoices", "payables", "expenses", "budget"] },
  { key: "sales", label: "Sales", types: ["summary", "orders", "products"] },
  { key: "crm", label: "CRM", types: ["summary", "pipeline", "leads"] },
  { key: "people", label: "People / HR", types: ["summary", "headcount", "payroll", "leave"] },
  { key: "support", label: "Support", types: ["summary", "tickets", "sla"] },
  { key: "inventory", label: "Inventory", types: ["summary", "stock", "valuation"] },
];

interface SavedReport {
  id: string;
  name: string;
  reportType: string;
  module: string;
  status: string;
  schedule: string | null;
  createdAt: string;
}

export default function ReportBuilderPage() {
  const { tenantSlug } = useTenantContext();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [module, setModule] = useState("finance");
  const [reportType, setReportType] = useState("summary");
  const [schedule, setSchedule] = useState<"once" | "daily" | "weekly" | "monthly">("once");
  const [saving, setSaving] = useState(false);

  const api = useCallback(
    (path: string, init?: RequestInit) =>
      fetch(`${path}${path.includes("?") ? "&" : "?"}tenantSlug=${encodeURIComponent(tenantSlug)}`, init),
    [tenantSlug]
  );

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const res = await api("/api/tenant/analytics?type=reports");
      const data = await res.json().catch(() => ({}));
      setReports(data.data?.reports ?? data.reports ?? []);
    } catch {
      setError("Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, [api, tenantSlug]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await api("/api/tenant/analytics?action=create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), reportType, type: module, metrics: [], schedule }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Create failed");
      setName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const queueExport = async (reportId: string) => {
    await api("/api/tenant/analytics?action=export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, format: "csv" }),
    });
  };

  const download = (reportId: string) => {
    window.open(`/api/tenant/analytics?action=download&reportId=${encodeURIComponent(reportId)}&tenantSlug=${encodeURIComponent(tenantSlug)}`, "_blank");
  };

  const types = MODULES.find((m) => m.key === module)?.types ?? ["summary"];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-theme-text-primary">Report Builder</h2>
        <p className="text-sm text-theme-text-secondary mt-1">Create saved reports over live tenant data — run on demand or export to CSV.</p>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">New report</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Report name"
            className="px-3 py-2 rounded-lg border border-theme-border text-sm"
          />
          <select value={module} onChange={(e) => { setModule(e.target.value); setReportType("summary"); }}
            className="px-3 py-2 rounded-lg border border-theme-border text-sm">
            {MODULES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-theme-border text-sm">
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={schedule} onChange={(e) => setSchedule(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-theme-border text-sm">
            <option value="once">Run on demand</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={create} disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {saving ? "Saving…" : "Save report"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border">
        <div className="px-6 py-4 border-b border-theme-border flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-theme-accent" />
          <h3 className="text-lg font-semibold text-theme-text-primary">Saved reports</h3>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-theme-text-secondary">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="p-6 text-sm text-theme-text-secondary">No saved reports yet — create one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-theme-text-secondary border-b">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Module</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Schedule</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-3 font-medium text-theme-text-primary">{r.name}</td>
                  <td className="px-6 py-3 capitalize text-theme-text-secondary">{r.module}</td>
                  <td className="px-6 py-3 text-theme-text-secondary">{r.reportType}</td>
                  <td className="px-6 py-3 text-theme-text-secondary">{r.schedule ?? "on demand"}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "Ready" ? "bg-emerald-100 text-emerald-700" : "bg-theme-muted text-theme-text-secondary"}`}>{r.status}</span>
                  </td>
                  <td className="px-6 py-3 text-right space-x-2">
                    <button onClick={() => download(r.id)} title="Download CSV"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-theme-muted">
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button onClick={() => queueExport(r.id)} title="Queue export job"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-theme-text-primary bg-theme-muted rounded hover:bg-theme-muted">
                      <Play className="w-3.5 h-3.5" /> Queue
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
