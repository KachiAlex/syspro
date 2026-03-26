'use client';

import React from 'react';
import {
  HRHeader,
  HRStatistics,
  HRQuickActions,
  HRFilters,
  EmployeeDirectory,
  HRAnalytics,
  TrainingSection,
  Alert,
  useHRState,
  type Employee,
  type DepartmentInfo,
  type PayrollInfo
} from './index';
import { useHRData } from '@/hooks/useHRData';
import { AddEmployeeModal, EditEmployeeModal, RunPayrollModal, PostJobModal, ViewEmployeeModal, TrainingModal } from '@/app/tenant-admin/sections/hr-modals';

interface HRModuleProps {
  tenantSlug: string;
  initialEmployees?: Employee[];
}

export const HRModule: React.FC<HRModuleProps> = ({
  tenantSlug,
  initialEmployees = [
    {
      name: 'Alex Johnson',
      email: 'alex.johnson@company.com',
      department: 'Engineering',
      position: 'Senior Developer',
      startDate: '2021-03-15',
      status: 'Active',
      performance: 'Excellent',
      salary: '$95,000'
    },
    {
      name: 'Sarah Williams',
      email: 'sarah.williams@company.com',
      department: 'Sales',
      position: 'Sales Manager',
      startDate: '2020-08-22',
      status: 'Active',
      performance: 'Good',
      salary: '$85,000'
    }
  ]
}) => {
  // Use the new API hook for real data
  const {
    employees,
    loading: dataLoading,
    error: dataError,
    createEmployee: createEmployeeAPI,
    updateEmployee: updateEmployeeAPI,
    filters,
    setFilters,
    refetch: refetchEmployees,
  } = useHRData({ tenantSlug });

  // Keep local state for UI like filter and search
  const [departmentFilter, setDepartmentFilter] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedEmployee, setSelectedEmployee] = React.useState<Employee | null>(null);
  const [alert, setAlert] = React.useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Update API filters when local filters change
  React.useEffect(() => {
    setFilters({
      department: departmentFilter || undefined,
      status: statusFilter || undefined,
      search: searchQuery || undefined,
    });
  }, [departmentFilter, statusFilter, searchQuery, setFilters]);

  // Filter employees locally for display (simplified)
  const filteredEmployees = React.useMemo(() => {
    return employees.filter(emp => {
      const matchDept = !departmentFilter || emp.department === departmentFilter;
      const matchStatus = !statusFilter || emp.status === statusFilter;
      const matchSearch = !searchQuery || 
        emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDept && matchStatus && matchSearch;
    });
  }, [employees, departmentFilter, statusFilter, searchQuery]);

  const showAlert = (type: 'success' | 'error' | 'info', message: string) => {
    setAlert({ type, message });
  };

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showPayrollModal, setShowPayrollModal] = React.useState(false);
  const [showJobModal, setShowJobModal] = React.useState(false);
  const [showViewModal, setShowViewModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showTrainingModal, setShowTrainingModal] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleAddEmployee = async (data: any) => {
    setIsSubmitting(true);
    try {
      const success = await createEmployeeAPI({
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        department: data.department,
        position: data.position,
        startDate: data.startDate,
        status: 'Active',
        performance: 'Good',
        salary: data.salary
      });
      
      if (success) {
        showAlert('success', 'Employee added successfully!');
        setShowAddModal(false);
      } else {
        showAlert('error', 'Failed to add employee');
      }
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to add employee');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateEmployee = async (data: any) => {
    if (!selectedEmployee) return;
    setIsSubmitting(true);
    try {
      const success = await updateEmployeeAPI(selectedEmployee.name, {
        name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        department: data.department,
        position: data.position,
        startDate: data.startDate,
        salary: data.salary
      });
      
      if (success) {
        showAlert('success', 'Employee updated successfully!');
        setShowEditModal(false);
        setShowViewModal(false);
      } else {
        showAlert('error', 'Failed to update employee');
      }
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to update employee');
    } finally {
      setIsSubmitting(false);
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
    showAlert('success', 'Report exported successfully!');
  };

  return (
    <div className="p-6">
      <HRHeader />
      
      <HRStatistics totalEmployees={employees.length} />
      
      <HRQuickActions
        onAddEmployee={() => setShowAddModal(true)}
        onRunPayroll={() => setShowPayrollModal(true)}
        onPostJob={() => setShowJobModal(true)}
        onExportReport={handleExportReport}
      />
      
      <HRFilters
        departmentFilter={departmentFilter}
        statusFilter={statusFilter}
        searchQuery={searchQuery}
        onDepartmentChange={setDepartmentFilter}
        onStatusChange={setStatusFilter}
        onSearchChange={setSearchQuery}
      />
      
      <EmployeeDirectory
        employees={filteredEmployees}
        onView={(emp) => {
          setSelectedEmployee(emp);
          setShowViewModal(true);
        }}
        onEdit={(emp) => showAlert('info', `Edit functionality for ${emp.name}`)}
        onAward={(emp) => showAlert('success', `Award submitted for ${emp.name}!`)}
      />
      
      <HRAnalytics />
      
      <TrainingSection
        onScheduleTraining={() => setShowTrainingModal(true)}
      />
      
      {/* Modals */}
      <AddEmployeeModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onSubmit={handleAddEmployee}
      />
      <EditEmployeeModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdateEmployee}
        employee={selectedEmployee || undefined}
      />
      <RunPayrollModal 
        isOpen={showPayrollModal}
        onClose={() => setShowPayrollModal(false)}
        onSubmit={() => {
          showAlert('success', 'Payroll run completed!');
          setShowPayrollModal(false);
        }}
      />
      <PostJobModal 
        isOpen={showJobModal}
        onClose={() => setShowJobModal(false)}
        onSubmit={() => {
          showAlert('success', 'Job posting created!');
          setShowJobModal(false);
        }}
      />
      <ViewEmployeeModal 
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        employee={selectedEmployee}
        onEdit={(emp) => {
          setSelectedEmployee(emp);
          setShowViewModal(false);
          setShowEditModal(true);
        }}
        onAward={(emp) => showAlert('success', `Award for ${emp.name}!`)}
      />
      <TrainingModal 
        isOpen={showTrainingModal}
        onClose={() => setShowTrainingModal(false)}
        onSubmit={() => {
          showAlert('success', 'Training session scheduled!');
          setShowTrainingModal(false);
        }}
      />
      
      <Alert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
};

export default HRModule;
