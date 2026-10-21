"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["party-links", "advance-taxes", "bank-rec-match"] as const;

export default function FinanceEdgePage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<(typeof TABS)[number]>("party-links");
  const [data, setData] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    const [links, taxes] = await Promise.all([
      fetch("/api/finance/edge?view=party-links").then((r) => r.json()).catch(() => ({})),
      fetch("/api/finance/edge?view=advance-taxes").then((r) => r.json()).catch(() => ({})),
    ]);
    setData({ links: links.links ?? [], taxes: taxes.taxes ?? [] });
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/finance/edge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error ?? "Failed"); return null; }
    setError(""); load(); return d;
  };

  const input = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm";
  const btn = "rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500";
  const th = "p-3";

  const loadSuggestions = async () => {
    const d = await fetch(`/api/finance/edge?view=bank-rec-suggestions&sessionId=${f.brSession ?? ""}`).then((r) => r.json());
    setData((prev) => ({ ...prev, suggestions: d.suggestions ?? [] }));
    setMsg(d.suggestions?.length ? `${d.suggestions.length} match suggestion(s)` : "No matches found");
  };

  if (!tenantSlug) return null;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-2xl font-bold">Finance Edge</h1>
        <p className="mb-4 text-sm text-slate-400">Party links, advance taxes, bank-reconciliation match suggestions</p>
        <div className="mb-4 flex gap-1 rounded-lg bg-slate-900 p-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm capitalize ${tab === t ? "bg-slate-700" : "text-slate-400 hover:text-white"}`}>{t.replace("-", " ")}</button>
          ))}
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-900/40 p-3 text-sm text-red-300">{error}<button onClick={() => setError("")} className="ml-2 underline">dismiss</button></div>}
        {msg && <div className="mb-4 rounded-lg bg-slate-800 p-3 text-sm">{msg}<button onClick={() => setMsg("")} className="ml-2 underline">dismiss</button></div>}

        {tab === "party-links" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">Link a customer/supplier to a related party in another role (e.g. a customer who is also a supplier) so transactions can be netted or cross-referenced.</p>
            <div className="flex flex-wrap gap-2">
              <select value={f.plPType ?? "customer"} onChange={(e) => setF({ ...f, plPType: e.target.value })} className={input}>
                <option value="customer">Customer</option><option value="supplier">Supplier</option>
              </select>
              <input placeholder="Party code" value={f.plPCode ?? ""} onChange={(e) => setF({ ...f, plPCode: e.target.value })} className={input} />
              <select value={f.plSType ?? "supplier"} onChange={(e) => setF({ ...f, plSType: e.target.value })} className={input}>
                <option value="customer">Customer</option><option value="supplier">Supplier</option><option value="employee">Employee</option>
              </select>
              <input placeholder="Secondary code" value={f.plSCode ?? ""} onChange={(e) => setF({ ...f, plSCode: e.target.value })} className={input} />
              <button className={btn} onClick={() => post({ action: "link-party", primaryType: f.plPType, primaryCode: f.plPCode, secondaryType: f.plSType, secondaryCode: f.plSCode })}>Link</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Primary</th><th className={th}>Code</th><th className={th}>Secondary</th><th className={th}>Code</th><th className={th}></th></tr></thead>
              <tbody>
                {data.links?.map((l: any) => (
                  <tr key={l.id} className="border-t border-slate-800/50">
                    <td className={th}>{l.primary_party_type}</td><td className={`${th} font-mono`}>{l.primary_party_code}</td>
                    <td className={th}>{l.secondary_party_type}</td><td className={`${th} font-mono`}>{l.secondary_party_code}</td>
                    <td className={th}><button className="text-xs text-red-400" onClick={() => post({ action: "unlink-party", id: l.id })}>unlink</button></td>
                  </tr>
                ))}
                {!data.links?.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No party links</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "advance-taxes" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">Advance tax paid during the year (e.g. company income tax installments), deducted at period end.</p>
            <div className="flex flex-wrap gap-2">
              <select value={f.atType ?? "income"} onChange={(e) => setF({ ...f, atType: e.target.value })} className={input}>
                <option value="income">Income tax</option><option value="withholding">Withholding</option><option value="other">Other</option>
              </select>
              <input type="date" value={f.atDate ?? ""} onChange={(e) => setF({ ...f, atDate: e.target.value })} className={input} />
              <input type="number" placeholder="Amount" value={f.atAmt ?? ""} onChange={(e) => setF({ ...f, atAmt: e.target.value })} className={`${input} w-32`} />
              <input placeholder="Account code" value={f.atAcct ?? ""} onChange={(e) => setF({ ...f, atAcct: e.target.value })} className={`${input} w-32`} />
              <button className={btn} onClick={() => post({ action: "create-advance-tax", taxType: f.atType, paymentDate: f.atDate, amount: Number(f.atAmt), accountCode: f.atAcct })}>Record</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Type</th><th className={th}>Date</th><th className={th}>Amount</th><th className={th}>Account</th><th className={th}>GL</th></tr></thead>
              <tbody>
                {data.taxes?.map((t: any) => (
                  <tr key={t.id} className="border-t border-slate-800/50">
                    <td className={th}>{t.tax_type}</td><td className={th}>{String(t.payment_date).slice(0, 10)}</td>
                    <td className={th}>{Number(t.amount).toLocaleString()}</td>
                    <td className={th}>{t.account_code ?? "—"}</td>
                    <td className={th}>{t.gl_entry_id ? "posted" : "—"}</td>
                  </tr>
                ))}
                {!data.taxes?.length && <tr><td colSpan={5} className="p-6 text-center text-slate-500">No advance taxes recorded</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "bank-rec-match" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">Auto-match suggestions: unreconciled bank-statement lines paired with book entries by amount ± date proximity and description similarity.</p>
            <div className="flex gap-2">
              <input placeholder="Reconciliation session ID" value={f.brSession ?? ""} onChange={(e) => setF({ ...f, brSession: e.target.value })} className={`${input} flex-1`} />
              <button className={btn} onClick={loadSuggestions}>Suggest Matches</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Statement line</th><th className={th}>Amount</th><th className={th}>Suggested book entry</th><th className={th}>Confidence</th></tr></thead>
              <tbody>
                {data.suggestions?.map((s: any, i: number) => (
                  <tr key={i} className="border-t border-slate-800/50">
                    <td className={th}>{s.statementDescription ?? s.statementId}</td>
                    <td className={th}>{Number(s.amount ?? 0).toLocaleString()}</td>
                    <td className={th}>{s.bookEntryDescription ?? s.bookEntryId ?? "—"}</td>
                    <td className={th}>{Math.round((s.confidence ?? 0) * 100)}%</td>
                  </tr>
                ))}
                {!data.suggestions?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Enter a session ID and run suggestions</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
