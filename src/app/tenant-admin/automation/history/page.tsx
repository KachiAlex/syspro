'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Clock, Search, Filter, Download, Eye, CheckCircle, AlertCircle, XCircle, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface Execution {
  id: string;
  name: string;
  type: 'workflow' | 'rule';
  status: 'success' | 'failed' | 'running';
  startTime: string;
  endTime: string;
  duration: string;
  triggeredBy: string;
  category: string;
  error?: string;
}

const executions: Execution[] = [
  {
    id: '1',
    name: 'Customer Onboarding',
    type: 'workflow',
    status: 'success',
    startTime: '2026-04-03 14:30:15',
    endTime: '2026-04-03 14:30:18',
    duration: '3.2s',
    triggeredBy: 'System',
    category: 'Customer Management'
  },
  {
    id: '2',
    name: 'Invoice Validation',
    type: 'rule',
    status: 'success',
    startTime: '2026-04-03 14:25:42',
    endTime: '2026-04-03 14:25:43',
    duration: '0.8s',
    triggeredBy: 'User',
    category: 'Finance'
  },
  {
    id: '3',
    name: 'Daily Report Generation',
    type: 'workflow',
    status: 'failed',
    startTime: '2026-04-03 14:00:00',
    endTime: '2026-04-03 14:00:12',
    duration: '12.4s',
    triggeredBy: 'System',
    category: 'Reporting',
    error: 'Database connection timeout'
  },
  {
    id: '4',
    name: 'Email Notification Trigger',
    type: 'rule',
    status: 'success',
    startTime: '2026-04-03 13:45:30',
    endTime: '2026-04-03 13:45:31',
    duration: '1.1s',
    triggeredBy: 'System',
    category: 'Notifications'
  },
  {
    id: '5',
    name: 'Inventory Sync',
    type: 'workflow',
    status: 'running',
    startTime: '2026-04-03 13:30:00',
    endTime: '-',
    duration: 'Running...',
    triggeredBy: 'System',
    category: 'Inventory'
  },
  {
    id: '6',
    name: 'Lead Assignment',
    type: 'rule',
    status: 'success',
    startTime: '2026-04-03 13:15:22',
    endTime: '2026-04-03 13:15:23',
    duration: '0.9s',
    triggeredBy: 'User',
    category: 'Sales'
  },
  {
    id: '7',
    name: 'Expense Approval',
    type: 'rule',
    status: 'failed',
    startTime: '2026-04-03 13:00:15',
    endTime: '2026-04-03 13:00:18',
    duration: '3.1s',
    triggeredBy: 'User',
    category: 'Finance',
    error: 'Insufficient permissions'
  },
  {
    id: '8',
    name: 'Customer Welcome Email',
    type: 'rule',
    status: 'success',
    startTime: '2026-04-03 12:45:10',
    endTime: '2026-04-03 12:45:12',
    duration: '2.0s',
    triggeredBy: 'System',
    category: 'Customer Service'
  }
];

export default function AutomationHistoryPage() {
  const { tenantSlug } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateRange, setDateRange] = useState('today');

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
      case 'running': return <Clock className="w-4 h-4 text-blue-600" />;
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">History</h2>
        <Link
          href="/tenant-admin/automation"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Executions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{executions.length}</p>
              <p className="text-xs text-blue-600 mt-2">↑ 15.2% from yesterday</p>
            </div>
            <Clock className="w-12 h-12 text-blue-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Successful</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{executions.filter(e => e.status === 'success').length}</p>
              <p className="text-xs text-green-600 mt-2">94.7% success rate</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{executions.filter(e => e.status === 'failed').length}</p>
              <p className="text-xs text-red-600 mt-2">5.3% failure rate</p>
            </div>
            <XCircle className="w-12 h-12 text-red-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Running</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{executions.filter(e => e.status === 'running').length}</p>
              <p className="text-xs text-blue-600 mt-2">Currently active</p>
            </div>
            <Clock className="w-12 h-12 text-blue-100" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Execution</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Triggered By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExecutions.map((execution) => (
                <tr key={execution.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900 capitalize">{execution.type}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">{execution.category}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(execution.status)}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                        {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.startTime}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.endTime}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.duration}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.triggeredBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                        <Eye className="w-3 h-3" />
                        View
                      </button>
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700">
                        <Download className="w-3 h-3" />
                        Log
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
        <div className="bg-white rounded-lg border border-gray-200 p-6">
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

        <div className="bg-white rounded-lg border border-gray-200 p-6">
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
  );
}
