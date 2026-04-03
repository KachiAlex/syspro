'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { DollarSign, TrendingUp, TrendingDown, Download, Calendar, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface FinancialMetric {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ElementType;
}

interface FinancialReport {
  id: string;
  name: string;
  type: string;
  date: string;
  status: string;
  size: string;
}

const financialMetrics: FinancialMetric[] = [
  {
    title: 'Total Revenue',
    value: '$425,000',
    change: '+12.5%',
    trend: 'up',
    icon: DollarSign
  },
  {
    title: 'Total Expenses',
    value: '$326,000',
    change: '+8.2%',
    trend: 'up',
    icon: TrendingUp
  },
  {
    title: 'Net Profit',
    value: '$99,000',
    change: '+23.4%',
    trend: 'up',
    icon: TrendingUp
  },
  {
    title: 'Profit Margin',
    value: '23.4%',
    change: '+2.1%',
    trend: 'up',
    icon: TrendingUp
  }
];

const financialReports: FinancialReport[] = [
  { id: '1', name: 'Monthly Financial Summary', type: 'Revenue', date: '2026-04-03', status: 'Completed', size: '2.4 MB' },
  { id: '2', name: 'Q1 Profit & Loss', type: 'P&L', date: '2026-04-01', status: 'Completed', size: '1.8 MB' },
  { id: '3', name: 'Cash Flow Analysis', type: 'Cash Flow', date: '2026-03-31', status: 'Completed', size: '1.2 MB' },
  { id: '4', name: 'Budget vs Actual', type: 'Budget', date: '2026-03-30', status: 'Processing', size: '3.1 MB' },
];

export default function FinancialAnalyticsPage() {
  const { tenantSlug } = useTenantContext();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [selectedReportType, setSelectedReportType] = useState('All');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Financial Reports</h2>
        <Link
          href="/tenant-admin/analytics"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>This Month</option>
              <option>Last Month</option>
              <option>Last Quarter</option>
              <option>This Year</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Report Type</label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All</option>
              <option>Revenue</option>
              <option>Expenses</option>
              <option>Profit & Loss</option>
              <option>Cash Flow</option>
              <option>Budget</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" />
              Generate Report
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {financialMetrics.map((metric, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{metric.value}</p>
                <p className={`text-xs mt-2 flex items-center gap-1 ${
                  metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metric.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {metric.change} from last period
                </p>
              </div>
              <metric.icon className={`w-12 h-12 ${
                metric.trend === 'up' ? 'text-green-100' : 'text-red-100'
              }`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Analysis</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Product Sales</span>
              <span className="text-sm font-semibold text-gray-900">$285,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Service Revenue</span>
              <span className="text-sm font-semibold text-gray-900">$95,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Subscription Revenue</span>
              <span className="text-sm font-semibold text-gray-900">$45,000</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Total Revenue</span>
                <span className="text-sm font-bold text-green-600">$425,000</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Salaries & Wages</span>
              <span className="text-sm font-semibold text-gray-900">$185,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Operating Expenses</span>
              <span className="text-sm font-semibold text-gray-900">$78,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Marketing & Sales</span>
              <span className="text-sm font-semibold text-gray-900">$42,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Other Expenses</span>
              <span className="text-sm font-semibold text-gray-900">$21,000</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Total Expenses</span>
                <span className="text-sm font-bold text-red-600">$326,000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h3>
        <div className="space-y-3">
          {financialReports.map((report) => (
            <div key={report.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{report.name}</p>
                <p className="text-xs text-gray-600 mt-1">{report.type} • {report.date} • {report.size}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  report.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {report.status}
                </span>
                <button className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Financial Health Indicators</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Current Ratio</span>
              <span className="text-sm font-semibold text-green-600">2.4</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Debt-to-Equity</span>
              <span className="text-sm font-semibold text-amber-600">0.8</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Gross Margin</span>
              <span className="text-sm font-semibold text-green-600">42.3%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Operating Margin</span>
              <span className="text-sm font-semibold text-green-600">23.4%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Performance</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Revenue Budget</span>
              <span className="text-sm font-semibold text-green-600">106.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Expense Budget</span>
              <span className="text-sm font-semibold text-amber-600">98.5%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Capital Expenditure</span>
              <span className="text-sm font-semibold text-green-600">87.3%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">R&D Investment</span>
              <span className="text-sm font-semibold text-green-600">112.7%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cash Flow Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Operating Cash Flow</span>
              <span className="text-sm font-semibold text-green-600">$125,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Investing Cash Flow</span>
              <span className="text-sm font-semibold text-red-600">-$45,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Financing Cash Flow</span>
              <span className="text-sm font-semibold text-red-600">-$12,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Net Cash Flow</span>
              <span className="text-sm font-semibold text-green-600">$68,000</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
