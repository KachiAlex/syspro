"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";
import { Plus, Eye, Trash2, Download, RotateCcw, Zap } from "lucide-react";
import {
  CreatePaymentModalV2,
  ViewPaymentModal,
  RefundPaymentModal,
  ReconcilePaymentsModal,
} from "./payments-modals";

type Payment = {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference?: string;
  date?: string;
  description?: string;
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-slate-100 text-slate-800",
};

export default function PaymentsSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [payments, setPayments] = useState<Payment[]>([
    {
      id: "PAY-2024-001",
      amount: 5000,
      method: "card",
      status: "completed",
      reference: "INV-2024-001",
      date: "2024-02-15",
    },
    {
      id: "PAY-2024-002",
      amount: 2500,
      method: "bank",
      status: "pending",
      reference: "INV-2024-002",
      date: "2024-02-20",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [showViewPayment, setShowViewPayment] = useState(false);
  const [showRefundPayment, setShowRefundPayment] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);

  // Selection and filtering
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Loading states
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [refundingPayment, setRefundingPayment] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const ts = tenantSlug ?? "kreatix-default";

  // Filter payments
  const filteredPayments = payments.filter((payment) => {
    if (statusFilter !== "all" && payment.status !== statusFilter) return false;
    if (methodFilter !== "all" && payment.method !== methodFilter) return false;
    if (searchQuery && !payment.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !payment.reference?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Handler: Create payment
  async function handleCreatePayment(data: any) {
    setCreatingPayment(true);
    try {
      const newPayment: Payment = {
        id: `PAY-${Date.now()}`,
        ...data,
        amount: parseFloat(data.amount),
        status: "pending",
      };
      setPayments([newPayment, ...payments]);
      setSuccess("Payment created successfully");
      setTimeout(() => setSuccess(null), 3000);
      setShowCreatePayment(false);
    } catch (err) {
      setError("Failed to create payment");
    } finally {
      setCreatingPayment(false);
    }
  }

  // Handler: View payment
  function handleViewPayment(payment: Payment) {
    setSelectedPayment(payment);
    setShowViewPayment(true);
  }

  // Handler: Refund payment
  async function handleRefundPayment(reason: string) {
    if (!selectedPayment) return;
    setRefundingPayment(true);
    try {
      setPayments(
        payments.map((p) =>
          p.id === selectedPayment.id
            ? { ...p, status: "refunded" }
            : p
        )
      );
      setSuccess(`Payment refunded. Reason: ${reason}`);
      setTimeout(() => setSuccess(null), 3000);
      setShowRefundPayment(false);
      setShowViewPayment(false);
    } catch (err) {
      setError("Failed to refund payment");
    } finally {
      setRefundingPayment(false);
    }
  }

  // Handler: Delete payment
  async function handleDeletePayment(id: string) {
    if (!confirm("Delete this payment? This action cannot be undone.")) return;
    try {
      setPayments(payments.filter((p) => p.id !== id));
      setSuccess("Payment deleted");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError("Failed to delete payment");
    }
  }

  // Handler: Reconcile payments
  async function handleReconcilePayments() {
    setReconciling(true);
    try {
      const reconciled = payments.map((p) =>
        p.status === "pending" ? { ...p, status: "completed" } : p
      );
      setPayments(reconciled);
      setSuccess("Payments reconciled successfully. Reconciliation report generated.");
      setTimeout(() => setSuccess(null), 3000);
      setShowReconcile(false);
    } catch (err) {
      setError("Failed to reconcile payments");
    } finally {
      setReconciling(false);
    }
  }

  const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = filteredPayments.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
  const completedCount = payments.filter((p) => p.status === "completed").length;
  const failedCount = payments.filter((p) => p.status === "failed").length;

  return (
    <div className="space-y-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Total Payments</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">₦{totalAmount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Pending</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">₦{pendingAmount.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Completed</p>
          <p className="mt-2 text-2xl font-bold text-green-600">{completedCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Failed</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{failedCount}</p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </select>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All Methods</option>
              <option value="card">Credit Card</option>
              <option value="bank">Bank Transfer</option>
              <option value="paypal">PayPal</option>
              <option value="check">Check</option>
              <option value="cash">Cash</option>
            </select>
            <input
              type="text"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowReconcile(true)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reconcile
            </button>
            <button
              onClick={() => setShowCreatePayment(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Payment
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{payment.id}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{payment.reference}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">₦{payment.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 capitalize">{payment.method}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[payment.status] || "bg-gray-100"}`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {payment.date ? new Date(payment.date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleViewPayment(payment)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletePayment(payment.id)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <CreatePaymentModalV2
        isOpen={showCreatePayment}
        onClose={() => setShowCreatePayment(false)}
        onSubmit={handleCreatePayment}
        isLoading={creatingPayment}
      />

      <ViewPaymentModal
        isOpen={showViewPayment}
        onClose={() => {
          setShowViewPayment(false);
          setSelectedPayment(null);
        }}
        payment={selectedPayment}
        onRefund={() => {
          setShowViewPayment(false);
          setShowRefundPayment(true);
        }}
      />

      <RefundPaymentModal
        isOpen={showRefundPayment}
        onClose={() => {
          setShowRefundPayment(false);
          setShowViewPayment(true);
        }}
        payment={selectedPayment}
        onSubmit={handleRefundPayment}
        isLoading={refundingPayment}
      />

      <ReconcilePaymentsModal
        isOpen={showReconcile}
        onClose={() => setShowReconcile(false)}
        onReconcile={handleReconcilePayments}
        pendingCount={payments.filter((p) => p.status === "pending").length}
        isLoading={reconciling}
      />
    </div>
  );
}
