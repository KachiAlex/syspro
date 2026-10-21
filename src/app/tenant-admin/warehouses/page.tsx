"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle, Boxes, Loader2, MonitorSmartphone, Plus, Trash2, Truck, Warehouse as WarehouseIcon, X,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

type Warehouse = {
  id: string; name: string; code: string; type: string; is_group: boolean;
  parent_warehouse_id: string | null; branch_id: string | null; status: string;
};
type Balance = {
  productSku: string; warehouseId: string; warehouseCode: string;
  warehouseName: string; branchId: string | null; quantity: number; value: number;
};
type Voucher = {
  id: string; referenceId: string; chargeType: string; totalAmount: number;
  allocationMethod: string; allocations: { sku: string; amount: number }[];
  status: string; createdAt: string;
};
type Register = { id: string; code: string; name: string; isActive: boolean; warehouseId: string | null };
type Branch = { id: string; name: string };

const emptyLcItem = () => ({ sku: "", quantity: "1", unitCost: "", allocatedAmount: "" });

export default function WarehousesPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"warehouses" | "stock" | "landed" | "registers">("warehouses");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [registers, setRegisters] = useState<Register[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stockFilter, setStockFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [showWh, setShowWh] = useState(false);
  const [showLc, setShowLc] = useState(false);
  const [showReg, setShowReg] = useState(false);
  const [whForm, setWhForm] = useState({
    name: "", code: "", parentWarehouseId: "", branchId: "", type: "warehouse", isGroup: false,
  });
  const [lcForm, setLcForm] = useState({
    referenceId: "", chargeType: "freight", totalAmount: "", allocationMethod: "value",
  });
  const [lcItems, setLcItems] = useState([emptyLcItem()]);
  const [regForm, setRegForm] = useState({ code: "", name: "", warehouseId: "" });

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const stockParams = stockFilter ? `&warehouseId=${stockFilter}` : "";
      const [w, b, v, r, br] = await Promise.all([
        fetch(`/api/inventory/warehouses?${qs()}`).then((x) => x.json()),
        fetch(`/api/inventory/warehouses/stock?${qs()}${stockParams}`).then((x) => x.json()),
        fetch(`/api/inventory/landed-cost?${qs()}`).then((x) => x.json()),
        fetch(`/api/pos/registers?${qs()}&all=1`).then((x) => x.json()),
        fetch(`/api/finance/branches?${qs()}`).then((x) => x.json()).catch(() => ({})),
      ]);
      setWarehouses(w.warehouses ?? []);
      setBalances(b.balances ?? []);
      setVouchers(v.vouchers ?? []);
      setRegisters(r.registers ?? []);
      setBranches(br.branches ?? []);
      if (w.error) setError(w.error);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, stockFilter]);

  const post = async (url: string, body: any, success: string, onDone?: () => void, method = "POST") => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMsg(success); onDone?.();
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const TABS = [
    ["warehouses", "Warehouses", WarehouseIcon], ["stock", "Stock by warehouse", Boxes],
    ["landed", "Landed cost", Truck], ["registers", "POS registers", MonitorSmartphone],
  ] as const;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WarehouseIcon className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Warehouses &amp; Stock Locations</h1>
            <p className="text-sm text-slate-400">Stock locations, per-warehouse balances, landed cost vouchers, and till registers</p>
          </div>
        </div>
        <div className="flex gap-2">
          {tab === "warehouses" && (
            <button onClick={() => setShowWh(true)}
              className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
              <Plus className="h-4 w-4" /> New warehouse
            </button>
          )}
          {tab === "landed" && (
            <button onClick={() => setShowLc(true)}
              className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
              <Plus className="h-4 w-4" /> New voucher
            </button>
          )}
          {tab === "registers" && (
            <button onClick={() => setShowReg(true)}
              className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
              <Plus className="h-4 w-4" /> New register
            </button>
          )}
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}

      <div className="flex gap-1 border-b border-slate-800">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === key ? "border-sky-400 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}

      {tab === "warehouses" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              {["Code", "Name", "Type", "Parent", "Branch", "Status", ""].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {warehouses.map((w) => (
              <tr key={w.id} className="border-t border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">{w.code}</td>
                <td className="px-3 py-2">{w.name}{w.is_group && <span className="ml-2 text-xs text-slate-500">(group)</span>}</td>
                <td className="px-3 py-2 capitalize text-slate-400">{w.type}</td>
                <td className="px-3 py-2 text-slate-400">
                  {warehouses.find((p) => p.id === w.parent_warehouse_id)?.name ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {branches.find((b) => b.id === w.branch_id)?.name ?? w.branch_id ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${w.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                    {w.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {!w.is_group && (
                    <button disabled={busy}
                      onClick={() => void post(`/api/inventory/warehouses/${w.id}?${qs()}`, {}, "Warehouse deleted", undefined, "DELETE")}
                      className="flex items-center gap-1 text-xs text-rose-400 hover:underline">
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {warehouses.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No warehouses — create your first stock location.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "stock" && (
        <div className="space-y-3">
          <select className="rounded bg-slate-800 px-3 py-1.5 text-sm"
            value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
            <option value="">All warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                {["SKU", "Warehouse", "Qty", "Value"].map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balances.map((b, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="px-3 py-2 font-mono text-xs">{b.productSku}</td>
                  <td className="px-3 py-2">{b.warehouseName} <span className="text-xs text-slate-500">({b.warehouseCode})</span></td>
                  <td className={`px-3 py-2 ${b.quantity < 0 ? "text-rose-400" : ""}`}>{b.quantity}</td>
                  <td className="px-3 py-2">{fmt(b.value)}</td>
                </tr>
              ))}
              {balances.length === 0 && !loading && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-slate-500">No stock balances</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "landed" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              {["Reference", "Charge", "Amount", "Allocation", "Items", "Status", "Posted"].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id} className="border-t border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">{v.referenceId}</td>
                <td className="px-3 py-2 capitalize">{v.chargeType.replace(/_/g, " ")}</td>
                <td className="px-3 py-2">{fmt(v.totalAmount)}</td>
                <td className="px-3 py-2 text-slate-400">{v.allocationMethod}</td>
                <td className="px-3 py-2 text-slate-400">{v.allocations?.length ?? 0} sku(s)</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${v.status === "posted" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                    {v.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">{String(v.createdAt).slice(0, 10)}</td>
              </tr>
            ))}
            {vouchers.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                No landed-cost vouchers — allocate freight/customs onto received stock.
              </td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "registers" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              {["Code", "Name", "Warehouse", "Status", ""].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registers.map((r) => (
              <tr key={r.id} className="border-t border-slate-800">
                <td className="px-3 py-2 font-mono">{r.code}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 text-slate-400">
                  {warehouses.find((w) => w.id === r.warehouseId)?.name ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${r.isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                    {r.isActive ? "active" : "inactive"}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <button disabled={busy}
                    onClick={() => void post(`/api/pos/registers?${qs()}`, { id: r.id, isActive: !r.isActive }, `Register ${r.isActive ? "deactivated" : "activated"}`, undefined, "PATCH")}
                    className="text-xs text-sky-400 hover:underline">
                    {r.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
            {registers.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                No registers — create one per till to scope shifts and receipt sequences.
              </td></tr>
            )}
          </tbody>
        </table>
      )}

      {showWh && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New warehouse</h2>
              <button onClick={() => setShowWh(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Name"
                value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} />
              <input className="rounded bg-slate-800 px-3 py-2 text-sm uppercase" placeholder="Code"
                value={whForm.code} onChange={(e) => setWhForm({ ...whForm, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">Type
                <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={whForm.type} onChange={(e) => setWhForm({ ...whForm, type: e.target.value })}>
                  <option value="warehouse">Warehouse</option><option value="transit">Transit</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">Branch
                <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={whForm.branchId} onChange={(e) => setWhForm({ ...whForm, branchId: e.target.value })}>
                  <option value="">None</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs text-slate-400">Parent warehouse (optional)
              <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={whForm.parentWarehouseId} onChange={(e) => setWhForm({ ...whForm, parentWarehouseId: e.target.value })}>
                <option value="">None</option>
                {warehouses.filter((w) => w.is_group || !w.parent_warehouse_id).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={whForm.isGroup}
                onChange={(e) => setWhForm({ ...whForm, isGroup: e.target.checked })} />
              Group warehouse (holds children, no direct stock)
            </label>
            <button disabled={busy || !whForm.name}
              onClick={() => void post(`/api/inventory/warehouses?${qs()}`, {
                name: whForm.name, code: whForm.code || undefined,
                parentWarehouseId: whForm.parentWarehouseId || undefined,
                branchId: whForm.branchId || undefined,
                type: whForm.type, isGroup: whForm.isGroup,
              }, "Warehouse created", () => setShowWh(false))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Saving…" : "Create warehouse"}
            </button>
          </div>
        </div>
      )}

      {showLc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New landed-cost voucher</h2>
              <button onClick={() => setShowLc(false)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400">
              Allocates freight/customs onto received items — inventory value rises and a payable posts to GL.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Reference (PO / bill / GRN id)"
                value={lcForm.referenceId} onChange={(e) => setLcForm({ ...lcForm, referenceId: e.target.value })} />
              <label className="text-xs text-slate-400">Charge type
                <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={lcForm.chargeType} onChange={(e) => setLcForm({ ...lcForm, chargeType: e.target.value })}>
                  <option value="freight">Freight</option><option value="customs_duty">Customs duty</option>
                  <option value="insurance">Insurance</option><option value="other">Other</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">Total amount
                <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={lcForm.totalAmount} onChange={(e) => setLcForm({ ...lcForm, totalAmount: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">Allocate by
                <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={lcForm.allocationMethod} onChange={(e) => setLcForm({ ...lcForm, allocationMethod: e.target.value })}>
                  <option value="value">Item value</option><option value="quantity">Quantity</option>
                  <option value="manual">Manual amounts</option>
                </select>
              </label>
            </div>
            <h3 className="text-xs font-semibold text-slate-300">Items received</h3>
            {lcItems.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_64px_96px_96px_24px] gap-2 items-center">
                <input className="rounded bg-slate-800 px-2 py-2 text-sm" placeholder="SKU"
                  value={it.sku} onChange={(e) => {
                    const ls = [...lcItems]; ls[i] = { ...it, sku: e.target.value }; setLcItems(ls);
                  }} />
                <input type="number" className="rounded bg-slate-800 px-2 py-2 text-sm" placeholder="Qty"
                  value={it.quantity} onChange={(e) => {
                    const ls = [...lcItems]; ls[i] = { ...it, quantity: e.target.value }; setLcItems(ls);
                  }} />
                <input type="number" className="rounded bg-slate-800 px-2 py-2 text-sm" placeholder="Unit cost"
                  value={it.unitCost} onChange={(e) => {
                    const ls = [...lcItems]; ls[i] = { ...it, unitCost: e.target.value }; setLcItems(ls);
                  }} />
                <input type="number" className="rounded bg-slate-800 px-2 py-2 text-sm"
                  placeholder={lcForm.allocationMethod === "manual" ? "Allocated" : "auto"}
                  disabled={lcForm.allocationMethod !== "manual"}
                  value={it.allocatedAmount} onChange={(e) => {
                    const ls = [...lcItems]; ls[i] = { ...it, allocatedAmount: e.target.value }; setLcItems(ls);
                  }} />
                {lcItems.length > 1 ? (
                  <button className="text-rose-400" onClick={() => setLcItems(lcItems.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </button>
                ) : <span />}
              </div>
            ))}
            <button className="text-xs text-sky-400" onClick={() => setLcItems([...lcItems, emptyLcItem()])}>
              + add item
            </button>
            <button
              disabled={busy || !lcForm.referenceId || !Number(lcForm.totalAmount)
                || lcItems.some((it) => !it.sku || !Number(it.quantity))
                || (lcForm.allocationMethod === "manual" && lcItems.some((it) => !it.allocatedAmount))}
              onClick={() => void post(`/api/inventory/landed-cost?${qs()}`, {
                referenceId: lcForm.referenceId, chargeType: lcForm.chargeType,
                totalAmount: Number(lcForm.totalAmount), allocationMethod: lcForm.allocationMethod,
                items: lcItems.map((it) => ({
                  sku: it.sku, quantity: Number(it.quantity),
                  unitCost: Number(it.unitCost || 0),
                  allocatedAmount: it.allocatedAmount ? Number(it.allocatedAmount) : undefined,
                })),
              }, "Voucher posted — stock value updated", () => setShowLc(false))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Posting…" : "Post voucher"}
            </button>
          </div>
        </div>
      )}

      {showReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New POS register</h2>
              <button onClick={() => setShowReg(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded bg-slate-800 px-3 py-2 text-sm uppercase" placeholder="Code (TILL-2)"
                value={regForm.code} onChange={(e) => setRegForm({ ...regForm, code: e.target.value.toUpperCase() })} />
              <input className="rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Name"
                value={regForm.name} onChange={(e) => setRegForm({ ...regForm, name: e.target.value })} />
            </div>
            <label className="block text-xs text-slate-400">Warehouse (optional)
              <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={regForm.warehouseId} onChange={(e) => setRegForm({ ...regForm, warehouseId: e.target.value })}>
                <option value="">Default</option>
                {warehouses.filter((w) => !w.is_group).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </label>
            <button disabled={busy || !regForm.code || !regForm.name}
              onClick={() => void post(`/api/pos/registers?${qs()}`, {
                code: regForm.code, name: regForm.name,
                warehouseId: regForm.warehouseId || undefined,
              }, "Register created", () => setShowReg(false))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Saving…" : "Create register"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
