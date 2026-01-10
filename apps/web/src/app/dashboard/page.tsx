'use client';
/**
 * Dashboard Page
 * Main dashboard interface for authenticated users
 */

import React from 'react';
import { DashboardLayout } from '../../components/layout/dashboard-layout';
import { useAuth } from '../../contexts/auth-context';
import { useDashboardSummary } from '../../hooks/use-dashboard-summary';
import { StatsGrid } from '../../components/dashboard/stats-grid';
import { RecentActivity } from '../../components/dashboard/recent-activity';
import { QuickActions } from '../../components/dashboard/quick-actions';
import { SystemStatus } from '../../components/dashboard/system-status';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch, error } = useDashboardSummary();
  const moduleSummary = data?.moduleSummary;

  return (
    <DashboardLayout title="Dashboard">
      <div className="px-4 py-6 sm:px-0">
        {isError && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex items-start">
              <p className="text-sm text-red-700">
                {error instanceof Error ? error.message : 'Unable to load dashboard data.'}
              </p>
              <button
                onClick={() => refetch()}
                className="ml-auto text-sm font-medium text-red-700 hover:text-red-900"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Welcome Section */}
        <div className="bg-white overflow-hidden shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">
              Welcome back, {user?.firstName || user?.email}!
            </h2>
            <p className="text-gray-600">
              Here's what's happening with your business today.
            </p>
          </div>
        </div>

        <StatsGrid stats={data?.stats} isLoading={isLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentActivity activity={data?.recentActivity} isLoading={isLoading} />
          <QuickActions actions={data?.quickActions} isLoading={isLoading} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6">
          <SystemStatus services={data?.systemStatus} isLoading={isLoading} />

          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Module Summary</h3>
              {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="p-4 border border-gray-100 rounded-lg">
                      <div className="h-3 w-20 bg-gray-200 rounded mb-2" />
                      <div className="h-5 w-12 bg-gray-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : moduleSummary ? (
                <div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {[
                      { label: 'Total Modules', value: moduleSummary.totalModules },
                      { label: 'Enabled Modules', value: moduleSummary.enabledModules },
                      { label: 'Core Modules', value: moduleSummary.coreModules },
                      { label: 'Business Modules', value: moduleSummary.businessModules },
                    ].map((item) => (
                      <div key={item.label} className="p-4 border border-gray-100 rounded-lg">
                        <p className="text-sm text-gray-500">{item.label}</p>
                        <p className="text-2xl font-semibold text-gray-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">Modules by Pricing Model</h4>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(moduleSummary.modulesByPricing).map(([model, count]) => (
                        <span
                          key={model}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800"
                        >
                          {model}: {typeof count === 'number' ? count : String(count)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No module insights available yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}