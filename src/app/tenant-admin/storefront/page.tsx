"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Globe, Loader2, AlertCircle, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const STATUS_FILTERS = ["all", "pending", "confirmed", "cancelled"] as const;

export default function StorefrontOrdersPage() {
  const { tenantSlug } = useTenantContext();
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/storefront/orders?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=200`);
    const data = await res.json().catch(() => ({}));
    setOrders(data.orders ?? []);
    setLoading(false);
  }, [tenantSlug]);

  useEffect(() => { load(); }, [load]);

  const act = async (orderId: string, action: "confirm" | "cancel") => {
    setBusy(orderId); setError(null);
    const res = await fetch(`/api/storefront/orders?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, orderId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error ?? `${action} failed`); return; }
    load();
  };

  const visible = orders.filter((o) => filter === "all" || o.status === filter);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC] flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-400" /> Store Orders
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Public storefront: <code className="text-emerald-400">/store/{tenantSlug}</code>
            <a href={`/store/${tenantSlug}`} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 text-slate-400 hover:text-[#F8FAFC]">
              open <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        <div className="flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === f ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-700">
                <th className="px-4 py-3">Order</th><th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Items</th><th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Status</th><th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {visible.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono text-xs text-[#F8FAFC]">{o.orderNumber}</td>
                  <td className="px-4 py-3">
                    <p className="text-[#F8FAFC]">{o.customerName}</p>
                    <p className="text-xs text-slate-500">{o.customerEmail ?? o.customerPhone ?? ""}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {Array.isArray(o.items) ? o.items.map((i: any) => `${i.name ?? i.sku}×${i.quantity}`).join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#F8FAFC]">{fmt(o.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                      o.status === "confirmed" ? "bg-emerald-500/20 text-emerald-400"
                      : o.status === "cancelled" ? "bg-red-500/20 text-red-400"
                      : "bg-amber-500/20 text-amber-400"
                    }`}>{o.status}</span>
                    {o.salesOrderId && <p className="text-[10px] text-slate-500 mt-1">SO {o.salesOrderId}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{new Date(o.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {o.status === "pending" && (
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => act(o.id, "confirm")} disabled={busy === o.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500 disabled:opacity-40"
                        >
                          {busy === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Confirm
                        </button>
                        <button
                          onClick={() => act(o.id, "cancel")} disabled={busy === o.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-600 disabled:opacity-40"
                        >
                          <XCircle className="w-3 h-3" /> Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-500">No {filter === "all" ? "" : filter} orders</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
