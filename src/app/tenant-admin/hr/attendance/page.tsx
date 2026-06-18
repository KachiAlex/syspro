'use client';

import React, { useState } from 'react';
import { Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface AttendanceRecord {
  id: string;
  employeeName: string;
  checkIn: string;
  checkOut: string;
  status: 'present' | 'absent' | 'late' | 'half-day';
  hours: number;
}

interface LeaveRequest {
  id: string;
  employeeName: string;
  type: string;
  days: number;
  from: string;
  to: string;
  status: 'pending' | 'approved' | 'rejected';
}

const DEFAULT_ATTENDANCE: AttendanceRecord[] = [
  { id: '1', employeeName: 'John Smith', checkIn: '09:00 AM', checkOut: '06:00 PM', status: 'present', hours: 9.0 },
  { id: '2', employeeName: 'Sarah Johnson', checkIn: '09:15 AM', checkOut: '06:00 PM', status: 'late', hours: 8.75 },
  { id: '3', employeeName: 'Mike Davis', checkIn: '-', checkOut: '-', status: 'absent', hours: 0 },
  { id: '4', employeeName: 'Emily Chen', checkIn: '09:00 AM', checkOut: '01:00 PM', status: 'half-day', hours: 4.0 },
  { id: '5', employeeName: 'James Wilson', checkIn: '09:00 AM', checkOut: '06:00 PM', status: 'present', hours: 9.0 },
];

const DEFAULT_LEAVE_REQUESTS: LeaveRequest[] = [
  { id: '1', employeeName: 'John Smith', type: 'Annual', days: 5, from: '2026-04-15', to: '2026-04-20', status: 'pending' },
  { id: '2', employeeName: 'Sarah Johnson', type: 'Sick', days: 2, from: '2026-04-10', to: '2026-04-12', status: 'pending' },
  { id: '3', employeeName: 'Mike Davis', type: 'Personal', days: 1, from: '2026-04-08', to: '2026-04-08', status: 'approved' },
];

export default function AttendancePage() {
  const { tenantSlug } = useTenantContext();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Attendance & Leave Management</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Present Today</p>
              <p className="text-3xl font-bold text-green-600 mt-2">4</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Employees present</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Absent</p>
              <p className="text-3xl font-bold text-red-600 mt-2">1</p>
            </div>
            <AlertCircle className="w-12 h-12 text-red-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Not present</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Late</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">1</p>
            </div>
            <Clock className="w-12 h-12 text-amber-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Arrived late</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Attendance Rate</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">96.5%</p>
            </div>
            <Calendar className="w-12 h-12 text-blue-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Monthly average</p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {DEFAULT_ATTENDANCE.map((record) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Pending Leave Requests</h4>
          <div className="space-y-3">
            {DEFAULT_LEAVE_REQUESTS.filter(r => r.status === 'pending').map((req) => (
              <div key={req.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{req.employeeName}</p>
                  <p className="text-xs text-gray-600">{req.type} • {req.days} days</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100">
                    Approve
                  </button>
                  <button className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Leave Balance</h4>
          <div className="space-y-3">
            {[
              { type: 'Annual Leave', used: 10, total: 20, remaining: 10 },
              { type: 'Sick Leave', used: 2, total: 10, remaining: 8 },
              { type: 'Personal Leave', used: 1, total: 5, remaining: 4 },
            ].map((leave, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{leave.type}</span>
                  <span className="text-sm text-gray-600">{leave.remaining}/{leave.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(leave.used / leave.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Work Schedules & Shifts</h4>
        <div className="space-y-4">
          {['Morning Shift (6 AM - 2 PM)', 'Afternoon Shift (2 PM - 10 PM)', 'Night Shift (10 PM - 6 AM)'].map((shift, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="font-semibold text-gray-900">{shift}</h5>
                <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">12 employees</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['Mon', 'Tue', 'Wed'].map((day) => (
                  <div key={day} className="text-center p-2 bg-gray-50 rounded">
                    <p className="text-xs font-medium text-gray-600">{day}</p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">12</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
