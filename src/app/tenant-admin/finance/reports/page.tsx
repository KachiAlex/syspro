"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { BookmarkPlus, Download, Play, Trash2, FileText } from "lucide-react";

interface ReportDef {
  key: string;
  label: string;
  group: string;
  endpoint: string;
  dateMode: "range" | "asOf" | "none";
  itemWise?: boolean;
  extraParams?: Record<string, string>;
}

const REPORT_DEFS: ReportDef[] = [
  { key: "pnl", label: "Profit & Loss", group: "Financial Statements", endpoint: "/api/finance/reports/pnl", dateMode: "range" },
  { key: "comparative-pnl", label: "Comparative P&L", group: "Financial Statements", endpoint: "/api/finance/reports/comparative-pnl", dateMode: "range" },
  { key: "balance-sheet", label: "Balance Sheet", group: "Financial Statements", endpoint: "/api/finance/reports/balance-sheet", dateMode: "asOf" },
  { key: "cash-flow", label: "Cash Flow", group: "Financial Statements", endpoint: "/api/finance/reports/cash-flow", dateMode: "range" },
  { key: "trial-balance", label: "Trial Balance", group: "Financial Statements", endpoint: "/api/finance/reports/trial-balance", dateMode: "asOf" },
  { key: "general-ledger", label: "General Ledger", group: "Financial Statements", endpoint: "/api/finance/reports/general-ledger", dateMode: "range" },
  { key: "aged-receivables", label: "Aged Receivables", group: "Receivables", endpoint: "/api/finance/reports/aged-receivables", dateMode: "asOf" },
  { key: "sales-register", label: "Sales Register", group: "Receivables", endpoint: "/api/finance/reports/sales-register", dateMode: "range", itemWise: true },
  { key: "sales-register-item", label: "Item-wise Sales Register", group: "Receivables", endpoint: "/api/finance/reports/sales-register", dateMode: "range" },
  { key: "customer-ledger-summary", label: "Customer Ledger Summary", group: "Receivables", endpoint: "/api/finance/reports/customer-ledger-summary", dateMode: "range" },
  { key: "aged-payables", label: "Aged Payables", group: "Payables", endpoint: "/api/finance/reports/aged-payables", dateMode: "asOf" },
  { key: "purchase-register", label: "Purchase Register", group: "Payables", endpoint: "/api/finance/reports/purchase-register", dateMode: "range", itemWise: true },
  { key: "purchase-register-item", label: "Item-wise Purchase Register", group: "Payables", endpoint: "/api/finance/reports/purchase-register", dateMode: "range" },
  { key: "supplier-ledger-summary", label: "Supplier Ledger Summary", group: "Payables", endpoint: "/api/finance/reports/supplier-ledger-summary", dateMode: "range" },
  { key: "sales-order-analysis", label: "Sales Order Analysis", group: "Orders", endpoint: "/api/finance/reports/order-analysis", dateMode: "range", extraParams: { type: "sales" } },
  { key: "sales-to-be-billed", label: "Sales Orders To Be Billed", group: "Orders", endpoint: "/api/finance/reports/order-analysis", dateMode: "range", extraParams: { type: "sales-to-be-billed" } },
  { key: "sales-to-be-delivered", label: "Sales Orders To Be Delivered", group: "Orders", endpoint: "/api/finance/reports/order-analysis", dateMode: "range", extraParams: { type: "sales-to-be-delivered" } },
  { key: "purchase-order-analysis", label: "Purchase Order Analysis", group: "Orders", endpoint: "/api/finance/reports/order-analysis", dateMode: "range", extraParams: { type: "purchase" } },
  { key: "purchase-to-be-billed", label: "Received Items To Be Billed", group: "Orders", endpoint: "/api/finance/reports/order-analysis", dateMode: "range", extraParams: { type: "purchase-to-be-billed" } },
  { key: "purchase-to-be-received", label: "Items To Be Received", group: "Orders", endpoint: "/api/finance/reports/order-analysis", dateMode: "range", extraParams: { type: "purchase-to-be-received" } },
  { key: "depreciation-ledger", label: "Asset Depreciation Ledger", group: "Assets", endpoint: "/api/finance/reports/depreciation-ledger", dateMode: "range", extraParams: { variant: "ledger" } },
  { key: "asset-balances", label: "Asset Depreciations & Balances", group: "Assets", endpoint: "/api/finance/reports/depreciation-ledger", dateMode: "none", extraParams: { variant: "balances" } },
  { key: "financial-ratios", label: "Financial Ratios", group: "Analytics", endpoint: "/api/finance/reports/advanced", dateMode: "asOf", extraParams: { report: "financial-ratios" } },
  { key: "gross-profit", label: "Gross Profit", group: "Analytics", endpoint: "/api/finance/reports/advanced", dateMode: "range", extraParams: { report: "gross-profit" } },
  { key: "sales-invoice-trends", label: "Sales Invoice Trends", group: "Analytics", endpoint: "/api/finance/reports/advanced", dateMode: "range", extraParams: { report: "sales-invoice-trends" } },
  { key: "purchase-invoice-trends", label: "Purchase Invoice Trends", group: "Analytics", endpoint: "/api/finance/reports/advanced", dateMode: "range", extraParams: { report: "purchase-invoice-trends" } },
  { key: "sales-payment-summary", label: "Sales Payment Summary", group: "Analytics", endpoint: "/api/finance/reports/advanced", dateMode: "range", extraParams: { report: "sales-payment-summary" } },
  { key: "payment-period", label: "Payment Period by Invoice Date", group: "Receivables", endpoint: "/api/finance/reports/advanced", dateMode: "range", extraParams: { report: "payment-period-by-invoice-date" } },
  { key: "trial-balance-for-party", label: "Trial Balance for Party", group: "Other", endpoint: "/api/finance/reports/advanced", dateMode: "asOf", extraParams: { report: "trial-balance-for-party" } },
  { key: "voucher-wise-balance", label: "Voucher-wise Balance", group: "Other", endpoint: "/api/finance/reports/advanced", dateMode: "range", extraParams: { report: "voucher-wise-balance" } },
  { key: "dimension-wise-balance", label: "Dimension-wise Balance", group: "Other", endpoint: "/api/finance/reports/advanced", dateMode: "asOf", extraParams: { report: "dimension-wise-balance" } },
  { key: "bank-recon-statement", label: "Bank Reconciliation Statement", group: "Banking", endpoint: "/api/finance/reports/advanced", dateMode: "asOf", extraParams: { report: "bank-reconciliation-statement" } },
  { key: "billed-to-be-received", label: "Billed Items To Be Received", group: "Orders", endpoint: "/api/finance/reports/advanced", dateMode: "range", extraParams: { report: "billed-items-to-be-received" } },
  { key: "pos-register", label: "POS Register", group: "Orders", endpoint: "/api/finance/reports/advanced", dateMode: "range", extraParams: { report: "pos-register" } },
  { key: "inactive-sales-items", label: "Inactive Sales Items", group: "Analytics", endpoint: "/api/finance/reports/advanced", dateMode: "range", extraParams: { report: "inactive-sales-items" } },
  { key: "invalid-ledger-entries", label: "Invalid Ledger Entries", group: "Other", endpoint: "/api/finance/reports/advanced", dateMode: "none", extraParams: { report: "invalid-ledger-entries" } },
  { key: "budget-vs-actual", label: "Budget vs Actual", group: "Other", endpoint: "/api/finance/reports/budget-vs-actual", dateMode: "none" },
  { key: "by-branch", label: "P&L by Branch", group: "Other", endpoint: "/api/finance/reports/by-branch", dateMode: "range" },
];

interface SavedReport {
  id: string;
  name: string;
  reportKey: string;
  config: Record<string, any>;
  createdBy: string | null;
  isShared: boolean;
}

interface Branch {
  id: string;
  code: string;
  name: string;
}

const GROUP_ORDER = ["Financial Statements", "Receivables", "Payables", "Orders", "Assets", "Analytics", "Banking", "Other"];

/** Recursively find the first array of plain objects in a report payload. */
function findRowArray(data: any, depth = 0): any[] | null {
  if (!data || typeof data !== "object" || depth > 4) return null;
  if (Array.isArray(data)) {
    return data.length && typeof data[0] === "object" && data[0] !== null ? data : null;
  }
  for (const key of ["rows", "lines", "items", "receivables", "payables", "accounts", "entries", "data", "branches"]) {
    const found = findRowArray(data[key], depth + 1);
    if (found) return found;
  }
  for (const v of Object.values(data)) {
    if (Array.isArray(v) && v.length && typeof v[0] === "object") {
      const found = findRowArray(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function cellValue(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") return "";
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}

export default function FinanceReportsPage() {
  const { tenantSlug } = useTenantContext();
  const [reportKey, setReportKey] = useState(REPORT_DEFS[0].key);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [asOfDate, setAsOfDate] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const def = useMemo(() => REPORT_DEFS.find((r) => r.key === reportKey) ?? REPORT_DEFS[0], [reportKey]);
  const isItemWise = reportKey.endsWith("-item");

  useEffect(() => {
    const now = new Date();
    setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
    setEndDate(now.toISOString().slice(0, 10));
    setAsOfDate(now.toISOString().slice(0, 10));
  }, []);

  const loadSaved = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      const res = await fetch(`/api/finance/saved-reports?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const json = await res.json();
      if (json.success) setSaved(json.data);
    } catch { /* non-fatal */ }
  }, [tenantSlug]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  useEffect(() => {
    if (!tenantSlug) return;
    fetch(`/api/finance/branches?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((j) => {
        const list = j.data ?? j.branches ?? [];
        setBranches(list.map((b: any) => ({ id: b.id, code: b.code, name: b.name })));
      })
      .catch(() => undefined);
  }, [tenantSlug]);

  const buildUrl = useCallback((d: ReportDef, cfg: { startDate?: string; endDate?: string; asOfDate?: string; branchId?: string; itemWise?: boolean }, format?: string) => {
    const p = new URLSearchParams({ tenantSlug: tenantSlug ?? "" });
    if (d.dateMode === "range") {
      if (cfg.startDate) p.set("periodStart", cfg.startDate);
      if (cfg.endDate) p.set("periodEnd", cfg.endDate);
    } else if (d.dateMode === "asOf" && cfg.asOfDate) {
      p.set("asOfDate", cfg.asOfDate);
    }
    if (cfg.branchId) p.set("branchId", cfg.branchId);
    if (cfg.itemWise) p.set("itemWise", "true");
    for (const [k, v] of Object.entries(d.extraParams ?? {})) p.set(k, v);
    if (format) p.set("format", format);
    return `${d.endpoint}?${p.toString()}`;
  }, [tenantSlug]);

  const currentConfig = useCallback(() => ({
    startDate, endDate, asOfDate, branchId: branchId || undefined,
    itemWise: isItemWise || undefined,
  }), [startDate, endDate, asOfDate, branchId, isItemWise]);

  const runReport = useCallback(async (d: ReportDef, cfg: ReturnType<typeof currentConfig>) => {
    setRunning(true);
    setAlert(null);
    try {
      const res = await fetch(buildUrl(d, cfg));
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Request failed (${res.status})`);
      setResult(json.data);
    } catch (err: any) {
      setResult(null);
      setAlert({ type: "error", message: err?.message ?? "Failed to run report" });
    } finally {
      setRunning(false);
    }
  }, [buildUrl]);

  const downloadCsv = useCallback(async (d: ReportDef, cfg: ReturnType<typeof currentConfig>) => {
    try {
      const res = await fetch(buildUrl(d, cfg, "csv"));
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${d.key}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setAlert({ type: "error", message: err?.message ?? "Export failed" });
    }
  }, [buildUrl]);

  const saveReport = async () => {
    if (!saveName.trim() || !tenantSlug) return;
    setSaving(true);
    try {
      const res = await fetch("/api/finance/saved-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          name: saveName.trim(),
          reportKey,
          config: currentConfig(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Save failed");
      setSaveName("");
      setAlert({ type: "success", message: `Saved "${json.data.name}"` });
      await loadSaved();
    } catch (err: any) {
      setAlert({ type: "error", message: err?.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const runSaved = async (sr: SavedReport) => {
    const d = REPORT_DEFS.find((r) => r.key === sr.reportKey);
    if (!d) {
      setAlert({ type: "error", message: `Unknown report type "${sr.reportKey}"` });
      return;
    }
    setReportKey(sr.reportKey);
    const cfg = sr.config ?? {};
    if (cfg.startDate) setStartDate(cfg.startDate);
    if (cfg.endDate) setEndDate(cfg.endDate);
    if (cfg.asOfDate) setAsOfDate(cfg.asOfDate);
    setBranchId(cfg.branchId ?? "");
    await runReport(d, { startDate: cfg.startDate, endDate: cfg.endDate, asOfDate: cfg.asOfDate, branchId: cfg.branchId, itemWise: cfg.itemWise });
  };

  const deleteSaved = async (sr: SavedReport) => {
    if (!tenantSlug) return;
    try {
      const res = await fetch(`/api/finance/saved-reports/${sr.id}?tenantSlug=${encodeURIComponent(tenantSlug)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await loadSaved();
    } catch (err: any) {
      setAlert({ type: "error", message: err?.message ?? "Delete failed" });
    }
  };

  const tableRows = useMemo(() => (result ? findRowArray(result) : null), [result]);
  const tableCols = useMemo(() => {
    if (!tableRows) return [];
    const keys = new Set<string>();
    tableRows.forEach((r) => Object.keys(r).forEach((k) => {
      if (typeof r[k] !== "object") keys.add(k);
    }));
    return Array.from(keys).slice(0, 12);
  }, [tableRows]);

  const groupedSaved = useMemo(() => {
    const map = new Map<string, SavedReport[]>();
    for (const sr of saved) {
      const d = REPORT_DEFS.find((r) => r.key === sr.reportKey);
      const g = d?.group ?? "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(sr);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g)! }));
  }, [saved]);

  return (
    <div className="min-h-screen bg-theme-muted p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {alert && (
          <div className={`p-4 rounded-lg border ${alert.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            <div className="flex items-center justify-between">
              <span>{alert.message}</span>
              <button onClick={() => setAlert(null)} className="hover:opacity-70">×</button>
            </div>
          </div>
        )}

        <div>
          <h1 className="text-3xl font-bold text-theme-text-primary">Financial Reports</h1>
          <p className="text-theme-text-primary mt-1">Run canonical reports, save filter combinations, export to CSV</p>
        </div>

        {/* Report runner */}
        <div className="bg-theme-surface rounded-lg shadow-sm border border-theme-border p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Report</label>
              <select
                value={reportKey}
                onChange={(e) => { setReportKey(e.target.value); setResult(null); }}
                className="w-full px-4 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent"
              >
                {GROUP_ORDER.map((g) => (
                  <optgroup key={g} label={g}>
                    {REPORT_DEFS.filter((r) => r.group === g).map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {def.dateMode === "range" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-theme-text-primary mb-2">From</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text-primary mb-2">To</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent" />
                </div>
              </>
            )}
            {def.dateMode === "asOf" && (
              <div>
                <label className="block text-sm font-medium text-theme-text-primary mb-2">As of</label>
                <input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)}
                  className="w-full px-4 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent" />
              </div>
            )}
            {def.dateMode === "none" && <div className="md:col-span-2" />}

            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Branch</label>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-4 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent">
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              onClick={() => runReport(def, currentConfig())}
              disabled={running}
              className="flex items-center gap-2 bg-theme-accent text-white px-5 py-2 rounded-lg hover:bg-theme-accent-hover disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {running ? "Running…" : "Run"}
            </button>
            <button
              onClick={() => downloadCsv(def, currentConfig())}
              className="flex items-center gap-2 bg-theme-muted text-theme-text-primary px-4 py-2 rounded-lg hover:bg-theme-muted"
            >
              <Download className="h-4 w-4" />
              CSV
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Save as…"
                className="px-3 py-2 border border-theme-border rounded-lg text-sm w-52 focus:outline-none focus:ring-2 focus:ring-theme-accent"
              />
              <button
                onClick={saveReport}
                disabled={saving || !saveName.trim()}
                className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <BookmarkPlus className="h-4 w-4" />
                {saving ? "Saving…" : "Save view"}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-theme-surface rounded-lg shadow-sm border border-theme-border p-6 overflow-x-auto">
            <h2 className="text-xl font-bold text-theme-text-primary mb-4">{def.label}</h2>
            {tableRows && tableRows.length > 0 ? (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-theme-border">
                    {tableCols.map((c) => (
                      <th key={c} className="text-left py-2 pr-4 font-semibold text-theme-text-primary whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.slice(0, 500).map((row, i) => (
                    <tr key={i} className="border-b border-theme-border hover:bg-theme-muted">
                      {tableCols.map((c) => (
                        <td key={c} className="py-2 pr-4 text-theme-text-primary whitespace-nowrap">{cellValue(row[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8 text-theme-text-secondary">
                <FileText className="h-10 w-10 text-theme-text-secondary mx-auto mb-3" />
                Report returned no tabular rows. Try CSV export for the full payload.
              </div>
            )}
            {tableRows && tableRows.length > 500 && (
              <p className="text-xs text-theme-text-secondary mt-3">Showing first 500 of {tableRows.length} rows — export CSV for the full set.</p>
            )}
          </div>
        )}

        {/* Saved reports */}
        <div className="bg-theme-surface rounded-lg shadow-sm border border-theme-border p-6">
          <h2 className="text-xl font-bold text-theme-text-primary mb-4">Saved Reports</h2>
          {groupedSaved.length === 0 ? (
            <p className="text-sm text-theme-text-secondary">No saved reports yet. Configure filters above and click “Save view”.</p>
          ) : (
            <div className="space-y-6">
              {groupedSaved.map(({ group, items }) => (
                <div key={group}>
                  <h3 className="text-sm font-semibold text-theme-text-secondary uppercase tracking-wide mb-2">{group}</h3>
                  <div className="divide-y divide-theme-border">
                    {items.map((sr) => (
                      <div key={sr.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="font-medium text-theme-text-primary">{sr.name}</p>
                          <p className="text-xs text-theme-text-secondary">
                            {REPORT_DEFS.find((r) => r.key === sr.reportKey)?.label ?? sr.reportKey}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => runSaved(sr)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-theme-accent hover:bg-theme-muted rounded-lg"
                          >
                            <Play className="h-3.5 w-3.5" /> Run
                          </button>
                          <button
                            onClick={() => {
                              const d = REPORT_DEFS.find((r) => r.key === sr.reportKey);
                              const cfg = sr.config ?? {};
                              if (d) {
                                downloadCsv(d, {
                                  startDate: cfg.startDate,
                                  endDate: cfg.endDate,
                                  asOfDate: cfg.asOfDate,
                                  branchId: cfg.branchId,
                                  itemWise: cfg.itemWise,
                                });
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-theme-text-secondary hover:bg-theme-muted rounded-lg"
                          >
                            <Download className="h-3.5 w-3.5" /> CSV
                          </button>
                          <button
                            onClick={() => deleteSaved(sr)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
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
