"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["prospects", "contracts", "stages", "campaigns"] as const;

export default function CrmDepthPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("prospects");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const [p, c, ct, s, wp, camp] = await Promise.all([
      fetch("/api/crm/depth?view=prospects").then((r) => r.json()).catch(() => ({})),
      fetch("/api/crm/depth?view=contracts").then((r) => r.json()).catch(() => ({})),
      fetch("/api/crm/depth?view=contract-templates").then((r) => r.json()).catch(() => ({})),
      fetch("/api/crm/depth?view=sales-stages").then((r) => r.json()).catch(() => ({})),
      fetch("/api/crm/depth?view=weighted-pipeline").then((r) => r.json()).catch(() => ({})),
      fetch("/api/crm/depth?view=campaigns").then((r) => r.json()).catch(() => ({})),
    ]);
    setData({
      prospects: p.prospects ?? [], contracts: c.contracts ?? [],
      templates: ct.templates ?? [], stages: s.stages ?? [],
      weighted: wp, campaigns: camp.campaigns ?? [],
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/crm/depth", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return; }
    setError(""); load();
  };

  const input = "rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50";
  const btnSm = "rounded bg-theme-muted px-2 py-1 text-xs hover:bg-theme-elevated";
  const th = "p-3";

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-theme-bg p-6 text-theme-text-primary">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">CRM Depth</h1>
        <p className="mb-4 text-sm text-theme-text-secondary">Prospects, contracts, configurable sales stages, email campaigns</p>
        <div className="mb-4 flex gap-1 rounded-lg bg-theme-surface p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-theme-elevated" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>{t}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "prospects" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Name" value={f.pName ?? ""} onChange={(e) => setF({ ...f, pName: e.target.value })} className={input} />
              <input placeholder="Company" value={f.pCompany ?? ""} onChange={(e) => setF({ ...f, pCompany: e.target.value })} className={input} />
              <input placeholder="Email" value={f.pEmail ?? ""} onChange={(e) => setF({ ...f, pEmail: e.target.value })} className={input} />
              <input placeholder="Industry" value={f.pIndustry ?? ""} onChange={(e) => setF({ ...f, pIndustry: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-prospect", name: f.pName, companyName: f.pCompany, email: f.pEmail, industry: f.pIndustry })}>Add Prospect</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Name</th><th className={th}>Company</th><th className={th}>Email</th><th className={th}>Industry</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.prospects?.map((p: any) => (
                  <tr key={p.id} className="border-t border-theme-border">
                    <td className={th}>{p.name}</td><td className={th}>{p.company_name ?? "—"}</td>
                    <td className={th}>{p.email ?? "—"}</td><td className={th}>{p.industry ?? "—"}</td>
                    <td className={th}>{p.status}</td>
                    <td className={th}>{p.status === "open" && <button className={btnSm} onClick={() => post({ action: "convert-prospect", prospectId: p.id })}>→ Lead</button>}</td>
                  </tr>
                ))}
                {!data.prospects?.length && <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">No prospects</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "contracts" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Customer ID" value={f.cCust ?? ""} onChange={(e) => setF({ ...f, cCust: e.target.value })} className={input} />
              <input placeholder="Customer name" value={f.cName ?? ""} onChange={(e) => setF({ ...f, cName: e.target.value })} className={input} />
              <input type="number" placeholder="Value" value={f.cValue ?? ""} onChange={(e) => setF({ ...f, cValue: e.target.value })} className={`${input} w-32`} />
              <input type="date" value={f.cEnd ?? ""} onChange={(e) => setF({ ...f, cEnd: e.target.value })} className={input} title="End date" />
              <button className={btn} onClick={() => post({ action: "create-contract", customerId: f.cCust, customerName: f.cName, contractValue: Number(f.cValue ?? 0), endDate: f.cEnd || null })}>New Contract</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Contract</th><th className={th}>Customer</th><th className={th}>Value</th><th className={th}>End</th><th className={th}>Status</th><th className={th}></th></tr></thead>
              <tbody>
                {data.contracts?.map((c: any) => (
                  <tr key={c.id} className="border-t border-theme-border">
                    <td className={`${th} font-mono`}>{c.contract_number}</td><td className={th}>{c.customer_name}</td>
                    <td className={th}>{c.contract_value ? `${c.currency} ${Number(c.contract_value).toLocaleString()}` : "—"}</td>
                    <td className={th}>{c.end_date ? String(c.end_date).slice(0, 10) : "—"}</td><td className={th}>{c.status}</td>
                    <td className={th}>
                      <div className="flex gap-1">
                        {c.status === "draft" && <button className={btnSm} onClick={() => post({ action: "contract-status", contractId: c.id, status: "unsigned" })}>Send</button>}
                        {c.status === "unsigned" && <button className={btnSm} onClick={() => post({ action: "contract-status", contractId: c.id, status: "active" })}>Activate</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!data.contracts?.length && <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">No contracts</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "stages" && (
          <div className="space-y-4">
            {data.weighted && (
              <div className="rounded-xl border border-emerald-800 bg-emerald-900/20 p-4">
                <span className="text-sm text-emerald-300">Weighted pipeline: <b>₦{Math.round(data.weighted.weightedTotal ?? 0).toLocaleString()}</b></span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <input placeholder="Stage name" value={f.sName ?? ""} onChange={(e) => setF({ ...f, sName: e.target.value })} className={input} />
              <input type="number" placeholder="Seq" value={f.sSeq ?? ""} onChange={(e) => setF({ ...f, sSeq: e.target.value })} className={`${input} w-20`} />
              <input type="number" placeholder="Prob %" value={f.sProb ?? ""} onChange={(e) => setF({ ...f, sProb: e.target.value })} className={`${input} w-24`} />
              <button className={btn} onClick={() => post({ action: "upsert-sales-stage", name: f.sName, sequence: Number(f.sSeq ?? 0), probability: Number(f.sProb ?? 0) })}>Save Stage</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Seq</th><th className={th}>Stage</th><th className={th}>Probability</th><th className={th}>Type</th></tr></thead>
              <tbody>
                {data.stages?.map((s: any) => (
                  <tr key={s.id} className="border-t border-theme-border">
                    <td className={th}>{s.sequence}</td><td className={th}>{s.name}</td><td className={th}>{s.probability}%</td>
                    <td className={th}>{s.is_won ? "Won" : s.is_lost ? "Lost" : "Open"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "campaigns" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-theme-border bg-theme-surface p-4">
              <div className="mb-2 flex flex-wrap gap-2">
                <input placeholder="Campaign name" value={f.campName ?? ""} onChange={(e) => setF({ ...f, campName: e.target.value })} className={input} />
                <input placeholder="Subject" value={f.campSubj ?? ""} onChange={(e) => setF({ ...f, campSubj: e.target.value })} className={input} />
                <input placeholder="Body HTML" value={f.campBody ?? ""} onChange={(e) => setF({ ...f, campBody: e.target.value })} className={`${input} flex-1`} />
                <button className={btn} onClick={() => post({
                  action: "upsert-campaign", name: f.campName,
                  emails: [{ delayDays: 0, subject: f.campSubj, bodyHtml: f.campBody }],
                })}>Create</button>
              </div>
              <p className="text-xs text-theme-text-tertiary">Single-email starter — extend via API for multi-step drips</p>
            </div>
            {data.campaigns?.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-theme-border bg-theme-surface p-4">
                <div><b>{c.name}</b> <span className="ml-2 text-xs text-theme-text-secondary">{c.active_enrollments} enrolled</span></div>
                <div className="flex gap-2">
                  <span className="rounded-full bg-theme-elevated px-2 py-0.5 text-xs">{c.status}</span>
                  {c.status !== "active" && <button className={btnSm} onClick={() => post({ action: "campaign-status", campaignId: c.id, status: "active" })}>Activate</button>}
                  {c.status === "active" && <button className={btnSm} onClick={() => post({ action: "campaign-status", campaignId: c.id, status: "paused" })}>Pause</button>}
                  <button className={btnSm} onClick={() => post({ action: "process-sends" })}>Send Due</button>
                </div>
              </div>
            ))}
            {!data.campaigns?.length && <p className="text-sm text-theme-text-tertiary">No campaigns</p>}
          </div>
        )}
      </div>
    </div>
  );
}
