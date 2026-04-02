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
      case 'active': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'completed': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      case 'on hold': return 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
      case 'planned': return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority.toLowerCase()) {
      case 'critical': return 'bg-red-500/20 text-red-300 border border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
      case 'medium': return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
      case 'low': return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
      default: return 'bg-slate-500/20 text-slate-300 border border-slate-500/30';
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
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-12 text-center backdrop-blur">
        <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">Error Loading Projects</h3>
        <p className="text-red-300 mb-4">{error}</p>
        <button 
          onClick={() => fetchProjects()}
          className="px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white rounded-lg hover:shadow-lg hover:shadow-sky-500/50 transition-all inline-flex items-center font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-300 text-sm">{success}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Project Management</h2>
          <p className="text-white/70">Create and manage projects, assign teams, and track progress</p>
          {lastRefreshed && (
            <p className="text-xs text-white/50 mt-2">
              Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={fetchProjects}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-white/20 rounded-lg text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-slate-900/50 to-slate-950 p-6 backdrop-blur shadow-lg hover:border-blue-500/50 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60 mb-1">Total Projects</p>
              <p className="text-3xl font-bold text-white">{projects.length}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <Briefcase className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900/50 to-slate-950 p-6 backdrop-blur shadow-lg hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60 mb-1">Active Projects</p>
              <p className="text-3xl font-bold text-white">{activeProjects}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-slate-900/50 to-slate-950 p-6 backdrop-blur shadow-lg hover:border-violet-500/50 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60 mb-1">Total Budget</p>
              <p className="text-3xl font-bold text-white">${(totalBudget / 1000).toFixed(0)}K</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/50 to-slate-950 p-6 backdrop-blur shadow-lg hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/60 mb-1">Budget Spent</p>
              <p className="text-3xl font-bold text-white">${(totalSpent / 1000).toFixed(0)}K</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:shadow-xl"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
          <button 
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:shadow-xl"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/50 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition"
          >
            <option value="" className="bg-slate-900 text-white">All Status</option>
            <option value="active" className="bg-slate-900 text-white">Active</option>
            <option value="planned" className="bg-slate-900 text-white">Planned</option>
            <option value="completed" className="bg-slate-900 text-white">Completed</option>
            <option value="on hold" className="bg-slate-900 text-white">On Hold</option>
          </select>

          <select 
            value={priorityFilter} 
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/50 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition"
          >
            <option value="" className="bg-slate-900 text-white">All Priorities</option>
            <option value="low" className="bg-slate-900 text-white">Low</option>
            <option value="medium" className="bg-slate-900 text-white">Medium</option>
            <option value="high" className="bg-slate-900 text-white">High</option>
            <option value="critical" className="bg-slate-900 text-white">Critical</option>
          </select>

          <input 
            type="text"
            placeholder="Search by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/50 focus:border-sky-500/50 focus:outline-none focus:ring-2 focus:ring-sky-500/30 transition"
          />

          <div className="flex items-center gap-2">
            {(statusFilter || priorityFilter || searchQuery) && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-sky-500/20 px-3 py-2 border border-sky-500/30">
                <Filter className="w-4 h-4 text-sky-300" />
                <span className="text-xs font-semibold text-sky-300">{filteredProjects.length} results</span>
              </div>
            )}
            <div className="flex gap-1 rounded-lg border border-white/20 bg-white/10 p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition ${viewMode === 'grid' ? 'bg-sky-500/30 text-sky-300' : 'text-white/60 hover:text-white'}`}
                title="Grid view"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition ${viewMode === 'list' ? 'bg-sky-500/30 text-sky-300' : 'text-white/60 hover:text-white'}`}
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
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur animate-pulse">
                <div className="space-y-4">
                  <div className="h-6 bg-white/10 rounded w-3/4"></div>
                  <div className="h-4 bg-white/10 rounded w-full"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-4 bg-white/10 rounded"></div>
                    <div className="h-4 bg-white/10 rounded"></div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 h-8 bg-white/10 rounded"></div>
                    <div className="flex-1 h-8 bg-white/10 rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : filteredProjects.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-slate-900/50 to-slate-950 p-12 text-center backdrop-blur">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-white/40" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No projects found</h3>
            <p className="text-white/70 mb-6">
              {searchQuery || statusFilter || priorityFilter 
                ? "Try adjusting your filters or search criteria" 
                : "Get started by creating your first project"}
            </p>
            {!searchQuery && !statusFilter && !priorityFilter && (
              <button 
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:shadow-xl"
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
              <div key={project.id} className="group rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-slate-900/50 to-slate-950 p-6 backdrop-blur hover:border-white/20 transition-all shadow-lg hover:shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">{project.name}</h3>
                <p className="text-sm text-white/60">{project.objective}</p>
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
              <p className="text-sm text-white/70 mb-4 line-clamp-2">{project.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div>
                <p className="text-white/50 text-xs mb-1">Start Date</p>
                <p className="font-medium text-white">{project.startDate}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-1">End Date</p>
                <p className="font-medium text-white">{project.endDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-1">Budget</p>
                <p className="font-medium text-white">${project.budgetApproved.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-white/50 text-xs mb-1">Owner</p>
                <p className="font-medium text-white">{project.owner}</p>
              </div>
            </div>

            {project.endDate && getDaysRemaining(project.endDate) !== null && (
              <div className={`mb-4 rounded-lg px-3 py-2 text-xs font-semibold text-center ${
                getDaysRemaining(project.endDate)! < 0 ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                getDaysRemaining(project.endDate)! < 7 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {getDaysRemaining(project.endDate)! < 0 
                  ? `Overdue by ${Math.abs(getDaysRemaining(project.endDate)!)} days`
                  : `${getDaysRemaining(project.endDate)} days remaining`
                }
              </div>
            )}

            <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <DollarSign className="w-4 h-4" />
                  <span>${project.budgetSpent.toFixed(2)} spent</span>
                </div>
                <span className="text-xs font-semibold text-white">{budgetUtilization}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
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
                className="flex-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-300 transition hover:border-sky-500/60 hover:bg-sky-500/20 flex items-center justify-center gap-1"
                title="View project details"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">View</span>
              </button>
              <button 
                onClick={() => handleManageTasks(project)}
                className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-500/60 hover:bg-emerald-500/20 flex items-center justify-center gap-1"
                title="Manage project tasks"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Tasks</span>
              </button>
              <button 
                onClick={() => handleManageTeam(project)}
                className="flex-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-300 transition hover:border-violet-500/60 hover:bg-violet-500/20 flex items-center justify-center gap-1"
                title="Manage team members"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Team</span>
              </button>
              <button 
                onClick={() => handleDuplicateProject(project)}
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-300 transition hover:border-amber-500/60 hover:bg-amber-500/20 flex items-center justify-center"
                title="Duplicate project"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleDeleteProject(project.id)}
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300 transition hover:border-red-500/60 hover:bg-red-500/20 flex items-center justify-center"
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
