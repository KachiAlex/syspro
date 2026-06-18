'use client';

import React, { useState } from 'react';
import { X, Calendar, Clock, Users, DollarSign, Briefcase, AlertTriangle, Edit } from 'lucide-react';

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
  priority?: string;
}

interface ViewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export const ViewProjectModal: React.FC<ViewProjectModalProps> = ({
  isOpen,
  onClose,
  project
}) => {
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Project Details</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.name}</h3>
            <p className="text-gray-600">{project.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Manager</p>
                  <p className="font-medium text-gray-900">{project.manager}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Team Size</p>
                  <p className="font-medium text-gray-900">{project.teamMembers} members</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Budget</p>
                  <p className="font-medium text-gray-900">{project.budget}</p>
                </div>
              </div>

              {project.priority && (
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Priority</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      project.priority === 'high' ? 'bg-red-100 text-red-800' :
                      project.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {project.priority}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Start Date</p>
                  <p className="font-medium text-gray-900">{project.startDate}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Due Date</p>
                  <p className="font-medium text-gray-900">{project.dueDate}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    project.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    project.status === 'Planning' ? 'bg-amber-100 text-amber-800' :
                    project.status === 'On Hold' ? 'bg-red-100 text-red-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-5 h-5 text-gray-400 flex items-center justify-center">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Progress</p>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${project.progress}%` }} />
                    </div>
                    <span className="font-medium text-gray-900">{project.progress}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (updates: Partial<Project>) => Promise<void>;
  project: Project | null;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  project
}) => {
  const [formData, setFormData] = useState<Partial<Project>>({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description,
        status: project.status,
        progress: project.progress,
        dueDate: project.dueDate,
        budget: project.budget,
        manager: project.manager,
      });
    }
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setLoading(true);
    try {
      await onConfirm(formData);
      onClose();
    } catch (error) {
      console.error('Failed to update project:', error);
      setErrors({ submit: 'Failed to update project. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Edit Project</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-white transition-colors"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="text-red-700">{errors.submit}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Status
              </label>
              <select
                value={formData.status || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Progress (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.progress || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, progress: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Budget
              </label>
              <input
                type="text"
                value={formData.budget || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Project Manager
              </label>
              <input
                type="text"
                value={formData.manager || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, manager: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeleteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  projectName: string;
}

export const DeleteProjectModal: React.FC<DeleteProjectModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  projectName
}) => {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Delete Project</h3>
          </div>

          <p className="text-gray-600 mb-6">
            Are you sure you want to permanently delete "{projectName}"? This action cannot be undone and all project data will be lost.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
