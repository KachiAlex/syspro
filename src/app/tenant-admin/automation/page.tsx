'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Zap, PlayCircle, Settings, Clock, CheckCircle, AlertCircle, TrendingUp, Download, Filter } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface AutomationTab {
  id: string;
  name: string;
  href: string;
  icon: React.ElementType;
  count?: number;
}

const automationTabs: AutomationTab[] = [
  {
    id: 'workflows',
    name: 'Workflows',
    href: '/tenant-admin/automation/workflows',
    icon: PlayCircle,
    count: 24
  },
  {
    id: 'rules',
    name: 'Rules',
    href: '/tenant-admin/automation/rules',
    icon: Settings,
    count: 18
  },
  {
    id: 'history',
    name: 'History',
    href: '/tenant-admin/automation/history',
    icon: Clock,
    count: 156
  }
];

export default function AutomationPage() {
  const { tenantSlug } = useTenantContext();
  const [selectedPeriod, setSelectedPeriod] = useState('Last 24 Hours');

  return (
    <>
      {/* Horizontal Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Automation Overview</h1>
              <p className="text-sm text-gray-600 mt-1">Monitor and manage your automation workflows</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Last 24 Hours</option>
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>Last Quarter</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4" />
                Export Report
              </button>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="flex space-x-8 overflow-x-auto">
            {automationTabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab.id === 'overview' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${tab.id === 'overview' ? 'text-blue-600' : 'text-gray-400'}`} />
                <span>{tab.name}</span>
                {tab.count && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    tab.id === 'overview' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Workflows</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">24</p>
                  <p className="text-xs text-green-600 mt-2">↑ 8.3% from last period</p>
                </div>
                <PlayCircle className="w-8 h-8 sm:w-12 sm:h-12 text-green-100" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Executions</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">1847</p>
                  <p className="text-xs text-blue-600 mt-2">↑ 15.2% from last period</p>
                </div>
                <Zap className="w-8 h-8 sm:w-12 sm:h-12 text-blue-100" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600 mt-2">94.7%</p>
                  <p className="text-xs text-purple-600 mt-2">↑ 2.1% from last period</p>
                </div>
                <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-purple-100" />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed Executions</p>
                  <p className="text-2xl sm:text-3xl font-bold text-amber-600 mt-2">98</p>
                  <p className="text-xs text-amber-600 mt-2">↓ 12.4% from last period</p>
                </div>
                <AlertCircle className="w-8 h-8 sm:w-12 sm:h-12 text-amber-100" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {[
                    { name: 'Customer Onboarding Workflow', type: 'Workflow', time: '2 hours ago', status: 'Completed', duration: '3.2s' },
                    { name: 'Invoice Processing Rule', type: 'Rule', time: '3 hours ago', status: 'Completed', duration: '0.8s' },
                    { name: 'Daily Report Generation', type: 'Workflow', time: '5 hours ago', status: 'Failed', duration: '12.4s' },
                    { name: 'Email Notification Trigger', type: 'Rule', time: '6 hours ago', status: 'Completed', duration: '1.1s' },
                  ].map((activity, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 rounded-lg gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{activity.name}</p>
                        <p className="text-xs text-gray-600 mt-1">{activity.type} • {activity.time} • Duration: {activity.duration}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          activity.status === 'Completed' ? 'bg-green-100 text-green-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {activity.status}
                        </span>
                        <button className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Average Response Time</span>
                  <span className="text-sm font-semibold text-green-600">1.8s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Throughput (per hour)</span>
                  <span className="text-sm font-semibold text-blue-600">76.9</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Error Rate</span>
                  <span className="text-sm font-semibold text-amber-600">5.3%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">System Uptime</span>
                  <span className="text-sm font-semibold text-green-600">99.8%</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Usage</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">CPU Usage</span>
                  <span className="text-sm font-semibold text-blue-600">42.3%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Memory Usage</span>
                  <span className="text-sm font-semibold text-purple-600">67.8%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API Calls</span>
                  <span className="text-sm font-semibold text-green-600">12847</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Storage Used</span>
                  <span className="text-sm font-semibold text-amber-600">8.4 GB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
