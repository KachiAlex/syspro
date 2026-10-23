'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, Search, Upload } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import {
  AddInventoryItemModal,
  ViewInventoryItemModal,
  EditInventoryItemModal,
  DeleteConfirmationModal
} from '@/app/tenant-admin/sections/sales-procurement-modals';
import ImportInventoryModal from '@/app/tenant-admin/components/ImportInventoryModal';

interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  location: string;
  status: string;
}

export default function InventoryPage() {
  const { tenantSlug } = useTenantContext();
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statuses = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];

  const filteredItems = inventoryItems.filter((item) => {
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(query) && !item.sku.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  // Load inventory on mount
  const loadInventory = async () => {
    if (!tenantSlug) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      if (res.ok) {
        const data = await res.json();
        setInventoryItems(data.items || []);
      } else {
        throw new Error('Failed to fetch inventory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const handleBulkImport = async (items: any[]) => {
    const res = await fetch(`/api/inventory/bulk?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || 'Failed to import items');
    await loadInventory();
    return payload;
  };

  // Modal handlers
  const handleAddItem = async (data: any) => {
    if (!tenantSlug) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tenantSlug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to add inventory item');
      setInventoryItems(prev => [payload.item, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add inventory item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory/${selectedItem.id}?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to delete inventory item');
      }
      setInventoryItems(prev => prev.filter(item => item.id !== selectedItem.id));
      setShowDeleteModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete inventory item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowViewModal(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const handleUpdateItem = async (data: any) => {
    if (!selectedItem || !tenantSlug) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/inventory/${selectedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tenantSlug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update inventory item');
      setInventoryItems(prev => prev.map(i => i.id === selectedItem.id ? { ...i, ...payload.item } : i));
      setShowEditModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update inventory item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">Inventory</h2>
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
                placeholder="Item name or SKU..."
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
          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted"
              title="Bulk import from CSV"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-theme-muted border-b border-theme-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Item Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Reorder Level</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Unit Price</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Location</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Status</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-primary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-theme-muted">
                  <td className="px-6 py-4 text-sm font-medium text-theme-text-primary">{item.sku}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{item.name}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-theme-text-primary">{item.quantity}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{item.reorderLevel}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">${item.unitPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{item.location}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      item.status === 'In Stock' ? 'bg-green-100 text-green-800' :
                      item.status === 'Low Stock' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleViewItem(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditItem(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(item)}
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
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-theme-text-secondary">
                  No items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Inventory Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Total Items</span>
              <span className="font-semibold text-theme-text-primary">{inventoryItems.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Total Quantity</span>
              <span className="font-semibold text-theme-text-primary">{inventoryItems.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Total Value</span>
              <span className="font-semibold text-theme-text-primary">${inventoryItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Status Breakdown</h3>
          <div className="space-y-2">
            {statuses.filter(s => s !== 'All').map((status) => {
              const count = inventoryItems.filter(item => item.status === status).length;
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
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Low Stock Alerts</h3>
          <div className="space-y-2">
            {inventoryItems
              .filter(item => item.status === 'Low Stock')
              .slice(0, 3)
              .map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-sm text-theme-text-secondary">{item.name}</span>
                  <span className="text-sm font-semibold text-amber-600">{item.quantity} left</span>
                </div>
              ))}
            {inventoryItems.filter(item => item.status === 'Low Stock').length === 0 && (
              <p className="text-sm text-theme-text-secondary">No low stock items</p>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddInventoryItemModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleAddItem}
        isLoading={isLoading}
      />

      <ViewInventoryItemModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        item={selectedItem}
      />

      <EditInventoryItemModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdateItem}
        isLoading={isLoading}
        item={selectedItem}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteItem}
        isLoading={isLoading}
        itemType="Inventory Item"
        itemName={selectedItem?.name || ''}
      />

      <ImportInventoryModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleBulkImport}
      />
    </div>
  );
}
