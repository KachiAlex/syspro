'use client';

import React, { useState } from 'react';
import { Plus, Eye, Edit, Award, Download, Filter, Users, Target, DollarSign } from 'lucide-react';
import { AddEmployeeModal, RunPayrollModal, PostJobModal, ViewEmployeeModal, TrainingModal } from './hr-modals';

interface HR {
  tenantSlug: string;
}

interface Employee {
  name: string;
  email: string;
  department: string;
  position: string;
  startDate: string;
  status: string;
  performance: string;
  salary: string;
}

const HRComponent: React.FC<HR> = ({ tenantSlug }) => {
  const [employees, setEmployees] = useState<Employee[]>([
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
  ]);

  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const filteredEmployees = employees.filter(emp => {
    if (departmentFilter !== 'All' && emp.department !== departmentFilter) return false;
    if (statusFilter !== 'All' && emp.status !== statusFilter) return false;
    if (searchQuery && !emp.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !emp.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleAddEmployee = (data: any) => {
    const newEmployee: Employee = {
      name: `${data.firstName} ${data.lastName}`,
      email: data.email,
      department: data.department,
      position: data.position,
      startDate: data.startDate,
      status: 'Active',
      performance: 'Good',
      salary: data.salary
    };
    setEmployees([...employees, newEmployee]);
    setAlert({ type: 'success', message: 'Employee added successfully!' });
  };

  const handleViewEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowViewModal(true);
  };

  const handleEditEmployee = (emp: Employee) => {
    setAlert({ type: 'info', message: 'Edit functionality would update employee details' });
  };

  const handleAwardEmployee = (emp: Employee) => {
    setAlert({ type: 'success', message: `Award submitted for ${emp.name}!` });
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
              <p className="text-sm text-gray-600">Open Positions</p>
              <p className="text-xl font-bold text-gray-900">12</p>
            </div>
            <Target className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Payroll</p>
              <p className="text-xl font-bold text-gray-900">$456,789</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg. Performance</p>
              <p className="text-xl font-bold text-gray-900">4.2/5</p>
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
              <option>All Departments</option>
              <option>Engineering</option>
              <option>Sales</option>
              <option>Marketing</option>
              <option>HR</option>
              <option>Finance</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>All Status</option>
              <option>Active</option>
              <option>On Leave</option>
              <option>Terminated</option>
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
          <h3 className="text-lg font-semibold text-gray-900">Employee Directory</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Showing {filteredEmployees.length}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
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
              {filteredEmployees.map((employee, index) => (
                <tr key={index} className="hover:bg-gray-50">
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
        </div>
      </div>

      {/* HR Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h3>
          <div className="space-y-3">
            {[
              { dept: 'Engineering', count: 45, pct: 19 },
              { dept: 'Sales', count: 38, pct: 16 },
              { dept: 'Marketing', count: 28, pct: 12 },
              { dept: 'Finance', count: 22, pct: 9 },
              { dept: 'Operations', count: 86, pct: 38 }
            ].map((d, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900 w-24">{d.dept}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${d.pct}%` }}></div>
                </div>
                <span className="text-sm text-gray-600 w-8 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payroll Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">$456,789</p>
              <p className="text-sm text-gray-600">Monthly</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">$5.4M</p>
              <p className="text-sm text-gray-600">Annual</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">$1,952</p>
              <p className="text-sm text-gray-600">Avg Salary</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">$234,567</p>
              <p className="text-sm text-gray-600">Benefits</p>
            </div>
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
          {[
            { title: 'Leadership Excellence', participants: 12, status: 'Upcoming', instructor: 'Dr. Sarah Mitchell' },
            { title: 'Advanced Sales', participants: 25, status: 'In Progress', instructor: 'John Anderson' },
            { title: 'Security Awareness', participants: 234, status: 'Completed', instructor: 'Security Team' }
          ].map((t, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="font-medium text-gray-900">{t.title}</h4>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    t.status === 'Completed' ? 'bg-green-100 text-green-800' :
                    t.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>{t.status}</span>
                </div>
                <p className="text-sm text-gray-600">{t.participants} participants • Instructor: {t.instructor}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <AddEmployeeModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSubmit={handleAddEmployee} />
      <RunPayrollModal isOpen={showPayrollModal} onClose={() => setShowPayrollModal(false)} onSubmit={() => setAlert({ type: 'success', message: 'Payroll run successfully completed!' })} />
      <PostJobModal isOpen={showJobModal} onClose={() => setShowJobModal(false)} onSubmit={() => setAlert({ type: 'success', message: 'Job posting created successfully!' })} />
      <ViewEmployeeModal isOpen={showViewModal} onClose={() => setShowViewModal(false)} employee={selectedEmployee} onEdit={handleEditEmployee} onAward={handleAwardEmployee} />
      <TrainingModal isOpen={showTrainingModal} onClose={() => setShowTrainingModal(false)} onSubmit={() => setAlert({ type: 'success', message: 'Training session scheduled successfully!' })} />

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
