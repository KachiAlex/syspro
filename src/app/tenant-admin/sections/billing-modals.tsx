"use client";

import React, { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle, FileCheck2, Loader2 } from "lucide-react";
import { CustomFieldsPanel } from "@/components/custom-fields/custom-fields-panel";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

type EInvoiceSubmission = {
  provider: string; irn: string; status: string;
  submittedAt: string; response?: { message?: string };
};

function EInvoicePanel({ invoiceId }: { invoiceId: string }) {
  const { tenantSlug } = useTenantContext();
  const [submission, setSubmission] = useState<EInvoiceSubmission | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug || !invoiceId) return;
    setLoaded(false);
    fetch(`/api/finance/invoices/${invoiceId}/einvoice/submit?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((r) => r.json())
      .then((d) => setSubmission(d.submission ?? null))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [tenantSlug, invoiceId]);

  const submit = async (resubmit = false) => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(
        `/api/finance/invoices/${invoiceId}/einvoice/submit?tenantSlug=${encodeURIComponent(tenantSlug)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resubmit }) },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setSubmission(data.submission);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  if (!loaded) return null;

  return (
    <div className="rounded-lg border border-theme-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-theme-text-tertiary flex items-center gap-1.5">
          <FileCheck2 className="w-4 h-4" /> E-Invoice (FIRS)
        </p>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-theme-text-secondary" />}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {submission ? (
        <div className="mt-2 space-y-1 text-sm">
          <p className="font-mono text-xs text-theme-text-primary break-all">IRN: {submission.irn}</p>
          <p className="text-xs text-theme-text-secondary">
            {submission.provider} · {new Date(submission.submittedAt).toLocaleString()}
          </p>
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            submission.status === "accepted" ? "bg-green-100 text-green-800"
            : submission.status === "rejected" ? "bg-red-100 text-red-800"
            : "bg-yellow-100 text-yellow-800"}`}>
            {submission.status}
          </span>
          {submission.status === "rejected" && submission.response?.message && (
            <p className="text-xs text-red-600">{submission.response.message}</p>
          )}
          {submission.status !== "accepted" && (
            <button onClick={() => void submit(true)} disabled={busy}
              className="block mt-2 text-xs font-medium text-theme-accent hover:underline disabled:opacity-50">
              Resubmit
            </button>
          )}
        </div>
      ) : (
        <button onClick={() => void submit(false)} disabled={busy}
          className="mt-2 rounded-lg bg-theme-muted px-3 py-1.5 text-xs font-medium text-theme-text-primary hover:bg-theme-elevated disabled:opacity-50">
          Submit to FIRS
        </button>
      )}
    </div>
  );
}

// View Subscription Details Modal
export function ViewSubscriptionModal({
  isOpen,
  onClose,
  subscription,
}: {
  isOpen: boolean;
  onClose: () => void;
  subscription: { id: string; plan: string; status: string; nextBillingDate?: string; seats?: number; price?: number; features?: string[] } | null;
}) {
  if (!isOpen || !subscription) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
      <div className="w-full max-w-md rounded-xl bg-theme-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border px-6 py-4">
          <h2 className="text-lg font-semibold text-theme-text-primary">Subscription Details</h2>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-theme-text-tertiary">Plan</p>
            <p className="text-lg font-semibold text-theme-text-primary mt-1">{subscription.plan}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-theme-text-tertiary">Status</p>
              <div className="mt-1 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                {subscription.status}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-theme-text-tertiary">Seats</p>
              <p className="text-lg font-semibold text-theme-text-primary mt-1">{subscription.seats ?? 1}</p>
            </div>
          </div>

          {subscription.price && (
            <div>
              <p className="text-xs font-medium text-theme-text-tertiary">Monthly Price</p>
              <p className="text-lg font-semibold text-theme-text-primary mt-1">₦{subscription.price.toLocaleString()}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-theme-text-tertiary">Next Billing Date</p>
            <p className="text-sm text-theme-text-secondary mt-1">
              {subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString() : "—"}
            </p>
          </div>

          {subscription.features && subscription.features.length > 0 && (
            <div>
              <p className="text-xs font-medium text-theme-text-tertiary mb-2">Features</p>
              <ul className="space-y-2">
                {subscription.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-theme-text-secondary">
                    <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-theme-border px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-theme-muted px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-elevated"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Cancel Subscription Confirmation Modal
export function CancelSubscriptionModal({
  isOpen,
  onClose,
  onConfirm,
  subscription,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  subscription: { plan: string; nextBillingDate?: string } | null;
  isLoading?: boolean;
}) {
  if (!isOpen || !subscription) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay">
      <div className="w-full max-w-md rounded-xl bg-theme-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border px-6 py-4">
          <h2 className="text-lg font-semibold text-theme-text-primary">Cancel Subscription</h2>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-theme-text-primary">Are you sure?</p>
              <p className="text-sm text-theme-text-secondary mt-1">
                Your <strong>{subscription.plan}</strong> subscription will be cancelled at the end of the billing period ({new Date(subscription.nextBillingDate || "").toLocaleDateString()}).
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">
            You will lose access to all features and data after the cancellation date.
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-theme-border px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-theme-muted px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-elevated disabled:opacity-50"
          >
            Keep Subscription
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Cancelling...
              </>
            ) : (
              "Cancel Subscription"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Upgrade Subscription Modal
export function UpgradeSubscriptionModal({
  isOpen,
  onClose,
  onUpgrade,
  currentPlan,
  isLoading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: (newPlan: string) => void;
  currentPlan: string;
  isLoading?: boolean;
}) {
  const plans = [
    { id: "starter", name: "Starter", price: 29, seats: 5, features: ["5 Users", "10GB Storage", "Basic Support"] },
    { id: "professional", name: "Professional", price: 99, seats: 25, features: ["25 Users", "100GB Storage", "Priority Support", "Advanced Analytics"] },
    { id: "enterprise", name: "Enterprise", price: 299, seats: 100, features: ["100 Users", "1TB Storage", "24/7 Support", "Custom Integration", "Dedicated Account Manager"] },
  ];

  const availablePlans = plans.filter((p) => p.name.toLowerCase() !== currentPlan.toLowerCase());

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-theme-surface shadow-xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border px-6 py-4">
          <h2 className="text-lg font-semibold text-theme-text-primary">Upgrade Subscription</h2>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-theme-text-secondary">Choose a plan that fits your growing needs.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availablePlans.map((plan) => (
              <div key={plan.id} className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface transition-all duration-200">
                <h3 className="font-semibold text-theme-text-primary">{plan.name}</h3>
                <p className="text-2xl font-bold text-theme-text-primary mt-2">₦{plan.price}</p>
                <p className="text-xs text-theme-text-secondary">/month</p>

                <ul className="space-y-2 mt-4">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-theme-text-secondary">
                      <span className="w-1.5 h-1.5 bg-theme-accent rounded-full"></span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onUpgrade(plan.name)}
                  disabled={isLoading}
                  className="w-full mt-4 rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-accent-hover disabled:opacity-50"
                >
                  {isLoading ? "Upgrading..." : "Select Plan"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-theme-border px-6 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-theme-muted px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-elevated"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// View Invoice Details Modal
export function ViewInvoiceModal({
  isOpen,
  onClose,
  invoice,
  onDownload,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    amount: string;
    dueDate: string;
    status: string;
    customerName?: string;
    issueDate?: string;
    description?: string;
    items?: Array<{ description: string; quantity: number; unitPrice: number }>;
  } | null;
  onDownload?: () => void;
}) {
  if (!isOpen || !invoice) return null;

  const total = parseFloat(invoice.amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-theme-surface shadow-xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-theme-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-theme-text-primary">Invoice {invoice.id}</h2>
            <p className="text-sm text-theme-text-secondary mt-1">
              Issued: {invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-6">
          {/* Status */}
          <div>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                invoice.status === "paid" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
            </span>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-theme-text-tertiary">Bill To</p>
              <p className="text-sm font-semibold text-theme-text-primary mt-1">{invoice.customerName || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-theme-text-tertiary">Due Date</p>
              <p className="text-sm text-theme-text-secondary mt-1">{new Date(invoice.dueDate).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Items */}
          {invoice.items && invoice.items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-theme-text-tertiary mb-3">Line Items</p>
              <div className="space-y-2 border-t border-b border-theme-border py-3">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div>
                      <p className="font-medium text-theme-text-primary">{item.description}</p>
                      <p className="text-xs text-theme-text-secondary">{item.quantity} x ₦{item.unitPrice.toLocaleString()}</p>
                    </div>
                    <p className="font-semibold text-theme-text-primary">₦{(item.quantity * item.unitPrice).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="rounded-lg bg-theme-muted p-4">
            <div className="flex justify-between">
              <p className="font-semibold text-theme-text-primary">Total</p>
              <p className="text-lg font-bold text-theme-text-primary">₦{total.toLocaleString()}</p>
            </div>
          </div>

          {invoice.description && (
            <div>
              <p className="text-xs font-medium text-theme-text-tertiary">Notes</p>
              <p className="text-sm text-theme-text-secondary mt-1">{invoice.description}</p>
            </div>
          )}

          <EInvoicePanel invoiceId={invoice.id} />

          <CustomFieldsPanel doctype="finance_invoices" recordId={invoice.id} variant="light" />
        </div>

        {/* Footer */}
        <div className="border-t border-theme-border px-6 py-4 space-y-3">
          {onDownload && (
            <button
              onClick={onDownload}
              className="w-full rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-accent-hover"
            >
              Download PDF
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-theme-muted px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-elevated"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
