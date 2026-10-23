"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Layers, Loader2, Plus, X } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type Run = {
  id: string; run_number: string; product_sku: string; product_name: string;
  total_quantity: number; batch_size: number; status: string;
  workOrders?: Array<{ id: string; orderNumber: string; quantity: number; status: string; lotNo: string }>;
};

export default function BatchRunsPage() {
  const { tenantSlug } = useTenantContext();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    productSku: "", productName: "", totalQuantity: "", batchSize: "", notes: "",
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/manufacturing/batch-runs?tenantSlug=${tenantSlug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      setRuns(data.runs ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const create = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/manufacturing/batch-runs?tenantSlug=${tenantSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSku: form.productSku, productName: form.productName,
          totalQuantity: Number(form.totalQuantity), batchSize: Number(form.batchSize),
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setShowNew(false); setForm({ ...form, productSku: "", productName: "", totalQuantity: "", batchSize: "" });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const cancel = async (runId: string) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/manufacturing/batch-runs?tenantSlug=${tenantSlug}&runId=${runId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Cancel failed");
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Batch Production Runs</h1>
            <p className="text-sm text-theme-text-secondary">Split production into lot-tracked work orders</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded bg-theme-accent px-3 py-1.5 text-sm hover:bg-theme-accent-hover">
          <Plus className="h-4 w-4" /> New run
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-theme-text-secondary">
            {["Run", "Product", "Total qty", "Batch size", "Batches", "Status", ""].map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <React.Fragment key={r.id}>
              <tr className="border-t border-theme-border">
                <td className="px-3 py-2">
                  <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                    className="text-sky-400 hover:underline">{r.run_number}</button>
                </td>
                <td className="px-3 py-2">{r.product_name} <span className="text-theme-text-tertiary">({r.product_sku})</span></td>
                <td className="px-3 py-2">{r.total_quantity}</td>
                <td className="px-3 py-2">{r.batch_size}</td>
                <td className="px-3 py-2">{r.workOrders?.length ?? 0}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${
                    r.status === "completed" ? "bg-theme-success-bg text-theme-success"
                    : r.status === "in_progress" ? "bg-sky-500/15 text-sky-400"
                    : r.status === "cancelled" ? "bg-theme-muted text-theme-text-secondary"
                    : "bg-amber-500/15 text-theme-warning"}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {r.status === "open" && (
                    <button onClick={() => cancel(r.id)} disabled={busy}
                      className="text-xs text-rose-400 hover:underline">Cancel</button>
                  )}
                </td>
              </tr>
              {expanded === r.id && (
                <tr className="bg-theme-surface/40">
                  <td colSpan={7} className="px-6 py-2">
                    <table className="w-full text-xs">
                      <tbody>
                        {(r.workOrders ?? []).map((w) => (
                          <tr key={w.id}>
                            <td className="py-1">{w.orderNumber}</td>
                            <td>{w.lotNo}</td>
                            <td>{w.quantity}</td>
                            <td className="text-theme-text-secondary">{w.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {runs.length === 0 && !loading && (
            <tr><td colSpan={7} className="px-3 py-6 text-center text-theme-text-tertiary">No production runs</td></tr>
          )}
        </tbody>
      </table>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="w-full max-w-sm rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New production run</h2>
              <button onClick={() => setShowNew(false)}><X className="h-4 w-4" /></button>
            </div>
            <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Product SKU"
              value={form.productSku} onChange={(e) => setForm({ ...form, productSku: e.target.value })} />
            <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Product name"
              value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-theme-text-secondary">Total qty
                <input type="number" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.totalQuantity} onChange={(e) => setForm({ ...form, totalQuantity: e.target.value })} />
              </label>
              <label className="text-xs text-theme-text-secondary">Batch size
                <input type="number" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.batchSize} onChange={(e) => setForm({ ...form, batchSize: e.target.value })} />
              </label>
            </div>
            <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Notes (optional)"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button onClick={create}
              disabled={busy || !form.productSku || !form.productName || !Number(form.totalQuantity) || !Number(form.batchSize)}
              className="w-full rounded bg-theme-accent py-2 text-sm hover:bg-theme-accent-hover disabled:opacity-50">
              {busy ? "Creating…" : "Create run + work orders"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
