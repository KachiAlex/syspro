'use client';

import React from 'react';

export default function HistoryPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Automation</h2>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900">History</h1>
          <p>History page - minimal version for testing</p>
        </div>
      </div>
    </div>
  );
}
