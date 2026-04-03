'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart, Users, Package, Boxes, TrendingUp } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

export default function SalesPage() {
  const { tenantSlug } = useTenantContext();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Sales & Procurement Overview</h2>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <ShoppingCart className="w-4 h-4" />
          New Order
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">24</p>
            </div>
            <ShoppingCart className="w-12 h-12 text-blue-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">This month</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600 mt-2">$185K</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">This month</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Suppliers</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">18</p>
            </div>
            <Users className="w-12 h-12 text-purple-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Total vendors</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inventory Value</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">$425K</p>
            </div>
            <Boxes className="w-12 h-12 text-amber-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Total stock</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={`/tenant-admin/sales/orders`}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Sales Orders</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Manage customer orders and sales</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-blue-600">24</span>
            <span className="text-xs font-medium text-blue-600">View →</span>
          </div>
        </Link>

        <Link
          href={`/tenant-admin/sales/suppliers`}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Suppliers</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Manage vendor relationships</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-purple-600">18</span>
            <span className="text-xs font-medium text-blue-600">View →</span>
          </div>
        </Link>

        <Link
          href={`/tenant-admin/sales/purchase-orders`}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Purchase Orders</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Track procurement orders</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-green-600">12</span>
            <span className="text-xs font-medium text-blue-600">View →</span>
          </div>
        </Link>

        <Link
          href={`/tenant-admin/sales/inventory`}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <Boxes className="w-6 h-6 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">Inventory</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Manage stock levels</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-amber-600">156</span>
            <span className="text-xs font-medium text-blue-600">View →</span>
          </div>
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sales Orders</h3>
        <div className="space-y-3">
          {[
            { id: 'SO-001', customer: 'Acme Corp', amount: '$8,500', status: 'Completed', date: '2026-04-03' },
            { id: 'SO-002', customer: 'Tech Solutions', amount: '$12,300', status: 'Pending', date: '2026-04-02' },
            { id: 'SO-003', customer: 'Global Industries', amount: '$15,600', status: 'In Transit', date: '2026-04-01' },
          ].map((order, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{order.id} - {order.customer}</p>
                <p className="text-xs text-gray-600 mt-1">{order.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-900">{order.amount}</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  order.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  order.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {order.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
