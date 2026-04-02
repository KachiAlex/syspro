'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, Download, Filter, Briefcase, AlertCircle, TrendingUp, Users, Calendar, DollarSign, Grid3x3, List, Copy, RefreshCw } from 'lucide-react';
import { 
  CreateProjectModal, 
  ViewProjectModal, 
  ManageTeamModal,
  ManageTasksModal
} from './projects-modals';
import { apiClient } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
  description: string;
  objective: string;
  subsidiary: string;
  branch: string;
  departments: string[];
  startDate: string;
  endDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  budgetApproved: number;
  budgetSpent: number;
  status: 'Planned' | 'Active' | 'On Hold' | 'Completed';
  owner: string;
  approvalStatus: 'Pending' | 'Approved' | 'Rejected';
  region: string;
  createdBy: string;
  approvedBy?: string;
}

export default function Projects({ tenantSlug }: { tenantSlug: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showManageTeamModal, setShowManageTeamModal] = useState(false);
  const [showManageTasksModal, setShowManageTasksModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | undefined>();

  // Initialize last refreshed on mount
  useEffect(() => {
    setLastRefreshed(new Date());
  }, []);

  // Auto-dismiss alerts after 3.5 seconds
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

  // Fetch projects from API
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/projects');
      setProjects(response.data?.projects || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [tenantSlug]);

  const filteredProjects = projects.filter(p => {
    if (statusFilter && p.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (priorityFilter && p.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !p.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleCreateProject = async (data: any) => {
    try {
      const response = await apiClient.post('/api/projects', {
        ...data,
        tenantSlug,
        createdBy: 'current-user' // TODO: Get from auth context
      });
      
      setProjects([...projects, response.data]);
      setSuccess('Project created successfully!');
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create project:', err);
      setError('Failed to create project');
    }
  };

  const handleViewProject = (project: Project) => {
    setSelectedProject(project);
    setShowViewModal(true);
  };

  const handleManageTeam = (project: Project) => {
    setSelectedProject(project);
    setShowManageTeamModal(true);
  };

  const handleManageTasks = (project: Project) => {
    setSelectedProject(project);
    setShowManageTasksModal(true);
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      try {
        await apiClient.delete(`/api/projects/${id}`);
        setProjects(projects.filter(p => p.id !== id));
        setSuccess('Project deleted successfully!');
      } catch (err) {
        console.error('Failed to delete project:', err);
        setError('Failed to delete project');
      }
    }
  };

  const handleDuplicateProject = async (project: Project) => {
    try {
      const { id, createdBy, approvedBy, ...projectData } = project;
      const response = await apiClient.post('/api/projects', {
        ...projectData,
        name: `${project.name} (Copy)`,
        tenantSlug,
        createdBy: 'current-user'
      });
      
      setProjects([...projects, response.data]);
      setSuccess('Project duplicated successfully!');
    } catch (err) {
      console.error('Failed to duplicate project:', err);
      setError('Failed to duplicate project');
    }
  };

  const handleExport = () => {
    const csv = [
      ['Name', 'Status', 'Priority', 'Start Date', 'End Date', 'Budget', 'Spent', 'Owner'],
      ...filteredProjects.map(p => [
        p.name, p.status, p.priority, p.startDate, p.endDate, p.budgetApproved, p.budgetSpent, p.owner
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const activeProjects = projects.filter(p => p.status === 'Active').length;
  const completedProjects = projects.filter(p => p.status === 'Completed').length;
  const totalBudget = projects.reduce((sum, p) => sum + p.budgetApproved, 0);
  const totalSpent = projects.reduce((sum, p) => sum + p.budgetSpent, 0);

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'active': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'completed': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'on hold': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'planned': return 'bg-slate-100 text-slate-800 border border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
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

  const getDaysRemaining = (endDate: string) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (error && projects.length === 0) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-12 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Projects</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button 
          onClick={() => fetchProjects()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">{success}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Project Management</h2>
          <p className="text-gray-600">Create and manage projects, assign teams, and track progress</p>
          {lastRefreshed && (
            <p className="text-xs text-gray-500 mt-2">
              Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={fetchProjects}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 mb-1">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Briefcase className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 mb-1">Active Projects</p>
              <p className="text-3xl font-bold text-gray-900">{activeProjects}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-violet-600 mb-1">Total Budget</p>
              <p className="text-3xl font-bold text-gray-900">${(totalBudget / 1000).toFixed(0)}K</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-600 mb-1">Budget Spent</p>
              <p className="text-3xl font-bold text-gray-900">${(totalSpent / 1000).toFixed(0)}K</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
          <button 
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="planned">Planned</option>
            <option value="completed">Completed</option>
            <option value="on hold">On Hold</option>
          </select>

          <select 
            value={priorityFilter} 
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <input 
            type="text"
            placeholder="Search by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />

          <div className="flex items-center gap-2">
            {(statusFilter || priorityFilter || searchQuery) && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 border border-blue-200">
                <Filter className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-800">{filteredProjects.length} results</span>
              </div>
            )}
            <div className="flex gap-1 rounded-lg border border-gray-300 bg-white p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                title="Grid view"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
        {loading ? (
          <>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-6 animate-pulse">
                <div className="space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-8 bg-gray-200 rounded"></div>
                    <div className="flex-1 h-8 bg-gray-200 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : filteredProjects.length === 0 ? (
          <div className="col-span-full rounded-lg border border-gray-200 bg-white p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || statusFilter || priorityFilter 
                ? "Try adjusting your filters or search criteria" 
                : "Get started by creating your first project"}
            </p>
            {!searchQuery && !statusFilter && !priorityFilter && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Your First Project
              </button>
            )}
          </div>
        ) : (
          filteredProjects.map(project => {
            const budgetUtilization = getBudgetUtilization(project.budgetSpent, project.budgetApproved);
            return (
              <div key={project.id} className="group rounded-lg border border-gray-200 bg-white p-6 hover:shadow-lg transition-all shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                    <p className="text-sm text-gray-600">{project.objective}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.priority)}`}>
                      {project.priority}
                    </span>
                  </div>
                </div>

                {project.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{project.description}</p>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Start Date</p>
                    <p className="font-medium text-gray-900">{project.startDate}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">End Date</p>
                    <p className="font-medium text-gray-900">{project.endDate || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Budget</p>
                    <p className="font-medium text-gray-900">${project.budgetApproved.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Owner</p>
                    <p className="font-medium text-gray-900">{project.owner}</p>
                  </div>
                </div>

                {project.endDate && getDaysRemaining(project.endDate) !== null && (
                  <div className={`mb-4 rounded-lg px-3 py-2 text-xs font-semibold text-center ${
                    getDaysRemaining(project.endDate)! < 0 ? 'bg-red-100 text-red-800 border border-red-200' :
                    getDaysRemaining(project.endDate)! < 7 ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                    'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    {getDaysRemaining(project.endDate)! < 0 
                      ? `Overdue by ${Math.abs(getDaysRemaining(project.endDate)!)} days`
                      : `${getDaysRemaining(project.endDate)} days remaining`
                    }
                  </div>
                )}

                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span>${project.budgetSpent.toFixed(2)} spent</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">{budgetUtilization}%</span>
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

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleViewProject(project)}
                    className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 flex items-center justify-center gap-1"
                    title="View project details"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">View</span>
                  </button>
                  <button 
                    onClick={() => handleManageTasks(project)}
                    className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 flex items-center justify-center gap-1"
                    title="Manage project tasks"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="hidden sm:inline">Tasks</span>
                  </button>
                  <button 
                    onClick={() => handleManageTeam(project)}
                    className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100 flex items-center justify-center gap-1"
                    title="Manage team members"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Team</span>
                  </button>
                  <button 
                    onClick={() => handleDuplicateProject(project)}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 transition hover:bg-amber-100 flex items-center justify-center"
                    title="Duplicate project"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDeleteProject(project.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 transition hover:bg-red-100 flex items-center justify-center"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}

      {/* Modals */}
      <CreateProjectModal 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateProject}
      />
      <ViewProjectModal 
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        project={selectedProject}
      />
      <ManageTeamModal 
        isOpen={showManageTeamModal}
        onClose={() => setShowManageTeamModal(false)}
        onSubmit={() => setShowManageTeamModal(false)}
        project={selectedProject}
      />
      <ManageTasksModal 
        isOpen={showManageTasksModal}
        onClose={() => setShowManageTasksModal(false)}
        onSubmit={() => setShowManageTasksModal(false)}
        project={selectedProject}
      />
    </div>
  );
}
