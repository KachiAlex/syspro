'use client';

import React, { useEffect, useState } from 'react';
import { useCallback } from "react";
import Link from 'next/link';
import { Search, Clock, CheckCircle, XCircle, AlertCircle, PlayCircle, Settings, Download, Eye, TrendingDown } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { AutomationService } from '@/app/tenant-admin/services/automation-service';

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

export default function HistoryPage() {
  const { tenantSlug } = useTenantContext();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('today');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await AutomationService.getAudits(tenantSlug || '', 50);
      setExecutions((data.audits || []).map((a: any) => ({
        id: a.id,
        name: a.triggerEvent?.type || 'Unknown',
        type: 'rule',
        category: 'Automation',
        status: a.matched ? 'success' : 'failed',
        startTime: a.createdAt ? new Date(a.createdAt).toLocaleString() : '-',
        endTime: a.createdAt ? new Date(a.createdAt).toLocaleString() : '-',
        duration: '-',
        triggeredBy: a.actor || 'system'
      })));
    } catch (err) {
      console.error('Failed to load automation history', err);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);
  useEffect(() => { if (tenantSlug) load(); }, [load, tenantSlug]);

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
      default: return 'bg-theme-muted text-theme-text-primary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'running': return <Clock className="w-4 h-4 text-theme-accent animate-spin" />;
      default: return <AlertCircle className="w-4 h-4 text-theme-text-secondary" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'workflow': return <div className="w-2 h-2 bg-purple-500 rounded-full" />;
      case 'rule': return <div className="w-2 h-2 bg-blue-500 rounded-full" />;
      default: return <div className="w-2 h-2 bg-theme-muted rounded-full" />;
    }
  };

  async function runTestEvent() {
    if (!tenantSlug) return;
    setPublishing(true);
    try {
      await AutomationService.publishEvent(tenantSlug, { type: 'test.sample', payload: { id: '1' } });
      await load();
    } catch (err) {
      console.error('Failed to publish test event', err);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      {/* Horizontal Navigation Tabs */}
      <div className="bg-theme-surface border-b border-theme-border">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-theme-text-primary">History</h1>
              <p className="text-sm text-theme-text-secondary mt-1">View execution history and performance analytics</p>
            </div>
            <Link
              href="/tenant-admin/automation"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted"
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
                    ? 'border-theme-accent text-theme-accent' 
                    : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary hover:border-theme-border'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${tab.id === 'history' ? 'text-theme-accent' : 'text-theme-text-tertiary'}`} />
                <span>{tab.name}</span>
                {tab.count && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    tab.id === 'history' ? 'bg-blue-100 text-blue-700' : 'bg-theme-muted text-theme-text-primary'
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
            <div className="bg-theme-surface rounded-lg border border-theme-border p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Total Executions</p>
                  <p className="text-2xl sm:text-3xl font-bold text-theme-text-primary mt-2">{executions.length}</p>
                </div>
                <Clock className="w-8 h-8 sm:w-12 sm:h-12 text-theme-accent" />
              </div>
            </div>
            <div className="bg-theme-surface rounded-lg border border-theme-border p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Successful</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">{executions.filter(e => e.status === 'success').length}</p>
                </div>
                <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-green-500" />
              </div>
            </div>
          </div>

          <div className="bg-theme-surface rounded-lg border border-theme-border p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-theme-text-primary">Populate history</p>
                <p className="text-sm text-theme-text-secondary">Emit a sample event to see how rules are matched and logged.</p>
              </div>
              <button
                onClick={runTestEvent}
                disabled={publishing}
                className="inline-flex items-center gap-2 rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-white hover:bg-theme-accent-hover disabled:opacity-50"
              >
                {publishing ? 'Emitting...' : 'Emit sample event'}
              </button>
            </div>
          </div>

          <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-theme-muted border-b border-theme-border">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Execution</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Type</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredExecutions.map((execution) => (
                    <tr key={execution.id} className="hover:bg-theme-muted">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(execution.type)}
                          <div>
                            <p className="text-sm font-medium text-theme-text-primary">{execution.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-theme-text-primary capitalize">{execution.type}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(execution.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(execution.status)}`}>
                            {execution.status.charAt(0).toUpperCase() + execution.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-theme-text-primary">
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
