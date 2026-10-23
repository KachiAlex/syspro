// Staff Reports Viewer Component
'use client';

import { useState, useEffect } from 'react';
import { FileText, Calendar, User, Users, Eye, CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface StaffReport {
  id: string;
  tenantSlug: string;
  employeeId: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  reportDate: string;
  objectives: string;
  achievements: string;
  challenges: string;
  nextSteps: string;
  additionalNotes: string;
  headOfDepartment: string;
  teamMembers: string[];
  submittedAt: string;
  status: 'pending' | 'reviewed' | 'approved';
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
}

interface StaffReportsViewerProps {
  tenantSlug?: string | null;
  viewMode?: 'hr' | 'admin'; // 'hr' shows reports for HR review, 'admin' shows all reports
}

export default function StaffReportsViewer({
  tenantSlug: propTenantSlug,
  viewMode = 'hr'
}: StaffReportsViewerProps) {
  const [tenantSlug] = useState(() => propTenantSlug);
  const [reports, setReports] = useState<StaffReport[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<StaffReport | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'approved'>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch staff reports
        const reportsParams = new URLSearchParams({ tenantSlug: tenantSlug ?? '' });
        if (viewMode === 'hr') {
          reportsParams.set('status', 'pending'); // HR sees pending reports
        }

        const reportsResponse = await fetch(`/api/hr/staff-reports?${reportsParams}`);
        if (!reportsResponse.ok) {
          throw new Error('Failed to fetch reports');
        }
        const reportsData = await reportsResponse.json();

        // Fetch staff members for name resolution
        const staffResponse = await fetch(`/api/hr/employees?tenantSlug=${tenantSlug ?? ''}`);
        let staffData: StaffMember[] = [];
        if (staffResponse.ok) {
          const staffResult = await staffResponse.json();
          staffData = tenantSlug ? (staffResult.employees?.[tenantSlug] || []) : [];
        }

        setReports(reportsData.reports || []);
        setStaffMembers(staffData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tenantSlug, viewMode]);

  const getStaffMemberName = (id: string) => {
    const member = staffMembers.find(m => m.id === id);
    return member ? member.name : `User ${id}`;
  };

  const getStaffMemberDetails = (id: string) => {
    const member = staffMembers.find(m => m.id === id);
    return member ? `${member.name} (${member.position}, ${member.department})` : `User ${id}`;
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily Report';
      case 'weekly': return 'Weekly Report';
      case 'monthly': return 'Monthly Report';
      default: return 'Report';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'reviewed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-theme-muted text-theme-text-primary border-theme-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'reviewed': return <Eye className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const updateReportStatus = async (reportId: string, newStatus: 'reviewed' | 'approved') => {
    try {
      const response = await fetch('/api/hr/staff-reports', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId,
          status: newStatus,
          tenantSlug,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update report status');
      }

      // Update local state
      setReports(prevReports =>
        prevReports.map(report =>
          report.id === reportId ? { ...report, status: newStatus } : report
        )
      );

      // Update selected report if it's open
      if (selectedReport && selectedReport.id === reportId) {
        setSelectedReport({ ...selectedReport, status: newStatus });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report status');
    }
  };

  const filteredReports: StaffReport[] = reports.filter((r) =>
    filter === 'all' ? true : r.status === filter
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-theme-border"></div>
        <span className="ml-2 text-theme-text-secondary">Loading reports...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
        <p className="text-red-800 font-medium">Error loading reports</p>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-theme-border bg-theme-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-theme-muted p-3">
              <FileText className="h-6 w-6 text-theme-text-secondary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-theme-text-primary">
                {viewMode === 'hr' ? 'Staff Reports Review' : 'All Staff Reports'}
              </h1>
              <p className="text-sm text-theme-text-tertiary">
                {viewMode === 'hr'
                  ? 'Review and manage submitted staff reports'
                  : 'View all staff reports across the organization'
                }
              </p>
            </div>
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-theme-text-secondary">Filter:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="rounded-lg border border-theme-border px-3 py-1 text-sm text-theme-text-primary focus:border-theme-border focus:outline-none"
            >
              <option value="all">All Reports</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="grid gap-4">
        {filteredReports.length === 0 ? (
          <div className="rounded-3xl border border-theme-border bg-theme-surface p-8 text-center shadow-sm">
            <FileText className="h-12 w-12 text-theme-text-secondary mx-auto mb-4" />
            <h3 className="text-lg font-medium text-theme-text-primary mb-2">No reports found</h3>
            <p className="text-theme-text-tertiary">
              {filter === 'all'
                ? 'No staff reports have been submitted yet.'
                : `No ${filter} reports found.`
              }
            </p>
          </div>
        ) : (
          filteredReports.map((report) => (
            <div
              key={report.id}
              className="rounded-3xl border border-theme-border bg-theme-surface p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedReport(report)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-theme-text-primary">
                      {getReportTypeLabel(report.reportType)}
                    </h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(report.status)}`}>
                      {getStatusIcon(report.status)}
                      {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                    </span>
                  </div>

                  <div className="grid gap-2 text-sm text-theme-text-secondary mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(report.reportDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Submitted by: {getStaffMemberName(report.employeeId)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>HOD: {getStaffMemberName(report.headOfDepartment)}</span>
                      {report.teamMembers.length > 0 && (
                        <span className="text-theme-text-secondary">
                          + {report.teamMembers.length} team member{report.teamMembers.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-theme-text-secondary">
                    Submitted {new Date(report.submittedAt).toLocaleString()}
                  </p>
                </div>

                <div className="ml-4">
                  <button className="rounded-full bg-theme-muted p-2 text-theme-text-secondary hover:bg-theme-elevated">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-overlay backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-theme-surface p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-theme-text-primary">
                {getReportTypeLabel(selectedReport.reportType)}
              </h2>
              <button
                onClick={() => setSelectedReport(null)}
                className="rounded-full p-2 text-theme-text-secondary hover:text-theme-text-secondary hover:bg-theme-muted"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Report Header */}
              <div className="rounded-2xl border border-theme-border bg-theme-muted p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-theme-text-tertiary">Submitted by</p>
                    <p className="font-medium text-theme-text-primary">{getStaffMemberDetails(selectedReport.employeeId)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-theme-text-tertiary">Report Date</p>
                    <p className="font-medium text-theme-text-primary">{new Date(selectedReport.reportDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-theme-text-tertiary">Head of Department</p>
                    <p className="font-medium text-theme-text-primary">{getStaffMemberDetails(selectedReport.headOfDepartment)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-theme-text-tertiary">Status</p>
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedReport.status)}`}>
                      {getStatusIcon(selectedReport.status)}
                      {selectedReport.status.charAt(0).toUpperCase() + selectedReport.status.slice(1)}
                    </span>
                  </div>
                </div>

                {selectedReport.teamMembers.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-theme-text-tertiary mb-2">Team Members</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedReport.teamMembers.map((memberId) => (
                        <span key={memberId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-theme-muted text-xs text-theme-text-primary">
                          <User className="h-3 w-3" />
                          {getStaffMemberName(memberId)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Report Content */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-theme-text-primary mb-2">Objectives / Goals</h3>
                  <p className="text-theme-text-primary whitespace-pre-wrap">{selectedReport.objectives}</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-theme-text-primary mb-2">Achievements / Progress</h3>
                  <p className="text-theme-text-primary whitespace-pre-wrap">{selectedReport.achievements}</p>
                </div>

                {selectedReport.challenges && (
                  <div>
                    <h3 className="text-lg font-semibold text-theme-text-primary mb-2">Challenges / Blockers</h3>
                    <p className="text-theme-text-primary whitespace-pre-wrap">{selectedReport.challenges}</p>
                  </div>
                )}

                {selectedReport.nextSteps && (
                  <div>
                    <h3 className="text-lg font-semibold text-theme-text-primary mb-2">Next Steps / Action Items</h3>
                    <p className="text-theme-text-primary whitespace-pre-wrap">{selectedReport.nextSteps}</p>
                  </div>
                )}

                {selectedReport.additionalNotes && (
                  <div>
                    <h3 className="text-lg font-semibold text-theme-text-primary mb-2">Additional Notes</h3>
                    <p className="text-theme-text-primary whitespace-pre-wrap">{selectedReport.additionalNotes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-6 border-t border-theme-border">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="px-4 py-2 text-theme-text-secondary hover:text-theme-text-primary"
                >
                  Close
                </button>
                {viewMode === 'hr' && selectedReport.status === 'pending' && (
                  <>
                    <button
                      onClick={() => updateReportStatus(selectedReport.id, 'reviewed')}
                      className="rounded-lg bg-theme-accent px-4 py-2 text-sm font-semibold text-theme-text-primary shadow-sm transition hover:bg-theme-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-theme-accent"
                    >
                      Mark as Reviewed
                    </button>
                    <button
                      onClick={() => updateReportStatus(selectedReport.id, 'approved')}
                      className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-theme-text-primary shadow-sm transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                    >
                      Approve Report
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}