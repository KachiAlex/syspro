"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["masters", "updates", "installation-notes"] as const;

export default function ProjectsEdgePage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("masters");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const [tt, at, u, n] = await Promise.all([
      fetch("/api/projects/edge?view=task-types").then((r) => r.json()).catch(() => ({})),
      fetch("/api/projects/edge?view=activity-types").then((r) => r.json()).catch(() => ({})),
      fetch("/api/projects/edge?view=updates&projectId=").then((r) => r.json()).catch(() => ({})),
      fetch("/api/projects/edge?view=installation-notes").then((r) => r.json()).catch(() => ({})),
    ]);
    setData({ taskTypes: tt.taskTypes ?? [], activityTypes: at.activityTypes ?? [], updates: u.updates ?? [], notes: n.notes ?? [] });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/projects/edge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return null; }
    setError(""); load(); return d;
  };

  const input = "rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500";
  const th = "p-3";

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-theme-bg p-6 text-theme-text-primary">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-2xl font-bold">Projects Edge</h1>
        <p className="mb-4 text-sm text-theme-text-secondary">Task types, activity types + billing rates, project updates, installation notes</p>
        <div className="mb-4 flex gap-1 rounded-lg bg-theme-surface p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-theme-elevated" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "masters" && (
          <div className="space-y-6">
            <section>
              <h3 className="mb-2 font-semibold">Task Types</h3>
              <div className="flex gap-2">
                <input placeholder="Type name" value={f.ttName ?? ""} onChange={(e) => setF({ ...f, ttName: e.target.value })} className={input} />
                <input placeholder="#hex" value={f.ttColor ?? "#6366f1"} onChange={(e) => setF({ ...f, ttColor: e.target.value })} className={`${input} w-24`} />
                <button className={btn} onClick={() => post({ action: "create-task-type", name: f.ttName, color: f.ttColor })}>Add</button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.taskTypes?.map((t: any) => <span key={t.id} className="rounded-full px-3 py-1 text-sm" style={{ backgroundColor: `${t.color}33`, borderLeft: `3px solid ${t.color}` }}>{t.name}</span>)}
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Activity Types</h3>
              <div className="flex flex-wrap gap-2">
                <input placeholder="Activity name" value={f.atName ?? ""} onChange={(e) => setF({ ...f, atName: e.target.value })} className={input} />
                <input type="number" placeholder="Default rate" value={f.atRate ?? 0} onChange={(e) => setF({ ...f, atRate: e.target.value })} className={`${input} w-32`} />
                <button className={btn} onClick={() => post({ action: "create-activity-type", name: f.atName, defaultRate: Number(f.atRate) })}>Add</button>
              </div>
              <h3 className="mb-2 mt-6 font-semibold">Employee Rates</h3>
              <div className="flex flex-wrap gap-2">
                <select value={f.atId ?? ""} onChange={(e) => setF({ ...f, atId: e.target.value })} className={input}>
                  <option value="">Activity type</option>
                  {data.activityTypes?.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input placeholder="Employee ID" value={f.atEmp ?? ""} onChange={(e) => setF({ ...f, atEmp: e.target.value })} className={input} />
                <input type="number" placeholder="Cost rate" value={f.atCost ?? 0} onChange={(e) => setF({ ...f, atCost: e.target.value })} className={`${input} w-32`} />
                <input type="number" placeholder="Billing rate" value={f.atBill ?? 0} onChange={(e) => setF({ ...f, atBill: e.target.value })} className={`${input} w-32`} />
                <button className={btn} onClick={() => post({ action: "set-activity-cost", activityTypeId: f.atId, employeeId: f.atEmp, costRate: Number(f.atCost), billingRate: Number(f.atBill) })}>Set Rate</button>
              </div>
              <table className="mt-2 w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
                <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Activity</th><th className={th}>Default Rate</th></tr></thead>
                <tbody>
                  {data.activityTypes?.map((a: any) => (
                    <tr key={a.id} className="border-t border-theme-border">
                      <td className={th}>{a.name}</td><td className={th}>{Number(a.default_rate ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                  {!data.activityTypes?.length && <tr><td colSpan={2} className="p-6 text-center text-theme-text-tertiary">No activity types</td></tr>}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {tab === "updates" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Project ID" value={f.puProj ?? ""} onChange={(e) => setF({ ...f, puProj: e.target.value })} className={input} />
              <input placeholder="Title" value={f.puTitle ?? ""} onChange={(e) => setF({ ...f, puTitle: e.target.value })} className={`${input} flex-1`} />
              <input type="number" placeholder="% complete" value={f.puPct ?? ""} onChange={(e) => setF({ ...f, puPct: e.target.value })} className={`${input} w-28`} />
              <button className={btn} onClick={() => post({ action: "create-update", projectId: f.puProj, summary: f.puTitle, percentComplete: f.puPct ? Number(f.puPct) : undefined })}>Post Update</button>
            </div>
            {data.updates?.map((u: any) => (
              <div key={u.id} className="rounded-xl border border-theme-border bg-theme-surface p-4">
                <b>{u.summary}</b> <span className="text-xs text-theme-text-tertiary">{u.project_name ?? ""} · {String(u.created_at).slice(0, 10)}</span>
                {u.percent_complete != null && <div className="mt-2 h-1.5 w-48 rounded bg-theme-muted"><div className="h-1.5 rounded bg-emerald-500" style={{ width: `${u.percent_complete}%` }} /></div>}
              </div>
            ))}
            {!data.updates?.length && <p className="text-sm text-theme-text-tertiary">No project updates</p>}
          </div>
        )}

        {tab === "installation-notes" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Customer name" value={f.inCust ?? ""} onChange={(e) => setF({ ...f, inCust: e.target.value })} className={input} />
              <input type="date" value={f.inDate ?? ""} onChange={(e) => setF({ ...f, inDate: e.target.value })} className={input} />
              <input placeholder="Remarks / site details" value={f.inAddr ?? ""} onChange={(e) => setF({ ...f, inAddr: e.target.value })} className={`${input} flex-1`} />
              <button className={btn} onClick={() => post({ action: "create-installation-note", customerName: f.inCust, installationDate: f.inDate, remarks: f.inAddr })}>Create</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Note</th><th className={th}>Customer</th><th className={th}>Date</th><th className={th}>Site</th><th className={th}>Status</th></tr></thead>
              <tbody>
                {data.notes?.map((n: any) => (
                  <tr key={n.id} className="border-t border-theme-border">
                    <td className={`${th} font-mono`}>{String(n.id).slice(0, 8)}</td><td className={th}>{n.customer_name}</td>
                    <td className={th}>{n.installation_date ? String(n.installation_date).slice(0, 10) : "—"}</td>
                    <td className={`${th} max-w-[240px] truncate`}>{n.remarks ?? "—"}</td><td className={th}>{n.status}</td>
                  </tr>
                ))}
                {!data.notes?.length && <tr><td colSpan={5} className="p-6 text-center text-theme-text-tertiary">No installation notes</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
