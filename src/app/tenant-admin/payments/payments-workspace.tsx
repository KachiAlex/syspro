"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { FormAlert } from "@/components/form";

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

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-900",
  posted: "bg-blue-100 text-blue-900",
  reconciled: "bg-green-100 text-green-900",
  cancelled: "bg-rose-100 text-rose-900"
};

const STATUS_ICONS: Record<string, string> = {
  draft: "📝",
  posted: "✓",
  reconciled: "✓✓",
  cancelled: "✕"
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  corporate_card: "Corporate Card",
  other: "Other"
};

export default function VendorPaymentsWorkspace() {
  const [payments, setPayments] = useState<VendorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
    setLoading(true);
    setError(null);
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
    } catch (err) {
      console.error("Failed to load payments:", err);
      setError("Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status] || STATUS_COLORS.draft;
  };

  const getStatusIcon = (status: string) => {
    return STATUS_ICONS[status] || "•";
  };

  const getMethodLabel = (method: string) => {
    return METHOD_LABELS[method] || method;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-slate-50 p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
          <p className="mt-3 text-slate-600">Loading payments…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Financial Management</p>
          <h1 className="text-2xl font-semibold text-slate-900">Vendor Payments</h1>
          <p className="mt-1 text-sm text-slate-600">Track and manage all vendor payments and reconciliations</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New Payment
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6">
        <p className="mb-4 text-sm font-semibold text-slate-900">Filters</p>
        <div className="grid grid-cols-3 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All Methods</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
            <option value="corporate_card">Corporate Card</option>
            <option value="other">Other</option>
          </select>
          
          <input
            type="text"
            placeholder="Search vendor…"
            value={filters.vendorId}
            onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Payments List */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Applied</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Unapplied</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="rounded-lg bg-blue-50 p-4 text-sm">
                      <p className="font-medium text-blue-900">No payments yet</p>
                      <p className="mt-1 text-blue-700">Create your first payment to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {payment.paymentNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {getMethodLabel(payment.method)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {format(new Date(payment.paymentDate), "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                      {payment.currency} {payment.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-600">
                      {payment.currency} {payment.appliedAmount.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 text-right text-sm font-medium ${payment.unappliedAmount > 0 ? "text-amber-600" : "text-slate-600"}`}>
                      {payment.currency} {payment.unappliedAmount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(payment.status)}`}>
                        {getStatusIcon(payment.status)} {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <button className="text-blue-600 hover:text-blue-900">View</button>
                        {payment.unappliedAmount > 0 && payment.status !== "cancelled" && (
                          <button className="text-green-600 hover:text-green-900">Apply</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
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
            setSuccess("Payment created successfully");
            setTimeout(() => setSuccess(null), 3000);
            loadPayments();
          }}
          onError={(err) => {
            setError(err);
          }}
        />
      )}
    </div>
  );
}

interface CreatePaymentModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

function CreatePaymentModal({ onClose, onSuccess, onError }: CreatePaymentModalProps) {
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
    
    if (!formData.vendorId.trim() || !formData.amount) {
      onError("Vendor ID and amount are required");
      return;
    }

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
        onError(error.error || "Payment creation failed");
      }
    } catch (error) {
      console.error("Payment creation error:", error);
      onError(error instanceof Error ? error.message : "Payment creation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Create Vendor Payment</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-900">
              Vendor ID
            </label>
            <input
              type="text"
              required
              value={formData.vendorId}
              onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Enter vendor ID"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-900">
              Payment Method
            </label>
            <select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="corporate_card">Corporate Card</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-900">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-900">
              Payment Date
            </label>
            <input
              type="date"
              required
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
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
