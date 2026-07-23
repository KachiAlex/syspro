'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { HRService } from '@/app/tenant-admin/sections/hr-service';

interface AttendanceRecord {
  id: string;
  employeeName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  hours: number;
  checkInLat: number | null;
  checkInLng: number | null;
}

interface LeaveRequest {
  id: string;
  employeeName: string;
  leaveType: string;
  days: number;
  startDate: string;
  endDate: string;
  status: string;
}

export default function AttendancePage() {
  const { tenantSlug } = useTenantContext();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, halfDay: 0, total: 0 });
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [fetchedAttendance, fetchedStats, fetchedLeave] = await Promise.all([
        HRService.getAttendanceRecords(tenantSlug, { date: selectedDate }).catch(() => []),
        HRService.getAttendanceStats(tenantSlug, selectedDate).catch(() => ({ present: 0, absent: 0, late: 0, halfDay: 0, total: 0 })),
        HRService.getLeaveRequests(tenantSlug, { status: 'pending' }).catch(() => []),
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
      })));
      setAttendanceStats(fetchedStats);
      setLeaveRequests(fetchedLeave.map((r: any) => ({
        id: r.id,
        employeeName: r.employeeName || r.employee?.name || '',
        leaveType: r.leaveType || r.leave_type || '—',
        days: r.days || r.dayCount || 0,
        startDate: r.startDate || r.start_date || '—',
        endDate: r.endDate || r.end_date || '—',
        status: r.status
      })));
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
        <h2 className="text-2xl font-bold text-gray-900">Attendance & Leave Management</h2>
        <div className="text-center py-12 text-gray-500">Loading attendance data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Attendance & Leave Management</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Present Today</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{attendanceStats.present}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Employees present</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Absent</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{attendanceStats.absent}</p>
            </div>
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Not present</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Late</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{attendanceStats.late}</p>
            </div>
            <Clock className="w-12 h-12 text-amber-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Arrived late</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {attendanceStats.total > 0 ? `${Math.round((attendanceStats.present / attendanceStats.total) * 100)}%` : '—'}
              </p>
            </div>
            <Calendar className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Daily average</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Daily Attendance Records</h3>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Check In</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Check Out</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Hours</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{record.employeeName}</td>
                    <td className="px-4 py-3 text-gray-600">{record.checkIn}</td>
                    <td className="px-4 py-3 text-gray-600">{record.checkOut}</td>
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
                    <td className="px-4 py-3 text-gray-600">{record.hours}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {record.checkInLat != null ? (
                        <a href={`https://www.google.com/maps?q=${record.checkInLat},${record.checkInLng}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          {Number(record.checkInLat).toFixed(4)}, {Number(record.checkInLng).toFixed(4)}
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-600">
                    No attendance records for selected date
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Pending Leave Requests</h4>
          {leaveRequests.length > 0 ? (
            <div className="space-y-3">
              {leaveRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{req.employeeName}</p>
                    <p className="text-xs text-gray-600">{req.leaveType} • {req.days} days</p>
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
            <p className="text-sm text-gray-600">No pending leave requests.</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Leave Balance</h4>
          <p className="text-sm text-gray-600">Select an employee to view leave balance.</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Work Schedules & Shifts</h4>
        <p className="text-sm text-gray-600">Work schedules will be populated from the scheduling system.</p>
      </div>
    </div>
  );
}
