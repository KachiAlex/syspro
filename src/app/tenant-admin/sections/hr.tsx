'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, Eye, Edit, Award, Download, Filter, Users, Target, DollarSign, Briefcase,
  RefreshCw, Clock, BarChart3, TrendingUp, AlertCircle, CheckCircle, Calendar,
  FileText, Settings, Zap, MoreVertical, Search, ChevronDown, Inbox, BarChart2
} from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type HRMainTab = 'overview' | 'staff' | 'attendance' | 'payroll' | 'reports';
type StaffTab = 'directory' | 'organization' | 'training' | 'performance';
type AttendanceTab = 'tracking' | 'leaves' | 'schedules' | 'compliance';
type PayrollTab = 'overview' | 'runs' | 'deductions' | 'benefits';
type ReportsTab = 'summary' | 'analytics' | 'compliance' | 'forecasting';

// ============================================================================
// DATA MODELS & INTERFACES
// ============================================================================

interface ApiEmployee {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  jobTitle?: string | null;
  status?: string | null;
  hireDate?: string | null;
  phone?: string | null;
  costCenter?: string | null;
  salary?: number | string | null;
  employmentType?: string | null;
}

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
  reportsTo?: string;
  manager?: string;
}

interface EmployeePerformance {
  employeeId: string;
  rating: number;
  reviewDate: string;
  reviewer: string;
  comments: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: 'present' | 'absent' | 'late' | 'half-day';
  notes?: string;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  type: 'annual' | 'sick' | 'personal' | 'unpaid';
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  reason: string;
}

interface LeaveBalance {
  employeeId: string;
  annual: number;
  sick: number;
  personal: number;
  used: number;
}

interface PayrollRun {
  id: string;
  period: string;
  status: 'draft' | 'processed' | 'paid' | 'archived';
  totalAmount: number;
  employeeCount: number;
  processedDate?: string;
  paidDate?: string;
}

interface PayrollEntry {
  id: string;
  employeeId: string;
  runId: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  taxAmount: number;
}

interface PayrollMetrics {
  totalEmployees: number;
  activeEmployees: number;
  monthlyPayroll: number;
  annualPayroll: number;
  averageSalary: number;
  totalBenefits: number;
  costPerEmployee: number;
}

interface Deduction {
  id: string;
  name: string;
  type: 'tax' | 'insurance' | 'loan' | 'other';
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'annual';
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
  budget?: number;
}

interface TrainingEnrollment {
  id: string;
  employeeId: string;
  trainingId: string;
  enrollmentDate: string;
  completionDate?: string;
  status: 'enrolled' | 'completed' | 'cancelled';
  score?: number;
}

interface HRDashboardMetrics {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  inactiveEmployees: number;
  terminatedEmployees: number;
  departmentCount: number;
  averageTenure: number;
  turnoverRate: number;
  openPositions: number;
  pendingLeaveRequests: number;
  upcomingTrainings: number;
  payrollStatus: 'on-track' | 'delayed' | 'pending';
}

interface AddEmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  startDate: string;
  salary: string;
  employmentType: 'full-time' | 'part-time' | 'contract';
  reportsTo?: string;
}

interface EditEmployeeFormData extends AddEmployeeFormData {
  status: string;
}

// ============================================================================
// CONSTANTS & DEFAULTS
// ============================================================================

const EMPLOYEE_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  'on-leave': 'On Leave',
  terminated: 'Terminated',
};

const STATUS_CODE_BY_LABEL = Object.entries(EMPLOYEE_STATUS_LABELS).reduce<Record<string, string>>((acc, [code, label]) => {
  acc[label] = code;
  return acc;
}, {});

const DEFAULT_PAYROLL_METRICS: PayrollMetrics = {
  totalEmployees: 0,
  activeEmployees: 0,
  monthlyPayroll: 0,
  annualPayroll: 0,
  averageSalary: 0,
  totalBenefits: 0,
  costPerEmployee: 0,
};

const DEFAULT_HR_METRICS: HRDashboardMetrics = {
  totalEmployees: 0,
  activeEmployees: 0,
  onLeaveEmployees: 0,
  inactiveEmployees: 0,
  terminatedEmployees: 0,
  departmentCount: 0,
  averageTenure: 0,
  turnoverRate: 0,
  openPositions: 0,
  pendingLeaveRequests: 0,
  upcomingTrainings: 0,
  payrollStatus: 'on-track',
};

const DEFAULT_DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations', 'Legal', 'Admin'];
const DEFAULT_STATUS_LABELS = ['Active', 'On Leave', 'Inactive', 'Terminated'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary'];
const LEAVE_TYPES = ['Annual', 'Sick', 'Personal', 'Unpaid'];

const DEFAULT_TRAINING_SESSIONS: TrainingSession[] = [
  {
    id: 'leadership',
    title: 'Leadership Excellence',
    description: 'Advanced leadership and management skills',
    status: 'planned',
    startDate: '2026-05-01',
    endDate: '2026-05-15',
    instructor: 'Dr. Sarah Mitchell',
    capacity: 30,
    enrolled: 12,
    location: 'Conference Room A',
    budget: 5000,
  },
  {
    id: 'sales',
    title: 'Advanced Sales Techniques',
    description: 'Modern sales methodologies and customer engagement',
    status: 'ongoing',
    startDate: '2026-04-01',
    endDate: '2026-04-30',
    instructor: 'John Anderson',
    capacity: 40,
    enrolled: 25,
    location: 'Virtual',
    budget: 3000,
  },
  {
    id: 'security',
    title: 'Security Awareness',
    description: 'Information security and compliance training',
    status: 'completed',
    startDate: '2026-03-01',
    endDate: '2026-03-15',
    instructor: 'Security Team',
    capacity: 300,
    enrolled: 234,
    budget: 2000,
  },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatEmployeeStatus(status?: string | null) {
  if (!status) return 'Active';
  const normalized = status.toLowerCase();
  return EMPLOYEE_STATUS_LABELS[normalized] ?? status;
}

function normalizeStatusLabel(label: string) {
  if (!label) return 'active';
  return STATUS_CODE_BY_LABEL[label] ?? label.trim().toLowerCase().replace(/\s+/g, '-');
}

// ============================================================================
// MAIN HR COMPONENT
// ============================================================================

const HRComponent: React.FC = () => {
  const { tenantSlug } = useTenantContext();

  // ========== MAIN TAB STATE ==========
  const [mainTab, setMainTab] = useState<HRMainTab>('overview');

  // ========== SUB-TAB STATES ==========
  const [staffTab, setStaffTab] = useState<StaffTab>('directory');
  const [attendanceTab, setAttendanceTab] = useState<AttendanceTab>('tracking');
  const [payrollTab, setPayrollTab] = useState<PayrollTab>('overview');
  const [reportsTab, setReportsTab] = useState<ReportsTab>('summary');

  // ========== EMPLOYEE DATA STATE ==========
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(DEFAULT_TRAINING_SESSIONS);
  const [payrollMetrics, setPayrollMetrics] = useState<PayrollMetrics>(DEFAULT_PAYROLL_METRICS);
  const [hrMetrics, setHrMetrics] = useState<HRDashboardMetrics>(DEFAULT_HR_METRICS);

  // ========== FILTER & SEARCH STATE ==========
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(['All Departments', ...DEFAULT_DEPARTMENTS]);
  const [statusOptions, setStatusOptions] = useState<string[]>(['All Statuses', ...DEFAULT_STATUS_LABELS]);
  const [departmentCatalog, setDepartmentCatalog] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [statusCatalog, setStatusCatalog] = useState<string[]>(DEFAULT_STATUS_LABELS);
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [searchQuery, setSearchQuery] = useState('');

  // ========== UI STATE ==========
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // ========== MODAL STATE ==========
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  // ========== COMPUTED VALUES ==========
  const departmentOptionsForForms = departmentCatalog.filter((dept): dept is string => Boolean(dept));
  const statusOptionsForForms = statusCatalog.filter((status): status is string => Boolean(status));

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (departmentFilter !== 'All Departments' && emp.department !== departmentFilter) return false;
      if (statusFilter !== 'All Statuses' && emp.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!emp.name.toLowerCase().includes(query) && !emp.email.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [employees, departmentFilter, statusFilter, searchQuery]);

  // ========== EFFECTS ==========
  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  // ========== RENDER FUNCTIONS ==========

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">HR & Operations Overview</h2>
          <p className="text-gray-600 mt-1">Enterprise-wide human resources management and analytics</p>
        </div>
        <button
          onClick={() => setLastRefreshed(new Date())}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{employees.length}</p>
            </div>
            <Users className="w-12 h-12 text-blue-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Active workforce</p>
        </div>

        {/* Active Employees */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{employees.filter(e => e.status === 'Active').length}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Currently working</p>
        </div>

        {/* On Leave */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">On Leave</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">{employees.filter(e => e.status === 'On Leave').length}</p>
            </div>
            <Calendar className="w-12 h-12 text-amber-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Temporary absence</p>
        </div>

        {/* Payroll Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Payroll Status</p>
              <p className="text-lg font-bold text-gray-900 mt-2 capitalize">{hrMetrics.payrollStatus}</p>
            </div>
            <DollarSign className="w-12 h-12 text-purple-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Current period</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h3>
          <div className="space-y-3">
            {Object.entries(
              employees.reduce<Record<string, number>>((acc, emp) => {
                acc[emp.department] = (acc[emp.department] || 0) + 1;
                return acc;
              }, {})
            ).map(([dept, count]) => (
              <div key={dept} className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{dept}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(count / employees.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => {
                setMainTab('staff');
                setShowAddModal(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New Employee
            </button>
            <button
              onClick={() => setMainTab('payroll')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <DollarSign className="w-4 h-4" />
              Process Payroll
            </button>
            <button
              onClick={() => setMainTab('attendance')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Clock className="w-4 h-4" />
              View Attendance
            </button>
            <button
              onClick={() => setMainTab('reports')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <BarChart2 className="w-4 h-4" />
              Generate Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStaffTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Staff Management</h3>
        <div className="flex gap-2 border-b border-gray-200">
          {(['directory', 'organization', 'training', 'performance'] as StaffTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setStaffTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                staffTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {staffTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Department</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Employee
                </button>
              </div>
            </div>
          </div>

          {/* Employee Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Department</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Position</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Start Date</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{emp.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.department}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.position}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          emp.status === 'Active' ? 'bg-green-100 text-green-800' :
                          emp.status === 'On Leave' ? 'bg-amber-100 text-amber-800' :
                          emp.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{emp.startDate}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setShowViewModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-600">
                      No employees found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Active</p>
              <p className="text-2xl font-bold text-green-600">{employees.filter(e => e.status === 'Active').length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">On Leave</p>
              <p className="text-2xl font-bold text-amber-600">{employees.filter(e => e.status === 'On Leave').length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Departments</p>
              <p className="text-2xl font-bold text-blue-600">{new Set(employees.map(e => e.department)).size}</p>
            </div>
          </div>
        </div>
      )}

      {staffTab === 'organization' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Organization Structure</h4>
            <div className="space-y-4">
              {Object.entries(
                employees.reduce<Record<string, Employee[]>>((acc, emp) => {
                  acc[emp.department] = acc[emp.department] || [];
                  acc[emp.department].push(emp);
                  return acc;
                }, {})
              ).map(([dept, deptEmployees]) => (
                <div key={dept} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-semibold text-gray-900">{dept}</h5>
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">{deptEmployees.length} employees</span>
                  </div>
                  <div className="space-y-2">
                    {deptEmployees.map((emp) => (
                      <div key={emp.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                          <p className="text-xs text-gray-600">{emp.position}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          emp.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {emp.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {staffTab === 'training' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Training & Development Programs</h4>
            <button
              onClick={() => setShowTrainingModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Training
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trainingSessions.map((session) => (
              <div key={session.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h5 className="font-semibold text-gray-900">{session.title}</h5>
                    <p className="text-xs text-gray-600 mt-1">{session.description}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${
                    session.status === 'completed' ? 'bg-green-100 text-green-800' :
                    session.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                  </span>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Instructor:</span>
                    <span className="font-medium text-gray-900">{session.instructor}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium text-gray-900">{session.startDate} to {session.endDate}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Enrollment:</span>
                    <span className="font-medium text-gray-900">{session.enrolled}/{session.capacity}</span>
                  </div>
                  {session.location && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Location:</span>
                      <span className="font-medium text-gray-900">{session.location}</span>
                    </div>
                  )}
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(session.enrolled / session.capacity) * 100}%` }}
                  />
                </div>

                <button className="w-full px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {staffTab === 'performance' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Performance Management</h4>
            <div className="space-y-4">
              {employees.slice(0, 5).map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{emp.name}</p>
                    <p className="text-sm text-gray-600">{emp.position} • {emp.department}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">Performance Rating</p>
                      <div className="flex gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className="text-lg text-yellow-400">★</span>
                        ))}
                      </div>
                    </div>
                    <button className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAttendanceTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance & Leave Management</h3>
        <div className="flex gap-2 border-b border-gray-200">
          {(['tracking', 'leaves', 'schedules', 'compliance'] as AttendanceTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setAttendanceTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                attendanceTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {attendanceTab === 'tracking' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900">Daily Attendance Records</h4>
              <input
                type="date"
                defaultValue={new Date().toISOString().split('T')[0]}
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
                  {employees.slice(0, 10).map((emp) => (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                      <td className="px-4 py-3 text-gray-600">09:00 AM</td>
                      <td className="px-4 py-3 text-gray-600">06:00 PM</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Present
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">9.0</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Present Today</p>
              <p className="text-2xl font-bold text-green-600">{employees.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Absent</p>
              <p className="text-2xl font-bold text-red-600">0</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Late</p>
              <p className="text-2xl font-bold text-amber-600">0</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Half Day</p>
              <p className="text-2xl font-bold text-blue-600">0</p>
            </div>
          </div>
        </div>
      )}

      {attendanceTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Leave Requests & Approvals</h4>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              New Leave Request
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Pending Requests</p>
              <p className="text-2xl font-bold text-amber-600">5</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Approved</p>
              <p className="text-2xl font-bold text-green-600">24</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Rejected</p>
              <p className="text-2xl font-bold text-red-600">2</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Total Days Used</p>
              <p className="text-2xl font-bold text-blue-600">156</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h5 className="font-semibold text-gray-900 mb-4">Pending Approvals</h5>
            <div className="space-y-3">
              {[
                { name: 'John Smith', type: 'Annual', days: 5, from: '2026-04-15', to: '2026-04-20' },
                { name: 'Sarah Johnson', type: 'Sick', days: 2, from: '2026-04-10', to: '2026-04-12' },
              ].map((req, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{req.name}</p>
                    <p className="text-sm text-gray-600">{req.type} Leave • {req.days} days • {req.from} to {req.to}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100">
                      Approve
                    </button>
                    <button className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {attendanceTab === 'schedules' && (
        <div className="space-y-4">
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
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
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
      )}

      {attendanceTab === 'compliance' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Compliance & Regulatory Reports</h4>
            <div className="space-y-3">
              {[
                { name: 'Attendance Compliance Report', date: '2026-04-01', status: 'Ready' },
                { name: 'Working Hours Summary', date: '2026-04-01', status: 'Ready' },
                { name: 'Overtime Report', date: '2026-04-01', status: 'Ready' },
                { name: 'Leave Utilization Report', date: '2026-04-01', status: 'Ready' },
              ].map((report, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{report.name}</p>
                    <p className="text-sm text-gray-600">Period: {report.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded">{report.status}</span>
                    <button className="px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPayrollTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Management</h3>
        <div className="flex gap-2 border-b border-gray-200">
          {(['overview', 'runs', 'deductions', 'benefits'] as PayrollTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setPayrollTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                payrollTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {payrollTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Monthly Payroll</p>
              <p className="text-3xl font-bold text-gray-900">$125,450</p>
              <p className="text-xs text-gray-500 mt-2">Current period</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Annual Payroll</p>
              <p className="text-3xl font-bold text-gray-900">$1.5M</p>
              <p className="text-xs text-gray-500 mt-2">Projected</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Average Salary</p>
              <p className="text-3xl font-bold text-gray-900">$65,230</p>
              <p className="text-xs text-gray-500 mt-2">Per employee</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-sm font-medium text-gray-600 mb-2">Total Benefits</p>
              <p className="text-3xl font-bold text-gray-900">$43,908</p>
              <p className="text-xs text-gray-500 mt-2">Monthly allocation</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Payroll Breakdown</h4>
            <div className="space-y-3">
              {[
                { label: 'Base Salary', amount: '$125,450', percentage: 65 },
                { label: 'Allowances', amount: '$35,200', percentage: 18 },
                { label: 'Bonuses', amount: '$21,340', percentage: 11 },
                { label: 'Other', amount: '$6,010', percentage: 6 },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{item.label}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.amount}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="ml-4 text-sm text-gray-600 w-12 text-right">{item.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {payrollTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Payroll Cycles & Processing</h4>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              New Payroll Run
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Employees</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Total Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Processed Date</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  { period: 'April 2026', employees: 45, amount: '$125,450', status: 'Paid', date: '2026-04-05' },
                  { period: 'March 2026', employees: 45, amount: '$125,450', status: 'Paid', date: '2026-03-05' },
                  { period: 'February 2026', employees: 44, amount: '$123,210', status: 'Paid', date: '2026-02-05' },
                ].map((run, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{run.period}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{run.employees}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">{run.amount}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {run.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{run.date}</td>
                    <td className="px-6 py-4 text-center">
                      <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {payrollTab === 'deductions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Deductions & Tax Management</h4>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Deduction
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Total Tax Deductions</p>
              <p className="text-2xl font-bold text-gray-900">$18,450</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Insurance Deductions</p>
              <p className="text-2xl font-bold text-gray-900">$8,230</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Other Deductions</p>
              <p className="text-2xl font-bold text-gray-900">$3,120</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h5 className="font-semibold text-gray-900 mb-4">Deduction Rules</h5>
            <div className="space-y-3">
              {[
                { name: 'Income Tax', type: 'Tax', amount: '15%', frequency: 'Monthly' },
                { name: 'Health Insurance', type: 'Insurance', amount: '$250', frequency: 'Monthly' },
                { name: 'Pension Contribution', type: 'Retirement', amount: '5%', frequency: 'Monthly' },
                { name: 'Professional Loan', type: 'Loan', amount: '$500', frequency: 'Monthly' },
              ].map((deduction, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{deduction.name}</p>
                    <p className="text-sm text-gray-600">{deduction.type} • {deduction.frequency}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{deduction.amount}</span>
                    <button className="text-gray-400 hover:text-gray-600">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {payrollTab === 'benefits' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Benefits Administration</h4>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add Benefit
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Total Benefits Cost</p>
              <p className="text-2xl font-bold text-gray-900">$43,908</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Employees Enrolled</p>
              <p className="text-2xl font-bold text-gray-900">45</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 mb-1">Avg Cost per Employee</p>
              <p className="text-2xl font-bold text-gray-900">$976</p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h5 className="font-semibold text-gray-900 mb-4">Benefit Plans</h5>
            <div className="space-y-3">
              {[
                { name: 'Health Insurance', coverage: 'Medical, Dental, Vision', employees: 45, cost: '$18,000' },
                { name: 'Life Insurance', coverage: '2x Annual Salary', employees: 45, cost: '$8,500' },
                { name: 'Retirement Plan', coverage: '401(k) Matching', employees: 38, cost: '$12,000' },
                { name: 'Wellness Program', coverage: 'Gym, Mental Health', employees: 32, cost: '$5,408' },
              ].map((benefit, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="font-semibold text-gray-900">{benefit.name}</h6>
                    <span className="text-sm font-semibold text-gray-900">{benefit.cost}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{benefit.coverage}</p>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{benefit.employees} employees enrolled</span>
                    <button className="text-blue-600 hover:text-blue-700 font-medium">Manage</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderReportsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">HR Reports & Analytics</h3>
        <div className="flex gap-2 border-b border-gray-200">
          {(['summary', 'analytics', 'compliance', 'forecasting'] as ReportsTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setReportsTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                reportsTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {reportsTab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Workforce Summary</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Employees</span>
                  <span className="font-semibold text-gray-900">{employees.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Active</span>
                  <span className="font-semibold text-green-600">{employees.filter(e => e.status === 'Active').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">On Leave</span>
                  <span className="font-semibold text-amber-600">{employees.filter(e => e.status === 'On Leave').length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Departments</span>
                  <span className="font-semibold text-blue-600">{new Set(employees.map(e => e.department)).size}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Financial Summary</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Monthly Payroll</span>
                  <span className="font-semibold text-gray-900">$125,450</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Annual Payroll</span>
                  <span className="font-semibold text-gray-900">$1.5M</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total Benefits</span>
                  <span className="font-semibold text-gray-900">$43,908</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Cost per Employee</span>
                  <span className="font-semibold text-gray-900">$2,788</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Key Metrics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Turnover Rate</p>
                <p className="text-2xl font-bold text-gray-900">2.2%</p>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Avg Tenure</p>
                <p className="text-2xl font-bold text-gray-900">4.8 yrs</p>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Attendance Rate</p>
                <p className="text-2xl font-bold text-gray-900">96.5%</p>
              </div>
              <div className="text-center p-4 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Training Hours</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportsTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Salary Distribution</h4>
              <div className="space-y-3">
                {[
                  { range: '$40K - $60K', count: 12, percentage: 27 },
                  { range: '$60K - $80K', count: 18, percentage: 40 },
                  { range: '$80K - $100K', count: 10, percentage: 22 },
                  { range: '$100K+', count: 5, percentage: 11 },
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{item.range}</span>
                      <span className="text-sm font-semibold text-gray-900">{item.count} ({item.percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Hiring Trends</h4>
              <div className="space-y-3">
                {[
                  { month: 'January', hires: 3, separations: 1 },
                  { month: 'February', hires: 2, separations: 0 },
                  { month: 'March', hires: 4, separations: 2 },
                  { month: 'April', hires: 5, separations: 1 },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <span className="text-sm font-medium text-gray-900">{item.month}</span>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Hires</p>
                        <p className="text-sm font-semibold text-green-600">{item.hires}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-600">Separations</p>
                        <p className="text-sm font-semibold text-red-600">{item.separations}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Performance Distribution</h4>
            <div className="grid grid-cols-5 gap-2">
              {[
                { rating: 'Excellent', count: 8, color: 'bg-green-100 text-green-800' },
                { rating: 'Good', count: 22, color: 'bg-blue-100 text-blue-800' },
                { rating: 'Average', count: 12, color: 'bg-yellow-100 text-yellow-800' },
                { rating: 'Below Avg', count: 2, color: 'bg-orange-100 text-orange-800' },
                { rating: 'Poor', count: 1, color: 'bg-red-100 text-red-800' },
              ].map((item, idx) => (
                <div key={idx} className={`p-4 rounded-lg text-center ${item.color}`}>
                  <p className="text-xs font-medium mb-1">{item.rating}</p>
                  <p className="text-2xl font-bold">{item.count}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportsTab === 'compliance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-gray-900">Compliance & Regulatory Reports</h4>
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" />
              Export All
            </button>
          </div>

          <div className="space-y-3">
            {[
              { name: 'Equal Employment Opportunity (EEO)', status: 'Compliant', lastUpdated: '2026-04-01', action: 'View' },
              { name: 'FMLA Compliance Report', status: 'Compliant', lastUpdated: '2026-04-01', action: 'View' },
              { name: 'ADA Accommodations', status: 'Compliant', lastUpdated: '2026-03-15', action: 'View' },
              { name: 'Wage & Hour Compliance', status: 'Compliant', lastUpdated: '2026-04-01', action: 'View' },
              { name: 'Benefits Compliance', status: 'Compliant', lastUpdated: '2026-03-20', action: 'View' },
              { name: 'Safety & Health (OSHA)', status: 'Compliant', lastUpdated: '2026-02-28', action: 'View' },
            ].map((report, idx) => (
              <div key={idx} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{report.name}</p>
                  <p className="text-xs text-gray-600 mt-1">Last updated: {report.lastUpdated}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {report.status}
                  </span>
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">{report.action}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reportsTab === 'forecasting' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Workforce Forecast (12 Months)</h4>
              <div className="space-y-3">
                {[
                  { month: 'May 2026', projected: 47, confidence: '95%' },
                  { month: 'June 2026', projected: 48, confidence: '92%' },
                  { month: 'July 2026', projected: 50, confidence: '88%' },
                  { month: 'August 2026', projected: 52, confidence: '85%' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.month}</p>
                      <p className="text-xs text-gray-600">Confidence: {item.confidence}</p>
                    </div>
                    <p className="text-lg font-bold text-blue-600">{item.projected}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Payroll Forecast (12 Months)</h4>
              <div className="space-y-3">
                {[
                  { month: 'May 2026', projected: '$128,500', change: '+2.4%' },
                  { month: 'June 2026', projected: '$131,200', change: '+2.1%' },
                  { month: 'July 2026', projected: '$135,800', change: '+3.5%' },
                  { month: 'August 2026', projected: '$140,600', change: '+3.5%' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.month}</p>
                      <p className="text-xs text-gray-600">Change: {item.change}</p>
                    </div>
                    <p className="text-lg font-bold text-green-600">{item.projected}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Attrition Risk Analysis</h4>
            <div className="space-y-3">
              {[
                { name: 'High Risk', count: 3, employees: 'John Smith, Sarah Johnson, Mike Davis', color: 'bg-red-100 text-red-800' },
                { name: 'Medium Risk', count: 8, employees: '8 employees identified', color: 'bg-yellow-100 text-yellow-800' },
                { name: 'Low Risk', count: 34, employees: '34 employees', color: 'bg-green-100 text-green-800' },
              ].map((risk, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className={`font-semibold px-3 py-1 rounded-full text-sm ${risk.color}`}>{risk.name}</h5>
                    <span className="text-lg font-bold text-gray-900">{risk.count}</span>
                  </div>
                  <p className="text-sm text-gray-600">{risk.employees}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ========== MAIN RENDER ==========
  return (
    <div className="p-6 space-y-6">
      {/* Main Tab Navigation */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {(['overview', 'staff', 'attendance', 'payroll', 'reports'] as HRMainTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                mainTab === tab
                  ? 'border-blue-600 text-blue-600 bg-blue-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'overview' && <Inbox className="w-4 h-4" />}
              {tab === 'staff' && <Users className="w-4 h-4" />}
              {tab === 'attendance' && <Clock className="w-4 h-4" />}
              {tab === 'payroll' && <DollarSign className="w-4 h-4" />}
              {tab === 'reports' && <BarChart3 className="w-4 h-4" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {mainTab === 'overview' && renderOverviewTab()}
        {mainTab === 'staff' && renderStaffTab()}
        {mainTab === 'attendance' && renderAttendanceTab()}
        {mainTab === 'payroll' && renderPayrollTab()}
        {mainTab === 'reports' && renderReportsTab()}
      </div>

      {/* Alert */}
      {alert && (
        <div
          className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium ${
            alert.type === 'success' ? 'bg-green-600' : alert.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}
        >
          {alert.message}
        </div>
      )}
    </div>
  );
};

export default HRComponent;
