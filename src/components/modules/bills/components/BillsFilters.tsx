'use client';

import React from 'react';
import { Filter } from 'lucide-react';

interface BillsFiltersProps {
  statusFilter: string;
  vendorFilter: string;
  searchQuery: string;
  vendors: string[];
  onStatusChange: (value: string) => void;
  onVendorChange: (value: string) => void;
  onSearchChange: (value: string) => void;
}

const STATUSES = ['All Status', 'Draft', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue'];

export const BillsFilters: React.FC<BillsFiltersProps> = ({
  statusFilter,
  vendorFilter,
  searchQuery,
  vendors,
  onStatusChange,
  onVendorChange,
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
          value={vendorFilter}
          onChange={(e) => onVendorChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        >
          <option value="All">All Vendors</option>
          {vendors.map(vendor => (
            <option key={vendor} value={vendor}>{vendor}</option>
          ))}
        </select>
        <input 
          type="text" 
          placeholder="Search bills..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        />
        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
          <Filter className="w-4 h-4 mr-2 inline" />
          More Filters
        </button>
      </div>
    </div>
  );
};
