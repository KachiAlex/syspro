'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BarChart3, TrendingUp, DollarSign, Users, Calendar, Download, Filter } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface ReportTab {
  id: string;
  name: string;
  href: string;
  icon: React.ElementType;
  count?: number;
}

const reportTabs: ReportTab[] = [
  {
    id: 'financial',
    name: 'Financial Reports',
    href: '/tenant-admin/analytics/financial',
    icon: DollarSign,
    count: 12
  },
  {
    id: 'sales',
    name: 'Sales Reports',
    href: '/tenant-admin/analytics/sales',
    icon: TrendingUp,
    count: 8
  },
  {
    id: 'hr',
    name: 'HR Reports',
    href: '/tenant-admin/analytics/hr',
    icon: Users,
    count: 15
  }
];

export default function AnalyticsPage() {
  const { tenantSlug } = useTenantContext();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>This Month</option>
            <option>Last Month</option>
            <option>Last Quarter</option>
            <option>This Year</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600 mt-2">$425K</p>
              <p className="text-xs text-green-600 mt-2">↑ 12.5% from last month</p>
            </div>
            <DollarSign className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Employees</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">156</p>
              <p className="text-xs text-blue-600 mt-2">↑ 3.2% from last month</p>
            </div>
            <Users className="w-12 h-12 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">1,248</p>
              <p className="text-xs text-purple-600 mt-2">↑ 8.7% from last month</p>
            </div>
            <BarChart3 className="w-12 h-12 text-purple-100" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Profit Margin</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">23.4%</p>
              <p className="text-xs text-amber-600 mt-2">↑ 2.1% from last month</p>
            </div>
            <TrendingUp className="w-12 h-12 text-amber-500" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {reportTabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex items-center gap-2 py-4 px-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap"
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
                {tab.count && (
                  <span className="bg-gray-100 text-gray-900 px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {tab.count}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <DollarSign className="w-8 h-8 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Financial Reports</h3>
              </div>
              <p className="text-sm text-blue-700 mb-4">Revenue, expenses, cash flow, and financial health analysis</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600">Revenue Analysis</span>
                  <span className="font-medium text-gray-900">$425K</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600">Expense Tracking</span>
                  <span className="font-medium text-gray-900">$326K</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600">Profit Margin</span>
                  <span className="font-medium text-gray-900">23.4%</span>
                </div>
              </div>
              <Link
                href="/tenant-admin/analytics/financial"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-theme-accent-hover"
              >
                View Financial Reports →
              </Link>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-8 h-8 text-green-600" />
                <h3 className="text-lg font-semibold text-green-900">Sales Reports</h3>
              </div>
              <p className="text-sm text-green-700 mb-4">Sales performance, customer acquisition, and revenue forecasting</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Total Sales</span>
                  <span className="font-medium text-green-900">1,248</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Conversion Rate</span>
                  <span className="font-medium text-green-900">18.5%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Avg Order Value</span>
                  <span className="font-medium text-green-900">$341</span>
                </div>
              </div>
              <Link
                href="/tenant-admin/analytics/sales"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700"
              >
                View Sales Reports →
              </Link>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-8 h-8 text-purple-600" />
                <h3 className="text-lg font-semibold text-purple-900">HR Reports</h3>
              </div>
              <p className="text-sm text-purple-700 mb-4">Employee metrics, attendance, payroll, and workforce analytics</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-600">Active Employees</span>
                  <span className="font-medium text-purple-900">156</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-600">Attendance Rate</span>
                  <span className="font-medium text-purple-900">94.2%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-600">Training Completion</span>
                  <span className="font-medium text-purple-900">87.3%</span>
                </div>
              </div>
              <Link
                href="/tenant-admin/analytics/hr"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700"
              >
                View HR Reports →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reports & Insights</h3>
        <div className="space-y-4">
          {[
            { name: 'Monthly Financial Summary', type: 'Financial', date: '2026-04-03', status: 'Completed' },
            { name: 'Sales Performance Q1', type: 'Sales', date: '2026-04-02', status: 'Completed' },
            { name: 'Employee Productivity Analysis', type: 'HR', date: '2026-04-01', status: 'Processing' },
            { name: 'Revenue Forecast Report', type: 'Financial', date: '2026-03-31', status: 'Completed' },
          ].map((report, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{report.name}</p>
                <p className="text-xs text-gray-600 mt-1">{report.type} • {report.date}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  report.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {report.status}
                </span>
                <button className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-theme-accent-hover">
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
