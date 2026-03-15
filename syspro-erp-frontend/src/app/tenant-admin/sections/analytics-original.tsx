"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";

type Report = { id: string; name: string; type: string; createdAt?: string; schedule?: string };
type Export = { id: string; name: string; frequency: string; lastRun?: string; nextRun?: string; format: string };

const REPORT_TYPES: Record<string, { label: string; description: string; icon: string }> = {
  sales: { label: "Sales Report", description: "Revenue, deals, and pipeline analysis", icon: "📊" },
  inventory: { label: "Inventory Report", description: "Stock levels and movement analysis", icon: "📦" },
  expense: { label: "Expense Report", description: "Cost tracking and budget analysis", icon: "💰" },
  people: { label: "People Report", description: "Headcount, attendance, and HR metrics", icon: "👥" },
  financial: { label: "Financial Report", description: "P&L, balance sheet, and cash flow", icon: "📈" },
};

const EXPORT_FREQUENCIES: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function AnalyticsSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [exports, setExports] = useState<Export[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewReport, setShowNewReport] = useState(false);
  const [showNewExport, setShowNewExport] = useState(false);
  const [reportForm, setReportForm] = useState({ name: "", type: "" });
  const [exportForm, setExportForm] = useState({ name: "", frequency: "daily", format: "csv" });
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/analytics?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setReports(payload.reports ?? []);
        setExports(payload.exports ?? []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function createReport() {
    if (!reportForm.name.trim() || !reportForm.type) {
      setError("Report name and type are required");
      return;
    }
    try {
      const payload = Object.assign({}, reportForm, { type: "report" });
      const res = await fetch(`/api/tenant/analytics?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create report");
      setReportForm({ name: "", type: "" });
      setShowNewReport(false);
      setSuccess("Report created successfully");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create report");
    }
  }

  async function deleteReport(id: string) {
    if (!confirm("Delete this report? This action cannot be undone.")) return;
    try {
      const res = await fetch(
        `/api/tenant/analytics?id=${encodeURIComponent(id)}&type=report&tenantSlug=${encodeURIComponent(ts)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete report");
      setSuccess("Report deleted");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete report");
    }
  }

  async function createExport() {
    if (!exportForm.name.trim()) {
      setError("Export name is required");
      return;
    }
    try {
      const payload = Object.assign({}, exportForm, { type: "export" });
      const res = await fetch(`/api/tenant/analytics?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create export");
      setExportForm({ name: "", frequency: "daily", format: "csv" });
      setShowNewExport(false);
      setSuccess("Scheduled export created");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create export");
    }
  }

  async function deleteExport(id: string) {
    if (!confirm("Stop this export? It will no longer be sent.")) return;
    try {
      const res = await fetch(
        `/api/tenant/analytics?id=${encodeURIComponent(id)}&type=export&tenantSlug=${encodeURIComponent(ts)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete export");
      setSuccess("Export removed");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to delete export");
    }
  }

  return (
    <div className="space-y-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Reports */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Insights</p>
            <h2 className="text-lg font-semibold text-slate-900">Reports</h2>
            <p className="mt-1 text-sm text-slate-600">Create custom reports to analyze your business data</p>
          </div>
          <button
            onClick={() => {
              setShowNewReport(!showNewReport);
              setReportForm({ name: "", type: "" });
            }}
            className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showNewReport ? "Cancel" : "+ New Report"}
          </button>
        </div>

        {showNewReport && (
          <div className="mt-4 space-y-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Report Name</label>
              <input
                type="text"
                value={reportForm.name}
                onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                placeholder="e.g., Q4 Sales Analysis"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Report Type</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(REPORT_TYPES).map(([key, { label, description, icon }]) => (
                  <button
                    key={key}
                    onClick={() => setReportForm({ ...reportForm, type: key })}
                    className={`rounded-lg border-2 p-3 text-left transition-all ${
                      reportForm.type === key
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-lg">{icon}</div>
                    <div className="mt-1 font-medium text-sm text-slate-900">{label}</div>
                    <div className="text-xs text-slate-600">{description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createReport}
                className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Create Report
              </button>
              <button
                onClick={() => {
                  setShowNewReport(false);
                  setReportForm({ name: "", type: "" });
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
              <p className="mt-2">Loading reports…</p>
            </div>
          ) : (reports ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <p className="font-medium text-blue-900">No reports created yet</p>
              <p className="mt-1 text-blue-700">Create your first report to start analyzing data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((r) => {
                const reportType = REPORT_TYPES[r.type] || { label: r.type, icon: "📋" };
                return (
                  <div key={r.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{reportType.icon}</span>
                          <div>
                            <h3 className="font-semibold text-slate-900">{r.name}</h3>
                            <p className="text-sm text-slate-600">{reportType.label}</p>
                          </div>
                        </div>
                        {r.createdAt && (
                          <p className="mt-2 text-xs text-slate-500">
                            Created {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50">
                          View
                        </button>
                        <button
                          onClick={() => deleteReport(r.id)}
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Scheduled Exports */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <h2 className="text-lg font-semibold text-slate-900">Scheduled Exports</h2>
            <p className="mt-1 text-sm text-slate-600">Automatically export data at regular intervals</p>
          </div>
          <button
            onClick={() => {
              setShowNewExport(!showNewExport);
              setExportForm({ name: "", frequency: "daily", format: "csv" });
            }}
            className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showNewExport ? "Cancel" : "+ Schedule Export"}
          </button>
        </div>

        {showNewExport && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Export Name</label>
              <input
                type="text"
                value={exportForm.name}
                onChange={(e) => setExportForm({ ...exportForm, name: e.target.value })}
                placeholder="e.g., Daily Sales Export"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Frequency</label>
                <select
                  value={exportForm.frequency}
                  onChange={(e) => setExportForm({ ...exportForm, frequency: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {Object.entries(EXPORT_FREQUENCIES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">Format</label>
                <select
                  value={exportForm.format}
                  onChange={(e) => setExportForm({ ...exportForm, format: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                  <option value="json">JSON</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={createExport}
                className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Schedule Export
              </button>
              <button
                onClick={() => {
                  setShowNewExport(false);
                  setExportForm({ name: "", frequency: "daily", format: "csv" });
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          {(exports ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <p className="font-medium text-blue-900">No scheduled exports</p>
              <p className="mt-1 text-blue-700">Set up automated exports to receive data regularly</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exports.map((e) => (
                <div key={e.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">{e.name}</h3>
                      <div className="mt-2 space-y-1 text-sm text-slate-600">
                        <p>📅 Frequency: {EXPORT_FREQUENCIES[e.frequency] || e.frequency}</p>
                        <p>📄 Format: {e.format?.toUpperCase()}</p>
                        {e.lastRun && <p>⏱️ Last run: {new Date(e.lastRun).toLocaleDateString()}</p>}
                        {e.nextRun && <p>⏭️ Next run: {new Date(e.nextRun).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteExport(e.id)}
                      className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
