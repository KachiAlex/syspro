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
    <div className="bg-theme-surface rounded-lg border border-theme-border p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onAddVendor}
          className="px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Add Vendor
        </button>
        <button 
          onClick={onExport}
          className="px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted"
        >
          <Download className="w-4 h-4 mr-2 inline" />
          Export
        </button>
      </div>
    </div>
  );
};
