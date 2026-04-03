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
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Persistent */}
      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Automation</h2>
          <p className="text-sm text-gray-600 mt-1">Manage workflows and rules</p>
        </div>
        <nav className="p-4 space-y-1">
          {automationTabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className="flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors group hover:bg-gray-100"
            >
              <div className="flex items-center gap-3">
                <tab.icon className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
                <span className="text-gray-700 group-hover:text-gray-900">{tab.name}</span>
              </div>
              {tab.count && (
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium group-hover:bg-gray-200">
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
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

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 sm:p-6 border border-green-200">
                  <div className="flex items-center gap-3 mb-4">
                    <PlayCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                    <h3 className="text-base sm:text-lg font-semibold text-green-900">Workflows</h3>
                  </div>
                  <p className="text-sm text-green-700 mb-4">Manage and monitor automated workflows and business processes</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">Active Workflows</span>
                      <span className="font-medium text-green-900">24</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">Running Now</span>
                      <span className="font-medium text-green-900">3</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600">Avg Execution Time</span>
                      <span className="font-medium text-green-900">2.4s</span>
                    </div>
                  </div>
                  <Link
                    href="/tenant-admin/automation/workflows"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700"
                  >
                    View Workflows →
                  </Link>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 sm:p-6 border border-blue-200">
                  <div className="flex items-center gap-3 mb-4">
                    <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                    <h3 className="text-base sm:text-lg font-semibold text-blue-900">Rules</h3>
                  </div>
                  <p className="text-sm text-blue-700 mb-4">Configure business rules and automation triggers</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-600">Active Rules</span>
                      <span className="font-medium text-blue-900">18</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-600">Triggers Today</span>
                      <span className="font-medium text-blue-900">342</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-600">Rule Success Rate</span>
                      <span className="font-medium text-blue-900">96.2%</span>
                    </div>
                  </div>
                  <Link
                    href="/tenant-admin/automation/rules"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    View Rules →
                  </Link>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 sm:p-6 border border-purple-200">
                  <div className="flex items-center gap-3 mb-4">
                    <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                    <h3 className="text-base sm:text-lg font-semibold text-purple-900">History</h3>
                  </div>
                  <p className="text-sm text-purple-700 mb-4">View execution history and performance analytics</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-600">Total Executions</span>
                      <span className="font-medium text-purple-900">1847</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-600">Successful</span>
                      <span className="font-medium text-purple-900">1749</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-600">Failed</span>
                      <span className="font-medium text-purple-900">98</span>
                    </div>
                  </div>
                  <Link
                    href="/tenant-admin/automation/history"
                    className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700"
                  >
                    View History →
                  </Link>
                </div>
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
    </div>
  );
}
