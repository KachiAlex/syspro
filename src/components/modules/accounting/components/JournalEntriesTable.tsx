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
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Recent Journal Entries</h3>
        <button className="text-blue-600 hover:text-blue-800 text-sm">View All</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Debit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3">{entry.id}</td>
                <td className="px-4 py-3">{entry.date}</td>
                <td className="px-4 py-3">{entry.account}</td>
                <td className="px-4 py-3">{entry.description}</td>
                <td className="px-4 py-3 font-semibold text-green-600">{entry.debit}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => onView(entry)}
                      className="text-blue-600 hover:text-blue-800"
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
