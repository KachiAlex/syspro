"use client";

import { useEffect, useState } from "react";
import { Download, Eye, TrendingUp, RefreshCw, CreditCard } from "lucide-react";
import { FormAlert } from "@/components/form";
import CreateInvoiceModal from "../components/CreateInvoiceModal";
import { CreatePaymentModal } from "../payments/payments-workspace";
import {
  ViewSubscriptionModal,
  CancelSubscriptionModal,
  UpgradeSubscriptionModal,
  ViewInvoiceModal,
} from "./billing-modals";

type Invoice = { 
  id: string; 
  amount: string; 
  dueDate: string; 
  status: string;
  issueDate?: string;
  description?: string;
  items?: Array<{ description: string; quantity: number; unitPrice: number }>;
};
type Subscription = { 
  id: string; 
  plan: string; 
  status: string; 
  nextBillingDate?: string; 
  seats?: number;
  price?: number;
  features?: string[];
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-900",
  pending: "bg-yellow-100 text-yellow-900",
  paid: "bg-green-100 text-green-900",
  unpaid: "bg-red-100 text-red-900",
  overdue: "bg-rose-100 text-rose-900",
  cancelled: "bg-slate-100 text-slate-900",
};

const STATUS_ICONS: Record<string, string> = {
  active: "✓",
  pending: "⏳",
  paid: "✓",
  unpaid: "⚠️",
  overdue: "🔴",
  cancelled: "✕",
};

export default function BillingSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [showCreatePayment, setShowCreatePayment] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [showViewSubscription, setShowViewSubscription] = useState(false);
  const [showCancelSubscription, setShowCancelSubscription] = useState(false);
  const [showUpgradeSubscription, setShowUpgradeSubscription] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showViewInvoice, setShowViewInvoice] = useState(false);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const ts = tenantSlug ?? "kreatix-default";

  // Initialize last refreshed on mount
  useEffect(() => {
    setLastRefreshed(new Date());
  }, []);

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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/billing?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        // API returns { success: true, data: {...} }
        const data = payload.data || payload;
        setInvoices(data.invoices ?? []);
        setSubscriptions(data.subscriptions ?? []);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load billing information");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function handlePay(id: string) {
    try {
      const res = await fetch(`/api/tenant/billing?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: id, updates: { status: "paid" } }),
      });
      if (res.ok) {
        setSuccess("Invoice marked as paid");
        load();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to update invoice");
    }
  }

  async function handleCancelSubscription(id: string) {
    setCancelingSubscription(true);
    try {
      const res = await fetch(`/api/tenant/billing?id=${encodeURIComponent(id)}&type=subscription&tenantSlug=${encodeURIComponent(ts)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccess("Subscription cancelled successfully");
        setShowCancelSubscription(false);
        load();
      } else {
        setError("Failed to cancel subscription");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to cancel subscription");
    } finally {
      setCancelingSubscription(false);
    }
  }

  async function handleDownloadInvoice(invoiceId: string) {
    setDownloadingInvoice(true);
    try {
      const res = await fetch(
        `/api/tenant/billing?action=download&invoiceId=${encodeURIComponent(invoiceId)}&tenantSlug=${encodeURIComponent(ts)}`
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        setError("Failed to download invoice");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to download invoice");
    } finally {
      setDownloadingInvoice(false);
    }
  }

  async function handleUpgradeSubscription(newPlan: string) {
    setUpgradingPlan(true);
    try {
      const res = await fetch(`/api/tenant/billing?action=upgrade&tenantSlug=${encodeURIComponent(ts)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: selectedSubscription?.id,
          newPlan,
        }),
      });
      if (res.ok) {
        setSuccess(`Successfully upgraded to ${newPlan} plan`);
        setShowUpgradeSubscription(false);
        load();
      } else {
        const payload = await res.json().catch(() => ({}));
        setError(payload?.error || "Failed to upgrade subscription");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to upgrade subscription");
    } finally {
      setUpgradingPlan(false);
    }
  }

  function handleViewSubscription(subscription: Subscription) {
    setSelectedSubscription(subscription);
    setShowViewSubscription(true);
  }

  function handleOpenCancelModal(subscription: Subscription) {
    setSelectedSubscription(subscription);
    setShowCancelSubscription(true);
  }

  function handleOpenUpgradeModal(subscription: Subscription) {
    setSelectedSubscription(subscription);
    setShowUpgradeSubscription(true);
  }

  function handleViewInvoice(invoice: Invoice) {
    setSelectedInvoice(invoice);
    setShowViewInvoice(true);
  }

  return (
    <div className="space-y-6">
      {error && (
        <FormAlert
          type="error"
          title="Error"
          message={error}
          onClose={() => setError(null)}
        />
      )}
      {success && (
        <FormAlert
          type="success"
          message={success}
          onClose={() => setSuccess(null)}
        />
      )}

      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Billing & Subscriptions</h2>
          {lastRefreshed && (
            <p className="text-xs text-slate-500 mt-1">
              Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Subscriptions */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Billing</p>
          <h2 className="text-lg font-semibold text-slate-900">Active Subscriptions</h2>
          <p className="mt-1 text-sm text-slate-600">Manage your organization's subscriptions and plans</p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4 animate-pulse">
                <div className="space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-32"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-4 bg-slate-200 rounded"></div>
                    <div className="h-4 bg-slate-200 rounded"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-slate-200 rounded w-20"></div>
                    <div className="h-8 bg-slate-200 rounded w-20"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (subscriptions ?? []).length === 0 ? (
          <div className="rounded-lg bg-blue-50 p-6 text-center">
            <CreditCard className="w-10 h-10 text-blue-300 mx-auto mb-3" />
            <p className="font-medium text-blue-900">No active subscriptions</p>
            <p className="mt-1 text-sm text-blue-700">Contact sales to get started with a subscription plan</p>
          </div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{s.plan}</h3>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[s.status.toLowerCase()] || "bg-gray-100 text-gray-900"
                        }`}
                      >
                        {STATUS_ICONS[s.status.toLowerCase()]} {s.status}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-slate-600">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Next Billing</p>
                        <p>{s.nextBillingDate ? new Date(s.nextBillingDate).toLocaleDateString() : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Seats</p>
                        <p>{s.seats ?? 1}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewSubscription(s)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button
                      onClick={() => handleOpenUpgradeModal(s)}
                      className="rounded-full border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Upgrade
                    </button>
                    <button
                      onClick={() => handleOpenCancelModal(s)}
                      className="rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Invoices</p>
          <h2 className="text-lg font-semibold text-slate-900">Recent Invoices</h2>
          <p className="mt-1 text-sm text-slate-600">View and manage your invoices</p>
        </div>
        <div className="flex justify-end gap-3 mb-3">
          <button
            onClick={() => setShowCreatePayment(true)}
            className="whitespace-nowrap rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + New Payment
          </button>
          <button
            onClick={() => setShowCreateInvoice(true)}
            className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create Invoice
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border border-slate-200 p-4 animate-pulse">
                <div className="space-y-3">
                  <div className="h-5 bg-slate-200 rounded w-24"></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-4 bg-slate-200 rounded"></div>
                    <div className="h-4 bg-slate-200 rounded"></div>
                    <div className="h-4 bg-slate-200 rounded"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 bg-slate-200 rounded w-20"></div>
                    <div className="h-8 bg-slate-200 rounded w-20"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (invoices ?? []).length === 0 ? (
          <div className="rounded-lg bg-blue-50 p-6 text-center">
            <CreditCard className="w-10 h-10 text-blue-300 mx-auto mb-3" />
            <p className="font-medium text-blue-900">No invoices yet</p>
            <p className="mt-1 text-sm text-blue-700">Invoices will appear here once generated</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{inv.id}</h3>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[inv.status.toLowerCase()] || "bg-gray-100 text-gray-900"
                        }`}
                      >
                        {STATUS_ICONS[inv.status.toLowerCase()]} {inv.status}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-3 text-sm text-slate-600">
                      <div>
                        <p className="text-xs font-medium text-slate-500">Amount</p>
                        <p className="font-semibold text-slate-900">₦{parseFloat(inv.amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500">Due Date</p>
                        <p>{new Date(inv.dueDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewInvoice(inv)}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                    <button
                      onClick={() => handleDownloadInvoice(inv.id)}
                      disabled={downloadingInvoice}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    {inv.status.toLowerCase() !== "paid" && (
                      <button
                        onClick={() => handlePay(inv.id)}
                        className="rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-900 hover:bg-green-200"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <CreateInvoiceModal
        isOpen={showCreateInvoice}
        onClose={() => setShowCreateInvoice(false)}
        onSubmit={async (invoiceData: any) => {
          try {
            const res = await fetch(`/api/tenant/billing?action=create_invoice&tenantSlug=${encodeURIComponent(ts)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "create_invoice", invoice: invoiceData }),
            });
            if (!res.ok) {
              const payload = await res.json().catch(() => ({}));
              setError(payload?.error || "Failed to create invoice");
              return;
            }
            setSuccess("Invoice created");
            setShowCreateInvoice(false);
            await load();
          } catch (err) {
            console.error(err);
            setError("Failed to create invoice");
          }
        }}
      />

      <CreatePaymentModal
        isOpen={showCreatePayment}
        onClose={() => setShowCreatePayment(false)}
        onSuccess={() => {
          setSuccess("Payment created successfully");
          setShowCreatePayment(false);
          load();
        }}
        onError={(err: string) => {
          setError(err);
        }}
      />

      {/* View Subscription Modal */}
      <ViewSubscriptionModal
        isOpen={showViewSubscription}
        onClose={() => {
          setShowViewSubscription(false);
          setSelectedSubscription(null);
        }}
        subscription={selectedSubscription}
      />

      {/* Cancel Subscription Modal */}
      <CancelSubscriptionModal
        isOpen={showCancelSubscription}
        onClose={() => {
          setShowCancelSubscription(false);
          setSelectedSubscription(null);
        }}
        onConfirm={() => {
          if (selectedSubscription) {
            handleCancelSubscription(selectedSubscription.id);
          }
        }}
        subscription={selectedSubscription}
        isLoading={cancelingSubscription}
      />

      {/* Upgrade Subscription Modal */}
      <UpgradeSubscriptionModal
        isOpen={showUpgradeSubscription}
        onClose={() => {
          setShowUpgradeSubscription(false);
          setSelectedSubscription(null);
        }}
        onUpgrade={handleUpgradeSubscription}
        currentPlan={selectedSubscription?.plan ?? ""}
        isLoading={upgradingPlan}
      />

      {/* View Invoice Modal */}
      <ViewInvoiceModal
        isOpen={showViewInvoice}
        onClose={() => {
          setShowViewInvoice(false);
          setSelectedInvoice(null);
        }}
        invoice={selectedInvoice}
        onDownload={() => {
          if (selectedInvoice) {
            handleDownloadInvoice(selectedInvoice.id);
          }
        }}
      />
    </div>
  );
}
