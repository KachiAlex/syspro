'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, Trash2, Eye, RefreshCw, Archive } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ArchivedProject {
  id: string;
  name: string;
  description: string;
  objective: string;
  status: string;
  completedDate: string;
  budgetApproved: number;
  budgetSpent: number;
  owner: string;
}

interface ProjectsArchiveProps {
  tenantSlug: string;
  onRefresh: () => void;
}

export default function ProjectsArchive({ tenantSlug, onRefresh }: ProjectsArchiveProps) {
  const [archivedProjects, setArchivedProjects] = useState<ArchivedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchArchivedProjects();
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

  const fetchArchivedProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/projects/archive?tenantSlug=${tenantSlug}`);
      setArchivedProjects(response.data?.projects || []);
    } catch (err) {
      console.error('Failed to fetch archived projects:', err);
      setError('Failed to load archived projects');
      setArchivedProjects([]);
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
    if (selectedProjects.size === filteredProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedProjects.size === 0) return;
    if (!confirm(`Restore ${selectedProjects.size} project(s)?`)) return;

    try {
      await apiClient.post(`/api/projects/restore`, {
        projectIds: Array.from(selectedProjects),
        tenantSlug,
      });
      setSuccess(`${selectedProjects.size} project(s) restored successfully!`);
      setSelectedProjects(new Set());
      fetchArchivedProjects();
      onRefresh();
    } catch (err) {
      console.error('Failed to restore projects:', err);
      setError('Failed to restore projects');
    }
  };

  const handleRestoreProject = async (projectId: string) => {
    if (!confirm('Restore this project?')) return;
    try {
      await apiClient.post(`/api/projects/${projectId}/restore`, { tenantSlug });
      setSuccess('Project restored successfully!');
      fetchArchivedProjects();
      onRefresh();
    } catch (err) {
      console.error('Failed to restore project:', err);
      setError('Failed to restore project');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Permanently delete this project? This action cannot be undone.')) return;
    try {
      await apiClient.delete(`/api/projects/${projectId}?tenantSlug=${tenantSlug}`);
      setSuccess('Project deleted permanently!');
      fetchArchivedProjects();
      onRefresh();
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('Failed to delete project');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedProjects.size === 0) return;
    if (!confirm(`Permanently delete ${selectedProjects.size} project(s)? This action cannot be undone.`)) return;

    try {
      await apiClient.post(`/api/projects/delete-permanent`, {
        projectIds: Array.from(selectedProjects),
        tenantSlug,
      });
      setSuccess(`${selectedProjects.size} project(s) deleted permanently!`);
      setSelectedProjects(new Set());
      fetchArchivedProjects();
      onRefresh();
    } catch (err) {
      console.error('Failed to delete projects:', err);
      setError('Failed to delete projects');
    }
  };

  const filteredProjects = archivedProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <h3 className="text-2xl font-bold text-gray-900">Archived Projects</h3>
          <p className="text-theme-text-secondary mt-1">{archivedProjects.length} archived project(s)</p>
        </div>
        <button
          onClick={fetchArchivedProjects}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      {archivedProjects.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-theme-muted p-4">
          <input
            type="text"
            placeholder="Search archived projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />
        </div>
      )}

      {/* Bulk Actions */}
      {filteredProjects.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-theme-muted p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedProjects.size === filteredProjects.length && filteredProjects.length > 0}
                onChange={handleSelectAll}
                className="bg-white w-4 h-4 rounded border-gray-300 text-black"
              />
              <span className="text-sm font-medium text-gray-900">
                Select All ({selectedProjects.size}/{filteredProjects.length})
              </span>
            </label>
            {selectedProjects.size > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={handleRestoreSelected}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore ({selectedProjects.size})
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedProjects.size})
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading archived projects...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-theme-muted p-12 text-center">
          <Archive className="w-12 h-12 text-theme-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No archived projects</h3>
          <p className="text-gray-600">Archive completed or inactive projects to keep your workspace organized</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map(project => {
            const budgetUtilization = getBudgetUtilization(project.budgetSpent, project.budgetApproved);
            
            return (
              <div key={project.id} className="rounded-lg border border-gray-200 bg-theme-muted p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => handleSelectProject(project.id)}
                      className="bg-white w-4 h-4 rounded border-gray-300 mt-1 text-black"
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                      <p className="text-sm text-gray-600">{project.objective}</p>
                    </div>
                  </div>
                  <span className="inline-flex px-3 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-900 border border-gray-200">
                    {project.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Owner</p>
                    <p className="font-medium text-gray-900">{project.owner}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Completed Date</p>
                    <p className="font-medium text-gray-900">{new Date(project.completedDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Budget Spent</p>
                    <p className="font-medium text-gray-900">${project.budgetSpent.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Budget Utilization</p>
                    <p className="font-medium text-gray-900">{budgetUtilization}%</p>
                  </div>
                </div>

                {/* Budget Utilization Bar */}
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
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
                    onClick={() => handleRestoreProject(project.id)}
                    className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 flex items-center justify-center gap-1"
                    title="Restore project"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restore
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 transition hover:bg-red-100 flex items-center justify-center"
                    title="Delete project permanently"
                  >
                    <Trash2 className="w-4 h-4" />
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
