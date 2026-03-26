'use client';

import React, { useState } from 'react';
import { Plus, Eye, Edit, Trash2, Download, Filter, Briefcase, AlertCircle, TrendingUp, Users, Calendar, DollarSign } from 'lucide-react';
import { 
  CreateProjectModal, 
  ViewProjectModal, 
  ManageTeamModal,
  ManageTasksModal
} from './projects-modals';

interface Project {
  id: string;
  name: string;
  client: string;
  status: string;
  priority: string;
  startDate: string;
  endDate?: string;
  budget: number;
  manager: string;
  teamSize: number;
  description?: string;
}

export default function Projects({ tenantSlug }: { tenantSlug: string }) {
  const [projects, setProjects] = useState<Project[]>([
    {
      id: '1',
      name: 'Website Redesign',
      client: 'Tech Corp',
      status: 'active',
      priority: 'high',
      startDate: '2024-01-15',
      endDate: '2024-04-15',
      budget: 45000,
      manager: 'Sarah Johnson',
      teamSize: 5,
      description: 'Complete website redesign and optimization'
    },
    {
      id: '2',
      name: 'Mobile App Development',
      client: 'StartUp Inc',
      status: 'active',
      priority: 'medium',
      startDate: '2024-02-01',
      endDate: '2024-05-30',
      budget: 65000,
      manager: 'Mike Chen',
      teamSize: 8,
      description: 'Native iOS and Android app development'
    }
  ]);

  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showManageTeamModal, setShowManageTeamModal] = useState(false);
  const [showManageTasksModal, setShowManageTasksModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | undefined>();

  const filteredProjects = projects.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (priorityFilter && p.priority !== priorityFilter) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !p.client.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleCreateProject = (data: any) => {
    const newProject: Project = {
      id: Date.now().toString(),
      ...data,
      budget: parseFloat(data.budget),
      teamSize: 1,
    };
    setProjects([...projects, newProject]);
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

  const handleDeleteProject = (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  const handleExport = () => {
    const csv = [
      ['Name', 'Client', 'Status', 'Priority', 'Start Date', 'End Date', 'Budget', 'Manager', 'Team Size'],
      ...filteredProjects.map(p => [
        p.name, p.client, p.status, p.priority, p.startDate, p.endDate || '', p.budget, p.manager, p.teamSize
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalTeamMembers = projects.reduce((sum, p) => sum + p.teamSize, 0);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'on-hold': return 'bg-yellow-100 text-yellow-800';
      case 'planning': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Project Management</h2>
        <p className="text-gray-600">Create and manage projects, assign teams, and track progress</p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Projects</p>
              <p className="text-xl font-bold text-gray-900">{projects.length}</p>
            </div>
            <Briefcase className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Projects</p>
              <p className="text-xl font-bold text-gray-900">{activeProjects}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-xl font-bold text-gray-900">${(totalBudget / 1000).toFixed(0)}K</p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Team Members</p>
              <p className="text-xl font-bold text-gray-900">{totalTeamMembers}</p>
            </div>
            <Users className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2 inline" />
            Create Project
          </button>
          <button 
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2 inline" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="planning">Planning</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
          </select>

          <select 
            value={priorityFilter} 
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <input 
            type="text"
            placeholder="Search by name or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProjects.map(project => (
          <div key={project.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                <p className="text-sm text-gray-600">{project.client}</p>
              </div>
              <div className="flex gap-2">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(project.priority)}`}>
                  {project.priority}
                </span>
              </div>
            </div>

            {project.description && (
              <p className="text-sm text-gray-600 mb-4">{project.description}</p>
            )}

            <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
              <div>
                <p className="text-gray-600">Start Date</p>
                <p className="font-medium text-gray-900">{project.startDate}</p>
              </div>
              <div>
                <p className="text-gray-600">End Date</p>
                <p className="font-medium text-gray-900">{project.endDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600">Budget</p>
                <p className="font-medium text-gray-900">${project.budget.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-600">Manager</p>
                <p className="font-medium text-gray-900">{project.manager}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg">
              <Users className="w-4 h-4" />
              <span>{project.teamSize} team members</span>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => handleViewProject(project)}
                className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Eye className="w-4 h-4 mr-2 inline" />
                View
              </button>
              <button 
                onClick={() => handleManageTasks(project)}
                className="flex-1 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
              >
                <Calendar className="w-4 h-4 mr-2 inline" />
                Tasks
              </button>
              <button 
                onClick={() => handleManageTeam(project)}
                className="flex-1 px-3 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors text-sm font-medium"
              >
                <Users className="w-4 h-4 mr-2 inline" />
                Team
              </button>
              <button 
                onClick={() => handleDeleteProject(project.id)}
                className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No projects found</p>
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
