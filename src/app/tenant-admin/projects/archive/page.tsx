'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, Eye, Trash2, Search } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { ViewProjectModal, RestoreProjectModal, DeleteProjectModal } from '../components/ArchiveModals';
import { ProjectService } from '../services/projectService';

interface ArchivedProject {
  id: string;
  name: string;
  description: string;
  completionDate: string;
  duration: string;
  teamMembers: number;
  budget: string;
  manager: string;
  managerName?: string | null;
  finalStatus: string;
}

export default function ProjectArchivePage() {
  const { tenantSlug } = useTenantContext();
  const [projects, setProjects] = useState<ArchivedProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  
  // Modal states
  const [showViewModal, setShowViewModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ArchivedProject | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    ProjectService.getArchivedProjects(tenantSlug)
      .then((data) => {
        setProjects(data as unknown as ArchivedProject[]);
      })
      .catch((err) => {
        console.error('Failed to load archived projects:', err);
      });
  }, [tenantSlug]);

  const filteredProjects = projects.filter((project) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const mgr = (project.managerName || project.manager || "").toLowerCase();
      if (!project.name.toLowerCase().includes(query) && !mgr.includes(query)) return false;
    }
    return true;
  });

  const handleViewProject = (project: ArchivedProject) => {
    setSelectedProject(project);
    setShowViewModal(true);
  };

  const handleRestoreProject = async (project: ArchivedProject) => {
    if (!tenantSlug) return;
    
    try {
      await ProjectService.restoreProject(tenantSlug, project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
    } catch (error) {
      console.error('Failed to restore project:', error);
      throw error;
    }
  };

  const handleDeleteProject = async (project: ArchivedProject) => {
    if (!tenantSlug) return;
    
    try {
      await ProjectService.deleteProject(tenantSlug, project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  };

  const handleBulkRestore = async () => {
    if (!tenantSlug || selectedProjects.size === 0) return;
    
    try {
      const projectIds = Array.from(selectedProjects);
      await ProjectService.bulkRestoreProjects(tenantSlug, projectIds);
      setProjects(prev => prev.filter(p => !selectedProjects.has(p.id)));
      setSelectedProjects(new Set());
    } catch (error) {
      console.error('Failed to bulk restore projects:', error);
      throw error;
    }
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const openRestoreModal = (project: ArchivedProject) => {
    setSelectedProject(project);
    setShowRestoreModal(true);
  };

  const openDeleteModal = (project: ArchivedProject) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
  };

  const openBulkRestoreModal = () => {
    setSelectedProject(null);
    setShowRestoreModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">Project Archive</h2>
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
          <div className="flex items-end">
            <div className="text-sm text-theme-text-secondary">
              {selectedProjects.size > 0 && (
                <span className="font-medium text-theme-accent">
                  {selectedProjects.size} project{selectedProjects.size > 1 ? 's' : ''} selected
                </span>
              )}
            </div>
          </div>
          <div className="flex items-end">
            {selectedProjects.size > 0 && (
              <button
                onClick={openBulkRestoreModal}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Restore Selected ({selectedProjects.size})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-theme-muted border-b border-theme-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">
                <input
                  type="checkbox"
                  checked={selectedProjects.size === filteredProjects.length && filteredProjects.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedProjects(new Set(filteredProjects.map(p => p.id)));
                    } else {
                      setSelectedProjects(new Set());
                    }
                  }}
                  className="rounded border-theme-border text-theme-accent focus:ring-theme-accent"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Project Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Manager</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Completed</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Budget</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Team</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-primary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-theme-muted">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => toggleProjectSelection(project.id)}
                      className="rounded border-theme-border text-theme-accent focus:ring-theme-accent"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-theme-text-primary">{project.name}</p>
                      <p className="text-xs text-theme-text-secondary mt-1">{project.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{project.managerName || project.manager}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{project.completionDate}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{project.duration}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-theme-text-primary">{project.budget}</td>
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
                        onClick={() => openRestoreModal(project)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:text-green-700 transition-colors"
                        title="Restore Project"
                      >
                        <RotateCcw className="w-4 h-4" />
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
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-theme-text-secondary">
                  No archived projects found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Archive Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Total Archived</span>
              <span className="font-semibold text-theme-text-primary">{projects.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Total Budget Spent</span>
              <span className="font-semibold text-theme-text-primary">${projects.reduce((sum, p) => sum + (parseFloat(String(p.budget || 0).replace(/[^0-9.\-]/g, '')) || 0), 0).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Avg Team Size</span>
              <span className="font-semibold text-theme-text-primary">{projects.length > 0 ? Math.round(projects.reduce((sum, p) => sum + (p.teamMembers || 0), 0) / projects.length) : 0} members</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Success Rate</span>
              <span className="font-semibold text-green-600">{projects.length > 0 ? Math.round((projects.filter(p => p.finalStatus === 'Completed' || p.finalStatus === 'Archived').length / projects.length) * 100) : 0}%</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Recent Completions</h3>
          <div className="space-y-3">
            {filteredProjects.slice(0, 3).map((project) => (
              <div key={project.id} className="flex items-center justify-between p-3 border border-theme-border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-theme-text-primary">{project.name}</p>
                  <p className="text-xs text-theme-text-secondary">{project.completionDate}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Completed
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ViewProjectModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        project={selectedProject}
      />

      <RestoreProjectModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        onConfirm={selectedProject 
          ? () => handleRestoreProject(selectedProject)
          : handleBulkRestore
        }
        projectName={selectedProject?.name || ''}
        isBulk={!selectedProject}
        projectCount={selectedProjects.size}
      />

      <DeleteProjectModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          if (selectedProject) {
            await handleDeleteProject(selectedProject);
          }
        }}
        projectName={selectedProject?.name || ''}
      />
    </div>
  );
}
