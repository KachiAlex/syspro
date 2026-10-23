'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, Edit, Trash2, Search, ListChecks } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { ViewProjectModal, EditProjectModal, DeleteProjectModal } from '../components/ActiveProjectModals';
import { ProjectTasksModal } from '../components/ProjectTasksModal';
import { ProjectService, ProjectFormData } from '../services/projectService';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: number;
  startDate: string;
  dueDate: string;
  teamMembers: number;
  budget: string;
  manager: string;
  managerName?: string | null;
}

export default function ActiveProjectsPage() {
  const { tenantSlug } = useTenantContext();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Modal states for action buttons
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const statuses = ['All', 'Planning', 'In Progress', 'On Hold', 'Completed'];

  useEffect(() => {
    if (!tenantSlug) return;
    ProjectService.getProjects(tenantSlug).then((data) => {
      setProjects(data as unknown as Project[]);
    });
  }, [tenantSlug]);

  const handleCreateProject = async (projectData: ProjectFormData) => {
    if (!tenantSlug) {
      throw new Error('Tenant context not available');
    }

    try {
      const newProject = await ProjectService.createProject(tenantSlug, projectData);
      
      // Convert API response to local Project interface
      const localProject: Project = {
        id: newProject.id,
        name: newProject.name,
        description: newProject.description,
        status: newProject.status,
        progress: newProject.progress,
        startDate: newProject.startDate,
        dueDate: newProject.dueDate,
        teamMembers: newProject.teamMembers,
        budget: newProject.budget,
        manager: newProject.manager,
      };
      
      setProjects(prev => [localProject, ...prev]);
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  };

  const handleViewProject = (project: Project) => {
    setSelectedProject(project);
    setShowViewModal(true);
  };

  const handleEditProject = (project: Project) => {
    setSelectedProject(project);
    setShowEditModal(true);
  };

  const handleUpdateProject = async (updates: Partial<Project>) => {
    if (!tenantSlug || !selectedProject) return;

    try {
      // Convert Project type to ProjectFormData type
      const formDataUpdates: Partial<ProjectFormData> = {};
      
      if (updates.name !== undefined) formDataUpdates.name = updates.name;
      if (updates.description !== undefined) formDataUpdates.description = updates.description;
      if (updates.startDate !== undefined) formDataUpdates.startDate = updates.startDate;
      if (updates.dueDate !== undefined) formDataUpdates.dueDate = updates.dueDate;
      if (updates.budget !== undefined) formDataUpdates.budget = updates.budget;
      if (updates.manager !== undefined) formDataUpdates.manager = updates.manager;
      if (updates.teamMembers !== undefined) {
        formDataUpdates.teamMembers = updates.teamMembers.toString() ? [updates.teamMembers.toString()] : [];
      }

      const updatedProject = await ProjectService.updateProject(tenantSlug, selectedProject.id, formDataUpdates);
      
      // Update local state
      setProjects(prev => prev.map(p => 
        p.id === selectedProject.id 
          ? { ...p, ...updatedProject }
          : p
      ));
    } catch (error) {
      console.error('Failed to update project:', error);
      throw error;
    }
  };

  const handleDeleteProject = async () => {
    if (!tenantSlug || !selectedProject) return;

    try {
      await ProjectService.deleteProject(tenantSlug, selectedProject.id);
      
      // Update local state
      setProjects(prev => prev.filter(p => p.id !== selectedProject.id));
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  };

  const openDeleteModal = (project: Project) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
  };

  const openTasksModal = (project: Project) => {
    setSelectedProject(project);
    setShowTasksModal(true);
  };

  const filteredProjects = projects.filter((project) => {
    if (statusFilter !== 'All' && project.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const mgr = (project.managerName || project.manager || "").toLowerCase();
      if (!project.name.toLowerCase().includes(query) && !mgr.includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">Active Projects</h2>
        <Link
          href={`/tenant-admin/projects`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-theme-text-tertiary" />
              <input
                type="text"
                placeholder="Project name or manager..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => setShowCreateModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Project
            </button>
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-theme-muted border-b border-theme-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Project Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Manager</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Progress</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Due Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Team</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-primary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-theme-muted">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-theme-text-primary">{project.name}</p>
                      <p className="text-xs text-theme-text-secondary mt-1">{project.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{project.managerName || project.manager}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                      project.status === 'Planning' ? 'bg-amber-100 text-amber-800' :
                      project.status === 'On Hold' ? 'bg-red-100 text-red-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-theme-muted rounded-full h-2">
                        <div className="bg-theme-accent h-2 rounded-full" style={{ width: `${project.progress}%` }} />
                      </div>
                      <span className="text-xs text-theme-text-secondary">{project.progress}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{project.dueDate}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{project.teamMembers}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleViewProject(project)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditProject(project)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary transition-colors"
                        title="Edit Project"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openTasksModal(project)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors"
                        title="Manage Tasks & Assignments"
                      >
                        <ListChecks className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openDeleteModal(project)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-theme-danger transition-colors"
                        title="Delete Project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-theme-text-secondary">
                  No projects found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Budget Overview</h3>
          <div className="space-y-3">
            {filteredProjects.slice(0, 3).map((project) => (
              <div key={project.id} className="flex items-center justify-between">
                <span className="text-sm text-theme-text-secondary">{project.name}</span>
                <span className="text-sm font-semibold text-theme-text-primary">{project.budget}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-theme-border">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-theme-text-primary">Total Budget</span>
              <span className="text-lg font-bold text-theme-text-primary">${filteredProjects.reduce((sum, p) => sum + (parseFloat(String(p.budget || 0).replace(/[^0-9.\-]/g, '')) || 0), 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Timeline</h3>
          <div className="space-y-3">
            {filteredProjects.slice(0, 3).map((project) => (
              <div key={project.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-theme-text-secondary">{project.name}</span>
                  <span className="text-xs text-theme-text-secondary">{project.dueDate}</span>
                </div>
                <div className="w-full bg-theme-muted rounded-full h-2">
                  <div className="bg-green-600 h-2 rounded-full" style={{ width: `${project.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateProject}
      />

      {/* Action Modals */}
      <ViewProjectModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        project={selectedProject}
      />

      <EditProjectModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onConfirm={handleUpdateProject}
        project={selectedProject}
      />

      <DeleteProjectModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteProject}
        projectName={selectedProject?.name || ''}
      />

      {selectedProject && (
        <ProjectTasksModal
          isOpen={showTasksModal}
          onClose={() => setShowTasksModal(false)}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  );
}
