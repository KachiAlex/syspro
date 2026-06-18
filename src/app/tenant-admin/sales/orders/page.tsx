'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, Search } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { 
  CreateSalesOrderModal, 
  ViewSalesOrderModal, 
  DeleteConfirmationModal 
} from '@/app/tenant-admin/sections/sales-procurement-modals';

interface SalesOrder {
  id: string;
  orderNumber: string;
  customer: string;
  amount: number;
  status: string;
  orderDate: string;
  dueDate: string;
  items: number;
}

export default function SalesOrdersPage() {
  const { tenantSlug } = useTenantContext();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const statuses = ['All', 'Pending', 'In Transit', 'Completed', 'Cancelled'];

  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== 'All' && order.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!order.orderNumber.toLowerCase().includes(query) && !order.customer.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  // Modal handlers
  const handleCreateOrder = async (data: any) => {
    setIsLoading(true);
    try {
      console.log('Creating sales order:', data);
      // TODO: API call to create sales order
    } catch (error) {
      console.error('Error creating sales order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    
    setIsLoading(true);
    try {
      console.log('Deleting sales order:', selectedOrder);
      // TODO: API call to delete sales order
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      // Remove order from local state
      setOrders(orders.filter(order => order.id !== selectedOrder.id));
    } catch (error) {
      console.error('Error deleting sales order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewOrder = (order: SalesOrder) => {
    setSelectedOrder(order);
    setShowViewModal(true);
  };

  const handleEditOrder = (order: SalesOrder) => {
    setSelectedOrder(order);
    // TODO: Implement edit modal
    console.log('Edit order:', order);
  };

  const handleDeleteClick = (order: SalesOrder) => {
    setSelectedOrder(order);
    setShowDeleteModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Sales Orders</h2>
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
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Order # or customer..."
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
              New Order
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Order #</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Order Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Due Date</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.orderNumber}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.customer}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">${order.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      order.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                      order.status === 'In Transit' ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.orderDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.dueDate}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleViewOrder(order)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditOrder(order)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(order)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700"
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
                  No orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Orders</span>
              <span className="font-semibold text-gray-900">{orders.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Revenue</span>
              <span className="font-semibold text-gray-900">${orders.reduce((sum, o) => sum + o.amount, 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg Order Value</span>
              <span className="font-semibold text-gray-900">${Math.round(orders.reduce((sum, o) => sum + o.amount, 0) / orders.length).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
          <div className="space-y-2">
            {statuses.filter(s => s !== 'All').map((status) => {
              const count = orders.filter(o => o.status === status).length;
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customers</h3>
          <div className="space-y-2">
            {orders.slice(0, 3).map((order) => (
              <div key={order.id} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{order.customer}</span>
                <span className="text-sm font-semibold text-gray-900">${order.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateSalesOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateOrder}
        isLoading={isLoading}
      />

      <ViewSalesOrderModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        order={selectedOrder}
      />

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteOrder}
        isLoading={isLoading}
        itemType="Sales Order"
        itemName={selectedOrder?.orderNumber || ''}
      />
    </div>
  );
}
