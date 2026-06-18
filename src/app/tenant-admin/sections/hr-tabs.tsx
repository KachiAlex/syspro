'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Users, Briefcase, Calendar, TrendingUp, Plus, Eye, Edit, Trash2, 
  Download, Filter, RefreshCw, CheckCircle, Clock, AlertCircle, Award, Target 
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface PerformanceReview {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewDate: string;
  rating: number;
  reviewer: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  feedback: string;
}

interface Goal {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number;
  status: 'Not Started' | 'In Progress' | 'Completed';
}

interface JobOpening {
  id: string;
  title: string;
  department: string;
  status: 'Open' | 'Closed' | 'On Hold';
  applicants: number;
  postedDate: string;
  description: string;
}

interface Candidate {
  id: string;
  name: string;
  email: string;
  jobId: string;
  jobTitle: string;
  stage: 'Applied' | 'Screening' | 'Interview' | 'Offer' | 'Hired' | 'Rejected';
  appliedDate: string;
  rating: number;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  days: number;
}

interface HRTabsProps {
  tenantSlug: string;
}

export default function HRTabs({ tenantSlug }: HRTabsProps) {
  const [activeTab, setActiveTab] = useState<'performance' | 'recruitment' | 'leave' | 'analytics'>('performance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Performance Management State
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null);

  // Recruitment State
  const [jobOpenings, setJobOpenings] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showJobModal, setShowJobModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobOpening | null>(null);

  // Leave Management State
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Auto-dismiss alerts
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Initialize on mount
  useEffect(() => {
    setLastRefreshed(new Date());
    fetchTabData();
  }, [tenantSlug]);

  const fetchTabData = async () => {
    setLoading(true);
    try {
      // Fetch all tab data in parallel
      const [reviewsRes, goalsRes, jobsRes, candidatesRes, leaveRes] = await Promise.all([
        apiClient.get(`/api/tenant/performance/reviews?tenantSlug=${tenantSlug}`).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/api/tenant/performance/goals?tenantSlug=${tenantSlug}`).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/api/tenant/recruitment/jobs?tenantSlug=${tenantSlug}`).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/api/tenant/recruitment/candidates?tenantSlug=${tenantSlug}`).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/api/tenant/leave/requests?tenantSlug=${tenantSlug}`).catch(() => ({ data: { data: [] } }))
      ]);

      setReviews(reviewsRes.data?.data || []);
      setGoals(goalsRes.data?.data || []);
      setJobOpenings(jobsRes.data?.data || []);
      setCandidates(candidatesRes.data?.data || []);
      setLeaveRequests(leaveRes.data?.data || []);
      setLastRefreshed(new Date());
    } catch (err) {
      setError('Failed to load HR data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchTabData();
    setSuccess('HR data refreshed successfully');
  };

  // Performance Management Handlers
  const handleCreateReview = async (data: any) => {
    try {
      const response = await apiClient.post(`/api/tenant/performance/reviews?tenantSlug=${tenantSlug}`, {
        ...data,
        tenantSlug
      });
      setReviews([...reviews, response.data?.data]);
      setSuccess('Performance review created successfully');
      setShowReviewModal(false);
    } catch (err) {
      setError('Failed to create performance review');
    }
  };

  const handleUpdateReview = async (id: string, data: any) => {
    try {
      const response = await apiClient.patch(`/api/tenant/performance/reviews/${id}?tenantSlug=${tenantSlug}`, {
        ...data,
        tenantSlug
      });
      const reviewArray = Array.isArray(reviews) ? reviews : [];
      setReviews(reviewArray.map(r => r.id === id ? response.data?.data : r));
      setSuccess('Performance review updated successfully');
      setSelectedReview(null);
    } catch (err) {
      setError('Failed to update performance review');
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      await apiClient.delete(`/api/tenant/performance/reviews/${id}?tenantSlug=${tenantSlug}`);
      setReviews(reviews.filter(r => r.id !== id));
      setSuccess('Performance review deleted successfully');
    } catch (err) {
      setError('Failed to delete performance review');
    }
  };

  // Recruitment Handlers
  const handleCreateJobOpening = async (data: any) => {
    try {
      const response = await apiClient.post(`/api/tenant/recruitment/jobs?tenantSlug=${tenantSlug}`, {
        ...data,
        tenantSlug
      });
      setJobOpenings([...jobOpenings, response.data?.data]);
      setSuccess('Job opening created successfully');
      setShowJobModal(false);
    } catch (err) {
      setError('Failed to create job opening');
    }
  };

  const handleCloseJobOpening = async (id: string) => {
    try {
      const response = await apiClient.patch(`/api/tenant/recruitment/jobs/${id}?tenantSlug=${tenantSlug}`, {
        status: 'Closed',
        tenantSlug
      });
      const jobArray = Array.isArray(jobOpenings) ? jobOpenings : [];
      setJobOpenings(jobArray.map(j => j.id === id ? response.data?.data : j));
      setSuccess('Job opening closed successfully');
    } catch (err) {
      setError('Failed to close job opening');
    }
  };

  const handleUpdateCandidateStage = async (candidateId: string, newStage: string) => {
    try {
      const response = await apiClient.patch(`/api/tenant/recruitment/candidates/${candidateId}?tenantSlug=${tenantSlug}`, {
        stage: newStage,
        tenantSlug
      });
      const candidateArray = Array.isArray(candidates) ? candidates : [];
      setCandidates(candidateArray.map(c => c.id === candidateId ? response.data?.data : c));
      setSuccess('Candidate stage updated successfully');
    } catch (err) {
      setError('Failed to update candidate stage');
    }
  };

  // Leave Management Handlers
  const handleApproveLeave = async (id: string) => {
    try {
      const response = await apiClient.patch(`/api/tenant/leave/requests/${id}?tenantSlug=${tenantSlug}`, {
        status: 'Approved',
        tenantSlug
      });
      const leaveArray = Array.isArray(leaveRequests) ? leaveRequests : [];
      setLeaveRequests(leaveArray.map(l => l.id === id ? response.data?.data : l));
      setSuccess('Leave request approved successfully');
    } catch (err) {
      setError('Failed to approve leave request');
    }
  };

  const handleRejectLeave = async (id: string) => {
    try {
      const response = await apiClient.patch(`/api/tenant/leave/requests/${id}?tenantSlug=${tenantSlug}`, {
        status: 'Rejected',
        tenantSlug
      });
      const leaveArray = Array.isArray(leaveRequests) ? leaveRequests : [];
      setLeaveRequests(leaveArray.map(l => l.id === id ? response.data?.data : l));
      setSuccess('Leave request rejected successfully');
    } catch (err) {
      setError('Failed to reject leave request');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 text-sm">
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'performance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            <Award className="w-4 h-4 inline mr-2" />
            Performance
          </button>
          <button
            onClick={() => setActiveTab('recruitment')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'recruitment'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            <Briefcase className="w-4 h-4 inline mr-2" />
            Recruitment
          </button>
          <button
            onClick={() => setActiveTab('leave')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'leave'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4 inline mr-2" />
            Leave
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'analytics'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-700'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Analytics
          </button>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {lastRefreshed && (
        <p className="text-xs text-gray-500">
          Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Performance Management Tab */}
      {activeTab === 'performance' && (
        <PerformanceTab
          reviews={reviews}
          goals={goals}
          loading={loading}
          onCreateReview={() => setShowReviewModal(true)}
          onUpdateReview={handleUpdateReview}
          onDeleteReview={handleDeleteReview}
        />
      )}

      {/* Recruitment Tab */}
      {activeTab === 'recruitment' && (
        <RecruitmentTab
          jobOpenings={jobOpenings}
          candidates={candidates}
          loading={loading}
          onCreateJob={() => setShowJobModal(true)}
          onCloseJob={handleCloseJobOpening}
          onUpdateCandidateStage={handleUpdateCandidateStage}
        />
      )}

      {/* Leave Management Tab */}
      {activeTab === 'leave' && (
        <LeaveTab
          leaveRequests={leaveRequests}
          loading={loading}
          onApproveLeave={handleApproveLeave}
          onRejectLeave={handleRejectLeave}
        />
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <AnalyticsTab
          reviews={reviews}
          goals={goals}
          jobOpenings={jobOpenings}
          candidates={candidates}
          leaveRequests={leaveRequests}
          loading={loading}
        />
      )}
    </div>
  );
}

// Performance Management Tab Component
function PerformanceTab({
  reviews,
  goals,
  loading,
  onCreateReview,
  onUpdateReview,
  onDeleteReview,
}: {
  reviews: PerformanceReview[];
  goals: Goal[];
  loading: boolean;
  onCreateReview: () => void;
  onUpdateReview: (id: string, data: any) => void;
  onDeleteReview: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Performance Reviews</h3>
        <button
          onClick={onCreateReview}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Review
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#111827] rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (Array.isArray(reviews) ? reviews : []).length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-[#111827] p-12 text-center">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-2">No performance reviews yet</p>
          <p className="text-sm text-gray-500 mb-4">Create your first performance review to get started</p>
          <button
            onClick={onCreateReview}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Review
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(Array.isArray(reviews) ? reviews : []).map(review => (
            <div key={review.id} className="bg-[#111827] rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{review.employeeName}</h4>
                  <p className="text-sm text-gray-600">Reviewed by {review.reviewer}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    review.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                    review.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-900'
                  }`}>
                    {review.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Rating</p>
                    <p className="text-lg font-bold text-gray-900">{review.rating}/5</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Review Date</p>
                    <p className="text-sm font-medium text-gray-900">{review.reviewDate}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUpdateReview(review.id, { status: 'Completed' })}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Complete review"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteReview(review.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Employee Goals</h3>
        {(Array.isArray(goals) ? goals : []).length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-[#111827] p-12 text-center">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No goals set yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(Array.isArray(goals) ? goals : []).map(goal => (
              <div key={goal.id} className="bg-[#111827] rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                    <p className="text-sm text-gray-600">{goal.description}</p>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    goal.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                    goal.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-900'
                  }`}>
                    {goal.status}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${goal.progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{goal.progress}% complete</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Recruitment Tab Component
function RecruitmentTab({
  jobOpenings,
  candidates,
  loading,
  onCreateJob,
  onCloseJob,
  onUpdateCandidateStage,
}: {
  jobOpenings: JobOpening[];
  candidates: Candidate[];
  loading: boolean;
  onCreateJob: () => void;
  onCloseJob: (id: string) => void;
  onUpdateCandidateStage: (id: string, stage: string) => void;
}) {
  const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Job Openings</h3>
        <button
          onClick={onCreateJob}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Post Job
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-[#111827] rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (Array.isArray(jobOpenings) ? jobOpenings : []).length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-[#111827] p-12 text-center">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-2">No job openings</p>
          <p className="text-sm text-gray-500 mb-4">Post your first job opening to start recruiting</p>
          <button
            onClick={onCreateJob}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Post Job
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(Array.isArray(jobOpenings) ? jobOpenings : []).map(job => (
            <div key={job.id} className="bg-[#111827] rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{job.title}</h4>
                  <p className="text-sm text-gray-600">{job.department}</p>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  job.status === 'Open' ? 'bg-emerald-100 text-emerald-800' :
                  job.status === 'On Hold' ? 'bg-amber-100 text-amber-800' :
                  'bg-gray-100 text-gray-900'
                }`}>
                  {job.status}
                </span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500">Applicants</p>
                  <p className="text-lg font-bold text-gray-900">{job.applicants}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Posted</p>
                  <p className="text-sm font-medium text-gray-900">{job.postedDate}</p>
                </div>
              </div>
              {job.status === 'Open' && (
                <button
                  onClick={() => onCloseJob(job.id)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Close Opening
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Candidate Pipeline</h3>
        {(Array.isArray(candidates) ? candidates : []).length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-[#111827] p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No candidates yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(Array.isArray(candidates) ? candidates : []).map(candidate => (
              <div key={candidate.id} className="bg-[#111827] rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{candidate.name}</h4>
                    <p className="text-sm text-gray-600">{candidate.jobTitle}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Rating</p>
                    <p className="text-lg font-bold text-gray-900">{candidate.rating}/5</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <select
                    value={candidate.stage}
                    onChange={(e) => onUpdateCandidateStage(candidate.id, e.target.value)}
                    className="bg-white px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {stages.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">{candidate.appliedDate}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Leave Management Tab Component
function LeaveTab({
  leaveRequests,
  loading,
  onApproveLeave,
  onRejectLeave,
}: {
  leaveRequests: LeaveRequest[];
  loading: boolean;
  onApproveLeave: (id: string) => void;
  onRejectLeave: (id: string) => void;
}) {
  const pendingRequests = leaveRequests.filter(r => r.status === 'Pending');
  const approvedRequests = leaveRequests.filter(r => r.status === 'Approved');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Pending Requests</p>
          <p className="text-3xl font-bold text-gray-900">{pendingRequests.length}</p>
        </div>
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Approved Requests</p>
          <p className="text-3xl font-bold text-gray-900">{approvedRequests.length}</p>
        </div>
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Days Off</p>
          <p className="text-3xl font-bold text-gray-900">{leaveRequests.reduce((sum, r) => sum + (r.status === 'Approved' ? r.days : 0), 0)}</p>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-900">Pending Requests</h3>
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-[#111827] rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-[#111827] p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No pending leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingRequests.map(request => (
            <div key={request.id} className="bg-[#111827] rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{request.employeeName}</h4>
                  <p className="text-sm text-gray-600">{request.leaveType}</p>
                </div>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
                  Pending
                </span>
              </div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500">{request.startDate} to {request.endDate}</p>
                  <p className="text-sm font-medium text-gray-900">{request.days} days</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => onApproveLeave(request.id)}
                  className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
                >
                  Approve
                </button>
                <button
                  onClick={() => onRejectLeave(request.id)}
                  className="flex-1 px-3 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900 mt-8">Approved Requests</h3>
      {approvedRequests.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-[#111827] p-12 text-center">
          <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No approved leave requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvedRequests.map(request => (
            <div key={request.id} className="bg-[#111827] rounded-lg border border-emerald-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{request.employeeName}</h4>
                  <p className="text-sm text-gray-600">{request.leaveType} • {request.startDate} to {request.endDate}</p>
                </div>
                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                  Approved
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Analytics Tab Component
function AnalyticsTab({
  reviews,
  goals,
  jobOpenings,
  candidates,
  leaveRequests,
  loading,
}: {
  reviews: PerformanceReview[];
  goals: Goal[];
  jobOpenings: JobOpening[];
  candidates: Candidate[];
  leaveRequests: LeaveRequest[];
  loading: boolean;
}) {
  const reviewsArray = Array.isArray(reviews) ? reviews : [];
  const goalsArray = Array.isArray(goals) ? goals : [];
  const jobsArray = Array.isArray(jobOpenings) ? jobOpenings : [];
  const candidatesArray = Array.isArray(candidates) ? candidates : [];
  
  const avgRating = reviewsArray.length > 0 ? (reviewsArray.reduce((sum, r) => sum + r.rating, 0) / reviewsArray.length).toFixed(1) : 0;
  const completedGoals = goalsArray.filter(g => g.status === 'Completed').length;
  const openJobs = jobsArray.filter(j => j.status === 'Open').length;
  const hiredCandidates = candidatesArray.filter(c => c.stage === 'Hired').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg. Performance Rating</p>
              <p className="text-3xl font-bold text-gray-900">{avgRating}/5</p>
            </div>
            <Award className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed Goals</p>
              <p className="text-3xl font-bold text-gray-900">{completedGoals}</p>
            </div>
            <Target className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Open Positions</p>
              <p className="text-3xl font-bold text-gray-900">{openJobs}</p>
            </div>
            <Briefcase className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Candidates Hired</p>
              <p className="text-3xl font-bold text-gray-900">{hiredCandidates}</p>
            </div>
            <Users className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Distribution</h3>
          <div className="space-y-3">
            {[
              { label: 'Excellent (5)', count: reviews.filter(r => r.rating === 5).length, color: 'bg-emerald-500' },
              { label: 'Good (4)', count: reviews.filter(r => r.rating === 4).length, color: 'bg-blue-500' },
              { label: 'Average (3)', count: reviews.filter(r => r.rating === 3).length, color: 'bg-amber-500' },
              { label: 'Below Avg (2)', count: reviews.filter(r => r.rating === 2).length, color: 'bg-orange-500' },
              { label: 'Poor (1)', count: reviews.filter(r => r.rating === 1).length, color: 'bg-red-500' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-sm font-medium w-24">{item.label}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${Math.max(item.count * 20, 5)}%` }}></div>
                </div>
                <span className="text-sm font-semibold w-8 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111827] rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recruitment Pipeline</h3>
          <div className="space-y-3">
            {[
              { stage: 'Applied', count: candidates.filter(c => c.stage === 'Applied').length },
              { stage: 'Screening', count: candidates.filter(c => c.stage === 'Screening').length },
              { stage: 'Interview', count: candidates.filter(c => c.stage === 'Interview').length },
              { stage: 'Offer', count: candidates.filter(c => c.stage === 'Offer').length },
              { stage: 'Hired', count: candidates.filter(c => c.stage === 'Hired').length },
            ].map(item => (
              <div key={item.stage} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{item.stage}</span>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-semibold text-sm">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#111827] rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Leave Analytics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Leave Requests by Status</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">Pending</span>
                <span className="font-semibold">{(Array.isArray(leaveRequests) ? leaveRequests : []).filter(r => r.status === 'Pending').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">Approved</span>
                <span className="font-semibold">{(Array.isArray(leaveRequests) ? leaveRequests : []).filter(r => r.status === 'Approved').length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-900">Rejected</span>
                <span className="font-semibold">{(Array.isArray(leaveRequests) ? leaveRequests : []).filter(r => r.status === 'Rejected').length}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Total Days Off</p>
            <p className="text-3xl font-bold text-gray-900">
              {(Array.isArray(leaveRequests) ? leaveRequests : []).reduce((sum, r) => sum + r.days, 0)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Approval Rate</p>
            <p className="text-3xl font-bold text-gray-900">
              {(Array.isArray(leaveRequests) ? leaveRequests : []).length > 0 
                ? Math.round(((Array.isArray(leaveRequests) ? leaveRequests : []).filter(r => r.status === 'Approved').length / (Array.isArray(leaveRequests) ? leaveRequests : []).length) * 100)
                : 0}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
