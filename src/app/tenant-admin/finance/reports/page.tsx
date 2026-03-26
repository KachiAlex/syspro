"use client";

import React, { useState } from "react";
import {
  Download,
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  Calendar,
  FileText,
  DollarSign,
} from "lucide-react";

interface Report {
  id: string;
  name: string;
  description: string;
  type: "income_statement" | "balance_sheet" | "cash_flow" | "expense_breakdown";
  lastGenerated: string;
  icon: React.ReactNode;
}

export default function FinanceReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [startDate, setStartDate] = useState("2024-03-01");
  const [endDate, setEndDate] = useState("2024-03-31");

  const reports: Report[] = [
    {
      id: "1",
      name: "Income Statement",
      description: "Revenue, expenses, and net income analysis",
      type: "income_statement",
      lastGenerated: "2024-03-23",
      icon: <TrendingUp className="h-8 w-8 text-blue-600" />,
    },
    {
      id: "2",
      name: "Balance Sheet",
      description: "Assets, liabilities, and equity overview",
      type: "balance_sheet",
      lastGenerated: "2024-03-23",
      icon: <DollarSign className="h-8 w-8 text-green-600" />,
    },
    {
      id: "3",
      name: "Cash Flow Statement",
      description: "Operating, investing, and financing activities",
      type: "cash_flow",
      lastGenerated: "2024-03-22",
      icon: <LineChart className="h-8 w-8 text-purple-600" />,
    },
    {
      id: "4",
      name: "Expense Breakdown",
      description: "Detailed expense analysis by category",
      type: "expense_breakdown",
      lastGenerated: "2024-03-23",
      icon: <PieChart className="h-8 w-8 text-orange-600" />,
    },
  ];

  const incomeStatementData = {
    totalRevenue: 125430,
    costOfGoodsSold: 45320,
    grossProfit: 80110,
    operatingExpenses: 28950,
    operatingIncome: 51160,
    interestExpense: 1500,
    netIncome: 49660,
  };

  const expenseCategories = [
    { name: "Salaries", amount: 35000, percentage: 42 },
    { name: "Operating Expenses", amount: 22000, percentage: 26 },
    { name: "Utilities", amount: 8900, percentage: 11 },
    { name: "Marketing", amount: 12500, percentage: 15 },
    { name: "Other", amount: 5550, percentage: 6 },
  ];

  const monthlyData = [
    { month: "Jan", revenue: 95000, expenses: 42000 },
    { month: "Feb", revenue: 110000, expenses: 45000 },
    { month: "Mar", revenue: 125430, expenses: 45320 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Finance Reports</h1>
          <p className="text-gray-600 mt-2">Generate and analyze financial statements</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Period
              </label>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-end">
              <button className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                <Download className="h-4 w-4" />
                Generate
              </button>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {reports.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {report.icon}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{report.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Last generated: {new Date(report.lastGenerated).toLocaleDateString()}
                </p>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition">
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Income Statement Preview */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Income Statement (YTD)</h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <p className="text-gray-900 font-medium">Total Revenue</p>
              <p className="text-lg font-bold text-green-600">
                ${incomeStatementData.totalRevenue.toLocaleString()}
              </p>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <p className="text-gray-900 font-medium">Cost of Goods Sold</p>
              <p className="text-lg font-bold text-red-600">
                -${incomeStatementData.costOfGoodsSold.toLocaleString()}
              </p>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-200 bg-gray-50 px-4">
              <p className="text-gray-900 font-bold">Gross Profit</p>
              <p className="text-lg font-bold text-blue-600">
                ${incomeStatementData.grossProfit.toLocaleString()}
              </p>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-200">
              <p className="text-gray-900 font-medium">Operating Expenses</p>
              <p className="text-lg font-bold text-red-600">
                -${incomeStatementData.operatingExpenses.toLocaleString()}
              </p>
            </div>

            <div className="flex justify-between items-center py-3 border-b border-gray-200 bg-gray-50 px-4">
              <p className="text-gray-900 font-bold">Operating Income</p>
              <p className="text-lg font-bold text-blue-600">
                ${incomeStatementData.operatingIncome.toLocaleString()}
              </p>
            </div>

            <div className="flex justify-between items-center py-3">
              <p className="text-gray-900 font-bold">Net Income</p>
              <p className="text-xl font-bold text-green-600">
                ${incomeStatementData.netIncome.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Expense Breakdown by Category</h2>

            <div className="space-y-4">
              {expenseCategories.map((category) => (
                <div key={category.name}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-gray-700">{category.name}</p>
                    <p className="text-sm font-bold text-gray-900">{category.percentage}%</p>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    ${category.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Comparison */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Monthly Comparison</h2>

            <div className="space-y-6">
              {monthlyData.map((month) => (
                <div key={month.month}>
                  <p className="text-sm font-bold text-gray-900 mb-3">{month.month}</p>
                  <div className="flex items-end gap-4 h-24">
                    <div className="flex-1">
                      <div className="bg-green-500 rounded-t h-full w-full" />
                      <p className="text-xs text-center mt-2 text-gray-600">Revenue</p>
                      <p className="text-xs font-bold text-center">
                        ${(month.revenue / 1000).toFixed(0)}K
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="bg-red-500 rounded-t h-16 w-full" />
                      <p className="text-xs text-center mt-2 text-gray-600">Expenses</p>
                      <p className="text-xs font-bold text-center">
                        ${(month.expenses / 1000).toFixed(0)}K
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
