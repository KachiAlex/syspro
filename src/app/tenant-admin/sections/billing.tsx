"use client";

import { useEffect, useState } from "react";

type Invoice = { id: string; amount: string; dueDate: string; status: string };
type Subscription = { id: string; plan: string; status: string; nextBillingDate?: string; seats?: number };

export default function BillingSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/billing?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setInvoices(payload.invoices ?? []);
        setSubscriptions(payload.subscriptions ?? []);
      }
    } catch (err) {
      console.warn("billing load failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function handlePay(id: string) {
    await fetch(`/api/tenant/billing?tenantSlug=${encodeURIComponent(ts)}`, { method: "PATCH", body: JSON.stringify({ invoiceId: id, updates: { status: "paid" } }) });
    load();
  }

  async function handleCancelSubscription(id: string) {
    await fetch(`/api/tenant/billing?id=${encodeURIComponent(id)}&type=subscription&tenantSlug=${encodeURIComponent(ts)}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div>Loading billing...</div>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold">Active Subscriptions</h3>
        {subscriptions.length === 0 ? (
          <div>No active subscriptions.</div>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{s.plan}</div>
                  <div className="text-sm text-muted-foreground">Next billing: {s.nextBillingDate ?? "—"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm">Seats: {s.seats ?? 1}</div>
                  <button className="btn" onClick={() => handleCancelSubscription(s.id)}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold">Invoices</h3>
        {invoices.length === 0 ? (
          <div>No invoices.</div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{inv.id} · {inv.amount}</div>
                  <div className="text-sm text-muted-foreground">Due: {inv.dueDate}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm">{inv.status}</div>
                  {inv.status !== "paid" && <button className="btn" onClick={() => handlePay(inv.id)}>Mark Paid</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
