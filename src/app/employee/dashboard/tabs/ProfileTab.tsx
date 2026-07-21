'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, FileText, ClipboardList, Mail, Briefcase, Building, Calendar, DollarSign, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface Payslip { id: string; period: string; base_salary: number; transport_allowance: number; housing_allowance: number; meal_allowance: number; bonus: number; tax: number; pension: number; health_insurance: number; other_deductions: number; net_pay: number; status: string; }
interface LeaveRequest { id: string; leave_type: string; start_date: string; end_date: string; reason: string; status: string; created_at: string; reviewer_comment: string | null; }
interface Task { id: string; title: string; description: string | null; due_date: string | null; status: string; priority: string | null; assigned_by: string | null; }

type SubSection = 'info' | 'payslips' | 'leave' | 'tasks';

export function ProfileTab({ profile }: { profile: any }) {
  const [subSection, setSubSection] = useState<SubSection>('info');
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);

  const loadData = useCallback(async (section: SubSection) => {
    setLoading(true);
    try {
      if (section === 'payslips') { const r = await fetch('/api/hr/employees/portal/payslips'); if (r.ok) { const d = await r.json(); setPayslips(d.payslips || []); } }
      else if (section === 'leave') { const r = await fetch('/api/hr/employees/portal/leave'); if (r.ok) { const d = await r.json(); setLeaveRequests(d.requests || []); } }
      else if (section === 'tasks') { const r = await fetch('/api/hr/employees/portal/tasks'); if (r.ok) { const d = await r.json(); setTasks(d.tasks || []); } }
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { if (subSection !== 'info') loadData(subSection); }, [subSection, loadData]);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const fmtSalary = (s: number) => s ? `$${Number(s).toLocaleString()}` : '—';
  const fmtMoney = (n: number) => n ? `$${Number(n).toLocaleString()}` : '$0';

  const subTabs: { key: SubSection; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'info', label: 'Personal Info', icon: <Mail className="w-4 h-4" /> },
    { key: 'payslips', label: 'Payslips', icon: <FileText className="w-4 h-4" /> },
    { key: 'leave', label: 'Leave Requests', icon: <ClipboardList className="w-4 h-4" />, badge: leaveRequests.filter(r => r.status === 'pending').length || undefined },
    { key: 'tasks', label: 'My Tasks', icon: <CheckCircle className="w-4 h-4" />, badge: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length || undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Sub-section tabs */}
      <div className="flex gap-1 flex-wrap">
        {subTabs.map((st) => (
          <button key={st.key} onClick={() => setSubSection(st.key)} className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${subSection === st.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {st.icon}{st.label}
            {st.badge != null && <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-400 text-amber-900">{st.badge}</span>}
          </button>
        ))}
      </div>

      {/* Personal Info */}
      {subSection === 'info' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow icon={<Mail className="w-4 h-4 text-blue-600" />} label="Email" value={profile.email} />
              <InfoRow icon={<Briefcase className="w-4 h-4 text-blue-600" />} label="Job Title" value={profile.jobTitle || '—'} />
              <InfoRow icon={<Building className="w-4 h-4 text-blue-600" />} label="Department" value={profile.departmentId || '—'} />
              <InfoRow icon={<Calendar className="w-4 h-4 text-blue-600" />} label="Hire Date" value={fmtDate(profile.hireDate)} />
              <InfoRow icon={<DollarSign className="w-4 h-4 text-blue-600" />} label="Salary" value={fmtSalary(profile.salary)} />
              <InfoRow icon={<Clock className="w-4 h-4 text-blue-600" />} label="Employment Type" value={profile.employmentType || 'Full-time'} />
            </div>
          </div>
          {profile.lastLogin && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-600"><Clock className="w-4 h-4" />Last login: {new Date(profile.lastLogin).toLocaleString()}</div>
            </div>
          )}
        </div>
      )}

      {/* Payslips */}
      {subSection === 'payslips' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">Payslip History</h3></div>
          {loading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div> : payslips.length === 0 ? (
            <div className="p-8 text-center"><FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400">No payslips available yet.</p></div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Period</th><th className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">Gross</th><th className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">Deductions</th><th className="px-4 py-3 text-right text-xs font-semibold text-gray-900 whitespace-nowrap">Net Pay</th><th className="px-4 py-3 text-center text-xs font-semibold text-gray-900 whitespace-nowrap">Status</th></tr></thead><tbody className="divide-y divide-gray-200">{payslips.map((p) => { const gross = (p.base_salary||0)+(p.transport_allowance||0)+(p.housing_allowance||0)+(p.meal_allowance||0)+(p.bonus||0); const ded = (p.tax||0)+(p.pension||0)+(p.health_insurance||0)+(p.other_deductions||0); return (<tr key={p.id} className="hover:bg-gray-50"><td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{p.period}</td><td className="px-4 py-3 text-sm text-gray-600 text-right whitespace-nowrap">{fmtMoney(gross)}</td><td className="px-4 py-3 text-sm text-red-600 text-right whitespace-nowrap">-{fmtMoney(ded)}</td><td className="px-4 py-3 text-sm font-semibold text-green-700 text-right whitespace-nowrap">{fmtMoney(p.net_pay)}</td><td className="px-4 py-3 text-center whitespace-nowrap"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.status==='paid'?'bg-green-100 text-green-800':p.status==='processed'?'bg-blue-100 text-blue-800':'bg-gray-100 text-gray-600'}`}>{p.status}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      )}

      {/* Leave Requests */}
      {subSection === 'leave' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900">Leave Requests</h3><button onClick={() => setShowLeaveForm(!showLeaveForm)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"><Plus className="w-4 h-4" />Request Leave</button></div>
          {showLeaveForm && <LeaveRequestForm onSubmit={async (data) => { const res = await fetch('/api/hr/employees/portal/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (res.ok) { setShowLeaveForm(false); loadData('leave'); } }} onCancel={() => setShowLeaveForm(false)} />}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {loading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div> : leaveRequests.length === 0 ? <div className="p-8 text-center"><ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400">No leave requests submitted.</p></div> : (
              <div className="divide-y divide-gray-200">{leaveRequests.map((lr) => (<div key={lr.id} className="p-4 hover:bg-gray-50"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-900 capitalize">{lr.leave_type} Leave</span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${lr.status==='approved'?'bg-green-100 text-green-800':lr.status==='rejected'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}`}>{lr.status}</span></div><p className="text-xs text-gray-500 mt-1">{fmtDate(lr.start_date)} — {fmtDate(lr.end_date)}</p><p className="text-xs text-gray-600 mt-1">{lr.reason}</p>{lr.reviewer_comment && <p className="text-xs text-gray-500 mt-1 italic">Reviewer: {lr.reviewer_comment}</p>}</div><span className="text-xs text-gray-400">{fmtDate(lr.created_at)}</span></div></div>))}</div>
            )}
          </div>
        </div>
      )}

      {/* Tasks */}
      {subSection === 'tasks' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">My Tasks</h3></div>
          {loading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div> : tasks.length === 0 ? <div className="p-8 text-center"><CheckCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400">No tasks assigned to you.</p></div> : (
            <div className="divide-y divide-gray-200">{tasks.map((t) => (<div key={t.id} className="p-4 hover:bg-gray-50"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-900">{t.title}</span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.status==='completed'?'bg-green-100 text-green-800':t.status==='in_progress'?'bg-blue-100 text-blue-800':t.status==='overdue'?'bg-red-100 text-red-800':'bg-gray-100 text-gray-600'}`}>{t.status.replace('_',' ')}</span>{t.priority && <span className={`text-xs font-medium ${t.priority==='high'?'text-red-600':t.priority==='medium'?'text-amber-600':'text-gray-500'}`}>{t.priority} priority</span>}</div>{t.description && <p className="text-xs text-gray-600 mt-1">{t.description}</p>}{t.assigned_by && <p className="text-xs text-gray-400 mt-1">Assigned by: {t.assigned_by}</p>}</div>{t.due_date && <span className="text-xs text-gray-400 whitespace-nowrap ml-4">Due: {fmtDate(t.due_date)}</span>}</div></div>))}</div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50"><div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">{icon}</div><div className="min-w-0"><p className="text-xs text-gray-500">{label}</p><p className="text-sm font-medium text-gray-900 truncate">{value}</p></div></div>;
}

function LeaveRequestForm({ onSubmit, onCancel }: { onSubmit: (data: { leaveType: string; startDate: string; endDate: string; reason: string }) => void; onCancel: () => void; }) {
  const [leaveType, setLeaveType] = useState('annual'); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [reason, setReason] = useState('');
  return <form onSubmit={(e) => { e.preventDefault(); if (!startDate || !endDate || !reason) return; onSubmit({ leaveType, startDate, endDate, reason }); }} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="block text-xs font-semibold text-gray-700 mb-1">Leave Type</label><select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"><option value="annual">Annual</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="maternity">Maternity</option><option value="paternity">Paternity</option><option value="unpaid">Unpaid</option></select></div><div><label className="block text-xs font-semibold text-gray-700 mb-1">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" /></div><div><label className="block text-xs font-semibold text-gray-700 mb-1">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" /></div></div><div><label className="block text-xs font-semibold text-gray-700 mb-1">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500" placeholder="Briefly describe the reason for your leave request..." /></div><div className="flex items-center gap-3"><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">Submit Request</button><button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button></div></form>;
}
