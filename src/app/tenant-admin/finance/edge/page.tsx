"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const TABS = ["party-links", "advance-taxes", "bank-rec-match", "ledger-bisect"] as const;

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
    const res = await fetch("/api/finance/edge", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suggest-matches", reconciliationId: f.brSession }),
    });
    const d = await res.json().catch(() => ({}));
    setData((prev) => ({ ...prev, suggestions: d.proposals ?? [] }));
    setMsg(d.proposals?.length ? `${d.proposals.length} match suggestion(s)` : "No matches found");
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
              <button className={btn} onClick={() => post({ action: "create-link", primaryType: f.plPType, primaryId: f.plPCode, secondaryType: f.plSType, secondaryId: f.plSCode })}>Link</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Primary</th><th className={th}>Code</th><th className={th}>Secondary</th><th className={th}>Code</th><th className={th}></th></tr></thead>
              <tbody>
                {data.links?.map((l: any) => (
                  <tr key={l.id} className="border-t border-slate-800/50">
                    <td className={th}>{l.primary_party_type}</td><td className={`${th} font-mono`}>{l.primary_party_code}</td>
                    <td className={th}>{l.secondary_party_type}</td><td className={`${th} font-mono`}>{l.secondary_party_code}</td>
                    <td className={th}><button className="text-xs text-red-400" onClick={() => post({ action: "delete-link", id: l.id })}>unlink</button></td>
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
              <input placeholder="Payment entry ID" value={f.atPay ?? ""} onChange={(e) => setF({ ...f, atPay: e.target.value })} className={input} />
              <input placeholder="Tax code" value={f.atCode ?? ""} onChange={(e) => setF({ ...f, atCode: e.target.value })} className={`${input} w-28`} />
              <input type="number" placeholder="Rate %" value={f.atRate ?? ""} onChange={(e) => setF({ ...f, atRate: e.target.value })} className={`${input} w-24`} />
              <input type="number" placeholder="Tax amount" value={f.atAmt ?? ""} onChange={(e) => setF({ ...f, atAmt: e.target.value })} className={`${input} w-28`} />
              <input placeholder="Account code" value={f.atAcct ?? ""} onChange={(e) => setF({ ...f, atAcct: e.target.value })} className={`${input} w-28`} />
              <button className={btn} onClick={() => post({ action: "add-advance-tax", paymentId: f.atPay, taxCode: f.atCode, rate: Number(f.atRate ?? 0), taxAmount: Number(f.atAmt), accountCode: f.atAcct })}>Record</button>
            </div>
            <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
              <thead className="text-left text-slate-400"><tr><th className={th}>Tax Code</th><th className={th}>Rate</th><th className={th}>Amount</th><th className={th}>Payment</th></tr></thead>
              <tbody>
                {data.taxes?.map((t: any) => (
                  <tr key={t.id} className="border-t border-slate-800/50">
                    <td className={th}>{t.tax_code}</td><td className={th}>{t.rate}%</td>
                    <td className={th}>{Number(t.tax_amount).toLocaleString()}</td>
                    <td className={`${th} font-mono text-xs`}>{String(t.payment_id).slice(0, 14)}</td>
                  </tr>
                ))}
                {!data.taxes?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">No advance taxes recorded</td></tr>}
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
              <thead className="text-left text-slate-400"><tr><th className={th}>Bank line</th><th className={th}>Amount</th><th className={th}>Suggested book entry</th><th className={th}>Apply</th></tr></thead>
              <tbody>
                {data.suggestions?.map((s: any, i: number) => (
                  <tr key={i} className="border-t border-slate-800/50">
                    <td className={`${th} max-w-[260px] truncate`}>{s.bankItem?.description ?? s.bankItem?.id}</td>
                    <td className={th}>{Number(s.amount ?? 0).toLocaleString()}</td>
                    <td className={`${th} max-w-[260px] truncate`}>{s.bookItem?.description ?? "—"}</td>
                    <td className={th}>
                      <button className="rounded bg-slate-800 px-2 py-1 text-xs hover:bg-slate-700"
                        onClick={async () => {
                          const res = await fetch("/api/finance/edge", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "apply-matches", pairs: [{ bankItemId: s.bankItem.id, bookItemId: s.bookItem.id }] }),
                          });
                          if (res.ok) setMsg("Match applied"); else setError("Apply failed");
                        }}>Apply</button>
                    </td>
                  </tr>
                ))}
                {!data.suggestions?.length && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Enter a session ID and run suggestions</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {tab === "ledger-bisect" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-400">Recompute an account&apos;s running balance and locate where it diverges from the expected closing — surfaces duplicate lines, journal-number gaps, and unbalanced entries.</p>
            <div className="flex flex-wrap gap-2">
              <input placeholder="Account code" value={f.bxAcct ?? ""} onChange={(e) => setF({ ...f, bxAcct: e.target.value })} className={input} />
              <input type="number" placeholder="Expected closing" value={f.bxExp ?? ""} onChange={(e) => setF({ ...f, bxExp: e.target.value })} className={`${input} w-36`} />
              <input type="number" placeholder="Opening (opt)" value={f.bxOpen ?? ""} onChange={(e) => setF({ ...f, bxOpen: e.target.value })} className={`${input} w-32`} />
              <input type="date" value={f.bxFrom ?? ""} onChange={(e) => setF({ ...f, bxFrom: e.target.value })} className={input} />
              <input type="date" value={f.bxTo ?? ""} onChange={(e) => setF({ ...f, bxTo: e.target.value })} className={input} />
              <button className={btn} onClick={async () => {
                const q = new URLSearchParams({ view: "bisect", account: f.bxAcct ?? "", expected: f.bxExp ?? "0" });
                if (f.bxOpen) q.set("opening", f.bxOpen);
                if (f.bxFrom) q.set("from", f.bxFrom);
                if (f.bxTo) q.set("to", f.bxTo);
                const d = await fetch(`/api/finance/edge?${q}`).then((r) => r.json());
                setData((prev) => ({ ...prev, bisect: d }));
              }}>Bisect</button>
            </div>
            {data.bisect && (
              <div className="space-y-3">
                <div className={`rounded-xl border p-4 text-sm ${data.bisect.discrepancy === 0 ? "border-emerald-700 bg-emerald-950/30" : "border-amber-700 bg-amber-950/30"}`}>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    <span>Opening: <b>{Number(data.bisect.openingBalance).toLocaleString()}</b></span>
                    <span>Expected: <b>{Number(data.bisect.expectedClosing).toLocaleString()}</b></span>
                    <span>Computed: <b>{Number(data.bisect.computedClosing).toLocaleString()}</b></span>
                    <span>Discrepancy: <b>{Number(data.bisect.discrepancy).toLocaleString()}</b></span>
                    <span>Lines/Entries: <b>{data.bisect.lineCount}/{data.bisect.entryCount}</b></span>
                  </div>
                </div>
                {data.bisect.anomalies?.length > 0 && (
                  <table className="w-full rounded-xl border border-slate-800 bg-slate-900 text-sm">
                    <thead className="text-left text-slate-400"><tr><th className={th}>Kind</th><th className={th}>Entry</th><th className={th}>Date</th><th className={th}>Detail</th></tr></thead>
                    <tbody>
                      {data.bisect.anomalies.map((a: any, i: number) => (
                        <tr key={i} className="border-t border-slate-800/50">
                          <td className={th}><span className="rounded bg-amber-900/50 px-2 py-0.5 text-xs">{a.kind}</span></td>
                          <td className={`${th} font-mono text-xs`}>{a.entryNumber ?? String(a.entryId ?? "").slice(0, 8)}</td>
                          <td className={th}>{a.postingDate ? String(a.postingDate).slice(0, 10) : "—"}</td>
                          <td className={th}>{a.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <details className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs">
                  <summary className="cursor-pointer text-slate-400">Running-balance checkpoints ({data.bisect.checkpoint?.length ?? 0})</summary>
                  <div className="mt-2 max-h-64 overflow-auto font-mono">
                    {data.bisect.checkpoint?.map((c: any) => (
                      <div key={c.entryId} className="flex gap-4 border-b border-slate-800/40 py-1">
                        <span className="w-24 text-slate-500">{String(c.postingDate).slice(0, 10)}</span>
                        <span className="w-16">{c.entryNumber}</span>
                        <span className="w-24 text-right">{(c.debit - c.credit).toLocaleString()}</span>
                        <span className="w-28 text-right text-slate-300">{Number(c.runningBalance).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
