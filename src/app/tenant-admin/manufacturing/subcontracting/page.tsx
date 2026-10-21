"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, Truck, X } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

type Order = {
  id: string; order_number: string; subcontractor: string;
  product_sku: string; product_name: string; quantity: number;
  fee_per_unit: number; status: string; received_qty: number;
  expected_date: string | null; materials?: any[];
};

export default function SubcontractingPage() {
  const { tenantSlug } = useTenantContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    subcontractor: "", productSku: "", productName: "", quantity: "",
    feePerUnit: "0", expectedDate: "", materials: [{ sku: "", quantity: "" }],
  });

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/manufacturing/subcontracting?tenantSlug=${tenantSlug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setOrders(data.orders ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const create = async () => {
    setBusy("new"); setError(null);
    try {
      const res = await fetch(`/api/manufacturing/subcontracting?tenantSlug=${tenantSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subcontractor: form.subcontractor, productSku: form.productSku,
          productName: form.productName, quantity: Number(form.quantity),
          feePerUnit: Number(form.feePerUnit || 0),
          expectedDate: form.expectedDate || undefined,
          materials: form.materials
            .filter((m) => m.sku && Number(m.quantity) > 0)
            .map((m) => ({ sku: m.sku, quantity: Number(m.quantity) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setShowNew(false);
      setForm({ subcontractor: "", productSku: "", productName: "", quantity: "", feePerUnit: "0", expectedDate: "", materials: [{ sku: "", quantity: "" }] });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  const act = async (o: Order, action: "issue" | "receive" | "cancel") => {
    setBusy(o.id); setError(null); setMsg(null);
    try {
      const res = await fetch(`/api/manufacturing/subcontracting?tenantSlug=${tenantSlug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, orderId: o.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${action} failed`);
      if (action === "receive") setMsg(`Received — FG value ${fmt(data.finishedGoodsValue)} posted`);
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Subcontracting</h1>
            <p className="text-sm text-slate-400">Send materials out, receive finished goods back</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
          <Plus className="h-4 w-4" /> New order
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400">
            {["Order", "Subcontractor", "Product", "Qty", "Fee/unit", "Status", "Actions"].map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-slate-800">
              <td className="px-3 py-2">{o.order_number}</td>
              <td className="px-3 py-2">{o.subcontractor}</td>
              <td className="px-3 py-2">{o.product_name} <span className="text-slate-500">({o.product_sku})</span></td>
              <td className="px-3 py-2">{o.received_qty}/{o.quantity}</td>
              <td className="px-3 py-2">{fmt(o.fee_per_unit)}</td>
              <td className="px-3 py-2">
                <span className={`rounded px-2 py-0.5 text-xs ${
                  o.status === "completed" ? "bg-emerald-500/15 text-emerald-400"
                  : o.status === "materials_issued" ? "bg-sky-500/15 text-sky-400"
                  : o.status === "cancelled" ? "bg-slate-500/15 text-slate-400"
                  : "bg-amber-500/15 text-amber-400"}`}>{o.status.replace("_", " ")}</span>
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  {o.status === "open" && (
                    <>
                      <button onClick={() => act(o, "issue")} disabled={busy === o.id}
                        className="text-xs text-sky-400 hover:underline">Issue materials</button>
                      <button onClick={() => act(o, "cancel")} disabled={busy === o.id}
                        className="text-xs text-rose-400 hover:underline">Cancel</button>
                    </>
                  )}
                  {o.status === "materials_issued" && (
                    <button onClick={() => act(o, "receive")} disabled={busy === o.id}
                      className="text-xs text-emerald-400 hover:underline">Receive goods</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {orders.length === 0 && !loading && (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No subcontract orders</td></tr>
          )}
        </tbody>
      </table>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New subcontract order</h2>
              <button onClick={() => setShowNew(false)}><X className="h-4 w-4" /></button>
            </div>
            <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Subcontractor"
              value={form.subcontractor} onChange={(e) => setForm({ ...form, subcontractor: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Product SKU"
                value={form.productSku} onChange={(e) => setForm({ ...form, productSku: e.target.value })} />
              <input className="rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Product name"
                value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
              <input type="number" className="rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Quantity"
                value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
              <input type="number" className="rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Fee per unit"
                value={form.feePerUnit} onChange={(e) => setForm({ ...form, feePerUnit: e.target.value })} />
            </div>
            <label className="block text-xs text-slate-400">Expected date
              <input type="date" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
            </label>
            <div className="text-xs text-slate-400">Materials to send</div>
            {form.materials.map((m, i) => (
              <div key={i} className="flex gap-2">
                <input className="flex-1 rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Component SKU"
                  value={m.sku} onChange={(e) => {
                    const materials = [...form.materials];
                    materials[i] = { ...m, sku: e.target.value };
                    setForm({ ...form, materials });
                  }} />
                <input type="number" className="w-24 rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Qty"
                  value={m.quantity} onChange={(e) => {
                    const materials = [...form.materials];
                    materials[i] = { ...m, quantity: e.target.value };
                    setForm({ ...form, materials });
                  }} />
              </div>
            ))}
            <button onClick={() => setForm({ ...form, materials: [...form.materials, { sku: "", quantity: "" }] })}
              className="text-xs text-sky-400 hover:underline">+ Add material</button>
            <button onClick={create}
              disabled={busy === "new" || !form.subcontractor || !form.productSku || !form.productName || !Number(form.quantity)}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy === "new" ? "Creating…" : "Create order"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
