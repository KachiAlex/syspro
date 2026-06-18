'use client';

import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (selectedProjectId) {
      fetchBudgetAllocations();
    }
  }, [selectedProjectId]);

  const fetchBudgetAllocations = async () => {
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
  };

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
          <label className="block text-sm font-medium text-gray-900 mb-2">Select Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
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
                <p className="text-sm text-blue-600 mb-1">Total Budget</p>
                <p className="text-2xl font-bold text-gray-900">${selectedProject.budgetApproved.toFixed(2)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-600 mb-1">Spent</p>
                <p className="text-2xl font-bold text-gray-900">${selectedProject.budgetSpent.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-amber-600" />
            </div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-600 mb-1">Remaining</p>
                <p className="text-2xl font-bold text-gray-900">${(selectedProject.budgetApproved - selectedProject.budgetSpent).toFixed(2)}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-theme-muted p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Utilization</h3>
        {selectedProject && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Overall Budget Usage</span>
              <span className="text-sm font-semibold text-gray-900">{budgetUtilization}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
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

      <div className="rounded-lg border border-gray-200 bg-theme-muted p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Budget Category</h3>
        <div className="flex gap-2 flex-col md:flex-row">
          <input
            type="text"
            placeholder="Category name..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-black placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />
          <input
            type="number"
            placeholder="Amount..."
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-black placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          />
          <button
            onClick={handleAddAllocation}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            Add Category
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading budget allocations...</div>
      ) : budgetAllocations.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-theme-muted p-12 text-center">
          <DollarSign className="w-12 h-12 text-theme-text-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No budget categories yet</h3>
          <p className="text-gray-600">Add budget categories to track spending</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-theme-muted overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Allocated</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Spent</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Remaining</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Usage</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {budgetAllocations.map(allocation => {
                const usage = allocation.allocated > 0 ? Math.round((allocation.spent / allocation.allocated) * 100) : 0;
                return (
                  <tr key={allocation.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">{allocation.category}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">${allocation.allocated.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">${allocation.spent.toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">${(allocation.allocated - allocation.spent).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              usage > 90 ? 'bg-red-500' :
                              usage > 70 ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(usage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-gray-900">{usage}%</span>
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
