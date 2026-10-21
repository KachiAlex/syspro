"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle, Bell, CalendarClock, Link2, Loader2, Play, ScrollText, Users, X,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

type Candidate = {
  id: string; invoice_number: string; customer_name: string; customer_code: string;
  due_date: string; amount: number; balance_due: number;
  current_level: number; days_overdue: number;
};
type Notice = {
  id: string; invoice_id: string; level: number; issue_date: string;
  method: string; fee_amount: number; status: string;
};
type PaymentTerm = {
  id: string; name: string; is_default: boolean;
  terms: { days: number; portion: number }[];
};
type Customer = {
  id: string; customer_code: string; name: string; email?: string | null;
  credit_limit: number | null; credit_hold: boolean; default_currency: string | null;
};
type Statement = {
  customerCode: string; closingBalance: number; openBalance: number;
  lines: { entry_date: string; account_code: string; description: string | null; debit: number; credit: number; runningBalance: number }[];
  invoices: { id: string; invoice_number: string; issued_date: string; due_date: string; amount: number; balance_due: number; status: string }[];
};
type Invoice = { id: string; invoice_number: string; customer_name: string; balance_due: number; status: string };
type PayRequest = { id: string; invoice_id: string; provider: string; amount: number; link_url: string; status: string; created_at: string };
type PortalToken = { id: string; party_type: string; party_name: string; email: string | null; status: string; expires_at: string | null; created_at: string };

const TABS = [
  ["dunning", "Dunning", Bell], ["terms", "Payment terms", CalendarClock],
  ["customers", "Customers", Users], ["statements", "Statements", ScrollText],
  ["links", "Payment & portal links", Link2],
] as const;

export default function CreditControlPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<string>("dunning");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [openInvoices, setOpenInvoices] = useState<Invoice[]>([]);
  const [payRequests, setPayRequests] = useState<PayRequest[]>([]);
  const [tokens, setTokens] = useState<PortalToken[]>([]);
  const [statement, setStatement] = useState<Statement | null>(null);

  const [issueFor, setIssueFor] = useState<Candidate | null>(null);
  const [issueForm, setIssueForm] = useState({ method: "email", feeAmount: "0", issueDate: today() });
  const [termForm, setTermForm] = useState({ name: "", isDefault: false, parts: [{ days: "30", portion: "100" }] });
  const [custEdit, setCustEdit] = useState<Customer | null>(null);
  const [custForm, setCustForm] = useState({ creditLimit: "", creditHold: false, email: "" });
  const [stmtForm, setStmtForm] = useState({ customerCode: "", startDate: "", endDate: "" });
  const [prForm, setPrForm] = useState({ invoiceId: "", provider: "paystack", customerEmail: "" });
  const [tokForm, setTokForm] = useState({ partyType: "customer", partyName: "", email: "", expiresInDays: "30" });
  const [newLink, setNewLink] = useState<string | null>(null);

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const [cand, nts, tms, custs, invs, prs, toks] = await Promise.all([
        fetch(`/api/finance/dunning?${qs()}`).then((r) => r.json()),
        fetch(`/api/finance/dunning?${qs()}&notices=true`).then((r) => r.json()),
        fetch(`/api/finance/payment-terms?${qs()}`).then((r) => r.json()),
        fetch(`/api/finance/customers?${qs()}`).then((r) => r.json()),
        fetch(`/api/finance/invoices?${qs()}&status=sent&limit=200`).then((r) => r.json()).catch(() => ({})),
        fetch(`/api/finance/payment-requests?${qs()}`).then((r) => r.json()),
        fetch(`/api/portal?${qs()}`).then((r) => r.json()),
      ]);
      setCandidates(cand.candidates ?? []);
      setNotices(nts.notices ?? []);
      setTerms(tms.paymentTerms ?? []);
      setCustomers(custs.customers ?? []);
      setOpenInvoices((invs.invoices ?? []).filter((i: Invoice) => i.balance_due > 0));
      setPayRequests(prs.requests ?? []);
      setTokens(toks.tokens ?? []);
      if (cand.error) setError(cand.error);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const post = async (url: string, body: any, success: string, onDone?: () => void, method = "POST") => {
    setBusy(true); setError(null); setMsg(null); setNewLink(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.link_url) setNewLink(data.link_url);
      if (data.url) setNewLink(data.url);
      setMsg(success); onDone?.();
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const levelBadge = (l: number) =>
    l >= 3 ? "bg-rose-500/15 text-rose-400" : l >= 2 ? "bg-amber-500/15 text-amber-400" : "bg-sky-500/15 text-sky-400";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Credit Control &amp; Collections</h1>
            <p className="text-sm text-slate-400">Dunning, payment terms, credit limits, statements and payment links</p>
          </div>
        </div>
        {tab === "dunning" && (
          <button disabled={busy}
            onClick={() => void post(`/api/finance/dunning?${qs()}`, { action: "run", method: "email" }, "Dunning cycle complete")}
            className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50">
            <Play className="h-4 w-4" /> Run dunning cycle
          </button>
        )}
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}
      {newLink && (
        <div className="rounded bg-sky-500/10 px-4 py-3 text-sky-300 text-sm">
          Link: <span className="font-mono break-all">{newLink}</span>
          <button className="ml-3 underline" onClick={() => navigator.clipboard?.writeText(newLink)}>copy</button>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${
              tab === key ? "border-sky-400 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}

      {tab === "dunning" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Overdue invoices ({candidates.length})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  {["Invoice", "Customer", "Due", "Days overdue", "Balance", "Level", ""].map((h) => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 font-mono text-xs">{c.invoice_number}</td>
                    <td className="px-3 py-2">{c.customer_name}</td>
                    <td className="px-3 py-2">{String(c.due_date).slice(0, 10)}</td>
                    <td className={`px-3 py-2 ${c.days_overdue >= 30 ? "text-rose-400" : c.days_overdue >= 15 ? "text-amber-400" : ""}`}>
                      {c.days_overdue}
                    </td>
                    <td className="px-3 py-2">{fmt(c.balance_due)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${levelBadge(c.current_level)}`}>
                        {c.current_level ? `L${c.current_level}` : "none"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => { setIssueForm({ method: "email", feeAmount: "0", issueDate: today() }); setIssueFor(c); }}
                        className="text-xs text-sky-400 hover:underline">Issue notice</button>
                    </td>
                  </tr>
                ))}
                {candidates.length === 0 && !loading && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No overdue invoices</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Issued notices ({notices.length})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  {["Invoice", "Level", "Issued", "Method", "Fee", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notices.slice(0, 50).map((n) => (
                  <tr key={n.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 font-mono text-xs">{n.invoice_id.slice(0, 8)}…</td>
                    <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${levelBadge(n.level)}`}>L{n.level}</span></td>
                    <td className="px-3 py-2">{String(n.issue_date).slice(0, 10)}</td>
                    <td className="px-3 py-2 text-slate-400">{n.method}</td>
                    <td className="px-3 py-2">{fmt(n.fee_amount)}</td>
                    <td className="px-3 py-2 text-slate-400">{n.status}</td>
                  </tr>
                ))}
                {notices.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">No notices issued yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "terms" && (
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
            <h2 className="text-sm font-semibold">New payment term</h2>
            <div className="flex gap-2 items-end">
              <input className="flex-1 rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Name (e.g. Net 30, 50/50)"
                value={termForm.name} onChange={(e) => setTermForm({ ...termForm, name: e.target.value })} />
              <label className="flex items-center gap-1.5 text-xs text-slate-400 pb-2">
                <input type="checkbox" checked={termForm.isDefault}
                  onChange={(e) => setTermForm({ ...termForm, isDefault: e.target.checked })} /> Default
              </label>
            </div>
            {termForm.parts.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input type="number" className="w-28 rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Days"
                  value={p.days} onChange={(e) => {
                    const parts = [...termForm.parts]; parts[i] = { ...p, days: e.target.value };
                    setTermForm({ ...termForm, parts });
                  }} />
                <span className="text-xs text-slate-500">days, then</span>
                <input type="number" className="w-28 rounded bg-slate-800 px-3 py-2 text-sm" placeholder="%"
                  value={p.portion} onChange={(e) => {
                    const parts = [...termForm.parts]; parts[i] = { ...p, portion: e.target.value };
                    setTermForm({ ...termForm, parts });
                  }} />
                <span className="text-xs text-slate-500">% due</span>
                {termForm.parts.length > 1 && (
                  <button className="text-xs text-rose-400" onClick={() =>
                    setTermForm({ ...termForm, parts: termForm.parts.filter((_, j) => j !== i) })}>remove</button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <button className="text-xs text-sky-400" onClick={() =>
                setTermForm({ ...termForm, parts: [...termForm.parts, { days: "0", portion: "0" }] })}>
                + installment
              </button>
              <button disabled={busy || !termForm.name}
                onClick={() => void post(`/api/finance/payment-terms?${qs()}`, {
                  name: termForm.name, isDefault: termForm.isDefault,
                  terms: termForm.parts.map((p) => ({ days: Number(p.days), portion: Number(p.portion) })),
                }, "Payment term created")}
                className="ml-auto rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500 disabled:opacity-50">
                {busy ? "Saving…" : "Create"}
              </button>
            </div>
            <p className="text-xs text-slate-500">Portions must sum to 100%.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400">
                {["Name", "Schedule", "Default"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">{t.name}</td>
                  <td className="px-3 py-2 text-slate-400">
                    {(t.terms ?? []).map((p) => `${p.portion}% in ${p.days}d`).join(" · ")}
                  </td>
                  <td className="px-3 py-2">{t.is_default ? "✓" : ""}</td>
                </tr>
              ))}
              {terms.length === 0 && !loading && (
                <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">No payment terms defined</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "customers" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              {["Code", "Name", "Email", "Credit limit", "Hold", "Currency", ""].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">{c.customer_code}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2 text-slate-400">{c.email ?? "—"}</td>
                <td className="px-3 py-2">{c.credit_limit == null ? "∞" : fmt(c.credit_limit)}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${c.credit_hold ? "bg-rose-500/15 text-rose-400" : "bg-emerald-500/15 text-emerald-400"}`}>
                    {c.credit_hold ? "on hold" : "active"}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">{c.default_currency ?? "—"}</td>
                <td className="px-3 py-2">
                  <button onClick={() => {
                    setCustForm({ creditLimit: c.credit_limit == null ? "" : String(c.credit_limit), creditHold: c.credit_hold, email: c.email ?? "" });
                    setCustEdit(c);
                  }} className="text-xs text-sky-400 hover:underline">Edit credit</button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">No customers on record</td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "statements" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <label className="text-xs text-slate-400">Customer
              <select className="block w-56 rounded bg-slate-800 px-3 py-2 text-sm"
                value={stmtForm.customerCode} onChange={(e) => setStmtForm({ ...stmtForm, customerCode: e.target.value })}>
                <option value="">Select…</option>
                {customers.map((c) => <option key={c.customer_code} value={c.customer_code}>{c.name} ({c.customer_code})</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">From
              <input type="date" className="block rounded bg-slate-800 px-3 py-2 text-sm"
                value={stmtForm.startDate} onChange={(e) => setStmtForm({ ...stmtForm, startDate: e.target.value })} />
            </label>
            <label className="text-xs text-slate-400">To
              <input type="date" className="block rounded bg-slate-800 px-3 py-2 text-sm"
                value={stmtForm.endDate} onChange={(e) => setStmtForm({ ...stmtForm, endDate: e.target.value })} />
            </label>
            <button disabled={!stmtForm.customerCode}
              onClick={async () => {
                const params = new URLSearchParams({ tenantSlug, customerCode: stmtForm.customerCode });
                if (stmtForm.startDate) params.set("startDate", stmtForm.startDate);
                if (stmtForm.endDate) params.set("endDate", stmtForm.endDate);
                const data = await (await fetch(`/api/finance/statements?${params}`)).json();
                if (data.error) setError(data.error); else setStatement(data);
              }}
              className="rounded bg-sky-600 px-3 py-2 text-sm hover:bg-sky-500 disabled:opacity-50">Load</button>
          </div>
          {statement && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  ["Closing balance", statement.closingBalance],
                  ["Open AR", statement.openBalance],
                  ["Invoices", statement.invoices?.length ?? 0],
                ].map(([l, v]) => (
                  <div key={l as string} className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3">
                    <div className="text-xs text-slate-400">{l}</div>
                    <div className="text-lg font-semibold">{typeof v === "number" && l !== "Invoices" ? fmt(v as number) : v}</div>
                  </div>
                ))}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    {["Date", "Account", "Description", "Dr", "Cr", "Balance"].map((h) => (
                      <th key={h} className="px-3 py-2 text-right first:text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statement.lines.map((l, i) => (
                    <tr key={i} className="border-t border-slate-800">
                      <td className="px-3 py-1.5">{String(l.entry_date).slice(0, 10)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-xs">{l.account_code}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{l.description ?? ""}</td>
                      <td className="px-3 py-1.5 text-right">{l.debit ? fmt(l.debit) : ""}</td>
                      <td className="px-3 py-1.5 text-right">{l.credit ? fmt(l.credit) : ""}</td>
                      <td className="px-3 py-1.5 text-right">{fmt(l.runningBalance)}</td>
                    </tr>
                  ))}
                  {statement.lines.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">No GL movements in range</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "links" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-300">Payment requests</h2>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
              <label className="block text-xs text-slate-400">Open invoice
                <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={prForm.invoiceId} onChange={(e) => setPrForm({ ...prForm, invoiceId: e.target.value })}>
                  <option value="">Select…</option>
                  {openInvoices.map((i) => (
                    <option key={i.id} value={i.id}>{i.invoice_number} — {i.customer_name} — {fmt(i.balance_due)}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-400">Provider
                  <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                    value={prForm.provider} onChange={(e) => setPrForm({ ...prForm, provider: e.target.value })}>
                    <option value="paystack">Paystack</option><option value="flutterwave">Flutterwave</option>
                    <option value="stripe">Stripe</option><option value="manual">Manual link</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">Customer email
                  <input type="email" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                    value={prForm.customerEmail} onChange={(e) => setPrForm({ ...prForm, customerEmail: e.target.value })} />
                </label>
              </div>
              <button disabled={busy || !prForm.invoiceId}
                onClick={() => void post(`/api/finance/payment-requests?${qs()}`, {
                  invoiceId: prForm.invoiceId, provider: prForm.provider,
                  customerEmail: prForm.customerEmail || undefined,
                }, "Payment request created")}
                className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
                {busy ? "Creating…" : "Create payment link"}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  {["Provider", "Amount", "Status", "Created", ""].map((h) => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payRequests.map((p) => (
                  <tr key={p.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 capitalize">{p.provider}</td>
                    <td className="px-3 py-2">{fmt(p.amount)}</td>
                    <td className="px-3 py-2 text-slate-400">{p.status}</td>
                    <td className="px-3 py-2 text-slate-400">{String(p.created_at).slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <button className="text-xs text-sky-400 hover:underline"
                        onClick={() => { navigator.clipboard?.writeText(p.link_url); setNewLink(p.link_url); }}>
                        copy link
                      </button>
                    </td>
                  </tr>
                ))}
                {payRequests.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">No payment requests yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-300">Customer/vendor portal links</h2>
            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-slate-400">Party type
                  <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                    value={tokForm.partyType} onChange={(e) => setTokForm({ ...tokForm, partyType: e.target.value })}>
                    <option value="customer">Customer</option><option value="vendor">Vendor</option>
                  </select>
                </label>
                <label className="text-xs text-slate-400">Expires (days)
                  <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                    value={tokForm.expiresInDays} onChange={(e) => setTokForm({ ...tokForm, expiresInDays: e.target.value })} />
                </label>
              </div>
              <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Party name"
                value={tokForm.partyName} onChange={(e) => setTokForm({ ...tokForm, partyName: e.target.value })} />
              <input type="email" className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Email (optional)"
                value={tokForm.email} onChange={(e) => setTokForm({ ...tokForm, email: e.target.value })} />
              <button disabled={busy || !tokForm.partyName}
                onClick={() => void post(`/api/portal?${qs()}`, {
                  partyType: tokForm.partyType, partyName: tokForm.partyName,
                  email: tokForm.email || undefined,
                  expiresInDays: Number(tokForm.expiresInDays) || undefined,
                }, "Portal link issued")}
                className="w-full rounded bg-sky-600 py-2 text-sm hover:bg-sky-500 disabled:opacity-50">
                {busy ? "Issuing…" : "Issue portal link"}
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  {["Party", "Email", "Status", "Expires", ""].map((h) => (
                    <th key={h} className="px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} className="border-t border-slate-800">
                    <td className="px-3 py-2">{t.party_name} <span className="text-xs text-slate-500">({t.party_type})</span></td>
                    <td className="px-3 py-2 text-slate-400">{t.email ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${t.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-500/15 text-slate-400"}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{t.expires_at ? String(t.expires_at).slice(0, 10) : "never"}</td>
                    <td className="px-3 py-2">
                      {t.status === "active" && (
                        <button className="text-xs text-rose-400 hover:underline"
                          onClick={() => void post(`/api/portal?${qs()}&id=${t.id}`, {}, "Token revoked", undefined, "DELETE")}>
                          revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {tokens.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">No portal links issued</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {issueFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Issue dunning notice</h2>
              <button onClick={() => setIssueFor(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400">
              {issueFor.invoice_number} — {issueFor.customer_name}, {fmt(issueFor.balance_due)} overdue {issueFor.days_overdue}d (currently L{issueFor.current_level}).
            </p>
            <label className="block text-xs text-slate-400">Issue date
              <input type="date" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={issueForm.issueDate} onChange={(e) => setIssueForm({ ...issueForm, issueDate: e.target.value })} />
            </label>
            <label className="block text-xs text-slate-400">Method
              <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={issueForm.method} onChange={(e) => setIssueForm({ ...issueForm, method: e.target.value })}>
                <option value="email">Email</option><option value="letter">Letter</option>
                <option value="sms">SMS</option><option value="call">Phone call</option>
              </select>
            </label>
            <label className="block text-xs text-slate-400">Fee (posts to GL)
              <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={issueForm.feeAmount} onChange={(e) => setIssueForm({ ...issueForm, feeAmount: e.target.value })} />
            </label>
            <button disabled={busy}
              onClick={() => void post(`/api/finance/dunning?${qs()}`, {
                action: "issue", invoiceId: issueFor.id, method: issueForm.method,
                feeAmount: Number(issueForm.feeAmount) || undefined, issueDate: issueForm.issueDate,
              }, "Notice issued", () => setIssueFor(null))}
              className="w-full rounded bg-sky-600 py-2 text-sm hover:bg-sky-500 disabled:opacity-50">
              {busy ? "Issuing…" : "Issue notice"}
            </button>
          </div>
        </div>
      )}

      {custEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Credit — {custEdit.name}</h2>
              <button onClick={() => setCustEdit(null)}><X className="h-4 w-4" /></button>
            </div>
            <label className="block text-xs text-slate-400">Contact email (invoices, receipts, dunning)
              <input type="email" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} />
            </label>
            <label className="block text-xs text-slate-400">Credit limit (blank = unlimited)
              <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={custForm.creditLimit} onChange={(e) => setCustForm({ ...custForm, creditLimit: e.target.value })} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={custForm.creditHold}
                onChange={(e) => setCustForm({ ...custForm, creditHold: e.target.checked })} />
              Credit hold — blocks new invoice issuance
            </label>
            <button disabled={busy}
              onClick={() => void post(`/api/finance/customers?${qs()}`, {
                customerCode: custEdit.customer_code, name: custEdit.name,
                email: custForm.email || null,
                creditLimit: custForm.creditLimit ? Number(custForm.creditLimit) : null,
                creditHold: custForm.creditHold,
              }, "Customer credit updated", () => setCustEdit(null))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
