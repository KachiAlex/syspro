'use client';

import React from 'react';
import { Plus, CreditCard, Calendar, Download } from 'lucide-react';

interface BillsQuickActionsProps {
  onAddBill: () => void;
  onMakePayment: () => void;
  onSchedulePayment: () => void;
  onExport: () => void;
}

export const BillsQuickActions: React.FC<BillsQuickActionsProps> = ({
  onAddBill,
  onMakePayment,
  onSchedulePayment,
  onExport
}) => {
  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onAddBill}
          className="px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Add Bill
        </button>
        <button 
          onClick={onMakePayment}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <CreditCard className="w-4 h-4 mr-2 inline" />
          Make Payment
        </button>
        <button 
          onClick={onSchedulePayment}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Calendar className="w-4 h-4 mr-2 inline" />
          Schedule Payments
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
