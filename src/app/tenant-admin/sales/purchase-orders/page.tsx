'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, Search } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

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

const DEFAULT_POS: PurchaseOrder[] = [
  { id: '1', poNumber: 'PO-001', supplier: 'Global Supply Co', amount: 12500, status: 'Received', poDate: '2026-03-25', dueDate: '2026-04-05', items: 8 },
  { id: '2', poNumber: 'PO-002', supplier: 'Tech Parts Inc', amount: 18700, status: 'Pending', poDate: '2026-03-28', dueDate: '2026-04-10', items: 15 },
  { id: '3', poNumber: 'PO-003', supplier: 'Premium Materials', amount: 9300, status: 'In Transit', poDate: '2026-03-30', dueDate: '2026-04-08', items: 5 },
  { id: '4', poNumber: 'PO-004', supplier: 'Global Supply Co', amount: 15600, status: 'Pending', poDate: '2026-04-01', dueDate: '2026-04-15', items: 12 },
];

export default function PurchaseOrdersPage() {
  const { tenantSlug } = useTenantContext();
  const [pos, setPos] = useState<PurchaseOrder[]>(DEFAULT_POS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const statuses = ['All', 'Pending', 'In Transit', 'Received', 'Cancelled'];

  const filteredPos = pos.filter((po) => {
    if (statusFilter !== 'All' && po.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!po.poNumber.toLowerCase().includes(query) && !po.supplier.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
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
                placeholder="PO # or supplier..."
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
              <span className="font-semibold text-gray-900">{pos.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Committed</span>
              <span className="font-semibold text-gray-900">${pos.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg PO Value</span>
              <span className="font-semibold text-gray-900">${Math.round(pos.reduce((sum, p) => sum + p.amount, 0) / pos.length).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
          <div className="space-y-2">
            {statuses.filter(s => s !== 'All').map((status) => {
              const count = pos.filter(p => p.status === status).length;
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
            {pos.slice(0, 3).map((po) => (
              <div key={po.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{po.supplier}</span>
                <span className="text-sm font-semibold text-gray-900">${po.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
