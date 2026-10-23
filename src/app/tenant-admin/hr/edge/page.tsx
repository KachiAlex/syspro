"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["encashments", "overtime", "grievances", "transfers", "skills", "training", "staffing", "tax-declarations"] as const;

export default function HrEdgePage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("overtime");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const views = ["encashments", "overtime", "grievances", "transfers", "skills", "training", "staffing", "tax-declarations"];
    const results = await Promise.all(views.map((v) => fetch(`/api/hr/edge?view=${v}`).then((r) => r.json()).catch(() => ({}))));
    setData({
      encashments: results[0].encashments ?? [], overtime: results[1].overtime ?? [],
      grievances: results[2].grievances ?? [], transfers: results[3].transfers ?? [],
      skills: results[4].skills ?? [], programs: results[5].programs ?? [],
      events: results[5].events ?? [], plans: results[6].plans ?? [],
      declarations: results[7].declarations ?? [],
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/hr/edge", {
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
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">HR Edge</h1>
        <p className="mb-4 text-sm text-theme-text-secondary">Encashment, overtime, grievances, transfers, skills, training, staffing, tax declarations</p>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-theme-surface p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-theme-elevated" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "encashments" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Employee ID" value={f.eEmp ?? ""} onChange={(e) => setF({ ...f, eEmp: e.target.value })} className={input} />
              <input placeholder="Leave type" value={f.eType ?? ""} onChange={(e) => setF({ ...f, eType: e.target.value })} className={input} />
              <input type="number" placeholder="Days" value={f.eDays ?? ""} onChange={(e) => setF({ ...f, eDays: e.target.value })} className={`${input} w-20`} />
              <input type="number" placeholder="Rate/day" value={f.eRate ?? ""} onChange={(e) => setF({ ...f, eRate: e.target.value })} className={`${input} w-28`} />
              <button className={btn} onClick={() => post({ action: "create-encashment", employeeId: f.eEmp, leaveType: f.eType, encashableDays: Number(f.eDays), ratePerDay: Number(f.eRate) })}>Request</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Employee</th><th className={th}>Type</th><th className={th}>Days</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.encashments?.map((r: any) => (
                  <tr key={r.id} className="border-t border-theme-border">
                    <td className={th}>{r.employee_id}</td><td className={th}>{r.leave_type}</td>
                    <td className={th}>{r.encashable_days}</td><td className={th}>{Number(r.amount).toLocaleString()}</td>
                    <td className={th}>{r.status}</td>
                    <td className={th}>
                      {r.status === "draft" && <button className={btnSm} onClick={() => post({ action: "approve-encashment", id: r.id })}>Approve + JE</button>}
                      {r.status === "approved" && <button className={btnSm} onClick={() => post({ action: "encashment-status", id: r.id, status: "paid" })}>Mark paid</button>}
                    </td>
                  </tr>
                ))}
                {!data.encashments?.length && <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">No encashments</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "overtime" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Employee ID" value={f.oEmp ?? ""} onChange={(e) => setF({ ...f, oEmp: e.target.value })} className={input} />
              <input type="date" value={f.oDate ?? ""} onChange={(e) => setF({ ...f, oDate: e.target.value })} className={input} />
              <input type="number" placeholder="Hours" value={f.oHours ?? ""} onChange={(e) => setF({ ...f, oHours: e.target.value })} className={`${input} w-24`} />
              <input type="number" step="0.1" placeholder="× rate" value={f.oMult ?? 1.5} onChange={(e) => setF({ ...f, oMult: e.target.value })} className={`${input} w-20`} />
              <button className={btn} onClick={() => post({ action: "create-overtime", employeeId: f.oEmp, workDate: f.oDate, hours: Number(f.oHours), rateMultiplier: Number(f.oMult) })}>Log</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Employee</th><th className={th}>Date</th><th className={th}>Hours</th><th className={th}>×</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.overtime?.map((o: any) => (
                  <tr key={o.id} className="border-t border-theme-border">
                    <td className={th}>{o.employee_id}</td><td className={th}>{String(o.work_date).slice(0, 10)}</td>
                    <td className={th}>{o.hours}</td><td className={th}>{o.rate_multiplier}</td>
                    <td className={th}>{o.status}</td>
                    <td className={th}>
                      {o.status === "pending" && (
                        <div className="flex gap-1">
                          <button className={btnSm} onClick={() => post({ action: "overtime-status", id: o.id, status: "approved" })}>Approve</button>
                          <button className={btnSm} onClick={() => post({ action: "overtime-status", id: o.id, status: "rejected" })}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!data.overtime?.length && <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">No overtime entries</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "grievances" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Employee ID" value={f.gEmp ?? ""} onChange={(e) => setF({ ...f, gEmp: e.target.value })} className={input} />
              <input placeholder="Type (e.g. harassment)" value={f.gType ?? ""} onChange={(e) => setF({ ...f, gType: e.target.value })} className={input} />
              <input placeholder="Subject" value={f.gSub ?? ""} onChange={(e) => setF({ ...f, gSub: e.target.value })} className={`${input} flex-1`} />
              <button className={btn} onClick={() => post({ action: "create-grievance", employeeId: f.gEmp, grievanceType: f.gType, subject: f.gSub })}>Raise</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Employee</th><th className={th}>Type</th><th className={th}>Subject</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.grievances?.map((g: any) => (
                  <tr key={g.id} className="border-t border-theme-border">
                    <td className={th}>{g.employee_id}</td><td className={th}>{g.grievance_type}</td>
                    <td className={th}>{g.subject}</td><td className={th}>{g.status}</td>
                    <td className={th}>
                      <div className="flex gap-1">
                        {g.status === "open" && <button className={btnSm} onClick={() => post({ action: "resolve-grievance", id: g.id, status: "investigating" })}>Investigate</button>}
                        {["open", "investigating"].includes(g.status) && <button className={btnSm} onClick={() => post({ action: "resolve-grievance", id: g.id, status: "resolved" })}>Resolve</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.grievances?.length && <tr><td colSpan={5} className="p-6 text-center text-theme-text-tertiary">No grievances</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "transfers" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Employee ID" value={f.trEmp ?? ""} onChange={(e) => setF({ ...f, trEmp: e.target.value })} className={input} />
              <input type="date" value={f.trDate ?? ""} onChange={(e) => setF({ ...f, trDate: e.target.value })} className={input} />
              <input placeholder="To dept ID" value={f.trDept ?? ""} onChange={(e) => setF({ ...f, trDept: e.target.value })} className={input} />
              <input placeholder="To branch ID" value={f.trBranch ?? ""} onChange={(e) => setF({ ...f, trBranch: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-transfer", employeeId: f.trEmp, transferDate: f.trDate, toDepartmentId: f.trDept, toBranchId: f.trBranch })}>Create</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Employee</th><th className={th}>Date</th><th className={th}>To Dept</th><th className={th}>To Branch</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.transfers?.map((t: any) => (
                  <tr key={t.id} className="border-t border-theme-border">
                    <td className={th}>{t.employee_id}</td><td className={th}>{String(t.transfer_date).slice(0, 10)}</td>
                    <td className={th}>{t.to_department_id ?? "—"}</td><td className={th}>{t.to_branch_id ?? "—"}</td>
                    <td className={th}>{t.status}</td>
                    <td className={th}>{["draft", "approved"].includes(t.status) && <button className={btnSm} onClick={() => post({ action: "complete-transfer", id: t.id })}>Complete</button>}</td>
                  </tr>
                ))}
                {!data.transfers?.length && <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">No transfers</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "skills" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Employee ID" value={f.sEmp ?? ""} onChange={(e) => setF({ ...f, sEmp: e.target.value })} className={input} />
              <input placeholder="Skill" value={f.sSkill ?? ""} onChange={(e) => setF({ ...f, sSkill: e.target.value })} className={input} />
              <select value={f.sProf ?? 3} onChange={(e) => setF({ ...f, sProf: Number(e.target.value) })} className={input}>
                {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>Level {p}</option>)}
              </select>
              <button className={btn} onClick={() => post({ action: "upsert-skill", employeeId: f.sEmp, skill: f.sSkill, proficiency: f.sProf ?? 3 })}>Set</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Employee</th><th className={th}>Skill</th><th className={th}>Proficiency</th><th className={th}>Evaluated</th></tr></thead>
              <tbody>
                {data.skills?.map((s: any) => (
                  <tr key={s.id} className="border-t border-theme-border">
                    <td className={th}>{s.employee_id}</td><td className={th}>{s.skill}</td>
                    <td className={th}>{"★".repeat(s.proficiency)}</td><td className={th}>{String(s.evaluated_on).slice(0, 10)}</td>
                  </tr>
                ))}
                {!data.skills?.length && <tr><td colSpan={4} className="p-6 text-center text-theme-text-tertiary">No skill records</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "training" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Program name" value={f.tpName ?? ""} onChange={(e) => setF({ ...f, tpName: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-program", name: f.tpName })}>Add Program</button>
              <span className="text-theme-text-secondary">|</span>
              <input placeholder="Event name" value={f.teName ?? ""} onChange={(e) => setF({ ...f, teName: e.target.value })} className={input} />
              <input type="date" value={f.teDate ?? ""} onChange={(e) => setF({ ...f, teDate: e.target.value })} className={input} />
              <input placeholder="Venue" value={f.teVenue ?? ""} onChange={(e) => setF({ ...f, teVenue: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-event", eventName: f.teName, startDate: f.teDate, venue: f.teVenue })}>Add Event</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Event</th><th className={th}>Program</th><th className={th}>Start</th><th className={th}>Status</th><th className={th}>Attendees</th><th className={th}></th></tr></thead>
              <tbody>
                {data.events?.map((e: any) => (
                  <tr key={e.id} className="border-t border-theme-border">
                    <td className={th}>{e.event_name}</td><td className={th}>{e.program_name ?? "—"}</td>
                    <td className={th}>{String(e.start_date).slice(0, 10)}</td><td className={th}>{e.status}</td>
                    <td className={th}>{(e.attendees ?? []).length}</td>
                    <td className={th}>{e.status === "scheduled" && <button className={btnSm} onClick={() => post({ action: "update-event", id: e.id, status: "completed" })}>Complete</button>}</td>
                  </tr>
                ))}
                {!data.events?.length && <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">No training events</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "staffing" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Plan name" value={f.spName ?? ""} onChange={(e) => setF({ ...f, spName: e.target.value })} className={input} />
              <input placeholder='Designations JSON [{"designation":"Engineer","count":2,"estCost":500000}]' value={f.spDes ?? ""} onChange={(e) => setF({ ...f, spDes: e.target.value })} className={`${input} flex-1 font-mono`} />
              <button className={btn} onClick={() => post({ action: "create-staffing-plan", name: f.spName, designations: JSON.parse(f.spDes || "[]") })}>Create</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Plan</th><th className={th}>Roles</th><th className={th}>Est. Cost</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.plans?.map((p: any) => (
                  <tr key={p.id} className="border-t border-theme-border">
                    <td className={th}>{p.name}</td><td className={th}>{(p.designations ?? []).map((d: any) => `${d.count}× ${d.designation}`).join(", ")}</td>
                    <td className={th}>{Number(p.total_estimated_cost).toLocaleString()}</td><td className={th}>{p.status}</td>
                    <td className={th}>
                      {p.status === "draft" && <button className={btnSm} onClick={() => post({ action: "staffing-status", id: p.id, status: "submitted" })}>Submit</button>}
                      {p.status === "submitted" && <button className={btnSm} onClick={() => post({ action: "staffing-status", id: p.id, status: "approved" })}>Approve</button>}
                    </td>
                  </tr>
                ))}
                {!data.plans?.length && <tr><td colSpan={5} className="p-6 text-center text-theme-text-tertiary">No staffing plans</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "tax-declarations" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Employee ID" value={f.tdEmp ?? ""} onChange={(e) => setF({ ...f, tdEmp: e.target.value })} className={input} />
              <input type="number" placeholder="Year" value={f.tdYear ?? new Date().getFullYear()} onChange={(e) => setF({ ...f, tdYear: e.target.value })} className={`${input} w-24`} />
              <input placeholder='Reliefs JSON {"rent":500000,"pension":100000}' value={f.tdReliefs ?? ""} onChange={(e) => setF({ ...f, tdReliefs: e.target.value })} className={`${input} flex-1 font-mono`} />
              <button className={btn} onClick={() => post({ action: "upsert-tax-declaration", employeeId: f.tdEmp, taxYear: Number(f.tdYear ?? new Date().getFullYear()), reliefs: JSON.parse(f.tdReliefs || "{}") })}>Submit</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Employee</th><th className={th}>Year</th><th className={th}>Declared Reliefs</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.declarations?.map((d: any) => (
                  <tr key={d.id} className="border-t border-theme-border">
                    <td className={th}>{d.employee_id}</td><td className={th}>{d.tax_year}</td>
                    <td className={th}>{Number(d.declared_amount).toLocaleString()}</td><td className={th}>{d.status}</td>
                    <td className={th}>
                      {d.status === "submitted" && (
                        <div className="flex gap-1">
                          <button className={btnSm} onClick={() => post({ action: "tax-declaration-status", id: d.id, status: "approved" })}>Approve</button>
                          <button className={btnSm} onClick={() => post({ action: "tax-declaration-status", id: d.id, status: "rejected" })}>Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!data.declarations?.length && <tr><td colSpan={5} className="p-6 text-center text-theme-text-tertiary">No declarations</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
