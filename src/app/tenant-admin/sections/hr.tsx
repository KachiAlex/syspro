'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Eye, Edit, Award, Download, Filter, Users, Target, DollarSign, Briefcase, RefreshCw } from 'lucide-react';
import { AddEmployeeModal, RunPayrollModal, PostJobModal, ViewEmployeeModal, TrainingModal, EditEmployeeModal, DeleteEmployeeModal } from './hr-modals';
import HRTabs from './hr-tabs';
import HRMainTabs from './hr-main-tabs';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { apiClient } from '@/lib/api-client';

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

function formatEmployeeStatus(status?: string | null) {
  if (!status) return 'Active';
  const normalized = status.toLowerCase();
  return EMPLOYEE_STATUS_LABELS[normalized] ?? status;
}

function normalizeStatusLabel(label: string) {
  if (!label) return 'active';
  return STATUS_CODE_BY_LABEL[label] ?? label.trim().toLowerCase().replace(/\s+/g, '-');
}

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
}

interface AddEmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
  startDate: string;
  salary: string;
  employmentType: string;
}

interface EditEmployeeFormData extends AddEmployeeFormData {
  status: string;
}

interface TrainingSession {
  id: string;
  title: string;
  status: 'Upcoming' | 'In Progress' | 'Completed';
  participants: number;
  instructor: string;
  startDate?: string;
}

const DEFAULT_TRAINING_SESSIONS: TrainingSession[] = [
  { id: 'leadership', title: 'Leadership Excellence', participants: 12, status: 'Upcoming', instructor: 'Dr. Sarah Mitchell' },
  { id: 'sales', title: 'Advanced Sales', participants: 25, status: 'In Progress', instructor: 'John Anderson' },
  { id: 'security', title: 'Security Awareness', participants: 234, status: 'Completed', instructor: 'Security Team' }
];

interface PayrollMetrics {
  monthly: number;
  annual: number;
  averageSalary: number;
  benefits: number;
}

const DEFAULT_PAYROLL_METRICS: PayrollMetrics = {
  monthly: 0,
  annual: 0,
  averageSalary: 0,
  benefits: 0
};

const DEFAULT_DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
const DEFAULT_STATUS_LABELS = ['Active', 'On Leave', 'Inactive', 'Terminated'];

const HRComponent: React.FC = () => {
  const { tenantSlug } = useTenantContext();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [departmentOptions, setDepartmentOptions] = useState<string[]>(['All Departments', ...DEFAULT_DEPARTMENTS]);
  const [statusOptions, setStatusOptions] = useState<string[]>(['All Statuses', ...DEFAULT_STATUS_LABELS]);
  const [departmentCatalog, setDepartmentCatalog] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [statusCatalog, setStatusCatalog] = useState<string[]>(DEFAULT_STATUS_LABELS);
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [searchQuery, setSearchQuery] = useState('');
  const [payrollMetrics, setPayrollMetrics] = useState<PayrollMetrics>(DEFAULT_PAYROLL_METRICS);
  const [hasLivePayrollMetrics, setHasLivePayrollMetrics] = useState(false);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(DEFAULT_TRAINING_SESSIONS);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const departmentOptionsForForms = departmentCatalog.filter((dept): dept is string => Boolean(dept));
  const statusOptionsForForms = statusCatalog.filter((status): status is string => Boolean(status));

  const updateFilterOptions = useCallback(
    (list: Employee[], catalogs?: { departments?: string[]; statuses?: string[] }) => {
      const normalizedDepartmentCatalog = (catalogs?.departments ?? [])
        .map((dept) => dept?.toString().trim())
        .filter((dept): dept is string => Boolean(dept));
      const departmentSet = new Set<string>([
        ...DEFAULT_DEPARTMENTS,
        ...normalizedDepartmentCatalog,
        ...list.map((employee) => employee.department).filter(Boolean),
      ]);
      const departmentCatalogList = Array.from(departmentSet).sort();
      const departmentOptionList = ['All Departments', ...departmentCatalogList];
      setDepartmentCatalog(departmentCatalogList);
      setDepartmentOptions(departmentOptionList);
      if (!departmentOptionList.includes(departmentFilter)) {
        setDepartmentFilter('All Departments');
      }

      const normalizedStatusCatalog = (catalogs?.statuses ?? [])
        .map((status) => formatEmployeeStatus(status))
        .filter((status): status is string => Boolean(status));
      const statusSet = new Set<string>([
        ...DEFAULT_STATUS_LABELS,
        ...normalizedStatusCatalog,
        ...list.map((employee) => employee.status).filter(Boolean),
      ]);
      const statusCatalogList = Array.from(statusSet).sort();
      const statusOptionList = ['All Statuses', ...statusCatalogList];
      setStatusCatalog(statusCatalogList);
      setStatusOptions(statusOptionList);
      if (!statusOptionList.includes(statusFilter)) {
        setStatusFilter('All Statuses');
      }
    },
    [departmentFilter, statusFilter]
  );

  const recalcPayrollFromEmployees = useCallback((list: Employee[]) => {
    if (list.length === 0) {
      setPayrollMetrics(DEFAULT_PAYROLL_METRICS);
      return;
    }

    const totalCompRaw = list.reduce((acc, employee) => {
      const numericSalary = Number((employee.salary ?? '').toString().replace(/[^0-9.-]+/g, ''));
      if (Number.isFinite(numericSalary)) {
        return acc + numericSalary;
      }
      return acc;
    }, 0);

    const activeCount = list.filter((employee) => employee.status === 'Active').length;
    const basis = totalCompRaw || activeCount * 150000;
    const monthly = Math.round(basis);

    setPayrollMetrics({
      monthly,
      annual: monthly * 12,
      averageSalary: activeCount ? Math.round(basis / Math.max(activeCount, 1)) : 0,
      benefits: Math.round(monthly * 0.35)
    });
  }, []);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: ApiEmployee[];
        departments?: string[];
        statuses?: string[];
        payroll?: PayrollMetrics;
        training?: TrainingSession[];
      }>(
        `/api/tenant/employees?tenantSlug=${tenantSlug}`,
        { cacheKey: `tenant-${tenantSlug}-employees`, cacheTTL: 30_000 }
      );

      const payload = response.data;
      const normalized = (payload?.data ?? []).map((employee): Employee => ({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        department: employee.departmentId || 'Unassigned',
        position: employee.jobTitle || 'Not specified',
        startDate: employee.hireDate ? new Date(employee.hireDate).toISOString().split('T')[0] : 'N/A',
        status: employee.status ? formatEmployeeStatus(employee.status) : 'Active',
        performance: 'Good',
        salary: typeof employee.salary === 'number' ? employee.salary.toString() : employee.salary?.toString() ?? '—',
      }));

      setEmployees(normalized);
      updateFilterOptions(normalized, {
        departments: payload?.departments,
        statuses: payload?.statuses,
      });

      if (payload?.payroll) {
        setPayrollMetrics(payload.payroll);
        setHasLivePayrollMetrics(true);
      } else {
        setHasLivePayrollMetrics(false);
        recalcPayrollFromEmployees(normalized);
      }

      if (payload && Array.isArray(payload.training)) {
        setTrainingSessions(payload.training);
      } else {
        setTrainingSessions(DEFAULT_TRAINING_SESSIONS);
      }

      setLastRefreshed(new Date());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load employees');
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug, recalcPayrollFromEmployees, updateFilterOptions]);

  useEffect(() => {
    if (tenantSlug) {
      fetchEmployees();
      setLastRefreshed(new Date());
    }
  }, [fetchEmployees, tenantSlug]);

  useEffect(() => {
    if (alert) {
      const timer = setTimeout(() => setAlert(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [alert]);

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

  const departmentDistribution = useMemo(() => {
    if (employees.length === 0) return [] as { dept: string; count: number; pct: number }[];

    const counts = employees.reduce<Record<string, number>>((acc, employee) => {
      const key = employee.department || 'Unassigned';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const total = employees.length;

    return Object.entries(counts)
      .map(([dept, count]) => ({
        dept,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [employees]);

  const statusSummary = useMemo(() => {
    if (employees.length === 0) {
      return {
        active: 0,
        onLeave: 0,
        inactive: 0,
        terminated: 0,
      };
    }

    return employees.reduce(
      (acc, employee) => {
        const status = employee.status;
        if (status === 'Active') acc.active += 1;
        else if (status === 'On Leave') acc.onLeave += 1;
        else if (status === 'Terminated') acc.terminated += 1;
        else acc.inactive += 1;
        return acc;
      },
      { active: 0, onLeave: 0, inactive: 0, terminated: 0 }
    );
  }, [employees]);

  const handleAddEmployee = async (data: AddEmployeeFormData) => {
    setAlert(null);
    try {
      const payload = {
        tenantSlug,
        name: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        departmentId: data.department,
        jobTitle: data.position || undefined,
        hireDate: data.startDate ? new Date(data.startDate).toISOString() : undefined,
      };

      const response = await apiClient.post<{ success: boolean; data: ApiEmployee }>(
        `/api/tenant/employees?tenantSlug=${tenantSlug}`,
        payload
      );

      if (!response.data?.success) {
        throw new Error('Failed to add employee');
      }

      const created = response.data.data;
      const newEmployee: Employee = {
        id: created.id,
        name: created.name,
        email: created.email,
        department: created.departmentId || 'Unassigned',
        position: created.jobTitle || 'Not specified',
        startDate: created.hireDate ? new Date(created.hireDate).toISOString().split('T')[0] : 'N/A',
        status: created.status ? formatEmployeeStatus(created.status) : 'Active',
        performance: 'Good',
        salary: data.salary || '—',
      };

      setEmployees((prev) => {
        const next = [...prev, newEmployee];
        updateFilterOptions(next);
        if (!hasLivePayrollMetrics) {
          recalcPayrollFromEmployees(next);
        }
        return next;
      });
      setAlert({ type: 'success', message: 'Employee added successfully!' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to add employee';
      setAlert({ type: 'error', message });
      throw error;
    }
  };

  const handleViewEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowViewModal(true);
  };

  const handleEditEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowViewModal(false);
    setShowEditModal(true);
  };

  const handleRequestDeleteEmployee = (emp: Employee) => {
    setEmployeeToDelete(emp);
    setShowViewModal(false);
    setShowDeleteModal(true);
  };

  const handleUpdateEmployee = async (data: EditEmployeeFormData) => {
    if (!selectedEmployee) {
      throw new Error('No employee selected');
    }

    const fullName = `${data.firstName} ${data.lastName}`.trim();
    const payload: Record<string, unknown> = {};

    if (fullName && fullName !== selectedEmployee.name) {
      payload.name = fullName;
    }

    if (data.department && data.department !== selectedEmployee.department) {
      payload.departmentId = data.department;
    }

    if (data.position && data.position !== selectedEmployee.position) {
      payload.jobTitle = data.position;
    }

    if (data.status) {
      const normalizedStatus = normalizeStatusLabel(data.status);
      if (normalizedStatus !== normalizeStatusLabel(selectedEmployee.status)) {
        payload.status = normalizedStatus;
      }
    }

    if (Object.keys(payload).length === 0) {
      throw new Error('No changes to update');
    }

    const response = await apiClient.patch<{ success: boolean; data: ApiEmployee }>(
      `/api/tenant/employees?id=${selectedEmployee.id}&tenantSlug=${tenantSlug}`,
      payload
    );

    if (!response.data?.success) {
      throw new Error('Failed to update employee');
    }

    const updated = response.data.data;

    const updatedEmployee: Employee = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      department: updated.departmentId || 'Unassigned',
      position: updated.jobTitle || 'Not specified',
      startDate: updated.hireDate ? new Date(updated.hireDate).toISOString().split('T')[0] : 'N/A',
      status: updated.status ? formatEmployeeStatus(updated.status) : 'Active',
      performance: selectedEmployee.performance,
      salary: typeof updated.salary === 'number' ? updated.salary.toString() : updated.salary?.toString() ?? selectedEmployee.salary,
    };

    setEmployees((prev) => {
      const next = prev.map((emp) => (emp.id === selectedEmployee.id ? updatedEmployee : emp));
      updateFilterOptions(next);
      if (!hasLivePayrollMetrics) {
        recalcPayrollFromEmployees(next);
      }
      return next;
    });

    setSelectedEmployee(updatedEmployee);

    setAlert({ type: 'success', message: 'Employee updated successfully!' });
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!employeeToDelete) {
      throw new Error('No employee selected');
    }

    const response = await apiClient.delete<{ success: boolean; message?: string }>(
      `/api/tenant/employees?id=${employeeToDelete.id}&tenantSlug=${tenantSlug}`
    );

    if (!response.data?.success) {
      throw new Error(response.data?.message ?? 'Failed to delete employee');
    }

    setEmployees((prev) => {
      const next = prev.filter(emp => emp.id !== employeeToDelete.id);
      updateFilterOptions(next);
      if (!hasLivePayrollMetrics) {
        recalcPayrollFromEmployees(next);
      }
      return next;
    });
    setSelectedEmployee(prev => (prev && prev.id === employeeToDelete.id ? null : prev));
    setAlert({ type: 'success', message: `${employeeToDelete.name} was removed` });
    setShowDeleteModal(false);
    setEmployeeToDelete(null);
  };

  const handleAwardEmployee = async (emp: Employee) => {
    try {
      await apiClient.post(`/api/tenant/employees/${emp.id}/awards`, {
        tenantSlug,
        awardedAt: new Date().toISOString()
      });
      setAlert({ type: 'success', message: `Award submitted for ${emp.name}!` });
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Failed to submit award' });
    }
  };

  const handleExportReport = async () => {
    const csvContent = [
      ['Name', 'Email', 'Department', 'Position', 'Status', 'Performance'],
      ...filteredEmployees.map(e => [e.name, e.email, e.department, e.position, e.status, e.performance])
    ].map(row => row.join(',')).join('\n');

    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hr-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handlePayrollSubmit = async (data: any) => {
    try {
      await apiClient.post('/api/tenant/payroll/run', {
        tenantSlug,
        ...data
      });
      setAlert({ type: 'success', message: 'Payroll run successfully completed!' });
      const refresh = await apiClient.get<{ success: boolean; data?: PayrollMetrics }>(
        `/api/tenant/payroll/summary?tenantSlug=${tenantSlug}`
      );
      if (refresh.data?.success && refresh.data.data) {
        setPayrollMetrics(refresh.data.data);
        setHasLivePayrollMetrics(true);
      } else if (!hasLivePayrollMetrics) {
        recalcPayrollFromEmployees(employees);
      }
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Failed to run payroll' });
    }
  };

  const handleJobSubmit = async (data: any) => {
    try {
      await apiClient.post('/api/tenant/jobs', {
        tenantSlug,
        ...data
      });
      setAlert({ type: 'success', message: 'Job posting created successfully!' });
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Failed to create job posting' });
    }
  };

  const handleTrainingSubmit = async (data: any) => {
    try {
      const payload = {
        tenantSlug,
        ...data
      };
      const response = await apiClient.post<{ success: boolean; data: TrainingSession }>(
        '/api/tenant/training',
        payload
      );

      const session: TrainingSession = response.data?.data || {
        id: crypto.randomUUID(),
        title: data.title,
        status: 'Upcoming',
        participants: Number(data.maxParticipants) || 0,
        instructor: data.instructor || 'TBD',
        startDate: data.startDate
      };

      setTrainingSessions((prev) => [session, ...prev]);
      setAlert({ type: 'success', message: 'Training session scheduled successfully!' });
    } catch (error) {
      setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Failed to schedule training' });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Human Resources</h2>
        <p className="text-gray-600">Manage employee records, payroll, benefits, and HR analytics</p>
      </div>

      {/* HR Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Employees</p>
              <p className="text-xl font-bold text-gray-900">{employees.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Employees</p>
              <p className="text-xl font-bold text-gray-900">{statusSummary.active}</p>
            </div>
            <Target className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">On Leave</p>
              <p className="text-xl font-bold text-gray-900">{statusSummary.onLeave}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Terminated / Inactive</p>
              <p className="text-xl font-bold text-gray-900">{statusSummary.terminated + statusSummary.inactive}</p>
            </div>
            <Award className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Employee
          </button>
          <button onClick={() => setShowPayrollModal(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <DollarSign className="w-4 h-4 mr-2 inline" />
            Run Payroll
          </button>
          <button onClick={() => setShowJobModal(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <Target className="w-4 h-4 mr-2 inline" />
            Post Job
          </button>
          <button onClick={handleExportReport} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4 mr-2 inline" />
            Export Reports
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              {departmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input 
              type="text" 
              placeholder="Search employees..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
              <Filter className="w-4 h-4 mr-2 inline" />
              More Filters
            </button>
          </div>
        </div>
      </div>

      {/* Employee Directory */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Employee Directory</h3>
            {lastRefreshed && (
              <p className="text-xs text-gray-500 mt-1">
                Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEmployees}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <span className="text-sm text-gray-500">Showing {filteredEmployees.length}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          {errorMessage ? (
            <div className="p-6 text-center">
              <p className="text-sm text-red-600">{errorMessage}</p>
              <button
                onClick={fetchEmployees}
                className="mt-3 inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-32"></div>
                      <div className="h-3 bg-gray-300 rounded w-48"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">No employees found</p>
              <p className="text-sm text-gray-500 mb-4">
                {employees.length === 0 
                  ? 'Add your first employee to get started with HR management'
                  : 'Try adjusting your filters or search query'}
              </p>
              {employees.length === 0 && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add First Employee
                </button>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Performance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium mr-3">
                          {employee.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{employee.name}</p>
                          <p className="text-sm text-gray-500">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{employee.department}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{employee.position}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        employee.status === 'Active' ? 'bg-green-100 text-green-800' :
                        employee.status === 'On Leave' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        employee.performance === 'Excellent' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {employee.performance}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleViewEmployee(employee)} className="text-blue-600 hover:text-blue-800">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleEditEmployee(employee)} className="text-green-600 hover:text-green-800">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleAwardEmployee(employee)} className="text-purple-600 hover:text-purple-800">
                          <Award className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* HR Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h3>
          {departmentDistribution.length === 0 ? (
            <p className="text-sm text-gray-500">Add employees to see department insights.</p>
          ) : (
            <div className="space-y-3">
              {departmentDistribution.map((d) => (
                <div key={d.dept} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900 w-32 truncate">{d.dept}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${Math.min(d.pct, 100)}%` }}></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            {[{
              label: 'Monthly',
              value: payrollMetrics.monthly,
              accent: 'bg-blue-50 text-blue-600'
            }, {
              label: 'Annual',
              value: payrollMetrics.annual,
              accent: 'bg-green-50 text-green-600'
            }, {
              label: 'Avg Salary',
              value: payrollMetrics.averageSalary,
              accent: 'bg-purple-50 text-purple-600'
            }, {
              label: 'Benefits',
              value: payrollMetrics.benefits,
              accent: 'bg-orange-50 text-orange-600'
            }].map((metric) => (
              <div key={metric.label} className={`text-center p-4 rounded-lg ${metric.accent}`}> 
                <p className="text-2xl font-bold">
                  {metric.value ? 
                    metric.value.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }) :
                    '—' }
                </p>
                <p className="text-sm text-gray-600">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Training Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Training & Development</h3>
          <button onClick={() => setShowTrainingModal(true)} className="text-sm text-blue-600 hover:text-blue-800">Schedule Training</button>
        </div>
        <div className="space-y-3">
          {trainingSessions.length === 0 ? (
            <div className="p-8 text-center">
              <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium mb-2">No training sessions scheduled</p>
              <p className="text-sm text-gray-500 mb-4">Create training sessions to develop your team</p>
              <button
                onClick={() => setShowTrainingModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Schedule Training
              </button>
            </div>
          ) : (
            trainingSessions.map((session) => (
              <div key={session.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium text-gray-900">{session.title}</h4>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      session.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      session.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {session.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {session.participants} participants • Instructor: {session.instructor}
                    {session.startDate ? ` • Starts ${new Date(session.startDate).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const nextStatus = session.status === 'Upcoming'
                        ? 'In Progress'
                        : session.status === 'In Progress'
                          ? 'Completed'
                          : 'Completed';
                      try {
                        await apiClient.patch(`/api/tenant/training/${session.id}`, {
                          tenantSlug,
                          status: nextStatus
                        });
                        setTrainingSessions((prev) =>
                          prev.map((item) =>
                            item.id === session.id ? { ...item, status: nextStatus } : item
                          )
                        );
                        setAlert({ type: 'success', message: `Training marked as ${nextStatus}` });
                      } catch (error) {
                        setAlert({ type: 'error', message: error instanceof Error ? error.message : 'Unable to update training status' });
                      }
                    }}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    <Briefcase className="w-4 h-4" />
                    Advance Status
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddEmployee}
        departments={departmentOptionsForForms}
      />
      <RunPayrollModal
        isOpen={showPayrollModal}
        onClose={() => setShowPayrollModal(false)}
        onSubmit={handlePayrollSubmit}
      />
      <PostJobModal
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
        onSubmit={handleJobSubmit}
        departments={departmentOptionsForForms}
      />
      <ViewEmployeeModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        employee={selectedEmployee}
        onEdit={handleEditEmployee}
        onAward={handleAwardEmployee}
        onDelete={handleRequestDeleteEmployee}
      />
      <EditEmployeeModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdateEmployee}
        employee={selectedEmployee}
        departments={departmentOptionsForForms}
        statuses={statusOptionsForForms}
      />
      <DeleteEmployeeModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setEmployeeToDelete(null);
        }}
        onConfirm={handleConfirmDeleteEmployee}
        employeeName={employeeToDelete?.name}
      />
      <TrainingModal
        isOpen={showTrainingModal}
        onClose={() => setShowTrainingModal(false)}
        onSubmit={handleTrainingSubmit}
      />

      {/* HR Main Tabs Section */}
      <div className="mt-12 border-t border-gray-200 pt-8">
        <HRMainTabs
          tenantSlug={tenantSlug}
          employees={filteredEmployees}
          onAddEmployee={() => setShowAddModal(true)}
          onEditEmployee={handleEditEmployee}
          onDeleteEmployee={(id: string) => {
            const emp = filteredEmployees.find(e => e.id === id);
            if (emp) {
              setEmployeeToDelete(emp);
              setShowDeleteModal(true);
            }
          }}
          onViewEmployee={handleViewEmployee}
        />
      </div>

      {/* HR Sub-Tabs Section */}
      <div className="mt-12 border-t border-gray-200 pt-8">
        <HRTabs tenantSlug={tenantSlug} />
      </div>

      {/* Alert */}
      {alert && (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white font-medium ${
          alert.type === 'success' ? 'bg-green-600' : alert.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        }`}>
          {alert.message}
        </div>
      )}
    </div>
  );
};

export default HRComponent;
