"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";

interface VendorPayment {
  id: string;
  paymentNumber: string;
  vendorId: string;
  method: "bank_transfer" | "cash" | "corporate_card" | "other";
  currency: string;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  status: "draft" | "posted" | "reconciled" | "cancelled";
  paymentDate: string;
  applications: Array<{
    id: string;
    billId: string;
    appliedAmount: number;
  }>;
}

export default function VendorPaymentsWorkspace() {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    method: "",
    vendorId: ""
  });

  useEffect(() => {
    loadPayments();
  }, [filters]);

  const loadPayments = async () => {
    try {
      const params = new URLSearchParams({
        tenantSlug: "demo-tenant", // TODO: Get from context
        ...(filters.status && { status: filters.status }),
        ...(filters.method && { method: filters.method }),
        ...(filters.vendorId && { vendorId: filters.vendorId })
      });

      const response = await fetch(`/api/finance/vendor-payments?${params}`);
      const data = await response.json();
      setPayments(data.payments || []);
    } catch (error) {
      console.error("Failed to load payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      posted: "bg-blue-100 text-blue-800",
      reconciled: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getMethodLabel = (method: string) => {
    const labels = {
      bank_transfer: "Bank Transfer",
      cash: "Cash",
      corporate_card: "Corporate Card",
      other: "Other"
    };
    return labels[method as keyof typeof labels] || method;
  };

  if (loading) {
    return <div className="p-6">Loading vendor payments...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Vendor Payments</h1>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          New Payment
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-4 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="form-select"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="posted">Posted</option>
            <option value="reconciled">Reconciled</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          <select
            value={filters.method}
            onChange={(e) => setFilters({ ...filters, method: e.target.value })}
            className="form-select"
          >
            <option value="">All Methods</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
            <option value="corporate_card">Corporate Card</option>
            <option value="other">Other</option>
          </select>
          
          <input
            type="text"
            placeholder="Vendor ID"
            value={filters.vendorId}
            onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })}
            className="form-input"
          />
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Applied
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unapplied
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {payment.paymentNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.vendorId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getMethodLabel(payment.method)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(payment.paymentDate), "MMM dd, yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.currency} {payment.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.currency} {payment.appliedAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.currency} {payment.unappliedAmount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(payment.status)}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                      View
                    </button>
                    {payment.unappliedAmount > 0 && payment.status !== "cancelled" && (
                      <button className="text-green-600 hover:text-green-900">
                        Apply
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Payment Modal */}
      {showCreateModal && (
        <CreatePaymentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadPayments();
          }}
        />
      )}
    </div>
  );
}

interface CreatePaymentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePaymentModal({ onClose, onSuccess }: CreatePaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vendorId: "",
    method: "bank_transfer" as const,
    amount: "",
    paymentDate: new Date().toISOString().split('T')[0],
    currency: "NGN"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/finance/vendor-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: "demo-tenant",
          vendorId: formData.vendorId,
          method: formData.method,
          amount: parseFloat(formData.amount),
          paymentDate: formData.paymentDate,
          currency: formData.currency
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Payment creation failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Payment creation error:", error);
      alert("Payment creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Create Vendor Payment</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor ID
            </label>
            <input
              type="text"
              required
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
              className="form-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
              className="form-select w-full"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="corporate_card">Corporate Card</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="form-input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date
            </label>
            <input
              type="date"
              required
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              className="form-input w-full"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
