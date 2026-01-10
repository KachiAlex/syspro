'use client';

import React from 'react';
import { DashboardActivity } from '../../lib/types/shared';

interface RecentActivityProps {
  activity?: DashboardActivity[];
  isLoading?: boolean;
}

export function RecentActivity({ activity = [], isLoading }: RecentActivityProps) {
  return (
    <div className="bg-white shadow rounded-lg h-full">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
          <button className="text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors">
            View all →
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <div>
                  <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-36 bg-gray-100 rounded" />
                </div>
                <div className="text-right">
                  <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
                  <div className="h-5 w-16 bg-gray-100 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : activity.length ? (
          <div className="space-y-3">
            {activity.map((item) => (
              <div
                key={`${item.type}-${item.reference}`}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.reference}</p>
                  <p className="text-sm text-gray-500">
                    {item.subject} • {new Date(item.occurredAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  {item.amount !== undefined && (
                    <p className="text-sm font-medium text-gray-900">
                      {Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(item.amount)}
                    </p>
                  )}
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusClasses(item.status)}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No recent activity yet.</p>
        )}
      </div>
    </div>
  );
}

function statusClasses(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return 'bg-green-100 text-green-800';
    case 'processing':
    case 'in-progress':
      return 'bg-yellow-100 text-yellow-800';
    case 'failed':
    case 'error':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
