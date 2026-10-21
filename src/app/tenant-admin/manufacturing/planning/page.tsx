"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["workstations", "routings", "job-cards", "forecasts", "plans"] as const;

export default function ManufacturingPlanningPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("workstations");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [f, setF] = useState<Record<string, any>>({});
  const [openPlan, setOpenPlan] = useState<any>(null);

  const load = useCallback(async () => {
    const [ws, rt, jc, fc, pp] = await Promise.all([
      fetch("/api/manufacturing/planning?view=workstations").then((r) => r.json()).catch(() => ({})),
      fetch("/api/manufacturing/planning?view=routings").then((r) => r.json()).catch(() => ({})),
      fetch("/api/manufacturing/planning?view=job-cards").then((r) => r.json()).catch(() => ({})),
      fetch("/api/manufacturing/planning?view=forecasts").then((r) => r.json()).catch(() => ({})),
      fetch("/api/manufacturing/planning?view=production-plans").then((r) => r.json()).catch(() => ({})),
    ]);
    setData({
      workstations: ws.workstations ?? [], routings: rt.routings ?? [],
      jobCards: jc.jobCards ?? [], forecasts: fc.forecasts ?? [], plans: pp.plans ?? [],
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/manufacturing/planning", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return; }
    setError(""); load();
  };

  const input = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50";
  const btnSm = "rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700";
  const th = "p-3";

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">Production Planning</h1>
        <p className="mb-4 text-sm text-slate-400">Workstations, routings, job cards, forecasts, MPS-style production plans</p>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-slate-700" : "text-slate-400 hover:text-white"}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "workstations" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Code" value={f.wCode ?? ""} onChange={(e) => setF({ ...f, wCode: e.target.value })} className={`${input} w-28`} />
              <input placeholder="Name" value={f.wName ?? ""} onChange={(e) => setF({ ...f, wName: e.target.value })} className={input} />
              <input type="number" placeholder="Labor ₦/hr" value={f.wLabor ?? ""} onChange={(e) => setF({ ...f, wLabor: e.target.value })} className={`${input} w-28`} />
              <input type="number" placeholder="OH ₦/hr" value={f.wOh ?? ""} onChange={(e) => setF({ ...f, wOh: e.target.value })} className={`${input} w-28`} />
              <input type="number" placeholder="Hrs/day" value={f.wCap ?? ""} onChange={(e) => setF({ ...f, wCap: e.target.value })} className={`${input} w-24`} />
              <button className={btn} onClick={() => post({ action: "upsert-workstation", name: f.wName, code: f.wCode, laborRate: Number(f.wLabor ?? 0), overheadRate: Number(f.wOh ?? 0), capacityHoursPerDay: Number(f.wCap ?? 8) })}>Save</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Code</th><th className={th}>Name</th><th className={th}>Labor/hr</th><th className={th}>OH/hr</th><th className={th}>Capacity</th></tr></thead>
              <tbody>
                {data.workstations?.map((w: any) => (
                  <tr key={w.id} className="border-t border-slate-800/50"><td className={`${th} font-mono`}>{w.code}</td><td className={th}>{w.name}</td><td className={th}>{w.labor_rate}</td><td className={th}>{w.overhead_rate}</td><td className={th}>{w.capacity_hours_per_day}h</td></tr>
                ))}
                {!data.workstations?.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No workstations</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "routings" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder="Routing name" value={f.rName ?? ""} onChange={(e) => setF({ ...f, rName: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "upsert-routing", name: f.rName, operations: [] })}>Create</button>
            </div>
            {data.routings?.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 font-semibold">{r.name}</div>
                {r.operations.map((o: any) => (
                  <div key={o.id} className="text-sm text-slate-300">{o.sequence}. {o.name} {o.workstation_name ? `@ ${o.workstation_name}` : ""} — {o.standard_minutes}min</div>
                ))}
                <div className="mt-2 flex gap-2">
                  <input placeholder="Op name" value={f[`op_${r.id}`] ?? ""} onChange={(e) => setF({ ...f, [`op_${r.id}`]: e.target.value })} className={`${input} flex-1`} />
                  <input type="number" placeholder="Min" value={f[`opmin_${r.id}`] ?? ""} onChange={(e) => setF({ ...f, [`opmin_${r.id}`]: e.target.value })} className={`${input} w-20`} />
                  <button className={btnSm} onClick={() => post({
                    action: "upsert-routing", name: r.name,
                    operations: [...r.operations.map((o: any) => ({ name: o.name, workstationId: o.workstation_id, standardMinutes: o.standard_minutes })),
                      { name: f[`op_${r.id}`], standardMinutes: Number(f[`opmin_${r.id}`] ?? 0) }],
                  })}>+ Op</button>
                </div>
              </div>
            ))}
            {!data.routings?.length && <p className="text-sm text-slate-500">No routings</p>}
          </div>
        )}

        {tab === "job-cards" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder="Work order ID" value={f.jcWo ?? ""} onChange={(e) => setF({ ...f, jcWo: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-job-cards", workOrderId: f.jcWo })}>Generate Job Cards</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>JC #</th><th className={th}>Operation</th><th className={th}>Planned min</th><th className={th}>Actual min</th><th className={th}>Labor cost</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.jobCards?.map((j: any) => (
                  <tr key={j.id} className="border-t border-slate-800/50">
                    <td className={`${th} font-mono`}>{j.job_card_number}</td><td className={th}>{j.operation_name}</td>
                    <td className={th}>{j.planned_minutes}</td><td className={th}>{j.actual_minutes}</td>
                    <td className={th}>{Number(j.labor_cost).toLocaleString()}</td><td className={th}>{j.status}</td>
                    <td className={th}>
                      {["open", "in_progress", "paused"].includes(j.status) && (
                        <div className="flex gap-1">
                          <button className={btnSm} onClick={() => post({ action: "log-time", jobCardId: j.id, minutes: 60 })}>+1h</button>
                          <button className={btnSm} onClick={() => post({ action: "complete-job-card", jobCardId: j.id })}>Done</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!data.jobCards?.length && <tr><td colSpan={7} className="p-6 text-center text-slate-500">No job cards — generate from a work order</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "forecasts" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder="SKU" value={f.fSku ?? ""} onChange={(e) => setF({ ...f, fSku: e.target.value })} className={input} />
              <input type="date" value={f.fDate ?? ""} onChange={(e) => setF({ ...f, fDate: e.target.value })} className={input} />
              <input type="number" placeholder="Qty" value={f.fQty ?? ""} onChange={(e) => setF({ ...f, fQty: e.target.value })} className={`${input} w-28`} />
              <button className={btn} onClick={() => post({ action: "upsert-forecast", productSku: f.fSku, forecastDate: f.fDate, quantity: Number(f.fQty) })}>Add</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>SKU</th><th className={th}>Date</th><th className={th}>Forecast</th><th className={th}>Consumed</th></tr></thead>
              <tbody>
                {data.forecasts?.map((fc: any) => (
                  <tr key={fc.id} className="border-t border-slate-800/50"><td className={`${th} font-mono`}>{fc.product_sku}</td><td className={th}>{String(fc.forecast_date).slice(0, 10)}</td><td className={th}>{fc.forecast_quantity}</td><td className={th}>{fc.consumed_quantity}</td></tr>
                ))}
                {!data.forecasts?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No forecasts</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "plans" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder="Plan name" value={f.pName ?? ""} onChange={(e) => setF({ ...f, pName: e.target.value })} className={input} />
              <input type="date" value={f.pStart ?? ""} onChange={(e) => setF({ ...f, pStart: e.target.value })} className={input} />
              <input type="date" value={f.pEnd ?? ""} onChange={(e) => setF({ ...f, pEnd: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-production-plan", planName: f.pName, periodStart: f.pStart || null, periodEnd: f.pEnd || null })}>Create Plan</button>
            </div>
            {openPlan && (
              <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
                <div className="mb-2 flex justify-between"><b>{openPlan.plan_number} — {openPlan.plan_name}</b><button onClick={() => setOpenPlan(null)}>✕</button></div>
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-400"><tr><th className="p-2">SKU</th><th className="p-2">SO Demand</th><th className="p-2">Forecast</th><th className="p-2">On Hand</th><th className="p-2">WIP</th><th className="p-2">Planned</th><th className="p-2">WO</th></tr></thead>
                  <tbody>
                    {openPlan.items?.map((i: any) => (
                      <tr key={i.id} className="border-t border-slate-800">
                        <td className="p-2 font-mono">{i.product_sku}</td><td className="p-2">{i.sales_order_quantity}</td>
                        <td className="p-2">{i.forecast_quantity}</td><td className="p-2">{i.on_hand_quantity}</td>
                        <td className="p-2">{i.wip_quantity}</td><td className="p-2 font-semibold text-emerald-400">{i.planned_quantity}</td>
                        <td className="p-2 font-mono text-xs">{i.work_order_id ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {["draft", "submitted"].includes(openPlan.status) && (
                  <button className={`${btn} mt-3`} onClick={async () => { await post({ action: "execute-production-plan", planId: openPlan.id }); setOpenPlan(null); }}>Execute — Generate WOs + MRs</button>
                )}
              </div>
            )}
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Plan</th><th className={th}>Name</th><th className={th}>Items</th><th className={th}>WOs</th><th className={th}>MRs</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.plans?.map((p: any) => (
                  <tr key={p.id} className="border-t border-slate-800/50">
                    <td className={`${th} font-mono`}>{p.plan_number}</td><td className={th}>{p.plan_name}</td>
                    <td className={th}>{p.item_count}</td><td className={th}>{p.generated_work_orders}</td>
                    <td className={th}>{p.generated_material_requests}</td><td className={th}>{p.status}</td>
                    <td className={th}><button className={btnSm} onClick={async () => setOpenPlan((await (await fetch(`/api/manufacturing/planning?view=production-plan&id=${p.id}`)).json()).plan)}>View</button></td>
                  </tr>
                ))}
                {!data.plans?.length && <tr><td colSpan={7} className="p-6 text-center text-slate-500">No production plans</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
