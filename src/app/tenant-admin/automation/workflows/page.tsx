'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PlayCircle, Play, Pause, Square, Edit, Trash2, Plus, Search, Filter, Clock, CheckCircle, AlertCircle, Settings, Zap } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'stopped';
  lastRun: string;
  nextRun: string;
  executions: number;
  successRate: number;
  avgDuration: string;
  category: string;
}

const workflows: Workflow[] = [
  {
    id: '1',
    name: 'Customer Onboarding',
    description: 'Automated customer registration and welcome process',
    status: 'active',
    lastRun: '2 hours ago',
    nextRun: 'In 1 hour',
    executions: 342,
    successRate: 98.2,
    avgDuration: '3.2s',
    category: 'Customer Management'
  },
  {
    id: '2',
    name: 'Invoice Processing',
    description: 'Process and validate incoming invoices',
    status: 'active',
    lastRun: '30 minutes ago',
    nextRun: 'In 30 minutes',
    executions: 1247,
    successRate: 96.8,
    avgDuration: '1.8s',
    category: 'Finance'
  },
  {
    id: '3',
    name: 'Daily Report Generation',
    description: 'Generate and distribute daily business reports',
    status: 'paused',
    lastRun: '5 hours ago',
    nextRun: 'Paused',
    executions: 89,
    successRate: 94.4,
    avgDuration: '12.4s',
    category: 'Reporting'
  },
  {
    id: '4',
    name: 'Inventory Sync',
    description: 'Synchronize inventory across all channels',
    status: 'active',
    lastRun: '15 minutes ago',
    nextRun: 'In 15 minutes',
    executions: 2156,
    successRate: 99.1,
    avgDuration: '2.1s',
    category: 'Inventory'
  },
  {
    id: '5',
    name: 'Email Campaign',
    description: 'Send automated marketing emails',
    status: 'stopped',
    lastRun: '2 days ago',
    nextRun: 'Stopped',
    executions: 45,
    successRate: 91.2,
    avgDuration: '4.7s',
    category: 'Marketing'
  }
];

export default function AutomationWorkflowsPage() {
  const { tenantSlug } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workflow.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || workflow.status === selectedStatus;
    const matchesCategory = selectedCategory === 'all' || workflow.category === selectedCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-amber-100 text-amber-800';
      case 'stopped': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-900';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <PlayCircle className="w-4 h-4 text-green-600" />;
      case 'paused': return <Pause className="w-4 h-4 text-amber-600" />;
      case 'stopped': return <Square className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <>
      {/* Horizontal Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-theme-text-primary">Workflows</h1>
              <p className="text-sm text-gray-600 mt-1">Manage and monitor automated workflows</p>
            </div>
            <Link
              href="/tenant-admin/automation"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Back to Overview
            </Link>
          </div>
          
          {/* Navigation Tabs */}
          <nav className="flex space-x-8 overflow-x-auto">
            {[
              { id: 'workflows', name: 'Workflows', href: '/tenant-admin/automation/workflows', icon: PlayCircle, count: 24 },
              { id: 'rules', name: 'Rules', href: '/tenant-admin/automation/rules', icon: Settings, count: 18 },
              { id: 'history', name: 'History', href: '/tenant-admin/automation/history', icon: Clock, count: 156 }
            ].map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`flex items-center gap-2 px-1 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab.id === 'workflows' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${tab.id === 'workflows' ? 'text-blue-600' : 'text-theme-text-tertiary'}`} />
                <span>{tab.name}</span>
                {tab.count && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    tab.id === 'workflows' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-900'
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

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-tertiary w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search workflows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="stopped">Stopped</option>
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
                <option value="Marketing">Marketing</option>
              </select>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Create Workflow
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Workflows</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">{workflows.length}</p>
                </div>
                <PlayCircle className="w-8 h-8 sm:w-12 sm:h-12 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">{workflows.filter(w => w.status === 'active').length}</p>
                </div>
                <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Paused</p>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">{workflows.reduce((sum, w) => sum + w.executions, 0)}</p>
                </div>
                <Zap className="w-8 h-8 sm:w-12 sm:h-12 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Stopped</p>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600 mt-2">
                    {(workflows.reduce((sum, w) => sum + w.successRate, 0) / workflows.length).toFixed(1)}%
                  </p>
                </div>
                <Square className="w-12 h-12 text-red-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Run</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Run</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Executions</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Duration</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredWorkflows.map((workflow) => (
                    <tr key={workflow.id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{workflow.name}</p>
                          <p className="text-xs text-gray-500">{workflow.description}</p>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{workflow.category}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(workflow.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}>
                            {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workflow.lastRun}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workflow.nextRun}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workflow.executions.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{workflow.successRate}%</span>
                          <div className="w-12 sm:w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                workflow.successRate >= 95 ? 'bg-green-500' :
                                workflow.successRate >= 85 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${workflow.successRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workflow.avgDuration}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-theme-accent-hover">
                            <Play className="w-3 h-3" />
                            <span className="hidden sm:inline">Run</span>
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700">
                            <Edit className="w-3 h-3" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-theme-danger">
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Delete</span>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Executions</span>
                  <span className="text-sm font-semibold text-blue-600">{workflows.reduce((sum, w) => sum + w.executions, 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Successful Executions</span>
                  <span className="text-sm font-semibold text-green-600">{Math.round(workflows.reduce((sum, w) => sum + w.executions * (w.successRate / 100), 0)).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Failed Executions</span>
                  <span className="text-sm font-semibold text-red-600">{Math.round(workflows.reduce((sum, w) => sum + w.executions * ((100 - w.successRate) / 100), 0)).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Average Success Rate</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {(workflows.reduce((sum, w) => sum + w.successRate, 0) / workflows.length).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                  <Plus className="w-4 h-4" />
                  Create New Workflow
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <PlayCircle className="w-4 h-4" />
                  Run All Workflows
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Filter className="w-4 h-4" />
                  Bulk Actions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
