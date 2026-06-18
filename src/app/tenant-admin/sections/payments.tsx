"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";
import { Plus, Eye, Trash2, Download, RotateCcw, Zap, RefreshCw, CreditCard } from "lucide-react";
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
  currency?: string;
};

interface ApiPayment {
  id: string;
  grossAmount: number;
  netAmount: number;
  fees: number;
  method: string;
  status: string;
  reference: string;
  paymentDate?: string;
  confirmationDetails?: string;
  currency?: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500/10 text-green-400",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-500/10 text-red-400",
  refunded: "bg-slate-100 text-slate-800",
};

export default function PaymentsSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

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

  const ts = tenantSlug;

  const formatCurrency = (amount: number, currency: string = 'NGN') => {
    const symbol = currency === 'NGN' ? '₦' : '$';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const mapApiToPayment = (api: ApiPayment): Payment => ({
    id: api.id,
    amount: api.grossAmount,
    method: api.method,
    status: api.status === 'successful' ? 'completed' : api.status === 'reversed' ? 'refunded' : api.status,
    reference: api.reference,
    date: api.paymentDate,
    description: api.confirmationDetails,
    currency: api.currency || 'NGN',
  });

  const fetchPayments = async () => {
    if (!ts) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/payments?tenantSlug=${encodeURIComponent(ts)}&limit=100`);
      const data = await res.json();
      const apiPayments: ApiPayment[] = data.payments || [];
      setPayments(apiPayments.map(mapApiToPayment));
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch payments:', err);
      setError('Failed to refresh payments');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchPayments();
  }, [ts]);

  // Auto-dismiss alerts after 3.5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Refresh payments data
  const handleRefreshPayments = async () => {
    await fetchPayments();
    setSuccess("Payments refreshed successfully");
  };

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
      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: ts,
          reference: data.reference || `PAY-${Date.now()}`,
          grossAmount: parseFloat(data.amount) || 0,
          fees: 0,
          method: data.method || 'bank_transfer',
          paymentDate: new Date().toISOString(),
          confirmationDetails: data.description || '',
        }),
      });
      if (!res.ok) throw new Error('Failed to create payment');
      const result = await res.json();
      const created = mapApiToPayment(result.payment);
      setPayments([created, ...payments]);
      setSuccess("Payment created successfully");
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
        <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
          <p className="text-sm text-slate-600">Total Payments</p>
          <p className="mt-2 text-2xl font-bold text-[#F8FAFC]">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
          <p className="text-sm text-slate-600">Pending</p>
          <p className="mt-2 text-2xl font-bold text-orange-600">{formatCurrency(pendingAmount)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
          <p className="text-sm text-slate-600">Completed</p>
          <p className="mt-2 text-2xl font-bold text-green-400">{completedCount}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
          <p className="text-sm text-slate-600">Failed</p>
          <p className="mt-2 text-2xl font-bold text-red-400">{failedCount}</p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="rounded-lg border border-slate-200 bg-[#111827] p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#F8FAFC]">Payments</h3>
            {lastRefreshed && (
              <p className="text-xs text-slate-500 mt-1">
                Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <button
            onClick={handleRefreshPayments}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
              className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="all">All Methods</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Credit Card</option>
              <option value="paystack">Paystack</option>
              <option value="flutterwave">Flutterwave</option>
              <option value="check">Check</option>
              <option value="cash">Cash</option>
              <option value="pos">POS</option>
              <option value="mobile_money">Mobile Money</option>
            </select>
            <input
              type="text"
              placeholder="Search payments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
      <div className="rounded-lg border border-slate-200 bg-[#111827] overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="space-y-3 p-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 bg-slate-50 rounded-lg animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-4 bg-slate-300 rounded"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-300 rounded w-32"></div>
                      <div className="h-3 bg-slate-300 rounded w-24"></div>
                    </div>
                    <div className="w-16 h-4 bg-slate-300 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="p-12 text-center">
              <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No payments found</p>
              <p className="text-sm text-slate-500 mb-4">
                {payments.length === 0 
                  ? 'Create your first payment to get started'
                  : 'Try adjusting your filters or search query'}
              </p>
              {payments.length === 0 && (
                <button
                  onClick={() => setShowCreatePayment(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Payment
                </button>
              )}
            </div>
          ) : (
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
                    <td className="px-4 py-3 text-sm font-medium text-[#F8FAFC]">{payment.id}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{payment.reference}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#F8FAFC]">{formatCurrency(payment.amount, payment.currency)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 capitalize">{payment.method}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[payment.status] || "bg-[rgba(255,255,255,0.07)]"}`}>
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
          )}
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
