"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Plus, Search } from "lucide-react";

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const inputCls = "rounded bg-slate-800 px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

export default function LoyaltyPage() {
  const { tenantSlug } = useTenantContext();
  const [programs, setPrograms] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", earnRate: "", redeemValue: "", minPointsToRedeem: "", maxRedeemPct: "", expiryDays: "" });
  const [lookup, setLookup] = useState("");
  const [balance, setBalance] = useState<any>(null);
  const [txn, setTxn] = useState({ programId: "", customerCode: "", invoiceId: "", invoiceAmount: "", points: "" });
  const [txnResult, setTxnResult] = useState<any>(null);

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    const j = await (await fetch(`/api/finance/loyalty?tenantSlug=${encodeURIComponent(tenantSlug)}&view=programs`)).json();
    if (j.success) setPrograms(j.data ?? []);
  }, [tenantSlug]);
  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/finance/loyalty", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, tenantSlug }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Failed");
      setMsg("Done"); return j.data;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  const checkBalance = async () => {
    const j = await (await fetch(`/api/finance/loyalty?tenantSlug=${encodeURIComponent(tenantSlug)}&view=balance&customerCode=${encodeURIComponent(lookup)}`)).json();
    setBalance(j.success ? j.data : { error: j.error });
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Loyalty Programs</h1>
        <p className="text-sm text-slate-400">Invoice-side earn &amp; redeem — shares one points wallet with POS loyalty.</p>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="font-medium text-sm">Programs</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="py-2 pr-3">Name</th><th className="py-2 pr-3 text-right">Earn</th><th className="py-2 text-right">Redeem Value</th>
            </tr></thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/60">
                  <td className="py-2 pr-3">{p.name}{p.active ? "" : " (inactive)"}</td>
                  <td className="py-2 pr-3 text-right">{p.earn_rate} pts/₦</td>
                  <td className="py-2 text-right">{fmt(p.redeem_value)}/pt</td>
                </tr>
              ))}
              {!programs.length && <tr><td colSpan={3} className="py-4 text-center text-slate-500">No programs</td></tr>}
            </tbody>
          </table>
          <div className="rounded border border-slate-800 p-4 space-y-3">
            <div className="font-medium text-sm">New Program</div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className={inputCls} placeholder="Earn rate (pts per ₦)" value={form.earnRate} onChange={(e) => setForm({ ...form, earnRate: e.target.value })} />
              <input className={inputCls} placeholder="Redeem value (₦ per pt)" value={form.redeemValue} onChange={(e) => setForm({ ...form, redeemValue: e.target.value })} />
              <input className={inputCls} placeholder="Min points to redeem" value={form.minPointsToRedeem} onChange={(e) => setForm({ ...form, minPointsToRedeem: e.target.value })} />
              <input className={inputCls} placeholder="Max redeem % of invoice" value={form.maxRedeemPct} onChange={(e) => setForm({ ...form, maxRedeemPct: e.target.value })} />
              <input className={inputCls} placeholder="Expiry days (blank = never)" value={form.expiryDays} onChange={(e) => setForm({ ...form, expiryDays: e.target.value })} />
            </div>
            <button className={btnCls} disabled={busy || !form.name || !form.earnRate || !form.redeemValue}
              onClick={async () => {
                const r = await post({
                  action: "upsert-program", name: form.name,
                  earnRate: Number(form.earnRate), redeemValue: Number(form.redeemValue),
                  minPointsToRedeem: form.minPointsToRedeem ? Number(form.minPointsToRedeem) : undefined,
                  maxRedeemPct: form.maxRedeemPct ? Number(form.maxRedeemPct) : undefined,
                  expiryDays: form.expiryDays ? Number(form.expiryDays) : undefined,
                });
                if (r) { setForm({ name: "", earnRate: "", redeemValue: "", minPointsToRedeem: "", maxRedeemPct: "", expiryDays: "" }); load(); }
              }}>
              <Plus className="h-3.5 w-3.5" /> Create
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="font-medium text-sm">Customer Balance</div>
          <div className="flex gap-2">
            <input className={`${inputCls} w-56`} placeholder="Customer code" value={lookup} onChange={(e) => setLookup(e.target.value)} />
            <button className={btnCls} disabled={!lookup} onClick={checkBalance}><Search className="h-3.5 w-3.5" /> Check</button>
          </div>
          {balance && (
            <div className="rounded border border-slate-800 p-3 text-sm">
              {balance.error ? <span className="text-rose-400">{balance.error}</span> : (
                <>{balance.points?.toLocaleString()} points ≈ {fmt(balance.redeemValue)}</>
              )}
            </div>
          )}

          <div className="font-medium text-sm pt-2">Manual Earn / Redeem on Invoice</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={inputCls} value={txn.programId} onChange={(e) => setTxn({ ...txn, programId: e.target.value })}>
              <option value="">Program…</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className={inputCls} placeholder="Customer code" value={txn.customerCode} onChange={(e) => setTxn({ ...txn, customerCode: e.target.value })} />
            <input className={inputCls} placeholder="Invoice ID" value={txn.invoiceId} onChange={(e) => setTxn({ ...txn, invoiceId: e.target.value })} />
            <input className={inputCls} placeholder="Invoice amount" value={txn.invoiceAmount} onChange={(e) => setTxn({ ...txn, invoiceAmount: e.target.value })} />
            <input className={inputCls} placeholder="Points (redeem only, blank = max)" value={txn.points} onChange={(e) => setTxn({ ...txn, points: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button className={btnCls} disabled={busy || !txn.programId || !txn.customerCode || !txn.invoiceId || !txn.invoiceAmount}
              onClick={async () => { const r = await post({ action: "earn", programId: txn.programId, customerCode: txn.customerCode, invoiceId: txn.invoiceId, invoiceAmount: Number(txn.invoiceAmount) }); if (r) setTxnResult(r); }}>
              Earn
            </button>
            <button className={btnCls} disabled={busy || !txn.programId || !txn.customerCode || !txn.invoiceId || !txn.invoiceAmount}
              onClick={async () => { const r = await post({ action: "redeem", programId: txn.programId, customerCode: txn.customerCode, invoiceId: txn.invoiceId, invoiceAmount: Number(txn.invoiceAmount), points: txn.points ? Number(txn.points) : undefined }); if (r) setTxnResult(r); }}>
              Redeem
            </button>
          </div>
          {txnResult && <pre className="rounded bg-slate-800 p-3 text-xs overflow-auto">{JSON.stringify(txnResult, null, 2)}</pre>}
        </div>
      </div>
    </div>
  );
}
