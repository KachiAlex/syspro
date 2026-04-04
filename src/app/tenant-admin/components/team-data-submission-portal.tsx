'use client';

import React, { useState, useEffect } from 'react';
import { Upload, FileText, Calendar, Filter, Send, AlertCircle, CheckCircle, X, Plus, Trash2, Download, Eye, Edit } from 'lucide-react';
import { TeamDataSubmission } from '../types/team-data';
import { TeamDataService } from '../services/team-data-service';

interface TeamDataSubmissionPortalProps {
  tenantSlug: string;
  currentUserId: string;
  userDepartment: string;
  userRole: string;
}

export const TeamDataSubmissionPortal: React.FC<TeamDataSubmissionPortalProps> = ({
  tenantSlug,
  currentUserId,
  userDepartment,
  userRole
}) => {
  const [submissions, setSubmissions] = useState<TeamDataSubmission[]>([]);
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'submit' | 'my-submissions' | 'pending-review'>('submit');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Form state
  const [formData, setFormData] = useState({
    dataType: 'sales' as TeamDataSubmission['dataType'],
    title: '',
    description: '',
    period: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    },
    data: {} as Record<string, any>,
    confidence: 'medium' as TeamDataSubmission['confidence'],
    source: 'manual' as TeamDataSubmission['source']
  });

  useEffect(() => {
    loadSubmissions();
  }, [tenantSlug, currentUserId]);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const submissions = await TeamDataService.getTeamSubmissions(tenantSlug, {
        teamMemberId: currentUserId
      });
      setSubmissions(submissions);
    } catch (error) {
      console.error('Failed to load submissions:', error);
      setErrors({ load: 'Failed to load submissions. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!formData.period.start) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.period.end) {
      newErrors.endDate = 'End date is required';
    } else if (formData.period.start && new Date(formData.period.end) < new Date(formData.period.start)) {
      newErrors.endDate = 'End date must be after start date';
    }

    // Validate data based on type
    if (!validateDataByType(formData.dataType, formData.data)) {
      newErrors.data = 'Please fill in all required fields for the selected data type';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateDataByType = (dataType: string, data: Record<string, any>): boolean => {
    switch (dataType) {
      case 'sales':
        return data.revenue !== undefined && data.deals !== undefined;
      case 'financial':
        return data.expenses !== undefined && data.budget !== undefined;
      case 'hr':
        return data.headcount !== undefined && data.attendance !== undefined;
      case 'operations':
        return data.productivity !== undefined && data.efficiency !== undefined;
      default:
        return Object.keys(data).length > 0;
    }
  };

  const handleFileUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
      
      try {
        const uploadedFile = await TeamDataService.uploadTeamFile(tenantSlug, file, {
          description: `Attachment for ${formData.title}`
        });
        
        setUploadedFiles(prev => [...prev, file]);
        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
      } catch (error) {
        console.error('Failed to upload file:', error);
        setErrors({ upload: `Failed to upload ${file.name}` });
      }
    }
  };

  const handleSubmitSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      const submission = await TeamDataService.createTeamSubmission(tenantSlug, {
        teamMemberId: currentUserId,
        ...formData
      });

      setSubmissions(prev => [submission, ...prev]);
      setShowSubmissionModal(false);
      resetForm();
    } catch (error) {
      console.error('Failed to submit data:', error);
      setErrors({ submit: 'Failed to submit data. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      dataType: 'sales',
      title: '',
      description: '',
      period: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      data: {},
      confidence: 'medium',
      source: 'manual'
    });
    setUploadedFiles([]);
    setUploadProgress({});
    setErrors({});
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm('Are you sure you want to delete this submission?')) return;

    try {
      await TeamDataService.deleteTeamSubmission(submissionId, tenantSlug);
      setSubmissions(prev => prev.filter(s => s.id !== submissionId));
    } catch (error) {
      console.error('Failed to delete submission:', error);
    }
  };

  const renderDataForm = () => {
    switch (formData.dataType) {
      case 'sales':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Revenue ($)</label>
              <input
                type="number"
                value={formData.data.revenue || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, revenue: parseFloat(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter revenue amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of Deals</label>
              <input
                type="number"
                value={formData.data.deals || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, deals: parseInt(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter number of deals"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Conversion Rate (%)</label>
              <input
                type="number"
                value={formData.data.conversionRate || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, conversionRate: parseFloat(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter conversion rate"
                min="0"
                max="100"
              />
            </div>
          </div>
        );

      case 'financial':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Expenses ($)</label>
              <input
                type="number"
                value={formData.data.expenses || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, expenses: parseFloat(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter total expenses"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Budget ($)</label>
              <input
                type="number"
                value={formData.data.budget || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, budget: parseFloat(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter budget amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Variance (%)</label>
              <input
                type="number"
                value={formData.data.variance || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, variance: parseFloat(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter budget variance"
              />
            </div>
          </div>
        );

      case 'hr':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Headcount</label>
              <input
                type="number"
                value={formData.data.headcount || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, headcount: parseInt(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current headcount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Attendance Rate (%)</label>
              <input
                type="number"
                value={formData.data.attendance || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, attendance: parseFloat(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter attendance rate"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Turnover Rate (%)</label>
              <input
                type="number"
                value={formData.data.turnoverRate || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, turnoverRate: parseFloat(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter turnover rate"
                min="0"
                max="100"
              />
            </div>
          </div>
        );

      case 'operations':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Productivity Score</label>
              <input
                type="number"
                value={formData.data.productivity || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, productivity: parseFloat(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter productivity score"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Efficiency (%)</label>
              <input
                type="number"
                value={formData.data.efficiency || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, efficiency: parseFloat(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter efficiency percentage"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Output Units</label>
              <input
                type="number"
                value={formData.data.output || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  data: { ...prev.data, output: parseInt(e.target.value) || 0 }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter output units"
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Custom Data (JSON)</label>
              <textarea
                value={JSON.stringify(formData.data, null, 2)}
                onChange={(e) => {
                  try {
                    const data = JSON.parse(e.target.value);
                    setFormData(prev => ({ ...prev, data }));
                  } catch (error) {
                    // Invalid JSON, don't update
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={6}
                placeholder="Enter custom data in JSON format"
              />
            </div>
          </div>
        );
    }
  };

  const getStatusColor = (status: TeamDataSubmission['status']) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'under_review': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: TeamDataSubmission['confidence']) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Submission Portal</h2>
          <p className="text-gray-600">Submit and manage your team's data contributions</p>
        </div>
        <button
          onClick={() => setShowSubmissionModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Submit Data
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'submit'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Send className="w-4 h-4 inline mr-2" />
              Submit Data
            </button>
            <button
              onClick={() => setActiveTab('my-submissions')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'my-submissions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              My Submissions
            </button>
            <button
              onClick={() => setActiveTab('pending-review')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pending-review'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Pending Review
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Submit Tab */}
          {activeTab === 'submit' && (
            <div className="text-center py-12">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Submit Data?</h3>
              <p className="text-gray-600 mb-4">
                Share your team's data to contribute to comprehensive reports and analytics
              </p>
              <button
                onClick={() => setShowSubmissionModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start New Submission
              </button>
            </div>
          )}

          {/* My Submissions Tab */}
          {activeTab === 'my-submissions' && (
            <div className="space-y-4">
              {submissions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Submissions Yet</h3>
                  <p className="text-gray-600 mb-4">
                    Start submitting data to see your contributions here
                  </p>
                  <button
                    onClick={() => setShowSubmissionModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Submit Your First Data
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div key={submission.id} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-gray-900">{submission.title}</h4>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                              {submission.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(submission.confidence)}`}>
                              {submission.confidence.toUpperCase()} CONFIDENCE
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{submission.description}</p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>Type: {submission.dataType}</span>
                            <span>Period: {submission.period.start} to {submission.period.end}</span>
                            <span>Submitted: {new Date(submission.submittedAt).toLocaleDateString()}</span>
                          </div>
                          {submission.reviewNotes && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                              <strong>Review Notes:</strong> {submission.reviewNotes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {submission.status === 'draft' && (
                            <button
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteSubmission(submission.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pending Review Tab */}
          {activeTab === 'pending-review' && (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Reviews</h3>
              <p className="text-gray-600">
                Submissions currently under review will appear here
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Submission Modal */}
      {showSubmissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Submit Data</h3>
                <button
                  onClick={() => {
                    setShowSubmissionModal(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitSubmission} className="p-6 space-y-6">
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-700">{errors.submit}</span>
                  </div>
                </div>
              )}

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Type *</label>
                  <select
                    value={formData.dataType}
                    onChange={(e) => setFormData(prev => ({ ...prev, dataType: e.target.value as TeamDataSubmission['dataType'] }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="sales">Sales Data</option>
                    <option value="financial">Financial Data</option>
                    <option value="hr">HR Data</option>
                    <option value="operations">Operations Data</option>
                    <option value="custom">Custom Data</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confidence Level</label>
                  <select
                    value={formData.confidence}
                    onChange={(e) => setFormData(prev => ({ ...prev, confidence: e.target.value as TeamDataSubmission['confidence'] }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.title ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter a descriptive title for your submission"
                  />
                  {errors.title && (
                    <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.description ? 'border-red-500' : 'border-gray-300'
                    }`}
                    rows={3}
                    placeholder="Describe the data you're submitting"
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date *</label>
                  <input
                    type="date"
                    value={formData.period.start}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      period: { ...prev.period, start: e.target.value }
                    }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.startDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.startDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date *</label>
                  <input
                    type="date"
                    value={formData.period.end}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      period: { ...prev.period, end: e.target.value }
                    }))}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.endDate ? 'border-red-500' : 'border-gray-300'
                    }`}
                    min={formData.period.start}
                  />
                  {errors.endDate && (
                    <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
                  )}
                </div>
              </div>

              {/* Data Form */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Data Details</h4>
                {renderDataForm()}
                {errors.data && (
                  <p className="mt-2 text-sm text-red-600">{errors.data}</p>
                )}
              </div>

              {/* File Upload */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">Attachments</h4>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <div className="text-center">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 mb-2">
                      Upload files to support your data submission
                    </p>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      Choose Files
                    </label>
                  </div>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">{file.name}</span>
                        <div className="flex items-center gap-2">
                          {uploadProgress[file.name] !== undefined && (
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress[file.name]}%` }}
                              />
                            </div>
                          )}
                          <button
                            onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmissionModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Submitting...' : 'Submit Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
