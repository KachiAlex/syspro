'use client';

import React from 'react';
import { Plus, Download, Send } from 'lucide-react';

interface POActionsProps {
  onCreate: () => void;
  onExport: () => void;
  onSendNotification: () => void;
}

export const POActions: React.FC<POActionsProps> = ({
  onCreate,
  onExport,
  onSendNotification
}) => {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Create PO
        </button>
        <button 
          onClick={onExport}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <Download className="w-4 h-4 mr-2 inline" />
          Export
        </button>
        <button 
          onClick={onSendNotification}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          <Send className="w-4 h-4 mr-2 inline" />
          Send Notifications
        </button>
      </div>
    </div>
  );
};
