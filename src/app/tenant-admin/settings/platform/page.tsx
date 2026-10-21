"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["workflows", "print-formats", "webhooks", "web-forms", "data-import", "gateways", "maintenance"] as const;

export default function PlatformPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("workflows");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const views = ["workflows", "print-formats", "webhooks", "web-forms", "data-imports", "gateways", "maintenance"];
    const results = await Promise.all(
      views.map((v) => fetch(`/api/platform?view=${v}`).then((r) => r.json()).catch(() => ({})))
    );
    setData({
      workflows: results[0].workflows ?? [],
      formats: results[1].formats ?? [],
      subscriptions: results[2].subscriptions ?? [],
      deliveries: results[2].deliveries ?? [],
      forms: results[3].forms ?? [],
      imports: results[4].imports ?? [],
      entities: results[4].entities ?? [],
      configs: results[5].configs ?? [],
      links: results[5].links ?? [],
      schedules: results[6].schedules ?? [],
      visits: results[6].visits ?? [],
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/platform", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const ct = res.headers.get("content-type") ?? "";
    const d = ct.includes("json") ? await res.json() : {};
    if (!res.ok) { setError(d.error ?? "Failed"); return null; }
    setError(""); load();
    return d;
  };

  const input = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50";
  const btnSm = "rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700";
  const th = "p-3";
  const jsonInput = (key: string, ph: string) => (
    <textarea placeholder={ph} value={f[key] ?? ""} onChange={(e) => setF({ ...f, [key]: e.target.value })}
      className={`${input} w-full font-mono`} rows={3} />
  );

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">Platform</h1>
        <p className="mb-4 text-sm text-slate-400">Workflows, print formats, webhooks, web forms, data import, payment gateways, maintenance</p>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-900 p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-slate-700" : "text-slate-400 hover:text-white"}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-slate-800 p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "workflows" && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap gap-2">
                <input placeholder="Doc type (e.g. invoice)" value={f.wfDoc ?? ""} onChange={(e) => setF({ ...f, wfDoc: e.target.value })} className={input} />
                <input placeholder="Workflow name" value={f.wfName ?? ""} onChange={(e) => setF({ ...f, wfName: e.target.value })} className={input} />
              </div>
              {jsonInput("wfStates", 'States JSON: [{"name":"Draft"},{"name":"Pending"},{"name":"Approved","docStatus":"approved"}]')}
              {jsonInput("wfTrans", 'Transitions JSON: [{"from":"Draft","to":"Pending","action":"submit","roles":["staff"]},{"from":"Pending","to":"Approved","action":"approve","roles":["manager"]}]')}
              <button className={btn} onClick={() => post({
                action: "upsert-workflow", docType: f.wfDoc, name: f.wfName,
                states: JSON.parse(f.wfStates || "[]"), transitions: JSON.parse(f.wfTrans || "[]"),
              })}>Save Workflow</button>
            </div>
            {data.workflows?.map((w: any) => (
              <div key={w.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex items-center justify-between">
                  <b>{w.doc_type} — {w.name}</b>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${w.is_active ? "bg-emerald-900/60 text-emerald-300" : "bg-slate-700"}`}>{w.is_active ? "active" : "inactive"}</span>
                    <button className={btnSm} onClick={() => post({ action: "delete-workflow", id: w.id })}>Delete</button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {(w.states ?? []).map((s: any) => s.name).join(" → ")} · {w.transitions?.length ?? 0} transitions
                </p>
              </div>
            ))}
            {!data.workflows?.length && <p className="text-sm text-slate-500">No workflows defined</p>}
          </div>
        )}

        {tab === "print-formats" && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap gap-2">
                <input placeholder="Doc type" value={f.pfDoc ?? ""} onChange={(e) => setF({ ...f, pfDoc: e.target.value })} className={input} />
                <input placeholder="Format name" value={f.pfName ?? ""} onChange={(e) => setF({ ...f, pfName: e.target.value })} className={input} />
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pfDefault ?? false} onChange={(e) => setF({ ...f, pfDefault: e.target.checked })} /> Default</label>
              </div>
              {jsonInput("pfBody", 'Body HTML — e.g. <h1>Invoice {{invoice_number}}</h1><table>{{#each items}}<tr><td>{{description}}</td><td>{{amount}}</td></tr>{{/each}}</table>')}
              <button className={btn} onClick={() => post({
                action: "upsert-print-format", docType: f.pfDoc, name: f.pfName,
                bodyHtml: f.pfBody, isDefault: f.pfDefault,
              })}>Save Format</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Doc Type</th><th className={th}>Name</th><th className={th}>Default</th><th className={th}>Updated</th></tr></thead>
              <tbody>
                {data.formats?.map((p: any) => (
                  <tr key={p.id} className="border-t border-slate-800/50">
                    <td className={th}>{p.doc_type}</td><td className={th}>{p.name}</td>
                    <td className={th}>{p.is_default ? "✓" : ""}</td><td className={th}>{String(p.updated_at).slice(0, 10)}</td>
                  </tr>
                ))}
                {!data.formats?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No print formats</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "webhooks" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Name" value={f.whName ?? ""} onChange={(e) => setF({ ...f, whName: e.target.value })} className={input} />
              <input placeholder="https://…" value={f.whUrl ?? ""} onChange={(e) => setF({ ...f, whUrl: e.target.value })} className={`${input} flex-1`} />
              <input placeholder="Secret (optional)" value={f.whSecret ?? ""} onChange={(e) => setF({ ...f, whSecret: e.target.value })} className={input} />
              <input placeholder="Doc types (csv, blank=all)" value={f.whDocs ?? ""} onChange={(e) => setF({ ...f, whDocs: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({
                action: "create-webhook", name: f.whName, targetUrl: f.whUrl,
                secret: f.whSecret || undefined,
                docTypes: (f.whDocs ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
              })}>Subscribe</button>
              <button className={btnSm} onClick={async () => { const d = await post({ action: "process-deliveries" }); setMsg(d ? `${d.delivered}/${d.processed} delivered` : ""); }}>Process Queue</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Name</th><th className={th}>URL</th><th className={th}>Doc Types</th><th className={th}>Active</th><th className={th}></th></tr></thead>
              <tbody>
                {data.subscriptions?.map((s: any) => (
                  <tr key={s.id} className="border-t border-slate-800/50">
                    <td className={th}>{s.name}</td><td className={`${th} max-w-[260px] truncate`}>{s.target_url}</td>
                    <td className={th}>{s.doc_types?.length ? s.doc_types.join(", ") : "all"}</td>
                    <td className={th}>{s.is_active ? "✓" : "—"}</td>
                    <td className={th}><button className={btnSm} onClick={() => post({ action: "update-webhook", id: s.id, isActive: !s.is_active })}>{s.is_active ? "Disable" : "Enable"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="text-sm font-semibold text-slate-300">Recent Deliveries</h3>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Event</th><th className={th}>Doc</th><th className={th}>Status</th><th className={th}>Attempts</th><th className={th}>Code</th><th className={th}></th></tr></thead>
              <tbody>
                {data.deliveries?.map((d: any) => (
                  <tr key={d.id} className="border-t border-slate-800/50">
                    <td className={th}>{d.event}</td><td className={th}>{d.doc_type}</td>
                    <td className={th}>{d.status}</td><td className={th}>{d.attempts}</td><td className={th}>{d.response_code ?? "—"}</td>
                    <td className={th}>{["failed", "dead"].includes(d.status) && <button className={btnSm} onClick={() => post({ action: "retry-delivery", id: d.id })}>Retry</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "web-forms" && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap gap-2">
                <input placeholder="Form name" value={f.fmName ?? ""} onChange={(e) => setF({ ...f, fmName: e.target.value })} className={input} />
                <input placeholder="slug" value={f.fmSlug ?? ""} onChange={(e) => setF({ ...f, fmSlug: e.target.value })} className={input} />
                <select value={f.fmTarget ?? "lead"} onChange={(e) => setF({ ...f, fmTarget: e.target.value })} className={input}>
                  <option value="lead">Creates Lead</option><option value="ticket">Creates Ticket</option><option value="customer">Creates Contact</option>
                </select>
              </div>
              {jsonInput("fmSchema", 'Fields JSON: [{"name":"name","label":"Full Name","type":"text","required":true},{"name":"email","label":"Email","type":"email","required":true},{"name":"message","label":"Message","type":"textarea"}]')}
              <button className={btn} onClick={() => post({
                action: "create-web-form", name: f.fmName, slug: f.fmSlug,
                targetEntity: f.fmTarget, schema: JSON.parse(f.fmSchema || "[]"),
              })}>Create Form</button>
            </div>
            {data.forms?.map((fm: any) => (
              <div key={fm.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4">
                <div>
                  <b>{fm.name}</b> <span className="text-xs text-slate-400">→ {fm.target_entity} · {fm.submit_count} submissions</span>
                  <p className="mt-1 font-mono text-xs text-slate-500">POST /api/public/forms {"{tenant, slug: \""}{fm.slug}{"\", data}"}</p>
                </div>
                <button className={btnSm} onClick={() => post({ action: "update-web-form", id: fm.id, isActive: !fm.is_active })}>{fm.is_active ? "Disable" : "Enable"}</button>
              </div>
            ))}
            {!data.forms?.length && <p className="text-sm text-slate-500">No web forms</p>}
          </div>
        )}

        {tab === "data-import" && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap gap-2">
                <select value={f.diEntity ?? "customers"} onChange={(e) => setF({ ...f, diEntity: e.target.value })} className={input}>
                  {(data.entities ?? []).map((e: any) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}
                </select>
                <input type="file" accept=".csv" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setF({ ...f, diCsv: String(reader.result), diFile: file.name });
                  reader.readAsText(file);
                }} className="text-sm" />
              </div>
              {f.diCsv && (
                <>
                  <p className="text-xs text-slate-400">CSV columns: {(f.diCsv.split("\n")[0] ?? "").split(",").join(", ")}</p>
                  {jsonInput("diMap", 'Column map JSON: {"CSV Header":"field"} — fields: ' + JSON.stringify((data.entities ?? []).find((e: any) => e.entity === f.diEntity)?.spec?.fields ?? []))}
                  <button className={btn} onClick={async () => {
                    const created = await post({ action: "create-import", entity: f.diEntity, fileName: f.diFile, columnMap: JSON.parse(f.diMap || "{}") });
                    if (created) {
                      const r = await post({ action: "run-import", importId: created.dataImport.id, csvText: f.diCsv });
                      setMsg(r ? `Imported ${r.imported}, ${r.errors?.length ?? 0} errors` : "");
                    }
                  }}>Import</button>
                </>
              )}
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Entity</th><th className={th}>File</th><th className={th}>Status</th><th className={th}>Imported</th><th className={th}>Failed</th><th className={th}>Date</th></tr></thead>
              <tbody>
                {data.imports?.map((im: any) => (
                  <tr key={im.id} className="border-t border-slate-800/50">
                    <td className={th}>{im.entity}</td><td className={th}>{im.file_name ?? "—"}</td>
                    <td className={th}>{im.status}</td><td className={th}>{im.imported_rows}/{im.total_rows}</td>
                    <td className={`${th} ${im.failed_rows ? "text-red-400" : ""}`}>{im.failed_rows}</td>
                    <td className={th}>{String(im.created_at).slice(0, 10)}</td>
                  </tr>
                ))}
                {!data.imports?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">No imports yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "gateways" && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap gap-2">
                <select value={f.gwProvider ?? "paystack"} onChange={(e) => setF({ ...f, gwProvider: e.target.value })} className={input}>
                  <option value="paystack">Paystack</option><option value="flutterwave">Flutterwave</option>
                </select>
                <input placeholder="Public key" value={f.gwPub ?? ""} onChange={(e) => setF({ ...f, gwPub: e.target.value })} className={input} />
                <input placeholder="Secret key" type="password" value={f.gwSecret ?? ""} onChange={(e) => setF({ ...f, gwSecret: e.target.value })} className={input} />
                <input placeholder="Webhook secret (FW verif-hash)" value={f.gwHook ?? ""} onChange={(e) => setF({ ...f, gwHook: e.target.value })} className={input} />
                <select value={f.gwMode ?? "test"} onChange={(e) => setF({ ...f, gwMode: e.target.value })} className={input}>
                  <option value="test">Test</option><option value="live">Live</option>
                </select>
                <button className={btn} onClick={() => post({
                  action: "upsert-gateway", provider: f.gwProvider, publicKey: f.gwPub,
                  secretKey: f.gwSecret, webhookSecret: f.gwHook, mode: f.gwMode,
                })}>Save Config</button>
              </div>
              <p className="text-xs text-slate-500">
                Webhook URL to configure at the provider: <code>/api/webhooks/payments?tenant={tenantSlug}&provider={f.gwProvider ?? "paystack"}</code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input placeholder="Invoice ID" value={f.plInv ?? ""} onChange={(e) => setF({ ...f, plInv: e.target.value })} className={input} />
              <input placeholder="Customer email" value={f.plEmail ?? ""} onChange={(e) => setF({ ...f, plEmail: e.target.value })} className={input} />
              <select value={f.plProvider ?? "paystack"} onChange={(e) => setF({ ...f, plProvider: e.target.value })} className={input}>
                <option value="paystack">Paystack</option><option value="flutterwave">Flutterwave</option>
              </select>
              <button className={btn} onClick={async () => {
                const d = await post({ action: "init-payment", invoiceId: f.plInv, provider: f.plProvider, customerEmail: f.plEmail });
                setMsg(d?.checkoutUrl ? `Payment link: ${d.checkoutUrl}` : "");
              }}>Create Payment Link</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Reference</th><th className={th}>Provider</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}>Link</th></tr></thead>
              <tbody>
                {data.links?.map((l: any) => (
                  <tr key={l.id} className="border-t border-slate-800/50">
                    <td className={`${th} font-mono`}>{l.reference}</td><td className={th}>{l.provider}</td>
                    <td className={th}>{Number(l.amount).toLocaleString()} {l.currency}</td><td className={th}>{l.status}</td>
                    <td className={th}>{l.checkout_url && <a href={l.checkout_url} target="_blank" className="text-blue-400 underline">open</a>}</td>
                  </tr>
                ))}
                {!data.links?.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No payment links</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "maintenance" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input placeholder="Asset name" value={f.msAsset ?? ""} onChange={(e) => setF({ ...f, msAsset: e.target.value })} className={input} />
              <select value={f.msFreq ?? "monthly"} onChange={(e) => setF({ ...f, msFreq: e.target.value })} className={input}>
                <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
              </select>
              <input type="date" value={f.msDue ?? ""} onChange={(e) => setF({ ...f, msDue: e.target.value })} className={input} />
              <input placeholder="Assigned to" value={f.msAssign ?? ""} onChange={(e) => setF({ ...f, msAssign: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "create-schedule", assetName: f.msAsset, frequency: f.msFreq, nextDue: f.msDue, assignedTo: f.msAssign })}>Schedule</button>
              <button className={btnSm} onClick={async () => { const d = await post({ action: "process-maintenance" }); setMsg(d ? `${d.created.length} visit(s) + ticket(s) created` : ""); }}>Process Due</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Asset</th><th className={th}>Frequency</th><th className={th}>Next Due</th><th className={th}>Last Done</th><th className={th}>Assigned</th><th className={th}></th></tr></thead>
              <tbody>
                {data.schedules?.map((s: any) => (
                  <tr key={s.id} className="border-t border-slate-800/50">
                    <td className={th}>{s.asset_name}</td><td className={th}>{s.frequency}</td>
                    <td className={th}>{String(s.next_due).slice(0, 10)}</td><td className={th}>{s.last_completed ? String(s.last_completed).slice(0, 10) : "—"}</td>
                    <td className={th}>{s.assigned_to ?? "—"}</td>
                    <td className={th}><button className={btnSm} onClick={() => post({ action: "update-schedule", id: s.id, isActive: !s.is_active })}>{s.is_active ? "Disable" : "Enable"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="text-sm font-semibold text-slate-300">Visits</h3>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Asset</th><th className={th}>Scheduled</th><th className={th}>Status</th><th className={th}>Engineer</th><th className={th}></th></tr></thead>
              <tbody>
                {data.visits?.map((v: any) => (
                  <tr key={v.id} className="border-t border-slate-800/50">
                    <td className={th}>{v.asset_name}</td><td className={th}>{String(v.scheduled_date).slice(0, 10)}</td>
                    <td className={th}>{v.status}</td><td className={th}>{v.engineer ?? "—"}</td>
                    <td className={th}>{v.status !== "completed" && <button className={btnSm} onClick={() => post({ action: "complete-visit", visitId: v.id })}>Complete</button>}</td>
                  </tr>
                ))}
                {!data.visits?.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No visits</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
