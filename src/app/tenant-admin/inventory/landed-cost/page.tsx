'use client';

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

export default function LandedCostPage() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receiptId, setReceiptId] = useState('');
  const [charges, setCharges] = useState<Record<string, string>[]>([{ name: 'Freight', amount: '', allocation: 'by_value' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function load() {
    const d = await fetch('/api/inventory/landed-cost').then((r) => r.json()).catch(() => ({}));
    setVouchers(d.vouchers ?? []);
  }
  useEffect(() => { void load(); }, []);

  useEffect(() => {
    fetch('/api/finance/purchase-receipts')
      .then((r) => r.json())
      .then((d) => setReceipts((d.receipts ?? []).filter((r: any) => r.status === 'received')))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setDone(null);
    try {
      const res = await fetch('/api/inventory/landed-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseReceiptId: receiptId,
          charges: charges.filter((c) => c.name && c.amount).map((c) => ({
            name: c.name, amount: Number(c.amount), allocationMethod: c.allocation,
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 202) { setDone('Sent for approval — the voucher applies once the chain signs off.'); }
      else if (!res.ok) throw new Error(d.error ?? 'Failed');
      else setDone('Landed cost applied — item unit costs updated.');
      setShowCreate(false); setReceiptId(''); setCharges([{ name: 'Freight', amount: '', allocation: 'by_value' }]);
      void load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Landed Cost Vouchers</h1>
          <p className="text-sm text-theme-text-secondary">
            Allocate freight, duty and insurance across received goods — item unit costs absorb the charge so valuation reflects true landed price.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus size={16} /> New Voucher
        </button>
      </div>
      {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
      {done && <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm">{done}</div>}

      <div className="border border-theme-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted text-left">
            <tr><th className="px-4 py-2">Voucher</th><th className="px-4 py-2">Receipt</th><th className="px-4 py-2">Charges</th><th className="px-4 py-2">Total</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">When</th></tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id} className="border-t border-theme-border">
                <td className="px-4 py-2 font-medium">{v.voucherNumber ?? v.voucher_number}</td>
                <td className="px-4 py-2">{v.receiptNumber ?? v.purchase_receipt_id?.slice(0, 8)}</td>
                <td className="px-4 py-2">{Array.isArray(v.charges) ? v.charges.map((c: any) => c.name).join(', ') : '—'}</td>
                <td className="px-4 py-2">₦{Number(v.totalAmount ?? v.total_amount ?? 0).toLocaleString()}</td>
                <td className="px-4 py-2">{v.status}</td>
                <td className="px-4 py-2">{String(v.createdAt ?? v.created_at).slice(0, 10)}</td>
              </tr>
            ))}
            {vouchers.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-theme-text-secondary">No vouchers yet — pick a received purchase receipt to allocate charges onto.</td></tr>}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-theme-surface rounded-xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-lg font-semibold text-theme-text-primary">New Landed Cost Voucher</h2>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-primary mb-1">Purchase receipt</label>
                <select value={receiptId} onChange={(e) => setReceiptId(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm" required>
                  <option value="">— Pick a received receipt —</option>
                  {receipts.map((r) => <option key={r.id} value={r.id}>{r.receiptNumber ?? r.receipt_number} — {r.vendorName ?? r.vendor_name ?? ''}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-theme-text-primary">Charges</label>
                  <button type="button" onClick={() => setCharges((c) => [...c, { name: '', amount: '', allocation: 'by_value' }])} className="text-xs text-purple-700 hover:underline">+ add</button>
                </div>
                {charges.map((c, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input placeholder="Charge (Freight, Duty…)" value={c.name} onChange={(e) => { const a=[...charges]; a[i]={...a[i],name:e.target.value}; setCharges(a); }} className="flex-1 border border-theme-border rounded px-2 py-1.5 text-sm" />
                    <input placeholder="Amount" type="number" min="0" value={c.amount} onChange={(e) => { const a=[...charges]; a[i]={...a[i],amount:e.target.value}; setCharges(a); }} className="w-28 border border-theme-border rounded px-2 py-1.5 text-sm" />
                    <select value={c.allocation} onChange={(e) => { const a=[...charges]; a[i]={...a[i],allocation:e.target.value}; setCharges(a); }} className="border border-theme-border rounded px-2 py-1.5 text-xs">
                      <option value="by_value">by value</option>
                      <option value="by_quantity">by qty</option>
                      <option value="manual">manual</option>
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-theme-border rounded-lg text-sm">Cancel</button>
                <button type="submit" disabled={loading || !receiptId} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                  {loading ? 'Applying…' : 'Apply voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
