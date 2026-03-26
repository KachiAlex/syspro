'use client';

import React from 'react';
import { Filter } from 'lucide-react';

interface HRFiltersProps {
  departmentFilter: string;
  statusFilter: string;
  searchQuery: string;
  onDepartmentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}

const DEPARTMENTS = ['All Departments', 'Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
const STATUSES = ['All Status', 'Active', 'On Leave', 'Terminated'];

export const HRFilters: React.FC<HRFiltersProps> = ({
  departmentFilter,
  statusFilter,
  searchQuery,
  onDepartmentChange,
  onStatusChange,
  onSearchChange
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          <select 
            value={departmentFilter} 
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {DEPARTMENTS.map(dept => (
              <option key={dept} value={dept === 'All Departments' ? 'All' : dept}>{dept}</option>
            ))}
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map(status => (
              <option key={status} value={status === 'All Status' ? 'All' : status}>{status}</option>
            ))}
          </select>
          <input 
            type="text" 
            placeholder="Search employees..." 
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
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
  );
};
