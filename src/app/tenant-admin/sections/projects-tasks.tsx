'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Project {
  id: string;
  name: string;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  assignee: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}

interface ProjectsTasksProps {
  projects: Project[];
  tenantSlug: string;
}

export default function ProjectsTasks({ projects, tenantSlug }: ProjectsTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProjectId) {
      fetchTasks();
    }
  }, [selectedProjectId]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/projects/${selectedProjectId}/tasks`);
      setTasks(response.data?.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const response = await apiClient.post(`/api/projects/${selectedProjectId}/tasks`, {
        title: newTaskTitle,
        status: 'todo',
        tenantSlug,
      });
      setTasks([...tasks, response.data]);
      setNewTaskTitle('');
      setSuccess('Task created successfully!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Failed to create task');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      await apiClient.patch(`/api/projects/${selectedProjectId}/tasks/${taskId}`, {
        status: newStatus,
        tenantSlug,
      });
      setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
      setSuccess('Task updated successfully!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to update task:', err);
      setError('Failed to update task');
      setTimeout(() => setError(null), 3500);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await apiClient.delete(`/api/projects/${selectedProjectId}/tasks/${taskId}`);
      setTasks(tasks.filter(t => t.id !== taskId));
      setSuccess('Task deleted successfully!');
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task');
      setTimeout(() => setError(null), 3500);
    }
  };

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const doneTasks = tasks.filter(t => t.status === 'done');

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

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Add new task..."
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-black placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
        />
        <button
          onClick={handleAddTask}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading tasks...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* To Do Column */}
          <div className="rounded-lg border border-gray-200 bg-theme-muted p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Circle className="w-4 h-4 text-theme-text-tertiary" />
              To Do ({todoTasks.length})
            </h3>
            <div className="space-y-2">
              {todoTasks.map(task => (
                <div key={task.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-900 flex-1">{task.title}</p>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-red-600 hover:text-theme-danger transition"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')}
                    className="w-full text-left text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition"
                  >
                    Move to In Progress
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              In Progress ({inProgressTasks.length})
            </h3>
            <div className="space-y-2">
              {inProgressTasks.map(task => (
                <div key={task.id} className="rounded-lg border border-blue-200 bg-theme-muted p-3 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-900 flex-1">{task.title}</p>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-red-600 hover:text-theme-danger transition"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id, 'todo')}
                      className="flex-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-900 hover:bg-gray-200 transition"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id, 'done')}
                      className="flex-1 text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Done Column */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              Done ({doneTasks.length})
            </h3>
            <div className="space-y-2">
              {doneTasks.map(task => (
                <div key={task.id} className="rounded-lg border border-emerald-200 bg-theme-muted p-3 hover:shadow-md transition opacity-75">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-gray-900 line-through flex-1">{task.title}</p>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-red-600 hover:text-theme-danger transition"
                      title="Delete task"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')}
                    className="w-full text-left text-xs px-2 py-1 rounded bg-gray-100 text-gray-900 hover:bg-gray-200 transition"
                  >
                    Reopen
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
