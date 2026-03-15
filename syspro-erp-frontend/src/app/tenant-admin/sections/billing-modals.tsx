"use client";

import React, { useState } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Subscription Details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Plan</p>
            <p className="text-lg font-semibold text-slate-900 mt-1">{subscription.plan}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Status</p>
              <div className="mt-1 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                {subscription.status}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Seats</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{subscription.seats ?? 1}</p>
            </div>
          </div>

          {subscription.price && (
            <div>
              <p className="text-xs font-medium text-slate-500">Monthly Price</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">₦{subscription.price.toLocaleString()}</p>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-slate-500">Next Billing Date</p>
            <p className="text-sm text-slate-600 mt-1">
              {subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString() : "—"}
            </p>
          </div>

          {subscription.features && subscription.features.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">Features</p>
              <ul className="space-y-2">
                {subscription.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Cancel Subscription</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Are you sure?</p>
              <p className="text-sm text-slate-600 mt-1">
                Your <strong>{subscription.plan}</strong> subscription will be cancelled at the end of the billing period ({new Date(subscription.nextBillingDate || "").toLocaleDateString()}).
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">
            You will lose access to all features and data after the cancellation date.
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200 disabled:opacity-50"
          >
            Keep Subscription
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Upgrade Subscription</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-6">
          <p className="text-sm text-slate-600">Choose a plan that fits your growing needs.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availablePlans.map((plan) => (
              <div key={plan.id} className="rounded-lg border border-slate-200 p-4 hover:border-blue-400 transition">
                <h3 className="font-semibold text-slate-900">{plan.name}</h3>
                <p className="text-2xl font-bold text-slate-900 mt-2">₦{plan.price}</p>
                <p className="text-xs text-slate-600">/month</p>

                <ul className="space-y-2 mt-4">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-slate-600">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onUpgrade(plan.name)}
                  disabled={isLoading}
                  className="w-full mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? "Upgrading..." : "Select Plan"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl m-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Invoice {invoice.id}</h2>
            <p className="text-sm text-slate-600 mt-1">
              Issued: {invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Bill To</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{invoice.customerName || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Due Date</p>
              <p className="text-sm text-slate-600 mt-1">{new Date(invoice.dueDate).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Items */}
          {invoice.items && invoice.items.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-3">Line Items</p>
              <div className="space-y-2 border-t border-b border-slate-200 py-3">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{item.description}</p>
                      <p className="text-xs text-slate-600">{item.quantity} x ₦{item.unitPrice.toLocaleString()}</p>
                    </div>
                    <p className="font-semibold text-slate-900">₦{(item.quantity * item.unitPrice).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex justify-between">
              <p className="font-semibold text-slate-900">Total</p>
              <p className="text-lg font-bold text-slate-900">₦{total.toLocaleString()}</p>
            </div>
          </div>

          {invoice.description && (
            <div>
              <p className="text-xs font-medium text-slate-500">Notes</p>
              <p className="text-sm text-slate-600 mt-1">{invoice.description}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4 space-y-3">
          {onDownload && (
            <button
              onClick={onDownload}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Download PDF
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
