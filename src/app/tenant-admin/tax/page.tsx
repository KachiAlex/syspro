"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle, FileCheck2, Landmark, Loader2, Percent, Receipt, X,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

type TaxRate = {
  id: string; tax_type: string; name: string; rate: number;
  effective_from: string; effective_to: string | null; is_active: boolean;
};
type TaxReturn = {
  id: string; tax_type: string; period_start: string; period_end: string;
  total_tax_collected: number; total_tax_paid: number; total_tax_withheld: number;
  net_tax_payable: number; status: string; filed_date: string | null; paid_date: string | null;
};
type TaxTxn = {
  id: string; transaction_type: string; source_type: string; transaction_date: string;
  description: string; base_amount: number; tax_rate: number; tax_amount: number;
};

const retStatus = (s: string) =>
  s === "paid" ? "bg-emerald-500/15 text-emerald-400"
  : s === "filed" ? "bg-sky-500/15 text-sky-400"
  : s === "overdue" ? "bg-rose-500/15 text-rose-400"
  : "bg-theme-muted/15 text-theme-text-secondary";

export default function TaxPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"returns" | "rates" | "transactions">("returns");
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [returns, setReturns] = useState<TaxReturn[]>([]);
  const [txns, setTxns] = useState<TaxTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [showRate, setShowRate] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [fileFor, setFileFor] = useState<TaxReturn | null>(null);
  const [fileRef, setFileRef] = useState("");
  const [rateForm, setRateForm] = useState({
    taxType: "vat", name: "", rate: "", effectiveFrom: today(), effectiveTo: "",
  });
  const [retForm, setRetForm] = useState({
    taxType: "vat", periodStart: "", periodEnd: "", notes: "",
  });

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const [r, ret, tx] = await Promise.all([
        fetch(`/api/finance/tax-management?${qs()}&resource=rates`).then((x) => x.json()),
        fetch(`/api/finance/tax-management?${qs()}&resource=returns`).then((x) => x.json()),
        fetch(`/api/finance/tax-management?${qs()}&resource=transactions&limit=100`).then((x) => x.json()),
      ]);
      setRates(r.data ?? []);
      setReturns(ret.data ?? []);
      setTxns(tx.data ?? []);
      if (r.error) setError(r.error);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const post = async (url: string, body: any, success: string, onDone?: () => void, method = "POST") => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error ?? "Request failed");
      setMsg(success); onDone?.();
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Tax Management</h1>
            <p className="text-sm text-theme-text-secondary">Tax rates, periodic returns, and transaction ledger</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRate(true)}
            className="flex items-center gap-1.5 rounded bg-theme-elevated px-3 py-1.5 text-sm hover:bg-theme-elevated">
            <Percent className="h-4 w-4" /> New rate
          </button>
          <button onClick={() => setShowReturn(true)}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
            <Receipt className="h-4 w-4" /> New return
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}

      <div className="flex gap-1 border-b border-theme-border">
        {([["returns", "Returns"], ["rates", "Rates"], ["transactions", "Transactions"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === key ? "border-sky-400 text-sky-400" : "border-transparent text-theme-text-secondary hover:text-theme-text-primary"}`}>
            {label}
          </button>
        ))}
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      {tab === "returns" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-theme-text-secondary">
              {["Type", "Period", "Collected", "Paid/WHT", "Net payable", "Status", ""].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id} className="border-t border-theme-border">
                <td className="px-3 py-2 uppercase">{r.tax_type}</td>
                <td className="px-3 py-2">{String(r.period_start).slice(0, 10)} → {String(r.period_end).slice(0, 10)}</td>
                <td className="px-3 py-2">{fmt(r.total_tax_collected)}</td>
                <td className="px-3 py-2 text-theme-text-secondary">{fmt(r.total_tax_paid + r.total_tax_withheld)}</td>
                <td className="px-3 py-2 font-semibold">{fmt(r.net_tax_payable)}</td>
                <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${retStatus(r.status)}`}>{r.status}</span></td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    {r.status === "draft" && (
                      <button onClick={() => { setFileRef(""); setFileFor(r); }}
                        className="flex items-center gap-1 text-xs text-sky-400 hover:underline">
                        <FileCheck2 className="h-3 w-3" /> File
                      </button>
                    )}
                    {r.status === "filed" && (
                      <button disabled={busy}
                        onClick={() => void post(`/api/finance/tax-management?${qs()}&id=${r.id}`, { action: "mark_paid" }, "Return marked paid", undefined, "PATCH")}
                        className="text-xs text-emerald-400 hover:underline">Mark paid</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {returns.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-theme-text-tertiary">No tax returns — create one per filing period.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "rates" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-theme-text-secondary">
              {["Type", "Name", "Rate", "Effective", "Active"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className="border-t border-theme-border">
                <td className="px-3 py-2 uppercase">{r.tax_type}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">{r.rate}%</td>
                <td className="px-3 py-2 text-theme-text-secondary">
                  {String(r.effective_from).slice(0, 10)}{r.effective_to ? ` → ${String(r.effective_to).slice(0, 10)}` : " →"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${r.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-theme-muted/15 text-theme-text-secondary"}`}>
                    {r.is_active ? "yes" : "no"}
                  </span>
                </td>
              </tr>
            ))}
            {rates.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-theme-text-tertiary">No tax rates defined</td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "transactions" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-theme-text-secondary">
              {["Date", "Type", "Source", "Description", "Base", "Rate", "Tax"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {txns.map((t) => (
              <tr key={t.id} className="border-t border-theme-border">
                <td className="px-3 py-2">{String(t.transaction_date).slice(0, 10)}</td>
                <td className="px-3 py-2 text-theme-text-secondary">{t.transaction_type}</td>
                <td className="px-3 py-2 text-theme-text-secondary">{t.source_type}</td>
                <td className="px-3 py-2">{t.description}</td>
                <td className="px-3 py-2">{fmt(t.base_amount)}</td>
                <td className="px-3 py-2 text-theme-text-secondary">{t.tax_rate}%</td>
                <td className="px-3 py-2">{fmt(t.tax_amount)}</td>
              </tr>
            ))}
            {txns.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-theme-text-tertiary">No tax transactions recorded</td></tr>
            )}
          </tbody>
        </table>
      )}

      {showRate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="w-full max-w-sm rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New tax rate</h2>
              <button onClick={() => setShowRate(false)}><X className="h-4 w-4" /></button>
            </div>
            <label className="block text-xs text-theme-text-secondary">Type
              <select className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                value={rateForm.taxType} onChange={(e) => setRateForm({ ...rateForm, taxType: e.target.value })}>
                <option value="vat">VAT</option><option value="wht">Withholding tax</option>
                <option value="paye">PAYE</option><option value="company_tax">Company income tax</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Name (e.g. Standard VAT 7.5%)"
              value={rateForm.name} onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-theme-text-secondary">Rate %
                <input type="number" step="any" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} />
              </label>
              <label className="text-xs text-theme-text-secondary">Effective from
                <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={rateForm.effectiveFrom} onChange={(e) => setRateForm({ ...rateForm, effectiveFrom: e.target.value })} />
              </label>
            </div>
            <button disabled={busy || !rateForm.name || !rateForm.rate}
              onClick={() => void post(`/api/finance/tax-management?${qs()}`, {
                action: "create_rate", tenantSlug, ...rateForm,
                effectiveTo: rateForm.effectiveTo || undefined,
              }, "Tax rate created", () => setShowRate(false))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Saving…" : "Create rate"}
            </button>
          </div>
        </div>
      )}

      {showReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="w-full max-w-sm rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New tax return</h2>
              <button onClick={() => setShowReturn(false)}><X className="h-4 w-4" /></button>
            </div>
            <label className="block text-xs text-theme-text-secondary">Type
              <select className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                value={retForm.taxType} onChange={(e) => setRetForm({ ...retForm, taxType: e.target.value })}>
                <option value="vat">VAT</option><option value="wht">Withholding tax</option>
                <option value="paye">PAYE</option><option value="company_tax">Company income tax</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-theme-text-secondary">Period start
                <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={retForm.periodStart} onChange={(e) => setRetForm({ ...retForm, periodStart: e.target.value })} />
              </label>
              <label className="text-xs text-theme-text-secondary">Period end
                <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={retForm.periodEnd} onChange={(e) => setRetForm({ ...retForm, periodEnd: e.target.value })} />
              </label>
            </div>
            <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Notes (optional)"
              value={retForm.notes} onChange={(e) => setRetForm({ ...retForm, notes: e.target.value })} />
            <button disabled={busy || !retForm.periodStart || !retForm.periodEnd}
              onClick={() => void post(`/api/finance/tax-management?${qs()}`, {
                action: "create_return", tenantSlug, ...retForm,
              }, "Tax return created", () => setShowReturn(false))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Creating…" : "Create return"}
            </button>
          </div>
        </div>
      )}

      {fileFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="w-full max-w-sm rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">File {fileFor.tax_type.toUpperCase()} return</h2>
              <button onClick={() => setFileFor(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-theme-text-secondary">
              {String(fileFor.period_start).slice(0, 10)} → {String(fileFor.period_end).slice(0, 10)} — net payable {fmt(fileFor.net_tax_payable)}
            </p>
            <label className="block text-xs text-theme-text-secondary">Filing reference (e.g. FIRS acknowledgement no.)
              <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                value={fileRef} onChange={(e) => setFileRef(e.target.value)} />
            </label>
            <button disabled={busy}
              onClick={() => void post(`/api/finance/tax-management?${qs()}&id=${fileFor.id}`, {
                action: "file", reference: fileRef,
              }, "Return filed", () => setFileFor(null), "PATCH")}
              className="w-full rounded bg-sky-600 py-2 text-sm hover:bg-sky-500 disabled:opacity-50">
              {busy ? "Filing…" : "Mark as filed"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
