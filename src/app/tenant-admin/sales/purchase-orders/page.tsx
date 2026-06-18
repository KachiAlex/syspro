'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, Search } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { 
  CreatePurchaseOrderModal, 
  ViewPurchaseOrderModal,
  EditPurchaseOrderModal,
  DeleteConfirmationModal 
} from '@/app/tenant-admin/sections/sales-procurement-modals';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  amount: number;
  status: string;
  poDate: string;
  dueDate: string;
  items: number;
}

export default function PurchaseOrdersPage() {
  const { tenantSlug } = useTenantContext();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statuses = ['All', 'Pending', 'In Transit', 'Received', 'Cancelled'];

  const filteredPos = purchaseOrders.filter((po) => {
    if (statusFilter !== 'All' && po.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!po.poNumber.toLowerCase().includes(query) && !po.supplier.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  // Load purchase orders on mount
  useEffect(() => {
    if (!tenantSlug) return;
    async function loadPOs() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/purchases/orders?tenantSlug=${encodeURIComponent(tenantSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setPurchaseOrders(data.orders || []);
        } else {
          throw new Error('Failed to fetch purchase orders');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load purchase orders');
      } finally {
        setIsLoading(false);
      }
    }
    loadPOs();
  }, [tenantSlug]);

  // Modal handlers
  const handleCreatePO = async (data: any) => {
    if (!tenantSlug) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/purchases/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tenantSlug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create purchase order');
      setPurchaseOrders(prev => [payload.order, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePO = async () => {
    if (!selectedPO) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/purchases/orders/${selectedPO.id}?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to delete purchase order');
      }
      setPurchaseOrders(prev => prev.filter(po => po.id !== selectedPO.id));
      setShowDeleteModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete purchase order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowViewModal(true);
  };

  const handleEditPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowEditModal(true);
  };

  const handleUpdatePO = async (data: any) => {
    if (!selectedPO || !tenantSlug) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/purchases/orders/${selectedPO.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tenantSlug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update purchase order');
      setPurchaseOrders(prev => prev.map(p => p.id === selectedPO.id ? { ...p, ...payload.order } : p));
      setShowEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update purchase order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowDeleteModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
        <Link
          href={`/tenant-admin/sales`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-theme-text-tertiary" />
              <input
                type="text"
                placeholder="PO # or supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New PO
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">PO #</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Supplier</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">PO Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Due Date</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredPos.length > 0 ? (
              filteredPos.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{po.poNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{po.supplier}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">${po.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      po.status === 'Received' ? 'bg-green-100 text-green-800' :
                      po.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                      po.status === 'In Transit' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{po.poDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{po.dueDate}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleViewPO(po)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-theme-accent-hover"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditPO(po)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(po)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-theme-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-600">
                  No purchase orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">PO Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total POs</span>
              <span className="font-semibold text-gray-900">{purchaseOrders.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Value</span>
              <span className="font-semibold text-gray-900">${purchaseOrders.reduce((sum, po) => sum + po.amount, 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg PO Value</span>
              <span className="font-semibold text-gray-900">${Math.round(purchaseOrders.reduce((sum, po) => sum + po.amount, 0) / purchaseOrders.length).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
          <div className="space-y-2">
            {statuses.filter(s => s !== 'All').map((status) => {
              const count = purchaseOrders.filter(po => po.status === status).length;
              return (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{status}</span>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Suppliers</h3>
          <div className="space-y-2">
            {purchaseOrders.slice(0, 3).map((po) => (
              <div key={po.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{po.supplier}</span>
                <span className="text-sm font-semibold text-gray-900">${po.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreatePurchaseOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePO}
        isLoading={isLoading}
      />

      <ViewPurchaseOrderModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        po={selectedPO}
      />

      <EditPurchaseOrderModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdatePO}
        isLoading={isLoading}
        po={selectedPO}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeletePO}
        isLoading={isLoading}
        itemType="Purchase Order"
        itemName={selectedPO?.poNumber || ''}
      />
    </div>
  );
}
