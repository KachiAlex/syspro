"use client";

import React, { useState } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Calendar,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface MetricCard {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  trend: "up" | "down";
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  category: string;
}

export default function FinanceDashboard() {
  const [period, setPeriod] = useState("month"); // month, quarter, year

  // Sample data
  const metrics: MetricCard[] = [
    {
      title: "Total Revenue",
      value: "$125,430",
      change: 12.5,
      icon: <TrendingUp className="h-6 w-6 text-green-600" />,
      trend: "up",
    },
    {
      title: "Total Expenses",
      value: "$45,320",
      change: -8.2,
      icon: <TrendingDown className="h-6 w-6 text-red-600" />,
      trend: "down",
    },
    {
      title: "Net Income",
      value: "$80,110",
      change: 15.3,
      icon: <DollarSign className="h-6 w-6 text-blue-600" />,
      trend: "up",
    },
    {
      title: "Profit Margin",
      value: "63.8%",
      change: 2.1,
      icon: <PieChart className="h-6 w-6 text-purple-600" />,
      trend: "up",
    },
  ];

  const recentTransactions: Transaction[] = [
    {
      id: "1",
      description: "Product Sales",
      amount: 5250,
      type: "income",
      date: "2025-03-22",
      category: "Revenue",
    },
    {
      id: "2",
      description: "Office Rent",
      amount: 3500,
      type: "expense",
      date: "2025-03-20",
      category: "Operating Expenses",
    },
    {
      id: "3",
      description: "Consulting Services",
      amount: 2100,
      type: "income",
      date: "2025-03-19",
      category: "Revenue",
    },
    {
      id: "4",
      description: "Equipment Purchase",
      amount: 1250,
      type: "expense",
      date: "2025-03-18",
      category: "Capital Expenditure",
    },
    {
      id: "5",
      description: "Client Invoice Payment",
      amount: 8900,
      type: "income",
      date: "2025-03-17",
      category: "Revenue",
    },
  ];

  const expensesByCategory = [
    { name: "Operating Expenses", value: 45, color: "bg-blue-500" },
    { name: "Salaries", value: 35, color: "bg-green-500" },
    { name: "Utilities", value: 12, color: "bg-yellow-500" },
    { name: "Other", value: 8, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Overview of your financial performance and recent transactions
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div
            key={metric.title}
            className="bg-white rounded-lg shadow p-6 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">{metric.title}</h3>
              {metric.icon}
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {metric.value}
              </div>
              <div
                className={`text-sm mt-2 flex items-center gap-1 ${
                  metric.trend === "up" ? "text-green-600" : "text-red-600"
                }`}
              >
                {metric.trend === "up" ? "↑" : "↓"}
                <span>{Math.abs(metric.change)}% vs last period</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Transactions
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {transaction.description}
                  </p>
                  <p className="text-sm text-gray-500">{transaction.category}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      transaction.type === "income"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "-"}$
                    {transaction.amount.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">{transaction.date}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-gray-200 text-center">
            <Link
              href="/tenant-admin/expenses"
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-2"
            >
              View All Transactions
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Expenses by Category
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {expensesByCategory.map((category) => (
              <div key={category.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {category.name}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {category.value}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${category.color}`}
                    style={{ width: `${category.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link
          href="/tenant-admin/expenses"
          className="p-4 bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition text-center"
        >
          <DollarSign className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-900">Manage Expenses</p>
        </Link>
        <Link
          href="/tenant-admin/bills"
          className="p-4 bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition text-center"
        >
          <DollarSign className="h-8 w-8 text-orange-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-900">Bills</p>
        </Link>
        <Link
          href="/tenant-admin/payments"
          className="p-4 bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition text-center"
        >
          <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-900">Payments</p>
        </Link>
        <Link
          href="/tenant-admin/finance/reports"
          className="p-4 bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition text-center"
        >
          <PieChart className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-900">Reports</p>
        </Link>
      </div>
    </div>
  );
}
