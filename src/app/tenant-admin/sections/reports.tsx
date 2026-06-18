"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Download, Loader2, Play, RefreshCcw } from "lucide-react";
import ReportDefinitionModal from "@/components/ReportDefinitionModal";

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
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Record<string, Job[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", reportType: "operational", definition: '{"source":"projects"}', schedule: "" });
  const [summary, setSummary] = useState<{ totalReports: number; queuedJobs: number; runsLast7: number; avgRunSecs?: number } | null>(null);

  async function loadReports(cursorToLoad: string | null = null) {
    setLoading(true);
    setError(null);
    try {
      const qp = cursorToLoad ? `cursor=${encodeURIComponent(cursorToLoad)}&` : `page=1&`;
      const res = await fetch(`/api/reports?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}&${qp}limit=20`);
      if (!res.ok) throw new Error("Unable to load reports");
      const json = await res.json();
      const items: Report[] = json.reports || json.items || [];
      const newNext = json.nextCursor ?? null;
      setReports((prev) => (cursorToLoad ? [...prev, ...items] : items));
      setHasMore(Boolean(newNext));
      setNextCursor(newNext ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function fetchSummary() {
    try {
      const res = await fetch(`/api/reports/summary?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.error) setSummary({ totalReports: json.totalReports || 0, queuedJobs: json.queuedJobs || 0, runsLast7: json.runsLast7 || 0, avgRunSecs: json.avgRunSecs });
    } catch (e) {
      // ignore summary failures
    }
  }

  useEffect(() => {
    fetchSummary();
    const t = setTimeout(() => loadReports(), 600);
    return () => clearTimeout(t);
  }, [tenantSlug]);

  const listRef = useRef<HTMLDivElement | null>(null);
  const ITEM_SIZE = 140; // reduced height since definition moved to modal

  const [defOpen, setDefOpen] = useState(false);
  const [selectedDefinition, setSelectedDefinition] = useState<any>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMore && !loading) {
      awaitLoadMore();
    }
  }, [reports.length, hasMore, loading, page]);

  const awaitLoadMore = useCallback(() => {
    if (nextCursor) {
      loadReports(nextCursor);
    } else if (hasMore) {
      loadReports(null);
    }
  }, [nextCursor, hasMore]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const definition = JSON.parse(form.definition || "{}");
      const schedule = form.schedule || undefined;
      const res = await fetch(`/api/reports?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, reportType: form.reportType, definition, schedule }),
      });
      if (!res.ok) throw new Error("Create failed");
      setForm({ name: "", reportType: form.reportType, definition: form.definition, schedule: form.schedule });
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function runReport(report: Report) {
    const res = await fetch(`/api/reports/${report.id}/run?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}`, { method: "POST", headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const json = await res.json();
      setJobs((prev) => ({ ...prev, [report.id]: [json.job, ...(prev[report.id] || [])] }));
    }
  }

  async function loadJobs(reportId: string) {
    const res = await fetch(`/api/reports/${reportId}/run?tenantSlug=${encodeURIComponent(tenantSlug ?? '')}`);
    if (res.ok) {
      const json = await res.json();
      setJobs((prev) => ({ ...prev, [reportId]: json.jobs || [] }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary cards (fast, top-line metrics) */}
      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-slate-100 bg-[#111827] p-4 text-sm text-slate-700">
            <div className="text-xs text-slate-400">Reports</div>
            <div className="text-2xl font-semibold">{summary.totalReports}</div>
            <div className="text-xs text-slate-500">Total saved reports</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-[#111827] p-4 text-sm text-slate-700">
            <div className="text-xs text-slate-400">Queue</div>
            <div className="text-2xl font-semibold">{summary.queuedJobs}</div>
            <div className="text-xs text-slate-500">Jobs queued now</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-[#111827] p-4 text-sm text-slate-700">
            <div className="text-xs text-slate-400">Recent</div>
            <div className="text-2xl font-semibold">{summary.runsLast7}</div>
            <div className="text-xs text-slate-500">Runs last 7 days</div>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Reports</p>
            <h2 className="text-xl font-semibold text-gray-900">Operational, financial, and executive</h2>
            <p className="mt-1 text-sm text-slate-500">Cross-module reporting with scheduling and exports.</p>
          </div>
          <button onClick={() => { fetchSummary(); loadReports(); }} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" disabled={loading}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <form className="mt-4 space-y-3" onSubmit={handleCreate}>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Name</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Type</label>
              <input value={form.reportType} onChange={(e) => setForm((p) => ({ ...p, reportType: e.target.value }))} className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="operational / financial / executive" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Schedule (cron)</label>
              <input value={form.schedule} onChange={(e) => setForm((p) => ({ ...p, schedule: e.target.value }))} className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="0 6 * * *" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Definition (JSON)</label>
            <textarea value={form.definition} onChange={(e) => setForm((p) => ({ ...p, definition: e.target.value }))} className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" rows={4} />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Create report
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Report catalog</p>
            <h3 className="text-lg font-semibold text-gray-900">Reports</h3>
          </div>
        </div>
          {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading reports…</div>
        ) : reports.length === 0 ? (
          <div className="text-sm text-slate-500">No reports yet. Create one above.</div>
        ) : (
          <div className="max-h-96 overflow-y-auto" onScroll={handleScroll} ref={listRef}>
            {reports.map((r, index) => (
              <div key={r.id} className="p-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                      <p className="text-xs text-slate-500">{r.reportType}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => runReport(r)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-[#111827]">
                        <Play className="h-3 w-3" /> Run now
                      </button>
                      <button onClick={() => loadJobs(r.id)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-[#111827]">
                        History
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-slate-600">{r.schedule || "On-demand"}</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setSelectedDefinition(r.definition); setDefOpen(true); }} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-[#111827]">View definition</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="flex justify-center mt-4 p-4">
                <button
                  onClick={() => { if (nextCursor) loadReports(nextCursor); else loadReports(null); }}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-[#111827]"
                >
                  Load more
                </button>
              </div>
            )}
            <ReportDefinitionModal open={defOpen} onClose={() => setDefOpen(false)} definition={selectedDefinition} />
          </div>
        )}
      </div>
    </div>
  );
}
