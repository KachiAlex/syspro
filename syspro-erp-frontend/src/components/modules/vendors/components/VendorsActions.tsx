'use client';

import React from 'react';
import { Plus, Download } from 'lucide-react';

interface VendorsActionsProps {
  onAddVendor: () => void;
  onExport: () => void;
}

export const VendorsActions: React.FC<VendorsActionsProps> = ({
  onAddVendor,
  onExport
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onAddVendor}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Add Vendor
        </button>
        <button 
          onClick={onExport}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4 mr-2 inline" />
          Export
        </button>
      </div>
    </div>
  );
};
