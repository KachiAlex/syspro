"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";

type Invoice = { id: string; amount: string; dueDate: string; status: string };
type Subscription = { id: string; plan: string; status: string; nextBillingDate?: string; seats?: number };

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

import { Panel, SectionHeading, PillButton } from "@/components/ui/primitives";

export default function BillingSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/billing?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setInvoices(payload.invoices ?? []);
        setSubscriptions(payload.subscriptions ?? []);
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
        setTimeout(() => setSuccess(null), 3000);
        load();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to update invoice");
    }
  }

  async function handleCancelSubscription(id: string) {
    if (!confirm("Are you sure? Your subscription will be cancelled at the end of the billing period.")) return;
    try {
      const res = await fetch(`/api/tenant/billing?id=${encodeURIComponent(id)}&type=subscription&tenantSlug=${encodeURIComponent(ts)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccess("Subscription cancelled");
        setTimeout(() => setSuccess(null), 3000);
        load();
      }
    } catch (err) {
      console.error(err);
      setError("Failed to cancel subscription");
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg bg-slate-50 p-8 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
        <p className="mt-2 text-slate-600">Loading billing information…</p>
      </div>
    );
  }

  return (
    <Panel>
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

      {/* Subscriptions */}
      <div>
        <SectionHeading eyebrow="Billing" title="Active Subscriptions" description="Manage your organization's subscriptions and plans" />

        {(subscriptions ?? []).length === 0 ? (
          <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
            <p className="font-medium text-blue-900">No active subscriptions</p>
            <p className="mt-1 text-blue-700">Contact sales to get started</p>
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
                  <PillButton variant="secondary" onClick={() => handleCancelSubscription(s.id)}>Cancel</PillButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices */}
      <Panel>
        <div className="mb-4">
          <SectionHeading eyebrow="Invoices" title="Recent Invoices" description="View and manage your invoices" />
        </div>

        {(invoices ?? []).length === 0 ? (
          <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
            <p className="font-medium text-blue-900">No invoices</p>
            <p className="mt-1 text-blue-700">Invoices will appear here once generated</p>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
