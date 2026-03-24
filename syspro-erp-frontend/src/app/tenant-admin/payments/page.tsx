"use client";

import React, { useState } from "react";
import {
  Plus,
  Send,
  Download,
  Search,
  Filter,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  CreditCard,
} from "lucide-react";

interface Payment {
  id: string;
  referenceNumber: string;
  amount: number;
  paymentMethod: "bank_transfer" | "credit_card" | "check" | "cash";
  recipient: string;
  date: string;
  status: "completed" | "processing" | "failed" | "scheduled";
  description: string;
  invoiceNumber?: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([
    {
      id: "1",
      referenceNumber: "PAY-001-2025",
      amount: 5000,
      paymentMethod: "bank_transfer",
      recipient: "ABC Vendors Inc",
      date: "2025-03-23",
      status: "completed",
      description: "Invoice Payment - Equipment",
      invoiceNumber: "INV-5001",
    },
    {
      id: "2",
      referenceNumber: "PAY-002-2025",
      amount: 2500,
      paymentMethod: "credit_card",
      recipient: "Cloud Services Ltd",
      date: "2025-03-22",
      status: "completed",
      description: "Monthly Subscription Payment",
      invoiceNumber: "INV-5002",
    },
    {
      id: "3",
      referenceNumber: "PAY-003-2025",
      amount: 1250,
      paymentMethod: "bank_transfer",
      recipient: "Insurance Company",
      date: "2025-03-21",
      status: "processing",
      description: "Monthly Insurance Premium",
    },
    {
      id: "4",
      referenceNumber: "PAY-004-2025",
      amount: 750,
      paymentMethod: "check",
      recipient: "Office Supplies Co",
      date: "2025-03-20",
      status: "scheduled",
      description: "Monthly Supplies",
      invoiceNumber: "INV-5004",
    },
    {
      id: "5",
      referenceNumber: "PAY-005-2025",
      amount: 3000,
      paymentMethod: "bank_transfer",
      recipient: "Contractors Ltd",
      date: "2025-03-19",
      status: "failed",
      description: "Project Completion Payment",
      invoiceNumber: "INV-5005",
    },
  ]);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.recipient.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      selectedStatus === "all" || payment.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const totalPaid = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amount, 0);
  const totalProcessing = payments
    .filter((p) => p.status === "processing")
    .reduce((sum, p) => sum + p.amount, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "scheduled":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4" />;
      case "processing":
        return <Clock className="h-4 w-4" />;
      case "scheduled":
        return <Calendar className="h-4 w-4" />;
      case "failed":
        return <AlertCircle className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "bank_transfer":
        return "🏦";
      case "credit_card":
        return "💳";
      case "check":
        return "✓";
      case "cash":
        return "💵";
      default:
        return "💰";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
            <p className="text-gray-600 mt-2">Track and manage all payment transactions</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Payment
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Completed Payments</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  ${totalPaid.toFixed(2)}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Processing</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  ${totalProcessing.toFixed(2)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Payments</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">
                  {payments.length}
                </p>
              </div>
              <Send className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="processing">Processing</option>
                <option value="scheduled">Scheduled</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Reference #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Recipient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {payment.referenceNumber}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{payment.recipient}</p>
                      <p className="text-xs text-gray-500">{payment.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    ${payment.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <span className="flex items-center gap-2">
                      {getPaymentMethodIcon(payment.paymentMethod)}
                      {payment.paymentMethod.replace("_", " ").toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(payment.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(payment.status)}`}>
                      {getStatusIcon(payment.status)}
                      {payment.status.charAt(0).toUpperCase() + payment.status.slice(1).replace("_", " ")}
                    </span>
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
