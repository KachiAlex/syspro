"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Loader2, Play, Plus, Download } from "lucide-react";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const inputCls = "rounded bg-theme-muted px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

export default function DeferredAccountingPage() {
  const { tenantSlug } = useTenantContext();
  const [items, setItems] = useState<any[]>([]);
  const [direction, setDirection] = useState<"" | "revenue" | "expense">("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    direction: "revenue", documentType: "invoice", documentId: "",
    party: "", item: "", totalAmount: "",
    serviceStartDate: "", serviceEndDate: "",
    deferredAccountCode: "", recognitionAccountCode: "",
  });

  const qs = () => {
    const p = new URLSearchParams({ tenantSlug });
    if (direction) p.set("direction", direction);
    if (status) p.set("status", status);
    return p.toString();
  };

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const j = await (await fetch(`/api/finance/deferred?${qs()}`)).json();
      if (j.success === false) throw new Error(j.error);
      setItems(j.data ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, direction, status]);
  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/finance/deferred", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, tenantSlug }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Failed");
      return j.data;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  const create = async () => {
    const r = await post({
      action: "create", ...form,
      totalAmount: Number(form.totalAmount),
      party: form.party || undefined, item: form.item || undefined,
      deferredAccountCode: form.deferredAccountCode || undefined,
    });
    if (r) {
      setMsg("Deferred item created");
      setShowNew(false);
      setForm({ direction: "revenue", documentType: "invoice", documentId: "", party: "", item: "", totalAmount: "", serviceStartDate: "", serviceEndDate: "", deferredAccountCode: "", recognitionAccountCode: "" });
      load();
    }
  };

  const process = async () => {
    const r = await post({ action: "process" });
    if (r) {
      setMsg(`Posted ${r.posted?.length ?? 0} recognition entr${(r.posted?.length ?? 0) === 1 ? "y" : "ies"}`);
      load();
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Deferred Revenue &amp; Expense</h1>
          <p className="text-sm text-theme-text-secondary">Spread income/costs across service periods — recognition posts to the GL monthly.</p>
        </div>
        <div className="flex gap-2">
          <a className={btnCls} href={`/api/finance/deferred?tenantSlug=${encodeURIComponent(tenantSlug)}&view=report&format=csv`}>
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <button className={btnCls} disabled={busy} onClick={process}>
            <Play className="h-3.5 w-3.5" /> Run Recognition
          </button>
          <button className={btnCls} onClick={() => setShowNew(!showNew)}>
            <Plus className="h-3.5 w-3.5" /> New
          </button>
          {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      <div className="flex gap-2">
        <select className={`${inputCls} w-40`} value={direction} onChange={(e) => setDirection(e.target.value as any)}>
          <option value="">All directions</option><option value="revenue">Revenue</option><option value="expense">Expense</option>
        </select>
        <select className={`${inputCls} w-36`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="open">Open</option><option value="closed">Closed</option>
        </select>
      </div>

      {showNew && (
        <div className="rounded border border-theme-border p-4 space-y-3">
          <div className="font-medium text-sm">New Deferred Item</div>
          <div className="grid gap-2 sm:grid-cols-3">
            <select className={inputCls} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="revenue">Deferred Revenue</option><option value="expense">Deferred Expense</option>
            </select>
            <select className={inputCls} value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}>
              <option value="invoice">Invoice</option><option value="bill">Bill</option>
            </select>
            <input className={inputCls} placeholder="Document ID" value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} />
            <input className={inputCls} placeholder="Party (optional)" value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} />
            <input className={inputCls} placeholder="Item (optional)" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
            <input className={inputCls} placeholder="Total amount" value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} />
            <label className="block"><span className="block text-xs text-theme-text-secondary">Service start</span><input className={inputCls} type="date" value={form.serviceStartDate} onChange={(e) => setForm({ ...form, serviceStartDate: e.target.value })} /></label>
            <label className="block"><span className="block text-xs text-theme-text-secondary">Service end</span><input className={inputCls} type="date" value={form.serviceEndDate} onChange={(e) => setForm({ ...form, serviceEndDate: e.target.value })} /></label>
            <input className={inputCls} placeholder="Recognition acct code" value={form.recognitionAccountCode} onChange={(e) => setForm({ ...form, recognitionAccountCode: e.target.value })} />
            <input className={inputCls} placeholder="Deferred acct (2400/1800 default)" value={form.deferredAccountCode} onChange={(e) => setForm({ ...form, deferredAccountCode: e.target.value })} />
          </div>
          <button className={btnCls} disabled={busy || !form.documentId || !form.totalAmount || !form.serviceStartDate || !form.serviceEndDate || !form.recognitionAccountCode} onClick={create}>
            Create
          </button>
        </div>
      )}

      <table className="w-full text-sm">
        <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
          <th className="py-2 pr-3">Direction</th><th className="py-2 pr-3">Document</th><th className="py-2 pr-3">Party / Item</th>
          <th className="py-2 pr-3">Period</th><th className="py-2 pr-3 text-right">Total</th><th className="py-2 pr-3 text-right">Recognized</th>
          <th className="py-2 pr-3 text-right">Remaining</th><th className="py-2">Status</th>
        </tr></thead>
        <tbody>
          {items.map((d) => {
            const remaining = Number(d.total_amount) - Number(d.recognized_amount);
            return (
              <tr key={d.id} className="border-b border-theme-border/60">
                <td className="py-2 pr-3 capitalize">{d.direction}</td>
                <td className="py-2 pr-3 font-mono text-xs">{d.document_type}:{String(d.document_id).slice(0, 8)}</td>
                <td className="py-2 pr-3">{d.party ?? "—"}{d.item ? ` / ${d.item}` : ""}</td>
                <td className="py-2 pr-3 text-xs">{String(d.service_start_date).slice(0, 10)} → {String(d.service_end_date).slice(0, 10)}</td>
                <td className="py-2 pr-3 text-right font-mono">{fmt(d.total_amount)}</td>
                <td className="py-2 pr-3 text-right font-mono">{fmt(d.recognized_amount)}</td>
                <td className="py-2 pr-3 text-right font-mono">{fmt(remaining)}</td>
                <td className="py-2">{d.status}</td>
              </tr>
            );
          })}
          {!items.length && !loading && <tr><td colSpan={8} className="py-6 text-center text-theme-text-tertiary">No deferred items</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
