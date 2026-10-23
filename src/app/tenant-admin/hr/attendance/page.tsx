'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, AlertCircle, Calendar, QrCode, Home } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { HRService } from '@/app/tenant-admin/sections/hr-service';
import { AttendanceVerificationPanel } from '@/app/tenant-admin/components/attendance-verification-panel';

interface AttendanceRecord {
  id: string;
  employeeName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  hours: number;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInMethod: string | null;
  checkInFlagged: boolean;
  flagReason: string | null;
  workMode: string | null;
}

interface LeaveRequest {
  id: string;
  employeeId?: string;
  employeeName: string;
  leaveType: string;
  days: number;
  startDate: string;
  endDate: string;
  status: string;
}

interface LeaveUsage {
  employeeName: string;
  leaveType: string;
  usedDays: number;
}

export default function AttendancePage() {
  const { tenantSlug } = useTenantContext();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, halfDay: 0, total: 0 });
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [allLeaveRequests, setAllLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [fetchedAttendance, fetchedStats, fetchedLeave] = await Promise.all([
        HRService.getAttendanceRecords(tenantSlug, { date: selectedDate }).catch(() => []),
        HRService.getAttendanceStats(tenantSlug, selectedDate).catch(() => ({ present: 0, absent: 0, late: 0, halfDay: 0, total: 0 })),
        HRService.getLeaveRequests(tenantSlug).catch(() => []),
      ]);
      setAttendanceRecords(fetchedAttendance.map((r: any) => ({
        id: r.id,
        employeeName: r.employeeName || r.employee?.name || '',
        checkIn: r.checkIn || r.check_in || '—',
        checkOut: r.checkOut || r.check_out || '—',
        status: r.status,
        hours: r.hours || 0,
        checkInLat: r.checkInLat ?? r.check_in_lat ?? null,
        checkInLng: r.checkInLng ?? r.check_in_lng ?? null,
        checkInMethod: r.checkInMethod ?? r.check_in_method ?? null,
        checkInFlagged: !!(r.checkInFlagged ?? r.check_in_flagged),
        flagReason: r.flagReason ?? r.flag_reason ?? null,
        workMode: r.workMode ?? r.work_mode ?? null,
      })));
      setAttendanceStats(fetchedStats);

      const allLeave = fetchedLeave.map((r: any) => ({
        id: r.id,
        employeeId: r.employeeId || r.employee_id || r.employee?.id,
        employeeName: r.employeeName || r.employee?.name || r.employee_name || '',
        leaveType: r.leaveType || r.leave_type || '—',
        days: r.days || r.dayCount || r.day_count || 0,
        startDate: r.startDate || r.start_date || '—',
        endDate: r.endDate || r.end_date || '—',
        status: r.status
      }));
      setAllLeaveRequests(allLeave);
      setLeaveRequests(allLeave.filter((r) => r.status === 'pending'));
    } catch (error) {
      console.error('Failed to load attendance data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <h2 className="text-2xl font-bold text-theme-text-primary">Attendance & Leave Management</h2>
        <div className="text-center py-12 text-theme-text-secondary">Loading attendance data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-theme-text-primary">Attendance & Leave Management</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Present Today</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{attendanceStats.present}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <p className="text-xs text-theme-text-secondary mt-4">Employees present</p>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Absent</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{attendanceStats.absent}</p>
            </div>
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <p className="text-xs text-theme-text-secondary mt-4">Not present</p>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Late</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{attendanceStats.late}</p>
            </div>
            <Clock className="w-12 h-12 text-amber-500" />
          </div>
          <p className="text-xs text-theme-text-secondary mt-4">Arrived late</p>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Attendance Rate</p>
              <p className="text-3xl font-bold text-theme-accent mt-2">
                {attendanceStats.total > 0 ? `${Math.round((attendanceStats.present / attendanceStats.total) * 100)}%` : '—'}
              </p>
            </div>
            <Calendar className="w-12 h-12 text-theme-accent" />
          </div>
          <p className="text-xs text-theme-text-secondary mt-4">Daily average</p>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-theme-text-primary">Daily Attendance Records</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-theme-muted border-b border-theme-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Check In</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Check Out</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Method</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Hours</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-theme-muted">
                    <td className="px-4 py-3 font-medium text-theme-text-primary">{record.employeeName}</td>
                    <td className="px-4 py-3 text-theme-text-secondary">{record.checkIn}</td>
                    <td className="px-4 py-3 text-theme-text-secondary">{record.checkOut}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'present' ? 'bg-green-100 text-green-800' :
                        record.status === 'absent' ? 'bg-red-100 text-red-800' :
                        record.status === 'late' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-col gap-1">
                        {record.checkInMethod ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium w-fit ${
                            record.checkInMethod === 'qr_geo' ? 'bg-blue-100 text-blue-800' :
                            record.checkInMethod === 'remote_approved' ? 'bg-purple-100 text-purple-800' :
                            record.checkInMethod === 'field' ? 'bg-teal-100 text-teal-800' :
                            'bg-theme-muted text-theme-text-secondary'
                          }`}>
                            {record.checkInMethod === 'qr_geo' && <QrCode className="w-3 h-3" />}
                            {record.checkInMethod === 'remote_approved' && <Home className="w-3 h-3" />}
                            {record.checkInMethod === 'qr_geo' ? 'QR + GPS' : record.checkInMethod === 'remote_approved' ? 'Remote' : record.checkInMethod}
                          </span>
                        ) : '—'}
                        {record.checkInFlagged && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 w-fit" title={record.flagReason || ''}>
                            <AlertCircle className="w-3 h-3" />Flagged
                          </span>
                        )}
                        {record.workMode && record.workMode !== 'ONSITE' && (
                          <span className="text-theme-text-tertiary">{record.workMode}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-theme-text-secondary">{record.hours}</td>
                    <td className="px-4 py-3 text-theme-text-secondary text-xs">
                      {record.checkInLat != null ? (
                        <a href={`https://www.google.com/maps?q=${record.checkInLat},${record.checkInLng}`} target="_blank" rel="noopener noreferrer" className="text-theme-accent hover:underline">
                          {Number(record.checkInLat).toFixed(4)}, {Number(record.checkInLng).toFixed(4)}
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-theme-text-secondary">
                    No attendance records for selected date
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Geofenced check-in management */}
      <AttendanceVerificationPanel tenantSlug={tenantSlug} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h4 className="font-semibold text-theme-text-primary mb-4">Pending Leave Requests</h4>
          {leaveRequests.length > 0 ? (
            <div className="space-y-3">
              {leaveRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 border border-theme-border rounded-lg">
                  <div>
                    <p className="font-medium text-theme-text-primary">{req.employeeName}</p>
                    <p className="text-xs text-theme-text-secondary">{req.leaveType} • {req.days} days</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!tenantSlug) return;
                        try {
                          await HRService.updateLeaveStatus(tenantSlug, req.id, 'approved');
                          setLeaveRequests(prev => prev.filter(r => r.id !== req.id));
                        } catch (err) {
                          console.error('Failed to approve leave:', err);
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        if (!tenantSlug) return;
                        try {
                          await HRService.updateLeaveStatus(tenantSlug, req.id, 'rejected');
                          setLeaveRequests(prev => prev.filter(r => r.id !== req.id));
                        } catch (err) {
                          console.error('Failed to reject leave:', err);
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-theme-text-secondary">No pending leave requests.</p>
          )}
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h4 className="font-semibold text-theme-text-primary mb-4">On Leave ({new Date(selectedDate).toLocaleDateString()})</h4>
          {(() => {
            const onLeave = allLeaveRequests.filter(
              (r) => r.status === 'approved' && r.startDate <= selectedDate && r.endDate >= selectedDate
            );
            return onLeave.length > 0 ? (
              <div className="space-y-2">
                {onLeave.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-2 border border-theme-border rounded">
                    <div>
                      <p className="text-sm font-medium text-theme-text-primary">{r.employeeName}</p>
                      <p className="text-xs text-theme-text-secondary">{r.leaveType} · {r.startDate} → {r.endDate}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-theme-text-secondary">No employees on approved leave for this date.</p>
            );
          })()}
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
        <h4 className="font-semibold text-theme-text-primary mb-4">Leave Used ({new Date(selectedDate).getFullYear()} YTD)</h4>
        {(() => {
          const year = selectedDate.slice(0, 4);
          const usage = new Map<string, LeaveUsage>();
          for (const r of allLeaveRequests) {
            if (r.status !== 'approved' || !r.startDate.startsWith(year)) continue;
            const key = `${r.employeeId || r.employeeName}:${r.leaveType}`;
            const cur = usage.get(key) || { employeeName: r.employeeName, leaveType: r.leaveType, usedDays: 0 };
            cur.usedDays += r.days || 0;
            usage.set(key, cur);
          }
          const rows = Array.from(usage.values()).sort((a, b) => b.usedDays - a.usedDays);
          return rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-theme-muted border-b border-theme-border">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-theme-text-primary">Employee</th>
                    <th className="px-4 py-2 text-left font-semibold text-theme-text-primary">Leave Type</th>
                    <th className="px-4 py-2 text-right font-semibold text-theme-text-primary">Days Used</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {rows.map((u, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-theme-text-primary">{u.employeeName}</td>
                      <td className="px-4 py-2 text-theme-text-secondary capitalize">{u.leaveType}</td>
                      <td className="px-4 py-2 text-right font-medium text-theme-text-primary">{u.usedDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-theme-text-secondary">No approved leave recorded this year.</p>
          );
        })()}
      </div>
    </div>
  );
}
