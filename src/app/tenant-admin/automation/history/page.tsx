'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Clock, CheckCircle, XCircle, AlertCircle, PlayCircle, Settings, Download, Eye, TrendingDown } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface Execution {
  id: string;
  name: string;
  type: 'workflow' | 'rule';
  category: string;
  status: 'success' | 'failed' | 'running';
  startTime: string;
  endTime: string;
  duration: string;
  triggeredBy: string;
  error?: string;
}

const executions: Execution[] = [
  {
    id: '1',
    name: 'Customer Onboarding Workflow',
    type: 'workflow',
    category: 'Customer Management',
    status: 'success',
    startTime: '2024-04-03 14:30:00',
    endTime: '2024-04-03 14:30:03',
    duration: '3.2s',
    triggeredBy: 'Schedule'
  },
  {
    id: '2',
    name: 'Invoice Processing Rule',
    type: 'rule',
    category: 'Finance',
    status: 'success',
    startTime: '2024-04-03 14:25:00',
    endTime: '2024-04-03 14:25:01',
    duration: '0.8s',
    triggeredBy: 'User Action'
  },
  {
    id: '3',
    name: 'Daily Report Generation',
    type: 'workflow',
    category: 'Reporting',
    status: 'failed',
    startTime: '2024-04-03 14:20:00',
    endTime: '2024-04-03 14:20:12',
    duration: '12.4s',
    triggeredBy: 'Schedule',
    error: 'Database connection timeout'
  },
  {
    id: '4',
    name: 'Email Notification Trigger',
    type: 'rule',
    category: 'Notifications',
    status: 'success',
    startTime: '2024-04-03 14:15:00',
    endTime: '2024-04-03 14:15:01',
    duration: '1.1s',
    triggeredBy: 'User Action'
  },
  {
    id: '5',
    name: 'Inventory Sync Workflow',
    type: 'workflow',
    category: 'Inventory',
    status: 'running',
    startTime: '2024-04-03 14:10:00',
    endTime: '-',
    duration: '-',
    triggeredBy: 'Schedule'
  },
  {
    id: '6',
    name: 'Customer Welcome Email',
    type: 'rule',
    category: 'Customer Service',
    status: 'success',
    startTime: '2024-04-03 14:05:00',
    endTime: '2024-04-03 14:05:01',
    duration: '0.5s',
    triggeredBy: 'User Action'
  },
  {
    id: '7',
    name: 'Sales Report Generation',
    type: 'workflow',
    category: 'Sales',
    status: 'success',
    startTime: '2024-04-03 14:00:00',
    endTime: '2024-04-03 14:00:02',
    duration: '2.1s',
    triggeredBy: 'Schedule'
  },
  {
    id: '8',
    name: 'Low Stock Alert',
    type: 'rule',
    category: 'Inventory',
    status: 'failed',
    startTime: '2024-04-03 13:55:00',
    endTime: '2024-04-03 13:55:00',
    duration: '0.1s',
    triggeredBy: 'System Event',
    error: 'Invalid email configuration'
  }
];

export default function HistoryPage() {
  const { tenantSlug } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredExecutions = executions.filter(execution => {
    const matchesSearch = execution.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         execution.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || execution.status === selectedStatus;
    const matchesType = selectedType === 'all' || execution.type === selectedType;
    const matchesCategory = selectedCategory === 'all' || execution.category === selectedCategory;
    return matchesSearch && matchesStatus && matchesType && matchesCategory;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'running': return <Clock className="w-4 h-4 text-blue-600 animate-spin" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'workflow': return <div className="w-2 h-2 bg-purple-500 rounded-full" />;
      case 'rule': return <div className="w-2 h-2 bg-blue-500 rounded-full" />;
      default: return <div className="w-2 h-2 bg-gray-500 rounded-full" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - Persistent */}
      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Automation</h2>
          <p className="text-sm text-gray-600 mt-1">Manage workflows and rules</p>
        </div>
        <nav className="p-4 space-y-1">
          {[
            { id: 'workflows', name: 'Workflows', href: '/tenant-admin/automation/workflows', icon: PlayCircle, count: 24 },
            { id: 'rules', name: 'Rules', href: '/tenant-admin/automation/rules', icon: Settings, count: 18 },
            { id: 'history', name: 'History', href: '/tenant-admin/automation/history', icon: Clock, count: 156 }
          ].map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors group ${
                tab.id === 'history' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <tab.icon className={`w-4 h-4 ${tab.id === 'history' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span className={tab.id === 'history' ? 'text-blue-700' : 'text-gray-700 group-hover:text-gray-900'}>{tab.name}</span>
              </div>
              {tab.count && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  tab.id === 'history' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 group-hover:bg-gray-200'
                }`}>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">History</h1>
              <p className="text-sm text-gray-600 mt-1">View execution history and performance analytics</p>
            </div>
            <Link
              href="/tenant-admin/automation"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Back to Overview
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search executions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="running">Running</option>
              </select>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="workflow">Workflows</option>
                <option value="rule">Rules</option>
              </select>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="Customer Management">Customer Management</option>
                <option value="Finance">Finance</option>
                <option value="Reporting">Reporting</option>
                <option value="Inventory">Inventory</option>
                <option value="Sales">Sales</option>
                <option value="Notifications">Notifications</option>
                <option value="Customer Service">Customer Service</option>
              </select>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Executions</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">{executions.length}</p>
                  <p className="text-xs text-blue-600 mt-2">↑ 15.2% from yesterday</p>
                </div>
                <Clock className="w-8 h-8 sm:w-12 sm:h-12 text-blue-100" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Successful</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">{executions.filter(e => e.status === 'success').length}</p>
                  <p className="text-xs text-green-600 mt-2">94.7% success rate</p>
                </div>
                <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-green-100" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed</p>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600 mt-2">{executions.filter(e => e.status === 'failed').length}</p>
                  <p className="text-xs text-red-600 mt-2">5.3% failure rate</p>
                </div>
                <XCircle className="w-8 h-8 sm:w-12 sm:h-12 text-red-100" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Running</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">{executions.filter(e => e.status === 'running').length}</p>
                  <p className="text-xs text-blue-600 mt-2">Currently active</p>
                </div>
                <Clock className="w-8 h-8 sm:w-12 sm:h-12 text-blue-100" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Execution</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Triggered By</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredExecutions.map((execution) => (
                    <tr key={execution.id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(execution.type)}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{execution.name}</p>
                            {execution.error && (
                              <p className="text-xs text-red-600 mt-1">Error: {execution.error}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 capitalize">{execution.type}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{execution.category}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                            {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {execution.startTime}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {execution.endTime}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {execution.duration}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {execution.triggeredBy}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                            <Eye className="w-3 h-3" />
                            <span className="hidden sm:inline">View</span>
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700">
                            <Download className="w-3 h-3" />
                            <span className="hidden sm:inline">Log</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Execution Analytics</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Average Execution Time</span>
                  <span className="text-sm font-semibold text-gray-900">2.8s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Peak Hour</span>
                  <span className="text-sm font-semibold text-blue-600">2:00 PM - 3:00 PM</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Most Active Category</span>
                  <span className="text-sm font-semibold text-purple-600">Finance</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">System Health Score</span>
                  <span className="text-sm font-semibold text-green-600">94.7%</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Analysis</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database Errors</span>
                  <span className="text-sm font-semibold text-red-600">2</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Permission Errors</span>
                  <span className="text-sm font-semibold text-amber-600">1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Timeout Errors</span>
                  <span className="text-sm font-semibold text-red-600">1</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Error Rate Trend</span>
                  <div className="flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-green-600" />
                    <span className="text-sm font-semibold text-green-600">↓ 12.4%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
