'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Play, Square, CalendarCheck, Clock, Target, ClipboardList,
  CheckCircle, AlertCircle, TrendingUp, FileText, ChevronRight, Zap, MapPin,
} from 'lucide-react';

interface DashboardData {
  today: { id: string; status: string; check_in: string | null; check_out: string | null } | null;
  attendanceSummary: Record<string, number>;
  calendarData: Record<string, { status: string; check_in: string | null; check_out: string | null }>;
  pendingActions: { label: string; tab: string; urgent: boolean }[];
  stats: {
    presentDays: number; lateDays: number; absentDays: number; halfDays: number;
    onTimeRate: number; pendingLeave: number; openTasks: number; kpiCount: number;
    reportsThisMonth: number; payslipCount: number;
  };
  kpis: any[];
  recentReports: any[];
}

export function DashboardTab({ profile, onNavigate }: {
  profile: { name: string; email: string; jobTitle: string; role: string; departmentId: string; employmentType: string; hireDate: string; salary: number };
  onNavigate: (tab: string) => void;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/hr/employees/portal/dashboard');
      if (res.ok) {
        const fresh = await res.json();
        setData(prev => prev ? { ...fresh, today: fresh.today || prev.today } : fresh);
      }
    } catch { setError('Failed to load dashboard'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleQuickAction = async (action: 'check_in' | 'check_out') => {
    setActionLoading(true);
    setError(null); setSuccess(null);
    try {
      let location: { latitude: number; longitude: number } | null = null;
      if ('geolocation' in navigator) {
        location = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
        });
      }
      const res = await fetch('/api/hr/employees/portal/attendance/check-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, latitude: location?.latitude, longitude: location?.longitude }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setSuccess(action === 'check_in' ? 'Checked in!' : 'Checked out!'); fetchData(); }
      else {
        setError(d.error || 'Action failed');
        if (res.status === 400 && d.record) {
          setData(prev => prev ? { ...prev, today: d.record } : { today: d.record, attendanceSummary: {}, calendarData: {}, pendingActions: [], stats: { presentDays: 0, lateDays: 0, absentDays: 0, halfDays: 0, onTimeRate: 0, pendingLeave: 0, openTasks: 0, kpiCount: 0, reportsThisMonth: 0, payslipCount: 0 }, kpis: [], recentReports: [] });
        }
      }
    } catch { setError('Network error'); }
    finally { setActionLoading(false); }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div>;
  if (error && !data) return <div className="p-8 text-center text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const hasCheckedIn = !!data.today?.check_in;
  const hasCheckedOut = !!data.today?.check_out;
  const currentTime = now.toLocaleTimeString('en-US', { hour12: false });
  const firstName = profile.name.split(' ')[0];
  const fmtRole = (r: string) => r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Staff';

  // Mini calendar - current week
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDay = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - currentDay);

  return (
    <div className="space-y-6">
      {/* Welcome + Pending Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Welcome banner */}
        <div className="lg:col-span-2 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mb-8" />
          <div className="relative">
            <h2 className="text-2xl font-bold">Welcome back, {firstName}!</h2>
            <p className="text-blue-100 mt-1">{profile.jobTitle} &middot; {fmtRole(profile.role)}</p>
            <p className="text-blue-200 text-sm mt-3">{now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-blue-300 text-xs mt-1">Current time: {currentTime}</p>
          </div>
        </div>

        {/* Pending Actions */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">Action Items</h3>
          </div>
          {data.pendingActions.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
              <CheckCircle className="w-4 h-4 text-green-500" />
              All caught up!
            </div>
          ) : (
            <div className="space-y-2">
              {data.pendingActions.map((action, i) => (
                <button key={i} onClick={() => onNavigate(action.tab)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left transition-colors ${action.urgent ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${action.urgent ? 'bg-red-500' : 'bg-amber-500'}`} />
                  {action.label}
                  <ChevronRight className="w-3 h-3 ml-auto" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inline Attendance + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Inline check-in/out card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck className="w-5 h-5 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">Today&apos;s Attendance</h3>
          </div>
          {error && <div className="mb-3 text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</div>}
          {success && <div className="mb-3 text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{success}</div>}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Check In</span>
              <span className={`text-sm font-bold ${hasCheckedIn ? 'text-green-700' : 'text-gray-400'}`}>{data.today?.check_in || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Check Out</span>
              <span className={`text-sm font-bold ${hasCheckedOut ? 'text-blue-700' : 'text-gray-400'}`}>{data.today?.check_out || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Status</span>
              <span className="text-sm font-bold capitalize text-gray-700">{data.today?.status?.replace('_', ' ') || 'not recorded'}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => handleQuickAction('check_in')} disabled={actionLoading || hasCheckedIn}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Play className="w-3.5 h-3.5" />{hasCheckedIn ? 'Done' : 'Check In'}
            </button>
            <button onClick={() => handleQuickAction('check_out')} disabled={actionLoading || !hasCheckedIn || hasCheckedOut}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <Square className="w-3.5 h-3.5" />{hasCheckedOut ? 'Done' : 'Check Out'}
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatWidget icon={<CheckCircle className="w-4 h-4" />} label="Present" value={data.stats.presentDays} color="green" />
          <StatWidget icon={<Clock className="w-4 h-4" />} label="Late" value={data.stats.lateDays} color="amber" />
          <StatWidget icon={<TrendingUp className="w-4 h-4" />} label="On-Time Rate" value={`${data.stats.onTimeRate}%`} color="blue" />
          <StatWidget icon={<Target className="w-4 h-4" />} label="Active KPIs" value={data.stats.kpiCount} color="purple" />
          <StatWidget icon={<FileText className="w-4 h-4" />} label="Reports (Month)" value={data.stats.reportsThisMonth} color="indigo" />
          <StatWidget icon={<ClipboardList className="w-4 h-4" />} label="Open Tasks" value={data.stats.openTasks} color="red" />
          <StatWidget icon={<CalendarCheck className="w-4 h-4" />} label="Half Days" value={data.stats.halfDays} color="cyan" />
          <StatWidget icon={<AlertCircle className="w-4 h-4" />} label="Pending Leave" value={data.stats.pendingLeave} color="orange" />
        </div>
      </div>

      {/* Mini Week Calendar + Recent Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mini calendar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">This Week</h3>
            <button onClick={() => onNavigate('attendance')} className="text-xs text-blue-600 font-medium hover:text-blue-700">View all →</button>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((day, i) => {
              const date = new Date(weekStart);
              date.setDate(weekStart.getDate() + i);
              const dateStr = date.toISOString().split("T")[0];
              const record = data.calendarData[dateStr];
              const isToday = dateStr === todayStr;
              const isFuture = date > now && !isToday;

              return (
                <div key={i} className="text-center">
                  <p className="text-xs text-gray-400 mb-1">{day}</p>
                  <div className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium relative
                    ${isToday ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
                    ${record?.status === 'present' ? 'bg-green-100 text-green-700' :
                      record?.status === 'late' ? 'bg-amber-100 text-amber-700' :
                      record?.status === 'half_day' ? 'bg-blue-100 text-blue-700' :
                      record?.status === 'absent' ? 'bg-red-100 text-red-700' :
                      isFuture ? 'bg-gray-50 text-gray-300' : 'bg-gray-50 text-gray-400'}`}
                  >
                    {date.getDate()}
                    {record?.check_in && <span className="text-[8px] mt-0.5 opacity-60">{record.check_in}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent reports */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Reports</h3>
            <button onClick={() => onNavigate('reports')} className="text-xs text-blue-600 font-medium hover:text-blue-700">View all →</button>
          </div>
          {data.recentReports.length === 0 ? (
            <div className="py-6 text-center">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400 mb-3">No reports submitted yet</p>
              <button onClick={() => onNavigate('reports')} className="text-xs text-blue-600 font-medium hover:text-blue-700">Submit your first report →</button>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentReports.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${r.status === 'approved' ? 'bg-green-500' : r.status === 'under_review' ? 'bg-blue-500' : r.status === 'needs_edit' ? 'bg-amber-500' : 'bg-gray-300'}`} />
                    <div>
                      <p className="text-xs font-medium text-gray-900">{r.title || `${r.report_type} report`}</p>
                      <p className="text-[10px] text-gray-400 capitalize">{r.report_type} &middot; {r.report_date}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium capitalize px-2 py-0.5 rounded-full ${r.status === 'approved' ? 'bg-green-100 text-green-700' : r.status === 'under_review' ? 'bg-blue-100 text-blue-700' : r.status === 'needs_edit' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {r.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Progress Overview */}
      {data.kpis.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-900">KPI Progress</h3>
            </div>
            <button onClick={() => onNavigate('reports')} className="text-xs text-blue-600 font-medium hover:text-blue-700">View details →</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.kpis.map((kpi: any) => (
              <div key={kpi.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                  ${kpi.status === 'completed' ? 'bg-green-100' : kpi.status === 'in_progress' ? 'bg-blue-100' : kpi.status === 'overdue' ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <Target className={`w-5 h-5 ${kpi.status === 'completed' ? 'text-green-600' : kpi.status === 'in_progress' ? 'text-blue-600' : kpi.status === 'overdue' ? 'text-red-600' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{kpi.title}</p>
                  <p className="text-[10px] text-gray-400 capitalize">{kpi.frequency || 'one-time'} {kpi.due_date && `· Due ${new Date(kpi.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}</p>
                </div>
                <span className={`text-[10px] font-medium capitalize px-2 py-0.5 rounded-full flex-shrink-0 ${kpi.status === 'completed' ? 'bg-green-100 text-green-700' : kpi.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : kpi.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                  {kpi.status?.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatWidget({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'bg-green-50 text-green-600', amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600', purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600', indigo: 'bg-indigo-50 text-indigo-600',
    cyan: 'bg-cyan-50 text-cyan-600', orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${colorMap[color] || colorMap.blue}`}>{icon}</div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[10px] text-gray-400">{label}</p>
    </div>
  );
}
