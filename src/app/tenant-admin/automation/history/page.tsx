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
    const matchesSearch = execution.name.toLowerCase().includes(searchTerm.toLowerCase());
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
      default: return 'bg-gray-100 text-gray-900';
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
    <>
      {/* Horizontal Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-theme-text-primary">History</h1>
              <p className="text-sm text-gray-600 mt-1">View execution history and performance analytics</p>
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
                  tab.id === 'history' 
                    ? 'border-blue-500 text-blue-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${tab.id === 'history' ? 'text-blue-600' : 'text-theme-text-tertiary'}`} />
                <span>{tab.name}</span>
                {tab.count && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    tab.id === 'history' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-900'
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
                  <p className="text-sm font-medium text-gray-600">Total Executions</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mt-2">{executions.length}</p>
                </div>
                <Clock className="w-8 h-8 sm:w-12 sm:h-12 text-blue-500" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Successful</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">{executions.filter(e => e.status === 'success').length}</p>
                </div>
                <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-green-500" />
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
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
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
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 capitalize">{execution.type}</span>
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
                        {execution.duration}
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
