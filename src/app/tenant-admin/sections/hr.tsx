'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus, Eye, Search, RefreshCw, Clock, DollarSign, BarChart2, Users, CheckCircle, Calendar,
  Download, MoreVertical, Award, Briefcase
} from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { AddEmployeeModal } from './hr-add-employee-modal';
import { EditEmployeeModal, ViewEmployeeModal, DeleteEmployeeModal, RunPayrollModal, PostJobModal, TrainingModal } from './hr-modals';
import { AttendanceModal, LeaveModal } from './hr-attendance-modals';
import { UnifiedReportModal } from '../components/unified-report-modal';
import { ReportService } from '../services/report-service';
import { HRService } from './hr-service';
import { RecruitmentDashboard } from './recruitment-dashboard';

type HRTab = 'overview' | 'recruitment';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string;
  status: string;
  salary: string;
}

interface TrainingSession {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'ongoing' | 'completed';
  startDate: string;
  endDate: string;
  instructor: string;
  capacity: number;
  enrolled: number;
  location?: string;
}

interface AttendanceRecord {
  id: string;
  employeeName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  hours: number;
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

interface PayrollRun {
  id: string;
  period: string;
  employeeCount: number;
  totalAmount: number;
  status: string;
  processedDate: string;
}


const HRComponent: React.FC = () => {
  const { tenantSlug } = useTenantContext();
  const [activeTab, setActiveTab] = useState<HRTab>('overview');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRunPayrollModal, setShowRunPayrollModal] = useState(false);
  const [showPostJobModal, setShowPostJobModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showUnifiedReportModal, setShowUnifiedReportModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<string[]>(['Engineering', 'Sales', 'Marketing', 'HR', 'Finance']);
  const [statuses, setStatuses] = useState<string[]>(['Active', 'On Leave', 'Terminated']);
  const [reports, setReports] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0, halfDay: 0, total: 0 });
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<PayrollRun[]>([]);

  const filteredEmployees = employees.filter((emp) => {
    if (departmentFilter !== 'All Departments' && emp.department !== departmentFilter) return false;
    if (statusFilter !== 'All Statuses' && emp.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!emp.name.toLowerCase().includes(query) && !emp.email.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  // Handler functions for modals
  const handleViewEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowViewModal(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const handleMarkAttendance = async (attendanceData: any) => {
    if (!tenantSlug) return;
    
    try {
      await HRService.markAttendance(tenantSlug, attendanceData);
    } catch (error) {
      console.error('Failed to mark attendance:', error);
      throw error;
    }
  };

  const handleSubmitLeave = async (leaveData: any) => {
    if (!tenantSlug) return;
    
    try {
      await HRService.submitLeaveRequest(tenantSlug, leaveData);
    } catch (error) {
      console.error('Failed to submit leave request:', error);
      throw error;
    }
  };

  const handleGenerateReport = async (reportData: any) => {
    if (!tenantSlug) return;
    
    try {
      const report = await ReportService.generateReport({
        module: 'hr',
        reportType: reportData.reportType,
        dateRange: reportData.dateRange,
        format: reportData.format,
        includeCharts: reportData.includeCharts,
        filters: reportData.filters,
        tenantSlug
      });
      
      setReports(prev => [report, ...prev]);
    } catch (error) {
      console.error('Failed to generate report:', error);
      throw error;
    }
  };

  const handleAddEmployee = async (employeeData: any) => {
    if (!tenantSlug) return;

    try {
      const newEmployee = await HRService.addEmployee(tenantSlug, employeeData);

      // Convert to local Employee interface
      const localEmployee: Employee = {
        id: newEmployee.id,
        name: newEmployee.name,
        email: newEmployee.email,
        department: employeeData.department,
        position: employeeData.position,
        startDate: employeeData.startDate,
        status: 'Active',
        salary: employeeData.salary || ''
      };

      setEmployees(prev => [localEmployee, ...prev]);
    } catch (error) {
      console.error('Failed to add employee:', error);
      throw error;
    }
  };

  const handleUpdateEmployee = async (data: any) => {
    if (!tenantSlug || !selectedEmployee) return;

    try {
      const updated = await HRService.updateEmployee(tenantSlug, selectedEmployee.id, data);
      setEmployees(prev =>
        prev.map(emp =>
          emp.id === selectedEmployee.id
            ? {
                id: updated.id,
                name: data.firstName || data.lastName ? `${data.firstName || ''} ${data.lastName || ''}`.trim() : emp.name,
                email: data.email || emp.email,
                department: data.department || emp.department,
                position: data.position || emp.position,
                startDate: data.startDate || emp.startDate,
                status: data.status || emp.status,
                salary: data.salary || emp.salary
              }
            : emp
        )
      );
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Failed to update employee:', error);
      throw error;
    }
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!tenantSlug || !selectedEmployee) return;

    try {
      await HRService.deleteEmployee(tenantSlug, selectedEmployee.id);
      setEmployees(prev => prev.filter(emp => emp.id !== selectedEmployee.id));
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Failed to delete employee:', error);
      throw error;
    }
  };

  const loadData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const [
        fetchedEmployees,
        fetchedDepartments,
        fetchedReports,
        fetchedAttendance,
        fetchedStats,
        fetchedLeave,
        fetchedTraining,
        fetchedPayroll
      ] = await Promise.all([
        HRService.getEmployees(tenantSlug),
        HRService.getDepartments(tenantSlug),
        HRService.getReports(tenantSlug).catch(() => []),
        HRService.getAttendanceRecords(tenantSlug, { date: today }).catch(() => []),
        HRService.getAttendanceStats(tenantSlug, today).catch(() => ({ present: 0, absent: 0, late: 0, halfDay: 0, total: 0 })),
        HRService.getLeaveRequests(tenantSlug, { status: 'pending' }).catch(() => []),
        HRService.getTrainingSessions(tenantSlug).catch(() => []),
        HRService.getPayrollHistory(tenantSlug).catch(() => []),
      ]);

      setEmployees(
        fetchedEmployees.map(emp => ({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          department: emp.department,
          position: emp.position,
          startDate: emp.startDate,
          status: emp.status,
          salary: emp.salary ? `$${Number(emp.salary).toLocaleString()}` : ''
        }))
      );
      setDepartments(fetchedDepartments);
      setReports(fetchedReports);
      setAttendanceRecords(fetchedAttendance.map((r: any) => ({
        id: r.id,
        employeeName: r.employeeName || r.employee?.name || '',
        checkIn: r.checkIn || r.check_in || '—',
        checkOut: r.checkOut || r.check_out || '—',
        status: r.status,
        hours: r.hours || 0
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
      setTrainingSessions(fetchedTraining.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description || '',
        status: (s.status as 'planned' | 'ongoing' | 'completed') || 'planned',
        startDate: s.startDate || s.start_date || '',
        endDate: s.endDate || s.end_date || '',
        instructor: s.instructor || '',
        capacity: s.capacity || 0,
        enrolled: s.enrolled || 0
      })));
      setPayrollHistory(fetchedPayroll.map((p: any) => ({
        id: p.id,
        period: p.period,
        employeeCount: p.employeeCount || 0,
        totalAmount: p.totalAmount || 0,
        status: p.status,
        processedDate: p.processedDate || p.processed_date || ''
      })));
    } catch (error) {
      console.error('Failed to load HR data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-theme-text-primary">HR & Operations Overview</h2>
          <p className="text-theme-text-secondary mt-1">Enterprise-wide human resources management and analytics</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-muted border border-theme-border rounded-lg hover:bg-theme-sidebar-hover disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Total Employees</p>
              <p className="text-3xl font-bold text-theme-text-primary mt-2">{employees.length}</p>
            </div>
            <Users className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-xs text-theme-text-tertiary mt-4">Active workforce</p>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Active</p>
              <p className="text-3xl font-bold text-green-400 mt-2">{employees.filter(e => e.status === 'Active').length}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <p className="text-xs text-theme-text-tertiary mt-4">Currently working</p>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">On Leave</p>
              <p className="text-3xl font-bold text-amber-400 mt-2">{employees.filter(e => e.status === 'On Leave').length}</p>
            </div>
            <Calendar className="w-12 h-12 text-amber-500" />
          </div>
          <p className="text-xs text-theme-text-tertiary mt-4">Temporary absence</p>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Departments</p>
              <p className="text-3xl font-bold text-theme-accent mt-2">{new Set(employees.map(e => e.department)).size}</p>
            </div>
            <Briefcase className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-xs text-theme-text-tertiary mt-4">Organizational units</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Department Distribution</h3>
          <div className="space-y-3">
            {Object.entries(
              employees.reduce<Record<string, number>>((acc, emp) => {
                acc[emp.department] = (acc[emp.department] || 0) + 1;
                return acc;
              }, {})
            ).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between">
                <span className="text-sm text-theme-text-secondary">{dept}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-theme-border rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(count / employees.length) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium text-theme-text-primary w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setShowAttendanceModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-theme-text-primary bg-theme-bg rounded-lg hover:bg-theme-sidebar-hover"
            >
              <Clock className="w-4 h-4" />
              Mark Attendance
            </button>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-theme-text-primary bg-theme-bg rounded-lg hover:bg-theme-sidebar-hover"
            >
              <Calendar className="w-4 h-4" />
              Request Leave
            </button>
            <button
              onClick={() => setShowRunPayrollModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-theme-text-primary bg-theme-bg rounded-lg hover:bg-theme-sidebar-hover"
            >
              <DollarSign className="w-4 h-4" />
              Run Payroll
            </button>
            <button
              onClick={() => setShowUnifiedReportModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-theme-text-primary bg-theme-bg rounded-lg hover:bg-theme-sidebar-hover"
            >
              <BarChart2 className="w-4 h-4" />
              Generate Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStaffTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">Staff Management</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-theme-text-tertiary" />
              <input
                type="text"
                placeholder="Name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-theme-bg w-full pl-10 pr-4 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme-text-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme-text-primary"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme-text-primary"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-theme-muted rounded-xl border border-theme-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-theme-bg border-b border-theme-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Department</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Position</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Start Date</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-primary">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-theme-sidebar-hover">
                  <td className="px-6 py-4 text-sm font-medium text-theme-text-primary">{emp.name}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{emp.email}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{emp.department}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{emp.position}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.status === 'Active' ? 'bg-green-500/10 text-green-400' :
                      emp.status === 'On Leave' ? 'bg-amber-500/10 text-amber-400' :
                      emp.status === 'Inactive' ? 'bg-theme-border text-theme-text-primary' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{emp.startDate}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-text-secondary hover:text-theme-text-secondary transition-colors"
                        title="Edit Employee"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-400 hover:text-theme-danger transition-colors"
                        title="Delete Employee"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-theme-text-secondary">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <p className="text-xs text-theme-text-secondary mb-1">Total Employees</p>
          <p className="text-2xl font-bold text-theme-text-primary">{employees.length}</p>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <p className="text-xs text-theme-text-secondary mb-1">Active</p>
          <p className="text-2xl font-bold text-green-400">{employees.filter(e => e.status === 'Active').length}</p>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <p className="text-xs text-theme-text-secondary mb-1">On Leave</p>
          <p className="text-2xl font-bold text-amber-400">{employees.filter(e => e.status === 'On Leave').length}</p>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <p className="text-xs text-theme-text-secondary mb-1">Departments</p>
          <p className="text-2xl font-bold text-theme-accent">{new Set(employees.map(e => e.department)).size}</p>
        </div>
      </div>

      <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Training & Development</h3>
        {trainingSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainingSessions.map((session) => (
              <div key={session.id} className="border border-theme-border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h5 className="font-semibold text-theme-text-primary">{session.title}</h5>
                    <p className="text-xs text-theme-text-secondary mt-1">{session.description}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${
                    session.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                    session.status === 'ongoing' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-theme-border text-theme-text-primary'
                  }`}>
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </span>
                </div>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-theme-text-secondary">Instructor:</span>
                    <span className="font-medium text-theme-text-primary">{session.instructor}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-theme-text-secondary">Enrollment:</span>
                    <span className="font-medium text-theme-text-primary">{session.enrolled}/{session.capacity}</span>
                  </div>
                </div>
                <div className="w-full bg-theme-border rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${session.capacity > 0 ? (session.enrolled / session.capacity) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-theme-text-secondary">No training sessions available.</p>
        )}
      </div>
    </div>
  );

  const renderAttendanceTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">Attendance & Leave Management</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Clock className="w-4 h-4" />
            Mark Attendance
          </button>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Calendar className="w-4 h-4" />
            Request Leave
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <p className="text-xs text-theme-text-secondary mb-1">Present Today</p>
          <p className="text-2xl font-bold text-green-400">{attendanceStats.present}</p>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <p className="text-xs text-theme-text-secondary mb-1">Absent</p>
          <p className="text-2xl font-bold text-red-400">{attendanceStats.absent}</p>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <p className="text-xs text-theme-text-secondary mb-1">Late</p>
          <p className="text-2xl font-bold text-amber-400">{attendanceStats.late}</p>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <p className="text-xs text-theme-text-secondary mb-1">Half Day</p>
          <p className="text-2xl font-bold text-theme-accent">{attendanceStats.halfDay}</p>
        </div>
      </div>

      <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Daily Attendance Records</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-theme-bg border-b border-theme-border">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Check In</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Check Out</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-theme-text-primary">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-theme-sidebar-hover">
                    <td className="px-4 py-3 font-medium text-theme-text-primary">{record.employeeName}</td>
                    <td className="px-4 py-3 text-theme-text-secondary">{record.checkIn}</td>
                    <td className="px-4 py-3 text-theme-text-secondary">{record.checkOut}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'present' ? 'bg-green-500/10 text-green-400' :
                        record.status === 'absent' ? 'bg-red-500/10 text-red-400' :
                        record.status === 'late' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-theme-border text-theme-text-primary'
                      }`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-theme-text-secondary">{record.hours}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-theme-text-secondary">
                    No attendance records for today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
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
                      className="px-2 py-1 text-xs font-medium text-green-400 bg-green-50 rounded hover:bg-green-100"
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
                      className="px-2 py-1 text-xs font-medium text-red-400 bg-red-50 rounded hover:bg-red-100"
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

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h4 className="font-semibold text-theme-text-primary mb-4">Leave Balance</h4>
          <p className="text-sm text-theme-text-secondary">Select an employee to view leave balance.</p>
        </div>
      </div>
    </div>
  );

  const renderPayrollTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">Payroll Management</h2>
        <button
          onClick={() => setShowRunPayrollModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <DollarSign className="w-4 h-4" />
          Run Payroll
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <p className="text-sm font-medium text-theme-text-secondary mb-2">Latest Payroll</p>
          <p className="text-3xl font-bold text-theme-text-primary">
            {payrollHistory.length > 0 ? `$${(payrollHistory[0].totalAmount).toLocaleString()}` : '—'}
          </p>
          <p className="text-xs text-theme-text-tertiary mt-2">
            {payrollHistory.length > 0 ? payrollHistory[0].period : 'No data'}
          </p>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <p className="text-sm font-medium text-theme-text-secondary mb-2">Annual Payroll</p>
          <p className="text-3xl font-bold text-theme-text-primary">
            ${payrollHistory.reduce((sum, p) => sum + (p.totalAmount || 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-theme-text-tertiary mt-2">Total processed</p>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <p className="text-sm font-medium text-theme-text-secondary mb-2">Average Salary</p>
          <p className="text-3xl font-bold text-theme-text-primary">
            {employees.length > 0 && employees.filter(e => e.salary).length > 0
              ? `$${Math.round(employees.filter(e => e.salary).reduce((sum, e) => sum + (parseFloat(e.salary?.replace(/[$,]/g, '') || '0') || 0), 0) / employees.filter(e => e.salary).length).toLocaleString()}`
              : '—'}
          </p>
          <p className="text-xs text-theme-text-tertiary mt-2">Per employee</p>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <p className="text-sm font-medium text-theme-text-secondary mb-2">Total Employees</p>
          <p className="text-3xl font-bold text-theme-text-primary">{employees.length}</p>
          <p className="text-xs text-theme-text-tertiary mt-2">Active workforce</p>
        </div>
      </div>

      <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Payroll Breakdown</h3>
        {payrollHistory.length > 0 ? (
          <div className="space-y-3">
            {payrollHistory.slice(0, 1).map((run) => (
              <div key={run.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-theme-text-primary">{run.period}</span>
                    <span className="text-sm font-semibold text-theme-text-primary">${run.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-theme-border rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
                <span className="ml-4 text-sm text-theme-text-secondary w-12 text-right">{run.employeeCount} emp</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-theme-text-secondary">No payroll data available.</p>
        )}
      </div>

      <div className="bg-theme-muted rounded-xl border border-theme-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-theme-bg border-b border-theme-border">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Period</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Employees</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Total Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Processed Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {payrollHistory.length > 0 ? (
              payrollHistory.map((run) => (
                <tr key={run.id} className="hover:bg-theme-sidebar-hover">
                  <td className="px-6 py-4 text-sm font-medium text-theme-text-primary">{run.period}</td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{run.employeeCount}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-theme-text-primary">${run.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      run.status === 'Paid' ? 'bg-green-500/10 text-green-400' :
                      run.status === 'Pending' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-theme-border text-theme-text-primary'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">{run.processedDate}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-theme-text-secondary">
                  No payroll history available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReportsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-theme-text-primary">HR Reports & Analytics</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUnifiedReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <BarChart2 className="w-4 h-4" />
            Generate Report
          </button>
          <button
            onClick={() => setShowUnifiedReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-muted border border-theme-border rounded-lg hover:bg-theme-sidebar-hover"
          >
            <Download className="w-4 h-4" />
            Report History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h4 className="font-semibold text-theme-text-primary mb-4">Workforce Summary</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Total Employees</span>
              <span className="font-semibold text-theme-text-primary">{employees.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Active</span>
              <span className="font-semibold text-green-400">{employees.filter(e => e.status === 'Active').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">On Leave</span>
              <span className="font-semibold text-amber-400">{employees.filter(e => e.status === 'On Leave').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Departments</span>
              <span className="font-semibold text-theme-accent">{new Set(employees.map(e => e.department)).size}</span>
            </div>
          </div>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h4 className="font-semibold text-theme-text-primary mb-4">Key Metrics</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Total Employees</span>
              <span className="font-semibold text-theme-text-primary">{employees.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Active</span>
              <span className="font-semibold text-green-400">{employees.filter(e => e.status === 'Active').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">On Leave</span>
              <span className="font-semibold text-amber-400">{employees.filter(e => e.status === 'On Leave').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-theme-text-secondary">Departments</span>
              <span className="font-semibold text-theme-accent">{new Set(employees.map(e => e.department)).size}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
        <h4 className="font-semibold text-theme-text-primary mb-4">Salary Distribution</h4>
        {employees.filter(e => e.salary).length > 0 ? (
          <div className="space-y-3">
            {(() => {
              const ranges = [
                { label: '$40K - $60K', min: 40000, max: 60000 },
                { label: '$60K - $80K', min: 60000, max: 80000 },
                { label: '$80K - $100K', min: 80000, max: 100000 },
                { label: '$100K+', min: 100000, max: Infinity },
              ];
              const withSalaries = employees.filter(e => e.salary);
              const total = withSalaries.length;
              return ranges.map((range) => {
                const count = withSalaries.filter(e => {
                  const s = parseFloat(e.salary?.replace(/[$,]/g, '') || '0');
                  return s >= range.min && s < range.max;
                }).length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={range.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-theme-text-secondary">{range.label}</span>
                      <span className="text-sm font-semibold text-theme-text-primary">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-theme-border rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <p className="text-sm text-theme-text-secondary">No salary data available.</p>
        )}
      </div>

      <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
        <h4 className="font-semibold text-theme-text-primary mb-4">Compliance Reports</h4>
        <p className="text-sm text-theme-text-secondary">Compliance reports will be generated from real audit data.</p>
      </div>
    </div>
  );

  const tabs: { id: HRTab; label: string }[] = [
    { id: 'overview', label: 'HR & Operations' },
    { id: 'recruitment', label: 'Talent Acquisition' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-theme-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-theme-accent'
                  : 'border-transparent text-theme-text-tertiary hover:text-theme-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'overview' ? renderOverviewTab() : <RecruitmentDashboard />}
      </div>

      {/* Employee Management Modals */}
      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddEmployee}
        departments={departments}
      />

      <EditEmployeeModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdateEmployee}
        employee={selectedEmployee}
        departments={departments}
        statuses={statuses}
      />

      <ViewEmployeeModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        employee={selectedEmployee}
        onEdit={() => setShowEditModal(true)}
        onAward={() => setShowTrainingModal(true)}
        onDelete={() => setShowDeleteModal(true)}
      />

      <DeleteEmployeeModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDeleteEmployee}
        employeeName={selectedEmployee?.name}
      />

      {/* Payroll & Training Modals */}
      <RunPayrollModal
        isOpen={showRunPayrollModal}
        onClose={() => setShowRunPayrollModal(false)}
        onSubmit={async (data) => {
          if (!tenantSlug) return;
          await HRService.runPayroll(tenantSlug, data);
          setShowRunPayrollModal(false);
        }}
      />

      <PostJobModal
        isOpen={showPostJobModal}
        onClose={() => setShowPostJobModal(false)}
        onSubmit={async (data) => {
          if (!tenantSlug) return;
          await HRService.postJob(tenantSlug, data);
          setShowPostJobModal(false);
        }}
        departments={departments}
      />

      <TrainingModal
        isOpen={showTrainingModal}
        onClose={() => setShowTrainingModal(false)}
        onSubmit={async (data) => {
          if (!tenantSlug) return;
          await HRService.createTrainingSession(tenantSlug, data);
          setShowTrainingModal(false);
        }}
      />

      {/* Attendance & Leave Modals */}
      <AttendanceModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
        onSubmit={handleMarkAttendance}
        employees={employees.map(emp => ({
          id: emp.id,
          name: emp.name,
          department: emp.department
        }))}
      />

      <LeaveModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onSubmit={handleSubmitLeave}
        employees={employees.map(emp => ({
          id: emp.id,
          name: emp.name,
          department: emp.department
        }))}
      />

      {/* Reports Modals */}
      <UnifiedReportModal
        isOpen={showUnifiedReportModal}
        onClose={() => setShowUnifiedReportModal(false)}
        module="hr"
        tenantSlug={tenantSlug || ''}
        onReportGenerated={(report) => {
          setReports(prev => [report, ...prev]);
        }}
      />
    </div>
  );
};

export default HRComponent;
