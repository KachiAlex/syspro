'use client';

import React, { useState } from 'react';
import { X, FileText, TrendingUp, Users, Calendar, Download, BarChart3, AlertCircle } from 'lucide-react';

interface HRReport {
  id: string;
  title: string;
  type: 'workforce' | 'payroll' | 'attendance' | 'performance' | 'compliance';
  dateRange: { start: string; end: string };
  generatedBy: string;
  generatedAt: string;
  status: 'generating' | 'ready' | 'failed';
  fileUrl?: string;
}

interface GenerateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const GenerateReportModal: React.FC<GenerateReportModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    reportType: 'workforce' as const,
    startDate: '',
    endDate: '',
    includeCharts: true,
    format: 'pdf' as const
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formData);
      setFormData({
        reportType: 'workforce',
        startDate: '',
        endDate: '',
        includeCharts: true,
        format: 'pdf'
      });
      setErrors({});
      onClose();
    } catch (error) {
      console.error('Failed to generate report:', error);
      setErrors({ submit: 'Failed to generate report. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Generate HR Report</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
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

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Report Type
            </label>
            <select
              value={formData.reportType}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                reportType: e.target.value as any
              }))}
              className="bg-white w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
              disabled={loading}
            >
              <option value="workforce">Workforce Summary</option>
              <option value="payroll">Payroll Analysis</option>
              <option value="attendance">Attendance Report</option>
              <option value="performance">Performance Review</option>
              <option value="compliance">Compliance Report</option>
            </select>
          </div>

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
                className={`bg-white w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${ errors.startDate ? 'border-red-500' : 'border-gray-300' } text-black`}
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
                className={`bg-white w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${ errors.endDate ? 'border-red-500' : 'border-gray-300' } text-black`}
                min={formData.startDate}
                disabled={loading}
              />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
              )}
            </div>
          </div>

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
                    className="bg-white text-blue-600 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <span className="text-sm font-medium text-gray-900 capitalize">{format}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.includeCharts}
                onChange={(e) => setFormData(prev => ({ ...prev, includeCharts: e.target.checked }))}
                className="bg-white text-blue-600 focus:ring-blue-500 rounded"
                disabled={loading}
              />
              <span className="text-sm font-medium text-gray-900">Include charts and graphs</span>
            </label>
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
              {loading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ReportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: HRReport[];
  onDownload: (reportId: string) => Promise<void>;
  onDelete: (reportId: string) => Promise<void>;
}

export const ReportHistoryModal: React.FC<ReportHistoryModalProps> = ({
  isOpen,
  onClose,
  reports,
  onDownload,
  onDelete
}) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleDownload = async (reportId: string) => {
    setLoading(reportId);
    try {
      await onDownload(reportId);
    } catch (error) {
      console.error('Failed to download report:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    setLoading(reportId);
    try {
      await onDelete(reportId);
    } catch (error) {
      console.error('Failed to delete report:', error);
    } finally {
      setLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Report History</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
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
                {reports.length > 0 ? (
                  reports.map((report) => (
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
                          {report.status === 'ready' && report.fileUrl && (
                            <button
                              onClick={() => handleDownload(report.id)}
                              disabled={loading === report.id}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(report.id)}
                            disabled={loading === report.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-600">
                      No reports found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
