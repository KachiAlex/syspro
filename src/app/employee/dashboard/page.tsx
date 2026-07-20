'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Briefcase,
  Building,
  Calendar,
  DollarSign,
  Clock,
  LogOut,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface EmployeeProfile {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: string;
  departmentId: string;
  employmentType: string;
  status: string;
  hireDate: string;
  salary: number;
  lastLogin: string;
}

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/hr/employees/me');
        if (res.status === 401) {
          router.replace('/employee/login');
          return;
        }
        if (!res.ok) {
          setError('Failed to load profile');
          return;
        }
        const data = await res.json();
        setProfile(data.employee);
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    await fetch('/api/hr/employees/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/employee/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700">{error}</p>
          <button
            onClick={() => router.replace('/employee/login')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const fmtDate = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
  const fmtSalary = (s: number) => (s ? `$${Number(s).toLocaleString()}` : '—');
  const fmtRole = (r: string) => r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Staff';
  const fmtEmpType = (t: string) => t ? t.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('-') : 'Full-time';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Employee Portal</h1>
              <p className="text-xs text-gray-500">{profile.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
          <h2 className="text-2xl font-bold">Welcome, {profile.name.split(' ')[0]}!</h2>
          <p className="text-blue-100 mt-1">
            {profile.jobTitle} &middot; {fmtRole(profile.role)}
          </p>
        </div>

        {/* Profile cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard icon={<Mail className="w-5 h-5 text-blue-600" />} label="Email" value={profile.email} />
          <InfoCard icon={<Briefcase className="w-5 h-5 text-blue-600" />} label="Job Title" value={profile.jobTitle || '—'} />
          <InfoCard icon={<Building className="w-5 h-5 text-blue-600" />} label="Department" value={profile.departmentId || '—'} />
          <InfoCard icon={<Calendar className="w-5 h-5 text-blue-600" />} label="Hire Date" value={fmtDate(profile.hireDate)} />
          <InfoCard icon={<DollarSign className="w-5 h-5 text-blue-600" />} label="Salary" value={fmtSalary(profile.salary)} />
          <InfoCard icon={<Clock className="w-5 h-5 text-blue-600" />} label="Employment Type" value={fmtEmpType(profile.employmentType)} />
        </div>

        {/* Last login */}
        {profile.lastLogin && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4" />
              Last login: {new Date(profile.lastLogin).toLocaleString()}
            </div>
          </div>
        )}

        {/* Placeholder sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <PlaceholderCard title="Payslips" description="View and download your recent payslips." />
          <PlaceholderCard title="Attendance" description="Check your attendance records and clock in/out." />
          <PlaceholderCard title="Leave Requests" description="Submit and track your leave requests." />
        </div>
      </main>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

function PlaceholderCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{description}</p>
      <div className="mt-3 inline-flex items-center text-xs text-blue-600 font-medium">
        Coming soon
      </div>
    </div>
  );
}
