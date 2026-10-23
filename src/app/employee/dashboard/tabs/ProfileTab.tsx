'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, FileText, ClipboardList, Mail, Briefcase, Building, Calendar, DollarSign, Clock, AlertCircle, CheckCircle, User, Phone, MapPin, Heart, Globe, Camera, Save, X } from 'lucide-react';

interface Payslip { id: string; period: string; base_salary: number; transport_allowance: number; housing_allowance: number; meal_allowance: number; bonus: number; tax: number; pension: number; health_insurance: number; other_deductions: number; net_pay: number; status: string; }
interface LeaveRequest { id: string; leave_type: string; start_date: string; end_date: string; reason: string; status: string; created_at: string; reviewer_comment: string | null; }
interface Task { id: string; title: string; description: string | null; due_date: string | null; status: string; priority: string | null; assigned_by: string | null; }

type SubSection = 'info' | 'payslips' | 'leave' | 'tasks';

export function ProfileTab({ profile, onProfileUpdate }: { profile: any; onProfileUpdate?: (p: any) => void }) {
  const [subSection, setSubSection] = useState<SubSection>('info');
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [editForm, setEditForm] = useState({
    name: profile.name || '',
    phone: profile.phone || '',
    address: profile.address || '',
    maritalStatus: profile.maritalStatus || '',
    gender: profile.gender || '',
    dateOfBirth: profile.dateOfBirth || '',
    emergencyContactName: profile.emergencyContactName || '',
    emergencyContactPhone: profile.emergencyContactPhone || '',
    nationality: profile.nationality || '',
    stateOfOrigin: profile.stateOfOrigin || '',
    city: profile.city || '',
    profilePicture: profile.profilePicture || '',
  });

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
          <button key={st.key} onClick={() => setSubSection(st.key)} className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${subSection === st.key ? 'bg-theme-accent text-white' : 'bg-theme-surface border border-theme-border text-theme-text-secondary hover:bg-theme-muted'}`}>
            {st.icon}{st.label}
            {st.badge != null && <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-400 text-amber-900">{st.badge}</span>}
          </button>
        ))}
      </div>

      {/* Personal Info */}
      {subSection === 'info' && (
        <div className="space-y-4">
          {/* Profile Picture */}
          <div className="bg-theme-surface rounded-2xl border border-theme-border p-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                {editForm.profilePicture ? (
                  <img src={editForm.profilePicture} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-theme-border" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                    {(profile.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                {editing && (
                  <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-theme-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-theme-accent-hover transition-colors shadow-md">
                    <Camera className="w-3.5 h-3.5 text-white" />
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) { setProfileMsg({ type: 'error', text: 'Image must be under 5MB' }); return; }
                      setUploadingPic(true);
                      try {
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const base64 = (reader.result as string).split(',')[1];
                          const res = await fetch('/api/hr/employees/portal/profile-picture', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ filename: file.name, mimeType: file.type, data: base64 }),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok && data.url) {
                            setEditForm(f => ({ ...f, profilePicture: data.url }));
                            setProfileMsg({ type: 'success', text: 'Profile picture uploaded' });
                          } else {
                            setProfileMsg({ type: 'error', text: data.error || 'Upload failed' });
                          }
                          setUploadingPic(false);
                        };
                        reader.readAsDataURL(file);
                      } catch {
                        setUploadingPic(false);
                        setProfileMsg({ type: 'error', text: 'Failed to upload image' });
                      }
                    }} />
                  </label>
                )}
                {uploadingPic && <div className="absolute inset-0 rounded-full bg-theme-overlay flex items-center justify-center"><Loader2 className="w-5 h-5 text-white animate-spin" /></div>}
              </div>
              <div>
                <h3 className="text-lg font-bold text-theme-text-primary">{profile.name}</h3>
                <p className="text-sm text-theme-text-secondary">{profile.jobTitle || 'Staff'} &middot; {profile.email}</p>
                {!editing ? (
                  <button onClick={() => { setEditing(true); setProfileMsg(null); }} className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-theme-accent bg-blue-50 rounded-lg hover:bg-theme-muted transition-colors">
                    <User className="w-3.5 h-3.5" /> Edit Profile
                  </button>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <button onClick={async () => {
                      setSavingProfile(true); setProfileMsg(null);
                      try {
                        const res = await fetch('/api/hr/employees/me', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(editForm),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok) {
                          setProfileMsg({ type: 'success', text: 'Profile updated successfully' });
                          setEditing(false);
                          if (onProfileUpdate && data.employee) onProfileUpdate(data.employee);
                        } else {
                          setProfileMsg({ type: 'error', text: data.error || 'Update failed' });
                        }
                      } catch { setProfileMsg({ type: 'error', text: 'Network error' }); }
                      setSavingProfile(false);
                    }} disabled={savingProfile} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover transition-colors disabled:opacity-50">
                      {savingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Changes
                    </button>
                    <button onClick={() => { setEditing(false); setProfileMsg(null); setEditForm({
                      name: profile.name || '', phone: profile.phone || '', address: profile.address || '',
                      maritalStatus: profile.maritalStatus || '', gender: profile.gender || '', dateOfBirth: profile.dateOfBirth || '',
                      emergencyContactName: profile.emergencyContactName || '', emergencyContactPhone: profile.emergencyContactPhone || '',
                      nationality: profile.nationality || '', stateOfOrigin: profile.stateOfOrigin || '', city: profile.city || '',
                      profilePicture: profile.profilePicture || '',
                    }); }} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-theme-text-secondary bg-theme-muted rounded-lg hover:bg-theme-muted transition-colors">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
            {profileMsg && (
              <div className={`mt-3 flex items-center gap-2 text-xs ${profileMsg.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                {profileMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {profileMsg.text}
              </div>
            )}
          </div>

          {/* Employment Details (read-only) */}
          <div className="bg-theme-surface rounded-2xl border border-theme-border p-6">
            <h3 className="text-sm font-semibold text-theme-text-primary mb-4">Employment Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow icon={<Mail className="w-4 h-4 text-theme-accent" />} label="Email" value={profile.email} />
              <InfoRow icon={<Briefcase className="w-4 h-4 text-theme-accent" />} label="Job Title" value={profile.jobTitle || '—'} />
              <InfoRow icon={<Building className="w-4 h-4 text-theme-accent" />} label="Department" value={profile.departmentId || '—'} />
              <InfoRow icon={<Calendar className="w-4 h-4 text-theme-accent" />} label="Hire Date" value={fmtDate(profile.hireDate)} />
              <InfoRow icon={<DollarSign className="w-4 h-4 text-theme-accent" />} label="Salary" value={fmtSalary(profile.salary)} />
              <InfoRow icon={<Clock className="w-4 h-4 text-theme-accent" />} label="Employment Type" value={profile.employmentType || 'Full-time'} />
            </div>
          </div>

          {/* Personal Info (editable) */}
          <div className="bg-theme-surface rounded-2xl border border-theme-border p-6">
            <h3 className="text-sm font-semibold text-theme-text-primary mb-4">Personal Information</h3>
            {!editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={<User className="w-4 h-4 text-theme-accent" />} label="Full Name" value={profile.name || '—'} />
                <InfoRow icon={<Phone className="w-4 h-4 text-theme-accent" />} label="Phone" value={profile.phone || '—'} />
                <InfoRow icon={<MapPin className="w-4 h-4 text-theme-accent" />} label="Address" value={profile.address || '—'} />
                <InfoRow icon={<Heart className="w-4 h-4 text-theme-accent" />} label="Marital Status" value={profile.maritalStatus ? profile.maritalStatus.charAt(0).toUpperCase() + profile.maritalStatus.slice(1) : '—'} />
                <InfoRow icon={<User className="w-4 h-4 text-theme-accent" />} label="Gender" value={profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : '—'} />
                <InfoRow icon={<Calendar className="w-4 h-4 text-theme-accent" />} label="Date of Birth" value={profile.dateOfBirth || '—'} />
                <InfoRow icon={<Globe className="w-4 h-4 text-theme-accent" />} label="Nationality" value={profile.nationality || '—'} />
                <InfoRow icon={<MapPin className="w-4 h-4 text-theme-accent" />} label="State of Origin" value={profile.stateOfOrigin || '—'} />
                <InfoRow icon={<MapPin className="w-4 h-4 text-theme-accent" />} label="City" value={profile.city || '—'} />
                <InfoRow icon={<Phone className="w-4 h-4 text-theme-accent" />} label="Emergency Contact" value={profile.emergencyContactName ? `${profile.emergencyContactName} (${profile.emergencyContactPhone || '—'})` : '—'} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Full Name" value={editForm.name} onChange={v => setEditForm(f => ({ ...f, name: v }))} icon={<User className="w-4 h-4 text-theme-text-tertiary" />} />
                <FormField label="Phone" value={editForm.phone} onChange={v => setEditForm(f => ({ ...f, phone: v }))} icon={<Phone className="w-4 h-4 text-theme-text-tertiary" />} />
                <FormField label="Address" value={editForm.address} onChange={v => setEditForm(f => ({ ...f, address: v }))} icon={<MapPin className="w-4 h-4 text-theme-text-tertiary" />} textarea />
                <FormSelect label="Marital Status" value={editForm.maritalStatus} onChange={v => setEditForm(f => ({ ...f, maritalStatus: v }))} options={[{ value: '', label: '—' }, { value: 'single', label: 'Single' }, { value: 'married', label: 'Married' }, { value: 'divorced', label: 'Divorced' }, { value: 'widowed', label: 'Widowed' }]} />
                <FormSelect label="Gender" value={editForm.gender} onChange={v => setEditForm(f => ({ ...f, gender: v }))} options={[{ value: '', label: '—' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
                <FormField label="Date of Birth" value={editForm.dateOfBirth} onChange={v => setEditForm(f => ({ ...f, dateOfBirth: v }))} type="date" />
                <FormField label="Nationality" value={editForm.nationality} onChange={v => setEditForm(f => ({ ...f, nationality: v }))} icon={<Globe className="w-4 h-4 text-theme-text-tertiary" />} />
                <FormField label="State of Origin" value={editForm.stateOfOrigin} onChange={v => setEditForm(f => ({ ...f, stateOfOrigin: v }))} icon={<MapPin className="w-4 h-4 text-theme-text-tertiary" />} />
                <FormField label="City" value={editForm.city} onChange={v => setEditForm(f => ({ ...f, city: v }))} icon={<MapPin className="w-4 h-4 text-theme-text-tertiary" />} />
                <FormField label="Emergency Contact Name" value={editForm.emergencyContactName} onChange={v => setEditForm(f => ({ ...f, emergencyContactName: v }))} icon={<User className="w-4 h-4 text-theme-text-tertiary" />} />
                <FormField label="Emergency Contact Phone" value={editForm.emergencyContactPhone} onChange={v => setEditForm(f => ({ ...f, emergencyContactPhone: v }))} icon={<Phone className="w-4 h-4 text-theme-text-tertiary" />} />
              </div>
            )}
          </div>

          {profile.lastLogin && (
            <div className="bg-theme-surface rounded-2xl border border-theme-border p-4">
              <div className="flex items-center gap-2 text-sm text-theme-text-secondary"><Clock className="w-4 h-4" />Last login: {new Date(profile.lastLogin).toLocaleString()}</div>
            </div>
          )}
        </div>
      )}

      {/* Payslips */}
      {subSection === 'payslips' && (
        <div className="bg-theme-surface rounded-2xl border border-theme-border overflow-hidden">
          <div className="px-6 py-4 border-b border-theme-border"><h3 className="text-sm font-semibold text-theme-text-primary">Payslip History</h3></div>
          {loading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-theme-accent animate-spin mx-auto" /></div> : payslips.length === 0 ? (
            <div className="p-8 text-center"><FileText className="w-10 h-10 text-theme-text-secondary mx-auto mb-2" /><p className="text-sm text-theme-text-tertiary">No payslips available yet.</p></div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead className="bg-theme-muted border-b border-theme-border"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-primary whitespace-nowrap">Period</th><th className="px-4 py-3 text-right text-xs font-semibold text-theme-text-primary whitespace-nowrap">Gross</th><th className="px-4 py-3 text-right text-xs font-semibold text-theme-text-primary whitespace-nowrap">Deductions</th><th className="px-4 py-3 text-right text-xs font-semibold text-theme-text-primary whitespace-nowrap">Net Pay</th><th className="px-4 py-3 text-center text-xs font-semibold text-theme-text-primary whitespace-nowrap">Status</th></tr></thead><tbody className="divide-y divide-theme-border">{payslips.map((p) => { const gross = (p.base_salary||0)+(p.transport_allowance||0)+(p.housing_allowance||0)+(p.meal_allowance||0)+(p.bonus||0); const ded = (p.tax||0)+(p.pension||0)+(p.health_insurance||0)+(p.other_deductions||0); return (<tr key={p.id} className="hover:bg-theme-muted"><td className="px-4 py-3 text-sm text-theme-text-primary whitespace-nowrap">{p.period}</td><td className="px-4 py-3 text-sm text-theme-text-secondary text-right whitespace-nowrap">{fmtMoney(gross)}</td><td className="px-4 py-3 text-sm text-red-600 text-right whitespace-nowrap">-{fmtMoney(ded)}</td><td className="px-4 py-3 text-sm font-semibold text-green-700 text-right whitespace-nowrap">{fmtMoney(p.net_pay)}</td><td className="px-4 py-3 text-center whitespace-nowrap"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.status==='paid'?'bg-green-100 text-green-800':p.status==='processed'?'bg-blue-100 text-blue-800':'bg-theme-muted text-theme-text-secondary'}`}>{p.status}</span></td></tr>); })}</tbody></table></div>
          )}
        </div>
      )}

      {/* Leave Requests */}
      {subSection === 'leave' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-theme-text-primary">Leave Requests</h3><button onClick={() => setShowLeaveForm(!showLeaveForm)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover transition-colors"><Plus className="w-4 h-4" />Request Leave</button></div>
          {showLeaveForm && <LeaveRequestForm onSubmit={async (data) => { const res = await fetch('/api/hr/employees/portal/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (res.ok) { setShowLeaveForm(false); loadData('leave'); } }} onCancel={() => setShowLeaveForm(false)} />}
          <div className="bg-theme-surface rounded-2xl border border-theme-border overflow-hidden">
            {loading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-theme-accent animate-spin mx-auto" /></div> : leaveRequests.length === 0 ? <div className="p-8 text-center"><ClipboardList className="w-10 h-10 text-theme-text-secondary mx-auto mb-2" /><p className="text-sm text-theme-text-tertiary">No leave requests submitted.</p></div> : (
              <div className="divide-y divide-theme-border">{leaveRequests.map((lr) => (<div key={lr.id} className="p-4 hover:bg-theme-muted"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2"><span className="text-sm font-medium text-theme-text-primary capitalize">{lr.leave_type} Leave</span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${lr.status==='approved'?'bg-green-100 text-green-800':lr.status==='rejected'?'bg-red-100 text-red-800':'bg-amber-100 text-amber-800'}`}>{lr.status}</span></div><p className="text-xs text-theme-text-secondary mt-1">{fmtDate(lr.start_date)} — {fmtDate(lr.end_date)}</p><p className="text-xs text-theme-text-secondary mt-1">{lr.reason}</p>{lr.reviewer_comment && <p className="text-xs text-theme-text-secondary mt-1 italic">Reviewer: {lr.reviewer_comment}</p>}</div><span className="text-xs text-theme-text-tertiary">{fmtDate(lr.created_at)}</span></div></div>))}</div>
            )}
          </div>
        </div>
      )}

      {/* Tasks */}
      {subSection === 'tasks' && (
        <div className="bg-theme-surface rounded-2xl border border-theme-border overflow-hidden">
          <div className="px-6 py-4 border-b border-theme-border"><h3 className="text-sm font-semibold text-theme-text-primary">My Tasks</h3></div>
          {loading ? <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-theme-accent animate-spin mx-auto" /></div> : tasks.length === 0 ? <div className="p-8 text-center"><CheckCircle className="w-10 h-10 text-theme-text-secondary mx-auto mb-2" /><p className="text-sm text-theme-text-tertiary">No tasks assigned to you.</p></div> : (
            <div className="divide-y divide-theme-border">{tasks.map((t) => (<div key={t.id} className="p-4 hover:bg-theme-muted"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2"><span className="text-sm font-medium text-theme-text-primary">{t.title}</span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.status==='completed'?'bg-green-100 text-green-800':t.status==='in_progress'?'bg-blue-100 text-blue-800':t.status==='overdue'?'bg-red-100 text-red-800':'bg-theme-muted text-theme-text-secondary'}`}>{t.status?.replace('_',' ')}</span>{t.priority && <span className={`text-xs font-medium ${t.priority==='high'?'text-red-600':t.priority==='medium'?'text-amber-600':'text-theme-text-secondary'}`}>{t.priority} priority</span>}</div>{t.description && <p className="text-xs text-theme-text-secondary mt-1">{t.description}</p>}{t.assigned_by && <p className="text-xs text-theme-text-tertiary mt-1">Assigned by: {t.assigned_by}</p>}</div>{t.due_date && <span className="text-xs text-theme-text-tertiary whitespace-nowrap ml-4">Due: {fmtDate(t.due_date)}</span>}</div></div>))}</div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 p-3 rounded-xl bg-theme-muted"><div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">{icon}</div><div className="min-w-0"><p className="text-xs text-theme-text-secondary">{label}</p><p className="text-sm font-medium text-theme-text-primary truncate">{value}</p></div></div>;
}

function FormField({ label, value, onChange, icon, type = 'text', textarea = false }: { label: string; value: string; onChange: (v: string) => void; icon?: React.ReactNode; type?: string; textarea?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-theme-text-primary mb-1.5">{label}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-3 flex-shrink-0">{icon}</div>}
        {textarea ? (
          <textarea value={value} onChange={e => onChange(e.target.value)} rows={2} className={`w-full border border-theme-border rounded-lg py-2 text-sm text-theme-text-primary outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent ${icon ? 'pl-9' : 'px-3'}`} />
        ) : (
          <input type={type} value={value} onChange={e => onChange(e.target.value)} className={`w-full border border-theme-border rounded-lg py-2 text-sm text-theme-text-primary outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent ${icon ? 'pl-9 pr-3' : 'px-3'}`} />
        )}
      </div>
    </div>
  );
}

function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-xs font-medium text-theme-text-primary mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text-primary outline-none focus:border-theme-accent focus:ring-1 focus:ring-theme-accent">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function LeaveRequestForm({ onSubmit, onCancel }: { onSubmit: (data: { leaveType: string; startDate: string; endDate: string; reason: string }) => void; onCancel: () => void; }) {
  const [leaveType, setLeaveType] = useState('annual'); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [reason, setReason] = useState('');
  return <form onSubmit={(e) => { e.preventDefault(); if (!startDate || !endDate || !reason) return; onSubmit({ leaveType, startDate, endDate, reason }); }} className="bg-theme-surface rounded-2xl border border-theme-border p-5 space-y-4"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div><label className="block text-xs font-semibold text-theme-text-primary mb-1">Leave Type</label><select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} className="w-full border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text-primary outline-none focus:border-theme-accent"><option value="annual">Annual</option><option value="sick">Sick</option><option value="personal">Personal</option><option value="maternity">Maternity</option><option value="paternity">Paternity</option><option value="unpaid">Unpaid</option></select></div><div><label className="block text-xs font-semibold text-theme-text-primary mb-1">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-full border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text-primary outline-none focus:border-theme-accent" /></div><div><label className="block text-xs font-semibold text-theme-text-primary mb-1">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-full border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text-primary outline-none focus:border-theme-accent" /></div></div><div><label className="block text-xs font-semibold text-theme-text-primary mb-1">Reason</label><textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} className="w-full border border-theme-border rounded-lg px-3 py-2 text-sm text-theme-text-primary outline-none focus:border-theme-accent" placeholder="Briefly describe the reason for your leave request..." /></div><div className="flex items-center gap-3"><button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover transition-colors">Submit Request</button><button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-medium text-theme-text-secondary bg-theme-muted rounded-lg hover:bg-theme-muted transition-colors">Cancel</button></div></form>;
}
