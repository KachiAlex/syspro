"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type Mr = {
  id: string;
  mrNumber: string;
  requestType: string;
  status: string;
  requiredBy: string | null;
  itemCount?: number;
};

type Rule = {
  id: string;
  productSku: string;
  warehouseId: string;
  reorderLevel: number;
  reorderQuantity: number;
  requestType: string;
  enabled: boolean;
  currentQuantity: number;
  belowLevel: boolean;
};

export default function MaterialRequestsPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"requests" | "reorder">("requests");
  const [requests, setRequests] = useState<Mr[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ requestType: "purchase", requiredBy: "", notes: "" });
  const [items, setItems] = useState([{ productId: "", quantity: 1 }]);
  const [ruleForm, setRuleForm] = useState({ productSku: "", warehouseId: "main", reorderLevel: 0, reorderQuantity: 0, requestType: "purchase" });
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [convertSupplier, setConvertSupplier] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, rRes, sRes] = await Promise.all([
        fetch("/api/inventory/material-requests"),
        fetch("/api/inventory/material-requests?view=reorder-rules"),
        fetch("/api/suppliers"),
      ]);
      const mData = await mRes.json();
      if (mRes.ok) setRequests(mData.requests ?? []);
      const rData = await rRes.json();
      if (rRes.ok) setRules(rData.rules ?? []);
      const sData = await sRes.json().catch(() => ({}));
      setSuppliers((sData.suppliers ?? sData.vendors ?? []).map((v: any) => ({ id: v.id, name: v.name ?? v.supplier_name })));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const res = await fetch("/api/inventory/material-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType: form.requestType,
        requiredBy: form.requiredBy || null,
        notes: form.notes || null,
        items: items.filter((i) => i.productId),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Create failed"); return; }
    setShowCreate(false);
    load();
  };

  const act = async (id: string, body: object) => {
    const res = await fetch(`/api/inventory/material-requests/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Action failed"); return; }
    load();
  };

  const saveRule = async () => {
    const res = await fetch("/api/inventory/material-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upsert-reorder-rule", ...ruleForm }),
    });
    if (!res.ok) { setError("Rule save failed"); return; }
    setRuleForm({ productSku: "", warehouseId: "main", reorderLevel: 0, reorderQuantity: 0, requestType: "purchase" });
    load();
  };

  const runScan = async () => {
    const res = await fetch("/api/inventory/material-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run-reorder-scan" }),
    });
    const data = await res.json();
    if (res.ok) setError(data.triggered ? `Created ${data.triggered} material request(s): ${data.materialRequests.join(", ")}` : "No items below reorder level");
    load();
  };

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-theme-bg p-6 text-theme-text-primary">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Material Requests &amp; Replenishment</h1>
            <p className="text-sm text-theme-text-secondary">Internal requisitions → PO / work order, plus reorder-level automation</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500">New Request</button>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-theme-surface p-1">
          {(["requests", "reorder"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm ${tab === t ? "bg-theme-elevated" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>
              {t === "requests" ? "Material Requests" : "Reorder Rules"}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 rounded-lg bg-theme-muted p-3 text-sm text-theme-text-primary">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "requests" && (
          <>
            {showCreate && (
              <div className="mb-6 rounded-xl border border-theme-border bg-theme-surface p-5">
                <div className="mb-3 grid grid-cols-3 gap-3">
                  <select value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value })}
                    className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm">
                    <option value="purchase">Purchase</option>
                    <option value="manufacture">Manufacture</option>
                    <option value="transfer">Transfer</option>
                  </select>
                  <input type="date" value={form.requiredBy} onChange={(e) => setForm({ ...form, requiredBy: e.target.value })}
                    className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
                  <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="mb-2 flex gap-2">
                    <input placeholder="Product SKU" value={item.productId}
                      onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, productId: e.target.value } : it))}
                      className="flex-1 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
                    <input type="number" placeholder="Qty" value={item.quantity} min={0}
                      onChange={(e) => setItems(items.map((it, i) => i === idx ? { ...it, quantity: Number(e.target.value) } : it))}
                      className="w-28 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={() => setItems([...items, { productId: "", quantity: 1 }])}
                    className="rounded-lg bg-theme-muted px-3 py-2 text-sm hover:bg-theme-elevated">+ Item</button>
                  <button onClick={create} disabled={!items.some((i) => i.productId)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">Create</button>
                  <button onClick={() => setShowCreate(false)} className="rounded-lg bg-theme-muted px-3 py-2 text-sm hover:bg-theme-elevated">Cancel</button>
                </div>
              </div>
            )}
            <div className="rounded-xl border border-theme-border bg-theme-surface">
              <table className="w-full text-sm">
                <thead className="border-b border-theme-border text-left text-theme-text-secondary">
                  <tr><th className="p-3">MR #</th><th className="p-3">Type</th><th className="p-3">Required By</th><th className="p-3">Items</th><th className="p-3">Status</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">Loading…</td></tr>
                  ) : requests.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">No material requests</td></tr>
                  ) : requests.map((m) => (
                    <tr key={m.id} className="border-b border-theme-border">
                      <td className="p-3 font-mono">{m.mrNumber}</td>
                      <td className="p-3">{m.requestType}</td>
                      <td className="p-3 text-theme-text-secondary">{m.requiredBy ? String(m.requiredBy).slice(0, 10) : "—"}</td>
                      <td className="p-3">{m.itemCount}</td>
                      <td className="p-3"><span className="rounded-full bg-theme-elevated px-2 py-0.5 text-xs">{m.status}</span></td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          {m.status === "draft" && <button onClick={() => act(m.id, { action: "open" })} className="rounded bg-blue-900/50 px-2 py-1 text-xs text-blue-300">Open</button>}
                          {(m.status === "open" || m.status === "partially_ordered") && m.requestType === "purchase" && (
                            <>
                              <select value={convertSupplier} onChange={(e) => setConvertSupplier(e.target.value)}
                                className="rounded bg-theme-muted px-2 py-1 text-xs">
                                <option value="">Supplier…</option>
                                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <button onClick={() => act(m.id, { action: "convert", supplierId: convertSupplier || null })}
                                className="rounded bg-emerald-800 px-2 py-1 text-xs hover:bg-emerald-700">→ PO</button>
                            </>
                          )}
                          {(m.status === "open" || m.status === "partially_ordered") && m.requestType === "manufacture" && (
                            <button onClick={() => act(m.id, { action: "convert" })}
                              className="rounded bg-emerald-800 px-2 py-1 text-xs hover:bg-emerald-700">→ WO</button>
                          )}
                          {["draft", "open"].includes(m.status) && <button onClick={() => act(m.id, { action: "cancel" })} className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-300">Cancel</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "reorder" && (
          <>
            <div className="mb-4 flex items-end gap-2 rounded-xl border border-theme-border bg-theme-surface p-4">
              <input placeholder="SKU" value={ruleForm.productSku} onChange={(e) => setRuleForm({ ...ruleForm, productSku: e.target.value })}
                className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
              <input placeholder="Warehouse" value={ruleForm.warehouseId} onChange={(e) => setRuleForm({ ...ruleForm, warehouseId: e.target.value })}
                className="rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
              <input type="number" placeholder="Reorder at" value={ruleForm.reorderLevel} min={0}
                onChange={(e) => setRuleForm({ ...ruleForm, reorderLevel: Number(e.target.value) })}
                className="w-28 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
              <input type="number" placeholder="Reorder qty" value={ruleForm.reorderQuantity} min={0}
                onChange={(e) => setRuleForm({ ...ruleForm, reorderQuantity: Number(e.target.value) })}
                className="w-28 rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm" />
              <button onClick={saveRule} disabled={!ruleForm.productSku}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">Save Rule</button>
              <button onClick={runScan} className="ml-auto rounded-lg bg-theme-accent px-4 py-2 text-sm hover:bg-theme-accent-hover">Run Scan Now</button>
            </div>
            <div className="rounded-xl border border-theme-border bg-theme-surface">
              <table className="w-full text-sm">
                <thead className="border-b border-theme-border text-left text-theme-text-secondary">
                  <tr><th className="p-3">SKU</th><th className="p-3">Warehouse</th><th className="p-3 text-right">On Hand</th><th className="p-3 text-right">Reorder At</th><th className="p-3 text-right">Reorder Qty</th><th className="p-3">Type</th><th className="p-3">State</th></tr>
                </thead>
                <tbody>
                  {rules.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-theme-text-tertiary">No reorder rules</td></tr>
                  ) : rules.map((r) => (
                    <tr key={r.id} className={`border-b border-theme-border ${r.belowLevel ? "bg-amber-900/10" : ""}`}>
                      <td className="p-3 font-mono">{r.productSku}</td>
                      <td className="p-3">{r.warehouseId}</td>
                      <td className={`p-3 text-right font-mono ${r.belowLevel ? "text-amber-400" : ""}`}>{r.currentQuantity}</td>
                      <td className="p-3 text-right font-mono">{r.reorderLevel}</td>
                      <td className="p-3 text-right font-mono">{r.reorderQuantity}</td>
                      <td className="p-3">{r.requestType}</td>
                      <td className="p-3">{r.belowLevel ? <span className="text-amber-400">below level</span> : <span className="text-emerald-400">ok</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
