"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle, CalendarClock, Currency, Loader2, Lock, LockOpen, Play, RefreshCw, X,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { WORLD_CURRENCIES } from "@/lib/currencies";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

type Period = {
  id: string; name: string; fiscal_year: number; period_number: number;
  period_type: string; start_date: string; end_date: string; status: string;
};
type Rate = { id: string; currency: string; rate_date: string; rate: number };
type Reval = {
  id: string; currency: string; direction: string; as_of: string;
  closing_rate: number; delta: number; status: string; journal_entry_id: string | null;
};

const periodBadge = (s: string) =>
  s === "open" ? "bg-emerald-500/15 text-emerald-400"
  : s === "closed" ? "bg-amber-500/15 text-amber-400"
  : "bg-theme-muted/15 text-theme-text-secondary";

export default function PeriodEndPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"periods" | "rates" | "revaluation" | "consolidation">("periods");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [periods, setPeriods] = useState<Period[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [revals, setRevals] = useState<Reval[]>([]);

  const [genForm, setGenForm] = useState({ fiscalYear: String(new Date().getFullYear()), periodType: "month" });
  const [rateForm, setRateForm] = useState({ currency: "", rateDate: today(), rate: "" });
  const [revalForm, setRevalForm] = useState({ asOf: today(), direction: "both" });
  const [reverseFor, setReverseFor] = useState<Reval | null>(null);
  const [reverseDate, setReverseDate] = useState(today());
  const [consoGroup, setConsoGroup] = useState("");
  const [conso, setConso] = useState<{
    group: string; entities: string[]; asOf: string;
    lines: { accountCode: string; accountName: string; debit: number; credit: number; net: number }[];
    eliminations: { intercoReceivable: number; intercoPayable: number; eliminatedNet: number };
    totals: { debit: number; credit: number };
  } | null>(null);
  const [consoAsOf, setConsoAsOf] = useState(today());

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const [p, r, rv] = await Promise.all([
        fetch(`/api/finance/fiscal-periods?${qs()}`).then((x) => x.json()),
        fetch(`/api/finance/exchange-rates?${qs()}`).then((x) => x.json()),
        fetch(`/api/finance/revaluation?${qs()}`).then((x) => x.json()),
      ]);
      setPeriods(p.data ?? []);
      setRates(r.rates ?? []);
      setRevals(rv.revaluations ?? []);
      if (p.error) setError(p.error);
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

  const periodAction = (p: Period, action: "close" | "lock" | "reopen") =>
    void post(`/api/finance/fiscal-periods?${qs()}&id=${p.id}`, { action }, `Period ${action}d`);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-6 w-6 text-sky-400" />
        <div>
          <h1 className="text-xl font-semibold">Period-End Operations</h1>
          <p className="text-sm text-theme-text-secondary">Fiscal period close/lock, exchange rates, and FX revaluation</p>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}

      <div className="flex gap-1 border-b border-theme-border">
        {([["periods", "Fiscal periods"], ["rates", "Exchange rates"], ["revaluation", "FX revaluation"], ["consolidation", "Consolidation"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === key ? "border-sky-400 text-sky-400" : "border-transparent text-theme-text-secondary hover:text-theme-text-primary"}`}>
            {label}
          </button>
        ))}
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      {tab === "periods" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end rounded-lg border border-theme-border bg-theme-surface/60 p-4">
            <label className="text-xs text-theme-text-secondary">Fiscal year
              <input type="number" className="block w-28 rounded bg-theme-muted px-3 py-2 text-sm"
                value={genForm.fiscalYear} onChange={(e) => setGenForm({ ...genForm, fiscalYear: e.target.value })} />
            </label>
            <label className="text-xs text-theme-text-secondary">Period type
              <select className="block rounded bg-theme-muted px-3 py-2 text-sm"
                value={genForm.periodType} onChange={(e) => setGenForm({ ...genForm, periodType: e.target.value })}>
                <option value="month">Monthly</option><option value="quarter">Quarterly</option>
              </select>
            </label>
            <button disabled={busy}
              onClick={() => void post(`/api/finance/fiscal-periods?${qs()}`, {
                action: "generate", tenantSlug,
                fiscalYear: Number(genForm.fiscalYear), periodType: genForm.periodType,
              }, "Periods generated")}
              className="rounded bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              Generate periods
            </button>
            <p className="text-xs text-theme-text-tertiary pb-2">Posting into a closed/locked period is rejected — closing blocks new entries, locking additionally blocks reopening edits to posted data.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-theme-text-secondary">
                {["Period", "Type", "Start", "End", "Status", ""].map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-t border-theme-border">
                  <td className="px-3 py-2">{p.name} <span className="text-xs text-theme-text-tertiary">FY{p.fiscal_year}·#{p.period_number}</span></td>
                  <td className="px-3 py-2 text-theme-text-secondary capitalize">{p.period_type}</td>
                  <td className="px-3 py-2">{String(p.start_date).slice(0, 10)}</td>
                  <td className="px-3 py-2">{String(p.end_date).slice(0, 10)}</td>
                  <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${periodBadge(p.status)}`}>{p.status}</span></td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {p.status === "open" && (
                        <button onClick={() => periodAction(p, "close")}
                          className="flex items-center gap-1 text-xs text-amber-400 hover:underline">
                          <LockOpen className="h-3 w-3" /> Close
                        </button>
                      )}
                      {p.status === "closed" && (
                        <>
                          <button onClick={() => periodAction(p, "lock")}
                            className="flex items-center gap-1 text-xs text-rose-400 hover:underline">
                            <Lock className="h-3 w-3" /> Lock
                          </button>
                          <button onClick={() => periodAction(p, "reopen")}
                            className="flex items-center gap-1 text-xs text-sky-400 hover:underline">
                            <RefreshCw className="h-3 w-3" /> Reopen
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {periods.length === 0 && !loading && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-theme-text-tertiary">No fiscal periods — generate a year above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "rates" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end rounded-lg border border-theme-border bg-theme-surface/60 p-4">
            <label className="text-xs text-theme-text-secondary">Currency
              <select className="block w-48 rounded bg-theme-muted px-3 py-2 text-sm"
                value={rateForm.currency} onChange={(e) => setRateForm({ ...rateForm, currency: e.target.value })}>
                <option value="">Select…</option>
                {WORLD_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-theme-text-secondary">Rate date
              <input type="date" className="block rounded bg-theme-muted px-3 py-2 text-sm"
                value={rateForm.rateDate} onChange={(e) => setRateForm({ ...rateForm, rateDate: e.target.value })} />
            </label>
            <label className="text-xs text-theme-text-secondary">Rate (units per 1 NGN)
              <input type="number" step="any" className="block w-40 rounded bg-theme-muted px-3 py-2 text-sm" placeholder="0.0012"
                value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} />
            </label>
            <button disabled={busy || !rateForm.currency || !Number(rateForm.rate)}
              onClick={() => void post(`/api/finance/exchange-rates?${qs()}`, {
                currency: rateForm.currency, rateDate: rateForm.rateDate, rate: Number(rateForm.rate),
              }, "Rate saved")}
              className="rounded bg-emerald-600 px-3 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              Save rate
            </button>
            <p className="text-xs text-theme-text-tertiary pb-2">
              Rates are foreign units per 1 base unit — foreign amount ÷ rate = base amount.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-theme-text-secondary">
                {["Currency", "Date", "Rate"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rates.slice(0, 100).map((r) => (
                <tr key={r.id} className="border-t border-theme-border">
                  <td className="px-3 py-2 font-semibold">{r.currency}</td>
                  <td className="px-3 py-2">{String(r.rate_date).slice(0, 10)}</td>
                  <td className="px-3 py-2 font-mono">{r.rate}</td>
                </tr>
              ))}
              {rates.length === 0 && !loading && (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-theme-text-tertiary">No rates recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "revaluation" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end rounded-lg border border-theme-border bg-theme-surface/60 p-4">
            <label className="text-xs text-theme-text-secondary">As-of date
              <input type="date" className="block rounded bg-theme-muted px-3 py-2 text-sm"
                value={revalForm.asOf} onChange={(e) => setRevalForm({ ...revalForm, asOf: e.target.value })} />
            </label>
            <label className="text-xs text-theme-text-secondary">Direction
              <select className="block rounded bg-theme-muted px-3 py-2 text-sm"
                value={revalForm.direction} onChange={(e) => setRevalForm({ ...revalForm, direction: e.target.value })}>
                <option value="both">AR + AP</option><option value="ar">Receivables only</option>
                <option value="ap">Payables only</option>
              </select>
            </label>
            <button disabled={busy}
              onClick={() => void post(`/api/finance/revaluation?${qs()}`, {
                action: "revalue", asOf: revalForm.asOf, direction: revalForm.direction,
              }, "Revaluation posted")}
              className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-2 text-sm hover:bg-sky-500 disabled:opacity-50">
              <Play className="h-4 w-4" /> Run revaluation
            </button>
            <p className="text-xs text-theme-text-tertiary pb-2">
              Revalues open foreign-currency AR/AP at the closing rate — unrealized gain/loss posts to 7700.
              Reverse at the start of the next period.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-theme-text-secondary">
                {["Currency", "Side", "As of", "Closing rate", "Unrealized Δ", "Status", ""].map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {revals.map((r) => (
                <tr key={r.id} className="border-t border-theme-border">
                  <td className="px-3 py-2 font-semibold">{r.currency}</td>
                  <td className="px-3 py-2 uppercase text-theme-text-secondary">{r.direction}</td>
                  <td className="px-3 py-2">{String(r.as_of).slice(0, 10)}</td>
                  <td className="px-3 py-2 font-mono">{r.closing_rate}</td>
                  <td className={`px-3 py-2 ${r.delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {r.delta >= 0 ? "+" : ""}{fmt(r.delta)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${r.status === "posted" ? "bg-emerald-500/15 text-emerald-400" : "bg-theme-muted/15 text-theme-text-secondary"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.status === "posted" && (
                      <button onClick={() => { setReverseDate(today()); setReverseFor(r); }}
                        className="text-xs text-amber-400 hover:underline">Reverse</button>
                    )}
                  </td>
                </tr>
              ))}
              {revals.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-theme-text-tertiary">No revaluations yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "consolidation" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end rounded-lg border border-theme-border bg-theme-surface/60 p-4">
            <label className="text-xs text-theme-text-secondary">Consolidation group
              <input className="block w-44 rounded bg-theme-muted px-3 py-2 text-sm" placeholder="e.g. GROUP-A"
                value={consoGroup} onChange={(e) => setConsoGroup(e.target.value)} />
            </label>
            <button disabled={busy || !consoGroup}
              onClick={() => void post(`/api/finance/reports/consolidated?${qs()}`, { group: consoGroup }, "Group assigned")}
              className="rounded bg-theme-elevated px-3 py-2 text-sm hover:bg-theme-elevated disabled:opacity-50">
              Set group
            </button>
            <label className="text-xs text-theme-text-secondary">As of
              <input type="date" className="block rounded bg-theme-muted px-3 py-2 text-sm"
                value={consoAsOf} onChange={(e) => setConsoAsOf(e.target.value)} />
            </label>
            <button
              onClick={async () => {
                setError(null);
                const data = await (await fetch(`/api/finance/reports/consolidated?${qs()}&asOf=${consoAsOf}`)).json();
                if (data.error) { setError(data.error); setConso(null); } else setConso(data);
              }}
              className="rounded bg-sky-600 px-3 py-2 text-sm hover:bg-sky-500">
              Load consolidated TB
            </button>
            <p className="text-xs text-theme-text-tertiary pb-2">
              Assigns this tenant to a consolidation group, then aggregates the trial balance across all member tenants with intercompany eliminations.
            </p>
          </div>
          {conso && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-4">
                {[
                  ["Group", conso.group], ["Entities", conso.entities.join(", ")],
                  ["Interco receivable", fmt(conso.eliminations.intercoReceivable)],
                  ["Interco payable", fmt(conso.eliminations.intercoPayable)],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg border border-theme-border bg-theme-surface/60 px-4 py-3">
                    <div className="text-xs text-theme-text-secondary">{l}</div>
                    <div className="text-sm font-semibold truncate">{v}</div>
                  </div>
                ))}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-theme-text-secondary">
                    {["Account", "Name", "Dr", "Cr", "Net"].map((h) => (
                      <th key={h} className="px-3 py-2 text-right first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {conso.lines.map((l) => (
                    <tr key={l.accountCode} className="border-t border-theme-border">
                      <td className="px-3 py-1.5 font-mono text-xs">{l.accountCode}</td>
                      <td className="px-3 py-1.5 text-right">{l.accountName}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(l.debit)}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(l.credit)}</td>
                      <td className={`px-3 py-1.5 text-right ${l.net < 0 ? "text-rose-400" : ""}`}>{fmt(l.net)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-theme-border font-semibold">
                    <td className="px-3 py-2" colSpan={2}>Totals</td>
                    <td className="px-3 py-2 text-right">{fmt(conso.totals.debit)}</td>
                    <td className="px-3 py-2 text-right">{fmt(conso.totals.credit)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-theme-text-tertiary">
                Eliminated net intercompany: {fmt(conso.eliminations.eliminatedNet)}
              </p>
            </div>
          )}
        </div>
      )}

      {reverseFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="w-full max-w-sm rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Reverse revaluation</h2>
              <button onClick={() => setReverseFor(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-theme-text-secondary">
              {reverseFor.currency} {reverseFor.direction.toUpperCase()} as of {String(reverseFor.as_of).slice(0, 10)} — Δ {fmt(reverseFor.delta)}.
              The original JE will be reversed on the date below.
            </p>
            <label className="block text-xs text-theme-text-secondary">Reversal date
              <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                value={reverseDate} onChange={(e) => setReverseDate(e.target.value)} />
            </label>
            <button disabled={busy}
              onClick={() => void post(`/api/finance/revaluation?${qs()}`, {
                action: "reverse", revaluationId: reverseFor.id,
                reversalDate: reverseDate, asOf: reverseDate,
              }, "Revaluation reversed", () => setReverseFor(null))}
              className="w-full rounded bg-amber-600 py-2 text-sm hover:bg-amber-500 disabled:opacity-50">
              {busy ? "Reversing…" : "Reverse"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
