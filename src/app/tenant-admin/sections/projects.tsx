'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Trash2, Download, Filter, Briefcase, AlertCircle, TrendingUp, Users, Calendar, DollarSign } from 'lucide-react';
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

  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showManageTeamModal, setShowManageTeamModal] = useState(false);
  const [showManageTasksModal, setShowManageTasksModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | undefined>();

  // Fetch projects from API
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get('/api/projects');
        setProjects(response.data?.projects || []);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

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
      alert('Project created successfully!');
    } catch (err) {
      console.error('Failed to create project:', err);
      alert('Failed to create project');
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
        alert('Project deleted successfully!');
      } catch (err) {
        console.error('Failed to delete project:', err);
        alert('Failed to delete project');
      }
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
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'on hold': return 'bg-yellow-100 text-yellow-800';
      case 'planned': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority.toLowerCase()) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <span className="text-gray-600">Loading projects...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Projects</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-full">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Project Management</h2>
        <p className="text-gray-600">Create and manage projects, assign teams, and track progress</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-xl font-bold text-gray-900">{projects.length}</p>
            </div>
            <Briefcase className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Projects</p>
              <p className="text-xl font-bold text-gray-900">{activeProjects}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-xl font-bold text-gray-900">${(totalBudget / 1000).toFixed(0)}K</p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Budget Spent</p>
              <p className="text-xl font-bold text-gray-900">${(totalSpent / 1000).toFixed(0)}K</p>
            </div>
            <Users className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm mb-6">
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </button>
          <button 
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredProjects.map(project => (
          <div key={project.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{project.name}</h3>
                <p className="text-sm text-gray-600">{project.objective}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.priority)}`}>
                  {project.priority}
                </span>
              </div>
            </div>

            {project.description && (
              <p className="text-sm text-gray-600 mb-4 line-clamp-2">{project.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div>
                <p className="text-gray-600 text-xs mb-1">Start Date</p>
                <p className="font-medium text-gray-900">{project.startDate}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">End Date</p>
                <p className="font-medium text-gray-900">{project.endDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">Budget</p>
                <p className="font-medium text-gray-900">${project.budgetApproved.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600 text-xs mb-1">Owner</p>
                <p className="font-medium text-gray-900">{project.owner}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
              <DollarSign className="w-4 h-4" />
              <span>${project.budgetSpent.toFixed(2)} spent of ${project.budgetApproved.toFixed(2)}</span>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => handleViewProject(project)}
                className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium flex items-center justify-center"
              >
                <Eye className="w-4 h-4 mr-1" />
                View
              </button>
              <button 
                onClick={() => handleManageTasks(project)}
                className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium flex items-center justify-center"
              >
                <Calendar className="w-4 h-4 mr-1" />
                Tasks
              </button>
              <button 
                onClick={() => handleManageTeam(project)}
                className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium flex items-center justify-center"
              >
                <Users className="w-4 h-4 mr-1" />
                Team
              </button>
              <button 
                onClick={() => handleDeleteProject(project.id)}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex items-center justify-center"
                title="Delete Project"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || statusFilter || priorityFilter 
              ? "Try adjusting your filters or search criteria" 
              : "Get started by creating your first project"}
          </p>
          {!searchQuery && !statusFilter && !priorityFilter && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Project
            </button>
          )}
        </div>
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
