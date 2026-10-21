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
        <h2 className="text-2xl font-bold text-gray-900">HR Reports</h2>
        <Link
          href="/tenant-admin/analytics"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-2">Period</label>
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
            <label className="block text-xs font-medium text-gray-900 mb-2">Report Type</label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>All</option>
              <option>Performance</option>
              <option>Attendance</option>
              <option>Payroll</option>
              <option>Training</option>
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
        {hrMetrics.map((metric, idx) => (
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
                metric.trend === 'up' ? 'text-green-500' : 'text-red-500'
              }`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Performance Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">High Performers</span>
              <span className="text-sm font-semibold text-green-600">42</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Average Rating</span>
              <span className="text-sm font-semibold text-gray-900">4.2/5.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Goals Completed</span>
              <span className="text-sm font-semibold text-green-600">87.3%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Performance Reviews</span>
              <span className="text-sm font-semibold text-blue-600">156/156</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance & Productivity</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Attendance Rate</span>
              <span className="text-sm font-semibold text-green-600">94.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Punctuality Rate</span>
              <span className="text-sm font-semibold text-green-600">91.8%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Overtime Hours</span>
              <span className="text-sm font-semibold text-amber-600">247</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Absenteeism Rate</span>
              <span className="text-sm font-semibold text-green-600">2.1%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h3>
        <div className="space-y-3">
          {hrReports.map((report) => (
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
                <button className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-theme-accent-hover">
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Analysis</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Payroll</span>
              <span className="text-sm font-semibold text-gray-900">$10.7M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Average Salary</span>
              <span className="text-sm font-semibold text-gray-900">$68,500</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Benefits Cost</span>
              <span className="text-sm font-semibold text-gray-900">$2.1M</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Payroll Growth</span>
              <span className="text-sm font-semibold text-green-600">+4.8%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Training & Development</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Training Completion</span>
              <span className="text-sm font-semibold text-green-600">87.3%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Training Hours</span>
              <span className="text-sm font-semibold text-blue-600">3,842</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Certifications Earned</span>
              <span className="text-sm font-semibold text-purple-600">124</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Training ROI</span>
              <span className="text-sm font-semibold text-green-600">3.2x</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Workforce Demographics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Full-time Employees</span>
              <span className="text-sm font-semibold text-blue-600">142</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Part-time Employees</span>
              <span className="text-sm font-semibold text-amber-600">14</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Contract Workers</span>
              <span className="text-sm font-semibold text-purple-600">8</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Years of Service</span>
              <span className="text-sm font-semibold text-green-600">4.7</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
