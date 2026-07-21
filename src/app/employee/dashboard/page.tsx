'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Mail, Briefcase, Building, Calendar, DollarSign, Clock,
  LogOut, Loader2, AlertCircle, FileText, CalendarCheck, ClipboardList,
  CheckCircle, Plus, Target, Menu,
} from 'lucide-react';
import { AttendanceTab } from './tabs/AttendanceTab';
import { ReportsTab } from './tabs/ReportsTab';

interface EmployeeProfile {
  id: string; name: string; email: string; jobTitle: string; role: string;
  departmentId: string; employmentType: string; status: string;
  hireDate: string; salary: number; lastLogin: string;
}

interface Payslip {
  id: string; period: string; base_salary: number; transport_allowance: number;
  housing_allowance: number; meal_allowance: number; bonus: number; tax: number;
  pension: number; health_insurance: number; other_deductions: number;
  net_pay: number; status: string;
}

interface LeaveRequest {
  id: string; leave_type: string; start_date: string; end_date: string;
  reason: string; status: string; created_at: string; reviewer_comment: string | null;
}

interface Task {
  id: string; title: string; description: string | null; due_date: string | null;
  status: string; priority: string | null; assigned_by: string | null;
}

type Tab = 'overview' | 'attendance' | 'reports' | 'payslips' | 'leave' | 'tasks';

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/hr/employees/me');
        if (res.status === 401) { router.replace('/login'); return; }
        if (!res.ok) { setError('Failed to load profile'); return; }
        const data = await res.json();
        setProfile(data.employee);
      } catch { setError('Network error'); }
      finally { setLoading(false); }
    })();
  }, [router]);

  const loadTabData = useCallback(async (tab: Tab) => {
    setDataLoading(true);
    try {
      if (tab === 'payslips') {
        const res = await fetch('/api/hr/employees/portal/payslips');
        if (res.ok) { const d = await res.json(); setPayslips(d.payslips || []); }
      } else if (tab === 'leave') {
        const res = await fetch('/api/hr/employees/portal/leave');
        if (res.ok) { const d = await res.json(); setLeaveRequests(d.requests || []); }
      } else if (tab === 'tasks') {
        const res = await fetch('/api/hr/employees/portal/tasks');
        if (res.ok) { const d = await res.json(); setTasks(d.tasks || []); }
      }
    } catch {} finally { setDataLoading(false); }
  }, []);

  useEffect(() => {
    if (profile && (activeTab === 'payslips' || activeTab === 'leave' || activeTab === 'tasks')) {
      loadTabData(activeTab);
    }
  }, [activeTab, profile, loadTabData]);

  const handleLogout = async () => {
    await fetch('/api/hr/employees/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-center"><AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" /><p className="text-gray-700">{error}</p><button onClick={() => router.replace('/login')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Back to login</button></div></div>;
  if (!profile) return null;

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const fmtSalary = (s: number) => s ? `$${Number(s).toLocaleString()}` : '—';
  const fmtRole = (r: string) => r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Staff';
  const fmtMoney = (n: number) => n ? `$${Number(n).toLocaleString()}` : '$0';

  const navItems: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <User className="w-5 h-5" /> },
    { key: 'attendance', label: 'Attendance', icon: <CalendarCheck className="w-5 h-5" /> },
    { key: 'reports', label: 'KPI Reports', icon: <Target className="w-5 h-5" /> },
    { key: 'payslips', label: 'Payslips', icon: <FileText className="w-5 h-5" /> },
    { key: 'leave', label: 'Leave Requests', icon: <ClipboardList className="w-5 h-5" /> },
    { key: 'tasks', label: 'My Tasks', icon: <CheckCircle className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-30 h-screen w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate">Employee Portal</h1>
              <p className="text-xs text-slate-400 truncate">{profile.name}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button key={item.key} onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === item.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-700">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-red-600 hover:text-white transition-colors">
            <LogOut className="w-5 h-5" />Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100"><Menu className="w-5 h-5" /></button>
          <span className="text-sm font-semibold text-gray-900">Employee Portal</span>
          <div className="w-9" />
        </header>

        <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
          {activeTab === 'overview' && (<>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
              <h2 className="text-2xl font-bold">Welcome, {profile.name.split(' ')[0]}!</h2>
              <p className="text-blue-100 mt-1">{profile.jobTitle} &middot; {fmtRole(profile.role)}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoCard icon={<Mail className="w-5 h-5 text-blue-600" />} label="Email" value={profile.email} />
              <InfoCard icon={<Briefcase className="w-5 h-5 text-blue-600" />} label="Job Title" value={profile.jobTitle || '—'} />
              <InfoCard icon={<Building className="w-5 h-5 text-blue-600" />} label="Department" value={profile.departmentId || '—'} />
              <InfoCard icon={<Calendar className="w-5 h-5 text-blue-600" />} label="Hire Date" value={fmtDate(profile.hireDate)} />
              <InfoCard icon={<DollarSign className="w-5 h-5 text-blue-600" />} label="Salary" value={fmtSalary(profile.salary)} />
              <InfoCard icon={<Clock className="w-5 h-5 text-blue-600" />} label="Employment Type" value={profile.employmentType || 'Full-time'} />
            </div>
            {profile.lastLogin && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />Last login: {new Date(profile.lastLogin).toLocaleString()}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard icon={<CalendarCheck className="w-5 h-5 text-green-600" />} label="Mark Attendance" value="Check In" hint="Record today →" onClick={() => setActiveTab('attendance')} />
              <StatCard icon={<Target className="w-5 h-5 text-purple-600" />} label="Submit Report" value="KPI" hint="File a report →" onClick={() => setActiveTab('reports')} />
              <StatCard icon={<ClipboardList className="w-5 h-5 text-amber-600" />} label="Leave Requests" value={leaveRequests.filter(r => r.status === 'pending').length || '0'} hint="Pending approvals" onClick={() => setActiveTab('leave')} />
            </div>
          </>)}

          {activeTab === 'attendance' && <AttendanceTab />}

          {activeTab === 'reports' && <ReportsTab />}

          {activeTab === 'payslips' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">Payslip History</h3></div>
              {dataLoading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div> : payslips.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">No payslips available yet.</div> : (
                <div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead className="bg-gray-50 border-b border-gray-200"><tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Period</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">Gross</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">Deductions</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">Net Pay</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900 whitespace-nowrap">Status</th>
                </tr></thead><tbody className="divide-y divide-gray-200">{payslips.map((p) => {
                  const gross = (p.base_salary||0)+(p.transport_allowance||0)+(p.housing_allowance||0)+(p.meal_allowance||0)+(p.bonus||0);
                  const ded = (p.tax||0)+(p.pension||0)+(p.health_insurance||0)+(p.other_deductions||0);
                  return (<tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{p.period}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right whitespace-nowrap">{fmtMoney(gross)}</td>
                    <td className="px-4 py-3 text-sm text-red-600 text-right whitespace-nowrap">-{fmtMoney(ded)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-700 text-right whitespace-nowrap">{fmtMoney(p.net_pay)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.status==='paid'?'bg-green-100 text-green-800':p.status==='processed'?'bg-blue-100 text-blue-800':'bg-gray-100 text-gray-600'}`}>{p.status}</span></td>
                  </tr>);
                })}</tbody></table></div>
              )}
            </div>
          )}

          {activeTab === 'leave' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900">Leave Requests</h3><button onClick={() => setShowLeaveForm(!showLeaveForm)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4" />Request Leave</button></div>
              {showLeaveForm && (<LeaveRequestForm onSubmit={async (data) => { const res = await fetch('/api/hr/employees/portal/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (res.ok) { setShowLeaveForm(false); loadTabData('leave'); } }} onCancel={() => setShowLeaveForm(false)} />)}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {dataLoading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div> : leaveRequests.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">No leave requests submitted.</div> : (
                  <div className="divide-y divide-gray-200">{leaveRequests.map((lr) => (<div key={lr.id} className="p-4 hover:bg-gray-50"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-900 capitalize">{lr.leave_type} Leave</span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${lr.status==='approved'?'bg-green-100 text-green-800':lr.status==='rejected'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}`}>{lr.status}</span></div><p className="text-xs text-gray-500 mt-1">{fmtDate(lr.start_date)} — {fmtDate(lr.end_date)}</p><p className="text-xs text-gray-600 mt-1">{lr.reason}</p>{lr.reviewer_comment && <p className="text-xs text-gray-500 mt-1 italic">Reviewer: {lr.reviewer_comment}</p>}</div><span className="text-xs text-gray-400">{fmtDate(lr.created_at)}</span></div></div>))}</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">My Tasks</h3></div>
              {dataLoading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div> : tasks.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">No tasks assigned to you.</div> : (
                <div className="divide-y divide-gray-200">{tasks.map((t) => (<div key={t.id} className="p-4 hover:bg-gray-50"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-900">{t.title}</span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.status==='completed'?'bg-green-100 text-green-800':t.status==='in_progress'?'bg-blue-100 text-blue-800':t.status==='overdue'?'bg-red-100 text-red-800':'bg-gray-100 text-gray-600'}`}>{t.status.replace('_',' ')}</span>{t.priority && <span className={`text-xs font-medium ${t.priority==='high'?'text-red-600':t.priority==='medium'?'text-amber-600':'text-gray-500'}`}>{t.priority} priority</span>}</div>{t.description && <p className="text-xs text-gray-600 mt-1">{t.description}</p>}{t.assigned_by && <p className="text-xs text-gray-400 mt-1">Assigned by: {t.assigned_by}</p>}</div>{t.due_date && <span className="text-xs text-gray-400 whitespace-nowrap ml-4">Due: {fmtDate(t.due_date)}</span>}</div></div>))}</div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="bg-white rounded-xl border border-gray-200 p-5"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">{icon}</div><div className="min-w-0"><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900 truncate">{value}</p></div></div></div>;
}

function StatCard({ icon, label, value, hint, onClick }: { icon: React.ReactNode; label: string; value: string | number; hint: string; onClick: () => void }) {
  return <button onClick={onClick} className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-blue-300 hover:shadow-sm transition-all"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">{icon}</div><div><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold text-gray-900">{value}</p></div></div><p className="text-xs text-blue-600 font-medium">{hint} →</p></button>;
}

function LeaveRequestForm({ onSubmit, onCancel }: { onSubmit: (data: { leaveType: string; startDate: string; endDate: string; reason: string }) => void; onCancel: () => void; }) {
  const [leaveType, setLeaveType] = useState('annual'); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [reason, setReason] = useState('');
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!startDate || !endDate || !reason) return; onSubmit({ leaveType, startDate, endDate, reason }); };
  return <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="block text-xs font-semibold text-gray-700 mb-1">Leave Type</label><select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"><option value="annual">Annual</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="maternity">Maternity</option><option value="paternity">Paternity</option><option value="unpaid">Unpaid</option></select></div><div><label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" /></div><div><label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" /></div></div><div><label className="block text-xs font-semibold text-gray-700 mb-1">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="Briefly describe the reason for your leave request..." /></div><div className="flex items-center gap-3"><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Submit Request</button><button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button></div></form>;
}
