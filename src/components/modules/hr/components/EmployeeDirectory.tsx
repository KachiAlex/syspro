'use client';

import React from 'react';
import { Eye, Edit, Award } from 'lucide-react';
import { Employee } from '../types';

interface EmployeeDirectoryProps {
  employees: Employee[];
  onView: (employee: Employee) => void;
  onEdit: (employee: Employee) => void;
  onAward: (employee: Employee) => void;
}

export const EmployeeDirectory: React.FC<EmployeeDirectoryProps> = ({
  employees,
  onView,
  onEdit,
  onAward
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Employee Directory</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Showing {employees.length}</span>
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
            {employees.map((employee, index) => (
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
                    <button 
                      onClick={() => onView(employee)}
                      className="text-blue-600 hover:text-blue-800"
                      title="View employee"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onEdit(employee)}
                      className="text-green-600 hover:text-green-800"
                      title="Edit employee"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onAward(employee)}
                      className="text-purple-600 hover:text-purple-800"
                      title="Award employee"
                    >
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
  );
};
