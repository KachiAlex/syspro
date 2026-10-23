'use client';

import React, { useState, useEffect } from 'react';
import { useCallback } from "react";
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
  budgetApproved: number;
  budgetSpent: number;
}

interface BudgetAllocation {
  id: string;
  projectId: string;
  category: string;
  allocated: number;
  spent: number;
}

interface ProjectsBudgetProps {
  projects: Project[];
  tenantSlug: string;
}

export default function ProjectsBudget({ projects, tenantSlug }: ProjectsBudgetProps) {
  const [budgetAllocations, setBudgetAllocations] = useState<BudgetAllocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [newCategory, setNewCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);



  const fetchBudgetAllocations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/projects/${selectedProjectId}/budget`);
      setBudgetAllocations(response.data?.allocations || []);
    } catch (err) {
      console.error('Failed to fetch budget allocations:', err);
      setError('Failed to load budget data');
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      fetchBudgetAllocations();
    }
  }, [fetchBudgetAllocations, selectedProjectId]);

  const handleAddAllocation = async () => {
    if (!newCategory.trim() || !newAmount.trim()) return;
    try {
      const response = await apiClient.post(`/api/projects/${selectedProjectId}/budget`, {
        category: newCategory,
        allocated: parseFloat(newAmount),
        tenantSlug,
      });
      setBudgetAllocations([...budgetAllocations, response.data]);
      setNewCategory('');
      setNewAmount('');
      setSuccess('Budget allocation created successfully!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to create allocation:', err);
      setError('Failed to create allocation');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleDeleteAllocation = async (allocationId: string) => {
    if (!confirm('Delete this budget allocation?')) return;
    try {
      await apiClient.delete(`/api/projects/${selectedProjectId}/budget/${allocationId}`);
      setBudgetAllocations(budgetAllocations.filter(a => a.id !== allocationId));
      setSuccess('Budget allocation deleted successfully!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to delete allocation:', err);
      setError('Failed to delete allocation');
      setTimeout(() => setError(null), 3500);
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const totalAllocated = budgetAllocations.reduce((sum, a) => sum + a.allocated, 0);
  const totalSpent = budgetAllocations.reduce((sum, a) => sum + a.spent, 0);
  const budgetUtilization = selectedProject ? Math.round((selectedProject.budgetSpent / selectedProject.budgetApproved) * 100) : 0;

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 text-sm">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">{success}</div>}

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-theme-text-primary mb-2">Select Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary focus:border-theme-accent focus:outline-none focus:ring-2 focus:ring-theme-accent/20 transition"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {selectedProject && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-theme-accent mb-1">Total Budget</p>
                <p className="text-2xl font-bold text-theme-text-primary">${selectedProject.budgetApproved.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-theme-accent" />
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 mb-1">Spent</p>
                <p className="text-2xl font-bold text-theme-text-primary">${selectedProject.budgetSpent.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 mb-1">Remaining</p>
                <p className="text-2xl font-bold text-theme-text-primary">${(selectedProject.budgetApproved - selectedProject.budgetSpent).toFixed(2)}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-theme-border bg-theme-muted p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Budget Utilization</h3>
        {selectedProject && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-text-secondary">Overall Budget Usage</span>
              <span className="text-sm font-semibold text-theme-text-primary">{budgetUtilization}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-theme-muted overflow-hidden">
              <div
                className={`h-full transition-all ${
                  budgetUtilization > 90 ? 'bg-red-500' :
                  budgetUtilization > 70 ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(budgetUtilization, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-theme-border bg-theme-muted p-6">
        <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Add Budget Category</h3>
        <div className="flex gap-2 flex-col md:flex-row">
          <input
            type="text"
            placeholder="Category name..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="flex-1 rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary placeholder-theme-text-tertiary focus:border-theme-accent focus:outline-none focus:ring-2 focus:ring-theme-accent/20 transition"
          />
          <input
            type="number"
            placeholder="Amount..."
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="w-32 rounded-lg border border-theme-border bg-theme-surface px-3 py-2 text-theme-text-primary placeholder-theme-text-tertiary focus:border-theme-accent focus:outline-none focus:ring-2 focus:ring-theme-accent/20 transition"
          />
          <button
            onClick={handleAddAllocation}
            className="inline-flex items-center gap-2 rounded-lg bg-theme-accent px-4 py-2 text-sm font-semibold text-white hover:bg-theme-accent-hover transition-colors whitespace-nowrap"
          >
            Add Category
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-theme-text-secondary">Loading budget allocations...</div>
      ) : budgetAllocations.length === 0 ? (
        <div className="rounded-lg border border-theme-border bg-theme-muted p-12 text-center">
          <DollarSign className="w-12 h-12 text-theme-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-theme-text-primary mb-2">No budget categories yet</h3>
          <p className="text-theme-text-secondary">Add budget categories to track spending</p>
        </div>
      ) : (
        <div className="rounded-lg border border-theme-border bg-theme-muted overflow-hidden">
          <table className="w-full">
            <thead className="bg-theme-muted border-b border-theme-border">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Allocated</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Spent</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Remaining</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Usage</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-theme-text-primary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {budgetAllocations.map(allocation => {
                const usage = allocation.allocated > 0 ? Math.round((allocation.spent / allocation.allocated) * 100) : 0;
                return (
                  <tr key={allocation.id} className="hover:bg-theme-muted transition">
                    <td className="px-6 py-4 text-sm text-theme-text-primary font-medium">{allocation.category}</td>
                    <td className="px-6 py-4 text-sm text-theme-text-secondary">${allocation.allocated.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-theme-text-secondary">${allocation.spent.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-theme-text-secondary">${(allocation.allocated - allocation.spent).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-theme-muted overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              usage > 90 ? 'bg-red-500' :
                              usage > 70 ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(usage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-theme-text-primary">{usage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteAllocation(allocation.id)}
                        className="text-red-600 hover:text-theme-danger transition font-medium text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
