'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, Clock, CheckCircle, XCircle, AlertCircle, X,
  Calendar, Plane, ClipboardCheck, User
} from 'lucide-react';

interface EmployeeProfile {
  id: string; name: string; email: string; jobTitle: string; role: string;
  departmentId: string; employmentType: string; status: string;
  hireDate: string; salary: number; lastLogin: string;
}

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  reviewer_comment?: string;
  created_at: string;
  reviewed_at?: string;
  employee_name?: string;
  employee_job_title?: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  approved: { color: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
  rejected: { color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
};

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'personal', label: 'Personal Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'unpaid', label: 'Unpaid Leave' },
];

export function LeaveTab({ profile: _profile }: { profile: EmployeeProfile }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>([]);
  const [isHOD, setIsHOD] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [view, setView] = useState<'mine' | 'approvals'>('mine');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/leave');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRequests(data.requests || []);
        setPendingApprovals(data.pendingApprovals || []);
        setIsHOD(data.isHOD || false);
      } else {
        setError(data.error || 'Failed to load leave requests');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleLeaveAction = async (leaveId: string, action: 'approve' | 'reject') => {
    setActionLoading(leaveId);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/leave', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPendingApprovals(prev => prev.filter(r => r.id !== leaveId));
      } else {
        setError(data.error || 'Failed to update leave');
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Leave Requests</h2>
          <p className="text-sm text-gray-500 mt-0.5">Submit and track your leave applications</p>
        </div>
        <button
          onClick={() => setShowSubmit(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Request Leave
        </button>
      </div>

      {/* HOD approval tabs */}
      {isHOD && (
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            onClick={() => setView('mine')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              view === 'mine' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Plane className="w-4 h-4" />
            My Leave
          </button>
          <button
            onClick={() => setView('approvals')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              view === 'approvals' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Pending Approvals
            {pendingApprovals.length > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">{pendingApprovals.length}</span>}
          </button>
        </div>
      )}

      {/* Stats — only show on 'mine' view */}
      {view === 'mine' && (
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 mb-2">
            <Calendar className="w-4 h-4" /> Total
          </div>
          <p className="text-2xl font-bold text-gray-900">{requests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 mb-2">
            <Clock className="w-4 h-4" /> Pending
          </div>
          <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 mb-2">
            <CheckCircle className="w-4 h-4" /> Approved
          </div>
          <p className="text-2xl font-bold text-gray-900">{approvedCount}</p>
        </div>
      </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Pending approvals view (HOD) */}
      {view === 'approvals' && isHOD ? (
        pendingApprovals.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
            <CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No pending leave approvals</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingApprovals.map(req => {
              const leaveType = LEAVE_TYPES.find(l => l.value === req.leave_type)?.label || req.leave_type;
              return (
                <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-semibold text-gray-900 text-sm">{leaveType}</h4>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-amber-100 text-amber-700 border-amber-200">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <User className="w-3 h-3" />
                        <span className="font-medium text-gray-700">{req.employee_name}</span>
                        {req.employee_job_title && <span>· {req.employee_job_title}</span>}
                      </div>
                      <p className="text-sm text-gray-600">{req.reason}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>{req.start_date} → {req.end_date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleLeaveAction(req.id, 'approve')}
                        disabled={actionLoading === req.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        {actionLoading === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleLeaveAction(req.id, 'reject')}
                        disabled={actionLoading === req.id}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : view === 'mine' && (
      requests.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
          <Plane className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No leave requests yet. Submit one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => {
            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const leaveType = LEAVE_TYPES.find(l => l.value === req.leave_type)?.label || req.leave_type;
            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="font-semibold text-gray-900 text-sm">{leaveType}</h4>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{req.reason}</p>
                    {req.reviewer_comment && (
                      <p className="text-xs text-gray-500 mt-1.5 italic">"{req.reviewer_comment}"</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      <span>{req.start_date} → {req.end_date}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )
      )}

      {showSubmit && (
        <SubmitLeaveModal
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); loadRequests(); }}
        />
      )}
    </div>
  );
}

function SubmitLeaveModal({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a reason for your leave request');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be before start date');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leaveType, startDate, endDate, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onSubmitted();
      } else {
        setError(data.error || 'Failed to submit leave request');
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Request Leave</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Leave Type</label>
            <select
              value={leaveType}
              onChange={e => setLeaveType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {LEAVE_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Reason *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Briefly explain the reason for your leave..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Request
          </button>
        </div>
      </div>
    </div>
  );
}
