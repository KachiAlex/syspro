'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Target, FileText, CheckCircle, AlertCircle, TrendingUp, X } from 'lucide-react';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

interface KpiTask {
  id: string; title: string; description: string | null;
  expected_outcome: string | null; weight: number; is_kpi: boolean;
  frequency: string | null; due_date: string | null; status: string;
}

interface Report {
  id: string; title: string | null; report_type: string; report_date: string;
  objectives: string; achievements: string; challenges: string | null;
  next_steps: string | null; status: string; hod_comment: string | null;
  submitted_at: string;
}

interface KpiMetric {
  name: string; target: string; actual: string; unit: string; status: string;
}

export function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [kpis, setKpis] = useState<KpiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<ReportType | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterType !== 'all' ? `/api/hr/employees/portal/reports?type=${filterType}` : '/api/hr/employees/portal/reports';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
        setKpis(data.kpis || []);
      }
    } catch {
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const reportTypes: { value: ReportType | 'all'; label: string }[] = [
    { value: 'all', label: 'All Reports' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'annual', label: 'Annual' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Overview */}
      {kpis.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-semibold text-gray-900">My KPIs</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {kpis.map((k) => (
              <div key={k.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{k.title}</span>
                      {k.frequency && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 capitalize">{k.frequency}</span>}
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${k.status==='completed'?'bg-green-100 text-green-800':k.status==='in_progress'?'bg-blue-100 text-blue-800':k.status==='overdue'?'bg-red-100 text-red-800':'bg-gray-100 text-gray-600'}`}>{k.status?.replace('_',' ')}</span>
                    </div>
                    {k.description && <p className="text-xs text-gray-600 mt-1">{k.description}</p>}
                    {k.expected_outcome && <p className="text-xs text-purple-600 mt-1">Expected: {k.expected_outcome}</p>}
                  </div>
                  {k.due_date && <span className="text-xs text-gray-400 whitespace-nowrap ml-4">Due: {fmtDate(k.due_date)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-sm font-semibold text-gray-900">My Reports</h3>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />Submit Report
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 flex-wrap">
          {reportTypes.map((rt) => (
            <button key={rt.value} onClick={() => setFilterType(rt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterType === rt.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {rt.label}
            </button>
          ))}
        </div>

        {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>}
        {success && <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700"><CheckCircle className="w-4 h-4" />{success}</div>}

        {loading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div> : reports.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-500">No reports submitted yet. Click &quot;Submit Report&quot; to file one.</div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{r.title || `${r.report_type} report`}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{r.report_type}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${r.status==='approved'?'bg-green-100 text-green-800':r.status==='under_review'?'bg-blue-100 text-blue-800':r.status==='needs_edit'?'bg-amber-100 text-amber-800':'bg-gray-100 text-gray-600'}`}>{r.status.replace('_',' ')}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">For: {r.report_date} &middot; Submitted: {fmtDate(r.submitted_at)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <div><p className="text-xs font-semibold text-gray-700">Objectives</p><p className="text-xs text-gray-600 mt-0.5">{r.objectives}</p></div>
                  <div><p className="text-xs font-semibold text-gray-700">Achievements</p><p className="text-xs text-gray-600 mt-0.5">{r.achievements}</p></div>
                  {r.challenges && <div><p className="text-xs font-semibold text-gray-700">Challenges</p><p className="text-xs text-gray-600 mt-0.5">{r.challenges}</p></div>}
                  {r.next_steps && <div><p className="text-xs font-semibold text-gray-700">Next Steps</p><p className="text-xs text-gray-600 mt-0.5">{r.next_steps}</p></div>}
                </div>
                {r.hod_comment && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2"><p className="text-xs font-semibold text-amber-700">HOD Comment:</p><p className="text-xs text-amber-600 mt-0.5">{r.hod_comment}</p></div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report form modal */}
      {showForm && <ReportFormModal kpis={kpis} onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); setSuccess('Report submitted successfully!'); fetchData(); }} />}
    </div>
  );
}

function ReportFormModal({ kpis, onClose, onSuccess }: { kpis: KpiTask[]; onClose: () => void; onSuccess: () => void }) {
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [objectives, setObjectives] = useState('');
  const [achievements, setAchievements] = useState('');
  const [challenges, setChallenges] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [meetings, setMeetings] = useState('');
  const [blockers, setBlockers] = useState('');
  const [activities, setActivities] = useState('');
  const [kpiMetrics, setKpiMetrics] = useState<KpiMetric[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate KPI metrics from assigned KPIs
  useEffect(() => {
    if (kpis.length > 0 && kpiMetrics.length === 0) {
      setKpiMetrics(kpis.map(k => ({
        name: k.title,
        target: k.expected_outcome || '',
        actual: '',
        unit: '',
        status: 'not_started',
      })));
    }
  }, [kpis]);

  const addKpiMetric = () => setKpiMetrics([...kpiMetrics, { name: '', target: '', actual: '', unit: '', status: 'not_started' }]);
  const removeKpiMetric = (idx: number) => setKpiMetrics(kpiMetrics.filter((_, i) => i !== idx));
  const updateKpiMetric = (idx: number, field: keyof KpiMetric, value: string) => {
    setKpiMetrics(kpiMetrics.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objectives || !achievements || !reportDate) { setError('Objectives and achievements are required'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportType, reportDate, title, objectives, achievements, challenges, nextSteps, additionalNotes, meetings, blockers, activities, kpiMetrics }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { onSuccess(); }
      else { setError(data.error || 'Failed to submit report'); }
    } catch { setError('Network error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-sm font-semibold text-gray-900">Submit KPI Report</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Report Type *</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Report Date *</label>
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Title (optional)</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 30 Summary Report" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Objectives *</label>
            <textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} required rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="What were your objectives for this period?" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Achievements *</label>
            <textarea value={achievements} onChange={(e) => setAchievements(e.target.value)} required rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="What did you achieve during this period?" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Challenges</label>
              <textarea value={challenges} onChange={(e) => setChallenges(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="Any challenges faced?" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Next Steps</label>
              <textarea value={nextSteps} onChange={(e) => setNextSteps(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="What are your next steps?" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Meetings</label>
              <textarea value={meetings} onChange={(e) => setMeetings(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="Meetings attended?" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Blockers</label>
              <textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="Any blockers?" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Activities</label>
              <textarea value={activities} onChange={(e) => setActivities(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="Key activities?" />
            </div>
          </div>

          {/* KPI Metrics */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <label className="text-xs font-semibold text-gray-700">KPI Metrics</label>
              </div>
              <button type="button" onClick={addKpiMetric} className="text-xs text-blue-600 font-medium hover:text-blue-700">+ Add metric</button>
            </div>
            {kpiMetrics.length === 0 ? (
              <p className="text-xs text-gray-400">No KPI metrics. Click &quot;Add metric&quot; to track progress against your KPIs.</p>
            ) : (
              <div className="space-y-2">
                {kpiMetrics.map((m, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                    <input type="text" value={m.name} onChange={(e) => updateKpiMetric(idx, 'name', e.target.value)} placeholder="KPI name" className="col-span-4 border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    <input type="text" value={m.target} onChange={(e) => updateKpiMetric(idx, 'target', e.target.value)} placeholder="Target" className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    <input type="text" value={m.actual} onChange={(e) => updateKpiMetric(idx, 'actual', e.target.value)} placeholder="Actual" className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    <select value={m.status} onChange={(e) => updateKpiMetric(idx, 'status', e.target.value)} className="col-span-1 border border-gray-300 rounded-lg px-1 py-1.5 text-xs outline-none">
                      <option value="not_started">—</option>
                      <option value="on_track">On Track</option>
                      <option value="ahead">Ahead</option>
                      <option value="behind">Behind</option>
                    </select>
                    <button type="button" onClick={() => removeKpiMetric(idx)} className="col-span-1 p-1.5 text-gray-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Additional Notes</label>
            <textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="Any additional notes..." />
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-200">
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Submit Report
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
