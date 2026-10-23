"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Plus, Search } from "lucide-react";

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const inputCls = "rounded bg-theme-muted px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

type Tab = "pegged" | "cheques" | "tax-packs" | "run-logs";

export default function MoreFinancePage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<Tab>("pegged");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const post = async (path: string, body: Record<string, unknown>) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(path, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, tenantSlug }),
      });
      const j = await res.json();
      if (!j.success && j.error) throw new Error(j.error);
      setMsg("Done"); return j.data ?? j;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">More Finance</h1>
        <p className="text-sm text-theme-text-secondary">Pegged currencies, cheque printing, regional tax packs, and process run logs.</p>
      </div>
      <div className="flex gap-1 border-b border-theme-border overflow-x-auto">
        {(["pegged", "cheques", "tax-packs", "run-logs"] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null); setMsg(null); }}
            className={`px-3 py-2 text-sm whitespace-nowrap ${tab === t ? "border-b-2 border-sky-500 text-sky-400" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>
            {{ pegged: "Pegged Currencies", cheques: "Cheque Printing", "tax-packs": "Tax Packs", "run-logs": "Run Logs" }[t]}
          </button>
        ))}
      </div>
      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      {tab === "pegged" && <PeggedTab tenantSlug={tenantSlug} post={post} busy={busy} setError={setError} />}
      {tab === "cheques" && <ChequesTab tenantSlug={tenantSlug} post={post} busy={busy} />}
      {tab === "tax-packs" && <TaxPacksTab tenantSlug={tenantSlug} post={post} busy={busy} />}
      {tab === "run-logs" && <RunLogsTab tenantSlug={tenantSlug} />}
    </div>
  );
}

function PeggedTab({ tenantSlug, post, busy, setError }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ currency: "", peggedTo: "", rate: "" });
  const [resolve, setResolve] = useState({ currency: "", result: null as any });
  const load = useCallback(async () => {
    const j = await (await fetch(`/api/finance/pegged?tenantSlug=${encodeURIComponent(tenantSlug)}&view=list`)).json();
    if (j.success) setRows(j.data ?? []); else setError(j.error);
  }, [tenantSlug, setError]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-theme-text-secondary">Fix one currency to another — rate resolution walks the peg chain when no direct rate exists (e.g. AED → USD at 3.6725).</p>
      <div className="flex flex-wrap gap-2 items-end rounded border border-theme-border p-4">
        <input className={`${inputCls} w-28`} placeholder="Currency" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
        <span className="text-theme-text-secondary pb-2">→</span>
        <input className={`${inputCls} w-28`} placeholder="Pegged to" maxLength={3} value={form.peggedTo} onChange={(e) => setForm({ ...form, peggedTo: e.target.value.toUpperCase() })} />
        <input className={`${inputCls} w-36`} placeholder="Rate" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
        <button className={btnCls} disabled={busy || form.currency.length !== 3 || form.peggedTo.length !== 3 || !form.rate}
          onClick={async () => { const r = await post("/api/finance/pegged", { ...form, rate: Number(form.rate) }); if (r) { setForm({ currency: "", peggedTo: "", rate: "" }); load(); } }}>
          <Plus className="h-3.5 w-3.5" /> Add Peg
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border"><th className="py-2 pr-3">Currency</th><th className="py-2 pr-3">Pegged To</th><th className="py-2 pr-3 text-right">Rate</th><th className="py-2">Active</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-theme-border/60">
              <td className="py-2 pr-3 font-mono">{r.currency}</td>
              <td className="py-2 pr-3 font-mono">{r.pegged_to}</td>
              <td className="py-2 pr-3 text-right font-mono">{r.rate}</td>
              <td className="py-2">{r.active ? "Yes" : "No"}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-theme-text-tertiary">No pegs defined</td></tr>}
        </tbody>
      </table>
      <div className="flex gap-2 items-center">
        <input className={`${inputCls} w-32`} placeholder="Currency" maxLength={3} value={resolve.currency} onChange={(e) => setResolve({ ...resolve, currency: e.target.value.toUpperCase() })} />
        <button className={btnCls} disabled={resolve.currency.length !== 3}
          onClick={async () => {
            const j = await (await fetch(`/api/finance/pegged?tenantSlug=${encodeURIComponent(tenantSlug)}&view=resolve&currency=${resolve.currency}`)).json();
            setResolve({ ...resolve, result: j.success ? j.data : { error: j.error } });
          }}>
          <Search className="h-3.5 w-3.5" /> Resolve Rate
        </button>
        {resolve.result && (
          <span className="text-sm font-mono">
            {resolve.result.error ? <span className="text-rose-400">{resolve.result.error}</span>
              : resolve.result ? `${resolve.result.rate} (${resolve.result.via}: ${resolve.result.path.join("→")})` : "no rate"}
          </span>
        )}
      </div>
    </div>
  );
}

function ChequesTab({ tenantSlug, post, busy }: any) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [fieldsJson, setFieldsJson] = useState('{\n  "cheque_size": { "w": 203, "h": 93 },\n  "date": { "x": 160, "y": 12, "format": "DDMMYYYY" },\n  "payee": { "x": 30, "y": 32 },\n  "amount_figures": { "x": 160, "y": 45 },\n  "amount_words": { "x": 20, "y": 52, "x2": 20, "y2": 60 }\n}');
  const [form, setForm] = useState({ name: "", bank: "" });
  const [render, setRender] = useState({ templateId: "", payee: "", amount: "", date: "", accountNo: "" });
  const [rendered, setRendered] = useState<any>(null);
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await (await fetch(`/api/finance/cheque?tenantSlug=${encodeURIComponent(tenantSlug)}&view=templates`)).json();
    if (j.success) setTemplates(j.data ?? []);
  }, [tenantSlug]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="font-medium text-sm">Templates <span className="text-theme-text-tertiary font-normal">(mm coordinates on cheque leaf)</span></div>
        {templates.map((t: any) => (
          <div key={t.id} className="flex justify-between text-sm border-b border-theme-border/60 py-1.5">
            <span>{t.name} {t.bank ? `(${t.bank})` : ""}</span>
            <span className="text-theme-text-secondary">{t.is_default ? "default" : ""}</span>
          </div>
        ))}
        {!templates.length && <div className="text-sm text-theme-text-tertiary">No templates yet</div>}
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="Template name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder="Bank" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
        </div>
        <textarea className={`${inputCls} h-40 font-mono`} value={fieldsJson} onChange={(e) => setFieldsJson(e.target.value)} />
        {jsonErr && <div className="text-rose-400 text-xs">{jsonErr}</div>}
        <button className={btnCls} disabled={busy || !form.name}
          onClick={async () => {
            let fields: any;
            try { fields = JSON.parse(fieldsJson); setJsonErr(null); }
            catch { setJsonErr("Invalid JSON"); return; }
            const r = await post("/api/finance/cheque", { action: "upsert-template", name: form.name, bank: form.bank || undefined, fields, isDefault: !templates.length });
            if (r) { setForm({ name: "", bank: "" }); load(); }
          }}>
          <Plus className="h-3.5 w-3.5" /> Save Template
        </button>
      </div>
      <div className="space-y-3">
        <div className="font-medium text-sm">Render Cheque</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={inputCls} value={render.templateId} onChange={(e) => setRender({ ...render, templateId: e.target.value })}>
            <option value="">Default template</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input className={inputCls} placeholder="Payee" value={render.payee} onChange={(e) => setRender({ ...render, payee: e.target.value })} />
          <input className={inputCls} placeholder="Amount" value={render.amount} onChange={(e) => setRender({ ...render, amount: e.target.value })} />
          <input className={inputCls} type="date" value={render.date} onChange={(e) => setRender({ ...render, date: e.target.value })} />
          <input className={inputCls} placeholder="Account no (opt)" value={render.accountNo} onChange={(e) => setRender({ ...render, accountNo: e.target.value })} />
        </div>
        <button className={btnCls} disabled={busy || !render.payee || !render.amount || !render.date}
          onClick={async () => {
            const r = await post("/api/finance/cheque", { action: "render", ...render, amount: Number(render.amount), templateId: render.templateId || undefined, accountNo: render.accountNo || undefined });
            if (r) setRendered(r);
          }}>
          Render
        </button>
        {rendered && (
          <div className="rounded border border-theme-border bg-theme-surface p-4 space-y-2 font-mono text-xs">
            <div className="text-right">{rendered.positions?.date?.text}</div>
            <div className="font-semibold text-base">{rendered.positions?.payee?.text}</div>
            <div className="italic">{rendered.positions?.amount_words?.text}</div>
            <div className="text-right text-base">{rendered.positions?.amount_figures?.text}</div>
            {rendered.positions?.account_no?.text && <div>A/C: {rendered.positions.account_no.text}</div>}
            <div className="text-theme-text-tertiary pt-1">positions: {JSON.stringify(rendered.positions && Object.fromEntries(Object.entries(rendered.positions).filter(([k]) => k !== "signature").map(([k, v]: any) => [k, v ? { x: v.x, y: v.y } : undefined])))}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function TaxPacksTab({ tenantSlug, post, busy }: any) {
  const [packs, setPacks] = useState<any[]>([]);
  const [applied, setApplied] = useState<any[]>([]);
  const load = useCallback(async () => {
    const [p, a] = await Promise.all([
      fetch("/api/finance/tax-packs").then((r) => r.json()),
      fetch(`/api/finance/tax-packs?tenantSlug=${encodeURIComponent(tenantSlug)}&view=applied`).then((r) => r.json()),
    ]);
    if (p.success) setPacks(p.data ?? []);
    if (a.success) setApplied(a.data ?? []);
  }, [tenantSlug]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-4">
      <p className="text-sm text-theme-text-secondary">One-click statutory setups — applies tax templates and withholding categories for a country into your Tax Engine.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {packs.map((p) => (
          <div key={p.code} className="rounded border border-theme-border p-4 space-y-2">
            <div className="font-medium">{p.name} <span className="text-theme-text-tertiary text-xs">{p.currency}</span></div>
            <div className="text-xs text-theme-text-secondary">{p.templates} templates · {p.withholding} WHT</div>
            <button className={btnCls} disabled={busy}
              onClick={async () => { const r = await post("/api/finance/tax-packs", { packCode: p.code }); if (r) load(); }}>
              Apply Pack
            </button>
          </div>
        ))}
      </div>
      {applied.length > 0 && (
        <div>
          <div className="font-medium text-sm mb-2">Applied</div>
          {applied.map((a: any) => (
            <div key={a.pack_code} className="text-xs text-theme-text-secondary py-1 border-b border-theme-border/60">
              {a.pack_code} — {String(a.created_at).slice(0, 16)} — {JSON.stringify(a.detail?.templates ?? [])}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunLogsTab({ tenantSlug }: { tenantSlug: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [process, setProcess] = useState("");
  const load = useCallback(async () => {
    const p = new URLSearchParams({ tenantSlug });
    if (process) p.set("process", process);
    const j = await (await fetch(`/api/finance/process-logs?${p}`)).json();
    if (j.success) setRows(j.data ?? []);
  }, [tenantSlug, process]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className={`${inputCls} w-64`} placeholder="Filter by process (e.g. deferred-recognition)" value={process} onChange={(e) => setProcess(e.target.value)} />
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
          <th className="py-2 pr-3">When</th><th className="py-2 pr-3">Process</th><th className="py-2 pr-3 text-right">Items</th>
          <th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right">Duration</th><th className="py-2">Error</th>
        </tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-theme-border/60">
              <td className="py-2 pr-3 text-xs">{String(r.created_at).slice(0, 16).replace("T", " ")}</td>
              <td className="py-2 pr-3 font-mono text-xs">{r.process}</td>
              <td className="py-2 pr-3 text-right">{r.item_count ?? "—"}</td>
              <td className={`py-2 pr-3 ${r.status === "success" ? "text-emerald-400" : r.status === "failed" ? "text-rose-400" : "text-amber-400"}`}>{r.status}</td>
              <td className="py-2 pr-3 text-right font-mono text-xs">{r.duration_ms != null ? `${r.duration_ms}ms` : "—"}</td>
              <td className="py-2 text-xs text-rose-300">{r.error ?? ""}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={6} className="py-6 text-center text-theme-text-tertiary">No process runs logged yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
