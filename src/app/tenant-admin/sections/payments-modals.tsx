"use client";

import React, { useState } from "react";
import { X, CreditCard, AlertCircle } from "lucide-react";

// Create Payment Modal
export function CreatePaymentModalV2({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
}) {
  const [formData, setFormData] = useState({
    amount: "",
    method: "card",
    reference: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = "Amount must be greater than 0";
    if (!formData.method) newErrors.method = "Payment method is required";
    if (!formData.reference.trim()) newErrors.reference = "Reference is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      await onSubmit(formData);
      setFormData({ amount: "", method: "card", reference: "", description: "", date: new Date().toISOString().split("T")[0] });
    } catch (_err) {
      // Error handled by parent
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">Create Payment</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-slate-900 mb-2">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              step="0.01"
              min="0"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.amount ? "border-rose-300 bg-rose-50" : "border-slate-200"
              }`}
            />
            {errors.amount && <p className="text-xs text-rose-600 mt-1">{errors.amount}</p>}
          </div>

          <div>
            <label htmlFor="method" className="block text-sm font-medium text-slate-900 mb-2">
              Payment Method
            </label>
            <select
              id="method"
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="card">Credit Card</option>
              <option value="bank">Bank Transfer</option>
              <option value="paypal">PayPal</option>
              <option value="check">Check</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div>
            <label htmlFor="reference" className="block text-sm font-medium text-slate-900 mb-2">
              Reference/Invoice
            </label>
            <input
              id="reference"
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              placeholder="e.g., INV-2024-001"
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.reference ? "border-rose-300 bg-rose-50" : "border-slate-200"
              }`}
            />
            {errors.reference && <p className="text-xs text-rose-600 mt-1">{errors.reference}</p>}
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-slate-900 mb-2">
              Payment Date
            </label>
            <input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-900 mb-2">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex gap-3 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Creating...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Create Payment
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// View Payment Modal
export function ViewPaymentModal({
  isOpen,
  onClose,
  payment,
  onRefund,
}: {
  isOpen: boolean;
  onClose: () => void;
  payment: {
    id: string;
    amount: number;
    method: string;
    status: string;
    reference?: string;
    date?: string;
    description?: string;
  } | null;
  onRefund?: () => void;
}) {
  if (!isOpen || !payment) return null;

  const statusColor: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    failed: "bg-red-100 text-red-800",
    refunded: "bg-slate-100 text-slate-800",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Payment #{payment.id}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Status</span>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor[payment.status] || "bg-gray-100"}`}>
                {payment.status}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500">Amount</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">₦{payment.amount.toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Method</p>
              <p className="text-sm font-semibold text-slate-900 mt-1 capitalize">{payment.method}</p>
            </div>
            {payment.date && (
              <div>
                <p className="text-xs font-medium text-slate-500">Date</p>
                <p className="text-sm text-slate-600 mt-1">{new Date(payment.date).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {payment.reference && (
            <div>
              <p className="text-xs font-medium text-slate-500">Reference</p>
              <p className="text-sm text-slate-600 mt-1">{payment.reference}</p>
            </div>
          )}

          {payment.description && (
            <div>
              <p className="text-xs font-medium text-slate-500">Notes</p>
              <p className="text-sm text-slate-600 mt-1">{payment.description}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 space-y-3">
          {onRefund && payment.status === "completed" && (
            <button
              onClick={onRefund}
              className="w-full rounded-lg border border-orange-200 px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50"
            >
              Request Refund
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Refund Payment Modal
export function RefundPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  payment,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  payment: { id: string; amount: number } | null;
  isLoading?: boolean;
}) {
  const [reason, setReason] = useState("");

  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Request Refund</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div className="rounded-lg bg-orange-50 p-3 border border-orange-200">
            <p className="text-sm font-medium text-orange-900">
              Refund Amount: <strong>₦{payment.amount.toLocaleString()}</strong>
            </p>
            <p className="text-xs text-orange-700 mt-1">This action will process a full refund to the original payment method</p>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-slate-900 mb-2">
              Refund Reason
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you requesting this refund?"
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason)}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Submit Refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Reconcile Payments Modal
export function ReconcilePaymentsModal({
  isOpen,
  onClose,
  onReconcile,
  pendingCount = 0,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onReconcile: () => void;
  pendingCount?: number;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Reconcile Payments</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
            <p className="text-sm font-medium text-blue-900">
              You have {pendingCount} pending payment(s)
            </p>
            <p className="text-xs text-blue-700 mt-1">Reconciliation will match payments with invoices and update statuses</p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-900 mb-2">Reconciliation will:</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
              <li>Match payments to invoices</li>
              <li>Update payment statuses</li>
              <li>Flag discrepancies</li>
              <li>Generate reconciliation report</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onReconcile}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Reconciling..." : "Start Reconcile"}
          </button>
        </div>
      </div>
    </div>
  );
}
