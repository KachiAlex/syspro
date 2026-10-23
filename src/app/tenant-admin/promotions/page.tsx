"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle, BadgePercent, Ban, Loader2, Plus, X,
} from "lucide-react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

type Promo = {
  id: string; code: string; name: string; type: "percent" | "amount" | "bogo" | "bundle";
  percent: number | null; amount: number | null; buy_qty: number | null; get_qty: number | null;
  min_qty: number | null; bundle_price: number | null; skus: string[] | null;
  active_from: string; active_to: string; is_active: boolean;
};

const describe = (p: Promo) => {
  const scope = p.skus?.length ? ` on ${p.skus.join(", ")}` : " store-wide";
  switch (p.type) {
    case "percent": return `${p.percent}% off${scope}`;
    case "amount": return `${fmt(p.amount ?? 0)} off${scope}`;
    case "bogo": return `Buy ${p.buy_qty} get ${p.get_qty} free${scope}`;
    case "bundle": return `${p.min_qty}+ for ${fmt(p.bundle_price ?? 0)} each${scope}`;
    default: return p.type;
  }
};

export default function PromotionsPage() {
  const { tenantSlug } = useTenantContext();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", type: "percent", percent: "", amount: "",
    buyQty: "", getQty: "", minQty: "", bundlePrice: "", skus: "",
    activeFrom: "", activeTo: "",
  });

  const qs = () => `tenantSlug=${encodeURIComponent(tenantSlug)}`;

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true); setError(null);
    try {
      const data = await (await fetch(`/api/pos/promotions?${qs()}${showAll ? "&all=true" : ""}`)).json();
      setPromos(data.promotions ?? []);
      if (data.error) setError(data.error);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, showAll]);

  const live = (p: Promo) => {
    const now = Date.now();
    return p.is_active && new Date(p.active_from).getTime() <= now && new Date(p.active_to).getTime() >= now;
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BadgePercent className="h-6 w-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold">POS Promotions</h1>
            <p className="text-sm text-theme-text-secondary">Time-boxed discounts the till applies automatically at checkout</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-theme-text-secondary">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            include inactive
          </label>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
            <Plus className="h-4 w-4" /> New promotion
          </button>
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded bg-rose-500/10 px-4 py-3 text-rose-400"><AlertCircle className="h-4 w-4" />{error}</div>}
      {msg && <div className="rounded bg-emerald-500/10 px-4 py-3 text-emerald-400">{msg}</div>}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-theme-text-secondary" />}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-theme-text-secondary">
            {["Code", "Name", "Rule", "Window", "Status", ""].map((h) => (
              <th key={h} className="px-3 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {promos.map((p) => (
            <tr key={p.id} className="border-t border-theme-border">
              <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
              <td className="px-3 py-2">{p.name}</td>
              <td className="px-3 py-2 text-theme-text-primary">{describe(p)}</td>
              <td className="px-3 py-2 text-theme-text-secondary">
                {String(p.active_from).slice(0, 10)} → {String(p.active_to).slice(0, 10)}
              </td>
              <td className="px-3 py-2">
                <span className={`rounded px-2 py-0.5 text-xs ${
                  live(p) ? "bg-emerald-500/15 text-emerald-400" : "bg-theme-muted/15 text-theme-text-secondary"}`}>
                  {live(p) ? "live" : p.is_active ? "scheduled" : "inactive"}
                </span>
              </td>
              <td className="px-3 py-2">
                {p.is_active && (
                  <button disabled={busy}
                    onClick={async () => {
                      setBusy(true); setError(null);
                      try {
                        const res = await fetch(`/api/pos/promotions?${qs()}&id=${p.id}`, { method: "DELETE" });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error ?? "Failed");
                        setMsg("Promotion deactivated");
                        await load();
                      } catch (e: any) { setError(e.message); } finally { setBusy(false); }
                    }}
                    className="flex items-center gap-1 text-xs text-rose-400 hover:underline">
                    <Ban className="h-3 w-3" /> Deactivate
                  </button>
                )}
              </td>
            </tr>
          ))}
          {promos.length === 0 && !loading && (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-theme-text-tertiary">
              No promotions — create a time-boxed discount for the till.
            </td></tr>
          )}
        </tbody>
      </table>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-theme-border bg-theme-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">New promotion</h2>
              <button onClick={() => setShowNew(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded bg-theme-muted px-3 py-2 text-sm uppercase" placeholder="Code (e.g. EASTER10)"
                value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              <input className="rounded bg-theme-muted px-3 py-2 text-sm" placeholder="Name"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <label className="block text-xs text-theme-text-secondary">Type
              <select className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="percent">Percent off</option>
                <option value="amount">Fixed amount off</option>
                <option value="bogo">Buy X get Y free</option>
                <option value="bundle">Bundle price (N+ items)</option>
              </select>
            </label>
            {form.type === "percent" && (
              <label className="block text-xs text-theme-text-secondary">Percent off
                <input type="number" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} />
              </label>
            )}
            {form.type === "amount" && (
              <label className="block text-xs text-theme-text-secondary">Amount off
                <input type="number" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
            )}
            {form.type === "bogo" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-theme-text-secondary">Buy qty
                  <input type="number" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                    value={form.buyQty} onChange={(e) => setForm({ ...form, buyQty: e.target.value })} />
                </label>
                <label className="text-xs text-theme-text-secondary">Get free qty
                  <input type="number" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                    value={form.getQty} onChange={(e) => setForm({ ...form, getQty: e.target.value })} />
                </label>
              </div>
            )}
            {form.type === "bundle" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-theme-text-secondary">Min qty
                  <input type="number" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                    value={form.minQty} onChange={(e) => setForm({ ...form, minQty: e.target.value })} />
                </label>
                <label className="text-xs text-theme-text-secondary">Bundle price each
                  <input type="number" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                    value={form.bundlePrice} onChange={(e) => setForm({ ...form, bundlePrice: e.target.value })} />
                </label>
              </div>
            )}
            <input className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
              placeholder="Restrict to SKUs (comma-separated, blank = all)"
              value={form.skus} onChange={(e) => setForm({ ...form, skus: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-theme-text-secondary">Active from
                <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.activeFrom} onChange={(e) => setForm({ ...form, activeFrom: e.target.value })} />
              </label>
              <label className="text-xs text-theme-text-secondary">Active to
                <input type="date" className="w-full rounded bg-theme-muted px-3 py-2 text-sm"
                  value={form.activeTo} onChange={(e) => setForm({ ...form, activeTo: e.target.value })} />
              </label>
            </div>
            <button disabled={busy || !form.code || !form.name}
              onClick={async () => {
                setBusy(true); setError(null); setMsg(null);
                try {
                  const res = await fetch(`/api/pos/promotions?${qs()}`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      code: form.code, name: form.name, type: form.type,
                      percent: form.percent ? Number(form.percent) : undefined,
                      amount: form.amount ? Number(form.amount) : undefined,
                      buyQty: form.buyQty ? Number(form.buyQty) : undefined,
                      getQty: form.getQty ? Number(form.getQty) : undefined,
                      minQty: form.minQty ? Number(form.minQty) : undefined,
                      bundlePrice: form.bundlePrice ? Number(form.bundlePrice) : undefined,
                      skus: form.skus ? form.skus.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                      activeFrom: form.activeFrom || undefined,
                      activeTo: form.activeTo || undefined,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error ?? "Create failed");
                  setMsg("Promotion created"); setShowNew(false);
                  await load();
                } catch (e: any) { setError(e.message); } finally { setBusy(false); }
              }}
              className="w-full rounded bg-emerald-600 py-2 text-sm hover:bg-emerald-500 disabled:opacity-50">
              {busy ? "Saving…" : "Create promotion"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
