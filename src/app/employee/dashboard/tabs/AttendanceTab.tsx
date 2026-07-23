'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Play, Square, CalendarCheck, Clock, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, Timer, MapPin } from 'lucide-react';

interface TodayRecord { id: string; date: string; status: string; check_in: string | null; check_out: string | null; check_in_lat: number | null; check_in_lng: number | null; check_out_lat: number | null; check_out_lng: number | null; }
interface AttendanceRecord { id: string; date: string; status: string; check_in: string | null; check_out: string | null; notes: string | null; check_in_lat: number | null; check_in_lng: number | null; }

export function AttendanceTab() {
  const [todayRecord, setTodayRecord] = useState<TodayRecord | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hr/employees/portal/attendance/check-in');
      if (res.ok) {
        const data = await res.json();
        setTodayRecord(prev => data.today || prev);
        setRecords(data.records || []);
      }
    } catch { setError('Failed to load attendance'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const [locationStatus, setLocationStatus] = useState<'idle' | 'fetching' | 'granted' | 'denied'>('idle');

  const getLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        setLocationStatus('denied');
        resolve(null);
        return;
      }
      setLocationStatus('fetching');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationStatus('granted');
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        },
        (err) => {
          console.warn('Geolocation error:', err.message);
          setLocationStatus('denied');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    });
  };

  const handleAction = async (action: 'check_in' | 'check_out') => {
    setActionLoading(true); setError(null); setSuccess(null);
    try {
      const location = await getLocation();
      const res = await fetch('/api/hr/employees/portal/attendance/check-in', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          latitude: location?.latitude,
          longitude: location?.longitude,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        const locNote = location ? ' (location recorded)' : ' (no location)';
        setSuccess((action === 'check_in' ? 'Checked in successfully!' : 'Checked out successfully!') + locNote);
        fetchData();
      } else {
        setError(d.error || 'Action failed');
        if (res.status === 400 && d.record) {
          setTodayRecord(d.record);
        }
      }
    } catch { setError('Network error'); }
    finally { setActionLoading(false); }
  };

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { hour12: false });

  const calcWorkHours = (checkIn: string | null, checkOut: string | null) => {
    if (!checkIn || !checkOut) return null;
    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    const diff = (outH * 60 + outM) - (inH * 60 + inM);
    if (diff <= 0) return null;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  const todayWorkHours = calcWorkHours(todayRecord?.check_in || null, todayRecord?.check_out || null);

  // Weekly hours
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0];
  let weekMinutes = 0;
  for (const r of records.filter(r => r.date >= weekStartStr)) {
    const wh = calcWorkHours(r.check_in, r.check_out);
    if (wh) { const m = wh.match(/(\d+)h (\d+)m/); if (m) weekMinutes += parseInt(m[1]) * 60 + parseInt(m[2]); }
  }
  const weekHours = `${Math.floor(weekMinutes / 60)}h ${weekMinutes % 60}m`;

  // Calendar grid
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const firstDay = new Date(calYear, calMonthIdx, 1);
  const lastDay = new Date(calYear, calMonthIdx + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const monthName = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const recordsByDate: Record<string, AttendanceRecord> = {};
  for (const r of records) recordsByDate[r.date] = r;

  const calendarCells: { date: string | null; day: number | null; record?: AttendanceRecord; isToday: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) calendarCells.push({ date: null, day: null, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    calendarCells.push({ date: dateStr, day: d, record: recordsByDate[dateStr], isToday: dateStr === today });
  }

  const monthPrefix = `${calYear}-${String(calMonthIdx + 1).padStart(2, '0')}`;
  const monthRecords = records.filter(r => r.date.startsWith(monthPrefix));
  const monthPresent = monthRecords.filter(r => r.status === 'present').length;
  const monthLate = monthRecords.filter(r => r.status === 'late').length;
  const monthAbsent = monthRecords.filter(r => r.status === 'absent').length;

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" /></div>;

  const hasCheckedIn = !!todayRecord?.check_in;
  const hasCheckedOut = !!todayRecord?.check_out;
  const showCheckOutReminder = hasCheckedIn && !hasCheckedOut && now.getHours() >= 17;

  return (
    <div className="space-y-6">
      {/* Check-in/out + Today summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4"><CalendarCheck className="w-5 h-5 text-blue-600" /><h3 className="text-sm font-semibold text-gray-900">Today — {fmtDate(today)}</h3></div>
          {error && <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"><AlertCircle className="w-3.5 h-3.5" />{error}</div>}
          {success && <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700"><CheckCircle className="w-3.5 h-3.5" />{success}</div>}
          {showCheckOutReminder && <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 animate-pulse"><Clock className="w-3.5 h-3.5" />Don&apos;t forget to check out!</div>}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50"><div className="flex items-center gap-2"><Play className={`w-4 h-4 ${hasCheckedIn ? 'text-green-600' : 'text-gray-400'}`} /><span className="text-xs text-gray-600">Check In</span></div><span className={`text-sm font-bold ${hasCheckedIn ? 'text-green-700' : 'text-gray-400'}`}>{todayRecord?.check_in || '—'}</span></div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50"><div className="flex items-center gap-2"><Square className={`w-4 h-4 ${hasCheckedOut ? 'text-blue-600' : 'text-gray-400'}`} /><span className="text-xs text-gray-600">Check Out</span></div><span className={`text-sm font-bold ${hasCheckedOut ? 'text-blue-700' : 'text-gray-400'}`}>{todayRecord?.check_out || '—'}</span></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => handleAction('check_in')} disabled={actionLoading || hasCheckedIn} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}{hasCheckedIn ? 'Checked In' : 'Check In'}</button>
            <button onClick={() => handleAction('check_out')} disabled={actionLoading || !hasCheckedIn || hasCheckedOut} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}{hasCheckedOut ? 'Checked Out' : 'Check Out'}</button>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">Current time: {currentTime}</p>
          {locationStatus === 'denied' && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <MapPin className="w-3.5 h-3.5" />
              Location permission denied. Check-in will work but location won&apos;t be recorded.
            </div>
          )}
          {locationStatus === 'granted' && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
              <MapPin className="w-3.5 h-3.5" />
              Location access granted
            </div>
          )}
          {todayRecord?.check_in_lat != null && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
              <MapPin className="w-3 h-3" />
              Check-in location: {Number(todayRecord.check_in_lat).toFixed(5)}, {Number(todayRecord.check_in_lng).toFixed(5)}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4"><Timer className="w-5 h-5 text-indigo-600" /><h3 className="text-sm font-semibold text-gray-900">Work Hours</h3></div>
          <div className="space-y-4">
            <div className="text-center py-3"><p className="text-xs text-gray-400 mb-1">Today</p><p className="text-3xl font-bold text-gray-900">{todayWorkHours || '—'}</p></div>
            <div className="border-t border-gray-100 pt-3 text-center"><p className="text-xs text-gray-400 mb-1">This Week</p><p className="text-xl font-bold text-indigo-600">{weekHours}</p></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4"><CalendarCheck className="w-5 h-5 text-green-600" /><h3 className="text-sm font-semibold text-gray-900">{monthName} Summary</h3></div>
          <div className="space-y-3">
            <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Present</span><span className="text-sm font-bold text-green-700">{monthPresent}</span></div>
            <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Late</span><span className="text-sm font-bold text-amber-700">{monthLate}</span></div>
            <div className="flex items-center justify-between"><span className="text-xs text-gray-500">Absent</span><span className="text-sm font-bold text-red-700">{monthAbsent}</span></div>
            <div className="border-t border-gray-100 pt-3 flex items-center justify-between"><span className="text-xs text-gray-500">Total Recorded</span><span className="text-sm font-bold text-gray-900">{monthRecords.length}</span></div>
          </div>
        </div>
      </div>

      {/* Monthly Calendar Grid */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Attendance Calendar</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">{monthName}</span>
            <button onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-200" /><span className="text-xs text-gray-500">Present</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-200" /><span className="text-xs text-gray-500">Late</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-200" /><span className="text-xs text-gray-500">Half Day</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-200" /><span className="text-xs text-gray-500">Absent</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-100" /><span className="text-xs text-gray-500">No Record</span></div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}
          {calendarCells.map((cell, i) => (
            <div key={i} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative ${!cell.date ? 'bg-transparent' : cell.record?.status === 'present' ? 'bg-green-100 text-green-700' : cell.record?.status === 'late' ? 'bg-amber-100 text-amber-700' : cell.record?.status === 'half_day' ? 'bg-blue-100 text-blue-700' : cell.record?.status === 'absent' ? 'bg-red-100 text-red-700' : cell.isToday ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-300' : 'bg-gray-50 text-gray-400'}`}>
              {cell.day && (<><span className="font-medium">{cell.day}</span>{cell.record?.check_in && <span className="text-[8px] opacity-60 mt-0.5">{cell.record.check_in}</span>}</>)}
            </div>
          ))}
        </div>
      </div>

      {/* Recent records table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200"><h3 className="text-sm font-semibold text-gray-900">Recent Records</h3></div>
        {records.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">No attendance records found.</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead className="bg-gray-50 border-b border-gray-200"><tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Check In</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Check Out</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Hours</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Notes</th>
          </tr></thead><tbody className="divide-y divide-gray-200">{records.slice(0, 15).map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{fmtDate(a.date)}</td>
              <td className="px-4 py-3 text-sm whitespace-nowrap"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${a.status==='present'?'bg-green-100 text-green-800':a.status==='late'?'bg-amber-100 text-amber-800':a.status==='half_day'?'bg-blue-100 text-blue-800':'bg-red-100 text-red-800'}`}>{a.status.replace('_',' ')}</span></td>
              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{a.check_in || '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{a.check_out || '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{calcWorkHours(a.check_in, a.check_out) || '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{a.notes || '—'}</td>
            </tr>
          ))}</tbody></table></div>
        )}
      </div>
    </div>
  );
}
