'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Eye, Edit, Award, Download, Filter, Users, Target, DollarSign, Briefcase, RefreshCw, Clock } from 'lucide-react';
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
  const [activeMainTab, setActiveMainTab] = useState<'staff' | 'attendance' | 'reports' | 'payroll'>('staff');

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
      
      // Ensure data is an array before mapping
      const employeeData = Array.isArray(payload?.data) ? payload.data : [];
      const normalized = employeeData.map((employee): Employee => ({
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
      console.error('Employee fetch error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load employees');
      // Set default empty state on error
      setEmployees([]);
      updateFilterOptions([]);
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">HR & Operations</h2>
        <p className="text-gray-600">Manage employee records, payroll, benefits, and HR analytics</p>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200 mb-8">
        <button
          onClick={() => setActiveMainTab('staff')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeMainTab === 'staff'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Staff
        </button>
        <button
          onClick={() => setActiveMainTab('attendance')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeMainTab === 'attendance'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Attendance
        </button>
        <button
          onClick={() => setActiveMainTab('reports')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeMainTab === 'reports'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Download className="w-4 h-4 inline mr-2" />
          Reports
        </button>
        <button
          onClick={() => setActiveMainTab('payroll')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeMainTab === 'payroll'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <DollarSign className="w-4 h-4 inline mr-2" />
          Payroll
        </button>
      </div>

      {/* Tab Content */}
      {activeMainTab === 'staff' && (
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
      )}

      {activeMainTab === 'attendance' && (
        <div className="space-y-6">
          <HRTabs tenantSlug={tenantSlug} />
        </div>
      )}

      {activeMainTab === 'reports' && (
        <div className="space-y-6">
          <HRTabs tenantSlug={tenantSlug} />
        </div>
      )}

      {activeMainTab === 'payroll' && (
        <div className="space-y-6">
          <HRTabs tenantSlug={tenantSlug} />
        </div>
      )}

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
