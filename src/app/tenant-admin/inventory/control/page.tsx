"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["uom", "groups", "variants", "bundles", "reconciliation", "reservations", "inspections"] as const;
type Tab = (typeof TABS)[number];

export default function InventoryControlPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<Tab>("uom");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [uoms, groups, attrs, variants, bundles, recs, resv, insp] = await Promise.all([
      fetch("/api/inventory/item-master?view=uoms").then((r) => r.json()).catch(() => ({})),
      fetch("/api/inventory/item-master?view=item-groups").then((r) => r.json()).catch(() => ({})),
      fetch("/api/inventory/item-master?view=attributes").then((r) => r.json()).catch(() => ({})),
      fetch("/api/inventory/item-master?view=variants").then((r) => r.json()).catch(() => ({})),
      fetch("/api/inventory/item-master?view=bundles").then((r) => r.json()).catch(() => ({})),
      fetch("/api/inventory/stock-control?view=reconciliations").then((r) => r.json()).catch(() => ({})),
      fetch("/api/inventory/stock-control?view=reservations").then((r) => r.json()).catch(() => ({})),
      fetch("/api/inventory/stock-control?view=inspections").then((r) => r.json()).catch(() => ({})),
    ]);
    setData({
      uoms: uoms.uoms ?? [], conversions: uoms.conversions ?? [],
      groups: groups.groups ?? [], attributes: attrs.attributes ?? [],
      variants: variants.variants ?? [], bundles: bundles.bundles ?? [],
      recs: recs.reconciliations ?? [], resv: resv.reservations ?? [], insp: insp.inspections ?? [],
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return; }
    setError(""); load();
  };

  const input = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50";
  const btnSm = "rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700";
  const th = "p-3";
  const [f, setF] = useState<Record<string, any>>({});

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">Inventory Control</h1>
        <p className="mb-4 text-sm text-slate-400">UOM, item groups &amp; variants, bundles, cycle counts, reservations, receipt QC</p>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-slate-700" : "text-slate-400 hover:text-white"}`}>{t}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-slate-800 p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "uom" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder="UOM name (e.g. Carton)" value={f.uom ?? ""} onChange={(e) => setF({ ...f, uom: e.target.value })} className={input} />
              <button className={btn} onClick={() => post("/api/inventory/item-master", { action: "upsert-uom", name: f.uom })}>Add UOM</button>
              <input placeholder="From" value={f.cFrom ?? ""} onChange={(e) => setF({ ...f, cFrom: e.target.value })} className={`${input} w-24`} />
              <input placeholder="To" value={f.cTo ?? ""} onChange={(e) => setF({ ...f, cTo: e.target.value })} className={`${input} w-24`} />
              <input type="number" placeholder="Factor" value={f.cFactor ?? ""} onChange={(e) => setF({ ...f, cFactor: e.target.value })} className={`${input} w-24`} />
              <button className={btn} onClick={() => post("/api/inventory/item-master", { action: "upsert-uom-conversion", fromUom: f.cFrom, toUom: f.cTo, factor: Number(f.cFactor) })}>+ Conversion</button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-2 text-sm font-semibold">Units of Measure</h3>
                {data.uoms?.map((u: any) => <div key={u.id} className="text-sm text-slate-300">{u.name}{u.must_be_whole ? " (whole)" : ""}</div>)}
                {!data.uoms?.length && <p className="text-sm text-slate-500">No UOMs defined</p>}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <h3 className="mb-2 text-sm font-semibold">Conversions</h3>
                {data.conversions?.map((c: any) => <div key={c.id} className="text-sm text-slate-300">1 {c.from_uom} = {c.factor} {c.to_uom}</div>)}
                {!data.conversions?.length && <p className="text-sm text-slate-500">No conversions</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "groups" && (
          <div>
            <div className="mb-3 flex gap-2">
              <input placeholder="Group name" value={f.gName ?? ""} onChange={(e) => setF({ ...f, gName: e.target.value })} className={input} />
              <select value={f.gParent ?? ""} onChange={(e) => setF({ ...f, gParent: e.target.value || null })} className={input}>
                <option value="">No parent (root)</option>
                {data.groups?.filter((g: any) => g.is_group).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <button className={btn} onClick={() => post("/api/inventory/item-master", { action: "upsert-item-group", name: f.gName, parentId: f.gParent, isGroup: false })}>Add Group</button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              {data.groups?.map((g: any) => (
                <div key={g.id} className="text-sm text-slate-300">{g.parent_name ? `${g.parent_name} → ` : ""}{g.name} <span className="text-slate-500">({g.product_count} items)</span></div>
              ))}
              {!data.groups?.length && <p className="text-sm text-slate-500">No groups — products use flat categories today</p>}
            </div>
          </div>
        )}

        {tab === "variants" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder="Attribute (e.g. Size)" value={f.aName ?? ""} onChange={(e) => setF({ ...f, aName: e.target.value })} className={input} />
              <input placeholder="Values csv (S,M,L)" value={f.aValues ?? ""} onChange={(e) => setF({ ...f, aValues: e.target.value })} className={input} />
              <button className={btn} onClick={() => post("/api/inventory/item-master", { action: "upsert-attribute", name: f.aName, values: String(f.aValues ?? "").split(",").map((s) => s.trim()).filter(Boolean) })}>Save Attribute</button>
            </div>
            <div className="flex gap-2">
              <input placeholder="Template product ID" value={f.vTemplate ?? ""} onChange={(e) => setF({ ...f, vTemplate: e.target.value })} className={input} />
              <input placeholder='Attributes JSON e.g. {"Size":"M"}' value={f.vAttrs ?? ""} onChange={(e) => setF({ ...f, vAttrs: e.target.value })} className={`${input} flex-1`} />
              <button className={btn} onClick={() => post("/api/inventory/item-master", { action: "create-variant", templateProductId: f.vTemplate, attributes: JSON.parse(f.vAttrs || "{}") })}>Create Variant</button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              {data.attributes?.map((a: any) => <div key={a.id} className="text-sm text-slate-300"><b>{a.name}</b>: {a.values?.join(", ")}</div>)}
              <hr className="my-2 border-slate-800" />
              {data.variants?.map((v: any) => <div key={v.id} className="text-sm text-slate-300">{v.variant_sku} — {JSON.stringify(v.attributes)}</div>)}
              {!data.variants?.length && <p className="text-sm text-slate-500">No variants</p>}
            </div>
          </div>
        )}

        {tab === "bundles" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Bundle SKU" value={f.bSku ?? ""} onChange={(e) => setF({ ...f, bSku: e.target.value })} className={input} />
              <input placeholder="Bundle name" value={f.bName ?? ""} onChange={(e) => setF({ ...f, bName: e.target.value })} className={input} />
              <input placeholder="Items csv SKU:qty (A-1:2,B-3:1)" value={f.bItems ?? ""} onChange={(e) => setF({ ...f, bItems: e.target.value })} className={`${input} flex-1`} />
              <button className={btn} onClick={() => post("/api/inventory/item-master", {
                action: "upsert-bundle", bundleSku: f.bSku, name: f.bName,
                items: String(f.bItems ?? "").split(",").map((p) => { const [s, q] = p.split(":"); return { productSku: s?.trim(), quantity: Number(q ?? 1) }; }).filter((i) => i.productSku),
              })}>Save Bundle</button>
            </div>
            {data.bundles?.map((b: any) => (
              <div key={b.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
                <b>{b.bundle_sku}</b> — {b.name}
                <div className="mt-1 text-slate-400">{b.items.map((i: any) => `${i.product_sku} ×${i.quantity}`).join(", ")}</div>
              </div>
            ))}
            {!data.bundles?.length && <p className="text-sm text-slate-500">No bundles</p>}
          </div>
        )}

        {tab === "reconciliation" && <ReconciliationTab data={data} post={post} input={input} btn={btn} btnSm={btnSm} th={th} f={f} setF={setF} />}

        {tab === "reservations" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder="SKU" value={f.rSku ?? ""} onChange={(e) => setF({ ...f, rSku: e.target.value })} className={input} />
              <input type="number" placeholder="Qty" value={f.rQty ?? ""} onChange={(e) => setF({ ...f, rQty: e.target.value })} className={`${input} w-28`} />
              <input placeholder="Warehouse" value={f.rWh ?? "main"} onChange={(e) => setF({ ...f, rWh: e.target.value })} className={`${input} w-28`} />
              <input placeholder="SO id (opt)" value={f.rSo ?? ""} onChange={(e) => setF({ ...f, rSo: e.target.value })} className={input} />
              <button className={btn} onClick={() => post("/api/inventory/stock-control", { action: "reserve", productSku: f.rSku, quantity: Number(f.rQty), warehouseId: f.rWh, salesOrderId: f.rSo || null })}>Reserve</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>SKU</th><th className={th}>Qty</th><th className={th}>Warehouse</th><th className={th}>SO</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.resv?.map((r: any) => (
                  <tr key={r.id} className="border-t border-slate-800/50">
                    <td className={th}>{r.product_sku}</td><td className={th}>{r.quantity}</td><td className={th}>{r.warehouse_id}</td>
                    <td className={th}>{r.sales_order_id ?? "—"}</td><td className={th}>{r.status}</td>
                    <td className={th}>{r.status === "active" && <button className={btnSm} onClick={() => post("/api/inventory/stock-control", { action: "release-reservation", id: r.id })}>Release</button>}</td>
                  </tr>
                ))}
                {!data.resv?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No reservations</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "inspections" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder="SKU" value={f.iSku ?? ""} onChange={(e) => setF({ ...f, iSku: e.target.value })} className={input} />
              <input type="number" placeholder="Qty inspected" value={f.iQty ?? ""} onChange={(e) => setF({ ...f, iQty: e.target.value })} className={`${input} w-32`} />
              <input placeholder="Reference (PO/GRN id)" value={f.iRef ?? ""} onChange={(e) => setF({ ...f, iRef: e.target.value })} className={input} />
              <button className={btn} onClick={() => post("/api/inventory/stock-control", { action: "create-inspection", productSku: f.iSku, inspectedQuantity: Number(f.iQty), referenceId: f.iRef || null })}>New Inspection</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>#</th><th className={th}>SKU</th><th className={th}>Inspected</th><th className={th}>Accepted</th><th className={th}>Rejected</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.insp?.map((i: any) => (
                  <tr key={i.id} className="border-t border-slate-800/50">
                    <td className={`${th} font-mono`}>{i.inspection_number}</td><td className={th}>{i.product_sku}</td>
                    <td className={th}>{i.inspected_quantity}</td><td className={th}>{i.accepted_quantity}</td><td className={th}>{i.rejected_quantity}</td>
                    <td className={th}>{i.status}</td>
                    <td className={th}>{i.status === "pending" && (
                      <div className="flex gap-1">
                        <button className={btnSm} onClick={() => post("/api/inventory/stock-control", { action: "complete-inspection", inspectionId: i.id, acceptedQuantity: i.inspected_quantity, rejectedQuantity: 0 })}>Accept all</button>
                        <button className={btnSm} onClick={() => post("/api/inventory/stock-control", { action: "complete-inspection", inspectionId: i.id, acceptedQuantity: 0, rejectedQuantity: i.inspected_quantity })}>Reject all</button>
                      </div>
                    )}</td>
                  </tr>
                ))}
                {!data.insp?.length && <tr><td colSpan={7} className="p-6 text-center text-slate-500">No inspections</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ReconciliationTab({ data, post, input, btn, btnSm, th, f, setF }: any) {
  const [open, setOpen] = useState<any>(null);
  const openRec = async (id: string) => {
    const res = await fetch(`/api/inventory/stock-control?view=reconciliation&id=${id}`);
    setOpen((await res.json()).reconciliation ?? null);
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input placeholder="Warehouse" value={f.recWh ?? "main"} onChange={(e: any) => setF({ ...f, recWh: e.target.value })} className={input} />
        <button className={btn} onClick={() => post("/api/inventory/stock-control", { action: "create-reconciliation", warehouseId: f.recWh ?? "main" })}>Start Count</button>
      </div>
      {open && (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div className="mb-2 flex justify-between"><b>{open.rec_number}</b><button onClick={() => setOpen(null)}>✕</button></div>
          {open.items.map((i: any) => (
            <div key={i.id} className="mb-1 flex items-center gap-2 text-sm">
              <span className="w-40 font-mono">{i.product_sku}</span>
              <span className="w-24 text-slate-400">book {i.book_quantity}</span>
              <input type="number" placeholder="counted" defaultValue={i.counted_quantity ?? ""}
                onBlur={(e) => e.target.value !== "" && post("/api/inventory/stock-control", { action: "set-count", reconciliationId: open.id, itemId: i.id, countedQuantity: Number(e.target.value) })}
                className="w-28 rounded border border-slate-700 bg-slate-800 px-2 py-1" />
              {i.variance != null && <span className={i.variance === 0 ? "text-slate-500" : i.variance > 0 ? "text-emerald-400" : "text-red-400"}>{i.variance > 0 ? "+" : ""}{i.variance}</span>}
            </div>
          ))}
          {open.status === "draft" && (
            <button className={`${btn} mt-3`} onClick={async () => { await post("/api/inventory/stock-control", { action: "submit-reconciliation", reconciliationId: open.id }); setOpen(null); }}>Submit &amp; Post Adjustments</button>
          )}
        </div>
      )}
      <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
        <thead className="text-left text-slate-400"><tr><th className={th}>Rec #</th><th className={th}>Warehouse</th><th className={th}>Items</th><th className={th}>Variance</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>
          {data.recs?.map((r: any) => (
            <tr key={r.id} className="border-t border-slate-800/50">
              <td className={`${th} font-mono`}>{r.rec_number}</td><td className={th}>{r.warehouse_id}</td>
              <td className={th}>{r.item_count}</td><td className={th}>{Number(r.total_variance ?? 0).toLocaleString()}</td>
              <td className={th}>{r.status}</td>
              <td className={th}>{r.status === "draft" && <button className={btnSm} onClick={() => openRec(r.id)}>Count</button>}</td>
            </tr>
          ))}
          {!data.recs?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No reconciliations</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
