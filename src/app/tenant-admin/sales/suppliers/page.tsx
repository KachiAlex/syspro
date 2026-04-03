'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, Search, Mail, Phone } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

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

const DEFAULT_SUPPLIERS: Supplier[] = [
  { id: '1', name: 'Global Supply Co', contact: 'John Doe', email: 'john@globalsupply.com', phone: '+1-555-0101', rating: 4.5, status: 'Active', totalSpend: 45000 },
  { id: '2', name: 'Tech Parts Inc', contact: 'Sarah Smith', email: 'sarah@techparts.com', phone: '+1-555-0102', rating: 4.8, status: 'Active', totalSpend: 62000 },
  { id: '3', name: 'Premium Materials', contact: 'Mike Johnson', email: 'mike@premiummat.com', phone: '+1-555-0103', rating: 4.2, status: 'Active', totalSpend: 38000 },
  { id: '4', name: 'Bulk Distributors', contact: 'Lisa Brown', email: 'lisa@bulkdist.com', phone: '+1-555-0104', rating: 3.9, status: 'Inactive', totalSpend: 25000 },
];

export default function SuppliersPage() {
  const { tenantSlug } = useTenantContext();
  const [suppliers, setSuppliers] = useState<Supplier[]>(DEFAULT_SUPPLIERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const statuses = ['All', 'Active', 'Inactive', 'On Hold'];

  const filteredSuppliers = suppliers.filter((supplier) => {
    if (statusFilter !== 'All' && supplier.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!supplier.name.toLowerCase().includes(query) && !supplier.contact.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Suppliers</h2>
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
                placeholder="Supplier name or contact..."
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
              Add Supplier
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Supplier Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Rating</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Total Spend</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredSuppliers.length > 0 ? (
              filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{supplier.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{supplier.contact}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{supplier.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      ★ {supplier.rating}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      supplier.status === 'Active' ? 'bg-green-100 text-green-800' :
                      supplier.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {supplier.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">${supplier.totalSpend.toLocaleString()}</td>
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
                  No suppliers found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Suppliers</span>
              <span className="font-semibold text-gray-900">{suppliers.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-semibold text-green-600">{suppliers.filter(s => s.status === 'Active').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Spend</span>
              <span className="font-semibold text-gray-900">${suppliers.reduce((sum, s) => sum + s.totalSpend, 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Rated</h3>
          <div className="space-y-2">
            {suppliers.sort((a, b) => b.rating - a.rating).slice(0, 3).map((supplier) => (
              <div key={supplier.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{supplier.name}</span>
                <span className="text-sm font-semibold text-gray-900">★ {supplier.rating}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
          <div className="space-y-2">
            {statuses.filter(s => s !== 'All').map((status) => {
              const count = suppliers.filter(sup => sup.status === status).length;
              return (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{status}</span>
                  <span className="text-sm font-semibold text-gray-900">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
