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

type HRTab = 'overview';

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
        name: `${newEmployee.firstName} ${newEmployee.lastName}`,
        email: newEmployee.email,
        department: newEmployee.department,
        position: newEmployee.position,
        startDate: newEmployee.startDate,
        status: 'Active',
        salary: newEmployee.salary || ''
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
                name: `${updated.firstName} ${updated.lastName}`,
                email: updated.email,
                department: updated.department,
                position: updated.position,
                startDate: updated.startDate,
                status: updated.status,
                salary: updated.salary || ''
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
          <h2 className="text-2xl font-bold text-[#F8FAFC]">HR & Operations Overview</h2>
          <p className="text-[#94A3B8] mt-1">Enterprise-wide human resources management and analytics</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#F8FAFC] bg-[#111827] border border-[rgba(255,255,255,0.1)] rounded-lg hover:bg-[rgba(255,255,255,0.02)] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#94A3B8]">Total Employees</p>
              <p className="text-3xl font-bold text-[#F8FAFC] mt-2">{employees.length}</p>
            </div>
            <Users className="w-12 h-12 text-blue-100" />
          </div>
          <p className="text-xs text-[#64748B] mt-4">Active workforce</p>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#94A3B8]">Active</p>
              <p className="text-3xl font-bold text-green-400 mt-2">{employees.filter(e => e.status === 'Active').length}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-100" />
          </div>
          <p className="text-xs text-[#64748B] mt-4">Currently working</p>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#94A3B8]">On Leave</p>
              <p className="text-3xl font-bold text-amber-400 mt-2">{employees.filter(e => e.status === 'On Leave').length}</p>
            </div>
            <Calendar className="w-12 h-12 text-amber-100" />
          </div>
          <p className="text-xs text-[#64748B] mt-4">Temporary absence</p>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#94A3B8]">Departments</p>
              <p className="text-3xl font-bold text-[#818CF8] mt-2">{new Set(employees.map(e => e.department)).size}</p>
            </div>
            <Briefcase className="w-12 h-12 text-blue-100" />
          </div>
          <p className="text-xs text-[#64748B] mt-4">Organizational units</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Department Distribution</h3>
          <div className="space-y-3">
            {Object.entries(
              employees.reduce<Record<string, number>>((acc, emp) => {
                acc[emp.department] = (acc[emp.department] || 0) + 1;
                return acc;
              }, {})
            ).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between">
                <span className="text-sm text-[#94A3B8]">{dept}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-[rgba(255,255,255,0.1)] rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(count / employees.length) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium text-[#F8FAFC] w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setShowAttendanceModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#F8FAFC] bg-[#0B1120] rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
            >
              <Clock className="w-4 h-4" />
              Mark Attendance
            </button>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#F8FAFC] bg-[#0B1120] rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
            >
              <Calendar className="w-4 h-4" />
              Request Leave
            </button>
            <button
              onClick={() => setShowRunPayrollModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#F8FAFC] bg-[#0B1120] rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
            >
              <DollarSign className="w-4 h-4" />
              Run Payroll
            </button>
            <button
              onClick={() => setShowUnifiedReportModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#F8FAFC] bg-[#0B1120] rounded-lg hover:bg-[rgba(255,255,255,0.05)]"
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
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Staff Management</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#F8FAFC] mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0B1120] w-full pl-10 pr-4 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#F8FAFC] mb-2">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="bg-[#0B1120] w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#F8FAFC] mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#0B1120] w-full px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#0B1120] border-b border-[rgba(255,255,255,0.07)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Department</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Position</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Start Date</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-[#F8FAFC]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.07)]">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="px-6 py-4 text-sm font-medium text-[#F8FAFC]">{emp.name}</td>
                  <td className="px-6 py-4 text-sm text-[#94A3B8]">{emp.email}</td>
                  <td className="px-6 py-4 text-sm text-[#94A3B8]">{emp.department}</td>
                  <td className="px-6 py-4 text-sm text-[#94A3B8]">{emp.position}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.status === 'Active' ? 'bg-green-500/10 text-green-400' :
                      emp.status === 'On Leave' ? 'bg-amber-500/10 text-amber-400' :
                      emp.status === 'Inactive' ? 'bg-[rgba(255,255,255,0.07)] text-[#F8FAFC]' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#94A3B8]">{emp.startDate}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#818CF8] hover:text-blue-700 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#94A3B8] hover:text-[#94A3B8] transition-colors"
                        title="Edit Employee"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-400 hover:text-red-700 transition-colors"
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
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-[#94A3B8]">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <p className="text-xs text-[#94A3B8] mb-1">Total Employees</p>
          <p className="text-2xl font-bold text-[#F8FAFC]">{employees.length}</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <p className="text-xs text-[#94A3B8] mb-1">Active</p>
          <p className="text-2xl font-bold text-green-400">{employees.filter(e => e.status === 'Active').length}</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <p className="text-xs text-[#94A3B8] mb-1">On Leave</p>
          <p className="text-2xl font-bold text-amber-400">{employees.filter(e => e.status === 'On Leave').length}</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <p className="text-xs text-[#94A3B8] mb-1">Departments</p>
          <p className="text-2xl font-bold text-[#818CF8]">{new Set(employees.map(e => e.department)).size}</p>
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
        <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Training & Development</h3>
        {trainingSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainingSessions.map((session) => (
              <div key={session.id} className="border border-[rgba(255,255,255,0.07)] rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h5 className="font-semibold text-[#F8FAFC]">{session.title}</h5>
                    <p className="text-xs text-[#94A3B8] mt-1">{session.description}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${
                    session.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                    session.status === 'ongoing' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-[rgba(255,255,255,0.07)] text-[#F8FAFC]'
                  }`}>
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </span>
                </div>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[#94A3B8]">Instructor:</span>
                    <span className="font-medium text-[#F8FAFC]">{session.instructor}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#94A3B8]">Enrollment:</span>
                    <span className="font-medium text-[#F8FAFC]">{session.enrolled}/{session.capacity}</span>
                  </div>
                </div>
                <div className="w-full bg-[rgba(255,255,255,0.1)] rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${session.capacity > 0 ? (session.enrolled / session.capacity) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">No training sessions available.</p>
        )}
      </div>
    </div>
  );

  const renderAttendanceTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Attendance & Leave Management</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Clock className="w-4 h-4" />
            Mark Attendance
          </button>
          <button
            onClick={() => setShowLeaveModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Calendar className="w-4 h-4" />
            Request Leave
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <p className="text-xs text-[#94A3B8] mb-1">Present Today</p>
          <p className="text-2xl font-bold text-green-400">{attendanceStats.present}</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <p className="text-xs text-[#94A3B8] mb-1">Absent</p>
          <p className="text-2xl font-bold text-red-400">{attendanceStats.absent}</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <p className="text-xs text-[#94A3B8] mb-1">Late</p>
          <p className="text-2xl font-bold text-amber-400">{attendanceStats.late}</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-4">
          <p className="text-xs text-[#94A3B8] mb-1">Half Day</p>
          <p className="text-2xl font-bold text-[#818CF8]">{attendanceStats.halfDay}</p>
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
        <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Daily Attendance Records</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#0B1120] border-b border-[rgba(255,255,255,0.07)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-[#F8FAFC]">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-[#F8FAFC]">Check In</th>
                <th className="px-4 py-3 text-left font-semibold text-[#F8FAFC]">Check Out</th>
                <th className="px-4 py-3 text-left font-semibold text-[#F8FAFC]">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-[#F8FAFC]">Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.07)]">
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="px-4 py-3 font-medium text-[#F8FAFC]">{record.employeeName}</td>
                    <td className="px-4 py-3 text-[#94A3B8]">{record.checkIn}</td>
                    <td className="px-4 py-3 text-[#94A3B8]">{record.checkOut}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        record.status === 'present' ? 'bg-green-500/10 text-green-400' :
                        record.status === 'absent' ? 'bg-red-500/10 text-red-400' :
                        record.status === 'late' ? 'bg-amber-500/10 text-amber-400' :
                        'bg-[rgba(255,255,255,0.07)] text-[#F8FAFC]'
                      }`}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#94A3B8]">{record.hours}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-[#94A3B8]">
                    No attendance records for today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h4 className="font-semibold text-[#F8FAFC] mb-4">Pending Leave Requests</h4>
          {leaveRequests.length > 0 ? (
            <div className="space-y-3">
              {leaveRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 border border-[rgba(255,255,255,0.07)] rounded-lg">
                  <div>
                    <p className="font-medium text-[#F8FAFC]">{req.employeeName}</p>
                    <p className="text-xs text-[#94A3B8]">{req.leaveType} • {req.days} days</p>
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
            <p className="text-sm text-[#94A3B8]">No pending leave requests.</p>
          )}
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h4 className="font-semibold text-[#F8FAFC] mb-4">Leave Balance</h4>
          <p className="text-sm text-[#94A3B8]">Select an employee to view leave balance.</p>
        </div>
      </div>
    </div>
  );

  const renderPayrollTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#F8FAFC]">Payroll Management</h2>
        <button
          onClick={() => setShowRunPayrollModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <DollarSign className="w-4 h-4" />
          Run Payroll
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-2">Latest Payroll</p>
          <p className="text-3xl font-bold text-[#F8FAFC]">
            {payrollHistory.length > 0 ? `$${(payrollHistory[0].totalAmount).toLocaleString()}` : '—'}
          </p>
          <p className="text-xs text-[#64748B] mt-2">
            {payrollHistory.length > 0 ? payrollHistory[0].period : 'No data'}
          </p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-2">Annual Payroll</p>
          <p className="text-3xl font-bold text-[#F8FAFC]">
            ${payrollHistory.reduce((sum, p) => sum + (p.totalAmount || 0), 0).toLocaleString()}
          </p>
          <p className="text-xs text-[#64748B] mt-2">Total processed</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-2">Average Salary</p>
          <p className="text-3xl font-bold text-[#F8FAFC]">
            {employees.length > 0 && employees.filter(e => e.salary).length > 0
              ? `$${Math.round(employees.filter(e => e.salary).reduce((sum, e) => sum + (parseFloat(e.salary?.replace(/[$,]/g, '') || '0') || 0), 0) / employees.filter(e => e.salary).length).toLocaleString()}`
              : '—'}
          </p>
          <p className="text-xs text-[#64748B] mt-2">Per employee</p>
        </div>
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <p className="text-sm font-medium text-[#94A3B8] mb-2">Total Employees</p>
          <p className="text-3xl font-bold text-[#F8FAFC]">{employees.length}</p>
          <p className="text-xs text-[#64748B] mt-2">Active workforce</p>
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
        <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Payroll Breakdown</h3>
        {payrollHistory.length > 0 ? (
          <div className="space-y-3">
            {payrollHistory.slice(0, 1).map((run) => (
              <div key={run.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#F8FAFC]">{run.period}</span>
                    <span className="text-sm font-semibold text-[#F8FAFC]">${run.totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-[rgba(255,255,255,0.1)] rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
                <span className="ml-4 text-sm text-[#94A3B8] w-12 text-right">{run.employeeCount} emp</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">No payroll data available.</p>
        )}
      </div>

      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#0B1120] border-b border-[rgba(255,255,255,0.07)]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Period</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Employees</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Total Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-[#F8FAFC]">Processed Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(255,255,255,0.07)]">
            {payrollHistory.length > 0 ? (
              payrollHistory.map((run) => (
                <tr key={run.id} className="hover:bg-[rgba(255,255,255,0.02)]">
                  <td className="px-6 py-4 text-sm font-medium text-[#F8FAFC]">{run.period}</td>
                  <td className="px-6 py-4 text-sm text-[#94A3B8]">{run.employeeCount}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-[#F8FAFC]">${run.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      run.status === 'Paid' ? 'bg-green-500/10 text-green-400' :
                      run.status === 'Pending' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-[rgba(255,255,255,0.07)] text-[#F8FAFC]'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#94A3B8]">{run.processedDate}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[#94A3B8]">
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
        <h2 className="text-2xl font-bold text-[#F8FAFC]">HR Reports & Analytics</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUnifiedReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <BarChart2 className="w-4 h-4" />
            Generate Report
          </button>
          <button
            onClick={() => setShowUnifiedReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#F8FAFC] bg-[#111827] border border-[rgba(255,255,255,0.1)] rounded-lg hover:bg-[rgba(255,255,255,0.02)]"
          >
            <Download className="w-4 h-4" />
            Report History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h4 className="font-semibold text-[#F8FAFC] mb-4">Workforce Summary</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Total Employees</span>
              <span className="font-semibold text-[#F8FAFC]">{employees.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Active</span>
              <span className="font-semibold text-green-400">{employees.filter(e => e.status === 'Active').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">On Leave</span>
              <span className="font-semibold text-amber-400">{employees.filter(e => e.status === 'On Leave').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Departments</span>
              <span className="font-semibold text-[#818CF8]">{new Set(employees.map(e => e.department)).size}</span>
            </div>
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h4 className="font-semibold text-[#F8FAFC] mb-4">Key Metrics</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Total Employees</span>
              <span className="font-semibold text-[#F8FAFC]">{employees.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Active</span>
              <span className="font-semibold text-green-400">{employees.filter(e => e.status === 'Active').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">On Leave</span>
              <span className="font-semibold text-amber-400">{employees.filter(e => e.status === 'On Leave').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#94A3B8]">Departments</span>
              <span className="font-semibold text-[#818CF8]">{new Set(employees.map(e => e.department)).size}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
        <h4 className="font-semibold text-[#F8FAFC] mb-4">Salary Distribution</h4>
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
                      <span className="text-sm text-[#94A3B8]">{range.label}</span>
                      <span className="text-sm font-semibold text-[#F8FAFC]">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-[rgba(255,255,255,0.1)] rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <p className="text-sm text-[#94A3B8]">No salary data available.</p>
        )}
      </div>

      <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
        <h4 className="font-semibold text-[#F8FAFC] mb-4">Compliance Reports</h4>
        <p className="text-sm text-[#94A3B8]">Compliance reports will be generated from real audit data.</p>
      </div>
    </div>
  );

  const tabs: { id: HRTab; label: string }[] = [
    { id: 'overview', label: 'HR & Operations' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-[rgba(255,255,255,0.07)]">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-[#818CF8]'
                  : 'border-transparent text-[#64748B] hover:text-[#94A3B8]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {renderOverviewTab()}
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
