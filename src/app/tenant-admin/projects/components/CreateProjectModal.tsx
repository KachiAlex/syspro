'use client';

import React, { useState } from 'react';
import { X, Calendar, DollarSign, Users, Briefcase, AlertCircle } from 'lucide-react';

interface ProjectFormData {
  name: string;
  description: string;
  startDate: string;
  dueDate: string;
  budget: string;
  manager: string;
  teamMembers: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'planning' | 'in_progress' | 'on_hold';
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectFormData) => Promise<void>;
}

const DEFAULT_FORM_DATA: ProjectFormData = {
  name: '',
  description: '',
  startDate: '',
  dueDate: '',
  budget: '',
  manager: '',
  teamMembers: [],
  priority: 'medium',
  status: 'planning'
};

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState<ProjectFormData>(DEFAULT_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [teamMemberInput, setTeamMemberInput] = useState('');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    } else if (formData.startDate && formData.dueDate && new Date(formData.dueDate) <= new Date(formData.startDate)) {
      newErrors.dueDate = 'Due date must be after start date';
    }

    if (!formData.budget.trim()) {
      newErrors.budget = 'Budget is required';
    } else if (!/^\$?\d+(,\d{3})*(\.\d{2})?$/.test(formData.budget.replace(/,/g, ''))) {
      newErrors.budget = 'Invalid budget format';
    }

    if (!formData.manager.trim()) {
      newErrors.manager = 'Manager is required';
    }

    if (formData.teamMembers.length === 0) {
      newErrors.teamMembers = 'At least one team member is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      setFormData(DEFAULT_FORM_DATA);
      setTeamMemberInput('');
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to create project:', error);
      setErrors({ submit: 'Failed to create project. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const addTeamMember = () => {
    const member = teamMemberInput.trim();
    if (member && !formData.teamMembers.includes(member)) {
      setFormData(prev => ({
        ...prev,
        teamMembers: [...prev.teamMembers, member]
      }));
      setTeamMemberInput('');
      delete errors.teamMembers;
    }
  };

  const removeTeamMember = (member: string) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter(m => m !== member)
    }));
  };

  const handleTeamMemberKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTeamMember();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Create New Project</h2>
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
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700">{errors.submit}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter project name"
                disabled={loading}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Describe the project objectives and scope"
                disabled={loading}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.startDate ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Due Date *
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.dueDate ? 'border-red-500' : 'border-gray-300'
                }`}
                min={formData.startDate}
                disabled={loading}
              />
              {errors.dueDate && (
                <p className="mt-1 text-sm text-red-600">{errors.dueDate}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Budget *
              </label>
              <input
                type="text"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.budget ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="$50,000"
                disabled={loading}
              />
              {errors.budget && (
                <p className="mt-1 text-sm text-red-600">{errors.budget}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                <Briefcase className="w-4 h-4 inline mr-1" />
                Project Manager *
              </label>
              <input
                type="text"
                value={formData.manager}
                onChange={(e) => setFormData(prev => ({ ...prev, manager: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.manager ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Manager name"
                disabled={loading}
              />
              {errors.manager && (
                <p className="mt-1 text-sm text-red-600">{errors.manager}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  priority: e.target.value as 'low' | 'medium' | 'high' 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Initial Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  status: e.target.value as 'planning' | 'in_progress' | 'on_hold' 
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              >
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Team Members *
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={teamMemberInput}
                onChange={(e) => setTeamMemberInput(e.target.value)}
                onKeyPress={handleTeamMemberKeyPress}
                className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.teamMembers ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter team member name and press Enter"
                disabled={loading}
              />
              <button
                type="button"
                onClick={addTeamMember}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                disabled={loading || !teamMemberInput.trim()}
              >
                Add
              </button>
            </div>
            
            {formData.teamMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.teamMembers.map((member, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {member}
                    <button
                      type="button"
                      onClick={() => removeTeamMember(member)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                      disabled={loading}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            
            {errors.teamMembers && (
              <p className="mt-1 text-sm text-red-600">{errors.teamMembers}</p>
            )}
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
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
