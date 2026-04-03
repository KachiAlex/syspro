'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Users, ShoppingCart, DollarSign, Download, Calendar, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface SalesMetric {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ElementType;
}

interface SalesReport {
  id: string;
  name: string;
  type: string;
  date: string;
  status: string;
  size: string;
}

const salesMetrics: SalesMetric[] = [
  {
    title: 'Total Sales',
    value: '1,248',
    change: '+8.7%',
    trend: 'up',
    icon: ShoppingCart
  },
  {
    title: 'Revenue',
    value: '$425,000',
    change: '+12.5%',
    trend: 'up',
    icon: DollarSign
  },
  {
    title: 'Conversion Rate',
    value: '18.5%',
    change: '+2.3%',
    trend: 'up',
    icon: TrendingUp
  },
  {
    title: 'Avg Order Value',
    value: '$341',
    change: '+3.8%',
    trend: 'up',
    icon: Users
  }
];

const salesReports: SalesReport[] = [
  { id: '1', name: 'Monthly Sales Performance', type: 'Performance', date: '2026-04-03', status: 'Completed', size: '1.8 MB' },
  { id: '2', name: 'Customer Acquisition Report', type: 'Acquisition', date: '2026-04-02', status: 'Completed', size: '2.1 MB' },
  { id: '3', name: 'Sales Pipeline Analysis', type: 'Pipeline', date: '2026-04-01', status: 'Completed', size: '1.5 MB' },
  { id: '4', name: 'Revenue Forecast Q2', type: 'Forecast', date: '2026-03-31', status: 'Processing', size: '2.8 MB' },
];

export default function SalesAnalyticsPage() {
  const { tenantSlug } = useTenantContext();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [selectedReportType, setSelectedReportType] = useState('All');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Sales Reports</h2>
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
              <option>Performance</option>
              <option>Acquisition</option>
              <option>Pipeline</option>
              <option>Forecast</option>
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
        {salesMetrics.map((metric, idx) => (
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Performance Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Leads Generated</span>
              <span className="text-sm font-semibold text-gray-900">6,742</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Qualified Leads</span>
              <span className="text-sm font-semibold text-gray-900">2,156</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Deals Closed</span>
              <span className="text-sm font-semibold text-gray-900">1,248</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Win Rate</span>
              <span className="text-sm font-semibold text-green-600">57.9%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">New Customers</span>
              <span className="text-sm font-semibold text-gray-900">$185,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Existing Customers</span>
              <span className="text-sm font-semibold text-gray-900">$156,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Upsells & Cross-sells</span>
              <span className="text-sm font-semibold text-gray-900">$84,000</span>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Total Revenue</span>
                <span className="text-sm font-bold text-green-600">$425,000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h3>
        <div className="space-y-3">
          {salesReports.map((report) => (
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Acquisition</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">New Customers</span>
              <span className="text-sm font-semibold text-green-600">324</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Customer Acquisition Cost</span>
              <span className="text-sm font-semibold text-gray-900">$285</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Customer Lifetime Value</span>
              <span className="text-sm font-semibold text-green-600">$3,420</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Churn Rate</span>
              <span className="text-sm font-semibold text-amber-600">5.2%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Pipeline</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Leads</span>
              <span className="text-sm font-semibold text-blue-600">6,742</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Opportunities</span>
              <span className="text-sm font-semibold text-purple-600">2,156</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Proposals</span>
              <span className="text-sm font-semibold text-amber-600">1,487</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Closed Won</span>
              <span className="text-sm font-semibold text-green-600">1,248</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Forecasting</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Next Month Forecast</span>
              <span className="text-sm font-semibold text-green-600">$468,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Q2 Forecast</span>
              <span className="text-sm font-semibold text-green-600">$1.42M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Annual Forecast</span>
              <span className="text-sm font-semibold text-green-600">$5.8M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Forecast Accuracy</span>
              <span className="text-sm font-semibold text-green-600">92.3%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
