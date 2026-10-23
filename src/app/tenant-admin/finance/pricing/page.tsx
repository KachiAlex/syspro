"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Loader2, Plus, Search } from "lucide-react";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const inputCls = "rounded bg-theme-muted px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

type Tab = "rules" | "schemes" | "coupons" | "resolve";

export default function PricingPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/finance/pricing", {
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
      const j = await (await fetch(`/api/finance/pricing?tenantSlug=${encodeURIComponent(tenantSlug)}&view=rules`)).json();
      if (j.success === false) throw new Error(j.error);
      setRules(j.data ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [tenantSlug]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pricing Engine</h1>
          <p className="text-sm text-theme-text-secondary">Pricing rules, promotional schemes, coupons, and price resolution.</p>
        </div>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}
      </div>

      <div className="flex gap-1 border-b border-theme-border">
        {(["rules", "schemes", "coupons", "resolve"] as Tab[]).map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(null); setMsg(null); }}
            className={`px-3 py-2 text-sm capitalize ${tab === t ? "border-b-2 border-sky-500 text-sky-400" : "text-theme-text-secondary hover:text-theme-text-primary"}`}>
            {t === "resolve" ? "Test Resolve" : t}
          </button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      {tab === "rules" && <RulesTab rules={rules} post={post} busy={busy} reload={load} />}
      {tab === "schemes" && <SchemesTab post={post} busy={busy} />}
      {tab === "coupons" && <CouponsTab post={post} busy={busy} />}
      {tab === "resolve" && <ResolveTab tenantSlug={tenantSlug} />}
    </div>
  );
}

function RulesTab({ rules, post, busy, reload }: any) {
  const [form, setForm] = useState({
    name: "", priority: "0", item: "", itemCategory: "", partyType: "", partyId: "",
    minQty: "", validFrom: "", validTo: "", mode: "discount_pct", value: "",
  });
  const submit = async () => {
    const r = await post({
      action: "upsert-rule", ...form,
      priority: Number(form.priority) || 0,
      item: form.item || undefined, itemCategory: form.itemCategory || undefined,
      partyType: form.partyType || undefined, partyId: form.partyId || undefined,
      minQty: form.minQty ? Number(form.minQty) : undefined,
      validFrom: form.validFrom || undefined, validTo: form.validTo || undefined,
      value: Number(form.value),
    });
    if (r) { setForm({ name: "", priority: "0", item: "", itemCategory: "", partyType: "", partyId: "", minQty: "", validFrom: "", validTo: "", mode: "discount_pct", value: "" }); reload(); }
  };
  return (
    <div className="space-y-4">
      <div className="rounded border border-theme-border p-4 space-y-3">
        <div className="font-medium text-sm">New Pricing Rule</div>
        <div className="grid gap-2 sm:grid-cols-4">
          <input className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} placeholder="Priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
          <select className={inputCls} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            <option value="discount_pct">Discount %</option><option value="price">Fixed price</option><option value="margin">Margin % on cost</option>
          </select>
          <input className={inputCls} placeholder="Value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          <input className={inputCls} placeholder="Item (blank = all)" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
          <input className={inputCls} placeholder="Item category" value={form.itemCategory} onChange={(e) => setForm({ ...form, itemCategory: e.target.value })} />
          <select className={inputCls} value={form.partyType} onChange={(e) => setForm({ ...form, partyType: e.target.value })}>
            <option value="">Any party</option><option value="customer">Customer</option><option value="customer_group">Customer group</option>
          </select>
          <input className={inputCls} placeholder="Party ID" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} />
          <input className={inputCls} placeholder="Min qty" value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} />
          <input className={inputCls} type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
          <input className={inputCls} type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
        </div>
        <button className={btnCls} disabled={busy || !form.name || !form.value} onClick={submit}>
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
          <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Pri</th><th className="py-2 pr-3">Scope</th>
          <th className="py-2 pr-3">Mode</th><th className="py-2 pr-3 text-right">Value</th><th className="py-2">Valid</th>
        </tr></thead>
        <tbody>
          {rules.map((r: any) => (
            <tr key={r.id} className="border-b border-theme-border/60">
              <td className="py-2 pr-3">{r.name}</td>
              <td className="py-2 pr-3">{r.priority}</td>
              <td className="py-2 pr-3 text-xs text-theme-text-secondary">
                {[r.item, r.item_category, r.party_id].filter(Boolean).join(" · ") || "Global"}
                {r.min_qty ? ` · qty ≥ ${r.min_qty}` : ""}
              </td>
              <td className="py-2 pr-3">{r.mode}</td>
              <td className="py-2 pr-3 text-right font-mono">{r.mode === "price" ? fmt(r.value) : `${r.value}%`}</td>
              <td className="py-2 text-xs text-theme-text-secondary">
                {r.valid_from ? String(r.valid_from).slice(0, 10) : "…"} → {r.valid_to ? String(r.valid_to).slice(0, 10) : "…"}
              </td>
            </tr>
          ))}
          {!rules.length && <tr><td colSpan={6} className="py-6 text-center text-theme-text-tertiary">No pricing rules</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SchemesTab({ post, busy }: any) {
  const [form, setForm] = useState({ name: "", validFrom: "", validTo: "" });
  const [rulesJson, setRulesJson] = useState('[{ "item": "ITEM-1", "minQty": 5, "discountPct": 10 }]');
  const [parseErr, setParseErr] = useState<string | null>(null);
  const submit = async () => {
    let rules: any[];
    try { rules = JSON.parse(rulesJson); setParseErr(null); }
    catch { setParseErr("Invalid JSON"); return; }
    await post({ action: "upsert-scheme", name: form.name, rules, validFrom: form.validFrom || undefined, validTo: form.validTo || undefined });
  };
  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-theme-text-secondary">
        Promotional schemes — bundles of rules: <code className="font-mono">item, minQty, discountPct, freeItem, freeQty</code>
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Scheme name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className={inputCls} type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
        <input className={inputCls} type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
      </div>
      <textarea className={`${inputCls} h-32 font-mono`} value={rulesJson} onChange={(e) => setRulesJson(e.target.value)} />
      {parseErr && <div className="text-rose-400 text-sm">{parseErr}</div>}
      <button className={btnCls} disabled={busy || !form.name} onClick={submit}><Plus className="h-3.5 w-3.5" /> Save Scheme</button>
    </div>
  );
}

function CouponsTab({ post, busy }: any) {
  const [form, setForm] = useState({ code: "", description: "", discountType: "percent", discountValue: "", minOrderValue: "", validTo: "", maxUses: "" });
  const [redeem, setRedeem] = useState({ code: "", orderValue: "" });
  const [redeemResult, setRedeemResult] = useState<any>(null);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div className="font-medium text-sm">New Coupon</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={inputCls} placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className={inputCls} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className={inputCls} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
            <option value="percent">Percent</option><option value="fixed">Fixed amount</option>
          </select>
          <input className={inputCls} placeholder="Discount value" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} />
          <input className={inputCls} placeholder="Min order value" value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} />
          <input className={inputCls} type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
          <input className={inputCls} placeholder="Max uses" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
        </div>
        <button className={btnCls} disabled={busy || !form.code || !form.discountValue}
          onClick={() => post({
            action: "upsert-coupon", code: form.code, description: form.description || undefined,
            discountType: form.discountType, discountValue: Number(form.discountValue),
            minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : undefined,
            validTo: form.validTo || undefined, maxUses: form.maxUses ? Number(form.maxUses) : undefined,
          })}>
          <Plus className="h-3.5 w-3.5" /> Create Coupon
        </button>
      </div>
      <div className="space-y-3">
        <div className="font-medium text-sm">Test Redemption</div>
        <div className="flex gap-2">
          <input className={`${inputCls} w-40`} placeholder="Code" value={redeem.code} onChange={(e) => setRedeem({ ...redeem, code: e.target.value })} />
          <input className={`${inputCls} w-40`} placeholder="Order value" value={redeem.orderValue} onChange={(e) => setRedeem({ ...redeem, orderValue: e.target.value })} />
          <button className={btnCls} disabled={busy || !redeem.code || !redeem.orderValue}
            onClick={async () => { const r = await post({ action: "redeem-coupon", code: redeem.code, orderValue: Number(redeem.orderValue) }); if (r) setRedeemResult(r); }}>
            Redeem
          </button>
        </div>
        {redeemResult && <pre className="rounded bg-theme-muted p-3 text-xs overflow-auto">{JSON.stringify(redeemResult, null, 2)}</pre>}
      </div>
    </div>
  );
}

function ResolveTab({ tenantSlug }: { tenantSlug: string }) {
  const [form, setForm] = useState({ item: "", itemCategory: "", qty: "", partyId: "", basePrice: "", unitCost: "" });
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try {
      const p = new URLSearchParams({ tenantSlug, view: "resolve", item: form.item, basePrice: form.basePrice });
      if (form.itemCategory) p.set("itemCategory", form.itemCategory);
      if (form.qty) p.set("qty", form.qty);
      if (form.partyId) p.set("partyId", form.partyId);
      if (form.unitCost) p.set("unitCost", form.unitCost);
      const j = await (await fetch(`/api/finance/pricing?${p}`)).json();
      if (!j.success) throw new Error(j.error);
      setResult(j.data);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 max-w-2xl">
      <p className="text-sm text-theme-text-secondary">Dry-run the pricing engine — which rule wins and the resulting price.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Item" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
        <input className={inputCls} placeholder="Item category" value={form.itemCategory} onChange={(e) => setForm({ ...form, itemCategory: e.target.value })} />
        <input className={inputCls} placeholder="Qty" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
        <input className={inputCls} placeholder="Party ID" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })} />
        <input className={inputCls} placeholder="Base price" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
        <input className={inputCls} placeholder="Unit cost (for margin rules)" value={form.unitCost} onChange={(e) => setForm({ ...form, unitCost: e.target.value })} />
      </div>
      <button className={btnCls} disabled={busy || !form.item || !form.basePrice} onClick={run}><Search className="h-3.5 w-3.5" /> Resolve</button>
      {error && <div className="text-rose-400 text-sm">{error}</div>}
      {result && (
        <div className="rounded border border-theme-border p-4">
          <div className="text-2xl font-mono">{fmt(result.price)}</div>
          <div className="text-sm text-theme-text-secondary">Rule: {result.rule ?? "none (base price)"} · Mode: {result.mode ?? "—"}</div>
        </div>
      )}
    </div>
  );
}
