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
    const [results, rolesRes] = await Promise.all([
      Promise.all(
        views.map((v) => fetch(`/api/platform?view=${v}`).then((r) => r.json()).catch(() => ({})))
      ),
      tenantSlug
        ? fetch(`/api/tenant/roles?tenantSlug=${encodeURIComponent(tenantSlug)}`).then((r) => r.json()).catch(() => ({}))
        : Promise.resolve({}),
    ]);
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
      roles: rolesRes.roles ?? [],
    });
  }, [tenantSlug]);

  useEffect(() => { load(); }, [load]);

  // Fetch the states this doc type actually uses (canonical lifecycle +
  // states from existing workflows) to feed the transition From/To dropdowns.
  useEffect(() => {
    const docType = (f.wfDoc ?? "").trim();
    if (!docType) {
      setF((prev) => (prev.docStates?.length ? { ...prev, docStates: [] } : prev));
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/platform?view=doc-states&docType=${encodeURIComponent(docType)}`);
        const d = await res.json().catch(() => ({}));
        setF((prev) => ({ ...prev, docStates: Array.isArray(d.states) ? d.states : [] }));
      } catch {
        // leave prior suggestions
      }
    }, 400);
    return () => clearTimeout(t);
  }, [f.wfDoc]);

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

  const input = "rounded-lg border border-theme-border bg-theme-muted px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50";
  const btnSm = "rounded bg-theme-muted px-2 py-1 text-xs hover:bg-theme-elevated";
  const th = "p-3";
  const jsonInput = (key: string, ph: string) => (
    <textarea placeholder={ph} value={f[key] ?? ""} onChange={(e) => setF({ ...f, [key]: e.target.value })}
      className={`${input} w-full font-mono`} rows={3} />
  );

  type WfState = { name: string; docStatus: string };
  type WfTransition = { from: string; action: string; to: string; roles: string[] };
  const wfStates: WfState[] = f.wfStates ?? [];
  const wfTransitions: WfTransition[] = f.wfTrans ?? [];
  const roleNames: string[] = (data.roles ?? []).map((r: any) => r.name).filter(Boolean);
  const DOC_STATUSES = ["draft", "submitted", "approved", "rejected", "cancelled"];

  const updateWfState = (i: number, patch: Partial<WfState>) =>
    setF({ ...f, wfStates: wfStates.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const updateWfTransition = (i: number, patch: Partial<WfTransition>) =>
    setF({ ...f, wfTrans: wfTransitions.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  // From/To options = states defined in the editor + states fetched for this
  // doc type. Picking a fetched state appends it to the editor list so the
  // save-time validation stays consistent.
  const wfStateOptions: string[] = [
    ...new Set([
      ...wfStates.map((s) => s.name.trim()).filter(Boolean),
      ...((f.docStates ?? []) as string[]),
    ]),
  ];
  const pickWfTransitionState = (i: number, field: "from" | "to", value: string) =>
    setF((prev) => {
      const prevStates: WfState[] = prev.wfStates ?? [];
      const nextStates =
        value && !prevStates.some((s) => s.name.trim() === value)
          ? [...prevStates, { name: value, docStatus: "" }]
          : prevStates;
      return {
        ...prev,
        wfStates: nextStates,
        wfTrans: (prev.wfTrans ?? []).map((t: WfTransition, j: number) =>
          j === i ? { ...t, [field]: value } : t
        ),
      };
    });

  const editWorkflow = (w: any) =>
    setF({
      ...f,
      wfId: w.id,
      wfDoc: w.doc_type,
      wfName: w.name,
      wfStates: (w.states ?? []).map((s: any) => ({ name: s.name ?? "", docStatus: s.docStatus ?? "" })),
      wfTrans: (w.transitions ?? []).map((t: any) => ({
        from: t.from ?? "", action: t.action ?? "", to: t.to ?? "", roles: t.roles ?? [],
      })),
    });

  const saveWorkflow = () => {
    if (!f.wfDoc?.trim() || !f.wfName?.trim()) return setError("Doc type and workflow name are required");
    const states = wfStates
      .filter((s) => s.name.trim())
      .map((s) => ({ name: s.name.trim(), ...(s.docStatus ? { docStatus: s.docStatus } : {}) }));
    const names = new Set(states.map((s) => s.name));
    if (!states.length) return setError("Add at least one state");
    if (names.size !== states.length) return setError("State names must be unique");
    const transitions = wfTransitions
      .filter((t) => t.from && t.to && t.action.trim())
      .map((t) => ({ from: t.from, to: t.to, action: t.action.trim(), roles: t.roles ?? [] }));
    for (const t of transitions) {
      if (!names.has(t.from) || !names.has(t.to)) {
        return setError(`Transition '${t.action}' references a state that doesn't exist`);
      }
    }
    setError("");
    post({ action: "upsert-workflow", id: f.wfId, docType: f.wfDoc, name: f.wfName, states, transitions });
    setF({ ...f, wfId: undefined, wfDoc: "", wfName: "", wfStates: [], wfTrans: [] });
  };

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-theme-bg p-6 text-theme-text-primary">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-1 text-2xl font-bold">Platform</h1>
        <p className="mb-4 text-sm text-theme-text-secondary">Workflows, print formats, webhooks, web forms, data import, payment gateways, maintenance</p>
        <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-theme-surface p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-theme-elevated" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-theme-muted p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "workflows" && (
          <div className="space-y-4">
            <div className="grid gap-4 rounded-xl border border-theme-border bg-theme-surface p-4">
              <div className="flex flex-wrap gap-2">
                <input placeholder="Doc type (e.g. invoice)" value={f.wfDoc ?? ""} onChange={(e) => setF({ ...f, wfDoc: e.target.value })} className={input} />
                <input placeholder="Workflow name" value={f.wfName ?? ""} onChange={(e) => setF({ ...f, wfName: e.target.value })} className={input} />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wide text-theme-text-secondary">States</label>
                  <button className={btnSm} onClick={() => setF({ ...f, wfStates: [...wfStates, { name: "", docStatus: "" }] })}>+ Add state</button>
                </div>
                <div className="space-y-2">
                  {wfStates.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        placeholder="State name (e.g. Pending Approval)"
                        value={s.name}
                        onChange={(e) => updateWfState(i, { name: e.target.value })}
                        className={`${input} min-w-[180px] flex-1`}
                      />
                      <select
                        value={s.docStatus}
                        onChange={(e) => updateWfState(i, { docStatus: e.target.value })}
                        className={input}
                      >
                        <option value="">no doc status</option>
                        {DOC_STATUSES.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <button
                        className={btnSm}
                        onClick={() => setF({ ...f, wfStates: wfStates.filter((_, j) => j !== i) })}
                        aria-label="Remove state"
                      >×</button>
                    </div>
                  ))}
                  {!wfStates.length && <p className="text-xs text-theme-text-tertiary">Add the statuses documents move through — e.g. Draft → Pending → Approved. States already used by this doc type appear automatically in the transition dropdowns below.</p>}
                  {(f.docStates ?? []).length > 0 && (
                    <p className="mt-1 text-xs text-theme-text-tertiary">
                      {(f.docStates as string[]).length} state(s) found for this doc type — pick them in the transition dropdowns to add them here.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wide text-theme-text-secondary">Transitions</label>
                  <button className={btnSm} onClick={() => setF({ ...f, wfTrans: [...wfTransitions, { from: "", action: "", to: "", roles: [] }] })}>+ Add transition</button>
                </div>
                <div className="space-y-3">
                  {wfTransitions.map((t, i) => (
                    <div key={i} className="rounded-lg border border-theme-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={t.from} onChange={(e) => pickWfTransitionState(i, "from", e.target.value)} className={input}>
                          <option value="">From…</option>
                          {wfStateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input
                          placeholder="action (e.g. approve)"
                          value={t.action}
                          onChange={(e) => updateWfTransition(i, { action: e.target.value })}
                          className={input}
                        />
                        <select value={t.to} onChange={(e) => pickWfTransitionState(i, "to", e.target.value)} className={input}>
                          <option value="">To…</option>
                          {wfStateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <button
                          className={btnSm}
                          onClick={() => setF({ ...f, wfTrans: wfTransitions.filter((_, j) => j !== i) })}
                          aria-label="Remove transition"
                        >×</button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-theme-text-tertiary">Roles allowed:</span>
                        {roleNames.map((r) => (
                          <label key={r} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={t.roles.includes(r)}
                              onChange={(e) =>
                                updateWfTransition(i, {
                                  roles: e.target.checked ? [...t.roles, r] : t.roles.filter((x) => x !== r),
                                })
                              }
                            />
                            {r}
                          </label>
                        ))}
                        {!roleNames.length && <span className="text-xs text-theme-text-tertiary">(leave all unchecked = any role)</span>}
                        {roleNames.length > 0 && !t.roles.length && <span className="text-xs text-theme-text-tertiary">any role</span>}
                      </div>
                    </div>
                  ))}
                  {!wfTransitions.length && <p className="text-xs text-theme-text-tertiary">Define which actions move a document between states and which roles may perform them.</p>}
                </div>
              </div>

              <div className="flex gap-2">
                <button className={btn} onClick={saveWorkflow}>{f.wfId ? "Update Workflow" : "Save Workflow"}</button>
                {f.wfId && (
                  <button className={btnSm} onClick={() => setF({ ...f, wfId: undefined, wfDoc: "", wfName: "", wfStates: [], wfTrans: [] })}>
                    Cancel edit
                  </button>
                )}
              </div>
            </div>
            {data.workflows?.map((w: any) => (
              <div key={w.id} className="rounded-xl border border-theme-border bg-theme-surface p-4">
                <div className="flex items-center justify-between">
                  <b>{w.doc_type} — {w.name}</b>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${w.is_active ? "bg-emerald-900/60 text-emerald-300" : "bg-theme-elevated"}`}>{w.is_active ? "active" : "inactive"}</span>
                    <button className={btnSm} onClick={() => editWorkflow(w)}>Edit</button>
                    <button className={btnSm} onClick={() => post({ action: "delete-workflow", id: w.id })}>Delete</button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-theme-text-secondary">
                  {(w.states ?? []).map((s: any) => s.name).join(" → ")} · {w.transitions?.length ?? 0} transitions
                </p>
              </div>
            ))}
            {!data.workflows?.length && <p className="text-sm text-theme-text-tertiary">No workflows defined</p>}
          </div>
        )}

        {tab === "print-formats" && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-theme-border bg-theme-surface p-4">
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
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Doc Type</th><th className={th}>Name</th><th className={th}>Default</th><th className={th}>Updated</th></tr></thead>
              <tbody>
                {data.formats?.map((p: any) => (
                  <tr key={p.id} className="border-t border-theme-border">
                    <td className={th}>{p.doc_type}</td><td className={th}>{p.name}</td>
                    <td className={th}>{p.is_default ? "✓" : ""}</td><td className={th}>{String(p.updated_at).slice(0, 10)}</td>
                  </tr>
                ))}
                {!data.formats?.length && <tr><td colSpan={4} className="p-6 text-center text-theme-text-tertiary">No print formats</td></tr>}
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
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Name</th><th className={th}>URL</th><th className={th}>Doc Types</th><th className={th}>Active</th><th className={th}></th></tr></thead>
              <tbody>
                {data.subscriptions?.map((s: any) => (
                  <tr key={s.id} className="border-t border-theme-border">
                    <td className={th}>{s.name}</td><td className={`${th} max-w-[260px] truncate`}>{s.target_url}</td>
                    <td className={th}>{s.doc_types?.length ? s.doc_types.join(", ") : "all"}</td>
                    <td className={th}>{s.is_active ? "✓" : "—"}</td>
                    <td className={th}><button className={btnSm} onClick={() => post({ action: "update-webhook", id: s.id, isActive: !s.is_active })}>{s.is_active ? "Disable" : "Enable"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="text-sm font-semibold text-theme-text-primary">Recent Deliveries</h3>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Event</th><th className={th}>Doc</th><th className={th}>Status</th><th className={th}>Attempts</th><th className={th}>Code</th><th className={th}></th></tr></thead>
              <tbody>
                {data.deliveries?.map((d: any) => (
                  <tr key={d.id} className="border-t border-theme-border">
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
            <div className="grid gap-2 rounded-xl border border-theme-border bg-theme-surface p-4">
              <div className="flex flex-wrap gap-2">
                <input placeholder="Form name" value={f.fmName ?? ""} onChange={(e) => setF({ ...f, fmName: e.target.value })} className={input} />
                <input placeholder="slug" value={f.fmSlug ?? ""} onChange={(e) => setF({ ...f, fmSlug: e.target.value })} className={input} />
                <select value={f.fmTarget ?? "lead"} onChange={(e) => setF({ ...f, fmTarget: e.target.value })} className={input}>
                  <option value="lead">Creates Lead</option><option value="ticket">Creates Ticket</option><option value="customer">Creates Contact</option>
                </select>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-xs font-medium uppercase tracking-wide text-theme-text-secondary">Form fields</label>
                  <button className={btnSm} onClick={() => setF({ ...f, fmFields: [...(f.fmFields ?? []), { name: "", label: "", type: "text", required: false }] })}>+ Add field</button>
                </div>
                <div className="space-y-2">
                  {(f.fmFields ?? []).map((fld: any, i: number) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                      <input
                        placeholder="Field key (e.g. email)"
                        value={fld.name}
                        onChange={(e) => setF({ ...f, fmFields: f.fmFields.map((x: any, j: number) => (j === i ? { ...x, name: e.target.value } : x)) })}
                        className={`${input} w-44`}
                      />
                      <input
                        placeholder="Label (e.g. Email address)"
                        value={fld.label}
                        onChange={(e) => setF({ ...f, fmFields: f.fmFields.map((x: any, j: number) => (j === i ? { ...x, label: e.target.value } : x)) })}
                        className={`${input} flex-1`}
                      />
                      <select
                        value={fld.type}
                        onChange={(e) => setF({ ...f, fmFields: f.fmFields.map((x: any, j: number) => (j === i ? { ...x, type: e.target.value } : x)) })}
                        className={input}
                      >
                        {["text", "email", "tel", "number", "date", "textarea"].map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(fld.required)}
                          onChange={(e) => setF({ ...f, fmFields: f.fmFields.map((x: any, j: number) => (j === i ? { ...x, required: e.target.checked } : x)) })}
                        />
                        required
                      </label>
                      <button className={btnSm} onClick={() => setF({ ...f, fmFields: f.fmFields.filter((_: any, j: number) => j !== i) })} aria-label="Remove field">×</button>
                    </div>
                  ))}
                  {!(f.fmFields ?? []).length && <p className="text-xs text-theme-text-tertiary">Add the fields this form collects — e.g. name, email, message.</p>}
                </div>
              </div>
              <button className={btn} onClick={() => {
                const schema = (f.fmFields ?? [])
                  .filter((fld: any) => fld.name?.trim())
                  .map((fld: any) => ({
                    name: fld.name.trim(),
                    label: fld.label?.trim() || fld.name.trim(),
                    type: fld.type || "text",
                    required: Boolean(fld.required),
                  }));
                post({ action: "create-web-form", name: f.fmName, slug: f.fmSlug, targetEntity: f.fmTarget ?? "lead", schema });
              }}>Create Form</button>
            </div>
            {data.forms?.map((fm: any) => (
              <div key={fm.id} className="flex items-center justify-between rounded-xl border border-theme-border bg-theme-surface p-4">
                <div>
                  <b>{fm.name}</b> <span className="text-xs text-theme-text-secondary">→ {fm.target_entity} · {fm.submit_count} submissions</span>
                  <p className="mt-1 font-mono text-xs text-theme-text-tertiary">POST /api/public/forms {"{tenant, slug: \""}{fm.slug}{"\", data}"}</p>
                </div>
                <button className={btnSm} onClick={() => post({ action: "update-web-form", id: fm.id, isActive: !fm.is_active })}>{fm.is_active ? "Disable" : "Enable"}</button>
              </div>
            ))}
            {!data.forms?.length && <p className="text-sm text-theme-text-tertiary">No web forms</p>}
          </div>
        )}

        {tab === "data-import" && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-theme-border bg-theme-surface p-4">
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
              {f.diCsv && (() => {
                const csvHeaders = (f.diCsv.split("\n")[0] ?? "").split(",").map((h: string) => h.trim()).filter(Boolean);
                const entityFields: string[] = (data.entities ?? []).find((e: any) => e.entity === (f.diEntity ?? "customers"))?.spec?.fields ?? [];
                const guessField = (h: string) =>
                  entityFields.find((fl) => fl.toLowerCase() === h.toLowerCase().replace(/[\s\-]+/g, "_")) ?? "";
                const columnMap: Record<string, string> = {};
                csvHeaders.forEach((h: string) => {
                  const mapped = f.diMapObj?.[h] ?? guessField(h);
                  if (mapped) columnMap[h] = mapped;
                });
                return (
                  <>
                    <div>
                      <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-theme-text-secondary">Map CSV columns to fields</label>
                      <div className="space-y-2">
                        {csvHeaders.map((h: string) => (
                          <div key={h} className="flex items-center gap-2">
                            <span className="w-48 truncate font-mono text-xs text-theme-text-secondary">{h}</span>
                            <span className="text-xs text-theme-text-tertiary">→</span>
                            <select
                              value={f.diMapObj?.[h] ?? guessField(h)}
                              onChange={(e) => setF({ ...f, diMapObj: { ...(f.diMapObj ?? {}), [h]: e.target.value } })}
                              className={input}
                            >
                              <option value="">— skip column —</option>
                              {entityFields.map((fl) => <option key={fl} value={fl}>{fl}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button className={btn} onClick={async () => {
                      const created = await post({ action: "create-import", entity: f.diEntity ?? "customers", fileName: f.diFile, columnMap });
                      if (created) {
                        const r = await post({ action: "run-import", importId: created.dataImport.id, csvText: f.diCsv });
                        setMsg(r ? `Imported ${r.imported}, ${r.errors?.length ?? 0} errors` : "");
                      }
                    }}>Import</button>
                  </>
                );
              })()}
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Entity</th><th className={th}>File</th><th className={th}>Status</th><th className={th}>Imported</th><th className={th}>Failed</th><th className={th}>Date</th></tr></thead>
              <tbody>
                {data.imports?.map((im: any) => (
                  <tr key={im.id} className="border-t border-theme-border">
                    <td className={th}>{im.entity}</td><td className={th}>{im.file_name ?? "—"}</td>
                    <td className={th}>{im.status}</td><td className={th}>{im.imported_rows}/{im.total_rows}</td>
                    <td className={`${th} ${im.failed_rows ? "text-red-400" : ""}`}>{im.failed_rows}</td>
                    <td className={th}>{String(im.created_at).slice(0, 10)}</td>
                  </tr>
                ))}
                {!data.imports?.length && <tr><td colSpan={6} className="p-6 text-center text-theme-text-tertiary">No imports yet</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "gateways" && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl border border-theme-border bg-theme-surface p-4">
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
                  action: "upsert-gateway", provider: f.gwProvider ?? "paystack", publicKey: f.gwPub,
                  secretKey: f.gwSecret, webhookSecret: f.gwHook, mode: f.gwMode ?? "test",
                })}>Save Config</button>
              </div>
              <p className="text-xs text-theme-text-tertiary">
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
                const d = await post({ action: "init-payment", invoiceId: f.plInv, provider: f.plProvider ?? "paystack", customerEmail: f.plEmail });
                setMsg(d?.checkoutUrl ? `Payment link: ${d.checkoutUrl}` : "");
              }}>Create Payment Link</button>
            </div>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Reference</th><th className={th}>Provider</th><th className={th}>Amount</th><th className={th}>Status</th><th className={th}>Link</th></tr></thead>
              <tbody>
                {data.links?.map((l: any) => (
                  <tr key={l.id} className="border-t border-theme-border">
                    <td className={`${th} font-mono`}>{l.reference}</td><td className={th}>{l.provider}</td>
                    <td className={th}>{Number(l.amount).toLocaleString()} {l.currency}</td><td className={th}>{l.status}</td>
                    <td className={th}>{l.checkout_url && <a href={l.checkout_url} target="_blank" className="text-blue-400 underline">open</a>}</td>
                  </tr>
                ))}
                {!data.links?.length && <tr><td colSpan={5} className="p-6 text-center text-theme-text-tertiary">No payment links</td></tr>}
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
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Asset</th><th className={th}>Frequency</th><th className={th}>Next Due</th><th className={th}>Last Done</th><th className={th}>Assigned</th><th className={th}></th></tr></thead>
              <tbody>
                {data.schedules?.map((s: any) => (
                  <tr key={s.id} className="border-t border-theme-border">
                    <td className={th}>{s.asset_name}</td><td className={th}>{s.frequency}</td>
                    <td className={th}>{String(s.next_due).slice(0, 10)}</td><td className={th}>{s.last_completed ? String(s.last_completed).slice(0, 10) : "—"}</td>
                    <td className={th}>{s.assigned_to ?? "—"}</td>
                    <td className={th}><button className={btnSm} onClick={() => post({ action: "update-schedule", id: s.id, isActive: !s.is_active })}>{s.is_active ? "Disable" : "Enable"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="text-sm font-semibold text-theme-text-primary">Visits</h3>
            <table className="w-full rounded-xl border border-theme-border bg-theme-surface text-sm">
              <thead className="text-left text-theme-text-secondary"><tr><th className={th}>Asset</th><th className={th}>Scheduled</th><th className={th}>Status</th><th className={th}>Engineer</th><th className={th}></th></tr></thead>
              <tbody>
                {data.visits?.map((v: any) => (
                  <tr key={v.id} className="border-t border-theme-border">
                    <td className={th}>{v.asset_name}</td><td className={th}>{String(v.scheduled_date).slice(0, 10)}</td>
                    <td className={th}>{v.status}</td><td className={th}>{v.engineer ?? "—"}</td>
                    <td className={th}>{v.status !== "completed" && <button className={btnSm} onClick={() => post({ action: "complete-visit", visitId: v.id })}>Complete</button>}</td>
                  </tr>
                ))}
                {!data.visits?.length && <tr><td colSpan={5} className="p-6 text-center text-theme-text-tertiary">No visits</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
