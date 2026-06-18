'use client';

import React, { useState } from 'react';
import { X, FileText, AlertCircle, TrendingUp, Users, Calendar, CheckCircle, Clock } from 'lucide-react';

interface StaffReportData {
  projectId: string;
  reportType: 'daily' | 'weekly' | 'milestone' | 'issue';
  content: string;
  progress: number;
  blockers: string[];
  nextSteps: string;
  submittedBy: string;
  submittedAt: string;
}

interface StaffReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: StaffReportData) => Promise<void>;
  projects: Array<{ id: string; name: string }>;
  currentUser: string;
}

const DEFAULT_FORM_DATA: Omit<StaffReportData, 'submittedBy' | 'submittedAt'> = {
  projectId: '',
  reportType: 'daily',
  content: '',
  progress: 0,
  blockers: [],
  nextSteps: '',
};

export const StaffReportModal: React.FC<StaffReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projects,
  currentUser
}) => {
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [blockerInput, setBlockerInput] = useState('');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.projectId) {
      newErrors.projectId = 'Project selection is required';
    }

    if (!formData.content.trim()) {
      newErrors.content = 'Report content is required';
    }

    if (formData.progress < 0 || formData.progress > 100) {
      newErrors.progress = 'Progress must be between 0 and 100';
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
      const reportData: StaffReportData = {
        ...formData,
        submittedBy: currentUser,
        submittedAt: new Date().toISOString(),
      };

      await onSubmit(reportData);
      setFormData(DEFAULT_FORM_DATA);
      setBlockerInput('');
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to submit report:', error);
      setErrors({ submit: 'Failed to submit report. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const addBlocker = () => {
    const blocker = blockerInput.trim();
    if (blocker && !formData.blockers.includes(blocker)) {
      setFormData(prev => ({
        ...prev,
        blockers: [...prev.blockers, blocker]
      }));
      setBlockerInput('');
    }
  };

  const removeBlocker = (blocker: string) => {
    setFormData(prev => ({
      ...prev,
      blockers: prev.blockers.filter(b => b !== blocker)
    }));
  };

  const handleBlockerKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addBlocker();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Submit Project Report</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-700 transition-colors"
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
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Project *
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                  errors.projectId ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              {errors.projectId && (
                <p className="mt-1 text-sm text-red-600">{errors.projectId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Report Type
              </label>
              <select
                value={formData.reportType}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  reportType: e.target.value as 'daily' | 'weekly' | 'milestone' | 'issue'
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={loading}
              >
                <option value="daily">Daily Report</option>
                <option value="weekly">Weekly Report</option>
                <option value="milestone">Milestone Report</option>
                <option value="issue">Issue Report</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Report Content *
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black ${
                errors.content ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Describe your work, achievements, and any important updates..."
              disabled={loading}
            />
            {errors.content && (
              <p className="mt-1 text-sm text-red-600">{errors.content}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Progress (%)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={formData.progress}
                onChange={(e) => setFormData(prev => ({ ...prev, progress: parseInt(e.target.value) }))}
                className="flex-1"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-900 w-12 text-right">{formData.progress}%</span>
            </div>
            {errors.progress && (
              <p className="mt-1 text-sm text-red-600">{errors.progress}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Blockers/Issues
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={blockerInput}
                onChange={(e) => setBlockerInput(e.target.value)}
                onKeyPress={handleBlockerKeyPress}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                placeholder="Enter blocker/issue and press Enter"
                disabled={loading}
              />
              <button
                type="button"
                onClick={addBlocker}
                className="px-4 py-2 bg-amber-600 text-gray-900 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                disabled={loading || !blockerInput.trim()}
              >
                Add
              </button>
            </div>
            
            {formData.blockers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.blockers.map((blocker, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm"
                  >
                    {blocker}
                    <button
                      type="button"
                      onClick={() => removeBlocker(blocker)}
                      className="ml-1 text-amber-600 hover:text-amber-800"
                      disabled={loading}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <CheckCircle className="w-4 h-4 inline mr-1" />
              Next Steps
            </label>
            <textarea
              value={formData.nextSteps}
              onChange={(e) => setFormData(prev => ({ ...prev, nextSteps: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black bg-white"
              placeholder="What are your next steps or planned activities?"
              disabled={loading}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="w-4 h-4" />
              <span>Submitted by: <strong>{currentUser}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
              <Calendar className="w-4 h-4" />
              <span>Date: {new Date().toLocaleDateString()}</span>
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
              className="flex-1 px-4 py-2 bg-blue-600 text-black rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
