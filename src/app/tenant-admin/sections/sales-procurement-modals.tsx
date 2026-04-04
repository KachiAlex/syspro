"use client";

import React, { useState } from "react";
import { X, AlertTriangle, Package, Users, ShoppingCart, Plus, Search, Filter, Download, Edit, Trash2, Eye, Mail, Phone, MapPin, Calendar, DollarSign, Star } from "lucide-react";

// Sales Order Modal
export interface SalesOrderFormData {
  customerId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes: string;
}

export function CreateSalesOrderModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SalesOrderFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<SalesOrderFormData>({
    customerId: "",
    orderDate: new Date().toISOString().split("T")[0],
    expectedDeliveryDate: "",
    items: [],
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.customerId) {
      setError("Customer is required");
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError("Failed to create sales order");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Sales Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Customer</option>
                <option value="1">Acme Corp</option>
                <option value="2">Tech Solutions</option>
                <option value="3">Global Industries</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
              <input
                type="date"
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Items</label>
            <div className="border border-gray-200 rounded-lg p-4">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
              <p className="text-sm text-gray-500 mt-2">No items added yet</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// View Sales Order Modal
export function ViewSalesOrderModal({
  isOpen,
  onClose,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}) {
  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Sales Order Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Order Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Order Number:</span>
                  <span className="text-sm font-medium text-gray-900">{order.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Customer:</span>
                  <span className="text-sm font-medium text-gray-900">{order.customer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Order Date:</span>
                  <span className="text-sm font-medium text-gray-900">{order.orderDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Due Date:</span>
                  <span className="text-sm font-medium text-gray-900">{order.dueDate}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Financial Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Amount:</span>
                  <span className="text-sm font-medium text-gray-900">${order.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    order.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    order.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Items:</span>
                  <span className="text-sm font-medium text-gray-900">{order.items}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Order Items</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Quantity</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Unit Price</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="px-4 py-2 text-sm text-gray-900">Sample Product</td>
                    <td className="px-4 py-2 text-sm text-gray-900">1</td>
                    <td className="px-4 py-2 text-sm text-gray-900">${order.amount.toLocaleString()}</td>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">${order.amount.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Delete Confirmation Modal
export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  itemType,
  itemName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
  itemType: string;
  itemName: string;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(`Failed to delete ${itemType.toLowerCase()}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Delete {itemType}</h2>
              <p className="text-sm text-gray-600">This action cannot be undone.</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              Are you sure you want to delete <span className="font-medium text-gray-900">"{itemName}"</span>?
            </p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? "Deleting..." : `Delete ${itemType}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Purchase Order Modal
export interface PurchaseOrderFormData {
  supplierId: string;
  orderDate: string;
  expectedDeliveryDate: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  notes: string;
}

export function CreatePurchaseOrderModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PurchaseOrderFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<PurchaseOrderFormData>({
    supplierId: "",
    orderDate: new Date().toISOString().split("T")[0],
    expectedDeliveryDate: "",
    items: [],
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.supplierId) {
      setError("Supplier is required");
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError("Failed to create purchase order");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create Purchase Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">Select Supplier</option>
                <option value="1">Office Supplies Co</option>
                <option value="2">Tech Hardware Ltd</option>
                <option value="3">Industrial Materials Inc</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Date</label>
              <input
                type="date"
                value={formData.orderDate}
                onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery</label>
              <input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Items</label>
            <div className="border border-gray-200 rounded-lg p-4">
              <button
                type="button"
                className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
              <p className="text-sm text-gray-500 mt-2">No items added yet</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Supplier Modal
export interface SupplierFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  paymentTerms: string;
}

export function CreateSupplierModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SupplierFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<SupplierFormData>({
    name: "",
    email: "",
    phone: "",
    address: "",
    category: "general",
    paymentTerms: "NET 30",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Supplier name is required");
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError("Failed to create supplier");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add New Supplier</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter supplier name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="supplier@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="general">General</option>
                <option value="technology">Technology</option>
                <option value="office">Office Supplies</option>
                <option value="industrial">Industrial</option>
                <option value="services">Services</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter supplier address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
            <select
              value={formData.paymentTerms}
              onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="NET 15">NET 15</option>
              <option value="NET 30">NET 30</option>
              <option value="NET 60">NET 60</option>
              <option value="COD">COD</option>
              <option value="Immediate">Immediate</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add Supplier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// View Supplier Modal
export function ViewSupplierModal({
  isOpen,
  onClose,
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  supplier: any;
}) {
  if (!isOpen || !supplier) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Supplier Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
              <Users className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{supplier.name}</h3>
              <p className="text-sm text-gray-600">Contact: {supplier.contact}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">Contact Information</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900">{supplier.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900">{supplier.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-900">123 Supplier St, City, State</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">Business Information</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Rating:</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-current" />
                    <span className="text-sm font-medium text-gray-900">{supplier.rating}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    supplier.status === 'Active' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {supplier.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Spend:</span>
                  <span className="text-sm font-medium text-gray-900">${supplier.totalSpend.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Inventory Item Modal
export interface InventoryFormData {
  productName: string;
  sku: string;
  category: string;
  quantity: number;
  unitPrice: number;
  reorderLevel: number;
  location: string;
  description: string;
}

export function AddInventoryItemModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InventoryFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<InventoryFormData>({
    productName: "",
    sku: "",
    category: "general",
    quantity: 0,
    unitPrice: 0,
    reorderLevel: 10,
    location: "",
    description: "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.productName.trim()) {
      setError("Product name is required");
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError("Failed to add inventory item");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Inventory Item</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter product name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="SKU-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="general">General</option>
                <option value="electronics">Electronics</option>
                <option value="furniture">Furniture</option>
                <option value="supplies">Office Supplies</option>
                <option value="equipment">Equipment</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Warehouse A, Shelf 1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
              <input
                type="number"
                value={formData.unitPrice}
                onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
              <input
                type="number"
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="10"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Product description..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// View Inventory Item Modal
export function ViewInventoryItemModal({
  isOpen,
  onClose,
  item,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: any;
}) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Inventory Item Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Package className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
              <p className="text-sm text-gray-600">SKU: {item.sku}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">Stock Information</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current Quantity:</span>
                  <span className="text-sm font-medium text-gray-900">{item.quantity}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Reorder Level:</span>
                  <span className="text-sm font-medium text-gray-900">{item.reorderLevel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'In Stock' ? 'bg-green-100 text-green-800' :
                    item.status === 'Low Stock' ? 'bg-amber-100 text-amber-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {item.status}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-3">Pricing & Location</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Unit Price:</span>
                  <span className="text-sm font-medium text-gray-900">${item.unitPrice.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Value:</span>
                  <span className="text-sm font-medium text-gray-900">${(item.quantity * item.unitPrice).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Location:</span>
                  <span className="text-sm font-medium text-gray-900">{item.location}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
