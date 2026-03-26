"use client";

import React, { useState } from "react";
import { X, AlertCircle, Zap, Send, Check } from "lucide-react";

// Submit Expense Modal
export function SubmitExpenseModal({
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
    category: "travel",
    amount: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    receipt: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = "Amount must be greater than 0";
    if (!formData.description.trim()) newErrors.description = "Description is required";
    if (!formData.date) newErrors.date = "Date is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      const response = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantSlug: 'default',
          categoryId: formData.category,
          amount: parseFloat(formData.amount),
          description: formData.description,
          expenseDate: formData.date,
          receiptAttached: formData.receipt,
          approvalStatus: 'submitted',
          paymentStatus: 'pending',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit expense');
      }

      const result = await response.json();
      await onSubmit(result.expense);
      setFormData({ category: "travel", amount: "", description: "", date: new Date().toISOString().split("T")[0], receipt: false });
    } catch (err) {
      console.error('Expense submission error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-slate-900">Submit Expense</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-slate-900 mb-2">
              Category
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="travel">Travel</option>
              <option value="meals">Meals</option>
              <option value="office">Office Supplies</option>
              <option value="software">Software</option>
              <option value="training">Training</option>
              <option value="other">Other</option>
            </select>
          </div>

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
            <label htmlFor="date" className="block text-sm font-medium text-slate-900 mb-2">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.date ? "border-rose-300 bg-rose-50" : "border-slate-200"
              }`}
            />
            {errors.date && <p className="text-xs text-rose-600 mt-1">{errors.date}</p>}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-slate-900 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What was this expense for?"
              rows={3}
              className={`w-full rounded-lg border px-3 py-2 text-sm ${
                errors.description ? "border-rose-300 bg-rose-50" : "border-slate-200"
              }`}
            />
            {errors.description && <p className="text-xs text-rose-600 mt-1">{errors.description}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="receipt"
              type="checkbox"
              checked={formData.receipt}
              onChange={(e) => setFormData({ ...formData, receipt: e.target.checked })}
              className="rounded border-slate-300"
            />
            <label htmlFor="receipt" className="text-sm text-slate-600">
              I have a receipt attached
            </label>
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
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Expense
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// View Expense Details Modal
export function ViewExpenseModal({
  isOpen,
  onClose,
  expense,
  onApprove,
  onReject,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  expense: {
    id: string;
    category: string;
    amount: number;
    status: string;
    description: string;
    employee?: string;
    submittedDate?: string;
    notes?: string;
  } | null;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
}) {
  if (!isOpen || !expense) return null;

  const statusColor: Record<string, string> = {
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    pending: "bg-yellow-100 text-yellow-800",
    reimbursed: "bg-blue-100 text-blue-800",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Expense #{expense.id}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-6">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Status</span>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor[expense.status.toLowerCase()] || "bg-gray-100"}`}>
                {expense.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Category</p>
              <p className="text-sm font-semibold text-slate-900 mt-1 capitalize">{expense.category}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Amount</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">₦{expense.amount.toLocaleString()}</p>
            </div>
          </div>

          {expense.employee && (
            <div>
              <p className="text-xs font-medium text-slate-500">Employee</p>
              <p className="text-sm text-slate-600 mt-1">{expense.employee}</p>
            </div>
          )}

          {expense.submittedDate && (
            <div>
              <p className="text-xs font-medium text-slate-500">Submitted</p>
              <p className="text-sm text-slate-600 mt-1">{new Date(expense.submittedDate).toLocaleDateString()}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-500">Description</p>
            <p className="text-sm text-slate-600 mt-1">{expense.description}</p>
          </div>

          {expense.notes && (
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-900">Approver Notes</p>
              <p className="text-sm text-blue-800 mt-1">{expense.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 space-y-3 sticky bottom-0 bg-white">
          {expense.status === "pending" && (
            <div className="flex gap-2">
              <button
                onClick={onReject}
                className="flex-1 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Reject
              </button>
              <button
                onClick={onApprove}
                className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
            </div>
          )}
          {onEdit && expense.status === "draft" && (
            <button
              onClick={onEdit}
              className="w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
            >
              Edit
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

// Bulk Actions Modal
export function BulkActionsModal({
  isOpen,
  onClose,
  onApproveAll,
  onRejectAll,
  count = 0,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
  count?: number;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Bulk Actions</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-slate-600">
            You have selected <strong>{count}</strong> expense{count !== 1 ? "s" : ""}. Choose an action:
          </p>

          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">Bulk operations will:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>Apply the same action to all selected expenses</li>
              <li>Send notifications to submitters</li>
              <li>Update approval workflow status</li>
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
            onClick={onRejectAll}
            disabled={isLoading}
            className="flex-1 rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Reject All"}
          </button>
          <button
            onClick={onApproveAll}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? "Processing..." : "Approve All"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Export Expenses Modal
export function ExportExpensesModal({
  isOpen,
  onClose,
  onExport,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: string) => void;
  isLoading?: boolean;
}) {
  const [format, setFormat] = useState("csv");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Export Expenses</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div>
            <label htmlFor="format" className="block text-sm font-medium text-slate-900 mb-2">
              Format
            </label>
            <select
              id="format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
            <p className="font-medium">The export will include:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
              <li>All selected expenses</li>
              <li>Category, amount, status</li>
              <li>Employee and submission date</li>
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
            onClick={() => onExport(format)}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
