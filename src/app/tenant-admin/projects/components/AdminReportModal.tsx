'use client';

import React, { useState } from 'react';
import { X, FileText, BarChart3, Users, Calendar, Send, AlertCircle, TrendingUp } from 'lucide-react';

interface AdminReportData {
  reportTitle: string;
  reportType: 'summary' | 'performance' | 'financial' | 'risk';
  projectIds: string[];
  dateRange: { start: string; end: string };
  metrics: ReportMetric[];
  recipients: string[];
  submittedBy: string;
}

interface ReportMetric {
  name: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  description?: string;
}

interface AdminReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AdminReportData) => Promise<void>;
  projects: Array<{ id: string; name: string }>;
  availableRecipients: Array<{ id: string; name: string; role: string }>;
  currentUser: string;
}

const DEFAULT_FORM_DATA: Omit<AdminReportData, 'submittedBy'> = {
  reportTitle: '',
  reportType: 'summary',
  projectIds: [],
  dateRange: { start: '', end: '' },
  metrics: [],
  recipients: [],
};

export const AdminReportModal: React.FC<AdminReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  projects,
  availableRecipients,
  currentUser
}) => {
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newMetric, setNewMetric] = useState<{ name: string; value: string; trend: 'up' | 'down' | 'stable'; description: string }>({ name: '', value: '', trend: 'stable', description: '' });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.reportTitle.trim()) {
      newErrors.reportTitle = 'Report title is required';
    }

    if (formData.projectIds.length === 0) {
      newErrors.projectIds = 'At least one project must be selected';
    }

    if (!formData.dateRange.start) {
      newErrors.dateRange = 'Start date is required';
    }

    if (!formData.dateRange.end) {
      newErrors.dateRange = 'End date is required';
    } else if (formData.dateRange.start && new Date(formData.dateRange.end) < new Date(formData.dateRange.start)) {
      newErrors.dateRange = 'End date must be after start date';
    }

    if (formData.metrics.length === 0) {
      newErrors.metrics = 'At least one metric is required';
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
      const reportData: AdminReportData = {
        ...formData,
        submittedBy: currentUser,
      };

      await onSubmit(reportData);
      setFormData(DEFAULT_FORM_DATA);
      setNewMetric({ name: '', value: '', trend: 'stable', description: '' });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to create report:', error);
      setErrors({ submit: 'Failed to create report. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const toggleProjectSelection = (projectId: string) => {
    setFormData(prev => ({
      ...prev,
      projectIds: prev.projectIds.includes(projectId)
        ? prev.projectIds.filter(id => id !== projectId)
        : [...prev.projectIds, projectId]
    }));
  };

  const toggleRecipientSelection = (recipientId: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.includes(recipientId)
        ? prev.recipients.filter(id => id !== recipientId)
        : [...prev.recipients, recipientId]
    }));
  };

  const addMetric = () => {
    if (newMetric.name.trim() && newMetric.value.trim()) {
      setFormData(prev => ({
        ...prev,
        metrics: [...prev.metrics, { ...newMetric }]
      }));
      setNewMetric({ name: '', value: '', trend: 'stable', description: '' });
    }
  };

  const removeMetric = (index: number) => {
    setFormData(prev => ({
      ...prev,
      metrics: prev.metrics.filter((_, i) => i !== index)
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-theme-surface border-b border-theme-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-theme-text-primary">Create Project Report</h2>
          <button 
            onClick={onClose} 
            className="text-theme-text-secondary hover:text-theme-text-primary transition-colors"
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
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                <FileText className="w-4 h-4 inline mr-1" />
                Report Title *
              </label>
              <input
                type="text"
                value={formData.reportTitle}
                onChange={(e) => setFormData(prev => ({ ...prev, reportTitle: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary ${
                  errors.reportTitle ? 'border-red-500' : 'border-theme-border'
                }`}
                placeholder="Enter report title"
                disabled={loading}
              />
              {errors.reportTitle && (
                <p className="mt-1 text-sm text-red-600">{errors.reportTitle}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                Report Type
              </label>
              <select
                value={formData.reportType}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  reportType: e.target.value as 'summary' | 'performance' | 'financial' | 'risk'
                }))}
                className="w-full px-3 py-2 border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary bg-theme-surface"
                disabled={loading}
              >
                <option value="summary">Summary Report</option>
                <option value="performance">Performance Report</option>
                <option value="financial">Financial Report</option>
                <option value="risk">Risk Assessment Report</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Range *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={formData.dateRange.start}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    dateRange: { ...prev.dateRange, start: e.target.value }
                  }))}
                  className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary ${
                    errors.dateRange ? 'border-red-500' : 'border-theme-border'
                  }`}
                  disabled={loading}
                />
                <input
                  type="date"
                  value={formData.dateRange.end}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    dateRange: { ...prev.dateRange, end: e.target.value }
                  }))}
                  className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary ${
                    errors.dateRange ? 'border-red-500' : 'border-theme-border'
                  }`}
                  min={formData.dateRange.start}
                  disabled={loading}
                />
              </div>
              {errors.dateRange && (
                <p className="mt-1 text-sm text-red-600">{errors.dateRange}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              <BarChart3 className="w-4 h-4 inline mr-1" />
              Select Projects *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto border border-theme-border rounded-lg p-3">
              {projects.map((project) => (
                <label key={project.id} className="flex items-center gap-2 cursor-pointer hover:bg-theme-muted p-1 rounded">
                  <input
                    type="checkbox"
                    checked={formData.projectIds.includes(project.id)}
                    onChange={() => toggleProjectSelection(project.id)}
                    className="rounded border-theme-border text-theme-accent focus:ring-theme-accent"
                    disabled={loading}
                  />
                  <span className="text-sm text-theme-text-primary">{project.name}</span>
                </label>
              ))}
            </div>
            {errors.projectIds && (
              <p className="mt-1 text-sm text-red-600">{errors.projectIds}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Key Metrics *
            </label>
            <div className="space-y-3">
              {formData.metrics.map((metric, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-theme-muted rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-theme-text-primary">{metric.name}</div>
                    <div className="text-sm text-theme-text-secondary">{metric.value}</div>
                    {metric.description && (
                      <div className="text-xs text-theme-text-secondary mt-1">{metric.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {metric.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600" />}
                    {metric.trend === 'down' && <TrendingUp className="w-4 h-4 text-red-600 rotate-180" />}
                    {metric.trend === 'stable' && <div className="w-4 h-4 bg-theme-muted rounded-full" />}
                    <button
                      type="button"
                      onClick={() => removeMetric(index)}
                      className="text-red-600 hover:text-red-800"
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border border-theme-border rounded-lg">
                <input
                  type="text"
                  placeholder="Metric name"
                  value={newMetric.name}
                  onChange={(e) => setNewMetric(prev => ({ ...prev, name: e.target.value }))}
                  className="px-2 py-1 border border-theme-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary"
                  disabled={loading}
                />
                <input
                  type="text"
                  placeholder="Value"
                  value={newMetric.value}
                  onChange={(e) => setNewMetric(prev => ({ ...prev, value: e.target.value }))}
                  className="px-2 py-1 border border-theme-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary"
                  disabled={loading}
                />
                <select
                  value={newMetric.trend}
                  onChange={(e) => setNewMetric(prev => ({ 
                    ...prev, 
                    trend: e.target.value as 'up' | 'down' | 'stable'
                  }))}
                  className="px-2 py-1 border border-theme-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary"
                  disabled={loading}
                >
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="stable">Stable</option>
                </select>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newMetric.description}
                  onChange={(e) => setNewMetric(prev => ({ ...prev, description: e.target.value }))}
                  className="px-2 py-1 border border-theme-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent text-theme-text-primary"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={addMetric}
                  className="px-3 py-1 bg-theme-accent text-theme-text-primary rounded text-sm hover:bg-theme-accent-hover disabled:opacity-50"
                  disabled={loading || !newMetric.name.trim() || !newMetric.value.trim()}
                >
                  Add
                </button>
              </div>
            </div>
            {errors.metrics && (
              <p className="mt-1 text-sm text-red-600">{errors.metrics}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">
              <Send className="w-4 h-4 inline mr-1" />
              Send To (Superiors/Management)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-theme-border rounded-lg p-3">
              {availableRecipients.map((recipient) => (
                <label key={recipient.id} className="flex items-center gap-2 cursor-pointer hover:bg-theme-muted p-1 rounded">
                  <input
                    type="checkbox"
                    checked={formData.recipients.includes(recipient.id)}
                    onChange={() => toggleRecipientSelection(recipient.id)}
                    className="rounded border-theme-border text-theme-accent focus:ring-theme-accent"
                    disabled={loading}
                  />
                  <div>
                    <div className="text-sm text-theme-text-primary">{recipient.name}</div>
                    <div className="text-xs text-theme-text-secondary">{recipient.role}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-theme-muted rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-theme-text-secondary">
              <Users className="w-4 h-4" />
              <span>Created by: <strong>{currentUser}</strong></span>
            </div>
            <div className="flex items-center gap-2 text-sm text-theme-text-secondary mt-1">
              <Calendar className="w-4 h-4" />
              <span>Date: {new Date().toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-theme-accent text-theme-text-primary rounded-lg hover:bg-theme-accent-hover transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
