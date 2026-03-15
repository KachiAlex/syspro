'use client';

import React from 'react';
import { Filter } from 'lucide-react';

interface VendorsFiltersProps {
  statusFilter: string;
  categoryFilter: string;
  searchQuery: string;
  categories: string[];
  onStatusChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}

const STATUSES = ['All Status', 'Active', 'Inactive'];

export const VendorsFilters: React.FC<VendorsFiltersProps> = ({
  statusFilter,
  categoryFilter,
  searchQuery,
  categories,
  onStatusChange,
  onCategoryChange,
  onSearchChange
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <select 
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          {STATUSES.map(status => (
            <option key={status} value={status === 'All Status' ? 'All' : status}>{status}</option>
          ))}
        </select>
        <select 
          value={categoryFilter}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="All">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <input 
          type="text" 
          placeholder="Search vendors..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg flex-1"
        />
        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          <Filter className="w-4 h-4 mr-2 inline" />
          Filters
        </button>
      </div>
    </div>
  );
};
