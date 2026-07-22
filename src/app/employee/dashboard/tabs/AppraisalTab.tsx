'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Sparkles, Target, FileText, Calendar, TrendingUp,
  CheckCircle, AlertCircle, Award, ChevronRight, User, Brain,
} from 'lucide-react';

interface EmployeeProfile {
  id: string; name: string; email: string; jobTitle: string; role: string;
  departmentId: string; employmentType: string; status: string;
  hireDate: string; salary: number; lastLogin: string;
}

interface Employee {
  id: string; name: string; email: string; job_title: string; role: string;
  department_id: string; hire_date: string;
}

interface Appraisal {
  overallScore: number;
  categories: {
    kpiPerformance: { score: number; summary: string };
    reportQuality: { score: number; summary: string };
    attendance: { score: number; summary: string };
    taskExecution: { score: number; summary: string };
  };
  strengths: string[];
  improvements: string[];
  recommendation: string;
  rating: string;
}

export function AppraisalTab({ profile }: { profile: EmployeeProfile }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [appraisalData, setAppraisalData] = useState<any>(null);
  const [appraisal, setAppraisal] = useState<Appraisal | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/employees/portal/colleagues');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmployees(data.colleagues || []);
      }
    } catch {
      setError('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const loadAppraisalData = async (empId: string) => {
    setError(null);
    setAppraisal(null);
    setAppraisalData(null);
    try {
      const res = await fetch(`/api/hr/employees/portal/appraisal?employeeId=${empId}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAppraisalData(data);
      } else {
        setError(data.error || 'Failed to load data');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleSelect = (empId: string) => {
    setSelectedId(empId);
    loadAppraisalData(empId);
  };

  const handleGenerate = async () => {
    if (!selectedId || !appraisalData) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/appraisal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee: appraisalData.employee,
          tasks: appraisalData.tasks,
          reports: appraisalData.reports,
          attendance: appraisalData.attendance,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.appraisal) {
        setAppraisal(data.appraisal);
      } else {
        setError(data.error || 'Failed to generate appraisal');
      }
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
    }
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const ratingColor = (rating: string) => {
    const r = rating.toLowerCase();
    if (r.includes('excellent')) return 'bg-green-100 text-green-700 border-green-200';
    if (r.includes('good')) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (r.includes('satisfactory')) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-red-100 text-red-700 border-red-200';
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  const selectedEmp = employees.find(e => e.id === selectedId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-600" />
          AI Productivity Appraisal
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Generate AI-driven performance appraisals using KPI completion, report quality, and attendance benchmarks</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Employee selector */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Employee</h3>
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {employees.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No employees found</p>
            ) : employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => handleSelect(emp.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedId === emp.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-gray-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{emp.name}</p>
                  <p className="text-xs text-gray-400 truncate">{emp.job_title || emp.role}</p>
                </div>
                {selectedId === emp.id && <ChevronRight className="w-4 h-4 text-blue-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Appraisal content */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedId ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">Select an employee to begin</p>
              <p className="text-xs text-gray-400 mt-1">AI appraisal uses KPI completion, report quality, and attendance data</p>
            </div>
          ) : !appraisalData ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading employee data...</p>
            </div>
          ) : (
            <>
              {/* Employee summary + metrics preview */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{appraisalData.employee?.name}</h3>
                    <p className="text-xs text-gray-500">{appraisalData.employee?.job_title} · {appraisalData.employee?.role}</p>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all"
                  >
                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {generating ? 'Generating...' : 'Generate Appraisal'}
                  </button>
                </div>

                {/* Quick metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard icon={<Target className="w-4 h-4" />} label="KPIs" value={appraisalData.tasks?.filter((t: any) => t.is_kpi).length || 0} color="purple" />
                  <MetricCard icon={<CheckCircle className="w-4 h-4" />} label="Completed" value={appraisalData.tasks?.filter((t: any) => t.status === 'completed').length || 0} color="green" />
                  <MetricCard icon={<FileText className="w-4 h-4" />} label="Reports" value={appraisalData.reports?.length || 0} color="blue" />
                  <MetricCard icon={<Calendar className="w-4 h-4" />} label="Present (30d)" value={appraisalData.attendance?.filter((a: any) => a.status === 'present').length || 0} color="indigo" />
                </div>
              </div>

              {/* AI Appraisal result */}
              {appraisal && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  {/* Overall score */}
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${scoreColor(appraisal.overallScore)}`}>
                        <span className="text-2xl font-bold">{appraisal.overallScore}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Overall Score</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ratingColor(appraisal.rating)}`}>
                          {appraisal.rating}
                        </span>
                      </div>
                    </div>
                    <Sparkles className="w-6 h-6 text-purple-400" />
                  </div>

                  {/* Category scores */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(appraisal.categories).map(([key, cat]: [string, any]) => (
                      <div key={key} className="rounded-xl border border-gray-200 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${scoreColor(cat.score)}`}>{cat.score}</span>
                        </div>
                        <p className="text-xs text-gray-500">{cat.summary}</p>
                      </div>
                    ))}
                  </div>

                  {/* Strengths */}
                  {appraisal.strengths?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Strengths
                      </p>
                      <ul className="space-y-1">
                        {appraisal.strengths.map((s, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Improvements */}
                  {appraisal.improvements?.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Areas for Improvement
                      </p>
                      <ul className="space-y-1">
                        {appraisal.improvements.map((s, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommendation */}
                  {appraisal.recommendation && (
                    <div className="rounded-xl bg-purple-50 border border-purple-200 p-4">
                      <p className="text-xs font-semibold text-purple-700 mb-1">AI Recommendation</p>
                      <p className="text-sm text-purple-900">{appraisal.recommendation}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-600', purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600', indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 ${colorMap[color] || colorMap.blue}`}>{icon}</div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}
