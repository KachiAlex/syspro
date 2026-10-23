"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type Rfq = {
  id: string;
  rfqNumber: string;
  title: string;
  status: string;
  requiredBy: string | null;
  itemCount?: number;
  supplierCount?: number;
  quoteCount?: number;
};

type Comparison = {
  rfqItemId: string;
  description: string;
  quantity: number;
  bestUnitPrice: number | null;
  bestVendorName: string | null;
  offers: { quotationId: string; vendorName: string; unitPrice: number; lineAmount: number }[];
};

export default function RfqsPage() {
  const { tenantSlug } = useTenantContext();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [comparison, setComparison] = useState<Comparison[] | null>(null);
  const [form, setForm] = useState({ title: "", requiredBy: "", vendorIds: [] as string[] });
  const [items, setItems] = useState([{ description: "", quantity: 1, targetPrice: 0 }]);
  const [quoteForm, setQuoteForm] = useState({ vendorId: "", vendorName: "", unitPrices: {} as Record<string, number> });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, vRes] = await Promise.all([
        fetch("/api/procurement/rfqs"),
        fetch("/api/suppliers"),
      ]);
      const rData = await rRes.json();
      if (rRes.ok) setRfqs(rData.rfqs ?? []);
      const vData = await vRes.json().catch(() => ({}));
      setVendors((vData.suppliers ?? vData.vendors ?? []).map((v: any) => ({ id: v.id, name: v.name ?? v.supplier_name })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    const [rRes, cRes] = await Promise.all([
      fetch(`/api/procurement/rfqs/${id}`),
      fetch(`/api/procurement/rfqs/${id}?view=compare`),
    ]);
    setDetail((await rRes.json()).rfq ?? null);
    setComparison((await cRes.json()).comparison ?? null);
  };

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/procurement/rfqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          requiredBy: form.requiredBy || null,
          vendorIds: form.vendorIds,
          items: items.filter((i) => i.description),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Create failed"); return; }
      setShowCreate(false);
      setForm({ title: "", requiredBy: "", vendorIds: [] });
      setItems([{ description: "", quantity: 1, targetPrice: 0 }]);
      load();
    } finally {
      setBusy(false);
    }
  };

  const act = async (id: string, body: object) => {
    const res = await fetch(`/api/procurement/rfqs/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Action failed"); return; }
    if (data.purchaseOrderId) setError("");
    load();
    if (detail?.id === id) openDetail(id);
  };

  const submitQuote = async () => {
    if (!detail || !quoteForm.vendorId) return;
    const qItems = detail.items.map((i: any) => ({
      rfqItemId: i.id,
      productId: i.product_id,
      description: i.description,
      quantity: i.quantity,
      unitPrice: Number(quoteForm.unitPrices[i.id] ?? 0),
    }));
    await act(detail.id, { action: "submit-quote", vendorId: quoteForm.vendorId, vendorName: quoteForm.vendorName, items: qItems });
    setQuoteForm({ vendorId: "", vendorName: "", unitPrices: {} });
  };

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-theme-bg p-6 text-theme-text-primary">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Requests for Quotation</h1>
            <p className="text-sm text-theme-text-secondary">Competitive bidding — collect supplier quotes, compare, award to PO</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500">New RFQ</button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}

        {showCreate && (
          <div className="mb-6 rounded-xl border border-theme-border bg-theme-surface p-5">
            <h2 className="mb-4 font-semibold">New RFQ</h2>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <input placeholder="RFQ title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
              <input type="date" value={form.requiredBy} onChange={(e) => setForm({ ...form, requiredBy: e.target.value })}
                className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" title="Required by" />
            </div>
            <div className="mb-3">
              <p className="mb-1 text-xs text-theme-text-secondary">Suppliers invited:</p>
              <div className="flex flex-wrap gap-2">
                {vendors.map((v) => (
                  <label key={v.id} className={`cursor-pointer rounded-full px-3 py-1 text-xs ${form.vendorIds.includes(v.id) ? "bg-emerald-700" : "bg-theme-muted hover:bg-theme-elevated"}`}>
                    <input type="checkbox" className="hidden" checked={form.vendorIds.includes(v.id)}
                      onChange={(e) => setForm({ ...form, vendorIds: e.target.checked ? [...form.vendorIds, v.id] : form.vendorIds.filter((id) => id !== v.id) })} />
                    {v.name}
                  </label>
                ))}
              </div>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="mb-2 flex gap-2">
                <input placeholder="Item description" value={item.description}
                  onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
                  className="flex-1 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
                <input type="number" placeholder="Qty" value={item.quantity} min={0}
                  onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) } : it))}
                  className="w-24 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
                <input type="number" placeholder="Target price" value={item.targetPrice} min={0}
                  onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, targetPrice: Number(e.target.value) } : it))}
                  className="w-32 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
              </div>
            ))}
            <div className="flex gap-2">
              <button onClick={() => setItems([...items, { description: "", quantity: 1, targetPrice: 0 }])}
                className="rounded-lg bg-theme-muted px-3 py-2 text-sm hover:bg-theme-elevated">+ Item</button>
              <button onClick={create} disabled={busy || !form.title || !form.vendorIds.length || !items.some((i) => i.description)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">Create</button>
              <button onClick={() => setShowCreate(false)} className="rounded-lg bg-theme-muted px-3 py-2 text-sm hover:bg-theme-elevated">Cancel</button>
            </div>
          </div>
        )}

        {detail && (
          <div className="mb-6 rounded-xl border border-theme-border bg-theme-surface p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{detail.rfqNumber} — {detail.title}</h2>
              <button onClick={() => { setDetail(null); setComparison(null); }} className="text-theme-text-secondary hover:text-theme-text-primary">✕</button>
            </div>
            {detail.status === "sent" && (
              <div className="mb-4 rounded-lg border border-theme-border bg-theme-muted p-3">
                <p className="mb-2 text-xs font-medium text-theme-text-secondary">Record supplier quote:</p>
                <div className="mb-2 flex gap-2">
                  <select value={quoteForm.vendorId}
                    onChange={(e) => {
                      const v = vendors.find((x) => x.id === e.target.value);
                      setQuoteForm({ ...quoteForm, vendorId: e.target.value, vendorName: v?.name ?? "" });
                    }}
                    className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm">
                    <option value="">Select supplier…</option>
                    {detail.suppliers.map((vid: string) => {
                      const v = vendors.find((x) => x.id === vid);
                      return <option key={vid} value={vid}>{v?.name ?? vid}</option>;
                    })}
                  </select>
                  <button onClick={submitQuote} disabled={!quoteForm.vendorId}
                    className="rounded-lg bg-theme-accent px-3 py-2 text-sm hover:bg-theme-accent-hover disabled:opacity-50">Submit Quote</button>
                </div>
                {quoteForm.vendorId && detail.items.map((i: any) => (
                  <div key={i.id} className="mb-1 flex items-center gap-2 text-sm">
                    <span className="flex-1 text-theme-text-primary">{i.description} × {i.quantity}</span>
                    <input type="number" placeholder="unit price" min={0}
                      value={quoteForm.unitPrices[i.id] ?? ""}
                      onChange={(e) => setQuoteForm({ ...quoteForm, unitPrices: { ...quoteForm.unitPrices, [i.id]: Number(e.target.value) } })}
                      className="w-32 rounded-lg border border-theme-border bg-theme-muted px-3 py-1 text-sm" />
                  </div>
                ))}
              </div>
            )}
            {comparison && (
              <table className="w-full text-sm">
                <thead className="text-left text-theme-text-secondary">
                  <tr><th className="p-2">Item</th><th className="p-2">Qty</th><th className="p-2">Offers</th><th className="p-2">Best</th></tr>
                </thead>
                <tbody>
                  {comparison.map((c) => (
                    <tr key={c.rfqItemId} className="border-t border-theme-border">
                      <td className="p-2">{c.description}</td>
                      <td className="p-2">{c.quantity}</td>
                      <td className="p-2">
                        {c.offers.map((o) => (
                          <div key={o.quotationId} className="text-xs">
                            {o.vendorName}: <span className="font-mono">{o.unitPrice.toLocaleString()}</span>
                            <button onClick={() => act(detail.id, { action: "award", quotationId: o.quotationId })}
                              className="ml-2 rounded bg-emerald-800 px-1.5 py-0.5 hover:bg-emerald-700">award</button>
                          </div>
                        ))}
                      </td>
                      <td className="p-2 text-emerald-400">{c.bestVendorName ? `${c.bestVendorName} @ ${c.bestUnitPrice?.toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {detail.quotations?.length > 0 && (
              <div className="mt-3 text-xs text-theme-text-secondary">
                {detail.quotations.map((q: any) => (
                  <div key={q.id}>{q.vendorName}: {q.total.toLocaleString()} {q.currency} — <span className="uppercase">{q.status}</span>{q.purchaseOrderId ? ` → PO ${q.purchaseOrderId}` : ""}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-xl border border-theme-border bg-theme-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-theme-border text-left text-theme-text-secondary">
              <tr>
                <th className="p-3">RFQ</th><th className="p-3">Title</th><th className="p-3">Required By</th>
                <th className="p-3">Items</th><th className="p-3">Suppliers</th><th className="p-3">Quotes</th>
                <th className="p-3">Status</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-6 text-center text-theme-text-tertiary">Loading…</td></tr>
              ) : rfqs.length === 0 ? (
                <tr><td colSpan={8} className="p-6 text-center text-theme-text-tertiary">No RFQs yet</td></tr>
              ) : rfqs.map((r) => (
                <tr key={r.id} className="border-b border-theme-border hover:bg-theme-muted/30">
                  <td className="p-3 font-mono">{r.rfqNumber}</td>
                  <td className="p-3">{r.title}</td>
                  <td className="p-3 text-theme-text-secondary">{r.requiredBy ? String(r.requiredBy).slice(0, 10) : "—"}</td>
                  <td className="p-3">{r.itemCount}</td>
                  <td className="p-3">{r.supplierCount}</td>
                  <td className="p-3">{r.quoteCount}</td>
                  <td className="p-3"><span className="rounded-full bg-theme-elevated px-2 py-0.5 text-xs">{r.status}</span></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openDetail(r.id)} className="rounded bg-theme-muted px-2 py-1 text-xs hover:bg-theme-elevated">View</button>
                      {r.status === "draft" && <button onClick={() => act(r.id, { action: "send" })} className="rounded bg-blue-900/50 px-2 py-1 text-xs text-blue-300 hover:bg-blue-900">Send</button>}
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
