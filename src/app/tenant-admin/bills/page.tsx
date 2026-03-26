"use client";

import React, { useState } from "react";
import {
  FileText,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

interface Bill {
  id: string;
  billNumber: string;
  vendor: string;
  amount: number;
  dueDate: string;
  issuedDate: string;
  status: "paid" | "pending" | "overdue";
  description: string;
  notes?: string;
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([
    {
      id: "1",
      billNumber: "INV-001-2025",
      vendor: "Office Supplies Co.",
      amount: 450,
      dueDate: "2025-04-15",
      issuedDate: "2025-03-15",
      status: "pending",
      description: "Monthly stationery and office supplies",
    },
    {
      id: "2",
      billNumber: "INV-002-2025",
      vendor: "Internet Services Ltd",
      amount: 199,
      dueDate: "2025-03-25",
      issuedDate: "2025-02-25",
      status: "overdue",
      description: "Monthly internet subscription",
    },
    {
      id: "3",
      billNumber: "INV-003-2025",
      vendor: "Utilities Company",
      amount: 320.5,
      dueDate: "2025-03-20",
      issuedDate: "2025-02-20",
      status: "paid",
      description: "Monthly utility bill - Electric and Water",
    },
    {
      id: "4",
      billNumber: "INV-004-2025",
      vendor: "Cloud Services Inc",
      amount: 599,
      dueDate: "2025-04-10",
      issuedDate: "2025-03-10",
      status: "pending",
      description: "Annual cloud hosting and backup services",
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showAddForm, setShowAddForm] = useState(false);

  const filteredBills = bills.filter((bill) => {
    const matchesSearch =
      bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.vendor.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      selectedStatus === "all" || bill.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "overdue":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "overdue":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const stats = {
    total: bills.reduce((sum, bill) => sum + bill.amount, 0),
    pending: bills
      .filter((b) => b.status === "pending")
      .reduce((sum, b) => sum + b.amount, 0),
    overdue: bills
      .filter((b) => b.status === "overdue")
      .reduce((sum, b) => sum + b.amount, 0),
    paid: bills
      .filter((b) => b.status === "paid")
      .reduce((sum, b) => sum + b.amount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bills</h1>
          <p className="text-gray-600 mt-2">Manage and track vendor bills</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          <Plus className="h-5 w-5" />
          Add Bill
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Bills</p>
          <p className="text-2xl font-bold text-gray-900">${stats.total.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 border-l-4 border-l-yellow-500">
          <p className="text-sm text-gray-600 mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">${stats.pending.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 border-l-4 border-l-red-500">
          <p className="text-sm text-gray-600 mb-1">Overdue</p>
          <p className="text-2xl font-bold text-red-600">${stats.overdue.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-4 border-l-4 border-l-green-500">
          <p className="text-sm text-gray-600 mb-1">Paid</p>
          <p className="text-2xl font-bold text-green-600">${stats.paid.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-64">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search bills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
        </select>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Bill Number
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredBills.length > 0 ? (
              filteredBills.map((bill) => (
                <tr key={bill.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {bill.billNumber}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {bill.vendor}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    ${bill.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {bill.dueDate}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(bill.status)}
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          bill.status
                        )}`}
                      >
                        {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm flex justify-end gap-2">
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No bills found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
