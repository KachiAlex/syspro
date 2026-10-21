"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Loader2, Play, Plus } from "lucide-react";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

type Tab = "payment-orders" | "modes" | "distributions" | "cc-allocations" | "opening-import" | "statements" | "unreconcile";

const TABS: { key: Tab; label: string }[] = [
  { key: "payment-orders", label: "Payment Orders" },
  { key: "modes", label: "Modes of Payment" },
  { key: "distributions", label: "Monthly Distributions" },
  { key: "cc-allocations", label: "Cost Center Allocations" },
  { key: "opening-import", label: "Opening Balances" },
  { key: "statements", label: "Statement Runs" },
  { key: "unreconcile", label: "Unreconcile" },
];

const inputCls = "rounded bg-slate-800 px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

export default function FinanceToolsPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<Tab>("payment-orders");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/finance/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, tenantSlug }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || "Failed");
      setMsg("Done");
      return j.data;
    } catch (e: any) { setError(e.message); return null; }
    finally { setBusy(false); }
  };

  const listViews: Tab[] = ["payment-orders", "modes", "distributions", "cc-allocations"];
  const load = useCallback(async () => {
    if (!tenantSlug || !listViews.includes(tab)) { setRows([]); return; }
    setLoading(true); setError(null);
    try {
      const j = await (await fetch(`/api/finance/tools?${qs()}&view=${tab}`)).json();
      if (j.success === false) throw new Error(j.error);
      setRows(j.data ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, tab]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Finance Tools</h1>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}
      </div>

      <div className="flex gap-1 border-b border-slate-800 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setMsg(null); setError(null); }}
            className={`px-3 py-2 text-sm whitespace-nowrap ${tab === t.key ? "border-b-2 border-sky-500 text-sky-400" : "text-slate-400 hover:text-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      {tab === "payment-orders" && <PaymentOrdersTab rows={rows} post={post} busy={busy} reload={load} />}
      {tab === "modes" && <ModesTab rows={rows} post={post} busy={busy} reload={load} />}
      {tab === "distributions" && <DistributionsTab rows={rows} post={post} busy={busy} reload={load} />}
      {tab === "cc-allocations" && <CcAllocationsTab rows={rows} post={post} busy={busy} reload={load} />}
      {tab === "opening-import" && <OpeningImportTab post={post} busy={busy} />}
      {tab === "statements" && <StatementsTab post={post} busy={busy} />}
      {tab === "unreconcile" && <UnreconcileTab post={post} busy={busy} />}
    </div>
  );
}

function PaymentOrdersTab({ rows, post, busy, reload }: any) {
  const [form, setForm] = useState({ name: "", paymentDate: "", method: "", billIds: "" });
  const submit = async () => {
    const items = form.billIds.split(",").map((s) => s.trim()).filter(Boolean).map((billId) => ({ billId }));
    if (!items.length) return;
    const r = await post({ action: "create-payment-order", name: form.name, paymentDate: form.paymentDate, method: form.method || undefined, items });
    if (r) { setForm({ name: "", paymentDate: "", method: "", billIds: "" }); reload(); }
  };
  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-800 p-4 space-y-3">
        <div className="font-medium text-sm">New Payment Order</div>
        <div className="grid gap-2 sm:grid-cols-4">
          <input className={inputCls} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className={inputCls} type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
          <input className={inputCls} placeholder="Method (optional)" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} />
          <input className={inputCls} placeholder="Bill IDs (comma-separated)" value={form.billIds} onChange={(e) => setForm({ ...form, billIds: e.target.value })} />
        </div>
        <button className={btnCls} disabled={busy || !form.name || !form.paymentDate || !form.billIds} onClick={submit}>
          <Plus className="h-3.5 w-3.5" /> Create
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-400 border-b border-slate-800">
          <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3 text-right">Total</th><th className="py-2" />
        </tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-b border-slate-800/60">
              <td className="py-2 pr-3">{r.name}</td>
              <td className="py-2 pr-3">{String(r.payment_date ?? "").slice(0, 10)}</td>
              <td className="py-2 pr-3">{r.status}</td>
              <td className="py-2 pr-3 text-right font-mono">{fmt(r.total_amount)}</td>
              <td className="py-2 text-right">
                {r.status === "draft" && (
                  <button className={btnCls} disabled={busy}
                    onClick={async () => { const x = await post({ action: "process-payment-order", paymentOrderId: r.id }); if (x) reload(); }}>
                    <Play className="h-3.5 w-3.5" /> Process
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="py-6 text-center text-slate-500">No payment orders</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ModesTab({ rows, post, busy, reload }: any) {
  const [form, setForm] = useState({ name: "", type: "bank", defaultAccountCode: "" });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end rounded border border-slate-800 p-4">
        <input className={`${inputCls} w-48`} placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className={`${inputCls} w-36`} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          <option value="bank">Bank</option><option value="cash">Cash</option><option value="card">Card</option><option value="other">Other</option>
        </select>
        <input className={`${inputCls} w-40`} placeholder="Default acct code" value={form.defaultAccountCode} onChange={(e) => setForm({ ...form, defaultAccountCode: e.target.value })} />
        <button className={btnCls} disabled={busy || !form.name}
          onClick={async () => { const r = await post({ action: "upsert-mop", ...form, defaultAccountCode: form.defaultAccountCode || undefined }); if (r) { setForm({ name: "", type: "bank", defaultAccountCode: "" }); reload(); } }}>
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-400 border-b border-slate-800"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Default Account</th><th className="py-2">Enabled</th></tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-b border-slate-800/60">
              <td className="py-2 pr-3">{r.name}</td><td className="py-2 pr-3">{r.type}</td>
              <td className="py-2 pr-3 font-mono">{r.default_account_code ?? "—"}</td>
              <td className="py-2">{r.enabled ? "Yes" : "No"}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={4} className="py-6 text-center text-slate-500">No modes of payment</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function DistributionsTab({ rows, post, busy, reload }: any) {
  const [name, setName] = useState("");
  const [pcts, setPcts] = useState(Array(12).fill(""));
  const total = pcts.reduce((s, v) => s + (Number(v) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-800 p-4 space-y-3">
        <div className="font-medium text-sm">New Distribution <span className="text-slate-400 font-normal">(12 monthly percentages, must total 100)</span></div>
        <input className={`${inputCls} w-64`} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-6 gap-2">
          {pcts.map((v, i) => (
            <input key={i} className={inputCls} placeholder={`M${i + 1}`} value={v}
              onChange={(e) => setPcts(pcts.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
        </div>
        <div className="text-xs text-slate-400">Total: {total}%</div>
        <button className={btnCls} disabled={busy || !name || total !== 100}
          onClick={async () => { const r = await post({ action: "upsert-distribution", name, percentages: pcts.map(Number) }); if (r) { setName(""); setPcts(Array(12).fill("")); reload(); } }}>
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-400 border-b border-slate-800"><th className="py-2 pr-3">Name</th><th className="py-2">Percentages</th></tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} className="border-b border-slate-800/60">
              <td className="py-2 pr-3">{r.name}</td>
              <td className="py-2 font-mono text-xs">{(r.percentages ?? []).join(" / ")}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={2} className="py-6 text-center text-slate-500">No distributions</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function CcAllocationsTab({ rows, post, busy, reload }: any) {
  const [form, setForm] = useState({ mainCostCenter: "", lines: [{ costCenterId: "", percentage: "" }] });
  const total = form.lines.reduce((s, l) => s + (Number(l.percentage) || 0), 0);
  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-800 p-4 space-y-3">
        <div className="font-medium text-sm">New Allocation <span className="text-slate-400 font-normal">(child percentages must total 100)</span></div>
        <input className={`${inputCls} w-64`} placeholder="Main cost center" value={form.mainCostCenter} onChange={(e) => setForm({ ...form, mainCostCenter: e.target.value })} />
        {form.lines.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input className={`${inputCls} w-56`} placeholder="Cost center ID" value={l.costCenterId}
              onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, costCenterId: e.target.value } : x)) })} />
            <input className={`${inputCls} w-28`} placeholder="%" value={l.percentage}
              onChange={(e) => setForm({ ...form, lines: form.lines.map((x, j) => (j === i ? { ...x, percentage: e.target.value } : x)) })} />
            <button className="text-slate-400 hover:text-rose-400" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        <div className="flex gap-2 items-center">
          <button className="text-xs text-sky-400" onClick={() => setForm({ ...form, lines: [...form.lines, { costCenterId: "", percentage: "" }] })}>+ Add line</button>
          <span className="text-xs text-slate-400">Total: {total}%</span>
        </div>
        <button className={btnCls} disabled={busy || !form.mainCostCenter || total !== 100}
          onClick={async () => {
            const r = await post({ action: "upsert-cc-allocation", mainCostCenter: form.mainCostCenter, allocations: form.lines.map((l) => ({ costCenterId: l.costCenterId, percentage: Number(l.percentage) })) });
            if (r) { setForm({ mainCostCenter: "", lines: [{ costCenterId: "", percentage: "" }] }); reload(); }
          }}>
          <Plus className="h-3.5 w-3.5" /> Save
        </button>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-slate-400 border-b border-slate-800"><th className="py-2 pr-3">Main Cost Center</th><th className="py-2">Allocations</th></tr></thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id ?? r.main_cost_center} className="border-b border-slate-800/60">
              <td className="py-2 pr-3">{r.main_cost_center}</td>
              <td className="py-2 font-mono text-xs">{(r.allocations ?? []).map((a: any) => `${a.costCenterId ?? a.cost_center_id}: ${a.percentage}%`).join(" · ")}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={2} className="py-6 text-center text-slate-500">No allocations</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function OpeningImportTab({ post, busy }: any) {
  const [postingDate, setPostingDate] = useState("");
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<any>(null);
  const submit = async () => {
    const invoices = csv.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
      const [customerCode, customerName, amount, dueDate] = line.split(",").map((s) => s.trim());
      return { customerCode, customerName, amount: Number(amount), dueDate: dueDate || undefined };
    }).filter((i) => i.customerCode && i.amount > 0);
    const r = await post({ action: "opening-import", postingDate, invoices });
    if (r) setResult(r);
  };
  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-slate-400">
        Import opening AR balances. One per line: <code className="font-mono">customerCode, customerName, amount, dueDate(optional)</code>
      </p>
      <input className={`${inputCls} w-56`} type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} />
      <textarea className={`${inputCls} h-48 font-mono`} placeholder={"CUST-001, Acme Ltd, 1500000, 2026-01-31"} value={csv} onChange={(e) => setCsv(e.target.value)} />
      <button className={btnCls} disabled={busy || !postingDate || !csv.trim()} onClick={submit}>Import</button>
      {result && <pre className="rounded bg-slate-800 p-3 text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

function StatementsTab({ post, busy }: any) {
  const [form, setForm] = useState({ periodStart: "", periodEnd: "", email: false });
  const [result, setResult] = useState<any>(null);
  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-slate-400">Generate statements of account for every customer with open AR or activity in the period.</p>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="block"><span className="block text-xs text-slate-400">From</span><input className={inputCls} type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} /></label>
        <label className="block"><span className="block text-xs text-slate-400">To</span><input className={inputCls} type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.email} onChange={(e) => setForm({ ...form, email: e.target.checked })} /> Email customers</label>
        <button className={btnCls} disabled={busy}
          onClick={async () => { const r = await post({ action: "statement-run", ...form }); if (r) setResult(r); }}>
          Run
        </button>
      </div>
      {result && <pre className="rounded bg-slate-800 p-3 text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}

function UnreconcileTab({ post, busy }: any) {
  const [form, setForm] = useState({ kind: "customer", paymentId: "", docId: "" });
  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-slate-400">Reverse payment allocations. Removes application rows and restores the document&apos;s balance due.</p>
      <div className="flex flex-wrap gap-2 items-end">
        <select className={`${inputCls} w-40`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
          <option value="customer">Customer payment</option><option value="vendor">Vendor payment</option>
        </select>
        <input className={`${inputCls} w-64`} placeholder="Payment ID" value={form.paymentId} onChange={(e) => setForm({ ...form, paymentId: e.target.value })} />
        <input className={`${inputCls} w-64`} placeholder={form.kind === "customer" ? "Invoice ID (optional)" : "Bill ID (optional)"} value={form.docId} onChange={(e) => setForm({ ...form, docId: e.target.value })} />
        <button className={btnCls} disabled={busy || !form.paymentId}
          onClick={() => post(form.kind === "customer"
            ? { action: "unreconcile-customer", paymentId: form.paymentId, invoiceId: form.docId || undefined }
            : { action: "unreconcile-vendor", paymentId: form.paymentId, billId: form.docId || undefined })}>
          Unreconcile
        </button>
      </div>
    </div>
  );
}
