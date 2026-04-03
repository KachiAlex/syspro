'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, Search, AlertCircle } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

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

const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: '1', sku: 'SKU-001', name: 'Component A', quantity: 250, reorderLevel: 50, unitPrice: 15.50, location: 'Warehouse A', status: 'In Stock' },
  { id: '2', sku: 'SKU-002', name: 'Component B', quantity: 45, reorderLevel: 100, unitPrice: 22.00, location: 'Warehouse B', status: 'Low Stock' },
  { id: '3', sku: 'SKU-003', name: 'Assembly C', quantity: 0, reorderLevel: 25, unitPrice: 85.00, location: 'Warehouse A', status: 'Out of Stock' },
  { id: '4', sku: 'SKU-004', name: 'Part D', quantity: 180, reorderLevel: 75, unitPrice: 12.50, location: 'Warehouse C', status: 'In Stock' },
  { id: '5', sku: 'SKU-005', name: 'Module E', quantity: 60, reorderLevel: 80, unitPrice: 45.00, location: 'Warehouse B', status: 'Low Stock' },
];

export default function InventoryPage() {
  const { tenantSlug } = useTenantContext();
  const [items, setItems] = useState<InventoryItem[]>(DEFAULT_INVENTORY);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const statuses = ['All', 'In Stock', 'Low Stock', 'Out of Stock'];

  const filteredItems = items.filter((item) => {
    if (statusFilter !== 'All' && item.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!item.sku.toLowerCase().includes(query) && !item.name.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  const totalInventoryValue = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
        <Link
          href={`/tenant-admin/sales`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="SKU or item name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
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
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">SKU</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Item Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Reorder Level</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Unit Price</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Location</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.sku}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.name}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{item.quantity}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.reorderLevel}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">${item.unitPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{item.location}</td>
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
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-600">
                  No inventory items found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Items</span>
              <span className="font-semibold text-gray-900">{items.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Units</span>
              <span className="font-semibold text-gray-900">{items.reduce((sum, i) => sum + i.quantity, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Value</span>
              <span className="font-semibold text-gray-900">${totalInventoryValue.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Status</h3>
          <div className="space-y-2">
            {statuses.filter(s => s !== 'All').map((status) => {
              const count = items.filter(i => i.status === status).length;
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Low Stock Alerts</h3>
          <div className="space-y-2">
            {items.filter(i => i.status !== 'In Stock').map((item) => (
              <div key={item.id} className="flex items-center gap-2 p-2 border border-amber-200 rounded-lg bg-amber-50">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-amber-900">{item.sku}</p>
                  <p className="text-xs text-amber-700">{item.quantity} / {item.reorderLevel}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
