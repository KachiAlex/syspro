'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingCart, Users, Package, Boxes, TrendingUp, Plus, Search, Filter, Download } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { 
  CreateSalesOrderModal, 
  CreatePurchaseOrderModal, 
  CreateSupplierModal, 
  AddInventoryItemModal 
} from '@/app/tenant-admin/sections/sales-procurement-modals';

export default function SalesPage() {
  const { tenantSlug } = useTenantContext();
  
  // Modal states
  const [showSalesOrderModal, setShowSalesOrderModal] = useState(false);
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({ orders: 0, revenue: 0, suppliers: 0, inventoryValue: 0 });

  // Load overview stats
  useEffect(() => {
    if (!tenantSlug) return;
    async function loadStats() {
      try {
        const [ordersRes, inventoryRes, suppliersRes] = await Promise.all([
          fetch(`/api/sales/orders?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=1`),
          fetch(`/api/inventory?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=1`),
          fetch(`/api/suppliers?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=1`),
        ]);
        const ordersData = ordersRes.ok ? await ordersRes.json() : {};
        const inventoryData = inventoryRes.ok ? await inventoryRes.json() : {};
        const suppliersData = suppliersRes.ok ? await suppliersRes.json() : {};
        setStats({
          orders: ordersData.total || ordersData.orders?.length || 0,
          revenue: ordersData.revenue || 0,
          suppliers: suppliersData.total || suppliersData.suppliers?.length || 0,
          inventoryValue: inventoryData.totalValue || 0,
        });
      } catch (err) {
        console.error('Failed to load sales stats:', err);
      }
    }
    loadStats();
  }, [tenantSlug]);

  // Modal handlers
  const handleCreateSalesOrder = async (data: any) => {
    if (!tenantSlug) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/sales/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tenantSlug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create sales order');
      setShowSalesOrderModal(false);
    } catch (error) {
      console.error('Error creating sales order:', error);
      alert(error instanceof Error ? error.message : 'Failed to create sales order');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePurchaseOrder = async (data: any) => {
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
      setShowPurchaseOrderModal(false);
    } catch (error) {
      console.error('Error creating purchase order:', error);
      alert(error instanceof Error ? error.message : 'Failed to create purchase order');
    } finally {
      setIsLoading(false);
    }
  };

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
      setShowSupplierModal(false);
    } catch (error) {
      console.error('Error creating supplier:', error);
      alert(error instanceof Error ? error.message : 'Failed to create supplier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddInventoryItem = async (data: any) => {
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
      setShowInventoryModal(false);
    } catch (error) {
      console.error('Error adding inventory item:', error);
      alert(error instanceof Error ? error.message : 'Failed to add inventory item');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Sales & Procurement Overview</h2>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button 
            onClick={() => setShowSalesOrderModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <ShoppingCart className="w-4 h-4" />
            New Order
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sales Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.orders}</p>
            </div>
            <ShoppingCart className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">This month</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600 mt-2">${stats.revenue.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">This month</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Suppliers</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{stats.suppliers}</p>
            </div>
            <Users className="w-12 h-12 text-purple-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Total vendors</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inventory Value</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">${stats.inventoryValue.toLocaleString()}</p>
            </div>
            <Boxes className="w-12 h-12 text-amber-500" />
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
            <span className="text-2xl font-bold text-blue-600">0</span>
            <span className="text-xs font-medium text-blue-600">View →</span>
          </div>
        </Link>

        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <Users className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Suppliers</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Manage vendor relationships</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-purple-600">0</span>
            <button 
              onClick={() => setShowSupplierModal(true)}
              className="text-xs font-medium text-purple-600 hover:text-purple-700"
            >
              Add New →
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <Package className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Purchase Orders</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Track procurement orders</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-green-600">0</span>
            <button 
              onClick={() => setShowPurchaseOrderModal(true)}
              className="text-xs font-medium text-green-600 hover:text-green-700"
            >
              New PO →
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
          <div className="flex items-center gap-3 mb-3">
            <Boxes className="w-6 h-6 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">Inventory</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Manage stock levels</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-amber-600">0</span>
            <button 
              onClick={() => setShowInventoryModal(true)}
              className="text-xs font-medium text-amber-600 hover:text-amber-700"
            >
              Add Item →
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Sales Orders</h3>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Search className="w-4 h-4" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="p-8 text-center text-gray-500 border border-dashed border-gray-200 rounded-lg">
            No recent sales orders
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateSalesOrderModal
        isOpen={showSalesOrderModal}
        onClose={() => setShowSalesOrderModal(false)}
        onSubmit={handleCreateSalesOrder}
        isLoading={isLoading}
      />

      <CreatePurchaseOrderModal
        isOpen={showPurchaseOrderModal}
        onClose={() => setShowPurchaseOrderModal(false)}
        onSubmit={handleCreatePurchaseOrder}
        isLoading={isLoading}
      />

      <CreateSupplierModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSubmit={handleCreateSupplier}
        isLoading={isLoading}
      />

      <AddInventoryItemModal
        isOpen={showInventoryModal}
        onClose={() => setShowInventoryModal(false)}
        onSubmit={handleAddInventoryItem}
        isLoading={isLoading}
      />
    </div>
  );
}
