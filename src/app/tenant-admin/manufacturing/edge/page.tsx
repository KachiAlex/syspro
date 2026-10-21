"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["plant-floors", "downtime", "sub-operations", "mps", "bom-tools"] as const;

export default function MfgEdgePage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("downtime");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const [pf, dt, so, mps] = await Promise.all([
      fetch("/api/manufacturing/edge?view=plant-floors").then((r) => r.json()).catch(() => ({})),
      fetch("/api/manufacturing/edge?view=downtime").then((r) => r.json()).catch(() => ({})),
      fetch("/api/manufacturing/edge?view=sub-operations").then((r) => r.json()).catch(() => ({})),
      fetch("/api/manufacturing/edge?view=mps").then((r) => r.json()).catch(() => ({})),
    ]);
    setData({
      plantFloors: pf.plantFloors ?? [], downtime: dt.entries ?? [],
      subOps: so.subOperations ?? [], mps: mps.schedules ?? [],
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/manufacturing/edge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return null; }
    setError(""); load(); return d;
  };

  const input = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500";
  const btnSm = "rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700";
  const th = "p-3";

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">Manufacturing Edge</h1>
        <p className="mb-4 text-sm text-slate-400">Plant floors, downtime tracking, sub-operations, MPS, BOM update tools</p>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-slate-700" : "text-slate-400 hover:text-white"}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-slate-800 p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "plant-floors" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder="Floor name" value={f.pfName ?? ""} onChange={(e) => setF({ ...f, pfName: e.target.value })} className={input} />
              <input placeholder="Code" value={f.pfCode ?? ""} onChange={(e) => setF({ ...f, pfCode: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-plant-floor", name: f.pfName, code: f.pfCode })}>Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.plantFloors?.map((p: any) => (
                <span key={p.id} className="rounded-lg bg-slate-800 px-3 py-2 text-sm">{p.name}{p.code ? ` (${p.code})` : ""}</span>
              ))}
              {!data.plantFloors?.length && <p className="text-sm text-slate-500">No plant floors</p>}
            </div>
          </div>
        )}

        {tab === "downtime" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Workstation ID" value={f.dtWs ?? ""} onChange={(e) => setF({ ...f, dtWs: e.target.value })} className={input} />
              <input placeholder="Reason" value={f.dtReason ?? ""} onChange={(e) => setF({ ...f, dtReason: e.target.value })} className={`${input} flex-1`} />
              <select value={f.dtCat ?? "other"} onChange={(e) => setF({ ...f, dtCat: e.target.value })} className={input}>
                {["breakdown", "changeover", "material_wait", "planned", "other"].map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
              <button className={btn} onClick={() => post({ action: "record-downtime", workstationId: f.dtWs || undefined, reason: f.dtReason, category: f.dtCat, fromTs: new Date().toISOString() })}>Start Downtime</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Workstation</th><th className={th}>Category</th><th className={th}>Reason</th><th className={th}>From</th><th className={th}>To</th><th className={th}></th></tr></thead>
              <tbody>
                {data.downtime?.map((d: any) => (
                  <tr key={d.id} className="border-t border-slate-800/50">
                    <td className={th}>{d.workstation_name ?? d.workstation_id ?? "—"}</td>
                    <td className={th}>{d.category}</td><td className={th}>{d.reason}</td>
                    <td className={th}>{String(d.from_ts).slice(0, 16)}</td>
                    <td className={th}>{d.to_ts ? String(d.to_ts).slice(0, 16) : "ongoing"}</td>
                    <td className={th}>{!d.to_ts && <button className={btnSm} onClick={() => post({ action: "end-downtime", id: d.id })}>End</button>}</td>
                  </tr>
                ))}
                {!data.downtime?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No downtime recorded</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "sub-operations" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Work order ID" value={f.soWo ?? ""} onChange={(e) => setF({ ...f, soWo: e.target.value })} className={input} />
              <input placeholder="Operation ID" value={f.soOp ?? ""} onChange={(e) => setF({ ...f, soOp: e.target.value })} className={input} />
              <input placeholder="Sub-op name" value={f.soName ?? ""} onChange={(e) => setF({ ...f, soName: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-sub-operation", workOrderId: f.soWo, operationId: f.soOp, name: f.soName })}>Add</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Sub-operation</th><th className={th}>WO</th><th className={th}>Planned min</th><th className={th}>Actual min</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.subOps?.map((s: any) => (
                  <tr key={s.id} className="border-t border-slate-800/50">
                    <td className={th}>{s.name}</td><td className={`${th} font-mono text-xs`}>{String(s.work_order_id).slice(0, 12)}</td>
                    <td className={th}>{s.planned_minutes ?? "—"}</td><td className={th}>{s.actual_minutes ?? "—"}</td>
                    <td className={th}>{s.status}</td>
                    <td className={th}>{s.status === "pending" && <button className={btnSm} onClick={() => post({ action: "complete-sub-operation", id: s.id })}>Complete</button>}</td>
                  </tr>
                ))}
                {!data.subOps?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No sub-operations</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "mps" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Schedule name" value={f.mpsName ?? ""} onChange={(e) => setF({ ...f, mpsName: e.target.value })} className={input} />
              <input type="date" value={f.mpsFrom ?? ""} onChange={(e) => setF({ ...f, mpsFrom: e.target.value })} className={input} />
              <input type="date" value={f.mpsTo ?? ""} onChange={(e) => setF({ ...f, mpsTo: e.target.value })} className={input} />
              <button className={btn} onClick={async () => {
                const d = await post({ action: "build-mps", name: f.mpsName, periodFrom: f.mpsFrom, periodTo: f.mpsTo });
                setMsg(d ? `MPS built: ${d.mps?.items?.length ?? 0} item lines` : "");
              }}>Build MPS</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Name</th><th className={th}>Period</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.mps?.map((m: any) => (
                  <tr key={m.id} className="border-t border-slate-800/50">
                    <td className={th}>{m.name}</td>
                    <td className={th}>{String(m.period_from).slice(0, 10)} → {String(m.period_to).slice(0, 10)}</td>
                    <td className={th}>{m.status}</td>
                    <td className={th}>{m.status === "draft" && <button className={btnSm} onClick={() => post({ action: "mps-status", id: m.id, status: "confirmed" })}>Confirm</button>}</td>
                  </tr>
                ))}
                {!data.mps?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No MPS runs</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "bom-tools" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-2 font-semibold">Replace component across active BOMs</h3>
              <div className="flex flex-wrap gap-2">
                <input placeholder="Old SKU" value={f.bomOld ?? ""} onChange={(e) => setF({ ...f, bomOld: e.target.value })} className={input} />
                <input placeholder="New SKU" value={f.bomNew ?? ""} onChange={(e) => setF({ ...f, bomNew: e.target.value })} className={input} />
                <button className={btn} onClick={async () => {
                  const d = await post({ action: "replace-bom-component", oldSku: f.bomOld, newSku: f.bomNew });
                  setMsg(d ? `Updated ${d.updatedLines} BOM line(s)` : "");
                }}>Replace</button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-2 font-semibold">Recompute BOM material costs</h3>
              <p className="mb-2 text-xs text-slate-400">Recalculates each BOM&rsquo;s material_cost from current component unit_cost × quantity.</p>
              <button className={btn} onClick={async () => {
                const d = await post({ action: "recompute-bom-costs" });
                setMsg(d ? `Recomputed ${d.updatedBoms} BOM(s)` : "");
              }}>Recompute All</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
