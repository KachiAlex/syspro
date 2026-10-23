"use client";

import React, { useState, useEffect } from "react";
import { useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format } from "date-fns";
import { FormAlert } from "@/components/form";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface Approval {
  id: string;
  entityType: "purchase_order" | "bill" | "payment" | "journal_entry" | "sales_return" | "purchase_return";
  entityId: string;
  status: "pending" | "approved" | "rejected" | "escalated" | "cancelled";
  requestedBy: string;
  requestedByName?: string | null;
  approverChain: Array<{
    step: number;
    userId: string;
    role?: string;
    required: boolean;
    order: number;
  }>;
  decisions: Array<{
    step: number;
    userId: string;
    decision: "approved" | "rejected" | "escalated";
    comments?: string;
    timestamp: string;
  }>;
  currentStep: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export default function ApprovalsWorkspace({ onNavigateTo }: { onNavigateTo?: (section: string) => void }) {
  const { tenantSlug } = useTenantContext();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const currentUser = useCurrentUser();
  const [filters, setFilters] = useState({
    status: "",
    entityType: ""
  });



  const loadApprovals = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantSlug,
        ...(filters.status && { status: filters.status }),
        ...(filters.entityType && { entityType: filters.entityType })
      });

      const response = await fetch(`/api/finance/approvals?${params}`);
      const data = await response.json();
      setApprovals(data.approvals || []);
    } catch (err) {
      console.error("Failed to load approvals:", err);
      setError("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [filters, tenantSlug]);

  useEffect(() => {
    if (tenantSlug) loadApprovals();
  }, [loadApprovals, tenantSlug]);

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      escalated: "bg-orange-100 text-orange-800",
      cancelled: "bg-theme-muted text-theme-text-primary"
    };
    return colors[status as keyof typeof colors] || "bg-theme-muted text-theme-text-primary";
  };

  const handleDecision = async (approvalId: string, decision: "approved" | "rejected" | "escalated", comments?: string) => {
    try {
      const response = await fetch(`/api/finance/approvals?tenantSlug=${encodeURIComponent(tenantSlug ?? "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decision",
          approvalId,
          userId: currentUser?.id || "unknown",
          decision,
          comments
        })
      });

      if (response.ok) {
        setSuccess(`Approval ${decision} successfully`);
        setTimeout(() => setSuccess(null), 3000);
        loadApprovals();
      } else {
        const error = await response.json();
        setError(error.error || "Decision failed");
      }
    } catch (err) {
      console.error("Decision error:", err);
      setError(err instanceof Error ? err.message : "Decision failed");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-theme-muted p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-theme-border border-t-slate-900"></div>
          <p className="mt-3 text-theme-text-secondary">Loading approvals…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-theme-text-secondary">Financial Management</p>
          <h1 className="text-2xl font-semibold text-theme-text-primary">Approvals</h1>
          <p className="mt-1 text-sm text-theme-text-secondary">Review and authorize financial documents</p>
        </div>
        <button
          onClick={() => onNavigateTo?.("approval-rules")}
          className="whitespace-nowrap rounded-full bg-theme-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-theme-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent"
        >
          ⚙️ Configure Rules
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-6">
        <p className="mb-4 text-sm font-semibold text-theme-text-primary">Filters</p>
        <div className="grid grid-cols-2 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-lg border border-theme-border px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="escalated">Escalated</option>
          </select>
          
          <select
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            className="rounded-lg border border-theme-border px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="purchase_order">Purchase Orders</option>
            <option value="bill">Bills</option>
            <option value="payment">Payments</option>
            <option value="journal_entry">Journal Entries</option>
            <option value="sales_return">Sales Returns</option>
            <option value="purchase_return">Purchase Returns</option>
          </select>
        </div>
      </div>

      {/* Approvals Table */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-theme-border bg-theme-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Entity Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Entity ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Requested By
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Current Step
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {approvals.map((approval) => (
                <tr key={approval.id} className="hover:bg-theme-muted">
                  <td className="px-6 py-4 text-sm font-medium text-theme-text-primary">
                    {approval.entityType?.replace("_", " ")}
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">
                    {approval.entityId.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">
                    {approval.requestedByName || approval.requestedBy.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">
                    Step {approval.currentStep + 1} of {approval.approverChain.length}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(approval.status)}`}>
                      {approval.status === "pending" && "⏳"}
                      {approval.status === "approved" && "✓"}
                      {approval.status === "rejected" && "✕"}
                      {approval.status === "escalated" && "⬆️"}
                      {approval.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">
                    {format(new Date(approval.createdAt), "MMM dd, yyyy")}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      {approval.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleDecision(approval.id, "approved")}
                            className="text-green-600 hover:text-green-900"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleDecision(approval.id, "rejected")}
                            className="text-rose-600 hover:text-rose-900"
                          >
                            ✕ Reject
                          </button>
                          <button
                            onClick={() => handleDecision(approval.id, "escalated")}
                            className="text-amber-600 hover:text-amber-900"
                          >
                            ⬆️ Escalate
                          </button>
                        </>
                      )}
                      <button className="text-theme-accent hover:text-theme-text-primary">
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-rose-100 text-rose-900",
  escalated: "bg-orange-100 text-orange-900",
  cancelled: "bg-theme-muted text-theme-text-primary"
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.cancelled;
}
