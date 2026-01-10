'use client';

import React from 'react';
import { DashboardSystemStatus } from '../../lib/types/shared';

interface SystemStatusProps {
  services?: DashboardSystemStatus[];
  isLoading?: boolean;
}

export function SystemStatus({ services = [], isLoading }: SystemStatusProps) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex items-center space-x-3 animate-pulse">
                  <div className="w-3 h-3 bg-gray-200 rounded-full" />
                  <div>
                    <div className="h-4 w-24 bg-gray-200 rounded mb-1" />
                    <div className="h-3 w-32 bg-gray-100 rounded" />
                  </div>
                </div>
              ))
            : services.map((service) => (
                <div key={service.name} className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${statusDot(service.status)}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{service.name}</p>
                    <p className="text-sm text-gray-500">{service.message}</p>
                  </div>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}

function statusDot(status: string) {
  switch (status.toLowerCase()) {
    case 'operational':
    case 'healthy':
      return 'bg-green-400';
    case 'degraded':
      return 'bg-yellow-400';
    case 'outage':
      return 'bg-red-500';
    default:
      return 'bg-gray-300';
  }
}
