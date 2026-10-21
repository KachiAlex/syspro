"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Building2, Loader2, Plus, TrendingDown, X } from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

type Asset = {
  id: string; asset_no: string; name: string; category: string | null;
  acquisition_date: string; cost: number; salvage_value: number;
  useful_life_months: number; method: string;
  accumulated_depreciation: number; net_book_value: number; status: string;
};

type ScheduleRow = {
  id: string; period_date: string; amount: number; status: string;
};

export default function AssetsPage() {
  const { tenantSlug } = useTenantContext();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [schedule, setSchedule] = useState<{ asset: Asset; rows: ScheduleRow[] } | null>(null);
  const [disposeFor, setDisposeFor] = useState<Asset | null>(null);
  const [form, setForm] = useState({
    name: "", category: "", acquisitionDate: new Date().toISOString().slice(0, 10),
    cost: "", salvageValue: "0", usefulLifeMonths: "60", method: "straight_line",
  });
  const [disposeForm, setDisposeForm] = useState({
    disposalDate: new Date().toISOString().slice(0, 10), method: "sale", proceeds: "0",
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/finance/assets?tenantSlug=${tenantSlug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load assets");
      setAssets(data.assets ?? []);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const openSchedule = async (a: Asset) => {
    const res = await fetch(`/api/finance/assets?tenantSlug=${tenantSlug}&assetId=${a.id}`);
    const data = await res.json();
    setSchedule({ asset: a, rows: data.schedule ?? [] });
  };

  const submitNew = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/finance/assets?tenantSlug=${tenantSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, category: form.category || undefined,
          acquisitionDate: form.acquisitionDate, cost: Number(form.cost),
          salvageValue: Number(form.salvageValue || 0),
          usefulLifeMonths: Number(form.usefulLifeMonths), method: form.method,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setShowNew(false);
      setForm({ ...form, name: "", category: "", cost: "" });
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const submitDispose = async () => {
    if (!disposeFor) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/finance/assets/${disposeFor.id}?tenantSlug=${tenantSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dispose", disposalDate: disposeForm.disposalDate,
          method: disposeForm.method, proceeds: Number(disposeForm.proceeds || 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Disposal failed");
      setMsg(`Disposed — ${data.gainLoss >= 0 ? "gain" : "loss"} ${fmt(Math.abs(data.gainLoss))} posted`);
      setDisposeFor(null);
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const runDepreciation = async () => {
    setBusy(true); setError(null); setMsg(null);
    try {
      const res = await fetch(`/api/finance/assets/depreciation?tenantSlug=${tenantSlug}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Depreciation run failed");
      setMsg(`Posted ${data.posted?.length ?? 0} depreciation entries`);
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const totals = assets.reduce(
    (acc, a) => ({
      cost: acc.cost + Number(a.cost), accum: acc.accum + Number(a.accumulated_depreciation),
      nbv: acc.nbv + Number(a.net_book_value),
    }), { cost: 0, accum: 0, nbv: 0 });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">Fixed Assets</h1>
            <p className="text-sm text-slate-400">Register, depreciation schedule, disposal</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={runDepreciation} disabled={busy}
            className="flex items-center gap-1.5 rounded bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500 disabled:opacity-50">
            <TrendingDown className="h-4 w-4" /> Run depreciation
          </button>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
            <Plus className="h-4 w-4" /> New asset
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-400" />}

      <div className="grid grid-cols-3 gap-4">
        {[
          ["Total cost", totals.cost], ["Accum. depreciation", totals.accum], ["Net book value", totals.nbv],
        ].map(([label, v]) => (
          <div key={label as string} className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3">
            <div className="text-xs text-slate-400">{label}</div>
            <div className="text-lg font-semibold">{fmt(v as number)}</div>
          </div>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400">
            {["Asset", "Category", "Acquired", "Cost", "Accum. dep.", "NBV", "Method", "Status", ""].map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="border-t border-slate-800">
              <td className="px-3 py-2">
                <button onClick={() => openSchedule(a)} className="text-sky-400 hover:underline">
                  {a.asset_no} {a.name}
                </button>
              </td>
              <td className="px-3 py-2 text-slate-400">{a.category ?? "—"}</td>
              <td className="px-3 py-2">{String(a.acquisition_date).slice(0, 10)}</td>
              <td className="px-3 py-2">{fmt(a.cost)}</td>
              <td className="px-3 py-2">{fmt(a.accumulated_depreciation)}</td>
              <td className="px-3 py-2">{fmt(a.net_book_value)}</td>
              <td className="px-3 py-2 text-slate-400">{a.method === "straight_line" ? "SL" : "RB"}</td>
              <td className="px-3 py-2">
                <span className={`rounded px-2 py-0.5 text-xs ${
                  a.status === "active" ? "bg-emerald-500/15 text-emerald-400"
                  : a.status === "disposed" ? "bg-slate-500/15 text-slate-400"
                  : "bg-sky-500/15 text-sky-400"}`}>{a.status}</span>
              </td>
              <td className="px-3 py-2">
                {a.status !== "disposed" && (
                  <button onClick={() => setDisposeFor(a)} className="text-xs text-rose-400 hover:underline">
                    Dispose
                  </button>
                )}
              </td>
            </tr>
          ))}
          {assets.length === 0 && !loading && (
            <tr><td colSpan={9} className="px-3 py-6 text-center text-slate-500">No assets registered</td></tr>
          )}
        </tbody>
      </table>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New asset</h2>
              <button onClick={() => setShowNew(false)}><X className="h-4 w-4" /></button>
            </div>
            <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Asset name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="w-full rounded bg-slate-800 px-3 py-2 text-sm" placeholder="Category (optional)"
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">Acquired
                <input type="date" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={form.acquisitionDate} onChange={(e) => setForm({ ...form, acquisitionDate: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">Cost
                <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">Salvage value
                <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400">Useful life (months)
                <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={form.usefulLifeMonths} onChange={(e) => setForm({ ...form, usefulLifeMonths: e.target.value })} />
              </label>
              <label className="text-xs text-slate-400 col-span-2">Method
                <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                  value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  <option value="straight_line">Straight line</option>
                  <option value="reducing_balance">Reducing balance (2×)</option>
                </select>
              </label>
            </div>
            <button onClick={submitNew} disabled={busy || !form.name || !Number(form.cost)}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Saving…" : "Create asset + schedule"}
            </button>
          </div>
        </div>
      )}

      {schedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{schedule.asset.asset_no} — depreciation schedule</h2>
              <button onClick={() => setSchedule(null)}><X className="h-4 w-4" /></button>
            </div>
            <table className="mt-3 w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400">
                <th className="py-1">Period</th><th className="text-right">Amount</th><th className="text-right">Status</th>
              </tr></thead>
              <tbody>
                {schedule.rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="py-1.5">{String(r.period_date).slice(0, 10)}</td>
                    <td className="text-right">{fmt(r.amount)}</td>
                    <td className={`text-right ${r.status === "posted" ? "text-emerald-400" : "text-slate-400"}`}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {disposeFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Dispose {disposeFor.asset_no}</h2>
              <button onClick={() => setDisposeFor(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-sm text-slate-400">NBV {fmt(disposeFor.net_book_value)} — gain/loss posts to GL.</p>
            <label className="block text-xs text-slate-400">Date
              <input type="date" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={disposeForm.disposalDate} onChange={(e) => setDisposeForm({ ...disposeForm, disposalDate: e.target.value })} />
            </label>
            <label className="block text-xs text-slate-400">Method
              <select className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={disposeForm.method} onChange={(e) => setDisposeForm({ ...disposeForm, method: e.target.value })}>
                <option value="sale">Sale</option><option value="scrap">Scrap</option>
                <option value="donation">Donation</option><option value="write_off">Write-off</option>
              </select>
            </label>
            <label className="block text-xs text-slate-400">Proceeds
              <input type="number" className="w-full rounded bg-slate-800 px-3 py-2 text-sm"
                value={disposeForm.proceeds} onChange={(e) => setDisposeForm({ ...disposeForm, proceeds: e.target.value })} />
            </label>
            <button onClick={submitDispose} disabled={busy}
              className="w-full rounded bg-rose-600 py-2 text-sm hover:bg-rose-500 disabled:opacity-50">
              {busy ? "Posting…" : "Dispose + post GL"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
