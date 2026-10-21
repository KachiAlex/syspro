'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, CheckCircle, Archive, BarChart3, TrendingUp, ListChecks, Clock } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { ProjectService, ProjectResponse } from './services/projectService';

interface BillableRow {
  projectId: string;
  projectName: string;
  customerName: string | null;
  billingRate: number | null;
  totalHours: number;
  entries: number;
  periodStart: string;
  periodEnd: string;
}

export default function ProjectsPage() {
  const { tenantSlug } = useTenantContext();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [billable, setBillable] = useState<BillableRow[]>([]);
  const [billingBusy, setBillingBusy] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  const loadBillable = React.useCallback(() => {
    if (!tenantSlug) return;
    fetch(`/api/projects/timesheet-billing?tenantSlug=${encodeURIComponent(tenantSlug)}`, { cache: 'no-store' })
      .then((r) => r.json().catch(() => ({ projects: [] })))
      .then((d) => setBillable(d.projects ?? []))
      .catch((err) => console.error('Failed to load billable time:', err));
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenantSlug) return;
    ProjectService.getProjects(tenantSlug)
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
    loadBillable();
  }, [tenantSlug, loadBillable]);

  const generateInvoice = async (row: BillableRow) => {
    if (!tenantSlug) return;
    const rate = row.billingRate ?? Number(prompt(`Hourly billing rate for ${row.projectName}:`) || 0);
    if (!rate || rate <= 0) {
      setBillingError(`Set a billing rate for ${row.projectName} first.`);
      return;
    }
    setBillingBusy(row.projectId);
    setBillingError(null);
    try {
      const res = await fetch(`/api/projects/timesheet-billing?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invoice', projectId: row.projectId, rate, customerName: row.customerName ?? undefined }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Invoice generation failed');
      loadBillable();
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Invoice generation failed');
    } finally {
      setBillingBusy(null);
    }
  };

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'In Progress' || p.status === 'Initiated').length;
  const completedProjects = projects.filter(p => p.status === 'Completed' || p.status === 'Archived').length;
  const completionRate = totalProjects ? Math.round((completedProjects / totalProjects) * 100) : 0;
  const recentProjects = projects.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Projects Overview</h2>
        <Link
          href={`/tenant-admin/projects/active`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Briefcase className="w-4 h-4" />
          New Project
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalProjects}</p>
            </div>
            <Briefcase className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">All time</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{activeProjects}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">In progress</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">{completedProjects}</p>
            </div>
            <Archive className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Archived</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{completionRate}%</p>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-100" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Overall progress</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href={`/tenant-admin/projects/active`}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">Active Projects</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Manage and track ongoing projects</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-green-600">{activeProjects}</span>
            <span className="text-xs font-medium text-blue-600">View →</span>
          </div>
        </Link>

        <Link
          href={`/tenant-admin/projects/archive`}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <Archive className="w-6 h-6 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-900">Archive</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">View completed and archived projects</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-amber-600">{completedProjects}</span>
            <span className="text-xs font-medium text-blue-600">View →</span>
          </div>
        </Link>

        <Link
          href={`/tenant-admin/projects/reports`}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Project Reports</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Analytics and project performance insights</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-blue-600">{totalProjects}</span>
            <span className="text-xs font-medium text-blue-600">View →</span>
          </div>
        </Link>

        <Link
          href={`/tenant-admin/projects/tasks`}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-3">
            <ListChecks className="w-6 h-6 text-indigo-600" />
            <h3 className="text-lg font-semibold text-gray-900">Task Manager</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">Assign and manage tasks across all projects</p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-600">Open →</span>
          </div>
        </Link>
      </div>

      {billable.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-900">Timesheet Billing</h3>
          </div>
          {billingError && <p className="text-sm text-red-600 mb-3">{billingError}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2 pr-4">Project</th>
                  <th className="py-2 pr-4">Customer</th>
                  <th className="py-2 pr-4">Period</th>
                  <th className="py-2 pr-4 text-right">Hours</th>
                  <th className="py-2 pr-4 text-right">Rate</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {billable.map((row) => (
                  <tr key={row.projectId} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium text-gray-900">{row.projectName}</td>
                    <td className="py-3 pr-4 text-gray-600">{row.customerName ?? '—'}</td>
                    <td className="py-3 pr-4 text-gray-600">{row.periodStart} → {row.periodEnd}</td>
                    <td className="py-3 pr-4 text-right">{row.totalHours.toFixed(1)}</td>
                    <td className="py-3 pr-4 text-right">{row.billingRate ?? '—'}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => generateInvoice(row)}
                        disabled={billingBusy === row.projectId}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {billingBusy === row.projectId ? 'Generating…' : 'Generate Invoice'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Projects</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : recentProjects.length === 0 ? (
          <p className="text-sm text-gray-500">No projects yet.</p>
        ) : (
          <div className="space-y-3">
            {recentProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{project.name}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex-1 max-w-xs">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${project.progress}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-600">{project.progress}%</span>
                    <span className="text-xs font-medium text-gray-600">{project.teamMembers} team members</span>
                  </div>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-4">
                  {project.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
