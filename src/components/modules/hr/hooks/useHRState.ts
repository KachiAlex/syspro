'use client';

import { useState } from 'react';
import { Employee, AlertMessage } from '../types';

export const useHRState = (initialEmployees: Employee[]) => {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [alert, setAlert] = useState<AlertMessage | null>(null);

  const filteredEmployees = employees.filter(emp => {
    if (departmentFilter !== 'All' && emp.department !== departmentFilter) return false;
    if (statusFilter !== 'All' && emp.status !== statusFilter) return false;
    if (searchQuery && !emp.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !emp.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const addEmployee = (newEmployee: Employee) => {
    setEmployees([...employees, newEmployee]);
    setAlert({ type: 'success', message: 'Employee added successfully!' });
  };

  const showAlert = (type: AlertMessage['type'], message: string) => {
    setAlert({ type, message });
  };

  return {
    employees,
    setEmployees,
    departmentFilter,
    setDepartmentFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    selectedEmployee,
    setSelectedEmployee,
    alert,
    setAlert,
    filteredEmployees,
    addEmployee,
    showAlert
  };
};
