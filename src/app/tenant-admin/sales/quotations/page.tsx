"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type Quotation = {
  id: string;
  quotationNumber: string;
  customerName: string;
  quotationDate: string;
  validUntil: string | null;
  status: string;
  currency: string;
  total: number;
  itemCount?: number;
  salesOrderId?: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-theme-elevated text-theme-text-primary",
  sent: "bg-blue-900/60 text-blue-300",
  accepted: "bg-emerald-900/60 text-emerald-300",
  converted: "bg-emerald-900/60 text-emerald-200",
  rejected: "bg-red-900/60 text-red-300",
  expired: "bg-amber-900/60 text-amber-300",
  lost: "bg-red-900/60 text-red-300",
};

export default function QuotationsPage() {
  const { tenantSlug } = useTenantContext();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ customerName: "", validUntil: "", notes: "" });
  const [items, setItems] = useState([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/quotations");
      const data = await res.json();
      if (res.ok) setQuotations(data.quotations ?? []);
      else setError(data.error ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/sales/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          validUntil: form.validUntil || null,
          notes: form.notes || null,
          items: items.filter((i) => i.description),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Create failed"); return; }
      setShowCreate(false);
      setForm({ customerName: "", validUntil: "", notes: "" });
      setItems([{ description: "", quantity: 1, unitPrice: 0 }]);
      load();
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/sales/quotations/${id}`, {
      method: body.action ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed");
      return;
    }
    load();
  };

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-theme-bg p-6 text-theme-text-primary">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Quotations</h1>
            <p className="text-sm text-theme-text-secondary">Pre-sale quotes — convert accepted quotes into sales orders</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => fetch("/api/sales/quotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "expire-stale" }) }).then(load)}
              className="rounded-lg bg-theme-muted px-3 py-2 text-sm hover:bg-theme-elevated">Expire Stale</button>
            <button onClick={() => setShowCreate(true)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500">New Quotation</button>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}

        {showCreate && (
          <div className="mb-6 rounded-xl border border-theme-border bg-theme-surface p-5">
            <h2 className="mb-4 font-semibold">New Quotation</h2>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <input placeholder="Customer name" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
              <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" title="Valid until" />
              <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="mb-2 flex gap-2">
                <input placeholder="Description" value={item.description}
                  onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                  className="flex-1 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
                <input type="number" placeholder="Qty" value={item.quantity} min={0}
                  onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) } : it))}
                  className="w-24 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
                <input type="number" placeholder="Unit price" value={item.unitPrice} min={0}
                  onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, unitPrice: Number(e.target.value) } : it))}
                  className="w-32 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => setItems([...items, { description: "", quantity: 1, unitPrice: 0 }])}
                className="rounded-lg bg-theme-muted px-3 py-2 text-sm hover:bg-theme-elevated">+ Line</button>
              <button onClick={create} disabled={busy || !form.customerName || !items.some((i) => i.description)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">Create</button>
              <button onClick={() => setShowCreate(false)} className="rounded-lg bg-theme-muted px-3 py-2 text-sm hover:bg-theme-elevated">Cancel</button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-theme-border bg-theme-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-theme-border text-left text-theme-text-secondary">
              <tr>
                <th className="p-3">Number</th><th className="p-3">Customer</th><th className="p-3">Date</th>
                <th className="p-3">Valid Until</th><th className="p-3 text-right">Total</th>
                <th className="p-3">Status</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-6 text-center text-theme-text-tertiary">Loading…</td></tr>
              ) : quotations.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-theme-text-tertiary">No quotations yet</td></tr>
              ) : quotations.map((q) => (
                <tr key={q.id} className="border-b border-theme-border hover:bg-theme-muted/30">
                  <td className="p-3 font-mono">{q.quotationNumber}</td>
                  <td className="p-3">{q.customerName}</td>
                  <td className="p-3 text-theme-text-secondary">{String(q.quotationDate).slice(0, 10)}</td>
                  <td className="p-3 text-theme-text-secondary">{q.validUntil ? String(q.validUntil).slice(0, 10) : "—"}</td>
                  <td className="p-3 text-right font-mono">{q.currency} {q.total.toLocaleString()}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[q.status] ?? "bg-theme-elevated"}`}>{q.status}</span></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {["draft", "sent"].includes(q.status) && (
                        <>
                          {q.status === "draft" && <button onClick={() => act(q.id, { status: "sent" })} className="rounded bg-blue-900/50 px-2 py-1 text-xs text-blue-300 hover:bg-blue-900">Send</button>}
                          <button onClick={() => act(q.id, { status: "accepted" })} className="rounded bg-emerald-900/50 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-900">Accept</button>
                          <button onClick={() => act(q.id, { action: "convert" })} className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600">→ SO</button>
                          <button onClick={() => act(q.id, { status: "rejected" })} className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-900">Reject</button>
                        </>
                      )}
                      {q.salesOrderId && <span className="text-xs text-theme-text-tertiary">→ {q.salesOrderId}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
