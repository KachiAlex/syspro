'use client';

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

type Note = {
  id: string; noteNumber?: string; note_number?: string;
  customerName?: string; customer_name?: string; status: string;
  totalAmount?: number; total_amount?: number;
  deliveryDate?: string; delivery_date?: string;
  driver?: string; vehicle?: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  delivered: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-theme-muted text-theme-text-secondary',
};

export default function DeliveriesPage() {
  const { tenantSlug } = useTenantContext();
  const [notes, setNotes] = useState<Note[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/sales/delivery-notes');
      const d = await res.json();
      setNotes(d.notes ?? []);
    } catch {
      setError('Failed to load delivery notes');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Delivery Notes</h1>
          <p className="text-sm text-theme-text-secondary">
            Record goods leaving the warehouse against sales orders — stock only moves
            when the note is delivered (or approved, if your policy requires sign-off).
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
        >
          <Plus size={16} /> New Delivery Note
        </button>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}

      {loading ? (
        <div className="text-theme-text-secondary text-sm">Loading…</div>
      ) : notes.length === 0 ? (
        <div className="border border-theme-border rounded-lg p-10 text-center">
          <p className="text-theme-text-secondary mb-2">No delivery notes yet.</p>
          <p className="text-xs text-theme-text-secondary">
            Pick a sales order when creating one — its undelivered lines prefill automatically.
          </p>
        </div>
      ) : (
        <div className="border border-theme-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-theme-muted text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Driver / Vehicle</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id} className="border-t border-theme-border">
                  <td className="px-4 py-3 font-medium">{n.noteNumber ?? n.note_number}</td>
                  <td className="px-4 py-3">{n.customerName ?? n.customer_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {(n.deliveryDate ?? n.delivery_date) ? String(n.deliveryDate ?? n.delivery_date).slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-3">₦{Number(n.totalAmount ?? n.total_amount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3">{[n.driver, n.vehicle].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[n.status] ?? 'bg-theme-muted'}`}>
                      {n.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && tenantSlug && (
        <CreateDeliveryModal
          tenantSlug={tenantSlug}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); void load(); }}
        />
      )}
    </div>
  );
}

function CreateDeliveryModal({ onClose, onCreated }: { tenantSlug: string; onClose: () => void; onCreated: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [soId, setSoId] = useState('');
  const [items, setItems] = useState<Record<string, string>[]>([]);
  const [driver, setDriver] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/sales/orders')
      .then((r) => r.json())
      .then((d) => setOrders((d.orders ?? d.data ?? []).filter((o: any) => !['delivered', 'cancelled', 'closed'].includes(o.status))))
      .catch(() => {});
  }, []);

  async function selectSo(id: string) {
    setSoId(id);
    if (!id) { setItems([]); return; }
    const order = orders.find((o) => String(o.id) === id);
    const soItems: any[] = Array.isArray(order?.items) ? order.items : [];
    // Remaining = ordered − already delivered across this SO's open/delivered notes
    const delivered: Record<string, number> = {};
    try {
      const res = await fetch(`/api/sales/delivery-notes?salesOrderId=${encodeURIComponent(id)}`);
      const d = await res.json();
      for (const note of d.notes ?? []) {
        const detail = await fetch(`/api/sales/delivery-notes?id=${note.id}`).then((r) => r.json());
        for (const li of detail.note?.items ?? []) {
          const k = String(li.so_line_key ?? li.sku ?? li.description);
          delivered[k] = (delivered[k] ?? 0) + Number(li.delivered_qty ?? 0);
        }
      }
    } catch {
      // Prefill stays unadjusted — the server still rejects over-delivery.
    }
    setItems(
      soItems.map((it, idx) => {
        const key = String(it.sku ?? it.description ?? it.name ?? `line-${idx}`);
        const ordered = Number(it.qty ?? it.quantity ?? 0);
        const remaining = Math.max(0, ordered - (delivered[key] ?? 0));
        return remaining > 0
          ? { key, sku: it.sku ?? '', name: it.description ?? it.name ?? '', quantity: String(remaining), unitPrice: String(it.unitPrice ?? it.price ?? 0) }
          : null;
      }).filter(Boolean) as Record<string, string>[]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const order = orders.find((o) => String(o.id) === soId);
      const res = await fetch('/api/sales/delivery-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salesOrderId: soId || undefined,
          customerId: order?.customer_id ?? undefined,
          customerName: order?.customer_name ?? order?.customer ?? undefined,
          deliveryDate: new Date().toISOString().slice(0, 10),
          driver: driver || undefined,
          vehicle: vehicle || undefined,
          items: items.map((i) => ({
            soLineKey: i.key,
            sku: i.sku,
            description: i.name,
            deliveredQty: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 202) throw new Error(d.error ?? 'Failed to create note');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-theme-surface rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-theme-text-primary mb-4">New Delivery Note</h2>
        <form onSubmit={submit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">Sales Order</label>
            <select value={soId} onChange={(e) => selectSo(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm">
              <option value="">— Pick an order to prefill its undelivered lines —</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number ?? o.orderNumber ?? o.id} — {o.customer_name ?? o.customer ?? ''} ({o.status})
                </option>
              ))}
            </select>
            <p className="text-xs text-theme-text-secondary mt-1">
              Only quantities still open on the order prefill — the server blocks over-delivery.
            </p>
          </div>
          {items.length > 0 && (
            <div className="border border-theme-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-theme-muted text-left">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2 w-28">Qty to deliver</th>
                    <th className="px-3 py-2 w-28">Unit price</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t border-theme-border">
                      <td className="px-3 py-2">{it.name || it.sku}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min="0" value={it.quantity}
                          onChange={(e) => { const a = [...items]; a[i] = { ...a[i], quantity: e.target.value }; setItems(a); }}
                          className="w-full border border-theme-border rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min="0" value={it.unitPrice}
                          onChange={(e) => { const a = [...items]; a[i] = { ...a[i], unitPrice: e.target.value }; setItems(a); }}
                          className="w-full border border-theme-border rounded px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Driver (optional)" value={driver} onChange={(e) => setDriver(e.target.value)}
              className="border border-theme-border rounded px-3 py-2 text-sm"
            />
            <input
              placeholder="Vehicle (optional)" value={vehicle} onChange={(e) => setVehicle(e.target.value)}
              className="border border-theme-border rounded px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary hover:bg-theme-muted">
              Cancel
            </button>
            <button type="submit" disabled={loading || items.length === 0} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
              {loading ? 'Creating…' : 'Create Note'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
