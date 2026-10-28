'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Package, Eye, Building, TrendingUp, X, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';

interface Requisition {
  id: string;
  requisitionNumber: string;
  items: Array<{ componentSku: string; componentName: string; quantity: number; unit: string; unitCost: number }>;
  totalAmount: number;
  status: string;
  source: string;
  notes: string | null;
  requestedBy: string | null;
  createdAt: string;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  items: any;
  quantity: number;
  amount: number;
  deliveryDate: string;
  status: string;
  createdAt: string;
}

interface GoodsReceipt {
  id: string;
  receiptNumber: string;
  poId: string | null;
  vendorId: string | null;
  items: any[];
  totalAmount: number;
  status: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  converted: 'bg-blue-100 text-blue-800',
  sent: 'bg-blue-100 text-blue-800',
  received: 'bg-green-100 text-green-800',
  partially_received: 'bg-blue-100 text-blue-800',
  closed: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-red-100 text-red-800',
  draft: 'bg-theme-muted text-theme-text-primary',
  matched: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
};

type Tab = 'requisitions' | 'purchase-orders' | 'goods-receipts';

export default function ProcurementComponent({ tenantSlug }: { tenantSlug: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('requisitions');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>([]);
  const [showCreateReq, setShowCreateReq] = useState(false);
  const [showCreatePo, setShowCreatePo] = useState(false);
  const [showCreateGr, setShowCreateGr] = useState(false);
  const [showReqDetail, setShowReqDetail] = useState<Requisition | null>(null);
  const [matchPo, setMatchPo] = useState<PurchaseOrder | null>(null);
  const [matchData, setMatchData] = useState<any>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const ts = tenantSlug;

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 3500); return () => clearTimeout(t); }
  }, [error]);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 3500); return () => clearTimeout(t); }
  }, [success]);

  const loadRequisitions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/procurement/requisitions?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => ({}));
      if (payload.success) setRequisitions(payload.data || []);
    } catch { setError('Failed to load requisitions'); }
    finally { setLoading(false); }
  }, [ts]);

  const loadPurchaseOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/procurement/purchase-orders`);
      const payload = await res.json().catch(() => ({}));
      setPurchaseOrders(payload.orders || []);
    } catch { setError('Failed to load purchase orders'); }
    finally { setLoading(false); }
  }, []);

  const loadGoodsReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/procurement/goods-receipts`);
      const payload = await res.json().catch(() => ({}));
      setGoodsReceipts(payload.receipts || []);
    } catch { setError('Failed to load goods receipts'); }
    finally { setLoading(false); }
  }, []);

  async function openMatch(po: PurchaseOrder) {
    setMatchPo(po);
    setMatchData(null);
    setMatchLoading(true);
    try {
      const res = await fetch(`/api/procurement/three-way-match?poId=${encodeURIComponent(po.id)}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to run three-way match');
      setMatchData(payload.match);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMatchPo(null);
    } finally { setMatchLoading(false); }
  }

  useEffect(() => {
    if (activeTab === 'requisitions') loadRequisitions();
    else if (activeTab === 'purchase-orders') loadPurchaseOrders();
    else if (activeTab === 'goods-receipts') loadGoodsReceipts();
  }, [activeTab, loadRequisitions, loadPurchaseOrders, loadGoodsReceipts]);

  async function handleReqAction(id: string, action: string) {
    try {
      const res = await fetch(`/api/procurement/requisitions?tenantSlug=${encodeURIComponent(ts)}&id=${encodeURIComponent(id)}&action=${action}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) throw new Error(payload.error || `Failed to ${action} requisition`);
      setSuccess(`Requisition ${action} successful`);
      await loadRequisitions();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const pendingCount = requisitions.filter(r => r.status === 'pending').length;
  const totalSpend = requisitions.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
  const approvedCount = requisitions.filter(r => r.status === 'approved').length;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'requisitions', label: 'Requisitions' },
    { key: 'purchase-orders', label: 'Purchase Orders' },
    { key: 'goods-receipts', label: 'Goods Receipts' },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-theme-text-primary mb-2">Procurement Workspace</h2>
        <p className="text-theme-text-secondary">Manage purchase requisitions, purchase orders, and goods receipts</p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-800 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Total Requisitions</p>
              <p className="text-xl font-bold text-theme-text-primary">{requisitions.length}</p>
            </div>
            <Package className="w-8 h-8 text-theme-accent" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Pending Approval</p>
              <p className="text-xl font-bold text-theme-text-primary">{pendingCount}</p>
            </div>
            <Building className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Total Requisition Value</p>
              <p className="text-xl font-bold text-theme-text-primary">₦{totalSpend.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Approved</p>
              <p className="text-xl font-bold text-theme-text-primary">{approvedCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-theme-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-theme-accent text-theme-accent'
                : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 mb-4">
        {activeTab === 'requisitions' && (
          <button onClick={() => setShowCreateReq(true)} className="px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Requisition
          </button>
        )}
        {activeTab === 'purchase-orders' && (
          <button onClick={() => setShowCreatePo(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Purchase Order
          </button>
        )}
        {activeTab === 'goods-receipts' && (
          <button onClick={() => setShowCreateGr(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Goods Receipt
          </button>
        )}
        <button
          onClick={() => activeTab === 'requisitions' ? loadRequisitions() : activeTab === 'purchase-orders' ? loadPurchaseOrders() : loadGoodsReceipts()}
          className="px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary hover:bg-theme-muted flex items-center gap-1"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-theme-border border-t-gray-900"></div>
          <p className="mt-2 text-sm text-theme-text-secondary">Loading...</p>
        </div>
      ) : activeTab === 'requisitions' ? (
        <RequisitionTab requisitions={requisitions} onView={(r) => setShowReqDetail(r)} onAction={handleReqAction} />
      ) : activeTab === 'purchase-orders' ? (
        <PurchaseOrderTab purchaseOrders={purchaseOrders} onMatch={openMatch} />
      ) : activeTab === 'goods-receipts' ? (
        <GoodsReceiptTab goodsReceipts={goodsReceipts} />
      ) : null}

      {/* Modals */}
      {showCreateReq && <CreateRequisitionModal tenantSlug={ts} onClose={() => setShowCreateReq(false)} onCreated={() => { setShowCreateReq(false); loadRequisitions(); }} />}
      {showCreatePo && <CreatePurchaseOrderModal tenantSlug={ts} onClose={() => setShowCreatePo(false)} onCreated={() => { setShowCreatePo(false); loadPurchaseOrders(); }} />}
      {showCreateGr && <CreateGoodsReceiptModal tenantSlug={ts} onClose={() => setShowCreateGr(false)} onCreated={() => { setShowCreateGr(false); loadGoodsReceipts(); }} />}
      {showReqDetail && <RequisitionDetailModal req={showReqDetail} onClose={() => setShowReqDetail(null)} />}
      {matchPo && <MatchModal po={matchPo} match={matchData} loading={matchLoading} onClose={() => { setMatchPo(null); setMatchData(null); }} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay" onClick={onClose}>
      <div className="bg-theme-surface rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-theme-border">
          <h3 className="text-lg font-semibold text-theme-text-primary">{title}</h3>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-secondary"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function RequisitionTab({ requisitions, onView, onAction }: { requisitions: Requisition[]; onView: (r: Requisition) => void; onAction: (id: string, action: string) => void }) {
  if (requisitions.length === 0) {
    return <div className="p-8 text-center text-theme-text-secondary border border-dashed border-theme-border rounded-lg">No requisitions found. Create one to get started.</div>;
  }
  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Req Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Source</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requisitions.map((req) => (
              <tr key={req.id} className="hover:bg-theme-muted">
                <td className="px-4 py-3 font-medium">{req.requisitionNumber}</td>
                <td className="px-4 py-3 capitalize">{req.source}</td>
                <td className="px-4 py-3">{Array.isArray(req.items) ? req.items.length : 0}</td>
                <td className="px-4 py-3 font-semibold">₦{Number(req.totalAmount || 0).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[req.status] || 'bg-theme-muted text-theme-text-primary'}`}>{req.status}</span>
                </td>
                <td className="px-4 py-3 text-theme-text-secondary">{req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => onView(req)} className="text-theme-accent hover:text-blue-800"><Eye className="w-4 h-4" /></button>
                    {req.status === 'pending' && (
                      <>
                        <button onClick={() => onAction(req.id, 'approve')} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Approve</button>
                        <button onClick={() => onAction(req.id, 'reject')} className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">Reject</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PurchaseOrderTab({ purchaseOrders, onMatch }: { purchaseOrders: PurchaseOrder[]; onMatch: (po: PurchaseOrder) => void }) {
  if (purchaseOrders.length === 0) {
    return <div className="p-8 text-center text-theme-text-secondary border border-dashed border-theme-border rounded-lg">No purchase orders found. Create one to get started.</div>;
  }
  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">PO Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Vendor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Qty</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Delivery Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Match</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {purchaseOrders.map((po) => (
              <tr key={po.id} className="hover:bg-theme-muted">
                <td className="px-4 py-3 font-medium">{po.poNumber}</td>
                <td className="px-4 py-3">{po.vendorId || '-'}</td>
                <td className="px-4 py-3">{po.quantity}</td>
                <td className="px-4 py-3 font-semibold">₦{Number(po.amount || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-theme-text-secondary">{po.deliveryDate ? new Date(po.deliveryDate).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[po.status] || 'bg-theme-muted text-theme-text-primary'}`}>{po.status}</span>
                </td>
                <td className="px-4 py-3 text-theme-text-secondary">{po.createdAt ? new Date(po.createdAt).toLocaleDateString() : '-'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => onMatch(po)} className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-theme-muted">3-Way Match</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GoodsReceiptTab({ goodsReceipts }: { goodsReceipts: GoodsReceipt[] }) {
  if (goodsReceipts.length === 0) {
    return <div className="p-8 text-center text-theme-text-secondary border border-dashed border-theme-border rounded-lg">No goods receipts found. Create one to get started.</div>;
  }
  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Receipt Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">PO Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Vendor</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {goodsReceipts.map((gr) => (
              <tr key={gr.id} className="hover:bg-theme-muted">
                <td className="px-4 py-3 font-medium">{gr.receiptNumber}</td>
                <td className="px-4 py-3">{gr.poId || '-'}</td>
                <td className="px-4 py-3">{gr.vendorId || '-'}</td>
                <td className="px-4 py-3">{Array.isArray(gr.items) ? gr.items.length : 0}</td>
                <td className="px-4 py-3 font-semibold">₦{Number(gr.totalAmount || 0).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[gr.status] || 'bg-theme-muted text-theme-text-primary'}`}>{gr.status}</span>
                </td>
                <td className="px-4 py-3 text-theme-text-secondary">{gr.createdAt ? new Date(gr.createdAt).toLocaleDateString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateRequisitionModal({ tenantSlug, onClose, onCreated }: { tenantSlug: string; onClose: () => void; onCreated: () => void }) {
  const [items, setItems] = useState([{ componentSku: '', componentName: '', quantity: '1', unit: 'pcs', unitCost: '0' }]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.some(i => !i.componentSku || !i.componentName)) { setError('All items need SKU and name'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/procurement/requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          items: items.map(i => ({ componentSku: i.componentSku, componentName: i.componentName, quantity: parseFloat(i.quantity), unit: i.unit, unitCost: parseFloat(i.unitCost) })),
          notes: notes || undefined,
          source: 'manual',
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success) throw new Error(payload.error || 'Failed to create requisition');
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="New Purchase Requisition" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
        <p className="text-sm text-theme-text-secondary">Add line items for materials you need to procure.</p>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-5 gap-2">
            <input placeholder="SKU" value={item.componentSku} onChange={(e) => { const n = [...items]; n[i].componentSku = e.target.value; setItems(n); }} className="border border-theme-border rounded px-2 py-1.5 text-sm" />
            <input placeholder="Name" value={item.componentName} onChange={(e) => { const n = [...items]; n[i].componentName = e.target.value; setItems(n); }} className="border border-theme-border rounded px-2 py-1.5 text-sm" />
            <input type="number" placeholder="Qty" value={item.quantity} onChange={(e) => { const n = [...items]; n[i].quantity = e.target.value; setItems(n); }} className="border border-theme-border rounded px-2 py-1.5 text-sm" />
            <input type="number" placeholder="Unit Cost" value={item.unitCost} onChange={(e) => { const n = [...items]; n[i].unitCost = e.target.value; setItems(n); }} className="border border-theme-border rounded px-2 py-1.5 text-sm" />
            <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, { componentSku: '', componentName: '', quantity: '1', unit: 'pcs', unitCost: '0' }])} className="text-theme-accent text-sm flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add Item
        </button>
        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm" rows={2} />
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary hover:bg-theme-muted">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-theme-accent text-white rounded-lg text-sm hover:bg-theme-accent-hover disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Requisition'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ItemRowsEditor({
  rows, onChange, columns,
}: {
  rows: Record<string, string>[];
  onChange: (rows: Record<string, string>[]) => void;
  columns: { key: string; label: string; numeric?: boolean }[];
}) {
  const input = 'w-full border border-theme-border rounded px-2 py-1.5 text-sm bg-theme-surface text-theme-text-primary';
  return (
    <div className="space-y-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr) 24px` }}>
        {columns.map((c) => <span key={c.key} className="text-xs font-medium uppercase tracking-wide text-theme-text-tertiary">{c.label}</span>)}
        <span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, 1fr) 24px` }}>
          {columns.map((c) => (
            <input
              key={c.key}
              type={c.numeric ? 'number' : 'text'}
              value={row[c.key] ?? ''}
              placeholder={c.label}
              onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, [c.key]: e.target.value } : r)))}
              className={input}
            />
          ))}
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="text-theme-text-tertiary hover:text-red-600" aria-label="Remove item">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, {}])} className="text-xs text-blue-700 underline">+ Add item</button>
      {!rows.length && <p className="text-xs text-theme-text-tertiary">Add each line item.</p>}
    </div>
  );
}

function rowsToItems(rows: Record<string, string>[], numericKeys: string[]): Record<string, any>[] {
  return rows
    .filter((r) => Object.values(r).some((v) => v?.trim?.()))
    .map((r) => Object.fromEntries(
      Object.entries(r)
        .filter(([, v]) => v !== '')
        .map(([k, v]) => [k, numericKeys.includes(k) ? Number(v) : v])
    ));
}

function CreatePurchaseOrderModal({ tenantSlug, onClose, onCreated }: { tenantSlug: string; onClose: () => void; onCreated: () => void }) {
  const [vendorId, setVendorId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('0');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [items, setItems] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId) { setError('Vendor ID is required'); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/procurement/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          vendorId,
          quantity: parseInt(quantity),
          amount: parseFloat(amount),
          deliveryDate: deliveryDate || undefined,
          items: rowsToItems(items, ['qty', 'quantity', 'unitCost']),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success && payload.error) throw new Error(payload.error);
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="New Purchase Order" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-theme-text-primary mb-1">Vendor ID</label>
          <input value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm" placeholder="Vendor ID" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">Quantity</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-1">Amount</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-theme-text-primary mb-1">Delivery Date</label>
          <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-theme-text-primary mb-1">Items</label>
          <ItemRowsEditor
            rows={items}
            onChange={setItems}
            columns={[
              { key: 'sku', label: 'SKU' },
              { key: 'name', label: 'Name' },
              { key: 'qty', label: 'Qty', numeric: true },
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary hover:bg-theme-muted">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create PO'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateGoodsReceiptModal({ tenantSlug, onClose, onCreated }: { tenantSlug: string; onClose: () => void; onCreated: () => void }) {
  const [poId, setPoId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [items, setItems] = useState<Record<string, string>[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poOptions, setPoOptions] = useState<any[]>([]);

  // Guided flow — pick an open PO, its remaining lines prefill the items.
  useEffect(() => {
    fetch('/api/procurement/purchase-orders')
      .then((r) => r.json())
      .then((d) => setPoOptions((d.purchaseOrders ?? d.data ?? []).filter((po: any) => !['received','cancelled','closed'].includes(po.status))))
      .catch(() => {});
  }, []);

  async function selectPo(id: string) {
    setPoId(id);
    if (!id) { setItems([]); return; }
    try {
      const res = await fetch(`/api/procurement/three-way-match?poId=${encodeURIComponent(id)}`);
      const m = await res.json();
      const lines = (m.items ?? m.lines ?? m.match?.items ?? []) as any[];
      const po = poOptions.find((x) => String(x.id) === id);
      if (po?.supplierId || po?.supplier_id || po?.vendorId) setVendorId(String(po.supplierId ?? po.supplier_id ?? po.vendorId));
      setItems(lines
        .filter((l: any) => Number(l.pendingQty ?? l.pending_quantity ?? l.quantity ?? 0) > 0)
        .map((l: any) => ({
          sku: l.sku ?? '',
          name: l.description ?? l.name ?? '',
          quantity: String(l.pendingQty ?? l.pending_quantity ?? l.quantity ?? ''),
          unitCost: String(l.unitPrice ?? l.unit_price ?? l.unitCost ?? 0),
        })));
    } catch { /* manual entry still works */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const parsedItems = rowsToItems(items, ['quantity', 'unitCost']);
      const res = await fetch('/api/procurement/goods-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          poId: poId || undefined,
          vendorId: vendorId || undefined,
          items: parsedItems,
          notes: notes || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!payload.success && payload.error) throw new Error(payload.error);
      onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="New Goods Receipt" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-50 text-red-800 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium text-theme-text-primary mb-1">Purchase Order</label>
          <select value={poId} onChange={(e) => selectPo(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm">
            <option value="">— Pick a PO to prefill its open lines, or leave blank for a free receipt —</option>
            {poOptions.map((po) => (
              <option key={po.id} value={po.id}>{po.orderNumber ?? po.order_number ?? po.id} — {po.supplierName ?? po.supplier_name ?? ''} ({po.status})</option>
            ))}
          </select>
          <p className="text-xs text-theme-text-secondary mt-1">Selecting a PO fills the items below with what is still outstanding — you cannot receive more than was ordered.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-theme-text-primary mb-1">Vendor ID</label>
          <input value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm" placeholder="Vendor ID" />
        </div>
        <div>
          <label className="block text-sm font-medium text-theme-text-primary mb-1">Items</label>
          <ItemRowsEditor
            rows={items}
            onChange={setItems}
            columns={[
              { key: 'sku', label: 'SKU' },
              { key: 'name', label: 'Name' },
              { key: 'quantity', label: 'Qty', numeric: true },
              { key: 'unitCost', label: 'Unit cost', numeric: true },
            ]}
          />
        </div>
        <textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-theme-border rounded px-3 py-2 text-sm" rows={2} />
        <div className="flex justify-end gap-2 pt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary hover:bg-theme-muted">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Receipt'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RequisitionDetailModal({ req, onClose }: { req: Requisition; onClose: () => void }) {
  return (
    <Modal title={`Requisition ${req.requisitionNumber}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="font-medium text-theme-text-primary">Status:</span> <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${STATUS_COLORS[req.status] || 'bg-theme-muted text-theme-text-primary'}`}>{req.status}</span></div>
          <div><span className="font-medium text-theme-text-primary">Source:</span> <span className="capitalize">{req.source}</span></div>
          <div><span className="font-medium text-theme-text-primary">Requested By:</span> {req.requestedBy || '-'}</div>
          <div><span className="font-medium text-theme-text-primary">Created:</span> {req.createdAt ? new Date(req.createdAt).toLocaleString() : '-'}</div>
        </div>
        {req.notes && <div className="text-sm"><span className="font-medium text-theme-text-primary">Notes:</span> {req.notes}</div>}
        <div>
          <h4 className="text-sm font-semibold text-theme-text-primary mb-2">Line Items</h4>
          <table className="w-full text-sm border border-theme-border rounded">
            <thead className="bg-theme-muted">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-theme-text-secondary">SKU</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-theme-text-secondary">Name</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-theme-text-secondary">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-theme-text-secondary">Unit Cost</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-theme-text-secondary">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(Array.isArray(req.items) ? req.items : []).map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{item.componentSku}</td>
                  <td className="px-3 py-2">{item.componentName}</td>
                  <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                  <td className="px-3 py-2 text-right">₦{Number(item.unitCost || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-semibold">₦{(item.quantity * item.unitCost).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-sm font-semibold text-right">Total: ₦{Number(req.totalAmount || 0).toLocaleString()}</div>
      </div>
    </Modal>
  );
}

function MatchModal({ po, match, loading, onClose }: { po: PurchaseOrder; match: any; loading: boolean; onClose: () => void }) {
  const money = (n: any) => `₦${Number(n || 0).toLocaleString()}`;
  return (
    <Modal title={`3-Way Match — ${po.poNumber || po.id}`} onClose={onClose}>
      {loading ? (
        <div className="py-10 text-center text-sm text-theme-text-secondary">Running match...</div>
      ) : !match ? (
        <div className="py-10 text-center text-sm text-theme-text-secondary">No match data.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-theme-text-primary">Verdict</span>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[match.summary?.status] || 'bg-theme-muted text-theme-text-primary'}`}>
              {match.summary?.allMatched ? 'matched' : 'disputed'} ({match.summary?.discrepancyCount ?? 0} discrepancies)
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="border border-theme-border rounded p-2"><div className="text-xs text-theme-text-secondary">PO Amount</div><div className="font-semibold">{money(match.summary?.poAmount)}</div></div>
            <div className="border border-theme-border rounded p-2"><div className="text-xs text-theme-text-secondary">Received</div><div className="font-semibold">{money(match.summary?.receiptAmount)}</div></div>
            <div className="border border-theme-border rounded p-2"><div className="text-xs text-theme-text-secondary">Billed</div><div className="font-semibold">{money(match.summary?.billAmount ?? match.summary?.invoiceAmount)}</div></div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>Vendor: <span className={match.summary?.vendorMatched ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{match.summary?.vendorMatched ? 'OK' : 'mismatch'}</span></div>
            <div>Lines: <span className={match.summary?.linesMatched ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{match.summary?.linesMatched ? 'OK' : 'mismatch'}</span></div>
            <div>Totals: <span className={match.summary?.totalsMatched ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{match.summary?.totalsMatched ? 'OK' : 'mismatch'}</span></div>
          </div>
          {Array.isArray(match.lineMatches) && match.lineMatches.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-theme-text-primary mb-2">Line Comparison</h4>
              <table className="w-full text-xs border border-theme-border rounded">
                <thead className="bg-theme-muted">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-theme-text-secondary">Item</th>
                    <th className="px-2 py-1.5 text-right font-medium text-theme-text-secondary">PO</th>
                    <th className="px-2 py-1.5 text-right font-medium text-theme-text-secondary">Received</th>
                    <th className="px-2 py-1.5 text-right font-medium text-theme-text-secondary">Billed</th>
                    <th className="px-2 py-1.5 text-center font-medium text-theme-text-secondary">Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {match.lineMatches.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="px-2 py-1.5">{l.description || l.key}</td>
                      <td className="px-2 py-1.5 text-right">{l.po ? `${l.po.quantity} × ${money(l.po.unitPrice)}` : '-'}</td>
                      <td className="px-2 py-1.5 text-right">{l.receipt ? `${l.receipt.quantity} × ${money(l.receipt.unitPrice)}` : '-'}</td>
                      <td className="px-2 py-1.5 text-right">{l.bill ? `${l.bill.quantity} × ${money(l.bill.unitPrice)}` : '-'}</td>
                      <td className="px-2 py-1.5 text-center">{l.matched ? <span className="text-green-600 font-semibold">✓</span> : <span className="text-red-600 font-semibold">✗</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {Array.isArray(match.discrepancies) && match.discrepancies.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-theme-text-primary mb-2">Discrepancies</h4>
              <ul className="space-y-1 text-xs text-red-700">
                {match.discrepancies.map((d: any, i: number) => <li key={i}>• {d.message}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

