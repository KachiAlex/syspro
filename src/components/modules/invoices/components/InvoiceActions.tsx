'use client';

import React from 'react';
import { Plus, Send, Download } from 'lucide-react';

interface InvoiceActionsProps {
  onCreate: () => void;
  onSend: () => void;
  onExport: () => void;
}

export const InvoiceActions: React.FC<InvoiceActionsProps> = ({
  onCreate,
  onSend,
  onExport
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Create Invoice
        </button>
        <button 
          onClick={onSend}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Send className="w-4 h-4 mr-2 inline" />
          Send Invoice
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
