'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw, Eye, Loader2, X
} from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { HRService } from '@/app/tenant-admin/sections/hr-service';

interface Employee {
  id: string;
  name: string;
  department: string;
  status: string;
  salary?: number;
}

interface StaffReport {
  id: string;
  employeeId: string;
  title: string;
  reportType: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  reportDate: string;
  rawTranscript: string;
  refinedText: string;
  objectives: string;
  achievements: string;
  challenges: string;
  nextSteps: string;
  additionalNotes: string;
  meetings: string;
  blockers: string;
  activities: string;
  headOfDepartment: string;
  teamMembers: string[];
  submittedAt: string;
  updatedAt: string;
  status: 'pending' | 'under_review' | 'approved' | 'needs_edit' | 'rejected';
  hodComment?: string | null;
  templateSnapshot?: any;
  appraisal?: {
    overallScore: number;
    taskCompletionRate: number;
    reportCoverage: number;
    qualityScore: number;
    consistencyScore: number;
    addressedTasks: string[];
    unaddressedTasks: string[];
    completedTasks: string[];
    incompleteTasks: string[];
    summary: string;
  } | null;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function buildSalaryRanges(salaries: number[], currency: string) {
  if (salaries.length === 0) return [];
  const min = Math.min(...salaries);
  const max = Math.max(...salaries);
  if (min === max) {
    return [{ label: formatMoney(min, currency), min, max: min + 1, count: salaries.length, percentage: 100 }];
  }

  const bucketCount = Math.min(4, salaries.length);
  const step = (max - min) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const bucketMin = min + i * step;
    const bucketMax = i === bucketCount - 1 ? max + 1 : min + (i + 1) * step;
    const label = `${formatMoney(bucketMin, currency)} - ${formatMoney(Math.min(bucketMax, max), currency)}`;
    return { label, min: bucketMin, max: bucketMax };
  });

  return buckets.map((range) => {
    const count = salaries.filter((s) => s >= range.min && s < range.max).length;
    const percentage = Math.round((count / salaries.length) * 100);
    return { ...range, count, percentage };
  });
}

const STATUS_OPTIONS: { value: StaffReport['status']; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  { value: 'under_review', label: 'Under Review', color: 'bg-blue-100 text-blue-800' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' },
  { value: 'needs_edit', label: 'Needs Edit', color: 'bg-orange-100 text-orange-800' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-800' },
];

export default function ReportsPage() {
  const { tenantSlug, currency } = useTenantContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [reports, setReports] = useState<StaffReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<StaffReport | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewingStatus, setReviewingStatus] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [fetchedEmployees, fetchedReports] = await Promise.all([
        HRService.getEmployees(tenantSlug).catch(() => []),
        HRService.getStaffReports(tenantSlug).catch(() => []),
      ]);
      setEmployees(fetchedEmployees.map((e: any) => ({
        id: e.id,
        name: e.name,
        department: e.department,
        status: e.status,
        salary: typeof e.salary === 'number' ? e.salary : (e.salary ? Number(e.salary) : undefined),
      })));
      setReports(fetchedReports as StaffReport[]);
    } catch (error) {
      console.error('Failed to load reports data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const employeeMap = useMemo(() => {
    return new Map(employees.map((e) => [e.id, e]));
  }, [employees]);

  const departmentCounts = useMemo(() => {
    return employees.reduce((acc, emp) => {
      acc[emp.department] = (acc[emp.department] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [employees]);

  const departmentData = useMemo(() => {
    return Object.entries(departmentCounts).map(([dept, count]) => ({
      dept,
      count,
      percentage: employees.length > 0 ? Math.round((count / employees.length) * 100) : 0,
    }));
  }, [departmentCounts, employees.length]);

  const salaryData = useMemo(() => {
    const salaries = employees.map((e) => e.salary).filter((s): s is number => typeof s === 'number' && !isNaN(s));
    return buildSalaryRanges(salaries, currency);
  }, [employees, currency]);

  const filteredReports = useMemo(() => {
    if (filterStatus === 'all') return reports;
    return reports.filter((r) => r.status === filterStatus);
  }, [reports, filterStatus]);

  const handleStatusChange = async (reportId: string, status: StaffReport['status'], comment?: string) => {
    if (!tenantSlug) return;
    setUpdatingId(reportId);
    setReviewingStatus(status);
    try {
      await HRService.updateStaffReportStatus(tenantSlug, reportId, status, comment);
      await loadData();
      setReviewComment('');
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setUpdatingId(null);
      setReviewingStatus(null);
    }
  };

  const appraisalAggregate = useMemo(() => {
    const scored = reports.filter((r) => r.appraisal && r.appraisal.overallScore > 0);
    if (scored.length === 0) return null;
    const avgOverall = Math.round(scored.reduce((sum, r) => sum + (r.appraisal?.overallScore || 0), 0) / scored.length);
    const avgCompletion = Math.round(scored.reduce((sum, r) => sum + (r.appraisal?.taskCompletionRate || 0), 0) / scored.length);
    const avgCoverage = Math.round(scored.reduce((sum, r) => sum + (r.appraisal?.reportCoverage || 0), 0) / scored.length);
    const avgQuality = Math.round(scored.reduce((sum, r) => sum + (r.appraisal?.qualityScore || 0), 0) / scored.length);
    return { avgOverall, avgCompletion, avgCoverage, avgQuality, count: scored.length };
  }, [reports]);

  const statusBadge = (status: StaffReport['status']) => {
    const option = STATUS_OPTIONS.find((o) => o.value === status) || STATUS_OPTIONS[0];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${option.color}`}>
        {option.label}
      </span>
    );
  };

  const renderSection = (label: string, content: string) => {
    if (!content?.trim()) return null;
    return (
      <div className="mb-4">
        <h5 className="text-sm font-semibold text-gray-900 mb-1">{label}</h5>
        <div className="text-sm text-gray-700 whitespace-pre-line">{content}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">HR Reports & Analytics</h2>
        <div className="text-center py-12 text-gray-500">Loading reports data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">HR Reports & Analytics</h2>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Total Employees</h4>
          <p className="text-3xl font-bold text-gray-900">{employees.length}</p>
          <p className="text-xs text-gray-600 mt-2">Active workforce</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Active</h4>
          <p className="text-3xl font-bold text-green-600">{employees.filter(e => e.status === 'Active').length}</p>
          <p className="text-xs text-gray-600 mt-2">Currently working</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">On Leave</h4>
          <p className="text-3xl font-bold text-amber-600">{employees.filter(e => e.status === 'On Leave').length}</p>
          <p className="text-xs text-gray-600 mt-2">Temporary absence</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Departments</h4>
          <p className="text-3xl font-bold text-blue-600">{new Set(employees.map(e => e.department)).size}</p>
          <p className="text-xs text-gray-600 mt-2">Organizational units</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Salary Distribution</h4>
          {salaryData.length > 0 ? (
            <div className="space-y-3">
              {salaryData.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{item.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No salary data available.</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Department Breakdown</h4>
          {departmentData.length > 0 ? (
            <div className="space-y-3">
              {departmentData.map((item) => (
                <div key={item.dept}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{item.dept}</span>
                    <span className="text-sm font-semibold text-gray-900">{item.count} ({item.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No department data available.</p>
          )}
        </div>
      </div>

      {appraisalAggregate && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Collective Productivity Appraisal</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-center">
              <div className="text-xs text-emerald-700">Avg Overall Score</div>
              <div className="text-2xl font-bold text-emerald-800">{appraisalAggregate.avgOverall}/100</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-center">
              <div className="text-xs text-emerald-700">Avg Completion</div>
              <div className="text-2xl font-bold text-emerald-800">{appraisalAggregate.avgCompletion}%</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-center">
              <div className="text-xs text-emerald-700">Avg Coverage</div>
              <div className="text-2xl font-bold text-emerald-800">{appraisalAggregate.avgCoverage}%</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 text-center">
              <div className="text-xs text-emerald-700">Avg Quality</div>
              <div className="text-2xl font-bold text-emerald-800">{appraisalAggregate.avgQuality}%</div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-3">Based on {appraisalAggregate.count} submitted reports with appraisals.</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h4 className="font-semibold text-gray-900">Incoming Staff Reports</h4>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {filteredReports.length > 0 ? (
          <div className="space-y-3">
            {filteredReports.map((report) => {
              const submitter = employeeMap.get(report.employeeId);
              return (
                <div key={report.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{report.title || `${report.reportType} Report`}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Submitted by <span className="font-medium">{submitter?.name || report.employeeId}</span>
                        {' • '}{report.department || submitter?.department || 'Unknown department'}
                        {' • '}{new Date(report.submittedAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        HOD: {report.headOfDepartment || 'Not set'}
                        {report.teamMembers?.length > 0 && ` • Tagged: ${report.teamMembers.join(', ')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {updatingId === report.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                      ) : (
                        <select
                          value={report.status}
                          onChange={(e) => handleStatusChange(report.id, e.target.value as StaffReport['status'])}
                          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      )}
                      {statusBadge(report.status)}
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="View report"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No staff reports submitted yet.</p>
        )}
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedReport.title || `${selectedReport.reportType} Report`}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {employeeMap.get(selectedReport.employeeId)?.name || selectedReport.employeeId} • {new Date(selectedReport.submittedAt).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="text-gray-500 hover:text-gray-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {(selectedReport.status === 'pending' || selectedReport.status === 'under_review') && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">HOD Review</h5>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Optional comment or reason for rejection..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleStatusChange(selectedReport.id, 'approved', reviewComment)}
                      disabled={updatingId === selectedReport.id}
                      className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedReport.id, 'needs_edit', reviewComment)}
                      disabled={updatingId === selectedReport.id}
                      className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      Request Edits
                    </button>
                    <button
                      onClick={() => handleStatusChange(selectedReport.id, 'rejected', reviewComment)}
                      disabled={updatingId === selectedReport.id}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
              {selectedReport.hodComment && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h5 className="text-sm font-semibold text-blue-900 mb-1">HOD Comment</h5>
                  <p className="text-sm text-blue-900">{selectedReport.hodComment}</p>
                </div>
              )}

              {selectedReport.refinedText && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h5 className="text-sm font-semibold text-blue-900 mb-2">Refined Summary</h5>
                  <p className="text-sm text-blue-900">{selectedReport.refinedText}</p>
                </div>
              )}

              {selectedReport.appraisal && selectedReport.appraisal.overallScore > 0 && (
                <div className="mb-6 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <h5 className="text-sm font-semibold text-emerald-900 mb-3">AI Productivity Appraisal</h5>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="bg-white p-2 rounded border border-emerald-100 text-center">
                      <div className="text-xs text-gray-500">Overall</div>
                      <div className="text-lg font-bold text-emerald-700">{selectedReport.appraisal.overallScore}</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-100 text-center">
                      <div className="text-xs text-gray-500">Completion</div>
                      <div className="text-lg font-bold text-emerald-700">{selectedReport.appraisal.taskCompletionRate}%</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-100 text-center">
                      <div className="text-xs text-gray-500">Coverage</div>
                      <div className="text-lg font-bold text-emerald-700">{selectedReport.appraisal.reportCoverage}%</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-100 text-center">
                      <div className="text-xs text-gray-500">Quality</div>
                      <div className="text-lg font-bold text-emerald-700">{selectedReport.appraisal.qualityScore}%</div>
                    </div>
                  </div>
                  <p className="text-sm text-emerald-900 mb-2">{selectedReport.appraisal.summary}</p>
                  {selectedReport.appraisal.completedTasks.length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium text-emerald-800">Completed:</span>{' '}
                      <span className="text-emerald-700">{selectedReport.appraisal.completedTasks.join(', ')}</span>
                    </div>
                  )}
                  {selectedReport.appraisal.unaddressedTasks.length > 0 && (
                    <div className="text-sm mt-1">
                      <span className="font-medium text-amber-700">Unaddressed:</span>{' '}
                      <span className="text-amber-700">{selectedReport.appraisal.unaddressedTasks.join(', ')}</span>
                    </div>
                  )}
                </div>
              )}

              {renderSection('Activities', selectedReport.activities)}
              {renderSection('Meetings', selectedReport.meetings)}
              {renderSection('Blockers', selectedReport.blockers)}
              {renderSection('Next Steps', selectedReport.nextSteps)}
              {renderSection('Objectives', selectedReport.objectives)}
              {renderSection('Achievements', selectedReport.achievements)}
              {renderSection('Challenges', selectedReport.challenges)}
              {renderSection('Additional Notes', selectedReport.additionalNotes)}
              {selectedReport.rawTranscript && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">Original Transcript</h5>
                  <p className="text-sm text-gray-600 italic">{selectedReport.rawTranscript}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
