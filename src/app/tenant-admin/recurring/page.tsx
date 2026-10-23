"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle, Loader2, Pause, Play, Plus, Repeat, X,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

type Template = {
  id: string; customerName: string; customerCode: string | null;
  frequency: string; nextRunDate: string; endDate: string | null; status: string;
  template: { lineItems: { description: string; quantity: number; unitPrice: number; taxRate?: number }[]; currency?: string; paymentTerms?: string; notes?: string };
};

const emptyLine = () => ({ description: "", quantity: "1", unitPrice: "", taxRate: "" });

export default function RecurringPage() {
  const { tenantSlug } = useTenantContext();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    customerName: "", customerCode: "", frequency: "monthly",
    startDate: today(), endDate: "", paymentTerms: "", notes: "",
  });
  const [lines, setLines] = useState([emptyLine()]);

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const params = qs() + (statusFilter ? `&status=${statusFilter}` : "");
      const data = await (await fetch(`/api/finance/recurring-invoices?${params}`)).json();
      setTemplates(data.templates ?? []);
      if (data.error) setError(data.error);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, statusFilter]);

  const post = async (body: any, success: string, onDone?: () => void, method = "POST") => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(`/api/finance/recurring-invoices?${qs()}`, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMsg(success); onDone?.();
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const templateTotal = (t: Template) =>
    (t.template?.lineItems ?? []).reduce((s, l) => s + l.quantity * l.unitPrice * (1 + (l.taxRate ?? 0) / 100), 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Repeat className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Recurring Invoices</h1>
            <p className="text-sm text-theme-text-secondary">Subscription-style billing — generate invoices on a schedule</p>
          </div>
        </div>
        <div className="flex gap-2">
          <select className="rounded bg-theme-muted px-3 py-1.5 text-sm"
            value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option>
          </select>
          <button disabled={busy}
            onClick={() => void post({ action: "generate", asOfDate: today() }, "Due invoices generated")}
            className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50">
            <Play className="h-4 w-4" /> Generate due now
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
            <Plus className="h-4 w-4" /> New template
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-theme-text-secondary">
            {["Customer", "Lines", "Amount", "Frequency", "Next run", "Ends", "Status", ""].map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {templates.map((t) => (
            <tr key={t.id} className="border-t border-theme-border">
              <td className="px-3 py-2">{t.customerName}
                {t.customerCode && <span className="ml-2 text-xs font-mono text-theme-text-tertiary">{t.customerCode}</span>}
              </td>
              <td className="px-3 py-2 text-theme-text-secondary">{t.template?.lineItems?.length ?? 0} line(s)</td>
              <td className="px-3 py-2">{fmt(templateTotal(t))} <span className="text-xs text-theme-text-tertiary">{t.template?.currency ?? ""}</span></td>
              <td className="px-3 py-2 capitalize">{t.frequency}</td>
              <td className="px-3 py-2">{String(t.nextRunDate).slice(0, 10)}</td>
              <td className="px-3 py-2 text-theme-text-secondary">{t.endDate ? String(t.endDate).slice(0, 10) : "—"}</td>
              <td className="px-3 py-2">
                <span className={`rounded px-2 py-0.5 text-xs ${
                  t.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                  : t.status === "paused" ? "bg-amber-500/15 text-amber-400" : "bg-theme-muted/15 text-theme-text-secondary"}`}>
                  {t.status}
                </span>
              </td>
              <td className="px-3 py-2">
                {t.status === "active" && (
                  <button disabled={busy}
                    onClick={() => void post({ id: t.id, status: "paused" }, "Template paused", undefined, "PATCH")}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:underline">
                    <Pause className="h-3 w-3" /> Pause
                  </button>
                )}
                {t.status === "paused" && (
                  <button disabled={busy}
                    onClick={() => void post({ id: t.id, status: "active" }, "Template resumed", undefined, "PATCH")}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:underline">
                    <Play className="h-3 w-3" /> Resume
                  </button>
                )}
              </td>
            </tr>
          ))}
          {templates.length === 0 && !loading && (
            <tr><td colSpan={8} className="px-3 py-6 text-center text-theme-text-tertiary">
              No recurring templates — create one to auto-bill customers on a schedule.
            </td></tr>
          )}
        </tbody>
      </table>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New recurring template</h2>
              <button onClick={() => setShowNew(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="col-span-2 rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Customer name"
                value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
              <input className="rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Customer code (optional)"
                value={form.customerCode} onChange={(e) => setForm({ ...form, customerCode: e.target.value })} />
              <select className="rounded bg-theme-muted px-3 py-2 text-sm"
                value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                <option value="daily">Daily</option><option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
              <label className="text-xs text-theme-text-secondary">Start (first run)
                <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </label>
              <label className="text-xs text-theme-text-secondary">End (optional)
                <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </label>
            </div>

            <h3 className="text-xs font-semibold text-theme-text-primary pt-1">Invoice lines</h3>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_64px_96px_72px_24px] gap-2 items-center">
                <input className="rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Description"
                  value={l.description} onChange={(e) => {
                    const ls = [...lines]; ls[i] = { ...l, description: e.target.value }; setLines(ls);
                  }} />
                <input type="number" className="rounded bg-theme-muted px-2 py-2 text-sm" placeholder="Qty"
                  value={l.quantity} onChange={(e) => {
                    const ls = [...lines]; ls[i] = { ...l, quantity: e.target.value }; setLines(ls);
                  }} />
                <input type="number" className="rounded bg-theme-muted px-2 py-2 text-sm" placeholder="Price"
                  value={l.unitPrice} onChange={(e) => {
                    const ls = [...lines]; ls[i] = { ...l, unitPrice: e.target.value }; setLines(ls);
                  }} />
                <input type="number" className="rounded bg-theme-muted px-2 py-2 text-sm" placeholder="Tax %"
                  value={l.taxRate} onChange={(e) => {
                    const ls = [...lines]; ls[i] = { ...l, taxRate: e.target.value }; setLines(ls);
                  }} />
                {lines.length > 1 ? (
                  <button className="text-rose-400" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    <X className="h-4 w-4" />
                  </button>
                ) : <span />}
              </div>
            ))}
            <button className="text-xs text-sky-400" onClick={() => setLines([...lines, emptyLine()])}>
              + add line
            </button>
            <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Payment terms / notes (optional)"
              value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} />

            <button
              disabled={busy || !form.customerName || lines.some((l) => !l.description || !Number(l.unitPrice))}
              onClick={() => void post({
                customerName: form.customerName, customerCode: form.customerCode || undefined,
                frequency: form.frequency, startDate: form.startDate,
                endDate: form.endDate || undefined,
                template: {
                  lineItems: lines.map((l) => ({
                    description: l.description, quantity: Number(l.quantity),
                    unitPrice: Number(l.unitPrice), taxRate: l.taxRate ? Number(l.taxRate) : undefined,
                  })),
                  paymentTerms: form.paymentTerms || undefined,
                },
              }, "Recurring template created", () => setShowNew(false))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Creating…" : "Create template"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
