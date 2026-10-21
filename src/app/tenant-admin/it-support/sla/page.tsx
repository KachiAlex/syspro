"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

export default function SupportSlaPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"claims" | "engine">("claims");
  const [claims, setClaims] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const c = await fetch("/api/support/sla-engine?view=warranty-claims").then((r) => r.json()).catch(() => ({}));
    setClaims(c.claims ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/support/sla-engine", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return; }
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
        <h1 className="mb-1 text-2xl font-bold">SLA &amp; Warranty</h1>
        <p className="mb-4 text-sm text-slate-400">Business-hours SLA engine, breach detection, warranty claims</p>
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-900 p-1">
          {(["claims", "engine"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-slate-700" : "text-slate-400 hover:text-white"}`}>
              {t === "claims" ? "Warranty Claims" : "SLA Engine"}
            </button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-slate-800 p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "claims" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Serial no" value={f.wSerial ?? ""} onChange={(e) => setF({ ...f, wSerial: e.target.value })} className={input} />
              <input placeholder="SKU" value={f.wSku ?? ""} onChange={(e) => setF({ ...f, wSku: e.target.value })} className={input} />
              <input placeholder="Customer" value={f.wCust ?? ""} onChange={(e) => setF({ ...f, wCust: e.target.value })} className={input} />
              <input type="date" value={f.wExpiry ?? ""} onChange={(e) => setF({ ...f, wExpiry: e.target.value })} className={input} title="Warranty expiry" />
              <input placeholder="Complaint" value={f.wComplaint ?? ""} onChange={(e) => setF({ ...f, wComplaint: e.target.value })} className={`${input} flex-1`} />
              <button className={btn} onClick={() => post({
                action: "create-warranty-claim", serialNo: f.wSerial, productSku: f.wSku,
                customerName: f.wCust, warrantyExpiry: f.wExpiry || null, complaint: f.wComplaint,
              })}>New Claim</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Claim</th><th className={th}>Serial</th><th className={th}>Customer</th><th className={th}>Complaint</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id} className="border-t border-slate-800/50">
                    <td className={`${th} font-mono`}>{c.claim_number}</td><td className={th}>{c.serial_no ?? "—"}</td>
                    <td className={th}>{c.customer_name ?? "—"}</td><td className={th}>{c.complaint}</td>
                    <td className={th}>{c.status}</td>
                    <td className={th}>
                      <div className="flex gap-1">
                        {c.status === "open" && <button className={btnSm} onClick={() => post({ action: "update-warranty-claim", claimId: c.id, status: "under_review" })}>Review</button>}
                        {c.status === "under_review" && (
                          <>
                            <button className={btnSm} onClick={() => post({ action: "update-warranty-claim", claimId: c.id, status: "approved" })}>Approve</button>
                            <button className={btnSm} onClick={() => post({ action: "update-warranty-claim", claimId: c.id, status: "rejected" })}>Reject</button>
                          </>
                        )}
                        {c.status === "approved" && <button className={btnSm} onClick={() => post({ action: "update-warranty-claim", claimId: c.id, status: "work_done" })}>Work Done</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!claims.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No warranty claims</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "engine" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-2 font-semibold">Breach detection</h3>
              <p className="mb-3 text-sm text-slate-400">Scans open tickets for response/resolution deadline breaches — marks them and notifies the assignee. Wire to a cron for continuous coverage.</p>
              <button className={btn} onClick={async () => {
                const d = await post({ action: "detect-breaches" });
                setMsg(d ? `Marked ${d.breached} ticket(s) as breached` : "");
              }}>Run Breach Detection</button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-2 font-semibold">Recalculate a ticket&rsquo;s SLA</h3>
              <div className="flex gap-2">
                <input placeholder="Ticket ID" value={f.tId ?? ""} onChange={(e) => setF({ ...f, tId: e.target.value })} className={input} />
                <button className={btn} onClick={async () => {
                  const d = await post({ action: "recalc-ticket", ticketId: f.tId });
                  setMsg(d ? `Response due ${String(d.responseDue).slice(0, 16)} · Resolution due ${String(d.resolutionDue).slice(0, 16)}` : "");
                }}>Recalc</button>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <h3 className="mb-2 font-semibold">Policy calendar</h3>
              <p className="mb-3 text-sm text-slate-400">Set business hours + pause/fulfil statuses on an SLA policy (defaults: Mon–Fri, 08:00–17:00).</p>
              <div className="flex flex-wrap gap-2">
                <input placeholder="Policy ID" value={f.polId ?? ""} onChange={(e) => setF({ ...f, polId: e.target.value })} className={input} />
                <input placeholder="Days csv (mon,tue)" value={f.polDays ?? ""} onChange={(e) => setF({ ...f, polDays: e.target.value })} className={input} />
                <input placeholder="Start (08:00)" value={f.polStart ?? ""} onChange={(e) => setF({ ...f, polStart: e.target.value })} className={`${input} w-32`} />
                <input placeholder="End (17:00)" value={f.polEnd ?? ""} onChange={(e) => setF({ ...f, polEnd: e.target.value })} className={`${input} w-32`} />
                <button className={btn} onClick={() => post({
                  action: "update-policy", policyId: f.polId,
                  serviceDays: f.polDays ? String(f.polDays).split(",").map((s: string) => s.trim()) : undefined,
                  businessStart: f.polStart || undefined, businessEnd: f.polEnd || undefined,
                })}>Update Policy</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
