'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { TrendingUp, Users, ShoppingCart, DollarSign, Download, Calendar, Filter, ArrowUpRight, ArrowDownRight, BarChart3 } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { UnifiedReportModal } from '../../components/unified-report-modal';
import { ReportService } from '../../services/report-service';

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

export default function SalesAnalyticsPage() {
  const { tenantSlug } = useTenantContext();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [selectedReportType, setSelectedReportType] = useState('All');
  const [showReportModal, setShowReportModal] = useState(false);
  const [salesMetrics, setSalesMetrics] = useState<SalesMetric[]>([]);
  const [salesReports, setSalesReports] = useState<SalesReport[]>([]);

  useEffect(() => {
    if (!tenantSlug) return;
    const ts = encodeURIComponent(tenantSlug);
    fetch(`/api/tenant/analytics?type=overview&tenantSlug=${ts}`)
      .then((r) => r.json().catch(() => ({})))
      .then((payload) => {
        const d = payload?.data ?? {};
        const revenue = Number(d.revenue?.current ?? 0);
        const orders = Number(d.orders?.current ?? 0);
        const fmtChange = (v: any) => `${Number(v?.growth ?? 0) >= 0 ? '+' : ''}${v?.growth ?? 0}%`;
        setSalesMetrics([
          { title: 'Total Sales', value: orders.toLocaleString(), change: fmtChange(d.orders), trend: d.orders?.trend === 'down' ? 'down' : 'up', icon: ShoppingCart },
          { title: 'Revenue', value: revenue.toLocaleString(), change: fmtChange(d.revenue), trend: d.revenue?.trend === 'down' ? 'down' : 'up', icon: DollarSign },
          { title: 'Conversion Rate', value: `${d.conversion?.current ?? 0}%`, change: fmtChange(d.conversion), trend: d.conversion?.trend === 'down' ? 'down' : 'up', icon: TrendingUp },
          { title: 'Avg Order Value', value: orders ? Math.round(revenue / orders).toLocaleString() : '0', change: '—', trend: 'up', icon: Users },
        ]);
      })
      .catch((err) => console.error('Failed to load sales metrics:', err));
    fetch(`/api/tenant/analytics?type=reports&tenantSlug=${ts}`)
      .then((r) => r.json().catch(() => ({})))
      .then((payload) => {
        const list = payload?.data?.reports ?? payload?.reports ?? [];
        setSalesReports(list
          .filter((r: any) => !r.module || ['sales', 'crm', 'revops'].includes(String(r.module).toLowerCase()))
          .map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.reportType ?? r.module ?? 'Report',
            date: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '—',
            status: r.status ?? 'Ready',
            size: '—',
          })));
      })
      .catch((err) => console.error('Failed to load sales reports:', err));
  }, [tenantSlug]);

  const handleGenerateReport = async (reportData: any) => {
    try {
      const report = await ReportService.generateReport({
        module: 'sales',
        reportType: reportData.reportType,
        dateRange: reportData.dateRange,
        format: reportData.format,
        includeCharts: reportData.includeCharts,
        filters: reportData.filters,
        tenantSlug
      });

      setShowReportModal(false);
    } catch (error) {
      console.error('Failed to generate sales report:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">Sales Reports</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover"
          >
            <BarChart3 className="w-4 h-4" />
            Generate Report
          </button>
          <Link
            href="/tenant-admin/analytics"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted"
          >
            ← Back to Overview
          </Link>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Period</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
            >
              <option>This Month</option>
              <option>Last Month</option>
              <option>Last Quarter</option>
              <option>This Year</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Report Type</label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
            >
              <option>All</option>
              <option>Performance</option>
              <option>Acquisition</option>
              <option>Pipeline</option>
              <option>Forecast</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover">
              <Download className="w-4 h-4" />
              Generate Report
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {salesMetrics.map((metric, idx) => (
          <div key={idx} className="bg-theme-surface rounded-lg border border-theme-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-theme-text-secondary">{metric.title}</p>
                <p className="text-3xl font-bold text-theme-text-primary mt-2">{metric.value}</p>
                <p className={`text-xs mt-2 flex items-center gap-1 ${
                  metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metric.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {metric.change} from last period
                </p>
              </div>
              <metric.icon className={`w-12 h-12 ${
                metric.trend === 'up' ? 'text-green-500' : 'text-red-500'
              }`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Sales Performance Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Leads Generated</span>
              <span className="text-sm font-semibold text-theme-text-primary">6,742</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Qualified Leads</span>
              <span className="text-sm font-semibold text-theme-text-primary">2,156</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Deals Closed</span>
              <span className="text-sm font-semibold text-theme-text-primary">1,248</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Win Rate</span>
              <span className="text-sm font-semibold text-green-600">57.9%</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Revenue Breakdown</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">New Customers</span>
              <span className="text-sm font-semibold text-theme-text-primary">$185,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Existing Customers</span>
              <span className="text-sm font-semibold text-theme-text-primary">$156,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Upsells & Cross-sells</span>
              <span className="text-sm font-semibold text-theme-text-primary">$84,000</span>
            </div>
            <div className="pt-4 border-t border-theme-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-theme-text-primary">Total Revenue</span>
                <span className="text-sm font-bold text-green-600">$425,000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Available Reports</h3>
        <div className="space-y-3">
          {salesReports.map((report) => (
            <div key={report.id} className="flex items-center justify-between p-4 border border-theme-border rounded-lg hover:bg-theme-muted">
              <div className="flex-1">
                <p className="font-medium text-theme-text-primary">{report.name}</p>
                <p className="text-xs text-theme-text-secondary mt-1">{report.type} • {report.date} • {report.size}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  report.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {report.status}
                </span>
                <button className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover">
                  <Download className="w-3 h-3" />
                  Download
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Customer Acquisition</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">New Customers</span>
              <span className="text-sm font-semibold text-green-600">324</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Customer Acquisition Cost</span>
              <span className="text-sm font-semibold text-theme-text-primary">$285</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Customer Lifetime Value</span>
              <span className="text-sm font-semibold text-green-600">$3,420</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Churn Rate</span>
              <span className="text-sm font-semibold text-amber-600">5.2%</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Sales Pipeline</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Leads</span>
              <span className="text-sm font-semibold text-theme-accent">6,742</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Opportunities</span>
              <span className="text-sm font-semibold text-purple-600">2,156</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Proposals</span>
              <span className="text-sm font-semibold text-amber-600">1,487</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Closed Won</span>
              <span className="text-sm font-semibold text-green-600">1,248</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Revenue Forecasting</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Next Month Forecast</span>
              <span className="text-sm font-semibold text-green-600">$468,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Q2 Forecast</span>
              <span className="text-sm font-semibold text-green-600">$1.42M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Annual Forecast</span>
              <span className="text-sm font-semibold text-green-600">$5.8M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Forecast Accuracy</span>
              <span className="text-sm font-semibold text-green-600">92.3%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Report Modal */}
      <UnifiedReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        module="sales"
        tenantSlug={tenantSlug || ''}
        onReportGenerated={() => {}}
      />
    </div>
  );
}
