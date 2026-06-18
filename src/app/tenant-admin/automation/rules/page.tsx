'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Settings, PlayCircle, Clock, CheckCircle, AlertCircle, Pause, Edit, Trash2, Plus, Filter } from 'lucide-react';
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
    name: 'Invoice Auto-Approval',
    description: 'Automatically approve invoices under $1000',
    trigger: 'Invoice Created',
    action: 'Auto Approve',
    status: 'active',
    priority: 'high',
    lastTriggered: '5 minutes ago',
    triggersToday: 45,
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
  }
];

export default function RulesPage() {
  const { tenantSlug } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase());
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
      default: return 'bg-gray-100 text-gray-900';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-amber-100 text-amber-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-900';
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
    <>
      {/* Horizontal Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-[#F8FAFC]">Rules</h1>
              <p className="text-sm text-gray-600 mt-1">Configure business rules and automation triggers</p>
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
                  tab.id === 'rules' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${tab.id === 'rules' ? 'text-blue-600' : 'text-gray-400'}`} />
                <span>{tab.name}</span>
                {tab.count && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    tab.id === 'rules' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-900'
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
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rule</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Success Rate</th>
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
                        <div className="flex items-center gap-2">
                          {getStatusIcon(rule.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(rule.status)}`}>
                            {rule.status.charAt(0).toUpperCase() + rule.status.slice(1)}
                          </span>
                        </div>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
