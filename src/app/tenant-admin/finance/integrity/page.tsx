"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Search } from "lucide-react";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const inputCls = "rounded bg-theme-muted px-3 py-2 text-sm w-full";
const btnCls = "flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50";

export default function LedgerIntegrityPage() {
  const { tenantSlug } = useTenantContext();
  const [comparison, setComparison] = useState<any>(null);
  const [deletions, setDeletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [entryIds, setEntryIds] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<any[] | null>(null);

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const [c, d] = await Promise.all([
        fetch(`/api/finance/integrity?tenantSlug=${encodeURIComponent(tenantSlug)}&view=gl-vs-subledger`).then((r) => r.json()),
        fetch(`/api/finance/integrity?tenantSlug=${encodeURIComponent(tenantSlug)}&view=deletion-records`).then((r) => r.json()),
      ]);
      if (c.success) setComparison(c.data);
      if (d.success) setDeletions(d.data ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, [tenantSlug]);
  useEffect(() => { void load(); }, [load]);

  const ids = entryIds.split(",").map((s) => s.trim()).filter(Boolean);

  const doPreview = async () => {
    setBusy(true); setError(null);
    try {
      const j = await (await fetch(`/api/finance/integrity?tenantSlug=${encodeURIComponent(tenantSlug)}&view=repost-preview&entryIds=${ids.join(",")}`)).json();
      if (!j.success) throw new Error(j.error);
      setPreview(j.data);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const doRepost = async () => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch("/api/finance/integrity", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "repost", tenantSlug, entryIds: ids, reason: reason || undefined }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      setMsg(`Reposted ${j.data?.length ?? 0} entries (each: reverse + repost)`);
      setPreview(null); setEntryIds("");
      load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const Row = ({ label, side }: { label: string; side: any }) => (
    <tr className="border-b border-theme-border/60">
      <td className="py-2 pr-3 font-medium">{label}</td>
      <td className="py-2 pr-3 text-right font-mono">{fmt(side?.glBalance)}</td>
      <td className="py-2 pr-3 text-right font-mono">{fmt(side?.subledgerBalance)}</td>
      <td className={`py-2 pr-3 text-right font-mono ${Math.abs(side?.difference ?? 0) > 0.005 ? "text-rose-400" : "text-emerald-400"}`}>
        {fmt(side?.difference)}
      </td>
      <td className="py-2 text-xs text-theme-text-secondary">
        {side?.components && Object.entries(side.components).map(([k, v]) => `${k}: ${fmt(v as number)}`).join(" · ")}
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Ledger Integrity</h1>
          <p className="text-sm text-theme-text-secondary">GL ↔ subledger comparison, repost corrections, and transaction deletion audit.</p>
        </div>
        <button className={btnCls} onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="flex items-center gap-2 rounded bg-emerald-500/10 px-4 py-3 text-emerald-400"><CheckCircle2 className="h-4 w-4" />{msg}</div>}

      <section className="space-y-2">
        <h2 className="font-medium">GL vs Subledger</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
            <th className="py-2 pr-3">Control Account</th><th className="py-2 pr-3 text-right">GL Balance</th>
            <th className="py-2 pr-3 text-right">Subledger</th><th className="py-2 pr-3 text-right">Difference</th><th className="py-2">Components</th>
          </tr></thead>
          <tbody>
            {comparison ? (
              <>
                <Row label="Accounts Receivable (1200)" side={comparison.receivable} />
                <Row label="Accounts Payable (2100)" side={comparison.payable} />
              </>
            ) : (
              <tr><td colSpan={5} className="py-6 text-center text-theme-text-tertiary">{loading ? "Loading…" : "No data"}</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Repost Journal Entries</h2>
        <p className="text-xs text-theme-text-secondary">Reverses selected posted entries and re-posts them. Optionally correct account codes via corrections.</p>
        <div className="flex flex-wrap gap-2 items-end">
          <input className={`${inputCls} w-96 font-mono`} placeholder="Entry IDs (comma-separated)" value={entryIds} onChange={(e) => setEntryIds(e.target.value)} />
          <input className={`${inputCls} w-56`} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className={btnCls} disabled={busy || !ids.length} onClick={doPreview}><Search className="h-3.5 w-3.5" /> Preview</button>
          {preview && <button className={btnCls} disabled={busy} onClick={doRepost}>Repost {preview.length} entries</button>}
        </div>
        {preview && (
          <div className="rounded border border-theme-border p-3 space-y-3">
            {preview.map((e: any) => (
              <div key={e.entryId}>
                <div className="text-xs text-theme-text-secondary mb-1">{e.journalNumber} · {e.postingDate} · {e.description}</div>
                <table className="w-full text-xs font-mono">
                  <tbody>
                    {e.lines.map((l: any) => (
                      <tr key={l.lineId} className="border-b border-theme-border/40">
                        <td className="py-1 pr-3">{l.accountCode} {l.accountName}</td>
                        <td className="py-1 pr-3 text-right">{l.debitAmount ? fmt(l.debitAmount) : ""}</td>
                        <td className="py-1 text-right">{l.creditAmount ? fmt(l.creditAmount) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Merge Account</h2>
        <p className="text-xs text-theme-text-secondary">Rewrite every GL line and subledger reference from one account to another, then retire the source. <b>Not easily reversible.</b></p>
        <MergeForm tenantSlug={tenantSlug} onDone={() => { setMsg("Account merged"); load(); }} setError={setError} />
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Transaction Deletion Records</h2>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-theme-text-secondary border-b border-theme-border">
            <th className="py-2 pr-3">When</th><th className="py-2 pr-3">Doc Type</th><th className="py-2 pr-3">Doc ID</th>
            <th className="py-2 pr-3">Deleted By</th><th className="py-2">Reason</th>
          </tr></thead>
          <tbody>
            {deletions.map((d: any) => (
              <tr key={d.id} className="border-b border-theme-border/60">
                <td className="py-2 pr-3 text-xs">{String(d.created_at).slice(0, 16).replace("T", " ")}</td>
                <td className="py-2 pr-3">{d.document_type}</td>
                <td className="py-2 pr-3 font-mono text-xs">{String(d.document_id).slice(0, 12)}</td>
                <td className="py-2 pr-3">{d.deleted_by ?? "—"}</td>
                <td className="py-2 text-theme-text-secondary">{d.reason ?? "—"}</td>
              </tr>
            ))}
            {!deletions.length && <tr><td colSpan={5} className="py-6 text-center text-theme-text-tertiary">No deletion records</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function MergeForm({ tenantSlug, onDone, setError }: any) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/finance/integrity", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "merge-account", tenantSlug, fromCode: from, toCode: to, confirmed: true }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      setResult(j.data); onDone();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <input className="rounded bg-theme-muted px-3 py-2 text-sm w-36 font-mono" placeholder="From code" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-theme-text-secondary">→</span>
        <input className="rounded bg-theme-muted px-3 py-2 text-sm w-36 font-mono" placeholder="To code" value={to} onChange={(e) => setTo(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-rose-300">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I understand this is irreversible
        </label>
        <button className={btnCls} disabled={busy || !from || !to || !confirm || from === to} onClick={run}>Merge</button>
      </div>
      {result && <pre className="rounded bg-theme-muted p-3 text-xs overflow-auto">{JSON.stringify(result.stats, null, 2)}</pre>}
    </div>
  );
}
