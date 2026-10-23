"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Plus } from "lucide-react";

const fmt = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const inputCls = "rounded bg-theme-muted px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

export default function SalesPartnersPage() {
  const { tenantSlug } = useTenantContext();
  const [partners, setPartners] = useState<any[]>([]);
  const [report, setReport] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", partnerType: "agent", commissionRate: "", territory: "" });
  const [accrue, setAccrue] = useState({ invoiceId: "", partnerId: "" });

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setError(null);
    try {
      const [p, r] = await Promise.all([
        fetch(`/api/finance/partners?tenantSlug=${encodeURIComponent(tenantSlug)}&view=partners`).then((x) => x.json()),
        fetch(`/api/finance/partners?tenantSlug=${encodeURIComponent(tenantSlug)}&view=report`).then((x) => x.json()),
      ]);
      if (p.success) setPartners(p.data ?? []);
      if (r.success) setReport(r.data ?? []);
    } catch (e: any) { setError(e.message); }
  }, [tenantSlug]);
  useEffect(() => { void load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/finance/partners", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, tenantSlug }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Failed");
      setMsg("Done"); return j.data;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Sales Partners &amp; Commissions</h1>
        <p className="text-sm text-theme-text-secondary">Agents/resellers earn a % of tagged invoices — accrual and payout post through the GL.</p>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-theme-border p-4 space-y-3">
          <div className="font-medium text-sm">New Partner</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className={inputCls} value={form.partnerType} onChange={(e) => setForm({ ...form, partnerType: e.target.value })}>
              <option value="agent">Agent</option><option value="reseller">Reseller</option>
              <option value="referrer">Referrer</option><option value="distributor">Distributor</option>
            </select>
            <input className={inputCls} placeholder="Commission rate %" value={form.commissionRate} onChange={(e) => setForm({ ...form, commissionRate: e.target.value })} />
            <input className={inputCls} placeholder="Territory" value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} />
          </div>
          <button className={btnCls} disabled={busy || !form.name || !form.commissionRate}
            onClick={async () => {
              const r = await post({ action: "upsert-partner", ...form, commissionRate: Number(form.commissionRate), territory: form.territory || undefined });
              if (r) { setForm({ name: "", partnerType: "agent", commissionRate: "", territory: "" }); load(); }
            }}>
            <Plus className="h-3.5 w-3.5" /> Add Partner
          </button>
        </div>

        <div className="rounded border border-theme-border p-4 space-y-3">
          <div className="font-medium text-sm">Accrue Commission on Invoice</div>
          <div className="flex gap-2">
            <input className={`${inputCls} w-64`} placeholder="Invoice ID" value={accrue.invoiceId} onChange={(e) => setAccrue({ ...accrue, invoiceId: e.target.value })} />
            <select className={`${inputCls} w-48`} value={accrue.partnerId} onChange={(e) => setAccrue({ ...accrue, partnerId: e.target.value })}>
              <option value="">Partner…</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button className={btnCls} disabled={busy || !accrue.invoiceId || !accrue.partnerId}
              onClick={async () => { const r = await post({ action: "accrue", ...accrue }); if (r) { setAccrue({ invoiceId: "", partnerId: "" }); load(); } }}>
              Accrue
            </button>
          </div>
        </div>
      </div>

      <table className="w-full text-sm">
        <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
          <th className="py-2 pr-3">Partner</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3 text-right">Rate</th>
          <th className="py-2 pr-3 text-right">Accrued</th><th className="py-2 pr-3 text-right">Paid</th><th className="py-2">Status</th>
        </tr></thead>
        <tbody>
          {partners.map((p) => (
            <tr key={p.id} className="border-b border-theme-border/60">
              <td className="py-2 pr-3">{p.name}</td>
              <td className="py-2 pr-3 capitalize">{p.partner_type}</td>
              <td className="py-2 pr-3 text-right">{p.commission_rate}%</td>
              <td className="py-2 pr-3 text-right font-mono">{fmt(p.total_accrued)}</td>
              <td className="py-2 pr-3 text-right font-mono">{fmt(p.total_paid)}</td>
              <td className="py-2">{p.active ? "Active" : "Inactive"}</td>
            </tr>
          ))}
          {!partners.length && <tr><td colSpan={6} className="py-6 text-center text-theme-text-tertiary">No partners</td></tr>}
        </tbody>
      </table>

      <div>
        <div className="font-medium text-sm mb-2">Commission Ledger</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
            <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Partner</th><th className="py-2 pr-3">Invoice</th>
            <th className="py-2 pr-3 text-right">Invoice Amt</th><th className="py-2 pr-3 text-right">Commission</th>
            <th className="py-2 pr-3">Status</th><th className="py-2" />
          </tr></thead>
          <tbody>
            {report.map((c) => (
              <tr key={c.id} className="border-b border-theme-border/60">
                <td className="py-2 pr-3 text-xs">{String(c.created_at).slice(0, 10)}</td>
                <td className="py-2 pr-3">{c.partner_name}</td>
                <td className="py-2 pr-3 font-mono text-xs">{c.invoice_number ?? String(c.invoice_id).slice(0, 8)}</td>
                <td className="py-2 pr-3 text-right font-mono">{fmt(c.invoice_amount)}</td>
                <td className="py-2 pr-3 text-right font-mono">{fmt(c.commission_amount)}</td>
                <td className="py-2 pr-3">{c.status}</td>
                <td className="py-2 text-right">
                  {c.status === "accrued" && (
                    <button className={btnCls} disabled={busy}
                      onClick={async () => { const r = await post({ action: "pay", commissionId: c.id }); if (r) load(); }}>
                      Pay
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!report.length && <tr><td colSpan={7} className="py-6 text-center text-theme-text-tertiary">No commissions</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
