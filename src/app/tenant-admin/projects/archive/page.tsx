'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RotateCcw, Eye, Trash2, Search } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface ArchivedProject {
  id: string;
  name: string;
  description: string;
  completionDate: string;
  duration: string;
  teamMembers: number;
  budget: string;
  manager: string;
  finalStatus: string;
}

const DEFAULT_ARCHIVED_PROJECTS: ArchivedProject[] = [
  {
    id: '1',
    name: 'Legacy System Migration',
    description: 'Migration from legacy system to modern platform',
    completionDate: '2025-12-15',
    duration: '8 months',
    teamMembers: 6,
    budget: '$85,000',
    manager: 'John Smith',
    finalStatus: 'Completed',
  },
  {
    id: '2',
    name: 'Security Audit Implementation',
    description: 'Security improvements and compliance audit',
    completionDate: '2025-11-20',
    duration: '3 months',
    teamMembers: 4,
    budget: '$32,000',
    manager: 'Sarah Johnson',
    finalStatus: 'Completed',
  },
  {
    id: '3',
    name: 'Infrastructure Upgrade',
    description: 'Cloud infrastructure migration and optimization',
    completionDate: '2025-10-10',
    duration: '5 months',
    teamMembers: 7,
    budget: '$95,000',
    manager: 'Mike Davis',
    finalStatus: 'Completed',
  },
  {
    id: '4',
    name: 'Documentation Project',
    description: 'Complete system documentation',
    completionDate: '2025-09-05',
    duration: '2 months',
    teamMembers: 3,
    budget: '$18,000',
    manager: 'Emily Chen',
    finalStatus: 'Completed',
  },
];

export default function ProjectArchivePage() {
  const { tenantSlug } = useTenantContext();
  const [projects, setProjects] = useState<ArchivedProject[]>(DEFAULT_ARCHIVED_PROJECTS);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProjects = projects.filter((project) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!project.name.toLowerCase().includes(query) && !project.manager.toLowerCase().includes(query)) return false;
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Project Archive</h2>
        <Link
          href={`/tenant-admin/projects`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back to Overview
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Project name or manager..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Project Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Manager</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Completed</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Duration</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Budget</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Team</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{project.name}</p>
                      <p className="text-xs text-gray-600 mt-1">{project.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.manager}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.completionDate}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.duration}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{project.budget}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{project.teamMembers}</td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:text-green-700">
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-600">
                  No archived projects found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Archive Summary</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Archived</span>
              <span className="font-semibold text-gray-900">{projects.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total Budget Spent</span>
              <span className="font-semibold text-gray-900">$230,000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg Team Size</span>
              <span className="font-semibold text-gray-900">5 members</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Success Rate</span>
              <span className="font-semibold text-green-600">100%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Completions</h3>
          <div className="space-y-3">
            {filteredProjects.slice(0, 3).map((project) => (
              <div key={project.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{project.name}</p>
                  <p className="text-xs text-gray-600">{project.completionDate}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Completed
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
