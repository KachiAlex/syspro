'use client';

import React from 'react';
import Link from 'next/link';
import { Download, TrendingUp, BarChart3, Calendar } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

export default function ProjectReportsPage() {
  const { tenantSlug } = useTenantContext();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Project Reports & Analytics</h2>
        <Link
          href={`/tenant-admin/projects`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Projects</p>
          <p className="text-3xl font-bold text-gray-900">12</p>
          <p className="text-xs text-gray-500 mt-2">All time</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Completion Rate</p>
          <p className="text-3xl font-bold text-green-600">65%</p>
          <p className="text-xs text-gray-500 mt-2">Overall progress</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Budget</p>
          <p className="text-3xl font-bold text-blue-600">$455K</p>
          <p className="text-xs text-gray-500 mt-2">Allocated</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-600 mb-2">Avg Duration</p>
          <p className="text-3xl font-bold text-purple-600">4.5mo</p>
          <p className="text-xs text-gray-500 mt-2">Per project</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status Distribution</h3>
          <div className="space-y-3">
            {[
              { status: 'Completed', count: 4, percentage: 33 },
              { status: 'In Progress', count: 7, percentage: 58 },
              { status: 'Planning', count: 1, percentage: 9 },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">{item.status}</span>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Utilization</h3>
          <div className="space-y-3">
            {[
              { category: 'Development', spent: '$180K', budget: '$200K', percentage: 90 },
              { category: 'Design', spent: '$65K', budget: '$80K', percentage: 81 },
              { category: 'Infrastructure', spent: '$95K', budget: '$120K', percentage: 79 },
              { category: 'Testing', spent: '$45K', budget: '$55K', percentage: 82 },
            ].map((item, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">{item.category}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.spent} / {item.budget}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Performance Metrics</h3>
        <div className="space-y-3">
          {[
            { metric: 'On-Time Delivery Rate', value: '78%', trend: 'up' },
            { metric: 'Budget Adherence', value: '85%', trend: 'up' },
            { metric: 'Team Utilization', value: '92%', trend: 'up' },
            { metric: 'Quality Score', value: '4.2/5.0', trend: 'stable' },
            { metric: 'Scope Creep', value: '12%', trend: 'down' },
            { metric: 'Risk Incidents', value: '2', trend: 'down' },
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Timeline Analysis</h3>
        <div className="space-y-3">
          {[
            { project: 'Website Redesign', planned: '4 months', actual: '3.5 months', status: 'On Track' },
            { project: 'Mobile App Development', planned: '6 months', actual: '4 months (ongoing)', status: 'Ahead' },
            { project: 'API Integration', planned: '2 months', actual: '1.5 months', status: 'On Track' },
            { project: 'Database Migration', planned: '3 months', actual: '2.5 months (ongoing)', status: 'On Track' },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{item.project}</p>
                <p className="text-xs text-gray-600 mt-1">Planned: {item.planned} | Actual: {item.actual}</p>
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                item.status === 'On Track' ? 'bg-green-100 text-green-800' :
                item.status === 'Ahead' ? 'bg-blue-100 text-blue-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Project Summary Report',
            'Budget Analysis Report',
            'Timeline Variance Report',
            'Resource Utilization Report',
            'Risk Assessment Report',
            'Quality Metrics Report',
            'Team Performance Report',
            'Stakeholder Status Report',
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
