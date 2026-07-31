'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Users, Loader2, AlertCircle, Filter, ChevronDown } from 'lucide-react';
import { TaskService, TaskResponse } from '../services/taskService';
import { ProjectService } from '../services/projectService';
import { TaskAssignmentModal } from '../components/TaskAssignmentModal';
import { CreateTaskWithAssignmentModal } from '../components/CreateTaskWithAssignmentModal';

interface ProjectOption {
  id: string;
  name: string;
}

interface TaskRow extends TaskResponse {
  projectName?: string;
}

export default function TaskManagerPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');

  // Filters
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    const slug = window.location.pathname.split('/')[2];
    setTenantSlug(decodeURIComponent(slug));
  }, []);

  useEffect(() => {
    if (!tenantSlug) return;
    loadData();
  }, [tenantSlug]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        fetch(`/api/projects/tasks?tenantSlug=${encodeURIComponent(tenantSlug)}`, { cache: 'no-store' }),
        fetch(`/api/projects?tenantSlug=${encodeURIComponent(tenantSlug)}`, { cache: 'no-store' }),
      ]);

      if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
      const tasksData = await tasksRes.json();
      const projectsData = projectsRes.ok ? await projectsRes.json() : { projects: [] };

      const projectMap = new Map<string, string>();
      (projectsData.projects || []).forEach((p: any) => projectMap.set(p.id, p.name));

      const enrichedTasks: TaskRow[] = (tasksData.tasks || []).map((t: any) => ({
        ...t,
        projectName: projectMap.get(t.projectId) || 'Unknown Project',
      }));

      setTasks(enrichedTasks);
      setProjects((projectsData.projects || []).map((p: any) => ({ id: p.id, name: p.name })));
    } catch (err: any) {
      console.error('Failed to load task data:', err);
      setError(err.message || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => (projectFilter ? t.projectId === projectFilter : true))
      .filter((t) => (statusFilter ? t.status === statusFilter : true))
      .filter((t) => (priorityFilter ? t.priority === priorityFilter : true))
      .filter((t) =>
        searchQuery
          ? t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.assignedEmployees || []).some((a) =>
              a.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
          : true
      );
  }, [tasks, projectFilter, statusFilter, priorityFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const unassigned = tasks.filter((t) => !t.assignedEmployees || t.assignedEmployees.length === 0).length;
    const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
    const completed = tasks.filter((t) => t.status === 'Done').length;
    const overdue = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'Done'
    ).length;
    return { total, unassigned, inProgress, completed, overdue };
  }, [tasks]);

  const openAssignModal = (task: TaskResponse) => {
    setSelectedTask(task);
    setShowAssignModal(true);
  };

  if (!tenantSlug) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Task Manager</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage and assign tasks across all projects. HODs are automatically notified when their department members are assigned.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600">Total Tasks</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600">Unassigned</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.unassigned}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.inProgress}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.completed}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-600">Overdue</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.overdue}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="Todo">Todo</option>
                <option value="In Progress">In Progress</option>
                <option value="Review">Review</option>
                <option value="Done">Done</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Task or assignee..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Task table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">No tasks found. Create one to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Task</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Project</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Priority</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Assignees</th>
                    <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Due Date</th>
                    <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTasks.map((task) => {
                    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Done';
                    return (
                      <tr key={task.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">{task.projectName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            task.priority === 'High' ? 'bg-red-100 text-red-800' :
                            task.priority === 'Medium' ? 'bg-amber-100 text-amber-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            task.status === 'Done' ? 'bg-green-100 text-green-800' :
                            task.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                            task.status === 'Review' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {task.assignedEmployees && task.assignedEmployees.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {task.assignedEmployees.slice(0, 2).map((a) => (
                                <span key={a.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                                  {a.name}
                                </span>
                              ))}
                              {task.assignedEmployees.length > 2 && (
                                <span className="text-xs text-gray-500 self-center">
                                  +{task.assignedEmployees.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {task.dueDate ? (
                            <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                              {new Date(task.dueDate).toLocaleDateString()}
                              {isOverdue && ' (Overdue)'}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openAssignModal(task)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                          >
                            <Users className="w-3.5 h-3.5" />
                            Assign
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
      </div>

      {/* Modals */}
      <CreateTaskWithAssignmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        tenantSlug={tenantSlug}
        onCreated={loadData}
      />

      {selectedTask && (
        <TaskAssignmentModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          projectId={selectedTask.projectId}
          tenantSlug={tenantSlug}
          task={selectedTask}
          onAssigned={loadData}
        />
      )}
    </>
  );
}
