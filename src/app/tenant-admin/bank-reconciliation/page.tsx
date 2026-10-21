"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Landmark, Loader2, AlertCircle, CheckCircle, Upload, Wand2, Link2, X,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const STATUS_TABS = ["unmatched", "matched", "posted", "ignored", "all"] as const;
const STATUS_BADGE: Record<string, string> = {
  unmatched: "bg-amber-500/15 text-amber-400",
  matched: "bg-emerald-500/15 text-emerald-400",
  posted: "bg-sky-500/15 text-sky-400",
  ignored: "bg-slate-500/15 text-slate-400",
};

type StmtLine = {
  id: string;
  line_date: string;
  description: string | null;
  reference: string | null;
  amount: number;
  status: string;
  matched_entity: string | null;
  matched_id: string | null;
};

type Payment = {
  id: string;
  reference: string;
  grossAmount: number;
  netAmount: number;
  paymentDate: string;
  method: string;
};

// CSV: date, description, reference, amount — header optional, quoted fields ok.
function parseCsv(text: string) {
  const rows: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  const pushField = () => { cur.push(field); field = ""; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") pushField();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      pushField(); if (cur.length > 1 || cur[0] !== "") { rows.push(cur); } cur = [];
    } else field += ch;
  }
  pushField(); if (cur.length > 1 || cur[0] !== "") rows.push(cur);
  return rows;
}

export default function BankReconciliationPage() {
  const { tenantSlug } = useTenantContext();
  const [accounts, setAccounts] = useState<{ code: string; name: string }[]>([]);
  const [account, setAccount] = useState("1100");
  const [lines, setLines] = useState<StmtLine[]>([]);
  const [summary, setSummary] = useState<{ status: string; n: number; total: number }[]>([]);
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("unmatched");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [matchLine, setMatchLine] = useState<StmtLine | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [postLine, setPostLine] = useState<StmtLine | null>(null);
  const [postKind, setPostKind] = useState<"bank_charge" | "interest" | "manual">("bank_charge");
  const [postAccount, setPostAccount] = useState("");
  const [postDesc, setPostDesc] = useState("");

  const load = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    const q = `tenantSlug=${encodeURIComponent(tenantSlug)}&bankAccountCode=${encodeURIComponent(account)}`;
    const [lRes, sRes] = await Promise.all([
      fetch(`/api/finance/bank-statements?${q}`),
      fetch(`/api/finance/bank-statements?summary=true&${q}`),
    ]);
    const lData = await lRes.json().catch(() => ({}));
    const sData = await sRes.json().catch(() => ({}));
    setLines(lData.lines ?? []);
    setSummary(sData.summary ?? []);
    setLoading(false);
  }, [tenantSlug, account]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/finance/chart-of-accounts?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=500`);
      const data = await res.json().catch(() => ({}));
      const bankish = (data.data ?? []).filter(
        (a: any) => a.type === "asset" && /^1[01]\d\d/.test(a.code)
      );
      setAccounts(bankish);
      if (bankish.length && !bankish.some((a: any) => a.code === account)) {
        setAccount(bankish[0].code);
      }
    })();
  }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const act = async (lineId: string, body: any) => {
    setBusy(lineId); setError(null); setNotice(null);
    const res = await fetch(`/api/finance/bank-statements/${lineId}?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error ? JSON.stringify(data.error) : "Action failed"); return false; }
    return true;
  };

  const runAutoMatch = async () => {
    setBusy("auto"); setError(null); setNotice(null);
    const res = await fetch(`/api/finance/bank-statements/match?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, bankAccountCode: account }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(data.error ?? "Auto-match failed"); return; }
    setNotice(`Auto-match: ${data.matched} of ${data.examined} unmatched lines matched`);
    load();
  };

  const doImport = async () => {
    const rows = parseCsv(csvText);
    const parsed = rows
      .filter((r) => r.length >= 2)
      .map((r) => {
        const amount = Number(String(r[r.length - 1]).replace(/[₦,\s]/g, ""));
        const date = r[0]?.trim();
        return { date, description: r[1]?.trim() || undefined, reference: r[2]?.trim() || undefined, amount };
      })
      .filter((r) => r.date && /^\d{4}-\d{2}-\d{2}/.test(r.date) && !Number.isNaN(r.amount));
    if (!parsed.length) { setError("No valid rows — expected: YYYY-MM-DD, description, reference, amount"); return; }
    setBusy("import"); setError(null);
    const res = await fetch(`/api/finance/bank-statements?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, bankAccountCode: account, lines: parsed }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(JSON.stringify(data.error) ?? "Import failed"); return; }
    setNotice(`Imported ${data.imported} statement lines`);
    setShowImport(false); setCsvText("");
    load();
  };

  const openMatch = async (line: StmtLine) => {
    setMatchLine(line);
    const res = await fetch(`/api/finance/payments?tenantSlug=${encodeURIComponent(tenantSlug)}&status=successful&limit=100`);
    const data = await res.json().catch(() => ({}));
    setPayments(data.payments ?? []);
  };

  const candidates = useMemo(() => {
    if (!matchLine) return [];
    const amt = Number(matchLine.amount);
    return payments
      .map((p) => ({
        ...p,
        diff: Math.min(Math.abs(Number(p.grossAmount) - amt), Math.abs(Number(p.netAmount) - amt)),
      }))
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 20);
  }, [payments, matchLine]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of summary) m[s.status] = s.n;
    return m;
  }, [summary]);

  const visible = lines.filter((l) => tab === "all" || l.status === tab);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC] flex items-center gap-2">
            <Landmark className="w-6 h-6 text-emerald-400" /> Bank Reconciliation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Import statement lines, auto-match to payments and journal entries, post bank-side items.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import statement
          </button>
          <button onClick={runAutoMatch} disabled={busy === "auto"}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-sm flex items-center gap-2 disabled:opacity-50">
            {busy === "auto" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            Auto-match
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select value={account} onChange={(e) => setAccount(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
          {accounts.length === 0 && <option value={account}>{account}</option>}
          {accounts.map((a) => (
            <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${tab === t ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}>
              {t}{t !== "all" && counts[t] != null ? ` (${counts[t]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Matched to</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No {tab === "all" ? "" : tab + " "}statement lines — import a statement to begin.</td></tr>
            ) : visible.map((l) => (
              <tr key={l.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{String(l.line_date).slice(0, 10)}</td>
                <td className="px-4 py-3 text-slate-200 max-w-xs truncate">{l.description ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">{l.reference ?? "—"}</td>
                <td className={`px-4 py-3 text-right font-mono ${Number(l.amount) < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {fmt(l.amount)}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_BADGE[l.status] ?? "bg-slate-500/15 text-slate-400"}`}>
                    {l.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {l.matched_entity ? `${l.matched_entity === "finance_payment" ? "Payment" : "JE"} ${String(l.matched_id).slice(0, 8)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {busy === l.id ? <Loader2 className="w-4 h-4 animate-spin inline" /> : (
                    <div className="flex gap-1 justify-end">
                      {l.status === "unmatched" && (
                        <>
                          <button onClick={() => openMatch(l)} title="Match to a payment"
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1">
                            <Link2 className="w-3 h-3" /> Match
                          </button>
                          <button onClick={() => { setPostLine(l); setPostDesc(l.description ?? ""); setPostKind(Number(l.amount) < 0 ? "bank_charge" : "interest"); }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200">Post</button>
                          <button onClick={async () => { if (await act(l.id, { action: "ignore" })) load(); }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-400">Ignore</button>
                        </>
                      )}
                      {l.status === "matched" && (
                        <button onClick={async () => { if (await act(l.id, { action: "unmatch" })) load(); }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-amber-400">Unmatch</button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showImport && (
        <Modal onClose={() => setShowImport(false)} title={`Import statement — ${account}`}>
          <p className="text-xs text-slate-400 mb-2">
            Paste CSV rows: <code className="text-slate-300">YYYY-MM-DD, description, reference, amount</code>.
            Header row is skipped automatically; deposits positive, withdrawals negative.
          </p>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={10}
            placeholder={"2026-11-01, Customer payment INV-0042, TRF8841, 125000\n2026-11-02, Bank charges, , -1500"}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono" />
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancel</button>
            <button onClick={doImport} disabled={busy === "import" || !csvText.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50 flex items-center gap-2">
              {busy === "import" && <Loader2 className="w-4 h-4 animate-spin" />} Import
            </button>
          </div>
        </Modal>
      )}

      {matchLine && (
        <Modal onClose={() => setMatchLine(null)} title={`Match ${fmt(matchLine.amount)} — ${matchLine.description ?? "statement line"}`}>
          <p className="text-xs text-slate-400 mb-3">Closest successful payments by amount:</p>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {candidates.length === 0 && <p className="text-sm text-slate-500 py-4 text-center">No successful payments found.</p>}
            {candidates.map((p) => (
              <button key={p.id}
                onClick={async () => {
                  if (await act(matchLine.id, { action: "match", matchedEntity: "finance_payment", matchedId: p.id })) {
                    setMatchLine(null); load();
                  }
                }}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-200">{p.reference}</p>
                  <p className="text-xs text-slate-400">{String(p.paymentDate).slice(0, 10)} · {p.method}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-slate-200">{fmt(p.netAmount)}</p>
                  <p className={`text-xs ${p.diff < 0.01 ? "text-emerald-400" : "text-amber-400"}`}>
                    {p.diff < 0.01 ? "exact" : `Δ ${fmt(p.diff)}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {postLine && (
        <Modal onClose={() => setPostLine(null)} title={`Post to GL — ${fmt(postLine.amount)}`}>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400">Entry type</label>
              <select value={postKind} onChange={(e) => setPostKind(e.target.value as any)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                <option value="bank_charge">Bank charge (Dr 6810 / Cr bank)</option>
                <option value="interest">Interest income (Dr bank / Cr interest)</option>
                <option value="manual">Manual (choose account)</option>
              </select>
            </div>
            {postKind === "manual" && (
              <div>
                <label className="text-xs text-slate-400">Offset account</label>
                <select value={postAccount} onChange={(e) => setPostAccount(e.target.value)}
                  className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200">
                  <option value="">— select —</option>
                  {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-slate-400">Description</label>
              <input value={postDesc} onChange={(e) => setPostDesc(e.target.value)}
                className="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPostLine(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm">Cancel</button>
              <button
                onClick={async () => {
                  if (await act(postLine.id, {
                    action: "post", kind: postKind,
                    expenseAccountCode: postAccount || undefined,
                    description: postDesc || undefined,
                  })) { setPostLine(null); setPostAccount(""); load(); }
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm">
                Post journal entry
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
