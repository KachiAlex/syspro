'use client';

import React, { useEffect, useState } from 'react';

export default function ValuationPage() {
  const [data, setData] = useState<{ method: string; layers: any[]; cogs: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/inventory/valuation')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError('Failed to load valuation'));
  }, []);

  const totalValue = (data?.layers ?? []).reduce((s, l) => s + Number(l.quantity) * Number(l.unit_cost), 0);
  const totalCogs = (data?.cogs ?? []).reduce((s, r) => s + Number(r.cogs_amount ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-theme-text-primary">Stock Valuation</h1>
        <p className="text-sm text-theme-text-secondary">
          Method: <strong>{data?.method === 'fifo' ? 'FIFO (first-in, first-out)' : 'Moving average'}</strong>
          {data?.method !== 'fifo' && ' — switch to FIFO under Settings → Inventory.'}
        </p>
      </div>
      {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border border-theme-border rounded-lg p-4">
              <div className="text-xs text-theme-text-secondary uppercase">Open layers value</div>
              <div className="text-2xl font-bold text-theme-text-primary">₦{totalValue.toLocaleString()}</div>
            </div>
            <div className="border border-theme-border rounded-lg p-4">
              <div className="text-xs text-theme-text-secondary uppercase">COGS posted (recent)</div>
              <div className="text-2xl font-bold text-theme-text-primary">₦{totalCogs.toLocaleString()}</div>
            </div>
            <div className="border border-theme-border rounded-lg p-4">
              <div className="text-xs text-theme-text-secondary uppercase">Open layers</div>
              <div className="text-2xl font-bold text-theme-text-primary">{data.layers.length}</div>
            </div>
          </div>

          <div className="border border-theme-border rounded-lg overflow-hidden">
            <h2 className="px-4 py-3 font-semibold text-theme-text-primary bg-theme-muted">Open cost layers (oldest first)</h2>
            <table className="w-full text-sm">
              <thead className="text-left border-b border-theme-border">
                <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Qty left</th><th className="px-4 py-2">Unit cost</th><th className="px-4 py-2">Value</th><th className="px-4 py-2">Received</th></tr>
              </thead>
              <tbody>
                {data.layers.map((l, i) => (
                  <tr key={i} className="border-t border-theme-border">
                    <td className="px-4 py-2 font-mono text-xs">{l.product_sku}</td>
                    <td className="px-4 py-2">{Number(l.quantity)}</td>
                    <td className="px-4 py-2">₦{Number(l.unit_cost).toLocaleString()}</td>
                    <td className="px-4 py-2">₦{(Number(l.quantity) * Number(l.unit_cost)).toLocaleString()}</td>
                    <td className="px-4 py-2">{String(l.received_at).slice(0, 10)}</td>
                  </tr>
                ))}
                {data.layers.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-theme-text-secondary">No open layers — issues consume them oldest-first.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="border border-theme-border rounded-lg overflow-hidden">
            <h2 className="px-4 py-3 font-semibold text-theme-text-primary bg-theme-muted">Recent issues (COGS posted)</h2>
            <table className="w-full text-sm">
              <thead className="text-left border-b border-theme-border">
                <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Qty</th><th className="px-4 py-2">COGS</th><th className="px-4 py-2">When</th></tr>
              </thead>
              <tbody>
                {data.cogs.map((r, i) => (
                  <tr key={i} className="border-t border-theme-border">
                    <td className="px-4 py-2 font-mono text-xs">{r.product_sku}</td>
                    <td className="px-4 py-2">{r.movement_type}</td>
                    <td className="px-4 py-2">{Number(r.quantity)}</td>
                    <td className="px-4 py-2">₦{Number(r.cogs_amount).toLocaleString()}</td>
                    <td className="px-4 py-2">{String(r.created_at).slice(0, 10)}</td>
                  </tr>
                ))}
                {data.cogs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-theme-text-secondary">No issued movements yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
