'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Clock, DollarSign, Award, Download, Calendar, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface HRMetric {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon: React.ElementType;
}

interface HRReport {
  id: string;
  name: string;
  type: string;
  date: string;
  status: string;
  size: string;
}

export default function HRAnalyticsPage() {
  const { tenantSlug } = useTenantContext();
  const [selectedPeriod, setSelectedPeriod] = useState('This Month');
  const [selectedReportType, setSelectedReportType] = useState('All');
  const [hrMetrics, setHrMetrics] = useState<HRMetric[]>([]);
  const [hrReports, setHrReports] = useState<HRReport[]>([]);

  useEffect(() => {
    if (!tenantSlug) return;
    const ts = encodeURIComponent(tenantSlug);
    fetch(`/api/tenant/analytics?type=metrics&tenantSlug=${ts}`)
      .then((r) => r.json().catch(() => ({})))
      .then((payload) => {
        const d = payload?.data ?? {};
        const emp = d.employees ?? {};
        const dept = d.departments ?? {};
        const appr = d.approvals ?? {};
        setHrMetrics([
          { title: 'Active Employees', value: String(emp.active ?? emp.total ?? 0), change: `${emp.total ?? 0} total`, trend: 'up', icon: Users },
          { title: 'Departments', value: String(dept.total ?? 0), change: `${Number(dept.avgEmployeesPerDept ?? 0).toFixed(1)} avg staff`, trend: 'up', icon: Clock },
          { title: 'Avg Tenure', value: `${Number(emp.avgTenure ?? 0).toFixed(1)} yrs`, change: `turnover ${(Number(emp.turnover ?? 0) * 100).toFixed(0)}%`, trend: 'up', icon: DollarSign },
          { title: 'Pending Approvals', value: String(appr.pending ?? 0), change: `${appr.approved ?? 0} approved`, trend: 'up', icon: Award },
        ]);
      })
      .catch((err) => console.error('Failed to load HR metrics:', err));
    fetch(`/api/tenant/analytics?type=reports&tenantSlug=${ts}`)
      .then((r) => r.json().catch(() => ({})))
      .then((payload) => {
        const list = payload?.data?.reports ?? payload?.reports ?? [];
        setHrReports(list
          .filter((r: any) => !r.module || ['hr', 'people'].includes(String(r.module).toLowerCase()))
          .map((r: any) => ({
            id: r.id,
            name: r.name,
            type: r.reportType ?? r.module ?? 'Report',
            date: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : '—',
            status: r.status ?? 'Ready',
            size: '—',
          })));
      })
      .catch((err) => console.error('Failed to load HR reports:', err));
  }, [tenantSlug]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">HR Reports</h2>
        <Link
          href="/tenant-admin/analytics"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted"
        >
          ← Back to Overview
        </Link>
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
              <option>Attendance</option>
              <option>Payroll</option>
              <option>Training</option>
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
        {hrMetrics.map((metric, idx) => (
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
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Employee Performance Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">High Performers</span>
              <span className="text-sm font-semibold text-green-600">42</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Average Rating</span>
              <span className="text-sm font-semibold text-theme-text-primary">4.2/5.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Goals Completed</span>
              <span className="text-sm font-semibold text-green-600">87.3%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Performance Reviews</span>
              <span className="text-sm font-semibold text-theme-accent">156/156</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Attendance & Productivity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Attendance Rate</span>
              <span className="text-sm font-semibold text-green-600">94.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Punctuality Rate</span>
              <span className="text-sm font-semibold text-green-600">91.8%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Overtime Hours</span>
              <span className="text-sm font-semibold text-amber-600">247</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Absenteeism Rate</span>
              <span className="text-sm font-semibold text-green-600">2.1%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Available Reports</h3>
        <div className="space-y-3">
          {hrReports.map((report) => (
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
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Payroll Analysis</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Total Payroll</span>
              <span className="text-sm font-semibold text-theme-text-primary">$10.7M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Average Salary</span>
              <span className="text-sm font-semibold text-theme-text-primary">$68,500</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Benefits Cost</span>
              <span className="text-sm font-semibold text-theme-text-primary">$2.1M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Payroll Growth</span>
              <span className="text-sm font-semibold text-green-600">+4.8%</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Training & Development</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Training Completion</span>
              <span className="text-sm font-semibold text-green-600">87.3%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Training Hours</span>
              <span className="text-sm font-semibold text-theme-accent">3,842</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Certifications Earned</span>
              <span className="text-sm font-semibold text-purple-600">124</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Training ROI</span>
              <span className="text-sm font-semibold text-green-600">3.2x</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Workforce Demographics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Full-time Employees</span>
              <span className="text-sm font-semibold text-theme-accent">142</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Part-time Employees</span>
              <span className="text-sm font-semibold text-amber-600">14</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Contract Workers</span>
              <span className="text-sm font-semibold text-purple-600">8</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Avg Years of Service</span>
              <span className="text-sm font-semibold text-green-600">4.7</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
