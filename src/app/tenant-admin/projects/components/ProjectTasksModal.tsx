'use client';

import React, { useEffect, useState } from 'react';
import { X, Plus, Users, Trash2, Loader2 } from 'lucide-react';
import { TaskService, TaskResponse, TaskFormData } from '../services/taskService';
import { TaskAssignmentModal } from './TaskAssignmentModal';

interface ProjectTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  tenantSlug: string;
}

const DEFAULT_FORM: TaskFormData = {
  title: '',
  description: '',
  priority: 'medium',
  dueDate: '',
};

export const ProjectTasksModal: React.FC<ProjectTasksModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  tenantSlug,
}) => {
  const [tasks, setTasks] = useState<TaskResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<TaskFormData>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTasks();
    }
  }, [isOpen, projectId]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await TaskService.getTasks(projectId);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
      setError('Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    setCreating(true);
    setError('');
    try {
      await TaskService.createTask(projectId, formData);
      setFormData(DEFAULT_FORM);
      setShowCreateForm(false);
      await loadTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Failed to create task. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await TaskService.deleteTask(projectId, taskId);
      await loadTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Failed to delete task.');
    }
  };

  const openAssignModal = (task: TaskResponse) => {
    setSelectedTask(task);
    setShowAssignModal(true);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
        <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Tasks</h2>
              <p className="text-sm text-gray-600 mt-1">{projectName}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateForm((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Task
              </button>
            </div>

            {showCreateForm && (
              <form onSubmit={handleCreateTask} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <input
                  type="text"
                  placeholder="Task title"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <textarea
                  placeholder="Description"
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData((p) => ({ ...p, priority: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData((p) => ({ ...p, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 text-sm border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Task'}
                  </button>
                </div>
              </form>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-10">No tasks yet. Create one to get started.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          task.priority === 'high' ? 'bg-red-100 text-red-800' :
                          task.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {task.priority}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {task.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {task.assignedEmployees.length > 0
                          ? `Assigned to: ${task.assignedEmployees.map((a) => a.name).join(', ')}`
                          : 'Unassigned'}
                        {task.dueDate ? ` · Due ${new Date(task.dueDate).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => openAssignModal(task)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Assign
                      </button>
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskAssignmentModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        projectId={projectId}
        tenantSlug={tenantSlug}
        task={selectedTask}
        onAssigned={loadTasks}
      />
    </>
  );
};
