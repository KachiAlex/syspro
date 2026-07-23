'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, Loader2, AlertCircle, CalendarCheck, Target, UserCircle, Menu, Bell, ClipboardList, Receipt, Plane, Wallet, CheckSquare, Sparkles, ChevronRight, X, CheckCheck, Megaphone } from 'lucide-react';
import { DashboardTab } from './tabs/DashboardTab';
import { AttendanceTab } from './tabs/AttendanceTab';
import { ReportsTab } from './tabs/ReportsTab';
import { ProfileTab } from './tabs/ProfileTab';
import { ApprovalsTab } from './tabs/ApprovalsTab';
import { TasksTab } from './tabs/TasksTab';
import { ExpensesTab } from './tabs/ExpensesTab';
import { LeaveTab } from './tabs/LeaveTab';
import { PayslipsTab } from './tabs/PayslipsTab';
import { AppraisalTab } from './tabs/AppraisalTab';
import { ClipboardCheck } from 'lucide-react';

interface EmployeeProfile {
  id: string; name: string; email: string; jobTitle: string; role: string;
  departmentId: string; employmentType: string; status: string;
  hireDate: string; salary: number; lastLogin: string;
  portalPermissions?: Record<string, boolean> | null;
}

type Tab = 'dashboard' | 'tasks' | 'attendance' | 'reports' | 'expenses' | 'leave' | 'payslips' | 'approvals' | 'appraisal' | 'profile';

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [pendingActions, setPendingActions] = useState<{ label: string; tab: string; urgent: boolean }[]>([]);
  const [badgeCounts, setBadgeCounts] = useState<{ attendance: number; reports: number; profile: number; expenses: number; leave: number }>({ attendance: 0, reports: 0, profile: 0, expenses: 0, leave: 0 });

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

  // Fetch badge counts from dashboard summary
  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const res = await fetch('/api/hr/employees/portal/dashboard');
        if (res.ok) {
          const data = await res.json();
          const actions = data.pendingActions || [];
          setBadgeCounts({
            attendance: actions.filter((a: any) => a.tab === 'attendance').length,
            reports: actions.filter((a: any) => a.tab === 'reports').length,
            profile: actions.filter((a: any) => a.tab === 'profile').length,
            expenses: actions.filter((a: any) => a.tab === 'expenses').length,
            leave: actions.filter((a: any) => a.tab === 'leave').length,
          });
          setPendingActions(actions);
        }
      } catch {}
    })();
  }, [profile]);

  // Fetch notifications from DB
  useEffect(() => {
    if (!profile) return;
    let interval: NodeJS.Timeout;
    const fetchNotifs = async () => {
      try {
        const res = await fetch('/api/hr/employees/portal/notifications?limit=20');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    };
    fetchNotifs();
    interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, [profile]);

  // Fetch announcements
  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const res = await fetch('/api/hr/employees/portal/announcements');
        if (res.ok) {
          const data = await res.json();
          setAnnouncements(data.announcements || []);
        }
      } catch {}
    })();
  }, [profile]);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/hr/employees/portal/notifications', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleLogout = async () => {
    await fetch('/api/hr/employees/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-center"><AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" /><p className="text-gray-700">{error}</p><button onClick={() => router.replace('/login')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Back to login</button></div></div>;
  if (!profile) return null;

  const fmtRole = (r: string) => r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Staff';
  const totalBadges = unreadCount + badgeCounts.attendance + badgeCounts.reports + badgeCounts.profile + badgeCounts.expenses + badgeCounts.leave;

  const employeeRole = (profile.role || 'staff').toLowerCase();

  // Compute portal permissions: use stored permissions if available, otherwise fall back to role-based defaults
  const roleDefaults: Record<string, boolean> = {
    dashboard: true, tasks: true, attendance: true, reports: true,
    expenses: true, leave: true, payslips: true, profile: true,
    approvals: ['hod', 'head_of_department', 'hr', 'hr_admin', 'hr_manager'].includes(employeeRole),
    appraisal: ['hr', 'hr_admin', 'hr_manager'].includes(employeeRole),
  };
  const perms: Record<string, boolean> = profile.portalPermissions
    ? { ...roleDefaults, ...profile.portalPermissions }
    : roleDefaults;
  const canApprove = perms.approvals === true;
  const canAssignTasks = ['hod', 'head_of_department', 'hr', 'hr_admin', 'hr_manager'].includes(employeeRole);
  const canAppraise = perms.appraisal === true;

  const navItems: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    ...(perms.dashboard !== false ? [{ key: 'dashboard' as Tab, label: 'Dashboard', icon: <User className="w-5 h-5" /> }] : []),
    ...(perms.tasks !== false ? [{ key: 'tasks' as Tab, label: 'Tasks & KPIs', icon: <ClipboardList className="w-5 h-5" /> }] : []),
    ...(perms.attendance !== false ? [{ key: 'attendance' as Tab, label: 'Attendance', icon: <CalendarCheck className="w-5 h-5" />, badge: badgeCounts.attendance || undefined }] : []),
    ...(perms.reports !== false ? [{ key: 'reports' as Tab, label: 'KPI Reports', icon: <Target className="w-5 h-5" />, badge: badgeCounts.reports || undefined }] : []),
    ...(perms.expenses !== false ? [{ key: 'expenses' as Tab, label: 'Expenses', icon: <Receipt className="w-5 h-5" />, badge: badgeCounts.expenses || undefined }] : []),
    ...(perms.leave !== false ? [{ key: 'leave' as Tab, label: 'Leave', icon: <Plane className="w-5 h-5" />, badge: badgeCounts.leave || undefined }] : []),
    ...(perms.payslips !== false ? [{ key: 'payslips' as Tab, label: 'Payslips', icon: <Wallet className="w-5 h-5" /> }] : []),
    ...(canApprove ? [{ key: 'approvals' as Tab, label: 'Approvals', icon: <ClipboardCheck className="w-5 h-5" /> }] : []),
    ...(canAppraise ? [{ key: 'appraisal' as Tab, label: 'AI Appraisal', icon: <Sparkles className="w-5 h-5" /> }] : []),
    ...(perms.profile !== false ? [{ key: 'profile' as Tab, label: 'Profile & More', icon: <UserCircle className="w-5 h-5" />, badge: badgeCounts.profile || undefined }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-30 h-screen w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate">Employee Portal</h1>
              <p className="text-xs text-slate-400 truncate">{profile.name}</p>
            </div>
          </div>
        </div>

        {/* Notification bell */}
        <div className="px-3 py-2 border-b border-slate-800 relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
          >
            <div className="relative">
              <Bell className="w-4 h-4 text-slate-400" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold flex items-center justify-center text-white">{unreadCount}</span>}
            </div>
            <span className="text-xs text-slate-400">{unreadCount > 0 ? `${unreadCount} new notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}</span>
          </button>
          {notifOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-900">Notifications</span>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && <button onClick={handleMarkAllRead} className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-1"><CheckCheck className="w-3 h-3" />Mark all read</button>}
                  <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <CheckSquare className="w-6 h-6 text-green-400 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">No notifications yet</p>
                </div>
              ) : (
                <div className="py-1">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (n.action_url) {
                          const url = new URL(n.action_url, window.location.origin);
                          const tab = url.searchParams.get('tab') as Tab;
                          if (tab) setActiveTab(tab);
                        }
                        setNotifOpen(false); setSidebarOpen(false);
                      }}
                      className={`w-full flex items-start gap-2 px-3 py-2.5 text-left text-xs hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${!n.is_read ? (n.type === 'success' ? 'bg-green-500' : n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500') : 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${!n.is_read ? 'text-gray-900' : 'text-gray-500'}`}>{n.title}</p>
                        <p className="text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button key={item.key} onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${activeTab === item.key ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
              {activeTab === item.key && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-400 rounded-r-full" />}
              <span className="ml-1">{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge != null && item.badge > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-400 text-amber-900">{item.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-slate-500">{profile.email}</p>
            <p className="text-xs text-slate-400 mt-0.5">{profile.jobTitle} &middot; {fmtRole(profile.role)}</p>
          </div>
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
          <div className="relative">
            <button onClick={() => setNotifOpen(!notifOpen)}>
              <Bell className="w-5 h-5 text-gray-600" />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 w-72 max-h-96 overflow-y-auto">
                <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-900">Notifications</span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && <button onClick={handleMarkAllRead} className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-1"><CheckCheck className="w-3 h-3" />Mark all</button>}
                    <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {notifications.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <CheckSquare className="w-6 h-6 text-green-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">No notifications yet</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          if (n.action_url) {
                            const url = new URL(n.action_url, window.location.origin);
                            const tab = url.searchParams.get('tab') as Tab;
                            if (tab) setActiveTab(tab);
                          }
                          setNotifOpen(false);
                        }}
                        className={`w-full flex items-start gap-2 px-3 py-2.5 text-left text-xs hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${!n.is_read ? (n.type === 'success' ? 'bg-green-500' : n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500') : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${!n.is_read ? 'text-gray-900' : 'text-gray-500'}`}>{n.title}</p>
                          <p className="text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
          {activeTab === 'dashboard' && perms.dashboard !== false && <DashboardTab profile={profile} onNavigate={(tab) => setActiveTab(tab as Tab)} announcements={announcements} />}
          {activeTab === 'tasks' && perms.tasks !== false && <TasksTab profile={profile} />}
          {activeTab === 'attendance' && perms.attendance !== false && <AttendanceTab profile={profile} />}
          {activeTab === 'reports' && perms.reports !== false && <ReportsTab />}
          {activeTab === 'expenses' && perms.expenses !== false && <ExpensesTab profile={profile} />}
          {activeTab === 'leave' && perms.leave !== false && <LeaveTab profile={profile} />}
          {activeTab === 'payslips' && perms.payslips !== false && <PayslipsTab profile={profile} />}
          {activeTab === 'approvals' && canApprove && <ApprovalsTab />}
          {activeTab === 'appraisal' && canAppraise && <AppraisalTab profile={profile} />}
          {activeTab === 'profile' && perms.profile !== false && <ProfileTab profile={profile} onProfileUpdate={(updated) => setProfile(updated)} />}
        </main>
      </div>
    </div>
  );
}
