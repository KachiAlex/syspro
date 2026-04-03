'use client';

import React, { useState, useMemo } from 'react';
import { Plus, Eye, Search } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

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

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: '1', name: 'John Smith', email: 'john@company.com', department: 'Engineering', position: 'Senior Developer', startDate: '2022-01-15', status: 'Active', salary: '$95,000' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@company.com', department: 'Sales', position: 'Sales Manager', startDate: '2021-06-20', status: 'Active', salary: '$85,000' },
  { id: '3', name: 'Mike Davis', email: 'mike@company.com', department: 'Marketing', position: 'Marketing Lead', startDate: '2022-03-10', status: 'On Leave', salary: '$75,000' },
  { id: '4', name: 'Emily Chen', email: 'emily@company.com', department: 'Engineering', position: 'Developer', startDate: '2023-01-05', status: 'Active', salary: '$80,000' },
  { id: '5', name: 'James Wilson', email: 'james@company.com', department: 'HR', position: 'HR Manager', startDate: '2020-09-12', status: 'Active', salary: '$70,000' },
];

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
  },
];

export default function StaffPage() {
  const { tenantSlug } = useTenantContext();
  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [showAddModal, setShowAddModal] = useState(false);

  const departments = ['All Departments', 'Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Operations'];
  const statuses = ['All Statuses', 'Active', 'On Leave', 'Inactive', 'Terminated'];

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
              {departments.map((dept) => (
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
                    <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
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
          {DEFAULT_TRAINING_SESSIONS.map((session) => (
            <div key={session.id} className="border border-gray-200 rounded-lg p-4">
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
                  <span className="text-gray-600">Enrollment:</span>
                  <span className="font-medium text-gray-900">{session.enrolled}/{session.capacity}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(session.enrolled / session.capacity) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
