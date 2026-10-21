"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["checkins", "allocations", "advances", "lifecycle"] as const;

export default function HrDepthPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("advances");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const [ck, al, ad, lc] = await Promise.all([
      fetch("/api/hr/depth?view=checkins").then((r) => r.json()).catch(() => ({})),
      fetch("/api/hr/depth?view=allocations").then((r) => r.json()).catch(() => ({})),
      fetch("/api/hr/depth?view=advances").then((r) => r.json()).catch(() => ({})),
      fetch("/api/hr/depth?view=lifecycle").then((r) => r.json()).catch(() => ({})),
    ]);
    setData({ checkins: ck.checkins ?? [], allocations: al.allocations ?? [], advances: ad.advances ?? [], lifecycles: lc.lifecycles ?? [] });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/hr/depth", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return null; }
    setError(""); load();
    return d;
  };

  const input = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50";
  const btnSm = "rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700";
  const th = "p-3";

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">HR Depth</h1>
        <p className="mb-4 text-sm text-slate-400">Check-ins, leave allocations &amp; accrual, employee advances, onboarding/separation</p>
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-900 p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-slate-700" : "text-slate-400 hover:text-white"}`}>{t}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-slate-800 p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "checkins" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Employee ID" value={f.ckEmp ?? ""} onChange={(e) => setF({ ...f, ckEmp: e.target.value })} className={input} />
              <select value={f.ckType ?? "in"} onChange={(e) => setF({ ...f, ckType: e.target.value })} className={input}>
                <option value="in">Clock In</option><option value="out">Clock Out</option>
              </select>
              <button className={btn} onClick={() => post({ action: "checkin", employeeId: f.ckEmp, logType: f.ckType ?? "in" })}>Record</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Employee</th><th className={th}>Time</th><th className={th}>Type</th><th className={th}>Source</th></tr></thead>
              <tbody>
                {data.checkins?.map((c: any) => (
                  <tr key={c.id} className="border-t border-slate-800/50">
                    <td className={th}>{c.employee_id}</td><td className={th}>{String(c.timestamp).slice(0, 16)}</td>
                    <td className={th}>{c.log_type}</td><td className={th}>{c.source}</td>
                  </tr>
                ))}
                {!data.checkins?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No check-ins</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "allocations" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Employee ID" value={f.alEmp ?? ""} onChange={(e) => setF({ ...f, alEmp: e.target.value })} className={input} />
              <input placeholder="Leave type" value={f.alType ?? ""} onChange={(e) => setF({ ...f, alType: e.target.value })} className={input} />
              <input type="number" placeholder="Year" value={f.alYear ?? new Date().getFullYear()} onChange={(e) => setF({ ...f, alYear: e.target.value })} className={`${input} w-24`} />
              <input type="number" placeholder="Days" value={f.alDays ?? ""} onChange={(e) => setF({ ...f, alDays: e.target.value })} className={`${input} w-24`} />
              <button className={btn} onClick={() => post({ action: "upsert-allocation", employeeId: f.alEmp, leaveType: f.alType, year: Number(f.alYear ?? new Date().getFullYear()), allocatedDays: Number(f.alDays) })}>Allocate</button>
              <button className="rounded-lg bg-blue-700 px-3 py-2 text-sm hover:bg-blue-600" onClick={async () => {
                const d = await post({ action: "run-accrual" });
                setMsg(d ? `Accrued ${d.accrued} balance(s) for ${d.period}` : "");
              }}>Run Monthly Accrual</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Employee</th><th className={th}>Type</th><th className={th}>Year</th><th className={th}>Allocated</th><th className={th}>Carried</th><th className={th}>Status</th></tr></thead>
              <tbody>
                {data.allocations?.map((a: any) => (
                  <tr key={a.id} className="border-t border-slate-800/50">
                    <td className={th}>{a.employee_id}</td><td className={th}>{a.leave_type}</td>
                    <td className={th}>{a.year}</td><td className={th}>{a.allocated_days}</td>
                    <td className={th}>{a.carried_over_days}</td><td className={th}>{a.status}</td>
                  </tr>
                ))}
                {!data.allocations?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No allocations</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "advances" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Employee ID" value={f.adEmp ?? ""} onChange={(e) => setF({ ...f, adEmp: e.target.value })} className={input} />
              <input type="number" placeholder="Amount" value={f.adAmt ?? ""} onChange={(e) => setF({ ...f, adAmt: e.target.value })} className={`${input} w-32`} />
              <input placeholder="Purpose" value={f.adPurpose ?? ""} onChange={(e) => setF({ ...f, adPurpose: e.target.value })} className={`${input} flex-1`} />
              <button className={btn} onClick={() => post({ action: "create-advance", employeeId: f.adEmp, amount: Number(f.adAmt), purpose: f.adPurpose })}>Request</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Advance</th><th className={th}>Employee</th><th className={th}>Amount</th><th className={th}>Repaid</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.advances?.map((a: any) => (
                  <tr key={a.id} className="border-t border-slate-800/50">
                    <td className={`${th} font-mono`}>{a.advance_number}</td><td className={th}>{a.employee_name ?? a.employee_id}</td>
                    <td className={th}>{Number(a.amount).toLocaleString()}</td><td className={th}>{Number(a.repaid ?? 0).toLocaleString()}</td>
                    <td className={th}>{a.status}</td>
                    <td className={th}>
                      <div className="flex gap-1">
                        {a.status === "requested" && (
                          <>
                            <button className={btnSm} onClick={() => post({ action: "advance-status", advanceId: a.id, status: "approved" })}>Approve</button>
                            <button className={btnSm} onClick={() => post({ action: "advance-status", advanceId: a.id, status: "rejected" })}>Reject</button>
                          </>
                        )}
                        {a.status === "approved" && <button className={btnSm} onClick={() => post({ action: "disburse-advance", advanceId: a.id })}>Disburse</button>}
                        {["disbursed", "partially_repaid"].includes(a.status) && (
                          <button className={btnSm} onClick={() => {
                            const amt = Number(prompt("Repayment amount", String(Number(a.amount) - Number(a.repaid ?? 0))));
                            if (amt > 0) post({ action: "repay-advance", advanceId: a.id, amount: amt, method: "bank" });
                          }}>Repay</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.advances?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No advances</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "lifecycle" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <select value={f.lcKind ?? "onboarding"} onChange={(e) => setF({ ...f, lcKind: e.target.value })} className={input}>
                <option value="onboarding">Onboarding</option><option value="separation">Separation</option>
              </select>
              <input placeholder="Employee ID" value={f.lcEmp ?? ""} onChange={(e) => setF({ ...f, lcEmp: e.target.value })} className={input} />
              <input placeholder="Employee name" value={f.lcName ?? ""} onChange={(e) => setF({ ...f, lcName: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-lifecycle", kind: f.lcKind ?? "onboarding", employeeId: f.lcEmp, employeeName: f.lcName })}>Start</button>
            </div>
            {data.lifecycles?.map((lc: any) => (
              <div key={lc.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <b>{lc.employee_name ?? lc.employee_id} — {lc.kind}</b>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${lc.status === "completed" ? "bg-emerald-900/60 text-emerald-300" : "bg-slate-700"}`}>{lc.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {(lc.checklist ?? []).map((t: any, i: number) => (
                    <label key={i} className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={t.done} onChange={(e) => post({ action: "complete-task", lifecycleId: lc.id, taskIndex: i, done: e.target.checked })} />
                      <span className={t.done ? "line-through opacity-60" : ""}>{t.task}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {!data.lifecycles?.length && <p className="text-sm text-slate-500">No lifecycle records</p>}
          </div>
        )}
      </div>
    </div>
  );
}
