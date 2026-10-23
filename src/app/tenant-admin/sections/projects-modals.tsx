'use client';

import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface FormAlertProps {
  type: 'success' | 'error';
  message: string;
  onClose: () => void;
}

function FormAlert({ type, message, onClose }: FormAlertProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`p-4 rounded-lg flex items-center gap-3 ${
      type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
    }`}>
      <AlertCircle className="w-5 h-5" />
      <span>{message}</span>
    </div>
  );
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    objective: '',
    subsidiary: '',
    branch: '',
    departments: '',
    startDate: '',
    endDate: '',
    budgetApproved: '',
    owner: '',
    priority: 'Medium',
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.objective || !formData.startDate) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }
    setLoading(true);
    try {
      const projectData = {
        ...formData,
        budgetApproved: parseFloat(formData.budgetApproved) || 0,
        departments: formData.departments.split(',').map(d => d.trim()).filter(d => d),
      };
      await onSubmit(projectData);
      setAlert({ type: 'success', message: 'Project created successfully!' });
      setTimeout(() => {
        setFormData({
          name: '',
          description: '',
          objective: '',
          subsidiary: '',
          branch: '',
          departments: '',
          startDate: '',
          endDate: '',
          budgetApproved: '',
          owner: '',
          priority: 'Medium',
        });
        onClose();
      }, 1500);
    } catch (error) {
      setAlert({ type: 'error', message: 'Failed to create project' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-theme-surface border-b border-theme-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-theme-text-primary">Create New Project</h2>
          <button onClick={onClose} className="text-theme-text-secondary hover:text-theme-text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {alert && (
            <FormAlert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Project Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="Project name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Owner
              </label>
              <input
                type="text"
                name="owner"
                value={formData.owner}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="Project owner"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Objective <span className="text-red-600">*</span>
            </label>
            <textarea
              name="objective"
              value={formData.objective}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="Project objective"
              rows={2}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="Project description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Subsidiary
              </label>
              <input
                type="text"
                name="subsidiary"
                value={formData.subsidiary}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="Subsidiary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Branch
              </label>
              <input
                type="text"
                name="branch"
                value={formData.branch}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="Branch"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Departments
            </label>
            <input
              type="text"
              name="departments"
              value={formData.departments}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="Engineering, Marketing, Sales (comma separated)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Start Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                End Date
              </label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Budget Approved
              </label>
              <input
                type="number"
                name="budgetApproved"
                value={formData.budgetApproved}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                placeholder="0.00"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-theme-border">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover disabled:bg-theme-muted transition-colors"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ViewProjectModal({
  isOpen,
  onClose,
  project,
}: {
  isOpen: boolean;
  onClose: () => void;
  project?: any;
}) {
  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-2xl w-full mx-4">
        <div className="border-b border-theme-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-theme-text-primary">Project Details</h2>
          <button onClick={onClose} className="text-theme-text-secondary hover:text-theme-text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-text-secondary">Project Name</p>
              <p className="text-lg font-medium text-theme-text-primary">{project.name}</p>
            </div>
            <div>
              <p className="text-sm text-theme-text-secondary">Owner</p>
              <p className="text-lg font-medium text-theme-text-primary">{project.ownerName || project.owner}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-theme-text-secondary">Objective</p>
            <p className="text-lg font-medium text-theme-text-primary">{project.objective}</p>
          </div>

          {project.description && (
            <div>
              <p className="text-sm text-theme-text-secondary">Description</p>
              <p className="text-theme-text-primary">{project.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-text-secondary">Status</p>
              <p className="text-lg font-medium text-theme-text-primary capitalize">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                  project.status === 'Active' ? 'bg-blue-100 text-blue-800' :
                  project.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-theme-muted text-theme-text-primary'
                }`}>
                  {project.status}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-theme-text-secondary">Priority</p>
              <p className="text-lg font-medium text-theme-text-primary capitalize">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  project.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                  project.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                  project.priority === 'Medium' ? 'bg-blue-100 text-blue-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {project.priority}
                </span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-text-secondary">Start Date</p>
              <p className="text-lg font-medium text-theme-text-primary">{project.startDate}</p>
            </div>
            <div>
              <p className="text-sm text-theme-text-secondary">End Date</p>
              <p className="text-lg font-medium text-theme-text-primary">{project.endDate || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-theme-text-secondary">Budget Approved</p>
              <p className="text-lg font-medium text-theme-text-primary">${project.budgetApproved.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-theme-text-secondary">Budget Spent</p>
              <p className="text-lg font-medium text-theme-text-primary">${project.budgetSpent.toFixed(2)}</p>
            </div>
          </div>

          {project.departments && project.departments.length > 0 && (
            <div>
              <p className="text-sm text-theme-text-secondary">Departments</p>
              <p className="text-theme-text-primary">{project.departments.join(', ')}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-theme-border">
            <button className="flex-1 px-4 py-2 bg-theme-muted text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors">
              Edit Project
            </button>
            <button className="flex-1 px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors">
              Manage Tasks
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ManageTeamModal({
  isOpen,
  onClose,
  onSubmit,
  project,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  project?: any;
}) {
  const [formData, setFormData] = useState({
    teamMembers: '',
    roles: '',
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.teamMembers) {
      setAlert({ type: 'error', message: 'Please add at least one team member' });
      return;
    }
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      onSubmit(formData);
      setAlert({ type: 'success', message: 'Team assigned successfully!' });
      setTimeout(() => {
        setFormData({ teamMembers: '', roles: '' });
        onClose();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-lg w-full mx-4">
        <div className="border-b border-theme-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-theme-text-primary">Manage Team</h2>
            <p className="text-sm text-theme-text-secondary">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-theme-text-secondary hover:text-theme-text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {alert && (
            <FormAlert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Team Members (comma-separated)
            </label>
            <textarea
              name="teamMembers"
              value={formData.teamMembers}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="e.g., John Doe, Jane Smith, Mike Jones"
              rows={4}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Roles/Designations (comma-separated)
            </label>
            <textarea
              name="roles"
              value={formData.roles}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="e.g., Developer, Designer, QA"
              rows={4}
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-theme-border">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover disabled:bg-theme-muted transition-colors"
            >
              {loading ? 'Assigning...' : 'Assign Team'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ManageTasksModal({
  isOpen,
  onClose,
  onSubmit,
  project,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  project?: any;
}) {
  const [formData, setFormData] = useState({
    taskName: '',
    assignee: '',
    dueDate: '',
    priority: 'medium',
  });
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.taskName || !formData.dueDate) {
      setAlert({ type: 'error', message: 'Please fill in all required fields' });
      return;
    }
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      onSubmit(formData);
      setAlert({ type: 'success', message: 'Task created successfully!' });
      setTimeout(() => {
        setFormData({ taskName: '', assignee: '', dueDate: '', priority: 'medium' });
        onClose();
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-lg w-full mx-4">
        <div className="border-b border-theme-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-theme-text-primary">Add Task</h2>
            <p className="text-sm text-theme-text-secondary">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-theme-text-secondary hover:text-theme-text-primary">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {alert && (
            <FormAlert
              type={alert.type}
              message={alert.message}
              onClose={() => setAlert(null)}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Task Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="taskName"
              value={formData.taskName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="Task name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              Assignee
            </label>
            <input
              type="text"
              name="assignee"
              value={formData.assignee}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              placeholder="Team member name"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Due Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                name="dueDate"
                value={formData.dueDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Priority
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:ring-2 focus:ring-theme-accent focus:border-theme-accent text-theme-text-primary bg-theme-surface"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-theme-border">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover disabled:bg-theme-muted transition-colors"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
