'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, LogOut, Loader2, AlertCircle, CalendarCheck, Target, UserCircle, Menu, Bell } from 'lucide-react';
import { DashboardTab } from './tabs/DashboardTab';
import { AttendanceTab } from './tabs/AttendanceTab';
import { ReportsTab } from './tabs/ReportsTab';
import { ProfileTab } from './tabs/ProfileTab';
import { ApprovalsTab } from './tabs/ApprovalsTab';
import { ClipboardCheck } from 'lucide-react';

interface EmployeeProfile {
  id: string; name: string; email: string; jobTitle: string; role: string;
  departmentId: string; employmentType: string; status: string;
  hireDate: string; salary: number; lastLogin: string;
}

type Tab = 'dashboard' | 'attendance' | 'reports' | 'approvals' | 'profile';

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badgeCounts, setBadgeCounts] = useState<{ attendance: number; reports: number; profile: number }>({ attendance: 0, reports: 0, profile: 0 });

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
          });
        }
      } catch {}
    })();
  }, [profile]);

  const handleLogout = async () => {
    await fetch('/api/hr/employees/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="text-center"><AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" /><p className="text-gray-700">{error}</p><button onClick={() => router.replace('/login')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Back to login</button></div></div>;
  if (!profile) return null;

  const fmtRole = (r: string) => r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Staff';
  const totalBadges = badgeCounts.attendance + badgeCounts.reports + badgeCounts.profile;

  const employeeRole = (profile.role || 'staff').toLowerCase();
  const canApprove = ['hod', 'head_of_department', 'hr', 'hr_admin', 'hr_manager'].includes(employeeRole);

  const navItems: { key: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: <User className="w-5 h-5" /> },
    { key: 'attendance', label: 'Attendance', icon: <CalendarCheck className="w-5 h-5" />, badge: badgeCounts.attendance || undefined },
    { key: 'reports', label: 'KPI Reports', icon: <Target className="w-5 h-5" />, badge: badgeCounts.reports || undefined },
    ...(canApprove ? [{ key: 'approvals' as Tab, label: 'Approvals', icon: <ClipboardCheck className="w-5 h-5" /> }] : []),
    { key: 'profile', label: 'Profile & More', icon: <UserCircle className="w-5 h-5" />, badge: badgeCounts.profile || undefined },
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
        <div className="px-3 py-2 border-b border-slate-800">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/50">
            <div className="relative">
              <Bell className="w-4 h-4 text-slate-400" />
              {totalBadges > 0 && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold flex items-center justify-center text-white">{totalBadges}</span>}
            </div>
            <span className="text-xs text-slate-400">{totalBadges > 0 ? `${totalBadges} pending action${totalBadges > 1 ? 's' : ''}` : 'All caught up'}</span>
          </div>
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
            <Bell className="w-5 h-5 text-gray-600" />
            {totalBadges > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold flex items-center justify-center text-white">{totalBadges}</span>}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
          {activeTab === 'dashboard' && <DashboardTab profile={profile} onNavigate={(tab) => setActiveTab(tab as Tab)} />}
          {activeTab === 'attendance' && <AttendanceTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'approvals' && canApprove && <ApprovalsTab />}
          {activeTab === 'profile' && <ProfileTab profile={profile} />}
        </main>
      </div>
    </div>
  );
}
