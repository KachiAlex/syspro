'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, CheckCircle, XCircle, AlertCircle, FileText,
  ChevronDown, ChevronUp, Clock, MessageSquare, User, Users, FolderOpen,
} from 'lucide-react';

interface PendingReport {
  id: string;
  title: string;
  report_type: string;
  report_date: string;
  objectives: string;
  achievements: string;
  challenges: string | null;
  next_steps: string | null;
  additional_notes: string | null;
  meetings: string | null;
  blockers: string | null;
  activities: string | null;
  status: string;
  hod_comment: string | null;
  submitted_at: string;
  updated_at: string;
  appraisal: any;
  submitter_role: string;
  approver_role: string;
  employee_name: string;
  employee_job_title: string | null;
}

export function ApprovalsTab() {
  const [reports, setReports] = useState<PendingReport[]>([]);
  const [myReports, setMyReports] = useState<PendingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [activeCategory, setActiveCategory] = useState<'team' | 'mine'>('team');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/employees/portal/reports/approve');
      if (res.ok) {
        const data = await res.json();
        setReports(data.pendingReports || []);
        setMyReports(data.myReports || []);
      } else {
        setError('Failed to load pending reports');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (reportId: string, action: 'approve' | 'reject' | 'request_edit') => {
    const comment = commentMap[reportId] || '';
    if (action === 'reject' && !comment.trim()) {
      setError('Please provide a reason for rejecting the report');
      return;
    }
    setActionLoading(reportId);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/reports/approve', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, action, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(`Report ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'sent back for edits'}`);
        setReports(prev => prev.filter(r => r.id !== reportId));
        setMyReports(prev => prev.filter(r => r.id !== reportId));
        setCommentMap(prev => { const n = { ...prev }; delete n[reportId]; return n; });
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Failed to update report');
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatDateTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-theme-accent animate-spin" /></div>;
  }

  const hasMyReports = myReports.length > 0;
  const activeReports = activeCategory === 'team' ? reports : myReports;
  const pendingCount = reports.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-theme-text-primary">Report Approvals</h2>
          <p className="text-sm text-theme-text-secondary">Review and act on reports submitted by your team</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
          <Clock className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">{pendingCount} pending</span>
        </div>
      </div>

      {error && <div className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></div>}
      {success && <div className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700"><CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{success}</span></div>}

      {/* Category tabs — only show if HOD has own reports */}
      {hasMyReports && (
        <div className="flex items-center gap-2 border-b border-theme-border">
          <button
            onClick={() => setActiveCategory('team')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeCategory === 'team' ? 'border-theme-accent text-theme-accent' : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            Team Reports
            {pendingCount > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">{pendingCount}</span>}
          </button>
          <button
            onClick={() => setActiveCategory('mine')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeCategory === 'mine' ? 'border-theme-accent text-theme-accent' : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            My Reports
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-theme-muted text-theme-text-secondary">{myReports.length}</span>
          </button>
        </div>
      )}

      {activeReports.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-14 h-14 bg-theme-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-theme-text-tertiary" />
          </div>
          <p className="text-sm font-medium text-theme-text-secondary">
            {activeCategory === 'team' ? 'All caught up!' : 'No reports submitted yet'}
          </p>
          <p className="text-xs text-theme-text-tertiary mt-1">
            {activeCategory === 'team' ? 'No reports pending your approval' : 'Your submitted reports will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeReports.map((r) => (
            <div key={r.id} className="bg-theme-surface rounded-xl border border-theme-border overflow-hidden">
              {/* Header row */}
              <div className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-theme-muted" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-theme-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-theme-text-primary truncate">{r.title || `${r.report_type} report`}</p>
                    <div className="flex items-center gap-2 text-xs text-theme-text-secondary">
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{r.employee_name}</span>
                      <span>·</span>
                      <span>{formatDate(r.report_date)}</span>
                      <span>·</span>
                      <span className="capitalize">{r.report_type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 capitalize">{r.status?.replace('_', ' ')}</span>
                  {expandedId === r.id ? <ChevronUp className="w-4 h-4 text-theme-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-theme-text-tertiary" />}
                </div>
              </div>

              {/* Expanded content */}
              {expandedId === r.id && (
                <div className="border-t border-theme-border px-4 py-4 space-y-3 bg-theme-muted">
                  <ReportSection label="Objectives" content={r.objectives} />
                  <ReportSection label="Achievements" content={r.achievements} />
                  {r.activities && <ReportSection label="Activities" content={r.activities} />}
                  {r.challenges && <ReportSection label="Challenges" content={r.challenges} />}
                  {r.meetings && <ReportSection label="Meetings" content={r.meetings} />}
                  {r.blockers && <ReportSection label="Blockers" content={r.blockers} />}
                  {r.next_steps && <ReportSection label="Next Steps" content={r.next_steps} />}
                  {r.additional_notes && <ReportSection label="Additional Notes" content={r.additional_notes} />}

                  {/* KPI metrics */}
                  {r.appraisal?.kpiMetrics?.length > 0 && (
                    <div>
                      <label className="text-xs font-semibold text-theme-text-primary">KPI Metrics</label>
                      <div className="mt-1 space-y-1">
                        {r.appraisal.kpiMetrics.map((m: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-theme-surface rounded-lg px-2 py-1.5 border border-theme-border">
                            <span className="font-medium text-theme-text-primary">{m.name}</span>
                            <span className="text-theme-text-tertiary">Target: {m.target || '—'}</span>
                            <span className="text-theme-text-tertiary">Actual: {m.actual || '—'}</span>
                            <span className={`px-1.5 py-0.5 rounded-full font-medium ${m.status === 'on_track' ? 'bg-green-100 text-green-700' : m.status === 'ahead' ? 'bg-blue-100 text-blue-700' : m.status === 'behind' ? 'bg-red-100 text-red-700' : 'bg-theme-muted text-theme-text-secondary'}`}>{m.status?.replace('_', ' ') || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-theme-text-tertiary pt-1">Submitted: {formatDateTime(r.submitted_at)}</div>

                  {/* Comment box — only for team reports (not own reports) */}
                  {activeCategory === 'team' && (
                  <div className="pt-2 border-t border-theme-border">
                    <label className="text-xs font-semibold text-theme-text-primary flex items-center gap-1 mb-1">
                      <MessageSquare className="w-3 h-3" />Comment / Reason {actionLoading === r.id && <Loader2 className="w-3 h-3 animate-spin" />}
                    </label>
                    <textarea
                      value={commentMap[r.id] || ''}
                      onChange={(e) => setCommentMap(prev => ({ ...prev, [r.id]: e.target.value }))}
                      rows={2}
                      className="w-full border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text-primary outline-none focus:border-theme-accent"
                      placeholder="Add a comment or reason (required for rejection)..."
                    />
                  </div>
                  )}

                  {/* Show reviewer feedback for own reports */}
                  {activeCategory === 'mine' && r.hod_comment && (
                    <div className="pt-2 border-t border-theme-border">
                      <div className="rounded-lg bg-amber-50 px-3 py-2">
                        <p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><MessageSquare className="w-3 h-3" />Reviewer Feedback</p>
                        <p className="text-xs text-amber-600 mt-0.5">{r.hod_comment}</p>
                      </div>
                    </div>
                  )}

                  {/* Action buttons — only for team reports */}
                  {activeCategory === 'team' && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleAction(r.id, 'approve')}
                      disabled={actionLoading === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />Approve
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'request_edit')}
                      disabled={actionLoading === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 disabled:opacity-50"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />Request Edits
                    </button>
                    <button
                      onClick={() => handleAction(r.id, 'reject')}
                      disabled={actionLoading === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />Reject
                    </button>
                  </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportSection({ label, content }: { label: string; content: string }) {
  if (!content?.trim()) return null;
  return (
    <div>
      <label className="text-xs font-semibold text-theme-text-primary">{label}</label>
      <p className="text-sm text-theme-text-secondary mt-0.5 whitespace-pre-line">{content}</p>
    </div>
  );
}
