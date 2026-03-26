'use client';

import React from 'react';
import { Plus, DollarSign, Target, Download } from 'lucide-react';

interface HRQuickActionsProps {
  onAddEmployee: () => void;
  onRunPayroll: () => void;
  onPostJob: () => void;
  onExportReport: () => void;
}

export const HRQuickActions: React.FC<HRQuickActionsProps> = ({
  onAddEmployee,
  onRunPayroll,
  onPostJob,
  onExportReport
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onAddEmployee}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Add Employee
        </button>
        <button 
          onClick={onRunPayroll}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <DollarSign className="w-4 h-4 mr-2 inline" />
          Run Payroll
        </button>
        <button 
          onClick={onPostJob}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Target className="w-4 h-4 mr-2 inline" />
          Post Job
        </button>
        <button 
          onClick={onExportReport}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4 mr-2 inline" />
          Export Reports
        </button>
      </div>
    </div>
  );
};
