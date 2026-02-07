"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { FormAlert } from "@/components/form";

interface Bill {
  id: string;
  billNumber: string;
  vendorId: string;
  vendorName?: string;
  billDate: string;
  dueDate?: string;
  currency: string;
  total: number;
  balanceDue: number;
  status: "draft" | "open" | "partially_paid" | "paid" | "overdue" | "cancelled";
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-900",
  open: "bg-blue-100 text-blue-900",
  partially_paid: "bg-amber-100 text-amber-900",
  paid: "bg-green-100 text-green-900",
  overdue: "bg-rose-100 text-rose-900",
  cancelled: "bg-slate-100 text-slate-900"
};

const STATUS_ICONS: Record<string, string> = {
  draft: "📝",
  open: "📂",
  partially_paid: "⏳",
  paid: "✓",
  overdue: "⚠️",
  cancelled: "✕"
};

export default function BillsWorkspace() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: "",
    vendorId: "",
    overdueOnly: false
  });

  useEffect(() => {
    loadBills();
  }, [filters]);

  const loadBills = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantSlug: "demo-tenant", // TODO: Get from context
        ...(filters.status && { status: filters.status }),
        ...(filters.vendorId && { vendorId: filters.vendorId }),
        ...(filters.overdueOnly && { overdueOnly: "true" })
      });

      const response = await fetch(`/api/finance/bills?${params}`);
      const data = await response.json();
      setBills(data.bills || []);
    } catch (err) {
      console.error("Failed to load bills:", err);
      setError("Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    return STATUS_COLORS[status] || STATUS_COLORS.cancelled;
  };

  const getStatusIcon = (status: string) => {
    return STATUS_ICONS[status] || "•";
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-slate-50 p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
          <p className="mt-3 text-slate-600">Loading bills…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Financial Management</p>
          <h1 className="text-2xl font-semibold text-slate-900">Bills & Payables</h1>
          <p className="mt-1 text-sm text-slate-600">Track and manage all vendor bills and payment schedules</p>
        </div>
        <button className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + New Bill
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6">
        <p className="mb-4 text-sm font-semibold text-slate-900">Filters</p>
        <div className="grid grid-cols-3 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="open">Open</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
          </select>
          
          <input
            type="text"
            placeholder="Search vendor…"
            value={filters.vendorId}
            onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <input
              type="checkbox"
              checked={filters.overdueOnly}
              onChange={(e) => setFilters({ ...filters, overdueOnly: e.target.checked })}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium text-slate-700">Overdue Only</span>
          </label>
        </div>
      </div>

      {/* Bills Table */}
      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Bill Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Bill Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Balance Due
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="rounded-lg bg-blue-50 p-4 text-sm">
                      <p className="font-medium text-blue-900">No bills yet</p>
                      <p className="mt-1 text-blue-700">Create your first bill to get started</p>
                    </div>
                  </td>
                </tr>
              ) : (
                bills.map((bill) => (
                  <tr key={bill.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {bill.billNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {bill.vendorName || bill.vendorId}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {format(new Date(bill.billDate), "MMM dd, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {bill.dueDate ? format(new Date(bill.dueDate), "MMM dd, yyyy") : "-"}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-slate-900">
                      {bill.currency} {bill.total.toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 text-right text-sm font-medium ${bill.balanceDue > 0 ? "text-amber-600" : "text-green-600"}`}>
                      {bill.currency} {bill.balanceDue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(bill.status)}`}>
                        {getStatusIcon(bill.status)} {bill.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <button className="text-blue-600 hover:text-blue-900">View</button>
                        <button className="text-green-600 hover:text-green-900">Pay</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
