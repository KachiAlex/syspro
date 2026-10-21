"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle, BookOpen, HandCoins, Loader2, Plus, Wallet, X,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);

type Fund = {
  id: string; name: string; custodian: string | null; float_amount: number;
  petty_cash_account_code: string; bank_account_code: string;
  status: string; balance: number;
};

type BookLine = {
  id: string; txn_type: string; txn_date: string; amount: number;
  description: string | null; running_balance: number;
};

type Advance = {
  id: string; advance_number: string; employee_name: string; employee_id: string | null;
  amount: number; purpose: string | null; status: string; issue_date: string;
  applied_amount: number; refunded_amount: number; fund_id: string | null;
};

type Account = { code: string; name: string };

const statusBadge = (s: string) =>
  s === "settled" || s === "posted" || s === "active"
    ? "bg-emerald-500/15 text-emerald-400"
    : s === "refunded" || s === "closed"
    ? "bg-slate-500/15 text-slate-400"
    : "bg-sky-500/15 text-sky-400";

export default function ImprestPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"funds" | "advances">("funds");
  const [funds, setFunds] = useState<Fund[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [showNewFund, setShowNewFund] = useState(false);
  const [showNewAdvance, setShowNewAdvance] = useState(false);
  const [book, setBook] = useState<{ fund: Fund; lines: BookLine[]; closingBalance: number } | null>(null);
  const [fundAction, setFundAction] = useState<{ fund: Fund; kind: "replenish" | "disburse" } | null>(null);
  const [advAction, setAdvAction] = useState<{ adv: Advance; kind: "apply" | "refund" } | null>(null);

  const [fundForm, setFundForm] = useState({
    name: "", custodian: "", floatAmount: "", pettyCashAccountCode: "1040", bankAccountCode: "1110",
  });
  const [actForm, setActForm] = useState({ txnDate: today(), amount: "", expenseAccountCode: "", description: "" });
  const [advForm, setAdvForm] = useState({
    employeeName: "", employeeId: "", fundId: "", amount: "", purpose: "", issueDate: today(),
  });
  const [settleForm, setSettleForm] = useState({ amount: "", entryDate: today(), expenseAccountCode: "", fundId: "" });

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const [fRes, aRes, acctRes] = await Promise.all([
        fetch(`/api/finance/imprest/funds?${qs()}`).then((r) => r.json()),
        fetch(`/api/finance/imprest/advances?${qs()}`).then((r) => r.json()),
        fetch(`/api/finance/accounts?${qs()}&limit=500`).then((r) => r.json()).catch(() => ({})),
      ]);
      setFunds(fRes.funds ?? []);
      setAdvances(aRes.advances ?? []);
      const accts: Account[] = (acctRes.accounts ?? []).map((a: any) => ({
        code: String(a.code ?? a.account_code ?? ""), name: String(a.name ?? ""),
      })).filter((a: Account) => a.code);
      setAccounts(accts);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const expenseAccounts = accounts.filter((a) => Number(a.code) >= 5000);

  const post = async (url: string, body: any, success: string, onDone?: () => void) => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMsg(success); onDone?.();
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const outstanding = (a: Advance) =>
    Number(a.amount) - Number(a.applied_amount) - Number(a.refunded_amount);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Imprest — Petty Cash &amp; Advances</h1>
            <p className="text-sm text-slate-400">
              Float-based petty cash funds and staff advance lifecycle — all movements post to the GL
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setAdvForm((f) => ({ ...f, fundId: funds[0]?.id ?? "" })); setShowNewAdvance(true); }}
            className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500">
            <HandCoins className="h-4 w-4" /> Issue advance
          </button>
          <button onClick={() => setShowNewFund(true)}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
            <Plus className="h-4 w-4" /> New fund
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}

      <div className="flex gap-1 border-b border-slate-800">
        {(["funds", "advances"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm border-b-2 -mb-px ${
              tab === t ? "border-sky-400 text-sky-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            {t === "funds" ? "Petty cash funds" : `Staff advances (${advances.length})`}
          </button>
        ))}
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}

      {tab === "funds" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              {["Fund", "Custodian", "Float", "Balance", "Petty / Bank a/c", "Status", ""].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funds.map((f) => (
              <tr key={f.id} className="border-t border-slate-800">
                <td className="px-3 py-2">
                  <button className="text-sky-400 hover:underline flex items-center gap-1"
                    onClick={async () => {
                      const data = await (await fetch(`/api/finance/imprest/funds/${f.id}?${qs()}&book=true`)).json();
                      setBook({ fund: f, lines: data.lines ?? [], closingBalance: data.closingBalance ?? 0 });
                    }}>
                    <BookOpen className="h-3.5 w-3.5" /> {f.name}
                  </button>
                </td>
                <td className="px-3 py-2 text-slate-400">{f.custodian ?? "—"}</td>
                <td className="px-3 py-2">{fmt(f.float_amount)}</td>
                <td className={`px-3 py-2 ${f.balance < 0 ? "text-rose-400" : ""}`}>{fmt(f.balance)}</td>
                <td className="px-3 py-2 text-slate-400">{f.petty_cash_account_code} / {f.bank_account_code}</td>
                <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${statusBadge(f.status)}`}>{f.status}</span></td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => { setActForm({ txnDate: today(), amount: "", expenseAccountCode: "", description: "" }); setFundAction({ fund: f, kind: "replenish" }); }}
                      className="text-xs text-emerald-400 hover:underline">Replenish</button>
                    <button onClick={() => { setActForm({ txnDate: today(), amount: "", expenseAccountCode: expenseAccounts[0]?.code ?? "", description: "" }); setFundAction({ fund: f, kind: "disburse" }); }}
                      className="text-xs text-amber-400 hover:underline">Disburse</button>
                  </div>
                </td>
              </tr>
            ))}
            {funds.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                No imprest funds yet — create one to start tracking petty cash.
              </td></tr>
            )}
          </tbody>
        </table>
      )}

      {tab === "advances" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              {["Advance", "Employee", "Issued", "Amount", "Applied", "Refunded", "Outstanding", "Status", ""].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {advances.map((a) => (
              <tr key={a.id} className="border-t border-slate-800">
                <td className="px-3 py-2 font-mono text-xs">{a.advance_number}</td>
                <td className="px-3 py-2">{a.employee_name}
                  {a.purpose && <div className="text-xs text-slate-500">{a.purpose}</div>}
                </td>
                <td className="px-3 py-2">{String(a.issue_date).slice(0, 10)}</td>
                <td className="px-3 py-2">{fmt(a.amount)}</td>
                <td className="px-3 py-2 text-slate-400">{fmt(a.applied_amount)}</td>
                <td className="px-3 py-2 text-slate-400">{fmt(a.refunded_amount)}</td>
                <td className={`px-3 py-2 ${outstanding(a) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                  {fmt(outstanding(a))}
                </td>
                <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${statusBadge(a.status)}`}>{a.status.replace(/_/g, " ")}</span></td>
                <td className="px-3 py-2">
                  {outstanding(a) > 0.005 && (
                    <div className="flex gap-2">
                      <button onClick={() => { setSettleForm({ amount: String(outstanding(a)), entryDate: today(), expenseAccountCode: expenseAccounts[0]?.code ?? "", fundId: "" }); setAdvAction({ adv: a, kind: "apply" }); }}
                        className="text-xs text-sky-400 hover:underline">Apply</button>
                      <button onClick={() => { setSettleForm({ amount: String(outstanding(a)), entryDate: today(), expenseAccountCode: "", fundId: a.fund_id ?? "" }); setAdvAction({ adv: a, kind: "refund" }); }}
                        className="text-xs text-emerald-400 hover:underline">Refund</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {advances.length === 0 && !loading && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                No staff advances issued yet.
              </td></tr>
            )}
          </tbody>
        </table>
      )}

      {showNewFund && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New imprest fund</h2>
              <button onClick={() => setShowNewFund(false)}><X className="h-4 w-4" /></button>
            </div>
            <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Fund name (e.g. Head Office Petty Cash)"
              value={fundForm.name} onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })} />
            <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Custodian (optional)"
              value={fundForm.custodian} onChange={(e) => setFundForm({ ...fundForm, custodian: e.target.value })} />
            <label className="block text-xs text-slate-400">Float amount
              <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={fundForm.floatAmount} onChange={(e) => setFundForm({ ...fundForm, floatAmount: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">Petty cash a/c
                <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={fundForm.pettyCashAccountCode} onChange={(e) => setFundForm({ ...fundForm, pettyCashAccountCode: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">Bank a/c
                <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={fundForm.bankAccountCode} onChange={(e) => setFundForm({ ...fundForm, bankAccountCode: e.target.value })} />
              </label>
            </div>
            <button disabled={busy || !fundForm.name || !Number(fundForm.floatAmount)}
              onClick={() => void post(`/api/finance/imprest/funds?${qs()}`, {
                name: fundForm.name, custodian: fundForm.custodian || undefined,
                floatAmount: Number(fundForm.floatAmount),
                pettyCashAccountCode: fundForm.pettyCashAccountCode, bankAccountCode: fundForm.bankAccountCode,
              }, "Fund created", () => setShowNewFund(false))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Creating…" : "Create fund"}
            </button>
          </div>
        </div>
      )}

      {fundAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {fundAction.kind === "replenish" ? "Replenish" : "Disburse"} — {fundAction.fund.name}
              </h2>
              <button onClick={() => setFundAction(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400">
              Balance {fmt(fundAction.fund.balance)} of {fmt(fundAction.fund.float_amount)} float.
              {fundAction.kind === "replenish"
                ? " Leave amount blank to top up to the full float — Dr petty cash / Cr bank."
                : " Dr expense account / Cr petty cash."}
            </p>
            <label className="block text-xs text-slate-400">Date
              <input type="date" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={actForm.txnDate} onChange={(e) => setActForm({ ...actForm, txnDate: e.target.value })} />
            </label>
            <label className="block text-xs text-slate-400">
              Amount{fundAction.kind === "replenish" ? " (blank = fill to float)" : ""}
              <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={actForm.amount} onChange={(e) => setActForm({ ...actForm, amount: e.target.value })} />
            </label>
            {fundAction.kind === "disburse" && (
              <label className="block text-xs text-slate-400">Expense account
                <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={actForm.expenseAccountCode} onChange={(e) => setActForm({ ...actForm, expenseAccountCode: e.target.value })}>
                  <option value="">Select…</option>
                  {expenseAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </select>
              </label>
            )}
            <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Description (optional)"
              value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} />
            <button
              disabled={busy || (fundAction.kind === "disburse" && (!Number(actForm.amount) || !actForm.expenseAccountCode))}
              onClick={() => void post(`/api/finance/imprest/funds/${fundAction.fund.id}?${qs()}`, {
                action: fundAction.kind, txnDate: actForm.txnDate,
                amount: actForm.amount ? Number(actForm.amount) : undefined,
                expenseAccountCode: actForm.expenseAccountCode || undefined,
                description: actForm.description || undefined,
              }, fundAction.kind === "replenish" ? "Fund replenished" : "Expense disbursed",
              () => setFundAction(null))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Posting…" : "Post to GL"}
            </button>
          </div>
        </div>
      )}

      {showNewAdvance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Issue staff advance</h2>
              <button onClick={() => setShowNewAdvance(false)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400">Dr staff advances / Cr petty cash (or bank when no fund is chosen).</p>
            <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Employee name"
              value={advForm.employeeName} onChange={(e) => setAdvForm({ ...advForm, employeeName: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Employee ID (optional)"
                value={advForm.employeeId} onChange={(e) => setAdvForm({ ...advForm, employeeId: e.target.value })} />
              <label className="text-xs text-slate-400">Issue date
                <input type="date" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={advForm.issueDate} onChange={(e) => setAdvForm({ ...advForm, issueDate: e.target.value })} />
              </label>
            </div>
            <label className="block text-xs text-slate-400">Funded from
              <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={advForm.fundId} onChange={(e) => setAdvForm({ ...advForm, fundId: e.target.value })}>
                <option value="">Bank directly (no fund)</option>
                {funds.map((f) => <option key={f.id} value={f.id}>{f.name} — {fmt(f.balance)}</option>)}
              </select>
            </label>
            <label className="block text-xs text-slate-400">Amount
              <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={advForm.amount} onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })} />
            </label>
            <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Purpose (optional)"
              value={advForm.purpose} onChange={(e) => setAdvForm({ ...advForm, purpose: e.target.value })} />
            <button disabled={busy || !advForm.employeeName || !Number(advForm.amount)}
              onClick={() => void post(`/api/finance/imprest/advances?${qs()}`, {
                employeeName: advForm.employeeName, employeeId: advForm.employeeId || undefined,
                fundId: advForm.fundId || undefined, amount: Number(advForm.amount),
                purpose: advForm.purpose || undefined, issueDate: advForm.issueDate,
              }, "Advance issued", () => setShowNewAdvance(false))}
              className="w-full rounded bg-sky-600 py-2 text-sm hover:bg-sky-500 disabled:opacity-50">
              {busy ? "Posting…" : "Issue advance"}
            </button>
          </div>
        </div>
      )}

      {advAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {advAction.kind === "apply" ? "Apply to expense" : "Refund unused"} — {advAction.adv.advance_number}
              </h2>
              <button onClick={() => setAdvAction(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400">
              Outstanding {fmt(outstanding(advAction.adv))}.
              {advAction.kind === "apply" ? " Dr expense / Cr staff advances." : " Dr petty cash or bank / Cr staff advances."}
            </p>
            <label className="block text-xs text-slate-400">Date
              <input type="date" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={settleForm.entryDate} onChange={(e) => setSettleForm({ ...settleForm, entryDate: e.target.value })} />
            </label>
            <label className="block text-xs text-slate-400">Amount
              <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={settleForm.amount} onChange={(e) => setSettleForm({ ...settleForm, amount: e.target.value })} />
            </label>
            {advAction.kind === "apply" && (
              <label className="block text-xs text-slate-400">Expense account
                <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={settleForm.expenseAccountCode} onChange={(e) => setSettleForm({ ...settleForm, expenseAccountCode: e.target.value })}>
                  <option value="">Select…</option>
                  {expenseAccounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </select>
              </label>
            )}
            {advAction.kind === "refund" && (
              <label className="block text-xs text-slate-400">Refund into
                <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={settleForm.fundId} onChange={(e) => setSettleForm({ ...settleForm, fundId: e.target.value })}>
                  <option value="">Bank</option>
                  {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </label>
            )}
            <button
              disabled={busy || !Number(settleForm.amount) || Number(settleForm.amount) > outstanding(advAction.adv)}
              onClick={() => void post(`/api/finance/imprest/advances/${advAction.adv.id}?${qs()}`, {
                action: advAction.kind, amount: Number(settleForm.amount), entryDate: settleForm.entryDate,
                expenseAccountCode: settleForm.expenseAccountCode || undefined,
                fundId: settleForm.fundId || undefined,
              }, advAction.kind === "apply" ? "Advance applied to expense" : "Advance refunded",
              () => setAdvAction(null))}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Posting…" : "Post to GL"}
            </button>
          </div>
        </div>
      )}

      {book && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{book.fund.name} — petty cash book</h2>
              <button onClick={() => setBook(null)}><X className="h-4 w-4" /></button>
            </div>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="py-1">Date</th><th>Type</th><th>Description</th>
                  <th className="text-right">Amount</th><th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {book.lines.map((l) => (
                  <tr key={l.id} className="border-t border-slate-800">
                    <td className="py-1.5">{String(l.txn_date).slice(0, 10)}</td>
                    <td className="capitalize">{l.txn_type}</td>
                    <td className="text-slate-400">{l.description ?? "—"}</td>
                    <td className={`text-right ${l.txn_type === "replenishment" || l.txn_type === "adjustment" ? "text-emerald-400" : "text-amber-400"}`}>
                      {l.txn_type === "replenishment" || l.txn_type === "adjustment" ? "+" : "−"}{fmt(l.amount)}
                    </td>
                    <td className="text-right">{fmt(l.running_balance)}</td>
                  </tr>
                ))}
                {book.lines.length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-slate-500">No transactions yet</td></tr>
                )}
              </tbody>
            </table>
            <div className="mt-3 border-t border-slate-700 pt-3 text-right text-sm">
              Closing balance: <span className="font-semibold">{fmt(book.closingBalance)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
