'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Sparkles, Target, FileText, Calendar, TrendingUp, TrendingDown,
  CheckCircle, AlertCircle, Award, ChevronRight, User, Brain, Settings,
  Share2, Download, History, Users, Flag, MessageSquare, BarChart3,
  ArrowUpRight, ArrowDownRight, Minus, Star, Plus, Trash2, Save, X,
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

interface AppraisalCategory {
  score: number;
  summary: string;
  metrics?: Record<string, number | string>;
}

interface Appraisal {
  id?: string;
  employeeId: string;
  overallScore: number;
  rating: string;
  categories: {
    kpiPerformance: AppraisalCategory;
    taskExecution: AppraisalCategory;
    reportQuality: AppraisalCategory;
    attendance: AppraisalCategory;
    consistency: AppraisalCategory;
    peerFeedback?: AppraisalCategory;
    goalAlignment?: AppraisalCategory;
  };
  strengths: string[];
  improvements: string[];
  recommendation: string;
  sentimentScore: number;
  anomalies: string[];
  trendDelta: number | null;
  previousScore: number | null;
  departmentAverage: number | null;
  percentileRank: number | null;
  generatedBy: string;
  generatedAt: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  metrics?: any;
  peerFeedback?: any;
  goalAlignment?: any;
}

interface HistoryItem {
  id: string;
  overallScore: number;
  rating: string;
  period: string;
  generatedAt: string;
  trendDelta: number | null;
  generatedBy: string;
}

interface PeerFeedback {
  id: string;
  reviewerName: string;
  reviewerRole: string;
  rating: number;
  collaborationScore?: number;
  communicationScore?: number;
  reliabilityScore?: number;
  strengths: string[];
  improvements: string[];
  comments: string;
  isAnonymous: boolean;
  createdAt: string;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  targetValue: number;
  actualValue: number;
  dueDate: string;
}

type TabType = 'appraisal' | 'history' | 'benchmark' | 'config' | 'feedback' | 'goals';

export function AppraisalTab({ profile }: { profile: EmployeeProfile }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [appraisalData, setAppraisalData] = useState<any>(null);
  const [appraisal, setAppraisal] = useState<Appraisal | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('appraisal');
  const [period, setPeriod] = useState<string>('monthly');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [peerFeedback, setPeerFeedback] = useState<PeerFeedback[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showShareToast, setShowShareToast] = useState(false);

  const employeeRole = (profile.role || 'staff').toLowerCase();
  const isHR = employeeRole === 'hr' || employeeRole === 'hr_admin' || employeeRole === 'hr_manager';

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
      const res = await fetch(`/api/hr/employees/portal/appraisal?employeeId=${empId}&period=${period}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAppraisalData(data);
        if (data.config) setConfig(data.config);
      } else {
        setError(data.error || 'Failed to load data');
      }
    } catch {
      setError('Network error');
    }
  };

  const loadHistory = async (empId: string) => {
    try {
      const res = await fetch(`/api/hr/employees/portal/appraisal?employeeId=${empId}&action=history`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setHistory(data.history || []);
    } catch {}
  };

  const loadBenchmark = async (empId: string) => {
    try {
      const res = await fetch(`/api/hr/employees/portal/appraisal?employeeId=${empId}&action=benchmark`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setBenchmark(data.benchmark);
    } catch {}
  };

  const loadPeerFeedback = async (empId: string) => {
    try {
      const res = await fetch(`/api/hr/employees/portal/peer-feedback?employeeId=${empId}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPeerFeedback(data.feedback || []);
    } catch {}
  };

  const loadGoals = async (empId: string) => {
    try {
      const res = await fetch(`/api/hr/employees/portal/goals?employeeId=${empId}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setGoals(data.goals || []);
    } catch {}
  };

  const handleSelect = (empId: string) => {
    setSelectedId(empId);
    setAppraisal(null);
    loadAppraisalData(empId);
    loadHistory(empId);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'history' && selectedId) loadHistory(selectedId);
    if (tab === 'benchmark' && selectedId) loadBenchmark(selectedId);
    if (tab === 'feedback' && selectedId) loadPeerFeedback(selectedId);
    if (tab === 'goals' && selectedId) loadGoals(selectedId);
    if (tab === 'config' && !config) {
      fetch(`/api/hr/employees/portal/appraisal?action=config`).then(r => r.json()).then(d => setConfig(d.config)).catch(() => {});
    }
  };

  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/appraisal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: selectedId, period, useAI: true, persist: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.appraisal) {
        setAppraisal(data.appraisal);
        loadHistory(selectedId);
      } else {
        setError(data.error || 'Failed to generate appraisal');
      }
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
    }
  };

  const handleShare = async () => {
    if (!appraisal?.id) return;
    try {
      await fetch('/api/hr/employees/portal/appraisal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'share', appraisalId: appraisal.id }),
      });
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 3000);
    } catch {}
  };

  const handleExportPDF = () => {
    if (!appraisal) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const emp = appraisalData?.employee;
    printWindow.document.write(generateAppraisalPDF(appraisal, emp));
    printWindow.document.close();
    printWindow.print();
  };

  const handleSaveConfig = async (newConfig: any) => {
    try {
      await fetch('/api/hr/employees/portal/appraisal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveConfig', ...newConfig }),
      });
      setConfig(newConfig);
    } catch {}
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

  const trendIcon = (delta: number | null) => {
    if (delta === null) return <Minus className="w-4 h-4 text-gray-400" />;
    if (delta > 0) return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    if (delta < 0) return <ArrowDownRight className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  const tabs = [
    { key: 'appraisal' as TabType, label: 'Appraisal', icon: Brain },
    { key: 'history' as TabType, label: 'History', icon: History },
    { key: 'benchmark' as TabType, label: 'Benchmark', icon: BarChart3 },
    { key: 'feedback' as TabType, label: 'Peer Feedback', icon: MessageSquare },
    { key: 'goals' as TabType, label: 'Goals/OKRs', icon: Flag },
    { key: 'config' as TabType, label: 'Config', icon: Settings, hrOnly: true },
  ].filter(t => !t.hrOnly || isHR);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-600" />
            AI Performance Appraisal
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Unified AI-driven performance analysis with KPI scoring, report quality, attendance, peer feedback & goal alignment</p>
        </div>
        {appraisal && (
          <div className="flex items-center gap-2">
            <button onClick={handleShare} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <Share2 className="w-4 h-4" /> Share
            </button>
            <button onClick={handleExportPDF} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        )}
      </div>

      {showShareToast && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> Appraisal shared with employee
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Select Employee</h3>
            <select value={period} onChange={(e) => { setPeriod(e.target.value); if (selectedId) loadAppraisalData(selectedId); }} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {employees.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No employees found</p>
            ) : employees.map(emp => (
              <button key={emp.id} onClick={() => handleSelect(emp.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors ${selectedId === emp.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'}`}>
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

        <div className="lg:col-span-2 space-y-4">
          {!selectedId ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">Select an employee to begin</p>
              <p className="text-xs text-gray-400 mt-1">AI appraisal uses KPIs, tasks, reports, attendance, peer feedback & goals</p>
            </div>
          ) : !appraisalData ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading employee data...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1 overflow-x-auto">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button key={tab.key} onClick={() => handleTabChange(tab.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'appraisal' && (
                <AppraisalContent appraisalData={appraisalData} appraisal={appraisal} generating={generating} onGenerate={handleGenerate} scoreColor={scoreColor} ratingColor={ratingColor} trendIcon={trendIcon} />
              )}
              {activeTab === 'history' && (
                <HistoryContent history={history} scoreColor={scoreColor} trendIcon={trendIcon} />
              )}
              {activeTab === 'benchmark' && (
                <BenchmarkContent benchmark={benchmark} appraisal={appraisal} scoreColor={scoreColor} onReload={() => loadBenchmark(selectedId)} />
              )}
              {activeTab === 'feedback' && (
                <PeerFeedbackContent feedback={peerFeedback} showForm={showFeedbackForm} setShowForm={setShowFeedbackForm} employeeId={selectedId} onSubmitted={() => { loadPeerFeedback(selectedId); setShowFeedbackForm(false); }} />
              )}
              {activeTab === 'goals' && (
                <GoalsContent goals={goals} showForm={showGoalForm} setShowForm={setShowGoalForm} employeeId={selectedId} onSubmitted={() => { loadGoals(selectedId); setShowGoalForm(false); }} />
              )}
              {activeTab === 'config' && isHR && (
                <ConfigContent config={config} onSave={handleSaveConfig} />
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

function QuickMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2">
      <p className="text-sm font-bold text-gray-700">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}

function SliderInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input type="range" min={1} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-purple-600 mt-1" />
      <p className="text-xs text-gray-500 text-center">{value}/100</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) {
  return (
    <div className="text-center py-8">
      <Icon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  );
}

function AppraisalContent({ appraisalData, appraisal, generating, onGenerate, scoreColor, ratingColor, trendIcon }: any) {
  const emp = appraisalData.employee;
  const tasks = appraisalData.tasks || [];
  const reports = appraisalData.reports || [];
  const attendance = appraisalData.attendance || [];
  const quickMetrics = appraisalData.quickMetrics;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-gray-900">{emp?.name}</h3>
            <p className="text-xs text-gray-500">{emp?.job_title} · {emp?.role}</p>
          </div>
          <button onClick={onGenerate} disabled={generating}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generating ? 'Generating...' : 'Generate Appraisal'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={<Target className="w-4 h-4" />} label="KPIs" value={tasks.filter((t: any) => t.is_kpi).length} color="purple" />
          <MetricCard icon={<CheckCircle className="w-4 h-4" />} label="Completed" value={tasks.filter((t: any) => t.status === 'completed').length} color="green" />
          <MetricCard icon={<FileText className="w-4 h-4" />} label="Reports" value={reports.length} color="blue" />
          <MetricCard icon={<Calendar className="w-4 h-4" />} label="Present" value={attendance.filter((a: any) => a.status === 'present').length} color="indigo" />
        </div>
        {quickMetrics && (
          <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
            <QuickMetric label="KPI Rate" value={`${quickMetrics.kpiCompletionRate}%`} />
            <QuickMetric label="Task Rate" value={`${quickMetrics.taskCompletionRate}%`} />
            <QuickMetric label="Approvals" value={`${quickMetrics.reportApprovalRate}%`} />
            <QuickMetric label="Coverage" value={`${quickMetrics.reportCoverage}%`} />
            <QuickMetric label="Attendance" value={`${quickMetrics.attendanceRate}%`} />
            <QuickMetric label="On-time" value={`${quickMetrics.onTimeSubmissionRate}%`} />
          </div>
        )}
      </div>

      {appraisal && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${scoreColor(appraisal.overallScore)}`}>
                <span className="text-2xl font-bold">{appraisal.overallScore}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Overall Score</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ratingColor(appraisal.rating)}`}>{appraisal.rating}</span>
                  {appraisal.trendDelta !== null && (
                    <span className={`flex items-center gap-0.5 text-xs font-medium ${appraisal.trendDelta > 0 ? 'text-green-600' : appraisal.trendDelta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {trendIcon(appraisal.trendDelta)} {appraisal.trendDelta > 0 ? '+' : ''}{appraisal.trendDelta} vs last
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${appraisal.generatedBy === 'hybrid' ? 'bg-purple-100 text-purple-700' : appraisal.generatedBy === 'ai' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {appraisal.generatedBy === 'hybrid' ? 'AI + Metrics' : appraisal.generatedBy === 'ai' ? 'AI' : 'Metrics Only'}
              </span>
              {appraisal.percentileRank !== null && <p className="text-xs text-gray-400 mt-1">Top {100 - appraisal.percentileRank}% in dept</p>}
            </div>
          </div>

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

          {appraisal.anomalies?.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Detected Anomalies</p>
              <ul className="space-y-1">
                {appraisal.anomalies.map((a: string, i: number) => (
                  <li key={i} className="text-xs text-amber-700 flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />{a}</li>
                ))}
              </ul>
            </div>
          )}

          {appraisal.strengths?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Strengths</p>
              <ul className="space-y-1">
                {appraisal.strengths.map((s: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />{s}</li>
                ))}
              </ul>
            </div>
          )}

          {appraisal.improvements?.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Areas for Improvement</p>
              <ul className="space-y-1">
                {appraisal.improvements.map((s: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />{s}</li>
                ))}
              </ul>
            </div>
          )}

          {appraisal.recommendation && (
            <div className="rounded-xl bg-purple-50 border border-purple-200 p-4">
              <p className="text-xs font-semibold text-purple-700 mb-1">AI Recommendation</p>
              <p className="text-sm text-purple-900">{appraisal.recommendation}</p>
            </div>
          )}

          {appraisal.peerFeedback && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
              <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1"><Users className="w-4 h-4" /> Peer Feedback Summary</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-bold text-blue-700">{appraisal.peerFeedback.averageRating}/5</p><p className="text-[10px] text-gray-400">Avg Rating</p></div>
                <div><p className="text-lg font-bold text-blue-700">{appraisal.peerFeedback.collaborationScore}</p><p className="text-[10px] text-gray-400">Collaboration</p></div>
                <div><p className="text-lg font-bold text-blue-700">{appraisal.peerFeedback.reliabilityScore}</p><p className="text-[10px] text-gray-400">Reliability</p></div>
              </div>
            </div>
          )}

          {appraisal.goalAlignment && (
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-2 flex items-center gap-1"><Flag className="w-4 h-4" /> Goal Alignment</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-lg font-bold text-indigo-700">{appraisal.goalAlignment.achievedGoals}</p><p className="text-[10px] text-gray-400">Achieved</p></div>
                <div><p className="text-lg font-bold text-indigo-700">{appraisal.goalAlignment.inProgressGoals}</p><p className="text-[10px] text-gray-400">In Progress</p></div>
                <div><p className="text-lg font-bold text-indigo-700">{appraisal.goalAlignment.goalCompletionRate}%</p><p className="text-[10px] text-gray-400">Completion</p></div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryContent({ history, scoreColor, trendIcon }: any) {
  if (history.length === 0) {
    return <div className="bg-white rounded-2xl border border-gray-200 p-5"><EmptyState icon={History} title="No appraisal history" subtitle="Generate an appraisal to start tracking performance over time" /></div>;
  }
  const scores = history.map((h: HistoryItem) => h.overallScore).reverse();
  const maxScore = Math.max(...scores, 100);
  const minScore = Math.min(...scores, 0);
  const range = maxScore - minScore || 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><History className="w-4 h-4 text-purple-600" /> Appraisal History ({history.length})</h3>
      {scores.length >= 2 && (
        <div className="relative h-32 flex items-end gap-2 px-2">
          {scores.map((score: number, i: number) => {
            const heightPct = ((score - minScore) / range) * 80 + 20;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <span className="text-[10px] font-medium text-gray-600 mb-1">{score}</span>
                <div className={`w-full rounded-t-md ${score >= 80 ? 'bg-green-400' : score >= 60 ? 'bg-blue-400' : score >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ height: `${heightPct}%` }} />
              </div>
            );
          })}
        </div>
      )}
      <div className="space-y-2">
        {history.map((item: HistoryItem) => (
          <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${scoreColor(item.overallScore)}`}><span className="text-sm font-bold">{item.overallScore}</span></div>
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">{item.period}</p>
                <p className="text-xs text-gray-400">{new Date(item.generatedAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-600">{item.rating}</span>
              {item.trendDelta !== null && (
                <span className={`flex items-center gap-0.5 text-xs ${item.trendDelta > 0 ? 'text-green-600' : item.trendDelta < 0 ? 'text-red-600' : 'text-gray-400'}`}>{trendIcon(item.trendDelta)}{item.trendDelta > 0 ? '+' : ''}{item.trendDelta}</span>
              )}
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${item.generatedBy === 'hybrid' ? 'bg-purple-100 text-purple-600' : item.generatedBy === 'ai' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{item.generatedBy}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BenchmarkContent({ benchmark, appraisal, scoreColor, onReload }: any) {
  if (!benchmark) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <EmptyState icon={BarChart3} title="No benchmark data" subtitle="Generate appraisals for department members to see benchmarks" />
        <button onClick={onReload} className="mt-3 text-sm text-blue-600 hover:underline">Retry</button>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-purple-600" /> Department Benchmark</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 p-3 text-center"><p className="text-2xl font-bold text-gray-900">{benchmark.departmentAverage ?? '—'}</p><p className="text-xs text-gray-400">Dept Average</p></div>
        <div className="rounded-xl border border-gray-200 p-3 text-center"><p className="text-2xl font-bold text-gray-900">{benchmark.percentileRank !== null ? `${benchmark.percentileRank}%` : '—'}</p><p className="text-xs text-gray-400">Percentile Rank</p></div>
        <div className="rounded-xl border border-gray-200 p-3 text-center"><p className="text-2xl font-bold text-gray-900">{benchmark.peerCount}</p><p className="text-xs text-gray-400">Peers</p></div>
      </div>
      {benchmark.peerScores?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Peer Comparison</p>
          {benchmark.peerScores.map((peer: any) => (
            <div key={peer.employeeId} className="flex items-center gap-3 p-2 rounded-lg border border-gray-100">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${scoreColor(peer.score)}`}><span className="text-xs font-bold">{peer.score}</span></div>
              <span className="text-sm text-gray-700 flex-1">Employee</span>
              <span className="text-xs text-gray-400">{peer.rating}</span>
            </div>
          ))}
        </div>
      )}
      {appraisal && benchmark.departmentAverage !== null && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 p-4">
          <p className="text-xs font-semibold text-purple-700 mb-2">You vs Department</p>
          <div className="flex items-center gap-4">
            <div className="text-center"><p className="text-3xl font-bold text-purple-700">{appraisal.overallScore}</p><p className="text-[10px] text-gray-400">Your Score</p></div>
            <div className="text-2xl text-gray-300">vs</div>
            <div className="text-center"><p className="text-3xl font-bold text-gray-500">{benchmark.departmentAverage}</p><p className="text-[10px] text-gray-400">Dept Average</p></div>
            <div className="ml-auto text-right">
              <p className={`text-2xl font-bold ${appraisal.overallScore > benchmark.departmentAverage ? 'text-green-600' : 'text-red-600'}`}>{appraisal.overallScore > benchmark.departmentAverage ? '+' : ''}{appraisal.overallScore - benchmark.departmentAverage}</p>
              <p className="text-[10px] text-gray-400">Difference</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PeerFeedbackContent({ feedback, showForm, setShowForm, employeeId, onSubmitted }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-purple-600" /> Peer Feedback ({feedback.length})</h3>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"><Plus className="w-4 h-4" /> Add Review</button>
      </div>
      {showForm && <PeerFeedbackForm employeeId={employeeId} onSubmitted={onSubmitted} onCancel={() => setShowForm(false)} />}
      {feedback.length === 0 && !showForm ? (
        <EmptyState icon={MessageSquare} title="No peer feedback yet" subtitle="Submit a review to contribute to 360-degree feedback" />
      ) : (
        <div className="space-y-3">
          {feedback.map((fb: PeerFeedback) => (
            <div key={fb.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (<Star key={i} className={`w-3.5 h-3.5 ${i <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />))}
                  </div>
                  <span className="text-xs text-gray-500">{fb.isAnonymous ? 'Anonymous' : fb.reviewerName || 'Reviewer'} · {fb.reviewerRole}</span>
                </div>
                <span className="text-xs text-gray-400">{new Date(fb.createdAt).toLocaleDateString()}</span>
              </div>
              {fb.comments && <p className="text-sm text-gray-600 mb-2">{fb.comments}</p>}
              {fb.strengths?.length > 0 && (<div className="flex flex-wrap gap-1 mb-1">{fb.strengths.map((s, i) => (<span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">{s}</span>))}</div>)}
              {fb.improvements?.length > 0 && (<div className="flex flex-wrap gap-1">{fb.improvements.map((s, i) => (<span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{s}</span>))}</div>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PeerFeedbackForm({ employeeId, onSubmitted, onCancel }: any) {
  const [rating, setRating] = useState(4);
  const [collaboration, setCollaboration] = useState(80);
  const [communication, setCommunication] = useState(80);
  const [reliability, setReliability] = useState(80);
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [comments, setComments] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/hr/employees/portal/peer-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId, rating, collaborationScore: collaboration, communicationScore: communication, reliabilityScore: reliability,
          strengths: strengths.split(',').map((s) => s.trim()).filter(Boolean),
          improvements: improvements.split(',').map((s) => s.trim()).filter(Boolean),
          comments, isAnonymous,
        }),
      });
      onSubmitted();
    } catch {} finally { setSubmitting(false); }
  };

  return (
    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-purple-900">Peer Review</h4>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Overall Rating</label>
        <div className="flex items-center gap-1 mt-1">
          {[1, 2, 3, 4, 5].map(i => (<button key={i} onClick={() => setRating(i)}><Star className={`w-6 h-6 ${i <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} /></button>))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <SliderInput label="Collaboration" value={collaboration} onChange={setCollaboration} />
        <SliderInput label="Communication" value={communication} onChange={setCommunication} />
        <SliderInput label="Reliability" value={reliability} onChange={setReliability} />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Strengths (comma-separated)</label>
        <input value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="e.g., Team player, Problem solver" className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Areas for Improvement (comma-separated)</label>
        <input value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="e.g., Time management, Documentation" className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600">Comments</label>
        <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={3} className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} /> Submit anonymously</label>
      <button onClick={handleSubmit} disabled={submitting} className="w-full py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit Review'}</button>
    </div>
  );
}

function GoalsContent({ goals, showForm, setShowForm, employeeId, onSubmitted }: any) {
  const [newGoal, setNewGoal] = useState({ title: '', description: '', priority: 'medium', dueDate: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newGoal.title) return;
    setSubmitting(true);
    try {
      await fetch('/api/hr/employees/portal/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, ...newGoal }),
      });
      setNewGoal({ title: '', description: '', priority: 'medium', dueDate: '' });
      onSubmitted();
    } catch {} finally { setSubmitting(false); }
  };

  const handleStatusUpdate = async (goalId: string, status: string) => {
    await fetch('/api/hr/employees/portal/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId, status }),
    });
    onSubmitted();
  };

  const statusColors: Record<string, string> = {
    not_started: 'bg-gray-100 text-gray-600', in_progress: 'bg-blue-100 text-blue-700',
    on_track: 'bg-green-100 text-green-700', ahead: 'bg-emerald-100 text-emerald-700',
    behind: 'bg-amber-100 text-amber-700', achieved: 'bg-green-200 text-green-800',
    completed: 'bg-green-200 text-green-800', cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Flag className="w-4 h-4 text-purple-600" /> Goals & OKRs ({goals.length})</h3>
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"><Plus className="w-4 h-4" /> Add Goal</button>
      </div>
      {showForm && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
          <input value={newGoal.title} onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })} placeholder="Goal title (e.g., Increase sales by 20%)" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          <textarea value={newGoal.description} onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })} placeholder="Description..." rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            <select value={newGoal.priority} onChange={(e) => setNewGoal({ ...newGoal, priority: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
              <option value="low">Low Priority</option><option value="medium">Medium Priority</option><option value="high">High Priority</option><option value="critical">Critical</option>
            </select>
            <input type="date" value={newGoal.dueDate} onChange={(e) => setNewGoal({ ...newGoal, dueDate: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleSubmit} disabled={submitting || !newGoal.title} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">{submitting ? 'Creating...' : 'Create Goal'}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}
      {goals.length === 0 && !showForm ? (
        <EmptyState icon={Flag} title="No goals set" subtitle="Create goals or OKRs to track and align with performance" />
      ) : (
        <div className="space-y-2">
          {goals.map((goal: Goal) => (
            <div key={goal.id} className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-900">{goal.title}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[goal.status] || 'bg-gray-100'}`}>{goal.status.replace(/_/g, ' ')}</span>
              </div>
              {goal.description && <p className="text-xs text-gray-500 mb-2">{goal.description}</p>}
              <div className="flex items-center gap-3">
                {goal.targetValue > 0 && (
                  <div className="flex-1">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, (goal.actualValue / goal.targetValue) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{goal.actualValue}/{goal.targetValue}</p>
                  </div>
                )}
                <select value={goal.status} onChange={(e) => handleStatusUpdate(goal.id, e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
                  <option value="not_started">Not Started</option><option value="in_progress">In Progress</option><option value="on_track">On Track</option>
                  <option value="ahead">Ahead</option><option value="behind">Behind</option><option value="achieved">Achieved</option>
                  <option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigContent({ config, onSave }: any) {
  const [weights, setWeights] = useState({ kpiPerformance: 30, taskExecution: 20, reportQuality: 20, attendance: 10, consistency: 10, peerFeedback: 5, goalAlignment: 5 });
  const [useAI, setUseAI] = useState(true);
  const [autoGenerate, setAutoGenerate] = useState(false);
  const [autoGenerateFrequency, setAutoGenerateFrequency] = useState('monthly');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      if (config.weights) setWeights({ ...weights, ...config.weights });
      setUseAI(config.useAI ?? true);
      setAutoGenerate(config.autoGenerate ?? false);
      setAutoGenerateFrequency(config.autoGenerateFrequency || 'monthly');
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ weights, useAI, autoGenerate, autoGenerateFrequency });
    setSaving(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Settings className="w-4 h-4 text-purple-600" /> Appraisal Configuration</h3>
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-3">Category Weights (should total 100)</p>
        <div className="space-y-3">
          {Object.entries(weights).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <label className="text-xs text-gray-600 w-32 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
              <input type="range" min={0} max={50} value={value as number} onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })} className="flex-1 accent-purple-600" />
              <span className="text-xs font-medium text-gray-700 w-8 text-right">{value}%</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Total: {Object.values(weights).reduce((a, b) => a + (b as number), 0)}%</p>
      </div>
      <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200">
        <div><p className="text-sm font-medium text-gray-900">Use AI Enhancement</p><p className="text-xs text-gray-400">Uses Groq AI for qualitative analysis on top of deterministic metrics</p></div>
        <button onClick={() => setUseAI(!useAI)} className={`relative w-11 h-6 rounded-full transition-colors ${useAI ? 'bg-purple-600' : 'bg-gray-200'}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${useAI ? 'translate-x-5' : ''}`} /></button>
      </div>
      <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200">
        <div><p className="text-sm font-medium text-gray-900">Auto-Generate Appraisals</p><p className="text-xs text-gray-400">Automatically generate appraisals for all active employees</p></div>
        <button onClick={() => setAutoGenerate(!autoGenerate)} className={`relative w-11 h-6 rounded-full transition-colors ${autoGenerate ? 'bg-purple-600' : 'bg-gray-200'}`}><span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${autoGenerate ? 'translate-x-5' : ''}`} /></button>
      </div>
      {autoGenerate && (
        <select value={autoGenerateFrequency} onChange={(e) => setAutoGenerateFrequency(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option>
        </select>
      )}
      <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Saving...' : 'Save Configuration'}
      </button>
    </div>
  );
}

function generateAppraisalPDF(appraisal: Appraisal, emp: any): string {
  const categories = Object.entries(appraisal.categories)
    .map(([key, cat]: [string, any]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;text-transform:capitalize">${key.replace(/([A-Z])/g, ' $1').trim()}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:bold">${cat.score}</td><td style="padding:8px;border-bottom:1px solid #eee;font-size:13px">${cat.summary}</td></tr>`)
    .join('');
  return `<!DOCTYPE html><html><head><title>Performance Appraisal — ${emp?.name || 'Employee'}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#333}h1{color:#4A154B}table{width:100%;border-collapse:collapse;margin:15px 0}th{background:#f5f5f5;padding:8px;text-align:left}.score{font-size:48px;font-weight:bold;color:${appraisal.overallScore >= 80 ? '#16a34a' : appraisal.overallScore >= 60 ? '#2563eb' : appraisal.overallScore >= 40 ? '#d97706' : '#dc2626'}}.rating{display:inline-block;padding:4px 12px;border-radius:20px;background:#f0e7f0;color:#4A154B;font-weight:bold}.section{margin:20px 0;padding:15px;background:#fafafa;border-radius:8px}ul{padding-left:20px}li{margin:4px 0}</style></head><body><h1>Performance Appraisal Report</h1><p><strong>Employee:</strong> ${emp?.name || 'N/A'} · ${emp?.job_title || 'Staff'}<br/><strong>Period:</strong> ${appraisal.period} (${new Date(appraisal.periodStart).toLocaleDateString()} — ${new Date(appraisal.periodEnd).toLocaleDateString()})<br/><strong>Generated:</strong> ${new Date(appraisal.generatedAt).toLocaleDateString()} · ${appraisal.generatedBy}</p><div style="text-align:center;margin:30px 0"><div class="score">${appraisal.overallScore}</div><div class="rating">${appraisal.rating}</div>${appraisal.trendDelta !== null ? `<p style="color:${appraisal.trendDelta > 0 ? '#16a34a' : '#dc2626'}">Trend: ${appraisal.trendDelta > 0 ? '+' : ''}${appraisal.trendDelta} vs previous</p>` : ''}</div><table><thead><tr><th>Category</th><th style="text-align:center">Score</th><th>Summary</th></tr></thead><tbody>${categories}</tbody></table><div class="section"><strong>Strengths</strong><ul>${appraisal.strengths.map((s: string) => `<li>${s}</li>`).join('')}</ul></div><div class="section"><strong>Areas for Improvement</strong><ul>${appraisal.improvements.map((s: string) => `<li>${s}</li>`).join('')}</ul></div><div class="section"><strong>Recommendation</strong><p>${appraisal.recommendation}</p></div>${appraisal.anomalies.length > 0 ? `<div class="section" style="background:#fff7ed"><strong>Anomalies Detected</strong><ul>${appraisal.anomalies.map((a: string) => `<li>${a}</li>`).join('')}</ul></div>` : ''}</body></html>`;
}
