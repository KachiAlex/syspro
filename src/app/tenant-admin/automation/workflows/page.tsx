'use client';

import React, { useEffect, useState } from 'react';
import { useCallback } from "react";
import Link from 'next/link';
import { PlayCircle, Play, Pause, Square, Edit, Trash2, Plus, Search, Filter, Clock, CheckCircle, AlertCircle, Settings, Zap, X } from 'lucide-react';
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

import { AutomationService } from '@/app/tenant-admin/services/automation-service';

export default function AutomationWorkflowsPage() {
  const { tenantSlug } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', type: 'custom', status: 'active' });

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const data = await AutomationService.getWorkflows(tenantSlug);
      setWorkflows((data.workflows || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        description: w.description || '',
        status: w.isActive ? 'active' : w.isActive === false ? 'stopped' : 'paused',
        lastRun: w.updatedAt ? new Date(w.updatedAt).toLocaleString() : '—',
        nextRun: '—',
        executions: 0,
        successRate: 0,
        avgDuration: '—',
        category: w.type || 'custom',
      })));
    } catch (err) {
      console.error('Failed to load workflows', err);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    load();
  }, [load]);

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
      default: return 'bg-theme-muted text-theme-text-primary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <PlayCircle className="w-4 h-4 text-green-600" />;
      case 'paused': return <Pause className="w-4 h-4 text-amber-600" />;
      case 'stopped': return <Square className="w-4 h-4 text-red-600" />;
      default: return <Clock className="w-4 h-4 text-theme-text-secondary" />;
    }
  };

  async function handleCreateWorkflow(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      setCreateError('Workflow name is required');
      return;
    }
    if (!tenantSlug) return;
    setCreateLoading(true);
    setCreateError(null);
    try {
      await AutomationService.createWorkflow(tenantSlug, {
        name: formData.name.trim(),
        description: formData.description,
        type: formData.type,
        isActive: formData.status === 'active',
        steps: [{ id: '1', name: 'Start', order: 1, triggerType: 'manual', actions: [] }],
      });
      setShowCreate(false);
      setFormData({ name: '', description: '', type: 'custom', status: 'active' });
      await load();
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create workflow');
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <>
      {/* Horizontal Navigation Tabs */}
      <div className="bg-theme-surface border-b border-theme-border">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-2xl font-bold text-theme-text-primary">Workflows</h1>
              <p className="text-sm text-theme-text-secondary mt-1">Manage and monitor automated workflows</p>
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
                  tab.id === 'workflows' 
                    ? 'border-theme-accent text-theme-accent' 
                    : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary hover:border-theme-border'
                }`}
              >
                <tab.icon className={`w-4 h-4 ${tab.id === 'workflows' ? 'text-theme-accent' : 'text-theme-text-tertiary'}`} />
                <span>{tab.name}</span>
                {tab.count && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    tab.id === 'workflows' ? 'bg-blue-100 text-blue-700' : 'bg-theme-muted text-theme-text-primary'
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
                  className="w-full pl-10 pr-4 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
                />
              </div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="stopped">Stopped</option>
              </select>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              >
                <option value="all">All Categories</option>
                <option value="Customer Management">Customer Management</option>
                <option value="Finance">Finance</option>
                <option value="Reporting">Reporting</option>
                <option value="Inventory">Inventory</option>
                <option value="Marketing">Marketing</option>
              </select>
            </div>
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover">
              <Plus className="w-4 h-4" />
              Create Workflow
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-theme-surface rounded-lg border border-theme-border p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Total Workflows</p>
                  <p className="text-2xl sm:text-3xl font-bold text-theme-text-primary mt-2">{workflows.length}</p>
                </div>
                <PlayCircle className="w-8 h-8 sm:w-12 sm:h-12 text-theme-accent" />
              </div>
            </div>
            <div className="bg-theme-surface rounded-lg border border-theme-border p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Active</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 mt-2">{workflows.filter(w => w.status === 'active').length}</p>
                </div>
                <CheckCircle className="w-8 h-8 sm:w-12 sm:h-12 text-green-500" />
              </div>
            </div>
            <div className="bg-theme-surface rounded-lg border border-theme-border p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Paused</p>
                  <p className="text-2xl sm:text-3xl font-bold text-theme-accent mt-2">{workflows.reduce((sum, w) => sum + w.executions, 0)}</p>
                </div>
                <Zap className="w-8 h-8 sm:w-12 sm:h-12 text-theme-accent" />
              </div>
            </div>
            <div className="bg-theme-surface rounded-lg border border-theme-border p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Stopped</p>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600 mt-2">
                    {(workflows.reduce((sum, w) => sum + w.successRate, 0) / workflows.length).toFixed(1)}%
                  </p>
                </div>
                <Square className="w-12 h-12 text-red-500" />
              </div>
            </div>
          </div>

          <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-theme-muted border-b border-theme-border">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Workflow</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Category</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Last Run</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Next Run</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Executions</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Success Rate</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Avg Duration</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredWorkflows.map((workflow) => (
                    <tr key={workflow.id} className="hover:bg-theme-muted">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-theme-text-primary">{workflow.name}</p>
                          <p className="text-xs text-theme-text-secondary">{workflow.description}</p>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-theme-text-primary">{workflow.category}</span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(workflow.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}>
                            {workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-theme-text-primary">
                        {workflow.lastRun}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-theme-text-primary">
                        {workflow.nextRun}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-theme-text-primary">
                        {workflow.executions.toLocaleString()}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-theme-text-primary">{workflow.successRate}%</span>
                          <div className="w-12 sm:w-16 bg-theme-muted rounded-full h-2">
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
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-theme-text-primary">
                        {workflow.avgDuration}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover">
                            <Play className="w-3 h-3" />
                            <span className="hidden sm:inline">Run</span>
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary">
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
            <div className="bg-theme-surface rounded-lg border border-theme-border p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Workflow Performance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-theme-text-secondary">Total Executions</span>
                  <span className="text-sm font-semibold text-theme-accent">{workflows.reduce((sum, w) => sum + w.executions, 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-theme-text-secondary">Successful Executions</span>
                  <span className="text-sm font-semibold text-green-600">{Math.round(workflows.reduce((sum, w) => sum + w.executions * (w.successRate / 100), 0)).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-theme-text-secondary">Failed Executions</span>
                  <span className="text-sm font-semibold text-red-600">{Math.round(workflows.reduce((sum, w) => sum + w.executions * ((100 - w.successRate) / 100), 0)).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-theme-text-secondary">Average Success Rate</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {(workflows.reduce((sum, w) => sum + w.successRate, 0) / workflows.length).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-theme-surface rounded-lg border border-theme-border p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <button onClick={() => setShowCreate(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover">
                  <Plus className="w-4 h-4" />
                  Create New Workflow
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted">
                  <PlayCircle className="w-4 h-4" />
                  Run All Workflows
                </button>
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-surface border border-theme-border rounded-lg hover:bg-theme-muted">
                  <Filter className="w-4 h-4" />
                  Bulk Actions
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="w-full max-w-md rounded-xl bg-theme-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-theme-text-primary">Create Workflow</h2>
              <button onClick={() => setShowCreate(false)} className="text-theme-text-tertiary hover:text-theme-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            {createError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{createError}</div>
            )}
            <form onSubmit={handleCreateWorkflow} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">Name</label>
                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary" placeholder="Workflow name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary" rows={3} />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">Type</label>
                <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary">
                  <option value="custom">Custom</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="transfer">Transfer</option>
                  <option value="promotion">Promotion</option>
                  <option value="exit">Exit</option>
                  <option value="approval">Approval</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary">
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-muted">Cancel</button>
                <button type="submit" disabled={createLoading} className="rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-white hover:bg-theme-accent-hover disabled:opacity-50">{createLoading ? 'Creating...' : 'Create Workflow'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
