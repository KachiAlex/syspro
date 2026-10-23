'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, Search, Mail, Phone } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { 
  CreateSupplierModal, 
  ViewSupplierModal, 
  EditSupplierModal,
  DeleteConfirmationModal 
} from '@/app/tenant-admin/sections/sales-procurement-modals';

interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  rating: number;
  status: string;
  totalSpend: number;
}

export default function SuppliersPage() {
  const { tenantSlug } = useTenantContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statuses = ['All', 'Active', 'Inactive', 'On Hold'];

  const filteredSuppliers = suppliers.filter((supplier) => {
    if (statusFilter !== 'All' && supplier.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!supplier.name.toLowerCase().includes(query) && !supplier.contact.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  // Load suppliers on mount
  useEffect(() => {
    if (!tenantSlug) return;
    async function loadSuppliers() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/suppliers?tenantSlug=${encodeURIComponent(tenantSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setSuppliers(data.suppliers || []);
        } else {
          throw new Error('Failed to fetch suppliers');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load suppliers');
      } finally {
        setIsLoading(false);
      }
    }
    loadSuppliers();
  }, [tenantSlug]);

  // Modal handlers
  const handleCreateSupplier = async (data: any) => {
    if (!tenantSlug) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tenantSlug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create supplier');
      setSuppliers(prev => [payload.supplier, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!selectedSupplier) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to delete supplier');
      }
      setSuppliers(prev => prev.filter(supplier => supplier.id !== selectedSupplier.id));
      setShowDeleteModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete supplier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowViewModal(true);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowEditModal(true);
  };

  const handleUpdateSupplier = async (data: any) => {
    if (!selectedSupplier || !tenantSlug) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tenantSlug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update supplier');
      setSuppliers(prev => prev.map(s => s.id === selectedSupplier.id ? { ...s, ...payload.supplier } : s));
      setShowEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update supplier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">Suppliers</h2>
        <Link
          href={`/tenant-admin/sales`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-theme-text-tertiary" />
              <input
                type="text"
                placeholder="Supplier name or contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-theme-muted border-b border-theme-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Supplier Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Rating</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Total Spend</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-primary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-theme-muted">
                  <td className="px-6 py-4 text-sm font-medium text-theme-text-primary">{supplier.name}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{supplier.contact}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{supplier.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      ★ {supplier.rating}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      supplier.status === 'Active' ? 'bg-green-100 text-green-800' :
                      supplier.status === 'Inactive' ? 'bg-theme-muted text-theme-text-primary' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {supplier.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-theme-text-primary">${supplier.totalSpend.toLocaleString()}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleViewSupplier(supplier)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditSupplier(supplier)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(supplier)}
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
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-theme-text-secondary">
                  No suppliers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Supplier Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Total Suppliers</span>
              <span className="font-semibold text-theme-text-primary">{suppliers.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Active Suppliers</span>
              <span className="font-semibold text-theme-text-primary">{suppliers.filter(s => s.status === 'Active').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Avg Rating</span>
              <span className="font-semibold text-theme-text-primary">★ {(suppliers.reduce((sum, s) => sum + s.rating, 0) / suppliers.length).toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Status Breakdown</h3>
          <div className="space-y-2">
            {statuses.filter(s => s !== 'All').map((status) => {
              const count = suppliers.filter(s => s.status === status).length;
              return (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-theme-text-secondary">{status}</span>
                  <span className="text-sm font-semibold text-theme-text-primary">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Top Performers</h3>
          <div className="space-y-2">
            {suppliers
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 3)
              .map((supplier) => (
                <div key={supplier.id} className="flex items-center justify-between">
                  <span className="text-sm text-theme-text-secondary">{supplier.name}</span>
                  <span className="text-sm font-semibold text-theme-text-primary">★ {supplier.rating}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateSupplierModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSupplier}
        isLoading={isLoading}
      />

      <ViewSupplierModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        supplier={selectedSupplier}
      />

      <EditSupplierModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdateSupplier}
        isLoading={isLoading}
        supplier={selectedSupplier}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteSupplier}
        isLoading={isLoading}
        itemType="Supplier"
        itemName={selectedSupplier?.name || ''}
      />
    </div>
  );
}
