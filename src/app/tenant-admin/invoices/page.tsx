"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle, Loader2, Plus, Search, Send, Wallet, X } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import CreateInvoiceModal from "../components/CreateInvoiceModal";

type Invoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issuedDate: string;
  dueDate: string;
  currency: string;
  amount: number;
  balanceDue: number;
  status: string;
};

const PAY_METHODS = ["bank_transfer", "cash", "check", "pos", "mobile_money", "wire"] as const;
const STATUS_TABS: Array<[string, string]> = [
  ["all", "All"],
  ["draft", "Draft"],
  ["sent", "Sent"],
  ["partially_paid", "Partially paid"],
  ["overdue", "Overdue"],
  ["paid", "Paid"],
  ["void", "Void"],
];
const STATUS_CLS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  partially_paid: "bg-amber-100 text-amber-800",
  overdue: "bg-rose-100 text-rose-800",
  paid: "bg-green-100 text-green-800",
  void: "bg-theme-muted text-theme-text-secondary",
};

const today = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const errText = (body: any, fallback: string) => (typeof body?.error === "string" ? body.error : body?.details ?? fallback);

/** Overdue is derived: an open invoice past its due date, even if not yet flagged. */
const effectiveStatus = (inv: Invoice) =>
  inv.status !== "draft" && inv.status !== "void" && inv.status !== "paid" && inv.balanceDue > 0 && inv.dueDate < today()
    ? "overdue"
    : inv.status;

export default function InvoicesPage() {
  const { tenantSlug } = useTenantContext();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "bank_transfer", paymentDate: today(), reference: "" });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/invoices?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=100`);
      const data = await res.json();
      if (!res.ok) throw new Error(errText(data, "Failed to load invoices"));
      setInvoices(data.invoices ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [tenantSlug]);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, []);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 4000); };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const inv of invoices) {
      const s = effectiveStatus(inv);
      c[s] = (c[s] ?? 0) + 1;
      c.all = (c.all ?? 0) + 1;
    }
    return c;
  }, [invoices]);

  const summary = useMemo(() => {
    const open = invoices.filter((i) => i.status !== "draft" && i.status !== "void");
    return {
      outstanding: open.reduce((s, i) => s + Number(i.balanceDue || 0), 0),
      drafts: invoices.filter((i) => i.status === "draft").length,
      overdue: invoices.filter((i) => effectiveStatus(i) === "overdue").length,
      collected: open.reduce((s, i) => s + (Number(i.amount || 0) - Number(i.balanceDue || 0)), 0),
    };
  }, [invoices]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (filter !== "all" && effectiveStatus(inv) !== filter) return false;
      if (!q) return true;
      return inv.invoiceNumber.toLowerCase().includes(q) || inv.customerName.toLowerCase().includes(q);
    });
  }, [invoices, filter, query]);

  const issue = async (inv: Invoice) => {
    setBusyId(inv.id);
    setError(null);
    try {
      const res = await fetch(`/api/finance/invoices/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, status: "sent" }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 202) flash(`${inv.invoiceNumber} sent for approval`);
      else if (!res.ok) throw new Error(errText(body, "Failed to issue invoice"));
      else flash(`${inv.invoiceNumber} issued`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const openPayment = (inv: Invoice) => {
    setPayFor(inv);
    setPayForm({ amount: String(inv.balanceDue), method: "bank_transfer", paymentDate: today(), reference: "" });
  };

  const recordPayment = async () => {
    if (!payFor) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/finance/invoices/${payFor.id}/receive-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          invoiceId: payFor.id,
          amount: Number(payForm.amount),
          method: payForm.method,
          paymentDate: payForm.paymentDate,
          reference: payForm.reference || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) throw new Error(body.error ?? "Failed to record payment");
      setPayFor(null);
      flash(`Payment recorded against ${payFor.invoiceNumber}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const createInvoice = async (data: any) => {
    const res = await fetch("/api/finance/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, tenantSlug }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 202) throw new Error(errText(body, "Failed to create invoice"));
    flash(res.status === 202 ? "Invoice saved as draft and sent for approval" : "Invoice created");
    await load();
  };

  const canIssue = (inv: Invoice) => inv.status === "draft";
  const canPay = (inv: Invoice) => ["sent", "partially_paid", "overdue"].includes(effectiveStatus(inv)) && inv.balanceDue > 0;
  const inputCls = "w-full rounded-lg border border-theme-border px-3 py-2 text-sm";
  const labelCls = "block text-xs font-medium text-theme-text-secondary mb-1";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-theme-text-primary">Invoices</h1>
          <p className="text-sm text-theme-text-secondary">
            Create invoices, issue them to the ledger, and record customer payments. Drafts from sales orders appear here too.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New invoice
        </button>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          <CheckCircle className="h-4 w-4" /> {notice}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Outstanding", money(summary.outstanding)],
          ["Collected", money(summary.collected)],
          ["Drafts", String(summary.drafts)],
          ["Overdue", String(summary.overdue)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-theme-border bg-theme-surface p-4">
            <p className="text-xs text-theme-text-secondary">{label}</p>
            <p className="mt-1 text-lg font-semibold text-theme-text-primary">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === key ? "bg-theme-accent text-white" : "bg-theme-muted text-theme-text-secondary hover:text-theme-text-primary"
              }`}
            >
              {label} {counts[key] ? `(${counts[key]})` : ""}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-theme-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search invoice # or customer"
            className="rounded-lg border border-theme-border py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-theme-border bg-theme-surface shadow-sm">
        <table className="w-full">
          <thead className="border-b border-theme-border bg-theme-muted">
            <tr>
              {["Invoice #", "Customer", "Issued", "Due", "Amount", "Balance", "Status", "Actions"].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase text-theme-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-theme-text-secondary"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            )}
            {!loading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-theme-text-secondary">
                  {invoices.length === 0
                    ? "No invoices yet. Create one, or fulfil a sales order to draft one automatically."
                    : "No invoices match this filter."}
                </td>
              </tr>
            )}
            {!loading && visible.map((inv) => {
              const status = effectiveStatus(inv);
              return (
                <tr key={inv.id} className="hover:bg-theme-muted">
                  <td className="px-4 py-2.5 text-sm font-medium text-theme-text-primary">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2.5 text-sm text-theme-text-primary">{inv.customerName}</td>
                  <td className="px-4 py-2.5 text-xs text-theme-text-secondary">{String(inv.issuedDate).slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-xs text-theme-text-secondary">{String(inv.dueDate).slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-sm">{money(inv.amount)}</td>
                  <td className="px-4 py-2.5 text-sm">{money(inv.balanceDue)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLS[status] ?? "bg-theme-muted"}`}>
                      {status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-3">
                      {canIssue(inv) && (
                        <button
                          onClick={() => issue(inv)}
                          disabled={busyId === inv.id}
                          className="inline-flex items-center gap-1 text-xs font-medium text-theme-accent hover:underline disabled:opacity-50"
                        >
                          {busyId === inv.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Issue
                        </button>
                      )}
                      {canPay(inv) && (
                        <button
                          onClick={() => openPayment(inv)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-theme-accent hover:underline"
                        >
                          <Wallet className="h-3 w-3" /> Record payment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {payFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setPayFor(null)}>
          <div className="w-full max-w-md rounded-2xl border border-theme-border bg-theme-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-theme-text-primary">Record payment — {payFor.invoiceNumber}</h3>
              <button onClick={() => setPayFor(null)} className="text-theme-text-secondary hover:text-theme-text-primary"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-4 text-xs text-theme-text-secondary">Balance due {money(payFor.balanceDue)} · {payFor.customerName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Amount</label>
                <input type="number" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm({ ...payForm, paymentDate: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Method</label>
                <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className={inputCls}>
                  {PAY_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Reference</label>
                <input value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} className={inputCls} placeholder="optional" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setPayFor(null)} disabled={saving} className="px-4 py-2 text-sm text-theme-text-secondary hover:text-theme-text-primary">Cancel</button>
              <button
                onClick={recordPayment}
                disabled={saving || !(Number(payForm.amount) > 0)}
                className="rounded-lg bg-theme-accent px-5 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Recording…" : "Record payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      <CreateInvoiceModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSubmit={createInvoice} />
    </div>
  );
}
