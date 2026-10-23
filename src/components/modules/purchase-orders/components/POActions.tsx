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
    <div className="bg-theme-surface rounded-lg border border-theme-border p-4 mb-6">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={onCreate}
          className="px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover"
        >
          <Plus className="w-4 h-4 mr-2 inline" />
          Create PO
        </button>
        <button 
          onClick={onExport}
          className="px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted"
        >
          <Download className="w-4 h-4 mr-2 inline" />
          Export
        </button>
        <button 
          onClick={onSendNotification}
          className="px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted"
        >
          <Send className="w-4 h-4 mr-2 inline" />
          Send Notifications
        </button>
      </div>
    </div>
  );
};
