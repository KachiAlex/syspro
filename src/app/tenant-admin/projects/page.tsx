'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, CheckCircle, Archive, BarChart3, TrendingUp } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { ProjectService, ProjectResponse } from './services/projectService';

export default function ProjectsPage() {
  const { tenantSlug } = useTenantContext();
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantSlug) return;
    ProjectService.getProjects(tenantSlug)
      .then(setProjects)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tenantSlug]);

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
              <p className="text-3xl font-bold text-green-600 mt-2">7</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">In progress</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">4</p>
            </div>
            <Archive className="w-12 h-12 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500 mt-4">Archived</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">65%</p>
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
            <span className="text-2xl font-bold text-green-600">7</span>
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
            <span className="text-2xl font-bold text-amber-600">4</span>
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
      </div>

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
