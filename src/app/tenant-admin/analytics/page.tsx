'use client';

import React, { useState, useEffect } from 'react';
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
  },
  {
    id: 'sales',
    name: 'Sales Reports',
    href: '/tenant-admin/analytics/sales',
    icon: TrendingUp,
  },
  {
    id: 'hr',
    name: 'HR Reports',
    href: '/tenant-admin/analytics/hr',
    icon: Users,
  }
];

type MetricValue = { current: number; previous: number; growth: number; trend: string };

interface OverviewData {
  revenue: MetricValue;
  customers: MetricValue;
  orders: MetricValue;
  conversion: MetricValue;
  topProducts: { name: string; sales: number; revenue: number }[];
}

const PERIOD_DAYS: Record<string, number> = {
  'This Month': 30,
  'Last Month': 60,
  'Last Quarter': 90,
  'This Year': 365,
};

const formatCompact = (n: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

const trendLabel = (m?: MetricValue) => {
  if (!m) return '—';
  const arrow = m.growth >= 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(m.growth).toFixed(1)}% vs prior period`;
};

export default function AnalyticsPage() {
  const { tenantSlug } = useTenantContext();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [recentReports, setRecentReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  useEffect(() => {
    if (!tenantSlug) return;
    setLoadingReports(true);
    fetch(`/api/tenant/analytics?type=reports&tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((res) => res.json().catch(() => ({ reports: [] })))
      .then((payload) => {
        setRecentReports(payload.reports || payload.data?.reports || []);
      })
      .catch((err) => console.error('Failed to load recent reports:', err))
      .finally(() => setLoadingReports(false));
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    const days = PERIOD_DAYS[selectedPeriod] ?? 30;
    setLoadingOverview(true);
    fetch(`/api/tenant/analytics?type=overview&days=${days}&tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((res) => res.json().catch(() => ({})))
      .then((payload) => {
        setOverview(payload.data ?? null);
      })
      .catch((err) => {
        console.error('Failed to load analytics overview:', err);
        setOverview(null);
      })
      .finally(() => setLoadingOverview(false));
  }, [tenantSlug, selectedPeriod]);

  const handleDownload = (reportId: string) => {
    if (!tenantSlug || !reportId) return;
    window.open(`/api/tenant/analytics?action=download&reportId=${encodeURIComponent(reportId)}&tenantSlug=${encodeURIComponent(tenantSlug)}&format=csv`, '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">Reports & Analytics</h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
          >
            <option>This Month</option>
            <option>Last Month</option>
            <option>Last Quarter</option>
            <option>This Year</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600 mt-2">
                {overview ? formatCompact(overview.revenue.current) : loadingOverview ? '…' : '—'}
              </p>
              <p className="text-xs text-green-600 mt-2">{trendLabel(overview?.revenue)}</p>
            </div>
            <DollarSign className="w-12 h-12 text-green-500" />
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">New Customers</p>
              <p className="text-3xl font-bold text-theme-accent mt-2">
                {overview ? formatCompact(overview.customers.current) : loadingOverview ? '…' : '—'}
              </p>
              <p className="text-xs text-theme-accent mt-2">{trendLabel(overview?.customers)}</p>
            </div>
            <Users className="w-12 h-12 text-theme-accent" />
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Total Orders</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">
                {overview ? formatCompact(overview.orders.current) : loadingOverview ? '…' : '—'}
              </p>
              <p className="text-xs text-purple-600 mt-2">{trendLabel(overview?.orders)}</p>
            </div>
            <BarChart3 className="w-12 h-12 text-purple-100" />
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Lead Conversion</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">
                {overview ? `${overview.conversion.current}%` : loadingOverview ? '…' : '—'}
              </p>
              <p className="text-xs text-amber-600 mt-2">{trendLabel(overview?.conversion)}</p>
            </div>
            <TrendingUp className="w-12 h-12 text-amber-500" />
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border">
        <div className="border-b border-theme-border">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {reportTabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className="flex items-center gap-2 py-4 px-1 border-b-2 border-transparent text-sm font-medium text-theme-text-secondary hover:text-theme-text-primary hover:border-theme-border whitespace-nowrap"
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
                {tab.count && (
                  <span className="bg-theme-muted text-theme-text-primary px-2.5 py-0.5 rounded-full text-xs font-medium">
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
                <DollarSign className="w-8 h-8 text-theme-accent" />
                <h3 className="text-lg font-semibold text-theme-text-primary">Financial Reports</h3>
              </div>
              <p className="text-sm text-blue-700 mb-4">Revenue, expenses, cash flow, and financial health analysis</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-theme-accent">Revenue ({selectedPeriod})</span>
                  <span className="font-medium text-theme-text-primary">
                    {overview ? formatCompact(overview.revenue.current) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-theme-accent">Revenue Growth</span>
                  <span className="font-medium text-theme-text-primary">
                    {overview ? `${overview.revenue.growth.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
              <Link
                href="/tenant-admin/analytics/financial"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-theme-accent hover:text-theme-accent-hover"
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
                  <span className="text-green-600">Total Orders</span>
                  <span className="font-medium text-green-900">
                    {overview ? formatCompact(overview.orders.current) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Conversion Rate</span>
                  <span className="font-medium text-green-900">
                    {overview ? `${overview.conversion.current}%` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-600">Avg Order Value</span>
                  <span className="font-medium text-green-900">
                    {overview && overview.orders.current > 0
                      ? formatCompact(overview.revenue.current / overview.orders.current)
                      : '—'}
                  </span>
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

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Recent Reports & Insights</h3>
        {loadingReports ? (
          <div className="text-sm text-theme-text-secondary">Loading reports...</div>
        ) : (
          <div className="space-y-4">
            {recentReports.length === 0 ? (
              <div className="text-sm text-theme-text-secondary">No reports generated yet.</div>
            ) : (
              recentReports.map((report: any, idx: number) => (
                <div key={report.id || idx} className="flex items-center justify-between p-4 border border-theme-border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-theme-text-primary">{report.name || 'Untitled'}</p>
                    <p className="text-xs text-theme-text-secondary mt-1">{(report.module || report.reportType || 'Report').charAt(0).toUpperCase() + (report.module || report.reportType || 'Report').slice(1)} • {report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'Unknown'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      (report.status || '') === 'Completed' || (report.status || '') === 'approved' ? 'bg-green-100 text-green-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {report.status || 'Completed'}
                    </span>
                    <button
                      onClick={() => handleDownload(report.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
