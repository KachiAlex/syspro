"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["territories", "industries", "segments", "competitors", "notes", "appointments", "sms"] as const;
const VIEWS: Record<string, string> = {
  territories: "territories", industries: "industries", segments: "segments",
  competitors: "competitors", notes: "notes", appointments: "appointments", sms: "sms",
};

export default function CrmMastersPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("territories");
  const [data, setData] = useState<Record<string, any[]>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<Record<string, any>>({});
  const [calView, setCalView] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });

  const load = useCallback(async () => {
    const entries = await Promise.all(
      Object.entries(VIEWS).map(async ([key, view]) => {
        const d = await fetch(`/api/crm/masters?view=${view}`).then((r) => r.json()).catch(() => ({}));
        return [key, d.territories ?? d.items ?? d.competitors ?? d.notes ?? d.appointments ?? d.messages ?? []] as const;
      })
    );
    setData(Object.fromEntries(entries));
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/crm/masters", {
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
        <h1 className="mb-1 text-2xl font-bold">CRM Masters</h1>
        <p className="mb-4 text-sm text-theme-text-secondary">Territories, industries, segments, competitors, notes, appointments, SMS</p>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-theme-surface p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-theme-elevated" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>{t}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-theme-muted p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "territories" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Territory name" value={f.tName ?? ""} onChange={(e) => setF({ ...f, tName: e.target.value })} className={input} />
              <select value={f.tParent ?? ""} onChange={(e) => setF({ ...f, tParent: e.target.value || undefined })} className={input}>
                <option value="">(root)</option>
                {data.territories?.filter((t) => t.is_group).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.tGroup ?? false} onChange={(e) => setF({ ...f, tGroup: e.target.checked })} /> Group</label>
              <button className={btn} onClick={() => post({ action: "upsert-territory", name: f.tName, parentId: f.tParent, isGroup: f.tGroup })}>Add</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Territory</th><th className={th}>Parent</th><th className={th}>Type</th></tr></thead>
              <tbody>
                {data.territories?.map((t) => (
                  <tr key={t.id} className="border-t border-theme-border">
                    <td className={th}>{t.name}</td>
                    <td className={th}>{data.territories.find((p) => p.id === t.parent_id)?.name ?? "—"}</td>
                    <td className={th}>{t.is_group ? "Group" : "Territory"}</td>
                  </tr>
                ))}
                {!data.territories?.length && <tr><td colSpan={3} className="p-6 text-center text-theme-text-tertiary">No territories</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {["industries", "segments"].includes(tab) && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input placeholder={`New ${tab === "industries" ? "industry" : "segment"} name`} value={f.mName ?? ""} onChange={(e) => setF({ ...f, mName: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-master", kind: tab, name: f.mName })}>Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {data[tab]?.map((m) => (
                <span key={m.id} className="flex items-center gap-2 rounded-full bg-theme-muted px-3 py-1 text-sm">
                  {m.name}
                  <button className="text-red-400" onClick={() => post({ action: "delete-master", kind: tab, id: m.id })}>×</button>
                </span>
              ))}
              {!data[tab]?.length && <p className="text-sm text-theme-text-tertiary">None yet</p>}
            </div>
          </div>
        )}

        {tab === "competitors" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Name" value={f.cName ?? ""} onChange={(e) => setF({ ...f, cName: e.target.value })} className={input} />
              <input placeholder="Website" value={f.cWeb ?? ""} onChange={(e) => setF({ ...f, cWeb: e.target.value })} className={input} />
              <input placeholder="Strengths" value={f.cStr ?? ""} onChange={(e) => setF({ ...f, cStr: e.target.value })} className={input} />
              <input placeholder="Weaknesses" value={f.cWeak ?? ""} onChange={(e) => setF({ ...f, cWeak: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "upsert-competitor", name: f.cName, website: f.cWeb, strengths: f.cStr, weaknesses: f.cWeak })}>Add</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Competitor</th><th className={th}>Website</th><th className={th}>Strengths</th><th className={th}>Weaknesses</th></tr></thead>
              <tbody>
                {data.competitors?.map((c) => (
                  <tr key={c.id} className="border-t border-theme-border">
                    <td className={th}>{c.name}</td><td className={th}>{c.website ?? "—"}</td>
                    <td className={th}>{c.strengths ?? "—"}</td><td className={th}>{c.weaknesses ?? "—"}</td>
                  </tr>
                ))}
                {!data.competitors?.length && <tr><td colSpan={4} className="p-6 text-center text-theme-text-tertiary">No competitors tracked</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "notes" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Title" value={f.nTitle ?? ""} onChange={(e) => setF({ ...f, nTitle: e.target.value })} className={input} />
              <input placeholder="Content" value={f.nContent ?? ""} onChange={(e) => setF({ ...f, nContent: e.target.value })} className={`${input} flex-1`} />
              <button className={btn} onClick={() => post({ action: "create-note", title: f.nTitle, content: f.nContent })}>Add Note</button>
            </div>
            {data.notes?.map((n) => (
              <div key={n.id} className="rounded-xl border border-theme-border bg-theme-surface p-4">
                <b>{n.title ?? "Note"}</b>
                <p className="mt-1 text-sm text-theme-text-primary">{n.content}</p>
                <p className="mt-1 text-xs text-theme-text-tertiary">{String(n.created_at).slice(0, 16)}{n.party_type ? ` · ${n.party_type}` : ""}</p>
              </div>
            ))}
            {!data.notes?.length && <p className="text-sm text-theme-text-tertiary">No notes</p>}
          </div>
        )}

        {tab === "appointments" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Title" value={f.aTitle ?? ""} onChange={(e) => setF({ ...f, aTitle: e.target.value })} className={input} />
              <input type="datetime-local" value={f.aWhen ?? ""} onChange={(e) => setF({ ...f, aWhen: e.target.value })} className={input} />
              <input type="number" placeholder="Mins" value={f.aDur ?? 30} onChange={(e) => setF({ ...f, aDur: e.target.value })} className={`${input} w-20`} />
              <input placeholder="Location" value={f.aLoc ?? ""} onChange={(e) => setF({ ...f, aLoc: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-appointment", title: f.aTitle, scheduledAt: f.aWhen, durationMinutes: Number(f.aDur ?? 30), location: f.aLoc })}>Schedule</button>
              <span className="ml-auto flex items-center gap-1 text-sm">
                <button className={btnSm} onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>‹</button>
                <b className="w-32 text-center">{calMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}</b>
                <button className={btnSm} onClick={() => setCalMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>›</button>
                <button className={`${btnSm} ml-2`} onClick={() => setCalView((v) => !v)}>{calView ? "List" : "Calendar"}</button>
              </span>
            </div>
            {calView ? (
              <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-theme-border bg-theme-muted text-xs">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="bg-theme-surface p-2 text-center font-semibold text-theme-text-secondary">{d}</div>
                ))}
                {(() => {
                  const year = calMonth.getFullYear();
                  const month = calMonth.getMonth();
                  const first = new Date(year, month, 1);
                  const days = new Date(year, month + 1, 0).getDate();
                  const cells: any[] = [];
                  for (let i = 0; i < first.getDay(); i++) cells.push(<div key={`pad-${i}`} className="min-h-24 bg-theme-bg/60" />);
                  for (let d = 1; d <= days; d++) {
                    const dayAppts = (data.appointments ?? []).filter((a) => {
                      const t = new Date(a.scheduled_at);
                      return t.getFullYear() === year && t.getMonth() === month && t.getDate() === d;
                    });
                    const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();
                    cells.push(
                      <div key={d} className={`min-h-24 bg-theme-surface p-1.5 ${isToday ? "outline outline-1 outline-emerald-500" : ""}`}>
                        <div className={`mb-1 text-right text-[10px] ${isToday ? "font-bold text-emerald-400" : "text-theme-text-tertiary"}`}>{d}</div>
                        {dayAppts.slice(0, 3).map((a) => (
                          <div key={a.id} title={`${a.title} · ${a.location ?? ""} · ${a.status}`}
                            className={`mb-0.5 truncate rounded px-1 py-0.5 ${a.status === "cancelled" ? "bg-theme-muted text-theme-text-tertiary line-through" : "bg-indigo-900/60 text-indigo-200"}`}>
                            {String(a.scheduled_at).slice(11, 16)} {a.title}
                          </div>
                        ))}
                        {dayAppts.length > 3 && <div className="text-[10px] text-theme-text-tertiary">+{dayAppts.length - 3} more</div>}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
            ) : (
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Appointment</th><th className={th}>When</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.appointments?.map((a) => (
                  <tr key={a.id} className="border-t border-theme-border">
                    <td className={th}>{a.title}</td><td className={th}>{String(a.scheduled_at).slice(0, 16)}</td>
                    <td className={th}>{a.status}</td>
                    <td className={th}>
                      <div className="flex gap-1">
                        {["scheduled", "confirmed"].includes(a.status) && <button className={btnSm} onClick={() => post({ action: "appointment-status", id: a.id, status: "completed" })}>Done</button>}
                        {a.status === "scheduled" && <button className={btnSm} onClick={() => post({ action: "appointment-status", id: a.id, status: "cancelled" })}>Cancel</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.appointments?.length && <tr><td colSpan={4} className="p-6 text-center text-theme-text-tertiary">No appointments</td></tr>}
              </tbody>
            </table>
            )}
          </div>
        )}

        {tab === "sms" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="+234..." value={f.smsTo ?? ""} onChange={(e) => setF({ ...f, smsTo: e.target.value })} className={input} />
              <input placeholder="Message" value={f.smsMsg ?? ""} onChange={(e) => setF({ ...f, smsMsg: e.target.value })} className={`${input} flex-1`} />
              <button className={btn} onClick={async () => {
                const d = await post({ action: "send-sms", to: f.smsTo, message: f.smsMsg });
                setMsg(d ? `SMS ${d.message?.status ?? "queued"}` : "");
              }}>Send</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>To</th><th className={th}>Message</th><th className={th}>Status</th><th className={th}>Sent</th></tr></thead>
              <tbody>
                {data.sms?.map((m) => (
                  <tr key={m.id} className="border-t border-theme-border">
                    <td className={`${th} font-mono`}>{m.to_number}</td>
                    <td className={`${th} max-w-[320px] truncate`}>{m.message}</td>
                    <td className={th}>{m.status}</td>
                    <td className={th}>{m.sent_at ? String(m.sent_at).slice(0, 16) : "—"}</td>
                  </tr>
                ))}
                {!data.sms?.length && <tr><td colSpan={4} className="p-6 text-center text-theme-text-tertiary">No SMS sent</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
