"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Play, RefreshCcw } from "lucide-react";

type Report = {
  id: string;
  name: string;
  reportType: string;
  definition: any;
  filters?: any;
  schedule?: string | null;
  enabled: boolean;
};

type Job = {
  id: string;
  status: string;
  outputLocation?: string;
  error?: string;
  createdAt?: string;
};

export default function ReportsSection({ tenantSlug }: { tenantSlug: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [jobs, setJobs] = useState<Record<string, Job[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", reportType: "operational", definition: '{"source":"projects"}', schedule: "" });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      if (!res.ok) throw new Error("Unable to load reports");
      const json = await res.json();
      setReports(json.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantSlug]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const definition = JSON.parse(form.definition || "{}");
      const schedule = form.schedule || undefined;
      const res = await fetch(`/api/reports?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, reportType: form.reportType, definition, schedule }),
      });
      if (!res.ok) throw new Error("Create failed");
      setForm({ name: "", reportType: form.reportType, definition: form.definition, schedule: form.schedule });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function runReport(report: Report) {
    const res = await fetch(`/api/reports/${report.id}/run?tenantSlug=${encodeURIComponent(tenantSlug)}`, { method: "POST", headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const json = await res.json();
      setJobs((prev) => ({ ...prev, [report.id]: [json.job, ...(prev[report.id] || [])] }));
    }
  }

  async function loadJobs(reportId: string) {
    const res = await fetch(`/api/reports/${reportId}/run?tenantSlug=${encodeURIComponent(tenantSlug)}`);
    if (res.ok) {
      const json = await res.json();
      setJobs((prev) => ({ ...prev, [reportId]: json.jobs || [] }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Reports</p>
            <h2 className="text-xl font-semibold text-slate-900">Operational, financial, and executive</h2>
            <p className="mt-1 text-sm text-slate-500">Cross-module reporting with scheduling and exports.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" disabled={loading}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Name</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Type</label>
              <input value={form.reportType} onChange={(e) => setForm((p) => ({ ...p, reportType: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="operational / financial / executive" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Schedule (cron)</label>
              <input value={form.schedule} onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="0 6 * * *" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Definition (JSON)</label>
            <textarea value={form.definition} onChange={(e) => setForm((p) => ({ ...p, definition: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" rows={4} />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Create report
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Report catalog</p>
            <h3 className="text-lg font-semibold text-slate-900">Reports</h3>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports…</div>
        ) : reports.length === 0 ? (
          <div className="text-sm text-slate-500">No reports yet. Create one above.</div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.reportType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => runReport(r)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-white">
                      <Play className="h-3 w-3" /> Run now
                    </button>
                    <button onClick={() => loadJobs(r.id)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-white">
                      History
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-white p-3 text-xs text-slate-700">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">Definition</div>
                    <pre className="whitespace-pre-wrap break-all">{JSON.stringify(r.definition, null, 2)}</pre>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-xs text-slate-700">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">Schedule</div>
                    <div>{r.schedule || "On-demand"}</div>
                  </div>
                </div>
                {jobs[r.id] && jobs[r.id].length > 0 && (
                  <div className="mt-3 rounded-xl bg-white p-3 text-xs text-slate-700">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">Recent runs</div>
                    {jobs[r.id].map((j) => (
                      <div key={j.id} className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0">
                        <span className="capitalize">{j.status}</span>
                        <span className="text-slate-500">{j.outputLocation || j.error || j.createdAt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
