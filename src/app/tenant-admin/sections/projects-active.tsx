'use client';

import React, { useState, useEffect } from 'react';
import { Eye, Trash2, Copy, DollarSign, Calendar, AlertCircle, Zap, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
  description: string;
  objective: string;
  startDate: string;
  endDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  budgetApproved: number;
  budgetSpent: number;
  status: string;
  owner: string;
}

interface ProjectsActiveProps {
  projects: Project[];
  tenantSlug: string;
  onRefresh: () => void;
}

export default function ProjectsActive({ projects, tenantSlug, onRefresh }: ProjectsActiveProps) {
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchActiveProjects();
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchActiveProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/projects/active?tenantSlug=${tenantSlug}`);
      setActiveProjects(response.data?.projects || projects.filter(p => p.status === 'Active'));
    } catch (err) {
      console.error('Failed to fetch active projects:', err);
      setError('Failed to load active projects');
      setActiveProjects(projects.filter(p => p.status === 'Active'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProject = (projectId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProjects.size === activeProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(activeProjects.map(p => p.id)));
    }
  };

  const handleArchiveSelected = async () => {
    if (selectedProjects.size === 0) return;
    if (!confirm(`Archive ${selectedProjects.size} project(s)?`)) return;

    try {
      await apiClient.post(`/api/projects/archive`, {
        projectIds: Array.from(selectedProjects),
        tenantSlug,
      });
      setSuccess(`${selectedProjects.size} project(s) archived successfully!`);
      setSelectedProjects(new Set());
      fetchActiveProjects();
      onRefresh();
    } catch (err) {
      console.error('Failed to archive projects:', err);
      setError('Failed to archive projects');
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    if (!confirm('Archive this project?')) return;
    try {
      await apiClient.post(`/api/projects/${projectId}/archive`, { tenantSlug });
      setSuccess('Project archived successfully!');
      fetchActiveProjects();
      onRefresh();
    } catch (err) {
      console.error('Failed to archive project:', err);
      setError('Failed to archive project');
    }
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPriorityColor = (priority: string) => {
    switch(priority.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800 border border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'low': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      default: return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
  };

  const getBudgetUtilization = (spent: number, approved: number) => {
    return approved > 0 ? Math.round((spent / approved) * 100) : 0;
  };

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">{success}</div>}

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-[#F8FAFC]">Active Projects</h3>
          <p className="text-[#94A3B8] mt-1">{activeProjects.length} active project(s)</p>
        </div>
        <button
          onClick={fetchActiveProjects}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg text-[#F8FAFC] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Bulk Actions */}
      {activeProjects.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-[#111827] p-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedProjects.size === activeProjects.length && activeProjects.length > 0}
                onChange={handleSelectAll}
                className="bg-white w-4 h-4 rounded border-gray-300 text-black"
              />
              <span className="text-sm font-medium text-[#F8FAFC]">
                Select All ({selectedProjects.size}/{activeProjects.length})
              </span>
            </label>
            {selectedProjects.size > 0 && (
              <button
                onClick={handleArchiveSelected}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                Archive Selected ({selectedProjects.size})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="text-center py-8 text-[#64748B]">Loading active projects...</div>
      ) : activeProjects.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-[#111827] p-12 text-center">
          <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#F8FAFC] mb-2">No active projects</h3>
          <p className="text-[#94A3B8]">All projects are either planned, on hold, or completed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeProjects.map(project => {
            const budgetUtilization = getBudgetUtilization(project.budgetSpent, project.budgetApproved);
            const daysRemaining = getDaysRemaining(project.endDate);
            
            return (
              <div key={project.id} className="rounded-lg border border-gray-200 bg-[#111827] p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => handleSelectProject(project.id)}
                      className="bg-white w-4 h-4 rounded border-gray-300 mt-1 text-black"
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-[#F8FAFC] mb-1">{project.name}</h3>
                      <p className="text-sm text-[#94A3B8]">{project.objective}</p>
                    </div>
                  </div>
                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.priority)}`}>
                    {project.priority}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-[#64748B] text-xs mb-1">Owner</p>
                    <p className="font-medium text-[#F8FAFC]">{project.owner}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B] text-xs mb-1">Start Date</p>
                    <p className="font-medium text-[#F8FAFC]">{new Date(project.startDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B] text-xs mb-1">End Date</p>
                    <p className="font-medium text-[#F8FAFC]">{new Date(project.endDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[#64748B] text-xs mb-1">Days Remaining</p>
                    <p className={`font-medium ${daysRemaining < 0 ? 'text-red-400' : daysRemaining < 7 ? 'text-amber-600' : 'text-emerald-400'}`}>
                      {daysRemaining < 0 ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`}
                    </p>
                  </div>
                </div>

                {/* Budget Utilization */}
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                      <DollarSign className="w-4 h-4" />
                      <span>${project.budgetSpent.toFixed(2)} / ${project.budgetApproved.toFixed(2)}</span>
                    </div>
                    <span className="text-xs font-semibold text-[#F8FAFC]">{budgetUtilization}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
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

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {}}
                    className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 flex items-center justify-center gap-1"
                    title="View project details"
                  >
                    <Eye className="w-4 h-4" />
                    View
                  </button>
                  <button
                    onClick={() => handleArchiveProject(project.id)}
                    className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 flex items-center justify-center gap-1"
                    title="Archive project"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => {}}
                    className="rounded-lg border border-gray-200 bg-[#111827] px-3 py-2 text-[#F8FAFC] transition hover:bg-gray-100 flex items-center justify-center"
                    title="Duplicate project"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
