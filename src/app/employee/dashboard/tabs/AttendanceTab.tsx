'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Play, Square, CalendarCheck, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface TodayRecord {
  id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
}

export function AttendanceTab() {
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/employees/portal/attendance/check-in');
      if (res.ok) {
        const data = await res.json();
        setTodayRecord(data.today || null);
        setRecords(data.records || []);
      }
    } catch {
      setError('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (action: 'check_in' | 'check_out') => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/hr/employees/portal/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuccess(action === 'check_in' ? 'Checked in successfully!' : 'Checked out successfully!');
        fetchData();
      } else {
        setError(data.error || 'Action failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setActionLoading(false);
    }
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  const today = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('en-US', { hour12: false });

  if (loading) {
    return <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div>;
  }

  const hasCheckedIn = !!todayRecord?.check_in;
  const hasCheckedOut = !!todayRecord?.check_out;

  return (
    <div className="space-y-6">
      {/* Check-in/Check-out card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarCheck className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Today&apos;s Attendance — {fmtDate(today)}</h3>
        </div>

        {error && <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>}
        {success && <div className="mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700"><CheckCircle className="w-4 h-4" />{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Check-in status */}
          <div className={`rounded-xl border-2 p-4 ${hasCheckedIn ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Play className={`w-4 h-4 ${hasCheckedIn ? 'text-green-600' : 'text-gray-400'}`} />
              <span className="text-xs font-semibold text-gray-700">Check In</span>
            </div>
            <p className={`text-lg font-bold ${hasCheckedIn ? 'text-green-700' : 'text-gray-400'}`}>
              {todayRecord?.check_in || '—'}
            </p>
          </div>

          {/* Check-out status */}
          <div className={`rounded-xl border-2 p-4 ${hasCheckedOut ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-1">
              <Square className={`w-4 h-4 ${hasCheckedOut ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className="text-xs font-semibold text-gray-700">Check Out</span>
            </div>
            <p className={`text-lg font-bold ${hasCheckedOut ? 'text-blue-700' : 'text-gray-400'}`}>
              {todayRecord?.check_out || '—'}
            </p>
          </div>

          {/* Status */}
          <div className="rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-gray-700">Status</span>
            </div>
            <p className="text-lg font-bold capitalize text-gray-700">
              {todayRecord?.status?.replace('_', ' ') || 'not recorded'}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleAction('check_in')}
            disabled={actionLoading || hasCheckedIn}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {hasCheckedIn ? 'Already Checked In' : 'Check In'}
          </button>
          <button
            onClick={() => handleAction('check_out')}
            disabled={actionLoading || !hasCheckedIn || hasCheckedOut}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Square className="w-4 h-4" />
            {hasCheckedOut ? 'Already Checked Out' : 'Check Out'}
          </button>
          {actionLoading && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
        </div>

        <p className="text-xs text-gray-400 mt-3">Current time: {currentTime}</p>
      </div>

      {/* Recent attendance history */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">Recent Attendance</h3></div>
        {records.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">No attendance records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Check In</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Check Out</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{fmtDate(a.date)}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        a.status === 'present' ? 'bg-green-100 text-green-800' :
                        a.status === 'late' ? 'bg-amber-100 text-amber-800' :
                        a.status === 'half_day' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>{a.status.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{a.check_in || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{a.check_out || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
