"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["packing-slips", "putaway", "party-codes"] as const;

export default function InventoryEdgePage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("putaway");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const [slips, rules, codes] = await Promise.all([
      fetch("/api/inventory/edge?view=packing-slips").then((r) => r.json()).catch(() => ({})),
      fetch("/api/inventory/edge?view=putaway-rules").then((r) => r.json()).catch(() => ({})),
      fetch("/api/inventory/edge?view=party-codes").then((r) => r.json()).catch(() => ({})),
    ]);
    setData({ slips: slips.slips ?? [], rules: rules.rules ?? [], codes: codes.codes ?? [] });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/inventory/edge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return null; }
    setError(""); load(); return d;
  };

  const input = "rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500";
  const btnSm = "rounded bg-theme-muted px-2 py-1 text-xs hover:bg-theme-elevated";
  const th = "p-3";

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-theme-bg p-6 text-theme-text-primary">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-2xl font-bold">Inventory Edge</h1>
        <p className="mb-4 text-sm text-theme-text-secondary">Packing slips, putaway rules, party item codes</p>
        <div className="mb-4 flex gap-1 rounded-lg bg-theme-surface p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-theme-elevated" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-theme-muted p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "packing-slips" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Sales order ID" value={f.psSo ?? ""} onChange={(e) => setF({ ...f, psSo: e.target.value })} className={input} />
              <input type="number" placeholder="Cases from" value={f.psFrom ?? 1} onChange={(e) => setF({ ...f, psFrom: e.target.value })} className={`${input} w-28`} />
              <input type="number" placeholder="Cases to" value={f.psTo ?? ""} onChange={(e) => setF({ ...f, psTo: e.target.value })} className={`${input} w-28`} />
              <input placeholder='Items JSON [{"sku":"X","qty":5}]' value={f.psItems ?? ""} onChange={(e) => setF({ ...f, psItems: e.target.value })} className={`${input} flex-1 font-mono`} />
              <button className={btn} onClick={() => post({ action: "create-slip", salesOrderId: f.psSo, fromCaseNo: Number(f.psFrom), toCaseNo: f.psTo ? Number(f.psTo) : undefined, items: JSON.parse(f.psItems || "[]") })}>Create Slip</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Slip</th><th className={th}>Cases</th><th className={th}>Items</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.slips?.map((s: any) => (
                  <tr key={s.id} className="border-t border-theme-border">
                    <td className={`${th} font-mono`}>{s.slip_number}</td>
                    <td className={th}>{s.from_case_no}{s.to_case_no ? `–${s.to_case_no}` : ""}</td>
                    <td className={th}>{(s.items ?? []).length}</td><td className={th}>{s.status}</td>
                    <td className={th}>{s.status === "draft" && <button className={btnSm} onClick={() => post({ action: "slip-status", id: s.id, status: "submitted" })}>Submit</button>}</td>
                  </tr>
                ))}
                {!data.slips?.length && <tr><td colSpan={5} className="p-6 text-center text-theme-text-tertiary">No packing slips</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "putaway" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Product SKU" value={f.puSku ?? ""} onChange={(e) => setF({ ...f, puSku: e.target.value })} className={input} />
              <input placeholder="Warehouse ID" value={f.puWh ?? ""} onChange={(e) => setF({ ...f, puWh: e.target.value })} className={input} />
              <input placeholder="Bin" value={f.puBin ?? ""} onChange={(e) => setF({ ...f, puBin: e.target.value })} className={`${input} w-24`} />
              <input type="number" placeholder="Capacity" value={f.puCap ?? ""} onChange={(e) => setF({ ...f, puCap: e.target.value })} className={`${input} w-28`} />
              <input type="number" placeholder="Priority" value={f.puPri ?? 1} onChange={(e) => setF({ ...f, puPri: e.target.value })} className={`${input} w-20`} />
              <button className={btn} onClick={() => post({ action: "upsert-rule", productSku: f.puSku, warehouseId: f.puWh, bin: f.puBin, capacity: Number(f.puCap ?? 0), priority: Number(f.puPri ?? 1) })}>Add Rule</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <input placeholder="SKU" value={f.puTestSku ?? ""} onChange={(e) => setF({ ...f, puTestSku: e.target.value })} className={input} />
              <input type="number" placeholder="Qty" value={f.puTestQty ?? 1} onChange={(e) => setF({ ...f, puTestQty: e.target.value })} className={`${input} w-24`} />
              <button className={btnSm} onClick={async () => {
                const d = await fetch(`/api/inventory/edge?view=putaway-suggest&sku=${f.puTestSku}&qty=${f.puTestQty}`).then((r) => r.json());
                setMsg(d.suggestions?.length ? `Suggest: ${d.suggestions.map((s: any) => s.warehouse_name ?? s.warehouse_id).join(", ")}` : "No matching putaway rule");
              }}>Suggest Warehouse</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>SKU</th><th className={th}>Warehouse</th><th className={th}>Bin</th><th className={th}>Capacity</th><th className={th}>Priority</th><th className={th}>Active</th></tr></thead>
              <tbody>
                {data.rules?.map((r: any) => (
                  <tr key={r.id} className="border-t border-theme-border">
                    <td className={`${th} font-mono`}>{r.product_sku}</td><td className={th}>{r.warehouse_name ?? r.warehouse_id}</td>
                    <td className={th}>{r.bin ?? "—"}</td><td className={th}>{r.capacity}</td>
                    <td className={th}>{r.priority}</td><td className={th}>{r.is_active ? "✓" : "—"}</td>
                  </tr>
                ))}
                {!data.rules?.length && <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">No putaway rules</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "party-codes" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Our SKU" value={f.pcSku ?? ""} onChange={(e) => setF({ ...f, pcSku: e.target.value })} className={input} />
              <select value={f.pcType ?? "customer"} onChange={(e) => setF({ ...f, pcType: e.target.value })} className={input}>
                <option value="customer">Customer code</option><option value="manufacturer">Manufacturer part no.</option><option value="supplier">Supplier code</option>
              </select>
              <input placeholder="Their code" value={f.pcCode ?? ""} onChange={(e) => setF({ ...f, pcCode: e.target.value })} className={input} />
              <input placeholder="Party name" value={f.pcName ?? ""} onChange={(e) => setF({ ...f, pcName: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "upsert-party-code", productSku: f.pcSku, partyType: f.pcType, partyCode: f.pcCode, partyName: f.pcName })}>Map</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Our SKU</th><th className={th}>Party Type</th><th className={th}>Their Code</th><th className={th}>Party</th></tr></thead>
              <tbody>
                {data.codes?.map((c: any) => (
                  <tr key={c.id} className="border-t border-theme-border">
                    <td className={`${th} font-mono`}>{c.product_sku}</td><td className={th}>{c.party_type}</td>
                    <td className={`${th} font-mono`}>{c.party_code}</td><td className={th}>{c.party_name ?? "—"}</td>
                  </tr>
                ))}
                {!data.codes?.length && <tr><td colSpan={4} className="p-6 text-center text-theme-text-tertiary">No party item codes</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
