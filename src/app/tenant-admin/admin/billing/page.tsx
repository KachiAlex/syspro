"use client";

import React, { useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AdminService } from "@/app/tenant-admin/services/admin-service";

interface BillingOverview {
  currentPlan: string | null;
  subscriptionStatus: string;
  totalDue: number;
  invoiceCount: number;
  nextBillingDate: string | null;
}

export default function BillingPage() {
  const { tenantSlug } = useTenantContext();
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const data = await AdminService.getBilling(tenantSlug);
        setOverview(data.data || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load billing");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Billing</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && !overview && <p>No billing data found.</p>}
      {!loading && overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Current Plan</p>
            <p className="text-xl font-bold">{overview.currentPlan || "—"}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-xl font-bold capitalize">{overview.subscriptionStatus}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total Due</p>
            <p className="text-xl font-bold">{overview.totalDue.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Invoices</p>
            <p className="text-xl font-bold">{overview.invoiceCount}</p>
          </div>
          {overview.nextBillingDate && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Next Billing</p>
              <p className="text-xl font-bold">{new Date(overview.nextBillingDate).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
