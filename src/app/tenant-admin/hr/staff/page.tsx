'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Pencil, Search } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { HRService } from '@/app/tenant-admin/sections/hr-service';
import { AddEmployeeModal } from '@/app/tenant-admin/sections/hr-add-employee-modal';
import { EditEmployeeModal } from '@/app/tenant-admin/sections/hr-edit-employee-modal';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: string;
  startDate: string;
  status: string;
  salary: string;
  employmentType?: string;
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


export default function StaffPage() {
  const { tenantSlug } = useTenantContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [departments, setDepartments] = useState<string[]>(['All Departments']);
  const statuses = ['All Statuses', 'Active', 'On Leave', 'Inactive', 'Terminated'];
  const [currency, setCurrency] = useState('USD');

  const currencySymbol = (code: string) => {
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', NGN: '₦', JPY: '¥', CAD: 'C$', AUD: 'A$', INR: '₹', KES: 'KSh', GHS: '₵' };
    return symbols[code] || code;
  };

  const loadData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [fetchedEmployees, fetchedDepartments, fetchedTraining, fetchedCurrency] = await Promise.all([
        HRService.getEmployees(tenantSlug).catch(() => []),
        HRService.getDepartments(tenantSlug).catch(() => []),
        HRService.getTrainingSessions(tenantSlug).catch(() => []),
        HRService.getTenantCurrency(tenantSlug).catch(() => 'USD'),
      ]);
      setCurrency(fetchedCurrency);
      const sym = currencySymbol(fetchedCurrency);
      setEmployees(fetchedEmployees.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        position: emp.position,
        role: emp.role || 'Staff',
        startDate: emp.startDate,
        status: emp.status,
        salary: emp.salary ? `${sym}${Number(emp.salary).toLocaleString()}` : '',
        employmentType: emp.employmentType || 'Full-time',
      })));
      setDepartments(['All Departments', ...fetchedDepartments]);
      setTrainingSessions(fetchedTraining.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description || '',
        status: (s.status as 'planned' | 'ongoing' | 'completed') || 'planned',
        startDate: s.startDate || s.start_date || '',
        endDate: s.endDate || s.end_date || '',
        instructor: s.instructor || '',
        capacity: s.capacity || 0,
        enrolled: s.enrolled || 0,
        location: s.location || ''
      })));
    } catch (error) {
      console.error('Failed to load staff data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (departmentFilter !== 'All Departments' && emp.department !== departmentFilter) return false;
      if (statusFilter !== 'All Statuses' && emp.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!emp.name.toLowerCase().includes(query) && !emp.email.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [employees, departmentFilter, statusFilter, searchQuery]);

  const handleAddEmployee = async (data: any) => {
    if (!tenantSlug) return;
    await HRService.addEmployee(tenantSlug, data);
    await loadData();
  };

  const handleEditEmployee = async (data: any) => {
    if (!tenantSlug || !editingEmployee) return;
    await HRService.updateEmployee(tenantSlug, editingEmployee.id, data);
    await loadData();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-theme-text-tertiary" />
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
            <label className="block text-xs font-medium text-gray-900 mb-2">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Department</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Position</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Role</th>
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
                      emp.role === 'Executive' ? 'bg-purple-100 text-purple-800' :
                      emp.role === 'Admin' ? 'bg-blue-100 text-blue-800' :
                      emp.role === 'HOD' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.status === 'Active' ? 'bg-green-100 text-green-800' :
                      emp.status === 'On Leave' ? 'bg-amber-100 text-amber-800' :
                      emp.status === 'Inactive' ? 'bg-gray-100 text-gray-900' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{emp.startDate}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => {
                        setEditingEmployee(emp);
                        setShowEditModal(true);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      <Pencil className="w-4 h-4" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-600">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddEmployee}
        departments={departments.filter(d => d !== 'All Departments')}
        tenantSlug={tenantSlug || ''}
      />

      <EditEmployeeModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingEmployee(null); }}
        onSubmit={handleEditEmployee}
        employee={editingEmployee}
        departments={departments.filter(d => d !== 'All Departments')}
        tenantSlug={tenantSlug || ''}
      />

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

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Training & Development</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trainingSessions.length > 0 ? trainingSessions.map((session) => (
            <div key={session.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h5 className="font-semibold text-gray-900">{session.title}</h5>
                  <p className="text-xs text-gray-600 mt-1">{session.description}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${
                  session.status === 'completed' ? 'bg-green-100 text-green-800' :
                  session.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-900'
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
                  <span className="text-gray-600">Enrollment:</span>
                  <span className="font-medium text-gray-900">{session.enrolled}/{session.capacity}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(session.enrolled / session.capacity) * 100}%` }} />
              </div>
            </div>
          )) : (
            <p className="text-sm text-gray-600">No training sessions available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
