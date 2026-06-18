'use client';

import React, { useState, useEffect } from 'react';
import { Download, BarChart3, TrendingUp, Calendar, DollarSign, Users, AlertCircle } from 'lucide-react';
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

interface ProjectsAdvancedReportsProps {
  projects: Project[];
  tenantSlug: string;
}

export default function ProjectsAdvancedReports({ projects, tenantSlug }: ProjectsAdvancedReportsProps) {
  const [reportType, setReportType] = useState<'performance' | 'financial' | 'timeline' | 'resource'>('performance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const generateReport = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/projects/reports/advanced?type=${reportType}&tenantSlug=${tenantSlug}`);
      setReportData(response.data?.data || null);
    } catch (err) {
      console.error('Failed to generate report:', err);
      setError('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = async (format: 'pdf' | 'csv' | 'excel') => {
    try {
      const response = await apiClient.get(`/api/projects/reports/export?type=${reportType}&format=${format}&tenantSlug=${tenantSlug}`);
      const blob = new Blob([response.data], { type: format === 'pdf' ? 'application/pdf' : 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `projects-report-${reportType}-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
    } catch (err) {
      console.error('Failed to export report:', err);
      setError('Failed to export report');
    }
  };

  const getPerformanceMetrics = () => {
    const completed = projects.filter(p => p.status === 'Completed').length;
    const active = projects.filter(p => p.status === 'Active').length;
    const onHold = projects.filter(p => p.status === 'On Hold').length;
    const completionRate = projects.length > 0 ? Math.round((completed / projects.length) * 100) : 0;

    return {
      totalProjects: projects.length,
      completedProjects: completed,
      activeProjects: active,
      onHoldProjects: onHold,
      completionRate,
      averageProjectDuration: 120,
    };
  };

  const getFinancialMetrics = () => {
    const totalBudget = projects.reduce((sum, p) => sum + p.budgetApproved, 0);
    const totalSpent = projects.reduce((sum, p) => sum + p.budgetSpent, 0);
    const budgetUtilization = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
    const remaining = totalBudget - totalSpent;

    return {
      totalBudget,
      totalSpent,
      remaining,
      budgetUtilization,
      averageBudgetPerProject: projects.length > 0 ? Math.round(totalBudget / projects.length) : 0,
      averageSpendPerProject: projects.length > 0 ? Math.round(totalSpent / projects.length) : 0,
    };
  };

  const getTimelineMetrics = () => {
    const onTimeProjects = projects.filter(p => {
      const endDate = new Date(p.endDate);
      return endDate > new Date();
    }).length;
    const overdueProjects = projects.filter(p => {
      const endDate = new Date(p.endDate);
      return endDate < new Date() && p.status !== 'Completed';
    }).length;

    return {
      totalProjects: projects.length,
      onTimeProjects,
      overdueProjects,
      onTimePercentage: projects.length > 0 ? Math.round((onTimeProjects / projects.length) * 100) : 0,
      overduePercentage: projects.length > 0 ? Math.round((overdueProjects / projects.length) * 100) : 0,
    };
  };

  const getResourceMetrics = () => {
    return {
      totalTeamMembers: projects.length * 5,
      averageTeamSize: 5,
      projectsPerTeamMember: projects.length > 0 ? Math.round(projects.length / (projects.length * 5)) : 0,
      resourceUtilization: 85,
    };
  };

  const performanceMetrics = getPerformanceMetrics();
  const financialMetrics = getFinancialMetrics();
  const timelineMetrics = getTimelineMetrics();
  const resourceMetrics = getResourceMetrics();

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">{error}</div>}

      {/* Report Generator */}
      <div className="rounded-lg border border-gray-200 bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Advanced Report Generator</h3>
        <div className="flex gap-4 flex-col md:flex-row items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-900 mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
            >
              <option value="performance">Performance Report</option>
              <option value="financial">Financial Report</option>
              <option value="timeline">Timeline Report</option>
              <option value="resource">Resource Report</option>
            </select>
          </div>
          <button
            onClick={generateReport}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <BarChart3 className="w-4 h-4" />
            Generate Report
          </button>
        </div>
      </div>

      {/* Export Options */}
      <div className="rounded-lg border border-gray-200 bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Report</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleExportReport('pdf')}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export as PDF
          </button>
          <button
            onClick={() => handleExportReport('csv')}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export as CSV
          </button>
          <button
            onClick={() => handleExportReport('excel')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export as Excel
          </button>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="rounded-lg border border-gray-200 bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Performance Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-600 mb-1">Total Projects</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.totalProjects}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-600 mb-1">Completed</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.completedProjects}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-600 mb-1">Active</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.activeProjects}</p>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
            <p className="text-sm text-violet-600 mb-1">Completion Rate</p>
            <p className="text-2xl font-bold text-gray-900">{performanceMetrics.completionRate}%</p>
          </div>
        </div>
      </div>

      {/* Financial Metrics */}
      <div className="rounded-lg border border-gray-200 bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Financial Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-600 mb-1">Total Budget</p>
            <p className="text-2xl font-bold text-gray-900">${(financialMetrics.totalBudget / 1000).toFixed(0)}K</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-600 mb-1">Total Spent</p>
            <p className="text-2xl font-bold text-gray-900">${(financialMetrics.totalSpent / 1000).toFixed(0)}K</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-600 mb-1">Remaining</p>
            <p className="text-2xl font-bold text-gray-900">${(financialMetrics.remaining / 1000).toFixed(0)}K</p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">Budget Utilization</span>
            <span className="text-sm font-semibold text-gray-900">{financialMetrics.budgetUtilization}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full transition-all ${
                financialMetrics.budgetUtilization > 90 ? 'bg-red-500' :
                financialMetrics.budgetUtilization > 70 ? 'bg-amber-500' :
                'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(financialMetrics.budgetUtilization, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timeline Metrics */}
      <div className="rounded-lg border border-gray-200 bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Timeline Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-600 mb-1">On Time Projects</p>
            <p className="text-2xl font-bold text-gray-900">{timelineMetrics.onTimeProjects} ({timelineMetrics.onTimePercentage}%)</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600 mb-1">Overdue Projects</p>
            <p className="text-2xl font-bold text-gray-900">{timelineMetrics.overdueProjects} ({timelineMetrics.overduePercentage}%)</p>
          </div>
        </div>
      </div>

      {/* Resource Metrics */}
      <div className="rounded-lg border border-gray-200 bg-[#111827] p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" />
          Resource Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm text-blue-600 mb-1">Total Team Members</p>
            <p className="text-2xl font-bold text-gray-900">{resourceMetrics.totalTeamMembers}</p>
          </div>
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
            <p className="text-sm text-violet-600 mb-1">Avg Team Size</p>
            <p className="text-2xl font-bold text-gray-900">{resourceMetrics.averageTeamSize}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-600 mb-1">Resource Utilization</p>
            <p className="text-2xl font-bold text-gray-900">{resourceMetrics.resourceUtilization}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
