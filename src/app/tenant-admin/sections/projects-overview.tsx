'use client';

import React from 'react';
import { Plus, Eye, Trash2, Download, Filter, Briefcase, TrendingUp, Users, Calendar, DollarSign, Grid3x3, List, Copy } from 'lucide-react';

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

interface ProjectsOverviewProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  lastRefreshed: Date | null;
  statusFilter: string;
  priorityFilter: string;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  onStatusFilterChange: (value: string) => void;
  onPriorityFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onCreateClick: () => void;
  onViewClick: (project: Project) => void;
  onManageTeamClick: (project: Project) => void;
  onManageTasksClick: (project: Project) => void;
  onDeleteClick: (id: string) => void;
  onDuplicateClick: (project: Project) => void;
  onExportClick: () => void;
  onRefreshClick: () => void;
  tenantSlug: string;
}

export default function ProjectsOverview({
  projects,
  loading,
  error,
  lastRefreshed,
  statusFilter,
  priorityFilter,
  searchQuery,
  viewMode,
  onStatusFilterChange,
  onPriorityFilterChange,
  onSearchChange,
  onViewModeChange,
  onCreateClick,
  onViewClick,
  onManageTeamClick,
  onManageTasksClick,
  onDeleteClick,
  onDuplicateClick,
  onExportClick,
  onRefreshClick,
  tenantSlug,
}: ProjectsOverviewProps) {
  const filteredProjects = projects.filter(p => {
    if (statusFilter && p.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (priorityFilter && p.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !p.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeProjects = projects.filter(p => p.status === 'Active').length;
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

  return (
    <div className="space-y-6">
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
            onClick={onCreateClick}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
          <button 
            onClick={onExportClick}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <select 
            value={statusFilter} 
            onChange={(e) => onStatusFilterChange(e.target.value)}
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
            onChange={(e) => onPriorityFilterChange(e.target.value)}
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
            onChange={(e) => onSearchChange(e.target.value)}
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
                onClick={() => onViewModeChange('grid')}
                className={`p-2 rounded transition ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
                title="Grid view"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
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
                onClick={onCreateClick}
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
                    onClick={() => onViewClick(project)}
                    className="flex-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 flex items-center justify-center gap-1"
                    title="View project details"
                  >
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">View</span>
                  </button>
                  <button 
                    onClick={() => onManageTasksClick(project)}
                    className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 flex items-center justify-center gap-1"
                    title="Manage project tasks"
                  >
                    <Calendar className="w-4 h-4" />
                    <span className="hidden sm:inline">Tasks</span>
                  </button>
                  <button 
                    onClick={() => onManageTeamClick(project)}
                    className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 transition hover:bg-violet-100 flex items-center justify-center gap-1"
                    title="Manage team members"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Team</span>
                  </button>
                  <button 
                    onClick={() => onDuplicateClick(project)}
                    className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700 transition hover:bg-amber-100 flex items-center justify-center"
                    title="Duplicate project"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => onDeleteClick(project.id)}
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
      </div>
    </div>
  );
}
