"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";

interface Approval {
  id: string;
  entityType: "purchase_order" | "bill" | "payment";
  entityId: string;
  status: "pending" | "approved" | "rejected" | "escalated" | "cancelled";
  requestedBy: string;
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

export default function ApprovalsWorkspace() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    entityType: ""
  });

  useEffect(() => {
    loadApprovals();
  }, [filters]);

  const loadApprovals = async () => {
    try {
      const params = new URLSearchParams({
        tenantSlug: "demo-tenant", // TODO: Get from context
        ...(filters.status && { status: filters.status }),
        ...(filters.entityType && { entityType: filters.entityType })
      });

      const response = await fetch(`/api/finance/approvals?${params}`);
      const data = await response.json();
      setApprovals(data.approvals || []);
    } catch (error) {
      console.error("Failed to load approvals:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      escalated: "bg-orange-100 text-orange-800",
      cancelled: "bg-gray-100 text-gray-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const handleDecision = async (approvalId: string, decision: "approved" | "rejected" | "escalated", comments?: string) => {
    try {
      const response = await fetch("/api/finance/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decision",
          approvalId,
          userId: "current-user-id", // TODO: Get from auth context
          decision,
          comments
        })
      });

      if (response.ok) {
        loadApprovals();
      } else {
        const error = await response.json();
        alert(`Decision failed: ${error.error}`);
      }
    } catch (error) {
      console.error("Decision error:", error);
      alert("Decision failed");
    }
  };

  if (loading) {
    return <div className="p-6">Loading approvals...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Approvals</h1>
        <button className="btn btn-primary">Configure Rules</button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-3 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="form-select"
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
            className="form-select"
          >
            <option value="">All Types</option>
            <option value="purchase_order">Purchase Orders</option>
            <option value="bill">Bills</option>
            <option value="payment">Payments</option>
          </select>
        </div>
      </div>

      {/* Approvals Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entity ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Requested By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Step
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {approvals.map((approval) => (
                <tr key={approval.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {approval.entityType.replace("_", " ")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {approval.entityId.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {approval.requestedBy.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Step {approval.currentStep + 1} of {approval.approverChain.length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(approval.status)}`}>
                      {approval.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(approval.createdAt), "MMM dd, yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {approval.status === "pending" && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleDecision(approval.id, "approved")}
                          className="text-green-600 hover:text-green-900"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(approval.id, "rejected")}
                          className="text-red-600 hover:text-red-900"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleDecision(approval.id, "escalated")}
                          className="text-orange-600 hover:text-orange-900"
                        >
                          Escalate
                        </button>
                      </div>
                    )}
                    <button className="text-indigo-600 hover:text-indigo-900">
                      View Details
                    </button>
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
