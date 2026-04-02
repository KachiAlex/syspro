'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, Download, Filter, Briefcase, AlertCircle, TrendingUp, Users, Calendar, DollarSign, Grid3x3, List, Copy, RefreshCw, BarChart3, CheckSquare, Zap, Archive, RotateCcw } from 'lucide-react';
import { 
  CreateProjectModal, 
  ViewProjectModal, 
  ManageTeamModal,
  ManageTasksModal
} from './projects-modals';
import { apiClient } from '@/lib/api-client';
import ProjectsOverview from './projects-overview';
import ProjectsTasks from './projects-tasks';
import ProjectsTeam from './projects-team';
import ProjectsBudget from './projects-budget';
import ProjectsTimeline from './projects-timeline';
import ProjectsReports from './projects-reports';
import ProjectsActive from './projects-active';
import ProjectsArchive from './projects-archive';
import ProjectsAdvancedReports from './projects-advanced-reports';

type ProjectTab = 'overview' | 'tasks' | 'team' | 'budget' | 'timeline' | 'reports' | 'active' | 'archive' | 'advanced-reports';

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
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
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

  const tabs: Array<{ id: ProjectTab; label: string; icon: React.ReactNode }> = [
    { id: 'overview', label: 'Overview', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'active', label: 'Active Projects', icon: <Zap className="w-4 h-4" /> },
    { id: 'archive', label: 'Archive', icon: <Archive className="w-4 h-4" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-4 h-4" /> },
    { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" /> },
    { id: 'budget', label: 'Budget', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'timeline', label: 'Timeline', icon: <Calendar className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'advanced-reports', label: 'Advanced Reports', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <ProjectsOverview
            projects={projects}
            loading={loading}
            error={error}
            lastRefreshed={lastRefreshed}
            statusFilter={statusFilter}
            priorityFilter={priorityFilter}
            searchQuery={searchQuery}
            viewMode={viewMode}
            onStatusFilterChange={setStatusFilter}
            onPriorityFilterChange={setPriorityFilter}
            onSearchChange={setSearchQuery}
            onViewModeChange={setViewMode}
            onCreateClick={() => setShowCreateModal(true)}
            onViewClick={handleViewProject}
            onManageTeamClick={handleManageTeam}
            onManageTasksClick={handleManageTasks}
            onDeleteClick={handleDeleteProject}
            onDuplicateClick={handleDuplicateProject}
            onExportClick={handleExport}
            onRefreshClick={fetchProjects}
            tenantSlug={tenantSlug}
          />
        );
      case 'active':
        return <ProjectsActive projects={projects} tenantSlug={tenantSlug} onRefresh={fetchProjects} />;
      case 'archive':
        return <ProjectsArchive tenantSlug={tenantSlug} onRefresh={fetchProjects} />;
      case 'tasks':
        return <ProjectsTasks projects={projects} tenantSlug={tenantSlug} />;
      case 'team':
        return <ProjectsTeam projects={projects} tenantSlug={tenantSlug} />;
      case 'budget':
        return <ProjectsBudget projects={projects} tenantSlug={tenantSlug} />;
      case 'timeline':
        return <ProjectsTimeline projects={projects} tenantSlug={tenantSlug} />;
      case 'reports':
        return <ProjectsReports projects={projects} tenantSlug={tenantSlug} />;
      case 'advanced-reports':
        return <ProjectsAdvancedReports projects={projects} tenantSlug={tenantSlug} />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
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

      {/* Sub-Tab Navigation */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex overflow-x-auto border-b border-gray-200">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>


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
