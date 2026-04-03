'use client';

import React from 'react';
import { Download, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

export default function ReportsPage() {
  const { tenantSlug } = useTenantContext();

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">HR Reports & Analytics</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Workforce Summary</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Employees</span>
              <span className="font-semibold text-gray-900">5</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active</span>
              <span className="font-semibold text-green-600">4</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">On Leave</span>
              <span className="font-semibold text-amber-600">1</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Departments</span>
              <span className="font-semibold text-blue-600">4</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Key Metrics</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Turnover Rate</span>
              <span className="font-semibold text-gray-900">2.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg Tenure</span>
              <span className="font-semibold text-gray-900">4.8 yrs</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Attendance Rate</span>
              <span className="font-semibold text-gray-900">96.5%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Training Hours</span>
              <span className="font-semibold text-gray-900">156</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Salary Distribution</h4>
        <div className="space-y-3">
          {[
            { range: '$40K - $60K', count: 1, percentage: 20 },
            { range: '$60K - $80K', count: 2, percentage: 40 },
            { range: '$80K - $100K', count: 1, percentage: 20 },
            { range: '$100K+', count: 1, percentage: 20 },
          ].map((item, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">{item.range}</span>
                <span className="text-sm font-semibold text-gray-900">{item.count} ({item.percentage}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Department Breakdown</h4>
        <div className="space-y-3">
          {[
            { dept: 'Engineering', count: 2, percentage: 40 },
            { dept: 'Sales', count: 1, percentage: 20 },
            { dept: 'Marketing', count: 1, percentage: 20 },
            { dept: 'HR', count: 1, percentage: 20 },
          ].map((item, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">{item.dept}</span>
                <span className="text-sm font-semibold text-gray-900">{item.count} ({item.percentage}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-green-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Compliance Reports</h4>
        <div className="space-y-3">
          {[
            { name: 'Equal Employment Opportunity (EEO)', status: 'Compliant', lastUpdated: '2026-04-01' },
            { name: 'FMLA Compliance Report', status: 'Compliant', lastUpdated: '2026-04-01' },
            { name: 'Wage & Hour Compliance', status: 'Compliant', lastUpdated: '2026-04-01' },
            { name: 'Benefits Compliance', status: 'Compliant', lastUpdated: '2026-03-20' },
          ].map((report, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{report.name}</p>
                <p className="text-xs text-gray-600 mt-1">Last updated: {report.lastUpdated}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {report.status}
                </span>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Performance Analytics</h4>
        <div className="space-y-3">
          {[
            { metric: 'Average Performance Rating', value: '4.2/5.0', trend: 'up' },
            { metric: 'Employee Satisfaction Score', value: '8.5/10', trend: 'up' },
            { metric: 'Training Completion Rate', value: '92%', trend: 'up' },
            { metric: 'Promotion Rate (YTD)', value: '20%', trend: 'stable' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <span className="text-sm text-gray-600">{item.metric}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{item.value}</span>
                {item.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Available Reports</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Employee Directory Report',
            'Payroll Summary Report',
            'Attendance & Absence Report',
            'Training & Development Report',
            'Performance Review Report',
            'Compliance Audit Report',
            'Turnover Analysis Report',
            'Compensation Analysis Report',
          ].map((report, idx) => (
            <button
              key={idx}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-900">{report}</span>
              <Download className="w-4 h-4 text-blue-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
