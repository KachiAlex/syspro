"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle, ArrowDownLeft, ArrowUpRight, Loader2, Plus, RotateCcw, X,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

type Ret = {
  id: string; direction: string; sourceDocumentId: string; documentNo: string;
  status: string; netAmount: number; totalAmount: number; reason: string | null;
  restock: boolean; createdAt: string;
  items: { description: string; quantity: number; unitPrice: number }[];
};
type Invoice = { id: string; invoice_number: string; customer_name: string; amount: number; status: string };
type Bill = { id: string; bill_number?: string; vendor_name: string; amount: number; status: string };

const emptyItem = () => ({ description: "", sku: "", quantity: "1", unitPrice: "", taxRate: "" });

export default function ReturnsPage() {
  const { tenantSlug } = useTenantContext();
  const [returns, setReturns] = useState<Ret[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [directionFilter, setDirectionFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    direction: "sales" as "sales" | "purchase", documentId: "",
    reason: "", restock: true,
  });
  const [items, setItems] = useState([emptyItem()]);

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const params = qs() + (directionFilter ? `&direction=${directionFilter}` : "");
      const [r, i, b] = await Promise.all([
        fetch(`/api/finance/returns?${params}`).then((x) => x.json()),
        fetch(`/api/finance/invoices?${qs()}&limit=200`).then((x) => x.json()).catch(() => ({})),
        fetch(`/api/finance/bills?${qs()}&limit=200`).then((x) => x.json()).catch(() => ({})),
      ]);
      setReturns(r.returns ?? []);
      setInvoices((i.invoices ?? []).filter((x: Invoice) => x.status !== "void" && x.status !== "draft"));
      setBills(b.bills ?? b.data ?? []);
      if (r.error) setError(r.error);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, directionFilter]);

  const docs = form.direction === "sales" ? invoices : bills;
  const docLabel = (b: any) =>
    form.direction === "sales"
      ? `${b.invoice_number} — ${b.customer_name} — ${fmt(b.amount)}`
      : `${b.bill_number ?? b.id.slice(0, 8)} — ${b.vendor_name} — ${fmt(b.amount)}`;

  const createReturn = async () => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(`/api/finance/returns?${qs()}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: form.direction,
          invoiceId: form.direction === "sales" ? form.documentId : undefined,
          billId: form.direction === "purchase" ? form.documentId : undefined,
          items: items.map((it) => ({
            description: it.description, sku: it.sku || undefined,
            quantity: Number(it.quantity), unitPrice: Number(it.unitPrice),
            taxRate: it.taxRate ? Number(it.taxRate) : undefined,
          })),
          reason: form.reason || undefined,
          restock: form.direction === "sales" ? form.restock : undefined,
          destock: form.direction === "purchase" ? form.restock : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Return failed");
      const ret = data.return;
      setMsg(ret.status === "pending_approval"
        ? "Return created — pending approval (no GL effect until approved)"
        : `${form.direction === "sales" ? "Credit note" : "Debit note"} posted`);
      setShowNew(false);
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const statusBadge = (s: string) =>
    s === "posted" ? "bg-emerald-500/15 text-emerald-400"
    : s === "pending_approval" ? "bg-amber-500/15 text-amber-400"
    : "bg-theme-muted/15 text-theme-text-secondary";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Returns &amp; Credit/Debit Notes</h1>
            <p className="text-sm text-theme-text-secondary">Sales returns issue credit notes; purchase returns issue debit notes — GL-aware with restock</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select className="rounded bg-theme-muted px-3 py-1.5 text-sm"
            value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)}>
            <option value="">All</option><option value="sales">Sales returns</option><option value="purchase">Purchase returns</option>
          </select>
          <button onClick={() => { setForm({ direction: "sales", documentId: "", reason: "", restock: true }); setItems([emptyItem()]); setShowNew(true); }}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
            <Plus className="h-4 w-4" /> New return
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-theme-text-secondary">
            {["", "Doc", "Direction", "Net", "Total", "Restock", "Status", "Reason"].map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {returns.map((r) => (
            <React.Fragment key={r.id}>
              <tr className="border-t border-theme-border cursor-pointer hover:bg-theme-muted/40"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <td className="px-3 py-2">
                  {r.direction === "sales"
                    ? <ArrowDownLeft className="h-4 w-4 text-amber-400" />
                    : <ArrowUpRight className="h-4 w-4 text-sky-400" />}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.documentNo}</td>
                <td className="px-3 py-2 capitalize">{r.direction} return</td>
                <td className="px-3 py-2">{fmt(r.netAmount)}</td>
                <td className="px-3 py-2">{fmt(r.totalAmount)}</td>
                <td className="px-3 py-2 text-theme-text-secondary">{r.restock ? "yes" : "no"}</td>
                <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${statusBadge(r.status)}`}>{r.status.replace(/_/g, " ")}</span></td>
                <td className="px-3 py-2 text-theme-text-secondary">{r.reason ?? "—"}</td>
              </tr>
              {expanded === r.id && (
                <tr className="bg-theme-surface/60">
                  <td colSpan={8} className="px-8 py-3">
                    <table className="w-full text-xs">
                      <thead><tr className="text-theme-text-tertiary"><th className="text-left">Item</th><th className="text-right">Qty</th><th className="text-right">Unit price</th></tr></thead>
                      <tbody>
                        {(r.items ?? []).map((it, i) => (
                          <tr key={i} className="border-t border-theme-border/60">
                            <td className="py-1">{it.description}</td>
                            <td className="text-right">{it.quantity}</td>
                            <td className="text-right">{fmt(it.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {returns.length === 0 && !loading && (
            <tr><td colSpan={8} className="px-3 py-6 text-center text-theme-text-tertiary">No returns recorded</td></tr>
          )}
        </tbody>
      </table>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New return</h2>
              <button onClick={() => setShowNew(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-theme-text-secondary">Direction
                <select className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value as "sales" | "purchase", documentId: "" })}>
                  <option value="sales">Sales return (credit note)</option>
                  <option value="purchase">Purchase return (debit note)</option>
                </select>
              </label>
              <label className="text-xs text-theme-text-secondary">
                {form.direction === "sales" ? "Source invoice" : "Source bill"}
                <select className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })}>
                  <option value="">Select…</option>
                  {docs.map((d: any) => <option key={d.id} value={d.id}>{docLabel(d)}</option>)}
                </select>
              </label>
            </div>

            <h3 className="text-xs font-semibold text-theme-text-primary pt-1">Returned items</h3>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_56px_88px_60px_24px] gap-2 items-center">
                <input className="rounded bg-theme-muted px-2 py-2 text-sm" placeholder="Description"
                  value={it.description} onChange={(e) => {
                    const ls = [...items]; ls[i] = { ...it, description: e.target.value }; setItems(ls);
                  }} />
                <input className="rounded bg-theme-muted px-2 py-2 text-sm" placeholder="SKU"
                  value={it.sku} onChange={(e) => {
                    const ls = [...items]; ls[i] = { ...it, sku: e.target.value }; setItems(ls);
                  }} />
                <input type="number" className="rounded bg-theme-muted px-2 py-2 text-sm" placeholder="Qty"
                  value={it.quantity} onChange={(e) => {
                    const ls = [...items]; ls[i] = { ...it, quantity: e.target.value }; setItems(ls);
                  }} />
                <input type="number" className="rounded bg-theme-muted px-2 py-2 text-sm" placeholder="Price"
                  value={it.unitPrice} onChange={(e) => {
                    const ls = [...items]; ls[i] = { ...it, unitPrice: e.target.value }; setItems(ls);
                  }} />
                <input type="number" className="rounded bg-theme-muted px-2 py-2 text-sm" placeholder="Tax%"
                  value={it.taxRate} onChange={(e) => {
                    const ls = [...items]; ls[i] = { ...it, taxRate: e.target.value }; setItems(ls);
                  }} />
                {items.length > 1 ? (
                  <button className="text-rose-400" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </button>
                ) : <span />}
              </div>
            ))}
            <button className="text-xs text-sky-400" onClick={() => setItems([...items, emptyItem()])}>
              + add item
            </button>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.restock}
                  onChange={(e) => setForm({ ...form, restock: e.target.checked })} />
                {form.direction === "sales" ? "Restock items into inventory" : "Remove items from inventory"}
              </label>
            </div>
            <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Reason (optional)"
              value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />

            <button
              disabled={busy || !form.documentId || items.some((it) => !it.description || !Number(it.quantity) || !it.unitPrice)}
              onClick={() => void createReturn()}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Posting…" : `Create ${form.direction === "sales" ? "credit note" : "debit note"}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
