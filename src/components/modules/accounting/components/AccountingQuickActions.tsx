'use client';

import React from 'react';
import { Plus, FileText, Database, Download } from 'lucide-react';

interface AccountingQuickActionsProps {
  onJournalEntry: () => void;
  onGenerateReport: () => void;
  onChartOfAccounts: () => void;
  onExportData: () => void;
}

export const AccountingQuickActions: React.FC<AccountingQuickActionsProps> = ({
  onJournalEntry,
  onGenerateReport,
  onChartOfAccounts,
  onExportData
}) => {
  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onJournalEntry}
          className="px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Journal Entry
        </button>
        <button 
          onClick={onGenerateReport}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <FileText className="w-4 h-4 mr-2 inline" />
          Generate Report
        </button>
        <button 
          onClick={onChartOfAccounts}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          <Database className="w-4 h-4 mr-2 inline" />
          Chart of Accounts
        </button>
        <button 
          onClick={onExportData}
          className="px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted"
        >
          <Download className="w-4 h-4 mr-2 inline" />
          Export Data
        </button>
      </div>
    </div>
  );
};
