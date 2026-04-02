'use client';

import React, { useState } from 'react';
import { Calendar, AlertCircle } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface ProjectsTimelineProps {
  projects: Project[];
  tenantSlug: string;
}

export default function ProjectsTimeline({ projects, tenantSlug }: ProjectsTimelineProps) {
  const [sortBy, setSortBy] = useState<'startDate' | 'endDate'>('startDate');

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getProgressPercentage = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    
    const totalDuration = end.getTime() - start.getTime();
    const elapsedDuration = today.getTime() - start.getTime();
    
    if (totalDuration <= 0) return 0;
    const percentage = Math.min((elapsedDuration / totalDuration) * 100, 100);
    return Math.max(percentage, 0);
  };

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'active': return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'completed': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case 'on hold': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'planned': return 'bg-slate-100 text-slate-800 border border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
  };

  const sortedProjects = [...projects].sort((a, b) => {
    if (sortBy === 'startDate') {
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    } else {
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'startDate' | 'endDate')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
          >
            <option value="startDate">Start Date</option>
            <option value="endDate">End Date</option>
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {sortedProjects.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects to display</h3>
            <p className="text-gray-600">Create a project to see the timeline</p>
          </div>
        ) : (
          sortedProjects.map(project => {
            const daysRemaining = getDaysRemaining(project.endDate);
            const progress = getProgressPercentage(project.startDate, project.endDate);
            
            return (
              <div key={project.id} className="rounded-lg border border-gray-200 bg-white p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{project.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(project.startDate).toLocaleDateString()}</span>
                      </div>
                      <span>→</span>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(project.endDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Timeline Progress</span>
                      <span className="text-sm font-semibold text-gray-900">{Math.round(progress)}%</span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {daysRemaining >= 0 ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                      <p className="text-sm font-medium text-emerald-800">
                        {daysRemaining === 0 ? 'Due today' : `${daysRemaining} days remaining`}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                      <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Overdue by {Math.abs(daysRemaining)} days
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Timeline Legend
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
          <div>
            <p className="font-medium mb-1">Timeline Progress</p>
            <p>Shows the percentage of time elapsed from project start to end date</p>
          </div>
          <div>
            <p className="font-medium mb-1">Days Remaining</p>
            <p>Displays the number of days until the project end date</p>
          </div>
        </div>
      </div>
    </div>
  );
}
