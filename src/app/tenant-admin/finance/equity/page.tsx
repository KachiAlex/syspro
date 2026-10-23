"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const inputCls = "rounded bg-theme-muted px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

type Tab = "shareholders" | "types" | "transfer" | "ledger" | "balance";

export default function EquityPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<Tab>("shareholders");
  const [shareholders, setShareholders] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [balance, setBalance] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const get = useCallback(async (view: string) => {
    const j = await (await fetch(`/api/finance/equity?tenantSlug=${encodeURIComponent(tenantSlug)}&view=${view}`)).json();
    return j.success ? j.data : [];
  }, [tenantSlug]);

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setError(null);
    try {
      if (tab === "shareholders") setShareholders(await get("shareholders"));
      else if (tab === "types") setTypes(await get("share-types"));
      else if (tab === "ledger") setLedger(await get("ledger"));
      else if (tab === "balance") setBalance(await get("balance"));
      else { setShareholders(await get("shareholders")); setTypes(await get("share-types")); }
    } catch (e: any) { setError(e.message); }
  }, [tenantSlug, tab, get]);
  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/finance/equity", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, tenantSlug }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Failed");
      setMsg("Done"); return j.data;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Share Capital &amp; Equity</h1>
        <p className="text-sm text-theme-text-secondary">Share types, shareholders, issues/transfers/buy-backs, share ledger and balance.</p>
      </div>
      <div className="flex gap-1 border-b border-theme-border overflow-x-auto">
        {(["shareholders", "types", "transfer", "ledger", "balance"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm whitespace-nowrap capitalize ${tab === t ? "border-b-2 border-sky-500 text-sky-400" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>
            {t === "types" ? "Share Types" : t === "transfer" ? "New Transfer" : t}
          </button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      {tab === "shareholders" && <ShareholdersTab rows={shareholders} post={post} busy={busy} reload={load} />}
      {tab === "types" && <TypesTab rows={types} post={post} busy={busy} reload={load} />}
      {tab === "transfer" && <TransferTab shareholders={shareholders} types={types} post={post} busy={busy} reload={load} />}
      {tab === "ledger" && <LedgerTab rows={ledger} />}
      {tab === "balance" && <BalanceTab rows={balance} />}
    </div>
  );
}

function ShareholdersTab({ rows, post, busy, reload }: any) {
  const [form, setForm] = useState({ name: "", email: "", folioNo: "" });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end rounded border border-theme-border p-4">
        <input className={`${inputCls} w-56`} placeholder="Shareholder name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={`${inputCls} w-56`} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className={`${inputCls} w-36`} placeholder="Folio no" value={form.folioNo} onChange={(e) => setForm({ ...form, folioNo: e.target.value })} />
        <button className={btnCls} disabled={busy || !form.name}
          onClick={async () => { const r = await post({ action: "upsert-shareholder", ...form, email: form.email || undefined, folioNo: form.folioNo || undefined }); if (r) { setForm({ name: "", email: "", folioNo: "" }); reload(); } }}>
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Email</th><th className="py-2">Folio</th></tr></thead>
        <tbody>
          {rows.map((s: any) => (
            <tr key={s.id} className="border-b border-theme-border/60">
              <td className="py-2 pr-3">{s.name}</td><td className="py-2 pr-3">{s.email ?? "—"}</td><td className="py-2">{s.folio_no ?? "—"}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="py-6 text-center text-theme-text-tertiary">No shareholders</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TypesTab({ rows, post, busy, reload }: any) {
  const [form, setForm] = useState({ name: "", faceValue: "", premium: "" });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end rounded border border-theme-border p-4">
        <input className={`${inputCls} w-48`} placeholder="Type name (e.g. Ordinary)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={`${inputCls} w-32`} placeholder="Face value" value={form.faceValue} onChange={(e) => setForm({ ...form, faceValue: e.target.value })} />
        <input className={`${inputCls} w-32`} placeholder="Premium" value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} />
        <button className={btnCls} disabled={busy || !form.name || !form.faceValue}
          onClick={async () => { const r = await post({ action: "upsert-type", name: form.name, faceValue: Number(form.faceValue), premium: form.premium ? Number(form.premium) : undefined }); if (r) { setForm({ name: "", faceValue: "", premium: "" }); reload(); } }}>
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3 text-right">Face Value</th><th className="py-2 text-right">Premium</th></tr></thead>
        <tbody>
          {rows.map((t: any) => (
            <tr key={t.id} className="border-b border-theme-border/60">
              <td className="py-2 pr-3">{t.name}</td>
              <td className="py-2 pr-3 text-right font-mono">{fmt(t.face_value)}</td>
              <td className="py-2 text-right font-mono">{fmt(t.premium)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={3} className="py-6 text-center text-theme-text-tertiary">No share types</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function TransferTab({ shareholders, types, post, busy, reload }: any) {
  const [form, setForm] = useState({ transferType: "issue", shareTypeId: "", fromShareholderId: "", toShareholderId: "", qty: "", rate: "", postingDate: "" });
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-theme-text-secondary">
        <b>Issue</b>: company → shareholder (Dr Bank / Cr Capital+Premium).{" "}
        <b>Purchase</b>: buy-back (Dr Capital / Cr Bank).{" "}
        <b>Transfer</b>: shareholder → shareholder (equity reclass).
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <select className={inputCls} value={form.transferType} onChange={(e) => setForm({ ...form, transferType: e.target.value })}>
          <option value="issue">Issue</option><option value="purchase">Purchase</option><option value="transfer">Transfer</option>
        </select>
        <select className={inputCls} value={form.shareTypeId} onChange={(e) => setForm({ ...form, shareTypeId: e.target.value })}>
          <option value="">Share type…</option>
          {types.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input className={inputCls} type="date" value={form.postingDate} onChange={(e) => setForm({ ...form, postingDate: e.target.value })} />
        {form.transferType !== "issue" && (
          <select className={inputCls} value={form.fromShareholderId} onChange={(e) => setForm({ ...form, fromShareholderId: e.target.value })}>
            <option value="">From shareholder…</option>
            {shareholders.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {form.transferType !== "purchase" && (
          <select className={inputCls} value={form.toShareholderId} onChange={(e) => setForm({ ...form, toShareholderId: e.target.value })}>
            <option value="">To shareholder…</option>
            {shareholders.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <input className={inputCls} placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
        <input className={inputCls} placeholder="Rate per share" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
      </div>
      <button className={btnCls} disabled={busy || !form.shareTypeId || !form.qty || !form.rate || !form.postingDate}
        onClick={async () => {
          const r = await post({
            action: "transfer", ...form, qty: Number(form.qty), rate: Number(form.rate),
            fromShareholderId: form.fromShareholderId || undefined,
            toShareholderId: form.toShareholderId || undefined,
          });
          if (r) { setForm({ transferType: "issue", shareTypeId: "", fromShareholderId: "", toShareholderId: "", qty: "", rate: "", postingDate: "" }); reload(); }
        }}>
        Record Transfer
      </button>
    </div>
  );
}

function LedgerTab({ rows }: any) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
        <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Share Type</th>
        <th className="py-2 pr-3">Shareholder</th><th className="py-2 pr-3 text-right">Qty</th><th className="py-2 text-right">Amount</th>
      </tr></thead>
      <tbody>
        {rows.map((r: any) => (
          <tr key={r.id} className="border-b border-theme-border/60">
            <td className="py-2 pr-3">{r.date}</td>
            <td className="py-2 pr-3 capitalize">{r.transferType}</td>
            <td className="py-2 pr-3">{r.shareType}</td>
            <td className="py-2 pr-3">{r.shareholder ?? "—"}</td>
            <td className={`py-2 pr-3 text-right font-mono ${r.qty < 0 ? "text-rose-400" : ""}`}>{r.qty.toLocaleString()}</td>
            <td className="py-2 text-right font-mono">{fmt(r.amount)}</td>
          </tr>
        ))}
        {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-theme-text-tertiary">No share movements</td></tr>}
      </tbody>
    </table>
  );
}

function BalanceTab({ rows }: any) {
  const total = rows.reduce((s: number, r: any) => s + r.capitalValue, 0);
  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
          <th className="py-2 pr-3">Shareholder</th><th className="py-2 pr-3">Share Type</th>
          <th className="py-2 pr-3 text-right">Shares</th><th className="py-2 text-right">Capital Value</th>
        </tr></thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} className="border-b border-theme-border/60">
              <td className="py-2 pr-3">{r.shareholder}</td>
              <td className="py-2 pr-3">{r.shareType}</td>
              <td className="py-2 pr-3 text-right font-mono">{r.shares.toLocaleString()}</td>
              <td className="py-2 text-right font-mono">{fmt(r.capitalValue)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-theme-text-tertiary">No shareholdings</td></tr>}
          {rows.length > 0 && (
            <tr className="font-semibold"><td className="py-2" colSpan={3}>Total share capital</td><td className="py-2 text-right font-mono">{fmt(total)}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
