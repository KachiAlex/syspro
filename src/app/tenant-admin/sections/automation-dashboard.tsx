"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Bot, CheckCircle2, Loader2, Play, RefreshCcw } from "lucide-react";

interface AutomationSummary {
  rules: { total: number; enabled: number; simulationOnly: number };
  queue: { pending: number; processing: number; completed: number; failed: number; oldestPending: string | null; nextScheduled: string | null; maxAttempt: number | null };
  audits: { total: number; matched: number; unmatched: number; lastEvent: string | null; lastRule: string | null; lastOutcome: string | null; lastCreatedAt: string | null };
}

export default function AutomationDashboard({ tenantSlug }: { tenantSlug?: string | null }) {
  const [summary, setSummary] = useState<AutomationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/automation/summary?tenantSlug=${encodeURIComponent(tenantSlug || "kreatix-default")}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load automation summary");
      setSummary(json.summary as AutomationSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantSlug]);

  const healthBadge = useMemo(() => {
    if (!summary) return { tone: "slate", label: "No data" } as const;
    if (summary.queue.failed > 0) return { tone: "rose", label: "Attention" } as const;
    if (summary.queue.pending > 10 || summary.queue.processing > 5) return { tone: "amber", label: "Busy" } as const;
    return { tone: "emerald", label: "Healthy" } as const;
  }, [summary]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <h2 className="text-xl font-semibold text-slate-900">Dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">Live snapshot of rules, queue health, and audit outcomes.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${healthBadge.tone === "emerald" ? "bg-emerald-50 text-emerald-700" : healthBadge.tone === "amber" ? "bg-amber-50 text-amber-700" : healthBadge.tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
              <Activity className="h-3 w-3" /> {healthBadge.label}
            </span>
            <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />} Refresh
            </button>
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Rules"
          value={summary?.rules.total ?? 0}
          sub={`${summary?.rules.enabled ?? 0} live • ${summary?.rules.simulationOnly ?? 0} sim-only`}
          icon={<Bot className="h-5 w-5 text-slate-500" />}
        />
        <StatCard
          title="Queue"
          value={summary ? summary.queue.pending + summary.queue.processing : 0}
          sub={`Pending ${summary?.queue.pending ?? 0} • Processing ${summary?.queue.processing ?? 0}`}
          tone={summary && summary.queue.failed > 0 ? "rose" : summary && summary.queue.pending > 10 ? "amber" : "emerald"}
          icon={<Play className="h-5 w-5 text-slate-500" />}
        />
        <StatCard
          title="Audits"
          value={summary?.audits.total ?? 0}
          sub={`Matched ${summary?.audits.matched ?? 0} • Skipped ${summary?.audits.unmatched ?? 0}`}
          icon={<CheckCircle2 className="h-5 w-5 text-slate-500" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Queue Health</p>
              <h3 className="text-lg font-semibold text-slate-900">Action pipeline</h3>
            </div>
            {summary?.queue.failed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                <AlertTriangle className="h-3 w-3" /> {summary.queue.failed} failed
              </span>
            ) : null}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MiniMetric label="Pending" value={summary?.queue.pending ?? 0} tone="amber" />
            <MiniMetric label="Processing" value={summary?.queue.processing ?? 0} tone="sky" />
            <MiniMetric label="Completed (24h)" value={summary?.queue.completed ?? 0} tone="emerald" />
            <MiniMetric label="Failed" value={summary?.queue.failed ?? 0} tone="rose" />
            <MiniMetric label="Max attempts" value={summary?.queue.maxAttempt ?? 0} tone="slate" />
            <MiniMetric label="Next scheduled" value={summary?.queue.nextScheduled ? new Date(summary.queue.nextScheduled).toLocaleString() : "–"} tone="slate" />
          </div>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <div className="flex items-center justify-between">
              <span>Oldest pending</span>
              <span className="font-semibold text-slate-900">{summary?.queue.oldestPending ? new Date(summary.queue.oldestPending).toLocaleString() : "–"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent Activity</p>
              <h3 className="text-lg font-semibold text-slate-900">Audit trail</h3>
            </div>
          </div>
          {summary?.audits.total ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{summary.audits.lastCreatedAt ? new Date(summary.audits.lastCreatedAt).toLocaleString() : "–"}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${summary.audits.lastOutcome === "matched" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {summary.audits.lastOutcome || "unknown"}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{summary.audits.lastRule || "Unattributed"}</div>
                <div className="mt-1 text-xs text-slate-600 break-words">{summary.audits.lastEvent || "No payload captured"}</div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <MiniMetric label="Matched" value={summary.audits.matched} tone="emerald" />
                <MiniMetric label="Skipped" value={summary.audits.unmatched} tone="slate" />
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500">No audits yet. Run a simulation or let a trigger fire.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub, icon, tone = "slate" }: { title: string; value: number; sub: string; icon: React.ReactNode; tone?: "slate" | "emerald" | "amber" | "rose" }) {
  const toneClasses = tone === "emerald" ? "bg-emerald-50 text-emerald-700" : tone === "amber" ? "bg-amber-50 text-amber-700" : tone === "rose" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700";
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="rounded-full bg-slate-50 p-2 text-slate-600">{icon}</div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClasses}`}>{title}</span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-sm text-slate-500">{sub}</div>
    </div>
  );
}

function MiniMetric({ label, value, tone }: { label: string; value: number | string; tone: "emerald" | "amber" | "rose" | "sky" | "slate" }) {
  const toneMap: Record<typeof tone, string> = {
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    sky: "bg-sky-50 text-sky-700",
    slate: "bg-slate-50 text-slate-700",
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold">
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${toneMap[tone]}`}>{value}</span>
      </div>
    </div>
  );
}
