'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, Download, TrendingUp, Users, DollarSign, Calendar } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
  status: string;
  budgetApproved: number;
  budgetSpent: number;
  startDate: string;
  endDate: string;
}

interface ProjectsReportsProps {
  projects: Project[];
  tenantSlug: string;
}

export default function ProjectsReports({ projects, tenantSlug }: ProjectsReportsProps) {
  const [reportType, setReportType] = useState<'summary' | 'budget' | 'timeline' | 'performance'>('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/projects/reports?type=${reportType}&tenantSlug=${tenantSlug}`);
    } catch (err) {
      console.error('Failed to generate report:', err);
      setError('Failed to generate report');
      setTimeout(() => setError(null), 3500);
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async () => {
    try {
      const response = await apiClient.get(`/api/projects/reports/export?type=${reportType}&format=pdf&tenantSlug=${tenantSlug}`);
      // Handle file download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `projects-report-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
    } catch (err) {
      console.error('Failed to export report:', err);
      setError('Failed to export report');
      setTimeout(() => setError(null), 3500);
    }
  };

  const activeProjects = projects.filter(p => p.status === 'Active').length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  const totalBudget = projects.reduce((sum, p) => sum + p.budgetApproved, 0);
  const totalSpent = projects.reduce((sum, p) => sum + p.budgetSpent, 0);
  const budgetUtilization = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">{error}</div>}

      <div className="rounded-lg border border-gray-200 bg-theme-muted p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Report Generator</h3>
        <div className="flex gap-4 flex-col md:flex-row">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="summary">Summary Report</option>
            <option value="budget">Budget Analysis</option>
            <option value="timeline">Timeline Report</option>
            <option value="performance">Performance Metrics</option>
          </select>
          <button
            onClick={generateReport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4" />
            Generate Report
          </button>
          <button
            onClick={handleExportReport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 mb-1">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 mb-1">Active Projects</p>
              <p className="text-3xl font-bold text-gray-900">{activeProjects}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-violet-600 mb-1">Completed</p>
              <p className="text-3xl font-bold text-gray-900">{completedProjects}</p>
            </div>
            <Calendar className="w-8 h-8 text-violet-600" />
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600 mb-1">Budget Utilization</p>
              <p className="text-3xl font-bold text-gray-900">{budgetUtilization}%</p>
            </div>
            <DollarSign className="w-8 h-8 text-amber-600" />
          </div>
        </div>
      </div>

      {/* Budget Analysis */}
      <div className="rounded-lg border border-gray-200 bg-theme-muted p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Analysis</h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Total Budget Allocated</span>
              <span className="text-sm font-semibold text-gray-900">${totalBudget.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Total Budget Spent</span>
              <span className="text-sm font-semibold text-gray-900">${totalSpent.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Budget Remaining</span>
              <span className="text-sm font-semibold text-gray-900">${(totalBudget - totalSpent).toFixed(2)}</span>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Budget Utilization</span>
              <span className="text-sm font-semibold text-gray-900">{budgetUtilization}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full transition-all ${
                  budgetUtilization > 90 ? 'bg-red-500' :
                  budgetUtilization > 70 ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Project Status Distribution */}
      <div className="rounded-lg border border-gray-200 bg-theme-muted p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status Distribution</h3>
        <div className="space-y-3">
          {['Active', 'Planned', 'On Hold', 'Completed'].map(status => {
            const count = projects.filter(p => p.status === status).length;
            const percentage = projects.length > 0 ? Math.round((count / projects.length) * 100) : 0;
            return (
              <div key={status}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{status}</span>
                  <span className="text-sm font-semibold text-gray-900">{count} ({percentage}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      status === 'Active' ? 'bg-blue-500' :
                      status === 'Completed' ? 'bg-emerald-500' :
                      status === 'On Hold' ? 'bg-amber-500' :
                      'bg-slate-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
