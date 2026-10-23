'use client';

import React from 'react';
import { Plus, Send, Download } from 'lucide-react';

interface InvoicesActionsProps {
  onCreateInvoice: () => void;
  onSendInvoice: () => void;
  onExport: () => void;
}

export const InvoicesActions: React.FC<InvoicesActionsProps> = ({
  onCreateInvoice,
  onSendInvoice,
  onExport
}) => {
  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onCreateInvoice}
          className="px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Create Invoice
        </button>
        <button 
          onClick={onSendInvoice}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Send className="w-4 h-4 mr-2 inline" />
          Send Invoice
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
