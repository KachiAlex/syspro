'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Plus, Eye, Search, RefreshCw, Clock, DollarSign, BarChart2, Users, CheckCircle, Calendar,
  Download, MoreVertical, Award, Briefcase, FileText
} from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { AddEmployeeModal } from './hr-add-employee-modal';
import { EditEmployeeModal, ViewEmployeeModal, DeleteEmployeeModal, RunPayrollModal, PostJobModal, TrainingModal } from './hr-modals';
import { AttendanceModal, LeaveModal } from './hr-attendance-modals';
import { UnifiedReportModal } from '../components/unified-report-modal';
import { StaffReportModal } from './hr-staff-report-modal';
import { StaffTasksModal } from './hr-staff-tasks-modal';
import { ReportService } from '../services/report-service';
import { HRService } from './hr-service';
import dynamic from 'next/dynamic';

const RecruitmentDashboard = dynamic(() => import('./recruitment-dashboard').then((m) => m.RecruitmentDashboard));
const DepartmentsDashboard = dynamic(() => import('./departments-dashboard').then((m) => m.DepartmentsDashboard));

type HRTab = 'overview' | 'recruitment' | 'departments';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string;
  status: string;
  salary: string;
  role: string;
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
  checkInLat: number | null;
  checkInLng: number | null;
  checkInMethod: string | null;
  checkInFlagged: boolean;
  flagReason: string | null;
  workMode: string | null;
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
  const { tenantSlug, currency } = useTenantContext();
  const currentUser = useCurrentUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const currentEmployeeId = useMemo(() => {
    if (!currentUser?.id) return undefined;
    const matchById = employees.find((e) => e.id === currentUser.id);
    if (matchById) return matchById.id;
    if (currentUser.email) {
      const matchByEmail = employees.find((e) => e.email?.toLowerCase() === currentUser.email?.toLowerCase());
      if (matchByEmail) return matchByEmail.id;
    }
    return undefined;
  }, [currentUser, employees]);
  const [activeTab, setActiveTab] = useState<HRTab>('overview');
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
  const [showStaffReportModal, setShowStaffReportModal] = useState(false);
  const [showStaffTasksModal, setShowStaffTasksModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
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
      if (!emp.name?.toLowerCase().includes(query) && !emp.email?.toLowerCase().includes(query)) return false;
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
        id: newEmployee.employee.id,
        name: newEmployee.employee.name,
        email: newEmployee.employee.email,
        department: employeeData.department,
        position: employeeData.position,
        startDate: employeeData.startDate,
        status: 'Active',
        salary: employeeData.salary || '',
        role: employeeData.role || 'Staff',
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
                salary: data.salary || emp.salary,
                role: data.role || emp.role,
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
        fetchedAttendance,
        fetchedStats,
        fetchedLeave,
        fetchedTraining,
        fetchedPayroll
      ] = await Promise.all([
        HRService.getEmployees(tenantSlug),
        HRService.getDepartments(tenantSlug),
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
          salary: emp.salary ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(emp.salary)) : '',
          role: emp.role || 'Staff',
        }))
      );
      setDepartments(fetchedDepartments);
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
    } catch (error: any) {
      console.error('Failed to load HR data:', error?.message || error);
      if (error?.response?.data?.error) {
        console.error('Server error:', error.response.data.error);
      }
    } finally {
      setLoading(false);
    }
  }, [currency, tenantSlug]);

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
            <button
              onClick={() => setShowStaffReportModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <FileText className="w-4 h-4" />
              Submit Report
            </button>
            <button
              onClick={() => setShowStaffTasksModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-theme-text-primary bg-theme-bg rounded-lg hover:bg-theme-sidebar-hover"
            >
              <Briefcase className="w-4 h-4" />
              Assign Tasks
            </button>
          </div>
        </div>
      </div>
    </div>
  );


  const tabs: { id: HRTab; label: string }[] = [
    { id: 'overview', label: 'HR & Operations' },
    { id: 'recruitment', label: 'Talent Acquisition' },
    { id: 'departments', label: 'Departments & Units' },
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
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'recruitment' && <RecruitmentDashboard />}
        {activeTab === 'departments' && <DepartmentsDashboard />}
      </div>

      {/* Employee Management Modals */}
      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddEmployee}
        departments={departments}
        tenantSlug={tenantSlug || ''}
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

      <StaffReportModal
        isOpen={showStaffReportModal}
        onClose={() => setShowStaffReportModal(false)}
        tenantSlug={tenantSlug || ''}
        employees={employees}
        currentEmployeeId={currentEmployeeId}
        onSubmitted={() => {
          loadData();
        }}
      />

      <StaffTasksModal
        isOpen={showStaffTasksModal}
        onClose={() => setShowStaffTasksModal(false)}
        tenantSlug={tenantSlug || ''}
        employees={employees}
        currentUserName={currentUser?.name || 'Admin'}
        onUpdated={() => {
          loadData();
        }}
      />
    </div>
  );
};

export default HRComponent;
