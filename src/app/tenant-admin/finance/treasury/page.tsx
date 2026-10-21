"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Loader2, Play, Plus, RefreshCw } from "lucide-react";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const inputCls = "rounded bg-slate-800 px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

type Tab = "subscriptions" | "guarantees" | "discounting" | "recon-rules" | "rates";

export default function TreasuryPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<Tab>("subscriptions");
  const [plans, setPlans] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [guarantees, setGuarantees] = useState<any[]>([]);
  const [discountings, setDiscountings] = useState<any[]>([]);
  const [reconRules, setReconRules] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/finance/treasury", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, tenantSlug }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Failed");
      setMsg("Done");
      return j.data;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const get = (v: string) => fetch(`/api/finance/treasury?tenantSlug=${encodeURIComponent(tenantSlug)}&view=${v}`).then((r) => r.json());
      if (tab === "subscriptions") {
        const [p, s] = await Promise.all([get("subscription-plans"), get("subscriptions")]);
        if (p.success) setPlans(p.data ?? []);
        if (s.success) setSubs(s.data ?? []);
      } else if (tab === "guarantees") {
        const g = await get("guarantees"); if (g.success) setGuarantees(g.data ?? []);
      } else if (tab === "discounting") {
        const d = await get("discounting"); if (d.success) setDiscountings(d.data ?? []);
      } else if (tab === "recon-rules") {
        const [r, s] = await Promise.all([get("recon-rules"), get("recon-suggestions")]);
        if (r.success) setReconRules(r.data ?? []);
        if (s.success) setSuggestions(s.data ?? []);
      }
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [tenantSlug, tab]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Treasury</h1>
          <p className="text-sm text-slate-400">Subscriptions, bank guarantees, invoice discounting, bank-recon rules, and FX rates.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnCls} onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {(["subscriptions", "guarantees", "discounting", "recon-rules", "rates"] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null); setMsg(null); }}
            className={`px-3 py-2 text-sm whitespace-nowrap ${tab === t ? "border-b-2 border-sky-500 text-sky-400" : "text-slate-400 hover:text-slate-200"}`}>
            {{ "subscriptions": "Subscriptions", "guarantees": "Bank Guarantees", "discounting": "Invoice Discounting", "recon-rules": "Recon Rules", "rates": "FX Rates" }[t]}
          </button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      {tab === "subscriptions" && <SubscriptionsTab plans={plans} subs={subs} post={post} busy={busy} reload={load} />}
      {tab === "guarantees" && <GuaranteesTab rows={guarantees} post={post} busy={busy} reload={load} />}
      {tab === "discounting" && <DiscountingTab rows={discountings} post={post} busy={busy} reload={load} />}
      {tab === "recon-rules" && <ReconTab rules={reconRules} suggestions={suggestions} post={post} busy={busy} reload={load} />}
      {tab === "rates" && <RatesTab post={post} busy={busy} />}
    </div>
  );
}

function SubscriptionsTab({ plans, subs, post, busy, reload }: any) {
  const [planForm, setPlanForm] = useState({ name: "", item: "", unitPrice: "", qty: "1", interval: "monthly" });
  const [subForm, setSubForm] = useState({ customerId: "", planId: "", startDate: "", endDate: "" });
  const planName = (id: string) => plans.find((p: any) => p.id === id)?.name ?? id.slice(0, 8);
  return (
    <div className="space-y-5">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-slate-800 p-4 space-y-3">
          <div className="font-medium text-sm">Plans</div>
          {plans.map((p: any) => (
            <div key={p.id} className="flex justify-between text-sm border-b border-slate-800/60 py-1.5">
              <span>{p.name} <span className="text-slate-400">({p.item} · {p.interval})</span></span>
              <span className="font-mono">{fmt(p.unit_price)}</span>
            </div>
          ))}
          {!plans.length && <div className="text-sm text-slate-500">No plans yet</div>}
          <div className="grid gap-2 sm:grid-cols-2 pt-2">
            <input className={inputCls} placeholder="Plan name" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />
            <input className={inputCls} placeholder="Item" value={planForm.item} onChange={(e) => setPlanForm({ ...planForm, item: e.target.value })} />
            <input className={inputCls} placeholder="Unit price" value={planForm.unitPrice} onChange={(e) => setPlanForm({ ...planForm, unitPrice: e.target.value })} />
            <select className={inputCls} value={planForm.interval} onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value })}>
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
            </select>
          </div>
          <button className={btnCls} disabled={busy || !planForm.name || !planForm.item || !planForm.unitPrice}
            onClick={async () => {
              const r = await post({ action: "upsert-plan", ...planForm, unitPrice: Number(planForm.unitPrice), qty: Number(planForm.qty) || 1 });
              if (r) { setPlanForm({ name: "", item: "", unitPrice: "", qty: "1", interval: "monthly" }); reload(); }
            }}>
            <Plus className="h-3.5 w-3.5" /> Add Plan
          </button>
        </div>

        <div className="rounded border border-slate-800 p-4 space-y-3">
          <div className="font-medium text-sm">New Subscription</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} placeholder="Customer ID" value={subForm.customerId} onChange={(e) => setSubForm({ ...subForm, customerId: e.target.value })} />
            <select className={inputCls} value={subForm.planId} onChange={(e) => setSubForm({ ...subForm, planId: e.target.value })}>
              <option value="">Select plan…</option>
              {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="block"><span className="block text-xs text-slate-400">Start</span><input className={inputCls} type="date" value={subForm.startDate} onChange={(e) => setSubForm({ ...subForm, startDate: e.target.value })} /></label>
            <label className="block"><span className="block text-xs text-slate-400">End (optional)</span><input className={inputCls} type="date" value={subForm.endDate} onChange={(e) => setSubForm({ ...subForm, endDate: e.target.value })} /></label>
          </div>
          <button className={btnCls} disabled={busy || !subForm.customerId || !subForm.planId || !subForm.startDate}
            onClick={async () => {
              const r = await post({ action: "create-subscription", ...subForm, endDate: subForm.endDate || undefined });
              if (r) { setSubForm({ customerId: "", planId: "", startDate: "", endDate: "" }); reload(); }
            }}>
            <Plus className="h-3.5 w-3.5" /> Subscribe
          </button>
          <button className={btnCls} disabled={busy}
            onClick={async () => { const r = await post({ action: "generate-invoices" }); if (r) reload(); }}>
            <Play className="h-3.5 w-3.5" /> Generate Due Invoices
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-400 border-b border-slate-800">
          <th className="py-2 pr-3">Customer</th><th className="py-2 pr-3">Plan</th><th className="py-2 pr-3">Start</th>
          <th className="py-2 pr-3">Next Invoice</th><th className="py-2">Status</th>
        </tr></thead>
        <tbody>
          {subs.map((s: any) => (
            <tr key={s.id} className="border-b border-slate-800/60">
              <td className="py-2 pr-3 font-mono text-xs">{s.customer_id}</td>
              <td className="py-2 pr-3">{planName(s.plan_id)}</td>
              <td className="py-2 pr-3">{String(s.start_date).slice(0, 10)}</td>
              <td className="py-2 pr-3">{String(s.next_invoice_date).slice(0, 10)}</td>
              <td className="py-2">{s.status}</td>
            </tr>
          ))}
          {!subs.length && <tr><td colSpan={5} className="py-6 text-center text-slate-500">No subscriptions</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function GuaranteesTab({ rows, post, busy, reload }: any) {
  const [form, setForm] = useState({ direction: "issued", beneficiary: "", bank: "", amount: "", startDate: "", endDate: "", marginAmount: "", notes: "" });
  const statuses = ["open", "claimed", "released", "expired"];
  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-800 p-4 space-y-3">
        <div className="font-medium text-sm">Issue Bank Guarantee</div>
        <div className="grid gap-2 sm:grid-cols-4">
          <select className={inputCls} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
            <option value="issued">Issued (we give)</option><option value="received">Received (we hold)</option>
          </select>
          <input className={inputCls} placeholder="Beneficiary" value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} />
          <input className={inputCls} placeholder="Bank" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
          <input className={inputCls} placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className={inputCls} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input className={inputCls} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <input className={inputCls} placeholder="Margin amount" value={form.marginAmount} onChange={(e) => setForm({ ...form, marginAmount: e.target.value })} />
          <input className={inputCls} placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
        <button className={btnCls} disabled={busy || !form.beneficiary || !form.bank || !form.amount || !form.startDate || !form.endDate}
          onClick={async () => {
            const r = await post({ action: "issue-guarantee", ...form, amount: Number(form.amount), marginAmount: form.marginAmount ? Number(form.marginAmount) : undefined, notes: form.notes || undefined });
            if (r) { setForm({ direction: "issued", beneficiary: "", bank: "", amount: "", startDate: "", endDate: "", marginAmount: "", notes: "" }); reload(); }
          }}>
          <Plus className="h-3.5 w-3.5" /> Issue
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-400 border-b border-slate-800">
          <th className="py-2 pr-3">Direction</th><th className="py-2 pr-3">Beneficiary</th><th className="py-2 pr-3">Bank</th>
          <th className="py-2 pr-3 text-right">Amount</th><th className="py-2 pr-3">Validity</th><th className="py-2">Status</th>
        </tr></thead>
        <tbody>
          {rows.map((g: any) => (
            <tr key={g.id} className="border-b border-slate-800/60">
              <td className="py-2 pr-3 capitalize">{g.direction}</td>
              <td className="py-2 pr-3">{g.beneficiary}</td>
              <td className="py-2 pr-3">{g.bank}</td>
              <td className="py-2 pr-3 text-right font-mono">{g.currency} {Number(g.amount).toLocaleString()}</td>
              <td className="py-2 pr-3 text-xs">{String(g.start_date).slice(0, 10)} → {String(g.end_date).slice(0, 10)}</td>
              <td className="py-2">
                <select className="rounded bg-slate-800 px-2 py-1 text-xs" value={g.status}
                  onChange={(e) => post({ action: "update-guarantee", id: g.id, status: e.target.value }).then((r: any) => r && reload())}>
                  {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No guarantees</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function DiscountingTab({ rows, post, busy, reload }: any) {
  const [form, setForm] = useState({ invoiceId: "", bank: "", loanAmount: "", disbursementDate: "", periodDays: "90" });
  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-800 p-4 space-y-3">
        <div className="font-medium text-sm">Sanction Invoice Discounting</div>
        <div className="grid gap-2 sm:grid-cols-5">
          <input className={inputCls} placeholder="Invoice ID" value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })} />
          <input className={inputCls} placeholder="Bank" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
          <input className={inputCls} placeholder="Loan amount" value={form.loanAmount} onChange={(e) => setForm({ ...form, loanAmount: e.target.value })} />
          <input className={inputCls} type="date" value={form.disbursementDate} onChange={(e) => setForm({ ...form, disbursementDate: e.target.value })} />
          <input className={inputCls} placeholder="Period days" value={form.periodDays} onChange={(e) => setForm({ ...form, periodDays: e.target.value })} />
        </div>
        <button className={btnCls} disabled={busy || !form.invoiceId || !form.bank || !form.loanAmount || !form.disbursementDate}
          onClick={async () => {
            const r = await post({ action: "sanction-discounting", ...form, loanAmount: Number(form.loanAmount), periodDays: Number(form.periodDays) || 90 });
            if (r) { setForm({ invoiceId: "", bank: "", loanAmount: "", disbursementDate: "", periodDays: "90" }); reload(); }
          }}>
          <Plus className="h-3.5 w-3.5" /> Sanction
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-400 border-b border-slate-800">
          <th className="py-2 pr-3">Invoice</th><th className="py-2 pr-3">Bank</th><th className="py-2 pr-3 text-right">Loan</th>
          <th className="py-2 pr-3">Disbursed</th><th className="py-2 pr-3">Status</th><th className="py-2" />
        </tr></thead>
        <tbody>
          {rows.map((d: any) => (
            <tr key={d.id} className="border-b border-slate-800/60">
              <td className="py-2 pr-3 font-mono text-xs">{String(d.invoice_id).slice(0, 12)}</td>
              <td className="py-2 pr-3">{d.bank}</td>
              <td className="py-2 pr-3 text-right font-mono">{fmt(d.loan_amount)}</td>
              <td className="py-2 pr-3">{String(d.disbursement_date).slice(0, 10)}</td>
              <td className="py-2 pr-3">{d.status}</td>
              <td className="py-2 text-right">
                {d.status === "sanctioned" && (
                  <button className={btnCls} disabled={busy}
                    onClick={async () => { const r = await post({ action: "settle-discounting", id: d.id, settledDate: new Date().toISOString().slice(0, 10) }); if (r) reload(); }}>
                    Settle
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No discountings</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ReconTab({ rules, suggestions, post, busy, reload }: any) {
  const [form, setForm] = useState({ name: "", priority: "0", matchField: "description", pattern: "", accountCode: "", partyType: "", partyId: "", amountTolerance: "" });
  return (
    <div className="space-y-5">
      <div className="rounded border border-slate-800 p-4 space-y-3">
        <div className="font-medium text-sm">New Matching Rule <span className="text-slate-400 font-normal">(regex on imported bank lines)</span></div>
        <div className="grid gap-2 sm:grid-cols-4">
          <input className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          <select className={inputCls} value={form.matchField} onChange={(e) => setForm({ ...form, matchField: e.target.value })}>
            <option value="description">Match description</option><option value="reference">Match reference</option>
          </select>
          <input className={inputCls} placeholder="Regex pattern" value={form.pattern} onChange={(e) => setForm({ ...form, pattern: e.target.value })} />
          <input className={inputCls} placeholder="Account code" value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })} />
          <select className={inputCls} value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value })}>
            <option value="">No party</option><option value="customer">Customer</option><option value="vendor">Vendor</option>
          </select>
          <input className={inputCls} placeholder="Party ID" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} />
          <input className={inputCls} placeholder="Amount tolerance (₦)" value={form.amountTolerance} onChange={(e) => setForm({ ...form, amountTolerance: e.target.value })} />
        </div>
        <button className={btnCls} disabled={busy || !form.name || !form.pattern}
          onClick={async () => {
            const r = await post({ action: "upsert-recon-rule", ...form, priority: Number(form.priority) || 0, accountCode: form.accountCode || undefined, partyType: form.partyType || undefined, partyId: form.partyId || undefined, amountTolerance: form.amountTolerance ? Number(form.amountTolerance) : undefined });
            if (r) { setForm({ name: "", priority: "0", matchField: "description", pattern: "", accountCode: "", partyType: "", partyId: "", amountTolerance: "" }); reload(); }
          }}>
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="font-medium text-sm mb-2">Rules</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-400 border-b border-slate-800"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Pattern</th><th className="py-2">Account</th></tr></thead>
            <tbody>
              {rules.map((r: any) => (
                <tr key={r.id} className="border-b border-slate-800/60">
                  <td className="py-2 pr-3">{r.name} <span className="text-xs text-slate-500">p{r.priority}</span></td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.match_field}:{r.pattern}</td>
                  <td className="py-2 font-mono text-xs">{r.account_code ?? "—"}</td>
                </tr>
              ))}
              {!rules.length && <tr><td colSpan={3} className="py-4 text-center text-slate-500">No rules</td></tr>}
            </tbody>
          </table>
        </div>
        <div>
          <div className="font-medium text-sm mb-2">Match Suggestions <span className="text-slate-500 font-normal">(unmatched statement lines)</span></div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-400 border-b border-slate-800"><th className="py-2 pr-3">Line</th><th className="py-2 pr-3 text-right">Amount</th><th className="py-2">Suggested</th></tr></thead>
            <tbody>
              {suggestions.map((s: any, i: number) => (
                <tr key={s.lineId ?? s.line_id ?? i} className="border-b border-slate-800/60">
                  <td className="py-2 pr-3 text-xs">{s.description ?? s.narration ?? String(s.lineId ?? s.line_id ?? "").slice(0, 10)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{fmt(s.amount)}</td>
                  <td className="py-2 text-xs">{s.ruleName ?? s.rule_name ?? s.suggestion ?? "—"}</td>
                </tr>
              ))}
              {!suggestions.length && <tr><td colSpan={3} className="py-4 text-center text-slate-500">No unmatched lines</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RatesTab({ post, busy }: any) {
  const [currencies, setCurrencies] = useState("USD,GBP,EUR");
  const [result, setResult] = useState<any>(null);
  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-sm text-slate-400">
        Fetch current rates from a free FX provider and store them in <code className="font-mono">exchange_rates</code> (marked <code className="font-mono">source=&apos;auto&apos;</code>). Rates are foreign units per 1 NGN… per base unit.
      </p>
      <div className="flex gap-2">
        <input className={`${inputCls} w-64`} placeholder="Currencies (comma-separated)" value={currencies} onChange={(e) => setCurrencies(e.target.value)} />
        <button className={btnCls} disabled={busy || !currencies.trim()}
          onClick={async () => {
            const r = await post({ action: "fetch-rates", currencies: currencies.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) });
            if (r) setResult(r);
          }}>
          <RefreshCw className="h-3.5 w-3.5" /> Fetch Rates
        </button>
      </div>
      {result && <pre className="rounded bg-slate-800 p-3 text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
