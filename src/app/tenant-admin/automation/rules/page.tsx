'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Settings, Plus, Search, Filter, Play, Pause, Edit, Trash2, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface Rule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  status: 'active' | 'paused' | 'disabled';
  priority: 'high' | 'medium' | 'low';
  lastTriggered: string;
  triggersToday: number;
  successRate: number;
  category: string;
}

const rules: Rule[] = [
  {
    id: '1',
    name: 'Invoice Validation',
    description: 'Validate incoming invoices against purchase orders',
    trigger: 'New Invoice Created',
    action: 'Validate and Route',
    status: 'active',
    priority: 'high',
    lastTriggered: '15 minutes ago',
    triggersToday: 47,
    successRate: 98.2,
    category: 'Finance'
  },
  {
    id: '2',
    name: 'Customer Welcome Email',
    description: 'Send welcome email to new customers',
    trigger: 'Customer Registered',
    action: 'Send Email',
    status: 'active',
    priority: 'medium',
    lastTriggered: '2 hours ago',
    triggersToday: 12,
    successRate: 99.1,
    category: 'Customer Service'
  },
  {
    id: '3',
    name: 'Low Stock Alert',
    description: 'Alert when inventory levels are low',
    trigger: 'Stock Level Changed',
    action: 'Send Notification',
    status: 'paused',
    priority: 'high',
    lastTriggered: '1 day ago',
    triggersToday: 0,
    successRate: 100.0,
    category: 'Inventory'
  },
  {
    id: '4',
    name: 'Lead Assignment',
    description: 'Assign leads to sales representatives',
    trigger: 'New Lead Created',
    action: 'Assign to Rep',
    status: 'active',
    priority: 'medium',
    lastTriggered: '30 minutes ago',
    triggersToday: 28,
    successRate: 96.4,
    category: 'Sales'
  },
  {
    id: '5',
    name: 'Expense Approval',
    description: 'Auto-approve expenses under $100',
    trigger: 'Expense Submitted',
    action: 'Auto Approve',
    status: 'disabled',
    priority: 'low',
    lastTriggered: '3 days ago',
    triggersToday: 0,
    successRate: 94.7,
    category: 'Finance'
  }
];

export default function RulesPage() {
  const { tenantSlug } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || rule.status === selectedStatus;
    const matchesPriority = selectedPriority === 'all' || rule.priority === selectedPriority;
    const matchesCategory = selectedCategory === 'all' || rule.category === selectedCategory;
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-amber-100 text-amber-800';
      case 'disabled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'paused': return <Pause className="w-4 h-4 text-amber-600" />;
      case 'disabled': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
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
                tab.id === 'rules' ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <tab.icon className={`w-4 h-4 ${tab.id === 'rules' ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span className={tab.id === 'rules' ? 'text-blue-700' : 'text-gray-700 group-hover:text-gray-900'}>{tab.name}</span>
              </div>
              {tab.count && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  tab.id === 'rules' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 group-hover:bg-gray-200'
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
              <h1 className="text-2xl font-bold text-gray-900">Rules</h1>
              <p className="text-sm text-gray-600 mt-1">Configure business rules and automation triggers</p>
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
                  placeholder="Search rules..."
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
                <option value="disabled">Disabled</option>
              </select>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="Finance">Finance</option>
                <option value="Customer Service">Customer Service</option>
                <option value="Inventory">Inventory</option>
                <option value="Sales">Sales</option>
              </select>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Create Rule
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Rules</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">{rules.length}</p>
            </div>
              <Settings className="w-8 h-8 sm:w-12 sm:h-12 text-blue-100" />
          </div>
        </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">{rules.filter(r => r.status === 'active').length}</p>
            </div>
              <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-green-100" />
          </div>
        </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Triggers Today</p>
              <p className="text-2xl sm:text-3xl font-bold text-blue-600 mt-2">{rules.reduce((sum, r) => sum + r.triggersToday, 0)}</p>
            </div>
              <Zap className="w-8 h-8 sm:w-12 sm:h-12 text-blue-100" />
          </div>
        </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Success Rate</p>
              <p className="text-2xl sm:text-3xl font-bold text-purple-600 mt-2">
                {(rules.reduce((sum, r) => sum + r.successRate, 0) / rules.length).toFixed(1)}%
              </p>
            </div>
              <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-purple-100" />
          </div>
        </div>
      </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trigger</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Triggered</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Triggers Today</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-gray-50">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{rule.name}</p>
                          <p className="text-xs text-gray-500">{rule.description}</p>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{rule.category}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(rule.priority)}`}>
                          {rule.priority.charAt(0).toUpperCase() + rule.priority.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(rule.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(rule.status)}`}>
                            {rule.status.charAt(0).toUpperCase() + rule.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {rule.trigger}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {rule.action}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {rule.lastTriggered}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {rule.triggersToday}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{rule.successRate}%</span>
                          <div className="w-12 sm:w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                rule.successRate >= 95 ? 'bg-green-500' :
                                rule.successRate >= 85 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${rule.successRate}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                            <Play className="w-3 h-3" />
                            <span className="hidden sm:inline">Test</span>
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700">
                            <Edit className="w-3 h-3" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700">
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rule Performance</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Triggers Today</span>
              <span className="text-sm font-semibold text-blue-600">{rules.reduce((sum, r) => sum + r.triggersToday, 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Successful Executions</span>
              <span className="text-sm font-semibold text-green-600">{Math.round(rules.reduce((sum, r) => sum + r.triggersToday * (r.successRate / 100), 0))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Failed Executions</span>
              <span className="text-sm font-semibold text-red-600">{Math.round(rules.reduce((sum, r) => sum + r.triggersToday * ((100 - r.successRate) / 100), 0))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Average Success Rate</span>
              <span className="text-sm font-semibold text-purple-600">
                {(rules.reduce((sum, r) => sum + r.successRate, 0) / rules.length).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Create New Rule
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Settings className="w-4 h-4" />
              Rule Settings
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter className="w-4 h-4" />
              Bulk Actions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
