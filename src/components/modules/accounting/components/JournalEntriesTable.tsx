'use client';

import React from 'react';
import { Eye, Edit } from 'lucide-react';
import { JournalEntry } from '../types';

interface JournalEntriesTableProps {
  entries: JournalEntry[];
  onView: (entry: JournalEntry) => void;
  onEdit: (entry: JournalEntry) => void;
}

export const JournalEntriesTable: React.FC<JournalEntriesTableProps> = ({
  entries,
  onView,
  onEdit
}) => {
  return (
    <div className="bg-theme-surface rounded-lg border border-theme-border p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-theme-text-primary">Recent Journal Entries</h3>
        <button className="text-theme-accent hover:text-blue-800 text-sm">View All</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Entry ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Account</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Debit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry, i) => (
              <tr key={i} className="hover:bg-theme-muted">
                <td className="px-4 py-3">{entry.id}</td>
                <td className="px-4 py-3">{entry.date}</td>
                <td className="px-4 py-3">{entry.account}</td>
                <td className="px-4 py-3">{entry.description}</td>
                <td className="px-4 py-3 font-semibold text-green-600">{entry.debit}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onView(entry)}
                      className="text-theme-accent hover:text-blue-800"
                      title="View entry"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => onEdit(entry)}
                      className="text-green-600 hover:text-green-800"
                      title="Edit entry"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
