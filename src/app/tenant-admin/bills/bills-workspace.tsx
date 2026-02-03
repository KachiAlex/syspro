"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";

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

export default function BillsWorkspace() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: "",
    vendorId: "",
    overdueOnly: false
  });

  useEffect(() => {
    loadBills();
  }, [filters]);

  const loadBills = async () => {
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
    } catch (error) {
      console.error("Failed to load bills:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      open: "bg-blue-100 text-blue-800",
      partially_paid: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-800"
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return <div className="p-6">Loading bills...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bills & Payables</h1>
        <button className="btn btn-primary">New Bill</button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-4 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="form-select"
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
            placeholder="Vendor ID"
            value={filters.vendorId}
            onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })}
            className="form-input"
          />
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.overdueOnly}
              onChange={(e) => setFilters({ ...filters, overdueOnly: e.target.checked })}
              className="mr-2"
            />
            Overdue Only
          </label>
        </div>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {bill.billNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bill.vendorName || bill.vendorId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(bill.billDate), "MMM dd, yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bill.dueDate ? format(new Date(bill.dueDate), "MMM dd, yyyy") : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {bill.currency} {bill.total.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {bill.currency} {bill.balanceDue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(bill.status)}`}>
                      {bill.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button className="text-indigo-600 hover:text-indigo-900 mr-3">
                      View
                    </button>
                    <button className="text-green-600 hover:text-green-900">
                      Pay
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
