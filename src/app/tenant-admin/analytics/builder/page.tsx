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
        <h2 className="text-2xl font-bold text-gray-900">Report Builder</h2>
        <p className="text-sm text-gray-500 mt-1">Create saved reports over live tenant data — run on demand or export to CSV.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">New report</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Report name"
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm"
          />
          <select value={module} onChange={(e) => { setModule(e.target.value); setReportType("summary"); }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
            {MODULES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <select value={reportType} onChange={(e) => setReportType(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={schedule} onChange={(e) => setSchedule(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm">
            <option value="once">Run on demand</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={create} disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> {saving ? "Saving…" : "Save report"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <FileBarChart className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Saved reports</h3>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-gray-500">Loading…</p>
        ) : reports.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No saved reports yet — create one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Module</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Schedule</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-6 py-3 capitalize text-gray-600">{r.module}</td>
                  <td className="px-6 py-3 text-gray-600">{r.reportType}</td>
                  <td className="px-6 py-3 text-gray-600">{r.schedule ?? "on demand"}</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.status === "Ready" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{r.status}</span>
                  </td>
                  <td className="px-6 py-3 text-right space-x-2">
                    <button onClick={() => download(r.id)} title="Download CSV"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100">
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                    <button onClick={() => queueExport(r.id)} title="Queue export job"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200">
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
