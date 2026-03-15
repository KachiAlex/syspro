'use client';

import React from 'react';
import { Plus, Package, Building, Download } from 'lucide-react';

interface ProcurementActionsProps {
  onNewRequisition: () => void;
  onCreatePO: () => void;
  onFindVendors: () => void;
  onExportReports: () => void;
}

export const ProcurementActions: React.FC<ProcurementActionsProps> = ({
  onNewRequisition,
  onCreatePO,
  onFindVendors,
  onExportReports
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onNewRequisition}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          New Requisition
        </button>
        <button 
          onClick={onCreatePO}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Package className="w-4 h-4 mr-2 inline" />
          Create PO
        </button>
        <button 
          onClick={onFindVendors}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Building className="w-4 h-4 mr-2 inline" />
          Find Vendors
        </button>
        <button 
          onClick={onExportReports}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4 mr-2 inline" />
          Export Reports
        </button>
      </div>
    </div>
  );
};
