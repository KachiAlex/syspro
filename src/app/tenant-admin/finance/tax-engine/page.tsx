"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Loader2, Plus, Search } from "lucide-react";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const inputCls = "rounded bg-theme-muted px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

type Tab = "templates" | "rules" | "withholding" | "shipping" | "resolve";

export default function TaxEnginePage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<any[]>([]);
  const [withholding, setWithholding] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/finance/tax-engine", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, tenantSlug }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Failed");
      setMsg("Done");
      return j.data;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const [t, w] = await Promise.all([
        fetch(`/api/finance/tax-engine?tenantSlug=${encodeURIComponent(tenantSlug)}&view=templates`).then((r) => r.json()),
        fetch(`/api/finance/tax-engine?tenantSlug=${encodeURIComponent(tenantSlug)}&view=withholding`).then((r) => r.json()),
      ]);
      if (t.success) setTemplates(t.data ?? []);
      if (w.success) setWithholding(w.data ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [tenantSlug]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tax Engine</h1>
          <p className="text-sm text-theme-text-secondary">Tax templates, resolution rules, withholding (WHT/TDS), and shipping charges.</p>
        </div>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}
      </div>

      <div className="flex gap-1 border-b border-theme-border">
        {(["templates", "rules", "withholding", "shipping", "resolve"] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null); setMsg(null); }}
            className={`px-3 py-2 text-sm capitalize ${tab === t ? "border-b-2 border-sky-500 text-sky-400" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>
            {t === "resolve" ? "Test Resolve" : t}
          </button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      {tab === "templates" && <TemplatesTab templates={templates} post={post} busy={busy} reload={load} />}
      {tab === "rules" && <RulesTab templates={templates} post={post} busy={busy} />}
      {tab === "withholding" && <WithholdingTab rows={withholding} post={post} busy={busy} reload={load} />}
      {tab === "shipping" && <ShippingTab post={post} busy={busy} />}
      {tab === "resolve" && <ResolveTab tenantSlug={tenantSlug} />}
    </div>
  );
}

function TemplatesTab({ templates, post, busy, reload }: any) {
  const [form, setForm] = useState({ name: "", direction: "sales" });
  const [lines, setLines] = useState([{ description: "VAT", rate: "7.5", accountCode: "2205" }]);
  const [itemMap, setItemMap] = useState({ item: "", taxTemplateId: "" });
  const total = lines.reduce((s, l) => s + (Number(l.rate) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="rounded border border-theme-border p-4 space-y-3">
        <div className="font-medium text-sm">New Tax Template</div>
        <div className="flex gap-2">
          <input className={`${inputCls} w-64`} placeholder="Name (e.g. VAT 7.5%)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={`${inputCls} w-40`} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
            <option value="sales">Sales</option><option value="purchase">Purchase</option><option value="both">Both</option>
          </select>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input className={`${inputCls} w-48`} placeholder="Description" value={l.description}
              onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
            <input className={`${inputCls} w-28`} placeholder="Rate %" value={l.rate}
              onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} />
            <input className={`${inputCls} w-36`} placeholder="Account code" value={l.accountCode}
              onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, accountCode: e.target.value } : x)))} />
            <button className="text-theme-text-secondary hover:text-rose-400" onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <div className="flex gap-3 items-center">
          <button className="text-xs text-sky-400" onClick={() => setLines([...lines, { description: "", rate: "", accountCode: "" }])}>+ Add line</button>
          <span className="text-xs text-theme-text-secondary">Total rate: {total}%</span>
        </div>
        <button className={btnCls} disabled={busy || !form.name || !lines.length}
          onClick={async () => {
            const r = await post({ action: "upsert-template", ...form, lines: lines.map((l) => ({ description: l.description || undefined, rate: Number(l.rate), accountCode: l.accountCode || undefined })) });
            if (r) { setForm({ name: "", direction: "sales" }); setLines([{ description: "VAT", rate: "7.5", accountCode: "2205" }]); reload(); }
          }}>
          <Plus className="h-3.5 w-3.5" /> Create Template
        </button>
      </div>

      <div className="rounded border border-theme-border p-4 space-y-3">
        <div className="font-medium text-sm">Map Item → Template</div>
        <div className="flex gap-2 items-end">
          <input className={`${inputCls} w-56`} placeholder="Item code" value={itemMap.item} onChange={(e) => setItemMap({ ...itemMap, item: e.target.value })} />
          <select className={`${inputCls} w-64`} value={itemMap.taxTemplateId} onChange={(e) => setItemMap({ ...itemMap, taxTemplateId: e.target.value })}>
            <option value="">Select template…</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className={btnCls} disabled={busy || !itemMap.item || !itemMap.taxTemplateId}
            onClick={() => post({ action: "set-item-template", ...itemMap })}>
            Map
          </button>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
          <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Direction</th><th className="py-2">Lines</th>
        </tr></thead>
        <tbody>
          {templates.map((t: any) => (
            <tr key={t.id} className="border-b border-theme-border/60">
              <td className="py-2 pr-3">{t.name}</td>
              <td className="py-2 pr-3 capitalize">{t.direction}</td>
              <td className="py-2 font-mono text-xs">{(t.lines ?? []).map((l: any) => `${l.description ?? "tax"} ${l.rate}%${l.accountCode ? ` → ${l.accountCode}` : ""}`).join(" · ")}</td>
            </tr>
          ))}
          {!templates.length && <tr><td colSpan={3} className="py-6 text-center text-theme-text-tertiary">No tax templates</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RulesTab({ templates, post, busy }: any) {
  const [form, setForm] = useState({
    name: "", priority: "0", direction: "sales", taxCategory: "", partyId: "", item: "",
    minAmount: "", maxAmount: "", taxTemplateId: "",
  });
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-theme-text-secondary">Rules decide which template applies — priority desc, then most-specific match wins.</p>
      <div className="rounded border border-theme-border p-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <input className={inputCls} placeholder="Rule name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          <select className={inputCls} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
            <option value="sales">Sales</option><option value="purchase">Purchase</option>
          </select>
          <input className={inputCls} placeholder="Tax category" value={form.taxCategory} onChange={(e) => setForm({ ...form, taxCategory: e.target.value })} />
          <input className={inputCls} placeholder="Party ID" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} />
          <input className={inputCls} placeholder="Item" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          <input className={inputCls} placeholder="Min amount" value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: e.target.value })} />
          <input className={inputCls} placeholder="Max amount" value={form.maxAmount} onChange={(e) => setForm({ ...form, maxAmount: e.target.value })} />
          <select className={inputCls} value={form.taxTemplateId} onChange={(e) => setForm({ ...form, taxTemplateId: e.target.value })}>
            <option value="">Select template…</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <button className={btnCls} disabled={busy || !form.name || !form.taxTemplateId}
          onClick={() => post({
            action: "upsert-rule", ...form, priority: Number(form.priority) || 0,
            taxCategory: form.taxCategory || undefined, partyId: form.partyId || undefined, item: form.item || undefined,
            minAmount: form.minAmount ? Number(form.minAmount) : undefined,
            maxAmount: form.maxAmount ? Number(form.maxAmount) : undefined,
          })}>
          <Plus className="h-3.5 w-3.5" /> Save Rule
        </button>
      </div>
    </div>
  );
}

function WithholdingTab({ rows, post, busy, reload }: any) {
  const [form, setForm] = useState({ name: "", accountCode: "2210" });
  const [rates, setRates] = useState([{ rate: "", singleThreshold: "", cumulativeThreshold: "" }]);
  const [calc, setCalc] = useState({ categoryId: "", partyType: "vendor", partyId: "", documentType: "bill", documentId: "", taxableAmount: "" });
  const [calcResult, setCalcResult] = useState<any>(null);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="font-medium text-sm">Withholding Categories (WHT/TDS)</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Account</th><th className="py-2">Rates</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-b border-theme-border/60">
                <td className="py-2 pr-3">{r.name}</td>
                <td className="py-2 pr-3 font-mono">{r.account_code}</td>
                <td className="py-2 font-mono text-xs">{(r.rates ?? []).map((x: any) => `${x.rate}%${x.cumulativeThreshold ? ` cum>${fmt(x.cumulativeThreshold)}` : ""}`).join(" · ")}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={3} className="py-4 text-center text-theme-text-tertiary">None</td></tr>}
          </tbody>
        </table>
        <div className="rounded border border-theme-border p-4 space-y-3">
          <div className="flex gap-2">
            <input className={`${inputCls} w-56`} placeholder="Category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className={`${inputCls} w-36`} placeholder="Account" value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })} />
          </div>
          {rates.map((r, i) => (
            <div key={i} className="flex gap-2">
              <input className={`${inputCls} w-24`} placeholder="Rate %" value={r.rate}
                onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} />
              <input className={`${inputCls} w-36`} placeholder="Single threshold" value={r.singleThreshold}
                onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, singleThreshold: e.target.value } : x)))} />
              <input className={`${inputCls} w-36`} placeholder="Cum. threshold" value={r.cumulativeThreshold}
                onChange={(e) => setRates(rates.map((x, j) => (j === i ? { ...x, cumulativeThreshold: e.target.value } : x)))} />
              <button className="text-theme-text-secondary hover:text-rose-400" onClick={() => setRates(rates.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button className="text-xs text-sky-400" onClick={() => setRates([...rates, { rate: "", singleThreshold: "", cumulativeThreshold: "" }])}>+ Add rate</button>
          <div><button className={btnCls} disabled={busy || !form.name}
            onClick={async () => {
              const r = await post({ action: "upsert-withholding", ...form, rates: rates.map((x) => ({ rate: Number(x.rate), singleThreshold: x.singleThreshold ? Number(x.singleThreshold) : undefined, cumulativeThreshold: x.cumulativeThreshold ? Number(x.cumulativeThreshold) : undefined })) });
              if (r) reload();
            }}>
            <Plus className="h-3.5 w-3.5" /> Save Category
          </button></div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="font-medium text-sm">Compute &amp; Record Withholding</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={inputCls} value={calc.categoryId} onChange={(e) => setCalc({ ...calc, categoryId: e.target.value })}>
            <option value="">Select category…</option>
            {rows.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select className={inputCls} value={calc.partyType} onChange={(e) => setCalc({ ...calc, partyType: e.target.value })}>
            <option value="vendor">Vendor</option><option value="customer">Customer</option>
          </select>
          <input className={inputCls} placeholder="Party ID" value={calc.partyId} onChange={(e) => setCalc({ ...calc, partyId: e.target.value })} />
          <select className={inputCls} value={calc.documentType} onChange={(e) => setCalc({ ...calc, documentType: e.target.value })}>
            <option value="bill">Bill</option><option value="invoice">Invoice</option>
          </select>
          <input className={inputCls} placeholder="Document ID" value={calc.documentId} onChange={(e) => setCalc({ ...calc, documentId: e.target.value })} />
          <input className={inputCls} placeholder="Taxable amount" value={calc.taxableAmount} onChange={(e) => setCalc({ ...calc, taxableAmount: e.target.value })} />
        </div>
        <button className={btnCls} disabled={busy || !calc.categoryId || !calc.partyId || !calc.documentId || !calc.taxableAmount}
          onClick={async () => { const r = await post({ action: "compute-withholding", ...calc, taxableAmount: Number(calc.taxableAmount) }); if (r) setCalcResult(r); }}>
          Compute
        </button>
        {calcResult && <pre className="rounded bg-theme-muted p-3 text-xs overflow-auto">{JSON.stringify(calcResult, null, 2)}</pre>}
      </div>
    </div>
  );
}

function ShippingTab({ post, busy }: any) {
  const [form, setForm] = useState({ name: "", minValue: "", maxValue: "", chargeType: "flat", chargeValue: "", accountCode: "" });
  const [test, setTest] = useState({ orderValue: "", weight: "" });
  const [testResult, setTestResult] = useState<any>(null);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="font-medium text-sm">New Shipping Rule</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={inputCls} value={form.chargeType} onChange={(e) => setForm({ ...form, chargeType: e.target.value })}>
            <option value="flat">Flat charge</option><option value="percent">% of order value</option>
          </select>
          <input className={inputCls} placeholder="Min order value" value={form.minValue} onChange={(e) => setForm({ ...form, minValue: e.target.value })} />
          <input className={inputCls} placeholder="Max order value" value={form.maxValue} onChange={(e) => setForm({ ...form, maxValue: e.target.value })} />
          <input className={inputCls} placeholder="Charge value" value={form.chargeValue} onChange={(e) => setForm({ ...form, chargeValue: e.target.value })} />
          <input className={inputCls} placeholder="Income account code" value={form.accountCode} onChange={(e) => setForm({ ...form, accountCode: e.target.value })} />
        </div>
        <button className={btnCls} disabled={busy || !form.name || !form.chargeValue}
          onClick={() => post({
            action: "upsert-shipping", ...form,
            minValue: form.minValue ? Number(form.minValue) : undefined,
            maxValue: form.maxValue ? Number(form.maxValue) : undefined,
            chargeValue: Number(form.chargeValue), accountCode: form.accountCode || undefined,
          })}>
          <Plus className="h-3.5 w-3.5" /> Save Rule
        </button>
      </div>
      <div className="space-y-3">
        <div className="font-medium text-sm">Test Shipping Charge</div>
        <div className="flex gap-2">
          <input className={`${inputCls} w-44`} placeholder="Order value" value={test.orderValue} onChange={(e) => setTest({ ...test, orderValue: e.target.value })} />
          <input className={`${inputCls} w-32`} placeholder="Weight (opt)" value={test.weight} onChange={(e) => setTest({ ...test, weight: e.target.value })} />
          <button className={btnCls} disabled={busy || !test.orderValue}
            onClick={async () => { const r = await post({ action: "resolve-shipping", orderValue: Number(test.orderValue), weight: test.weight ? Number(test.weight) : undefined }); if (r !== null && r !== undefined) setTestResult(r); else setTestResult(null); }}>
            <Search className="h-3.5 w-3.5" /> Resolve
          </button>
        </div>
        {testResult !== null && <pre className="rounded bg-theme-muted p-3 text-xs overflow-auto">{JSON.stringify(testResult, null, 2)}</pre>}
      </div>
    </div>
  );
}

function ResolveTab({ tenantSlug }: { tenantSlug: string }) {
  const [form, setForm] = useState({ direction: "sales", partyId: "", item: "", amount: "" });
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try {
      const p = new URLSearchParams({ tenantSlug, view: "resolve", direction: form.direction });
      if (form.partyId) p.set("partyId", form.partyId);
      if (form.item) p.set("item", form.item);
      if (form.amount) p.set("amount", form.amount);
      const j = await (await fetch(`/api/finance/tax-engine?${p}`)).json();
      if (!j.success) throw new Error(j.error);
      setResult(j.data);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-theme-text-secondary">Dry-run template resolution for a transaction context.</p>
      <div className="flex flex-wrap gap-2">
        <select className={`${inputCls} w-36`} value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
          <option value="sales">Sales</option><option value="purchase">Purchase</option>
        </select>
        <input className={`${inputCls} w-48`} placeholder="Party ID" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} />
        <input className={`${inputCls} w-48`} placeholder="Item" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
        <input className={`${inputCls} w-36`} placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <button className={btnCls} disabled={busy} onClick={run}><Search className="h-3.5 w-3.5" /> Resolve</button>
      </div>
      {error && <div className="text-rose-400 text-sm">{error}</div>}
      {result && <pre className="rounded bg-theme-muted p-3 text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
