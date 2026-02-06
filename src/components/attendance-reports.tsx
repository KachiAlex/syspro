// Attendance Reports Component
'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, TrendingUp, Users, BarChart3, PieChart } from 'lucide-react';

interface PeriodSummary {
  period: string;
  periodLabel: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  trainingDays: number;
  averageConfidence: number;
  compliancePercentage: number;
  totalHoursWorked: number;
  totalBreakTime: number;
  modeDistribution: Record<string, number>;
  records: any[];
}

interface ReportsData {
  periodType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  summaries: PeriodSummary[];
  totalPeriods: number;
}

export default function AttendanceReports({
  tenantSlug: propTenantSlug,
  employeeId: propEmployeeId,
}: {
  tenantSlug?: string | null;
  employeeId?: string;
} = {}) {
  const [tenantSlug] = useState(() => propTenantSlug || "default");
  const [employeeId] = useState(() => propEmployeeId || `user-${Date.now()}`);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'>('weekly');
  const [reportsData, setReportsData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  const periodTypes = [
    { value: 'daily', label: 'Daily', icon: Calendar },
    { value: 'weekly', label: 'Weekly', icon: BarChart3 },
    { value: 'monthly', label: 'Monthly', icon: PieChart },
    { value: 'quarterly', label: 'Quarterly', icon: TrendingUp },
    { value: 'annual', label: 'Annual', icon: Users },
  ] as const;

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/attendance/reports?tenantSlug=${tenantSlug}&periodType=${selectedPeriod}&limit=12${employeeId ? `&employeeId=${employeeId}` : ''}`
        );
        const data = await res.json();
        setReportsData(data);
      } catch (error) {
        console.error('Failed to fetch reports:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [tenantSlug, employeeId, selectedPeriod]);

  const getComplianceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-emerald-600 bg-emerald-50';
    if (percentage >= 75) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-slate-200 rounded mb-6"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Attendance Reports</h1>
          <p className="text-slate-600 mt-1">Track attendance patterns across different time periods</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Time Period</h2>
        <div className="flex flex-wrap gap-2">
          {periodTypes.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setSelectedPeriod(value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                selectedPeriod === value
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {reportsData && reportsData.summaries.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="text-blue-600" size={20} />
                <p className="text-sm font-medium text-slate-600">Total Periods</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">{reportsData.totalPeriods}</p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="text-emerald-600" size={20} />
                <p className="text-sm font-medium text-slate-600">Avg Compliance</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {reportsData.summaries.reduce((acc, s) => acc + s.compliancePercentage, 0) / reportsData.summaries.length || 0}%
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="text-purple-600" size={20} />
                <p className="text-sm font-medium text-slate-600">Total Hours</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {reportsData.summaries.reduce((acc, s) => acc + s.totalHoursWorked, 0).toFixed(1)}h
              </p>
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <Users className="text-amber-600" size={20} />
                <p className="text-sm font-medium text-slate-600">Avg Confidence</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {reportsData.summaries.reduce((acc, s) => acc + s.averageConfidence, 0) / reportsData.summaries.length || 0}%
              </p>
            </div>
          </div>

          {/* Detailed Reports */}
          <div className="space-y-4">
            {reportsData.summaries.map((summary) => (
              <div key={summary.period} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900">{summary.periodLabel}</h3>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getComplianceColor(summary.compliancePercentage)}`}>
                    {summary.compliancePercentage}% Compliance
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
                  {/* Attendance Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Attendance</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Present</span>
                        <span className="font-semibold text-emerald-600">{summary.presentDays}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Absent</span>
                        <span className="font-semibold text-red-600">{summary.absentDays}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Leave</span>
                        <span className="font-semibold text-blue-600">{summary.leaveDays}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Training</span>
                        <span className="font-semibold text-purple-600">{summary.trainingDays}</span>
                      </div>
                    </div>
                  </div>

                  {/* Time Metrics */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Time</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Hours Worked</span>
                        <span className="font-semibold text-slate-900">{summary.totalHoursWorked}h</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Break Time</span>
                        <span className="font-semibold text-slate-900">{summary.totalBreakTime}h</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Avg Confidence</span>
                        <span className={`font-semibold ${getConfidenceColor(summary.averageConfidence)}`}>
                          {summary.averageConfidence}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Work Mode Distribution */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Work Modes</h4>
                    <div className="space-y-2">
                      {Object.entries(summary.modeDistribution).map(([mode, count]) => (
                        <div key={mode} className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">{mode}</span>
                          <span className="font-semibold text-slate-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Period Stats */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Summary</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Total Days</span>
                        <span className="font-semibold text-slate-900">{summary.totalDays}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">Present Rate</span>
                        <span className="font-semibold text-slate-900">
                          {summary.totalDays > 0 ? ((summary.presentDays / summary.totalDays) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">Attendance Rate</span>
                    <span className="text-sm text-slate-600">
                      {summary.presentDays} of {summary.totalDays} days
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${summary.totalDays > 0 ? (summary.presentDays / summary.totalDays) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty State */}
      {reportsData && reportsData.summaries.length === 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white p-12 shadow-sm text-center">
          <Calendar size={48} className="mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Data Available</h3>
          <p className="text-slate-600">
            No attendance records found for the selected time period. Start tracking attendance to see reports here.
          </p>
        </div>
      )}
    </div>
  );
}