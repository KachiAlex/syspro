"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

type Line = {
  lineNumber: number;
  accountCode: string;
  accountName: string;
  description: string | null;
  budgeted: number;
  actual: number;
  variance: number;
  variancePct: number | null;
};

type BudgetReport = {
  budgetId: string;
  code: string;
  name: string;
  periodType: string;
  fiscalYear: number;
  status: string;
  periodStart: string;
  periodEnd: string;
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  lines: Line[];
};

function varianceBadge(v: number, isRevenueType: boolean) {
  // For expense accounts over-budget (positive variance) is bad; under is good.
  const bad = isRevenueType ? v < 0 : v > 0;
  const cls = Math.abs(v) < 0.01
    ? "text-theme-text-secondary"
    : bad ? "text-rose-400" : "text-emerald-400";
  return cls;
}

export default function BudgetVsActualPage() {
  const { tenantSlug } = useTenantContext();
  const [reports, setReports] = useState<BudgetReport[]>([]);
  const [fiscalYear, setFiscalYear] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const qs = `?tenantSlug=${tenantSlug}${fiscalYear ? `&fiscalYear=${fiscalYear}` : ""}`;
      const res = await fetch(`/api/finance/reports/budget-vs-actual${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load report");
      setReports(data.report ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, fiscalYear]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Budget vs Actual</h1>
            <p className="text-sm text-theme-text-secondary">Posted GL actuals vs approved budget lines</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number" placeholder="Fiscal year" value={fiscalYear}
            onChange={(e) => setFiscalYear(e.target.value)}
            className="w-32 rounded bg-theme-muted px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      {!loading && reports.length === 0 && !error && (
        <p className="text-sm text-theme-text-secondary">
          No approved budgets found{fiscalYear ? ` for FY${fiscalYear}` : ""}. Create and approve a budget first.
        </p>
      )}

      {reports.map((r) => {
        const usedPct = r.totalBudget > 0 ? Math.round((r.totalActual / r.totalBudget) * 100) : 0;
        return (
          <div key={r.budgetId} className="rounded-lg border border-theme-border bg-theme-surface/60">
            <div className="flex items-center justify-between border-b border-theme-border px-4 py-3">
              <div>
                <span className="font-semibold">{r.code}</span>
                <span className="ml-2 text-theme-text-primary">{r.name}</span>
                <span className="ml-3 rounded bg-theme-elevated px-2 py-0.5 text-xs">{r.periodType} FY{r.fiscalYear}</span>
              </div>
              <div className="text-sm text-theme-text-secondary">{r.periodStart} → {r.periodEnd}</div>
            </div>

            <div className="grid grid-cols-4 gap-4 border-b border-theme-border px-4 py-3 text-sm">
              <div><div className="text-theme-text-secondary text-xs">Budgeted</div><div className="font-semibold">{fmt(r.totalBudget)}</div></div>
              <div><div className="text-theme-text-secondary text-xs">Actual</div><div className="font-semibold">{fmt(r.totalActual)}</div></div>
              <div>
                <div className="text-theme-text-secondary text-xs">Variance</div>
                <div className={`font-semibold ${varianceBadge(r.totalVariance, false)}`}>
                  {r.totalVariance >= 0 ? "+" : ""}{fmt(r.totalVariance)}
                </div>
              </div>
              <div>
                <div className="text-theme-text-secondary text-xs">Budget used</div>
                <div className={`font-semibold ${usedPct > 100 ? "text-rose-400" : usedPct > 85 ? "text-amber-400" : "text-emerald-400"}`}>
                  {usedPct}%
                </div>
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-theme-text-secondary">
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">Budgeted</th>
                  <th className="px-4 py-2 text-right">Actual</th>
                  <th className="px-4 py-2 text-right">Variance</th>
                  <th className="px-4 py-2 text-right">Var %</th>
                </tr>
              </thead>
              <tbody>
                {r.lines.map((l) => (
                  <tr key={l.lineNumber} className="border-t border-theme-border">
                    <td className="px-4 py-2">{l.accountCode} — {l.accountName}</td>
                    <td className="px-4 py-2 text-theme-text-secondary">{l.description ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{fmt(l.budgeted)}</td>
                    <td className="px-4 py-2 text-right">{fmt(l.actual)}</td>
                    <td className={`px-4 py-2 text-right ${varianceBadge(l.variance, false)}`}>
                      {l.variance >= 0 ? "+" : ""}{fmt(l.variance)}
                    </td>
                    <td className={`px-4 py-2 text-right ${varianceBadge(l.variance, false)}`}>
                      {l.variancePct === null ? "—" : `${l.variancePct >= 0 ? "+" : ""}${l.variancePct}%`}
                    </td>
                  </tr>
                ))}
                {r.lines.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-3 text-center text-theme-text-tertiary">No budget lines</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
