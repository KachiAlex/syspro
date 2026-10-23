"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle, BarChart3, Loader2, ShieldAlert,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

type Dashboard = {
  totalVendors: number; activeVendors: number; totalSpend: number;
  outstandingPayables: number; overdueAmount: number; pendingApprovals: number;
  riskDistribution: { low: number; medium: number; high: number; critical: number };
  monthlyTrend: { month: string; spend: number; payments: number }[];
};
type Spend = {
  vendorId: string; vendorName: string; totalSpend: number; billCount: number;
  avgBillAmount: number; paymentCount: number; lastTransactionDate: string;
  spendTrend: { period: string; amount: number }[];
};
type Aging = {
  vendorId: string; vendorName: string; current: number; days31: number;
  days61: number; days90: number; total: number; oldestOverdueDays: number;
};
type Risk = {
  vendorId: string; vendorName: string; riskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  factors: Record<string, number>; recommendations: string[];
};

const riskBadge = (l: string) =>
  l === "critical" ? "bg-rose-500/15 text-rose-400"
  : l === "high" ? "bg-orange-500/15 text-orange-400"
  : l === "medium" ? "bg-amber-500/15 text-amber-400"
  : "bg-emerald-500/15 text-emerald-400";

export default function VendorAnalyticsPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"dashboard" | "spend" | "aging" | "risk">("dashboard");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [spend, setSpend] = useState<Spend[]>([]);
  const [aging, setAging] = useState<Aging[]>([]);
  const [risk, setRisk] = useState<Risk[]>([]);
  const [dates, setDates] = useState({ from: "", to: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const params = (r: string, extra = "") =>
        `/api/finance/vendor-analytics?${qs()}&report=${r}${extra}`;
      const [d, s, a, rk] = await Promise.all([
        fetch(params("dashboard")).then((x) => x.json()),
        fetch(params("spend", `&limit=50${dates.from ? `&dateFrom=${dates.from}` : ""}${dates.to ? `&dateTo=${dates.to}` : ""}`)).then((x) => x.json()),
        fetch(params("aging")).then((x) => x.json()),
        fetch(params("risk")).then((x) => x.json()),
      ]);
      setDashboard(d.dashboard ?? null);
      setSpend(s.report ?? []);
      setAging(a.report ?? []);
      setRisk(rk.report ?? []);
      if (d.error) setError(d.error);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const maxTrend = dashboard ? Math.max(...dashboard.monthlyTrend.map((t) => t.spend), 1) : 1;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Vendor Analytics</h1>
            <p className="text-sm text-theme-text-secondary">Spend, AP aging, and vendor risk scores</p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs text-theme-text-secondary">From
            <input type="date" className="block rounded bg-theme-muted px-3 py-1.5 text-sm"
              value={dates.from} onChange={(e) => setDates({ ...dates, from: e.target.value })} />
          </label>
          <label className="text-xs text-theme-text-secondary">To
            <input type="date" className="block rounded bg-theme-muted px-3 py-1.5 text-sm"
              value={dates.to} onChange={(e) => setDates({ ...dates, to: e.target.value })} />
          </label>
          <button onClick={() => void load()}
            className="rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500">Apply</button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}

      <div className="flex gap-1 border-b border-theme-border">
        {([["dashboard", "Overview"], ["spend", "Spend"], ["aging", "AP aging"], ["risk", "Risk"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === key ? "border-sky-400 text-sky-400" : "border-transparent text-theme-text-secondary hover:text-theme-text-primary"}`}>
            {label}
          </button>
        ))}
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      {tab === "dashboard" && dashboard && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              ["Vendors", dashboard.totalVendors], ["Active", dashboard.activeVendors],
              ["Total spend", fmt(dashboard.totalSpend)],
              ["Outstanding", fmt(dashboard.outstandingPayables)],
              ["Overdue", fmt(dashboard.overdueAmount)],
              ["Pending approvals", dashboard.pendingApprovals],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-lg border border-theme-border bg-theme-surface/60 px-4 py-3">
                <div className="text-xs text-theme-text-secondary">{l}</div>
                <div className="text-lg font-semibold">{v}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-theme-border bg-theme-surface/60 p-4">
              <h2 className="text-sm font-semibold mb-3">Monthly spend trend</h2>
              <div className="flex items-end gap-1 h-36">
                {dashboard.monthlyTrend.map((t) => (
                  <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-sky-600/70"
                      style={{ height: `${Math.max(4, (t.spend / maxTrend) * 120)}px` }}
                      title={`${t.month}: ${fmt(t.spend)}`} />
                    <span className="text-[10px] text-theme-text-tertiary">{t.month.slice(5, 7)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-theme-border bg-theme-surface/60 p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" /> Risk distribution
              </h2>
              {(["low", "medium", "high", "critical"] as const).map((l) => {
                const total = Object.values(dashboard.riskDistribution).reduce((a, b) => a + b, 0) || 1;
                const n = dashboard.riskDistribution[l];
                return (
                  <div key={l} className="mb-2 flex items-center gap-2 text-sm">
                    <span className="w-16 capitalize">{l}</span>
                    <div className="flex-1 rounded bg-theme-muted h-3">
                      <div className={`h-3 rounded ${
                        l === "low" ? "bg-emerald-500" : l === "medium" ? "bg-amber-500"
                        : l === "high" ? "bg-orange-500" : "bg-rose-500"}`}
                        style={{ width: `${(n / total) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-theme-text-secondary">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "spend" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-theme-text-secondary">
              {["Vendor", "Total spend", "Bills", "Avg bill", "Payments", "Last txn"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spend.map((s) => (
              <tr key={s.vendorId} className="border-t border-theme-border">
                <td className="px-3 py-2">{s.vendorName}</td>
                <td className="px-3 py-2 font-semibold">{fmt(s.totalSpend)}</td>
                <td className="px-3 py-2">{s.billCount}</td>
                <td className="px-3 py-2 text-theme-text-secondary">{fmt(s.avgBillAmount)}</td>
                <td className="px-3 py-2">{s.paymentCount}</td>
                <td className="px-3 py-2 text-theme-text-secondary">
                  {s.lastTransactionDate ? String(s.lastTransactionDate).slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
            {spend.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-theme-text-tertiary">No vendor spend in range</td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "aging" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-theme-text-secondary">
              {["Vendor", "Current", "31–60", "61–90", "90+", "Total", "Oldest overdue"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aging.map((a) => (
              <tr key={a.vendorId} className="border-t border-theme-border">
                <td className="px-3 py-2">{a.vendorName}</td>
                <td className="px-3 py-2">{fmt(a.current)}</td>
                <td className="px-3 py-2">{fmt(a.days31)}</td>
                <td className="px-3 py-2">{fmt(a.days61)}</td>
                <td className={`px-3 py-2 ${a.days90 > 0 ? "text-rose-400" : ""}`}>{fmt(a.days90)}</td>
                <td className="px-3 py-2 font-semibold">{fmt(a.total)}</td>
                <td className="px-3 py-2 text-theme-text-secondary">{a.oldestOverdueDays}d</td>
              </tr>
            ))}
            {aging.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-theme-text-tertiary">No outstanding vendor balances</td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "risk" && (
        <div className="space-y-3">
          {risk.map((r) => (
            <div key={r.vendorId} className="rounded-lg border border-theme-border bg-theme-surface/60 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{r.vendorName}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${riskBadge(r.riskLevel)}`}>
                    {r.riskLevel} · {r.riskScore}/100
                  </span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-theme-text-secondary">
                {Object.entries(r.factors ?? {}).map(([k, v]) => (
                  <span key={k}>{k.replace(/([A-Z])/g, " $1").toLowerCase()}: <b className="text-theme-text-primary">{v}</b></span>
                ))}
              </div>
              {(r.recommendations ?? []).length > 0 && (
                <ul className="mt-2 list-inside list-disc text-xs text-theme-text-secondary">
                  {r.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                </ul>
              )}
            </div>
          ))}
          {risk.length === 0 && !loading && (
            <div className="py-6 text-center text-theme-text-tertiary">No vendors to score</div>
          )}
        </div>
      )}
    </div>
  );
}
