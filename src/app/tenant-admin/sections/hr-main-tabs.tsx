'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, Clock, FileText, DollarSign, Plus, Eye, Edit, Trash2, 
  Download, Filter, RefreshCw, CheckCircle, AlertCircle, TrendingUp,
  Calendar, BarChart3, Award
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string;
  status: string;
  performance: string;
  salary: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Leave';
  checkInTime?: string;
  checkOutTime?: string;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  period: string;
  baseSalary: number;
  deductions: number;
  netSalary: number;
  status: 'Pending' | 'Processed' | 'Paid';
}

interface HRMainTabsProps {
  tenantSlug: string;
  employees: Employee[];
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onViewEmployee: (employee: Employee) => void;
}

export default function HRMainTabs({
  tenantSlug,
  employees,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onViewEmployee,
}: HRMainTabsProps) {
  const [activeTab, setActiveTab] = useState<'staff' | 'attendance' | 'reports' | 'payroll'>('staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Staff Tab State
  const [staffSearch, setStaffSearch] = useState('');
  const [staffDepartmentFilter, setStaffDepartmentFilter] = useState('All');

  // Attendance Tab State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

  // Payroll Tab State
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [payrollPeriod, setPayrollPeriod] = useState(new Date().toISOString().slice(0, 7));

  // Auto-dismiss alerts
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Initialize on mount
  useEffect(() => {
    setLastRefreshed(new Date());
    fetchTabData();
  }, [tenantSlug]);

  const fetchTabData = async () => {
    setLoading(true);
    try {
      const [attendanceRes, payrollRes] = await Promise.all([
        apiClient.get(`/api/tenant/attendance?tenantSlug=${tenantSlug}&date=${attendanceDate}`).catch(() => ({ data: { data: [] } })),
        apiClient.get(`/api/tenant/payroll?tenantSlug=${tenantSlug}&period=${payrollPeriod}`).catch(() => ({ data: { data: [] } }))
      ]);

      setAttendanceRecords(attendanceRes.data?.data || []);
      setPayrollRecords(payrollRes.data?.data || []);
      setLastRefreshed(new Date());
    } catch (err) {
      setError('Failed to load HR data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchTabData();
    setSuccess('HR data refreshed successfully');
  };

  const handleMarkAttendance = async (employeeId: string, status: string) => {
    try {
      await apiClient.post(`/api/tenant/attendance?tenantSlug=${tenantSlug}`, {
        employeeId,
        date: attendanceDate,
        status,
        tenantSlug
      });
      setSuccess('Attendance marked successfully');
      await fetchTabData();
    } catch (err) {
      setError('Failed to mark attendance');
    }
  };

  const handleRunPayroll = async () => {
    try {
      await apiClient.post(`/api/tenant/payroll/run?tenantSlug=${tenantSlug}`, {
        period: payrollPeriod,
        tenantSlug
      });
      setSuccess('Payroll run successfully');
      await fetchTabData();
    } catch (err) {
      setError('Failed to run payroll');
    }
  };

  const handleExportReport = async () => {
    try {
      const csv = [
        ['Name', 'Email', 'Department', 'Position', 'Status', 'Salary'],
        ...employees.map(e => [e.name, e.email, e.department, e.position, e.status, e.salary])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hr-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccess('Report exported successfully');
    } catch (err) {
      setError('Failed to export report');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
                         emp.email.toLowerCase().includes(staffSearch.toLowerCase());
    const matchesDepartment = staffDepartmentFilter === 'All' || emp.department === staffDepartmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const departments = ['All', ...new Set(employees.map(e => e.department))];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 text-sm">
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'staff'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Staff
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'attendance'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-2" />
            Attendance
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'reports'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Reports
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'payroll'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <DollarSign className="w-4 h-4 inline mr-2" />
            Payroll
          </button>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {lastRefreshed && (
        <p className="text-xs text-gray-500">
          Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Staff Tab */}
      {activeTab === 'staff' && (
        <StaffTab
          employees={filteredEmployees}
          departments={departments}
          staffSearch={staffSearch}
          staffDepartmentFilter={staffDepartmentFilter}
          onSearchChange={setStaffSearch}
          onDepartmentChange={setStaffDepartmentFilter}
          onAddEmployee={onAddEmployee}
          onEditEmployee={onEditEmployee}
          onDeleteEmployee={onDeleteEmployee}
          onViewEmployee={onViewEmployee}
          loading={loading}
        />
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <AttendanceTab
          attendanceRecords={attendanceRecords}
          employees={employees}
          attendanceDate={attendanceDate}
          onDateChange={setAttendanceDate}
          onMarkAttendance={handleMarkAttendance}
          loading={loading}
        />
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <ReportsTab
          employees={employees}
          attendanceRecords={attendanceRecords}
          payrollRecords={payrollRecords}
          onExportReport={handleExportReport}
          loading={loading}
        />
      )}

      {/* Payroll Tab */}
      {activeTab === 'payroll' && (
        <PayrollTab
          payrollRecords={payrollRecords}
          payrollPeriod={payrollPeriod}
          onPeriodChange={setPayrollPeriod}
          onRunPayroll={handleRunPayroll}
          loading={loading}
        />
      )}
    </div>
  );
}

// Staff Tab Component
function StaffTab({
  employees,
  departments,
  staffSearch,
  staffDepartmentFilter,
  onSearchChange,
  onDepartmentChange,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  onViewEmployee,
  loading,
}: {
  employees: Employee[];
  departments: string[];
  staffSearch: string;
  staffDepartmentFilter: string;
  onSearchChange: (search: string) => void;
  onDepartmentChange: (dept: string) => void;
  onAddEmployee: () => void;
  onEditEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onViewEmployee: (emp: Employee) => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Staff Directory</h3>
        <button
          onClick={onAddEmployee}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={staffSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={staffDepartmentFilter}
          onChange={(e) => onDepartmentChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {departments.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-2">No employees found</p>
          <p className="text-sm text-gray-500 mb-4">Add your first employee to get started</p>
          <button
            onClick={onAddEmployee}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map(emp => (
            <div key={emp.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{emp.name}</h4>
                  <p className="text-sm text-gray-600">{emp.position} • {emp.department}</p>
                  <p className="text-xs text-gray-500 mt-1">{emp.email}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    emp.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                    emp.status === 'On Leave' ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {emp.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  <p>Started: {emp.startDate}</p>
                  <p>Salary: {emp.salary}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onViewEmployee(emp)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="View employee"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onEditEmployee(emp)}
                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title="Edit employee"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteEmployee(emp.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete employee"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Attendance Tab Component
function AttendanceTab({
  attendanceRecords,
  employees,
  attendanceDate,
  onDateChange,
  onMarkAttendance,
  loading,
}: {
  attendanceRecords: AttendanceRecord[];
  employees: Employee[];
  attendanceDate: string;
  onDateChange: (date: string) => void;
  onMarkAttendance: (employeeId: string, status: string) => void;
  loading: boolean;
}) {
  const presentCount = attendanceRecords.filter(r => r.status === 'Present').length;
  const absentCount = attendanceRecords.filter(r => r.status === 'Absent').length;
  const lateCount = attendanceRecords.filter(r => r.status === 'Late').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Attendance</h3>
        <input
          type="date"
          value={attendanceDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Present</p>
          <p className="text-3xl font-bold text-emerald-600">{presentCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Absent</p>
          <p className="text-3xl font-bold text-red-600">{absentCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Late</p>
          <p className="text-3xl font-bold text-amber-600">{lateCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">On Leave</p>
          <p className="text-3xl font-bold text-blue-600">{attendanceRecords.filter(r => r.status === 'Leave').length}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : attendanceRecords.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-2">No attendance records</p>
          <p className="text-sm text-gray-500">Mark attendance for employees on this date</p>
        </div>
      ) : (
        <div className="space-y-3">
          {attendanceRecords.map(record => (
            <div key={record.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{record.employeeName}</h4>
                  <p className="text-sm text-gray-600">{record.date}</p>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  record.status === 'Present' ? 'bg-emerald-100 text-emerald-800' :
                  record.status === 'Absent' ? 'bg-red-100 text-red-800' :
                  record.status === 'Late' ? 'bg-amber-100 text-amber-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  {record.status}
                </span>
              </div>
              {record.checkInTime && (
                <p className="text-xs text-gray-500 mt-2">
                  Check-in: {record.checkInTime} {record.checkOutTime && `• Check-out: ${record.checkOutTime}`}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Reports Tab Component
function ReportsTab({
  employees,
  attendanceRecords,
  payrollRecords,
  onExportReport,
  loading,
}: {
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  payrollRecords: PayrollRecord[];
  onExportReport: () => void;
  loading: boolean;
}) {
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const avgAttendance = attendanceRecords.length > 0
    ? Math.round((attendanceRecords.filter(r => r.status === 'Present').length / attendanceRecords.length) * 100)
    : 0;
  const totalPayroll = payrollRecords.reduce((sum, r) => sum + r.netSalary, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">HR Reports</h3>
        <button
          onClick={onExportReport}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Employees</p>
              <p className="text-3xl font-bold text-gray-900">{totalEmployees}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Employees</p>
              <p className="text-3xl font-bold text-gray-900">{activeEmployees}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Avg Attendance</p>
              <p className="text-3xl font-bold text-gray-900">{avgAttendance}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Payroll</p>
              <p className="text-3xl font-bold text-gray-900">${(totalPayroll / 1000).toFixed(0)}K</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Available Reports</h4>
        <div className="space-y-3">
          <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between">
            <span className="font-medium text-gray-900">Employee Directory Report</span>
            <Download className="w-4 h-4 text-gray-600" />
          </button>
          <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between">
            <span className="font-medium text-gray-900">Attendance Summary Report</span>
            <Download className="w-4 h-4 text-gray-600" />
          </button>
          <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between">
            <span className="font-medium text-gray-900">Payroll Summary Report</span>
            <Download className="w-4 h-4 text-gray-600" />
          </button>
          <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between">
            <span className="font-medium text-gray-900">Department Analytics Report</span>
            <Download className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Payroll Tab Component
function PayrollTab({
  payrollRecords,
  payrollPeriod,
  onPeriodChange,
  onRunPayroll,
  loading,
}: {
  payrollRecords: PayrollRecord[];
  payrollPeriod: string;
  onPeriodChange: (period: string) => void;
  onRunPayroll: () => void;
  loading: boolean;
}) {
  const pendingCount = payrollRecords.filter(r => r.status === 'Pending').length;
  const processedCount = payrollRecords.filter(r => r.status === 'Processed').length;
  const paidCount = payrollRecords.filter(r => r.status === 'Paid').length;
  const totalAmount = payrollRecords.reduce((sum, r) => sum + r.netSalary, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Payroll Management</h3>
        <div className="flex gap-2">
          <input
            type="month"
            value={payrollPeriod}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={onRunPayroll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Run Payroll
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Pending</p>
          <p className="text-3xl font-bold text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Processed</p>
          <p className="text-3xl font-bold text-blue-600">{processedCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Paid</p>
          <p className="text-3xl font-bold text-emerald-600">{paidCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600 mb-1">Total Amount</p>
          <p className="text-3xl font-bold text-gray-900">${(totalAmount / 1000).toFixed(0)}K</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      ) : payrollRecords.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-2">No payroll records</p>
          <p className="text-sm text-gray-500 mb-4">Run payroll to generate records for this period</p>
          <button
            onClick={onRunPayroll}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Run Payroll
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {payrollRecords.map(record => (
            <div key={record.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{record.employeeName}</h4>
                  <p className="text-sm text-gray-600">Period: {record.period}</p>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  record.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                  record.status === 'Processed' ? 'bg-blue-100 text-blue-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {record.status}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Base Salary</p>
                  <p className="text-sm font-semibold text-gray-900">${record.baseSalary.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Deductions</p>
                  <p className="text-sm font-semibold text-red-600">-${record.deductions.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net Salary</p>
                  <p className="text-sm font-semibold text-emerald-600">${record.netSalary.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
