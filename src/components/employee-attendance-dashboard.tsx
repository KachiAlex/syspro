import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, AlertCircle, TrendingUp, Activity, Play, Pause, Coffee, Calendar } from 'lucide-react';

interface DailyAttendance {
  workDate: string;
  mode: 'ONSITE' | 'REMOTE' | 'HYBRID' | 'FIELD' | 'LEAVE' | 'TRAINING';
  confidenceScore: number;
  status: 'PRESENT' | 'PRESENT_LOW_CONFIDENCE' | 'ABSENT' | 'ON_LEAVE' | 'TRAINING';
  checkInTime?: string;
  checkOutTime?: string;
  taskCount: number;
  timeLogged: number;
  meetingsAttended: number;
  flags: string[];
}

interface TimesheetEntry {
  id: string;
  tenantId: string;
  employeeId: string;
  workDate: string;
  entryType: 'CHECK_IN' | 'CHECK_OUT' | 'BREAK_START' | 'BREAK_END' | 'MEETING_START' | 'MEETING_END' | 'TASK_START' | 'TASK_END';
  timestamp: string;
  description?: string;
  taskId?: string;
  meetingId?: string;
  location?: string;
  notes?: string;
  createdAt: string;
}

export default function EmployeeAttendanceDashboard({
  tenantSlug: propTenantSlug,
  employeeId: propEmployeeId,
}: {
  tenantSlug?: string | null;
  employeeId?: string;
} = {}) {
  // Use provided props or generate defaults
  const [tenantSlug] = useState(() => propTenantSlug || "default");
  const [employeeId] = useState(() => propEmployeeId || `user-${Date.now()}`);
  
  const [todayAttendance, setTodayAttendance] = useState<DailyAttendance | null>(null);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [workMode, setWorkMode] = useState<'ONSITE' | 'REMOTE' | 'HYBRID' | 'FIELD' | 'LEAVE' | 'TRAINING'>('ONSITE');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [recentRecords, setRecentRecords] = useState<DailyAttendance[]>([]);
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>([]);

  // Helper function to transform API record to component format
  const transformRecord = (record: any): DailyAttendance => ({
    workDate: record.workDate,
    mode: record.workMode,
    confidenceScore: record.confidenceScore,
    status: record.attendanceStatus,
    checkInTime: record.checkInTime,
    checkOutTime: record.checkOutTime,
    taskCount: record.taskActivityCount,
    timeLogged: record.timeLoggedHours || 0,
    meetingsAttended: record.meetingsAttended,
    flags: [], // TODO: implement flags from signals
  });

  // Fetch today's attendance
  useEffect(() => {
    const fetchToday = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(
          `/api/attendance?action=today&tenantSlug=${tenantSlug}&employeeId=${employeeId}`
        );
        const data = await res.json();
        console.log('Attendance fetch response:', data);
        
        if (data.records && data.records.length > 0) {
          // Transform API record to component format
          const transformedRecord = transformRecord(data.records[0]);
          setTodayAttendance(transformedRecord);
          setIsCheckedIn(!!data.records[0].checkInTime);
          setWorkMode(data.records[0].workMode);
        }
        
        // Fetch last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const startDate = sevenDaysAgo.toISOString().split('T')[0];
        const endDate = today;
        
        const weekRes = await fetch(
          `/api/attendance?startDate=${startDate}&endDate=${endDate}&tenantSlug=${tenantSlug}&employeeId=${employeeId}`
        );
        const weekData = await weekRes.json();
        // Transform records to component format
        const transformedRecords = (weekData.records || []).map(transformRecord);
        setRecentRecords(transformedRecords);

        // Fetch today's timesheet entries
        const timesheetRes = await fetch(
          `/api/attendance/timesheet?tenantSlug=${tenantSlug}&employeeId=${employeeId}&workDate=${today}`
        );
        const timesheetData = await timesheetRes.json();
        setTimesheetEntries(timesheetData.entries || []);
      } catch (error) {
        console.error('Failed to fetch attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchToday();
  }, [tenantSlug, employeeId]);

  const handleCheckIn = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-in',
          tenantSlug,
          employeeId,
          workDate: today,
          workMode,
        }),
      });

      const data = await res.json();
      console.log('Check-in response:', data);
      if (res.ok) {
        setTodayAttendance(transformRecord(data.record));
        setIsCheckedIn(true);
        setToast('✓ Check-in successful');
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast(`✗ Check-in failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Check-in error:', error);
      setToast('✗ Error during check-in');
    }
  };

  const handleCheckOut = async () => {
    if (!tenantSlug || !todayAttendance) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-out',
          tenantSlug,
          employeeId,
          workDate: today,
        }),
      });

      const data = await res.json();
      console.log('Check-out response:', data);
      if (res.ok) {
        setTodayAttendance(transformRecord(data.record));
        setToast('✓ Check-out recorded');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (error) {
      console.error('Check-out error:', error);
      setToast('✗ Error during check-out');
    }
  };

  const handleModeChange = async (newMode: DailyAttendance['mode']) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set-mode',
          tenantSlug,
          employeeId,
          workDate: today,
          workMode: newMode,
        }),
      });

      const data = await res.json();
      console.log('Mode change response:', data);
      if (res.ok) {
        setTodayAttendance(transformRecord(data.record));
        setWorkMode(newMode);
        setToast(`✓ Mode changed to ${newMode}`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch (error) {
      console.error('Mode change error:', error);
    }
  };

  const handleTimesheetEntry = async (entryType: TimesheetEntry['entryType'], description?: string) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/attendance/timesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          employeeId,
          workDate: today,
          entryType,
          description,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        // Refresh timesheet entries
        const timesheetRes = await fetch(
          `/api/attendance/timesheet?tenantSlug=${tenantSlug}&employeeId=${employeeId}&workDate=${today}`
        );
        const timesheetData = await timesheetRes.json();
        setTimesheetEntries(timesheetData.entries || []);
        setToast(`✓ ${entryType.replace('_', ' ')} logged`);
        setTimeout(() => setToast(null), 3000);
      }
    } catch (error) {
      console.error('Timesheet entry error:', error);
      setToast('✗ Error logging timesheet entry');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading attendance...</div>;
  }

  const modeColors: Record<DailyAttendance['mode'], string> = {
    'ONSITE': 'bg-blue-50 border-blue-200 text-blue-700',
    'REMOTE': 'bg-purple-50 border-purple-200 text-purple-700',
    'HYBRID': 'bg-amber-50 border-amber-200 text-amber-700',
    'FIELD': 'bg-green-50 border-green-200 text-green-700',
    'LEAVE': 'bg-red-50 border-red-200 text-red-700',
    'TRAINING': 'bg-indigo-50 border-indigo-200 text-indigo-700',
  };

  const confidenceColor = todayAttendance
    ? todayAttendance.confidenceScore >= 70
      ? 'text-emerald-600'
      : todayAttendance.confidenceScore >= 40
      ? 'text-amber-600'
      : 'text-red-600'
    : 'text-slate-400';

  return (
    <div className="space-y-6">
      {/* Quick Actions Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Today's Attendance</h2>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          {/* Check-in/out Buttons */}
          <div className="space-y-3">
            <p className="text-xs uppercase text-slate-400 font-medium">Quick Actions</p>
            <div className="flex gap-2">
              <button
                onClick={handleCheckIn}
                disabled={isCheckedIn}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium transition-all ${
                  isCheckedIn
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <LogIn size={18} />
                Check In
              </button>
              <button
                onClick={handleCheckOut}
                disabled={!isCheckedIn}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-medium transition-all ${
                  !isCheckedIn
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <LogOut size={18} />
                Check Out
              </button>
            </div>
            {todayAttendance?.checkInTime && (
              <p className="text-xs text-slate-600 font-mono">
                Check-in: {new Date(todayAttendance.checkInTime).toLocaleTimeString()}
              </p>
            )}
          </div>

          {/* Work Mode Selector */}
          <div className="space-y-3">
            <p className="text-xs uppercase text-slate-400 font-medium">Work Mode</p>
            <div className="flex gap-2 flex-wrap">
              {(['ONSITE', 'REMOTE', 'HYBRID', 'FIELD'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeChange(mode)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    workMode === mode
                      ? `${modeColors[mode]} border-current`
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Meter */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase text-slate-400 font-medium mb-4">Attendance Confidence</p>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="h-12 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full flex items-center justify-center font-bold text-white transition-all ${
                  (todayAttendance?.confidenceScore ?? 0) >= 70
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                    : (todayAttendance?.confidenceScore ?? 0) >= 40
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                    : 'bg-gradient-to-r from-red-500 to-red-600'
                }`}
                style={{ width: `${todayAttendance?.confidenceScore ?? 0}%` }}
              >
                {(todayAttendance?.confidenceScore ?? 0).toFixed(0)}%
              </div>
            </div>
          </div>
          <div className={`text-3xl font-bold ${confidenceColor}`}>
            {todayAttendance?.confidenceScore.toFixed(1) ?? '0'}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          {todayAttendance?.status === 'PRESENT'
            ? '✓ Present'
            : todayAttendance?.status === 'PRESENT_LOW_CONFIDENCE'
            ? '⚠ Present (Low Confidence)'
            : '✗ Absent'}
        </p>
      </div>

      {/* Today's Activity */}
      {todayAttendance && (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase text-slate-400 font-medium mb-4">Today's Activity</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
              <Activity size={20} className="text-blue-600" />
              <div>
                <p className="text-xs text-slate-600">Tasks Completed</p>
                <p className="text-xl font-bold text-slate-900">{todayAttendance.taskCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
              <Clock size={20} className="text-emerald-600" />
              <div>
                <p className="text-xs text-slate-600">Hours Logged</p>
                <p className="text-xl font-bold text-slate-900">{todayAttendance.timeLogged.toFixed(1)}h</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
              <TrendingUp size={20} className="text-purple-600" />
              <div>
                <p className="text-xs text-slate-600">Meetings Attended</p>
                <p className="text-xl font-bold text-slate-900">{todayAttendance.meetingsAttended}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daily Timesheet */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase text-slate-400 font-medium mb-1">Daily Timesheet</p>
            <p className="text-sm text-slate-600">Track your work sessions and breaks</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleTimesheetEntry('BREAK_START', 'Break started')}
              disabled={!isCheckedIn}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Coffee size={16} />
              Start Break
            </button>
            <button
              onClick={() => handleTimesheetEntry('BREAK_END', 'Break ended')}
              disabled={!isCheckedIn}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={16} />
              End Break
            </button>
          </div>
        </div>

        {/* Timesheet Timeline */}
        <div className="space-y-3">
          {timesheetEntries.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Calendar size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No timesheet entries yet</p>
              <p className="text-xs">Check in to start tracking your time</p>
            </div>
          ) : (
            timesheetEntries.map((entry, index) => {
              const entryTime = new Date(entry.timestamp);
              const isLast = index === timesheetEntries.length - 1;
              
              const getEntryIcon = (type: TimesheetEntry['entryType']) => {
                switch (type) {
                  case 'CHECK_IN': return <LogIn size={16} className="text-emerald-600" />;
                  case 'CHECK_OUT': return <LogOut size={16} className="text-amber-600" />;
                  case 'BREAK_START': return <Coffee size={16} className="text-amber-600" />;
                  case 'BREAK_END': return <Play size={16} className="text-emerald-600" />;
                  default: return <Clock size={16} className="text-slate-600" />;
                }
              };

              const getEntryColor = (type: TimesheetEntry['entryType']) => {
                switch (type) {
                  case 'CHECK_IN': return 'border-emerald-200 bg-emerald-50';
                  case 'CHECK_OUT': return 'border-amber-200 bg-amber-50';
                  case 'BREAK_START': return 'border-amber-200 bg-amber-50';
                  case 'BREAK_END': return 'border-emerald-200 bg-emerald-50';
                  default: return 'border-slate-200 bg-slate-50';
                }
              };

              return (
                <div key={entry.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${getEntryColor(entry.entryType)}`}>
                      {getEntryIcon(entry.entryType)}
                    </div>
                    {!isLast && <div className="w-px h-8 bg-slate-200 mt-2"></div>}
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-900">
                        {entry.entryType.replace('_', ' ')}
                      </p>
                      <p className="text-sm text-slate-500 font-mono">
                        {entryTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {entry.description && (
                      <p className="text-sm text-slate-600 mt-1">{entry.description}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Timesheet Summary */}
        {timesheetEntries.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Total Hours</p>
                <p className="font-bold text-slate-900">
                  {(() => {
                    const checkInEntry = timesheetEntries.find(e => e.entryType === 'CHECK_IN');
                    const checkOutEntry = timesheetEntries.find(e => e.entryType === 'CHECK_OUT');
                    if (checkInEntry && checkOutEntry) {
                      const hours = (new Date(checkOutEntry.timestamp).getTime() - new Date(checkInEntry.timestamp).getTime()) / (1000 * 60 * 60);
                      return hours.toFixed(1) + 'h';
                    }
                    return '0.0h';
                  })()}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Break Time</p>
                <p className="font-bold text-slate-900">
                  {(() => {
                    let totalBreakTime = 0;
                    let breakStart: Date | null = null;
                    
                    timesheetEntries.forEach(entry => {
                      if (entry.entryType === 'BREAK_START') {
                        breakStart = new Date(entry.timestamp);
                      } else if (entry.entryType === 'BREAK_END' && breakStart) {
                        totalBreakTime += (new Date(entry.timestamp).getTime() - breakStart.getTime());
                        breakStart = null;
                      }
                    });
                    
                    const hours = totalBreakTime / (1000 * 60 * 60);
                    return hours.toFixed(1) + 'h';
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Flags/Alerts */}
      {todayAttendance?.flags && todayAttendance.flags.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="flex gap-3">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 mb-2">Attention</p>
              <ul className="space-y-1">
                {todayAttendance.flags.map((flag) => (
                  <li key={flag} className="text-sm text-amber-700">
                    • {flag.replace(/_/g, ' ')}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Recent History */}
      {recentRecords.length > 0 && (
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase text-slate-400 font-medium mb-4">Last 7 Days</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Mode</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Score</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentRecords.map((record) => (
                  <tr key={record.workDate} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-900">
                      {new Date(record.workDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${modeColors[record.mode]}`}>
                        {record.mode}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono font-bold">{record.confidenceScore.toFixed(0)}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium ${
                        record.status === 'PRESENT' ? 'text-emerald-600' :
                        record.status === 'PRESENT_LOW_CONFIDENCE' ? 'text-amber-600' :
                        record.status === 'ON_LEAVE' ? 'text-blue-600' :
                        'text-red-600'
                      }`}>
                        {record.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
