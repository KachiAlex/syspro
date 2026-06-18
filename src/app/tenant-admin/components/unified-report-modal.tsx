'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Download, Filter, FileText, BarChart3, Settings, Clock, Users, DollarSign, TrendingUp, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { ReportService, Report, ReportTemplate, ReportGenerationParams } from '../services/report-service';

interface UnifiedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: 'financial' | 'sales' | 'hr';
  tenantSlug: string;
  onReportGenerated?: (report: Report) => void;
}

export const UnifiedReportModal: React.FC<UnifiedReportModalProps> = ({
  isOpen,
  onClose,
  module,
  tenantSlug,
  onReportGenerated
}) => {
  const [activeTab, setActiveTab] = useState<'generate' | 'templates' | 'scheduled'>('generate');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [formData, setFormData] = useState({
    reportType: '',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    format: 'pdf' as 'pdf' | 'excel' | 'csv',
    includeCharts: true,
    filters: {} as Record<string, any>
  });

  // Load templates and reports on mount
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      loadReports();
    }
  }, [isOpen, module]);

  const loadTemplates = async () => {
    try {
      const templates = await ReportService.getReportTemplates(module);
      setTemplates(templates);
      if (templates.length > 0 && !formData.reportType) {
        setFormData(prev => ({ ...prev, reportType: templates[0].type }));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadReports = async () => {
    try {
      const reports = await ReportService.getReports(tenantSlug, module);
      setReports(reports);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.reportType) {
      newErrors.reportType = 'Please select a report type';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    } else if (formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      newErrors.endDate = 'End date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const params: ReportGenerationParams = {
        module,
        reportType: formData.reportType,
        dateRange: {
          start: formData.startDate,
          end: formData.endDate
        },
        format: formData.format,
        includeCharts: formData.includeCharts,
        filters: formData.filters,
        tenantSlug
      };

      const report = await ReportService.generateReport(params);
      setReports(prev => [report, ...prev]);
      
      if (onReportGenerated) {
        onReportGenerated(report);
      }

      // Reset form
      setFormData({
        reportType: templates[0]?.type || '',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        format: 'pdf',
        includeCharts: true,
        filters: {}
      });

      onClose();
    } catch (error) {
      console.error('Failed to generate report:', error);
      setErrors({ submit: 'Failed to generate report. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (reportId: string) => {
    try {
      const fileUrl = await ReportService.downloadReport(reportId, tenantSlug);
      window.open(fileUrl, '_blank');
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await ReportService.deleteReport(reportId, tenantSlug);
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      console.error('Failed to delete report:', error);
    }
  };

  const getModuleIcon = () => {
    switch (module) {
      case 'financial': return DollarSign;
      case 'sales': return TrendingUp;
      case 'hr': return Users;
      default: return FileText;
    }
  };

  const getModuleColor = () => {
    switch (module) {
      case 'financial': return 'text-green-600 bg-green-50 border-green-200';
      case 'sales': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'hr': return 'text-purple-600 bg-purple-50 border-purple-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!isOpen) return null;

  const ModuleIcon = getModuleIcon();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${getModuleColor()}`}>
                <ModuleIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {module.charAt(0).toUpperCase() + module.slice(1)} Reports
                </h2>
                <p className="text-gray-600">Generate and manage reports</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('generate')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'generate'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-1" />
              Generate
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-1" />
              Templates
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'scheduled'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-white'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-1" />
              Scheduled
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700">{errors.submit}</span>
              </div>
            </div>
          )}

          {/* Generate Tab */}
          {activeTab === 'generate' && (
            <div className="space-y-6">
              <form onSubmit={handleGenerateReport} className="space-y-6">
                {/* Report Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    <FileText className="w-4 h-4 inline mr-1" />
                    Report Type
                  </label>
                  <select
                    value={formData.reportType}
                    onChange={(e) => setFormData(prev => ({ ...prev, reportType: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.reportType ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={loading}
                  >
                    <option value="">Select a report type</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.type}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {errors.reportType && (
                    <p className="mt-1 text-sm text-red-600">{errors.reportType}</p>
                  )}
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.endDate ? 'border-red-500' : 'border-gray-300'
                      }`}
                      min={formData.startDate}
                      disabled={loading}
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
                    )}
                  </div>
                </div>

                {/* Format and Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Format
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {['pdf', 'excel', 'csv'].map((format) => (
                        <label key={format} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="format"
                            value={format}
                            checked={formData.format === format}
                            onChange={(e) => setFormData(prev => ({ ...prev, format: format as any }))}
                            className="text-blue-600 focus:ring-blue-500"
                            disabled={loading}
                          />
                          <span className="text-sm font-medium text-gray-900 capitalize">{format}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Options
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.includeCharts}
                        onChange={(e) => setFormData(prev => ({ ...prev, includeCharts: e.target.checked }))}
                        className="text-blue-600 focus:ring-blue-500 rounded"
                        disabled={loading}
                      />
                      <span className="text-sm font-medium text-gray-900">Include charts and graphs</span>
                    </label>
                  </div>
                </div>

                {/* Dynamic Filters */}
                {formData.reportType && (
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      <Filter className="w-4 h-4 inline mr-1" />
                      Filters
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {templates
                        .find(t => t.type === formData.reportType)
                        ?.filters.map((filter) => (
                          <div key={filter.key}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {filter.label}
                              {filter.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {filter.type === 'select' ? (
                              <select
                                value={formData.filters[filter.key] || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  filters: { ...prev.filters, [filter.key]: e.target.value }
                                }))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={loading}
                              >
                                <option value="">Select...</option>
                                {filter.options?.map((option) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={filter.type}
                                placeholder={filter.label}
                                value={formData.filters[filter.key] || ''}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  filters: { ...prev.filters, [filter.key]: e.target.value }
                                }))}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={loading}
                              />
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Submit Buttons */}
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <BarChart3 className="w-4 h-4" />
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Recent Reports */}
              {reports.length > 0 && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reports</h3>
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Report</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Date Range</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Generated</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reports.slice(0, 5).map((report) => (
                          <tr key={report.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{report.title}</p>
                                <p className="text-xs text-gray-600">by {report.generatedBy}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                                {report.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {report.dateRange.start} to {report.dateRange.end}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(report.generatedAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                report.status === 'ready' ? 'bg-green-100 text-green-800' :
                                report.status === 'generating' ? 'bg-amber-100 text-amber-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {report.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {report.status === 'ready' && (
                                  <button
                                    onClick={() => handleDownloadReport(report.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteReport(report.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{template.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getModuleColor()}`}>
                        {template.type}
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Format:</span>
                        <span className="font-medium text-gray-900 capitalize">{template.defaultFormat}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Filters:</span>
                        <span className="font-medium text-gray-900">{template.filters.length}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFormData(prev => ({ ...prev, reportType: template.type }));
                        setActiveTab('generate');
                      }}
                      className="mt-3 w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Use Template
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled Tab */}
          {activeTab === 'scheduled' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Scheduled Reports</h3>
                <p className="text-gray-600 mb-4">
                  Set up automated report generation and delivery
                </p>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  Create Schedule
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
