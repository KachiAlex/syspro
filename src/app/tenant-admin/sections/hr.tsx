'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus, Eye, Search, RefreshCw, Clock, DollarSign, BarChart2, Users, CheckCircle, Calendar,
  Download, MoreVertical, Award, Briefcase
} from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { AddEmployeeModal } from './hr-add-employee-modal';
import { EditEmployeeModal, ViewEmployeeModal, DeleteEmployeeModal, RunPayrollModal, PostJobModal, TrainingModal } from './hr-modals';
import { AttendanceModal, LeaveModal } from './hr-attendance-modals';
import { GenerateReportModal, ReportHistoryModal } from './hr-reports-modals';
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

const HRComponent: React.FC = () => {
  const { tenantSlug } = useTenantContext();
  const [activeTab, setActiveTab] = useState<HRTab>('overview');
  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
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
  const [showGenerateReportModal, setShowGenerateReportModal] = useState(false);
  const [showReportHistoryModal, setShowReportHistoryModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<string[]>(['Engineering', 'Sales', 'Marketing', 'HR', 'Finance']);
  const [statuses, setStatuses] = useState<string[]>(['Active', 'On Leave', 'Terminated']);
  const [reports, setReports] = useState<any[]>([]);

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
      console.log('Attendance marked successfully');
    } catch (error) {
      console.error('Failed to mark attendance:', error);
      throw error;
    }
  };

  const handleSubmitLeave = async (leaveData: any) => {
    if (!tenantSlug) return;
    
    try {
      await HRService.submitLeaveRequest(tenantSlug, leaveData);
      console.log('Leave request submitted successfully');
    } catch (error) {
      console.error('Failed to submit leave request:', error);
      throw error;
    }
  };

  const handleGenerateReport = async (reportData: any) => {
    if (!tenantSlug) return;
    
    try {
      const report = await HRService.generateReport(tenantSlug, reportData);
      setReports(prev => [report, ...prev]);
      console.log('Report generated successfully');
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
      console.log('Employee added successfully:', newEmployee);
    } catch (error) {
      console.error('Failed to add employee:', error);
      throw error;
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">HR & Operations Overview</h2>
          <p className="text-gray-600 mt-1">Enterprise-wide human resources management and analytics</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Departments</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{new Set(employees.map(e => e.department)).size}</p>
            </div>
            <Briefcase className="w-12 h-12 text-blue-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Organizational units</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(count / employees.length) * 100}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={() => setShowAttendanceModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <Clock className="w-4 h-4" />
              Mark Attendance
            </button>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <Calendar className="w-4 h-4" />
              Request Leave
            </button>
            <button
              onClick={() => setShowRunPayrollModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <DollarSign className="w-4 h-4" />
              Run Payroll
            </button>
            <button
              onClick={() => setShowGenerateReportModal(true)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100"
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
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleViewEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700 transition-colors"
                        title="Edit Employee"
                      >
                        <Search className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteEmployee(emp)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
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

  const renderAttendanceTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Attendance & Leave Management</h2>
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
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Present Today</p>
          <p className="text-2xl font-bold text-green-600">{employees.filter(e => e.status === 'Active').length}</p>
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

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Attendance Records</h3>
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
              {employees.slice(0, 5).map((emp) => (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Pending Leave Requests</h4>
          <div className="space-y-3">
            {[
              { name: 'John Smith', type: 'Annual', days: 5, from: '2026-04-15', to: '2026-04-20' },
              { name: 'Sarah Johnson', type: 'Sick', days: 2, from: '2026-04-10', to: '2026-04-12' },
            ].map((req, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{req.name}</p>
                  <p className="text-xs text-gray-600">{req.type} • {req.days} days</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100">
                    Approve
                  </button>
                  <button className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100">
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Leave Balance</h4>
          <div className="space-y-3">
            {[
              { type: 'Annual Leave', used: 10, total: 20, remaining: 10 },
              { type: 'Sick Leave', used: 2, total: 10, remaining: 8 },
              { type: 'Personal Leave', used: 1, total: 5, remaining: 4 },
            ].map((leave, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{leave.type}</span>
                  <span className="text-sm text-gray-600">{leave.remaining}/{leave.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(leave.used / leave.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPayrollTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Payroll Management</h2>
        <button
          onClick={() => setShowRunPayrollModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <DollarSign className="w-4 h-4" />
          Run Payroll
        </button>
      </div>

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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Breakdown</h3>
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
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
              <span className="ml-4 text-sm text-gray-600 w-12 text-right">{item.percentage}%</span>
            </div>
          ))}
        </div>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              { period: 'April 2026', employees: 5, amount: '$125,450', status: 'Paid', date: '2026-04-05' },
              { period: 'March 2026', employees: 5, amount: '$125,450', status: 'Paid', date: '2026-03-05' },
              { period: 'February 2026', employees: 5, amount: '$123,210', status: 'Paid', date: '2026-02-05' },
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReportsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">HR Reports & Analytics</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowGenerateReportModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <BarChart2 className="w-4 h-4" />
            Generate Report
          </button>
          <button
            onClick={() => setShowReportHistoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Report History
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <h4 className="font-semibold text-gray-900 mb-4">Key Metrics</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Turnover Rate</span>
              <span className="font-semibold text-gray-900">2.2%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg Tenure</span>
              <span className="font-semibold text-gray-900">4.8 yrs</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Attendance Rate</span>
              <span className="font-semibold text-gray-900">96.5%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Training Hours</span>
              <span className="font-semibold text-gray-900">156</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Salary Distribution</h4>
        <div className="space-y-3">
          {[
            { range: '$40K - $60K', count: 1, percentage: 20 },
            { range: '$60K - $80K', count: 2, percentage: 40 },
            { range: '$80K - $100K', count: 1, percentage: 20 },
            { range: '$100K+', count: 1, percentage: 20 },
          ].map((item, idx) => (
            <div key={idx}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">{item.range}</span>
                <span className="text-sm font-semibold text-gray-900">{item.count} ({item.percentage}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Compliance Reports</h4>
        <div className="space-y-3">
          {[
            { name: 'Equal Employment Opportunity (EEO)', status: 'Compliant', lastUpdated: '2026-04-01' },
            { name: 'FMLA Compliance Report', status: 'Compliant', lastUpdated: '2026-04-01' },
            { name: 'Wage & Hour Compliance', status: 'Compliant', lastUpdated: '2026-04-01' },
            { name: 'Benefits Compliance', status: 'Compliant', lastUpdated: '2026-03-20' },
          ].map((report, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{report.name}</p>
                <p className="text-xs text-gray-600 mt-1">Last updated: {report.lastUpdated}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {report.status}
                </span>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const tabs: { id: HRTab; label: string }[] = [
    { id: 'overview', label: 'HR & Operations' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
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
        onSubmit={async (data) => {
          // Handle edit employee
          console.log('Edit employee:', data);
        }}
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
        onConfirm={async () => {
          // Handle delete employee
          console.log('Delete employee:', selectedEmployee?.name);
        }}
        employeeName={selectedEmployee?.name}
      />

      {/* Payroll & Training Modals */}
      <RunPayrollModal
        isOpen={showRunPayrollModal}
        onClose={() => setShowRunPayrollModal(false)}
        onSubmit={async (data) => {
          // Handle run payroll
          console.log('Run payroll:', data);
        }}
      />

      <PostJobModal
        isOpen={showPostJobModal}
        onClose={() => setShowPostJobModal(false)}
        onSubmit={async (data) => {
          // Handle post job
          console.log('Post job:', data);
        }}
        departments={departments}
      />

      <TrainingModal
        isOpen={showTrainingModal}
        onClose={() => setShowTrainingModal(false)}
        onSubmit={async (data) => {
          // Handle training session
          console.log('Create training:', data);
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
      <GenerateReportModal
        isOpen={showGenerateReportModal}
        onClose={() => setShowGenerateReportModal(false)}
        onSubmit={handleGenerateReport}
      />

      <ReportHistoryModal
        isOpen={showReportHistoryModal}
        onClose={() => setShowReportHistoryModal(false)}
        reports={reports}
        onDownload={async (reportId) => {
          // Handle download report
          console.log('Download report:', reportId);
        }}
        onDelete={async (reportId) => {
          // Handle delete report
          setReports(prev => prev.filter(r => r.id !== reportId));
          console.log('Delete report:', reportId);
        }}
      />
    </div>
  );
};

export default HRComponent;
