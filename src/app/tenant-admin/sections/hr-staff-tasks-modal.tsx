'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Loader2, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { HRService } from './hr-service';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: string;
}

interface StaffTask {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'one-time';
  dueDate: string;
  status: string;
  assignedBy: string;
}

interface StaffTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  employees: Employee[];
  currentUserName: string;
  onUpdated?: () => void;
}

export const StaffTasksModal: React.FC<StaffTasksModalProps> = ({
  isOpen,
  onClose,
  tenantSlug,
  employees,
  currentUserName,
  onUpdated,
}) => {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newEmployeeId, setNewEmployeeId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'weekly' | 'one-time'>('daily');
  const [newDueDate, setNewDueDate] = useState(() => new Date().toISOString().split('T')[0]);

  const staff = useMemo(() => employees.filter((e) => e.role?.toLowerCase() !== 'hod'), [employees]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const fetched = await HRService.getStaffTasks(tenantSlug);
      setTasks(fetched || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadTasks();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, tenantSlug]);

  const handleCreate = async () => {
    if (!newEmployeeId || !newTitle.trim() || !newDueDate) {
      setError('Please select an employee, enter a title, and pick a due date.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await HRService.createStaffTask(tenantSlug, {
        employeeId: newEmployeeId,
        title: newTitle.trim(),
        description: newDescription.trim(),
        frequency: newFrequency,
        dueDate: newDueDate,
        assignedBy: currentUserName,
      });
      setSuccess('Task assigned successfully.');
      setNewTitle('');
      setNewDescription('');
      setNewFrequency('daily');
      setNewDueDate(new Date().toISOString().split('T')[0]);
      loadTasks();
      onUpdated?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to assign task.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await HRService.deleteStaffTask(tenantSlug, taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      onUpdated?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete task.');
    }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await HRService.updateStaffTask(tenantSlug, taskId, { status: status as any });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update status.');
    }
  };

  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-theme-bg w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-theme-border shadow-xl">
        <div className="flex items-center justify-between p-6 border-b border-theme-border">
          <div>
            <h3 className="text-lg font-semibold text-theme-text-primary">Assign Staff Tasks</h3>
            <p className="text-sm text-theme-text-secondary">HOD can assign daily, weekly, or one-time tasks.</p>
          </div>
          <button onClick={onClose} className="text-theme-text-tertiary hover:text-theme-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" /> {success}
            </div>
          )}

          <div className="bg-theme-muted rounded-lg border border-theme-border p-4 space-y-4">
            <h4 className="text-sm font-medium text-theme-text-primary">New Task</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-theme-text-primary mb-1">Assign To</label>
                <select
                  value={newEmployeeId}
                  onChange={(e) => setNewEmployeeId(e.target.value)}
                  className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select staff member</option>
                  {staff.map((e) => (
                    <option key={e.id} value={e.id}>{e.name} — {e.department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-theme-text-primary mb-1">Frequency</label>
                <select
                  value={newFrequency}
                  onChange={(e) => setNewFrequency(e.target.value as any)}
                  className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="one-time">One-time</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-theme-text-primary mb-1">Due Date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-theme-text-primary mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Task title"
                  className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-theme-text-primary mb-1">Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
                className="bg-theme-bg w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Assign Task
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-theme-text-primary mb-3">Assigned Tasks</h4>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-theme-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading tasks...
              </div>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-theme-text-secondary">No tasks assigned yet.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {tasks.map((task) => {
                  const emp = employeeMap.get(task.employeeId);
                  const statusColor =
                    task.status === 'completed'
                      ? 'text-green-400'
                      : task.status === 'overdue'
                      ? 'text-red-400'
                      : task.status === 'in_progress'
                      ? 'text-amber-400'
                      : 'text-theme-text-secondary';
                  return (
                    <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-theme-border bg-theme-muted">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-theme-text-primary truncate">{task.title}</span>
                          <span className={`text-xs font-medium ${statusColor}`}>{task.status.replace('-', ' ')}</span>
                        </div>
                        <div className="text-xs text-theme-text-secondary mt-1">
                          {emp?.name || 'Unknown'} • {task.frequency} • due {task.dueDate}
                        </div>
                        {task.description && (
                          <div className="text-xs text-theme-text-secondary mt-1">{task.description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {['pending', 'in_progress', 'completed', 'overdue'].map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(task.id, s)}
                              className={`text-xs px-2 py-1 rounded border border-theme-border ${
                                task.status === s ? 'bg-blue-600 text-white border-blue-600' : 'text-theme-text-secondary hover:text-theme-text-primary'
                              }`}
                            >
                              {s.replace('-', ' ')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffTasksModal;
