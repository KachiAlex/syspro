'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Plus, Trash2, CheckCircle, Clock, AlertCircle, Target,
  Calendar, Filter, X, Zap, Play, RotateCcw
} from 'lucide-react';

interface EmployeeProfile {
  id: string; name: string; email: string; jobTitle: string; role: string;
  departmentId: string; employmentType: string; status: string;
  hireDate: string; salary: number; lastLogin: string;
}

interface Task {
  id: string;
  employee_id?: string;
  employee_name?: string;
  employee_job_title?: string;
  title: string;
  description: string;
  expected_outcome?: string;
  weight?: number;
  is_kpi?: boolean;
  frequency: string;
  due_date: string;
  status: string;
  assigned_by: string;
  created_at: string;
  completion_note?: string;
  completed_at?: string;
}

interface Colleague {
  id: string;
  name: string;
  job_title: string;
  role: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  overdue: 'bg-red-100 text-red-700 border-red-200',
};

const FREQ_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  'one-time': 'One-time',
};

export function TasksTab({ profile }: { profile: EmployeeProfile }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHOD, setIsHOD] = useState(false);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterKpi, setFilterKpi] = useState(false);

  const employeeRole = (profile.role || 'staff').toLowerCase();
  const canAssign = ['hod', 'head_of_department', 'hr', 'hr_admin', 'hr_manager'].includes(employeeRole);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/tasks');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTasks(data.tasks || []);
        setIsHOD(data.isHOD || false);
      } else {
        setError(data.error || 'Failed to load tasks');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadColleagues = useCallback(async () => {
    try {
      const res = await fetch('/api/hr/employees/portal/colleagues');
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setColleagues(data.colleagues || []);
      }
    } catch {}
  }, []);

  useEffect(() => { loadTasks(); if (canAssign) loadColleagues(); }, [loadTasks, loadColleagues, canAssign]);

  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  const handleStatusUpdate = async (taskId: string, status: string) => {
    if (status === 'completed') {
      setCompletingTaskId(taskId);
      setCompletionNote('');
      return;
    }
    try {
      const res = await fetch(`/api/hr/employees/portal/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
      }
    } catch {}
  };

  const handleCompleteWithNote = async () => {
    if (!completingTaskId) return;
    try {
      const res = await fetch(`/api/hr/employees/portal/tasks/${completingTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', completionNote: completionNote.trim() || undefined }),
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === completingTaskId ? { ...t, status: 'completed', completion_note: completionNote || undefined } : t));
        setCompletingTaskId(null);
        setCompletionNote('');
      }
    } catch {}
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      const res = await fetch(`/api/hr/employees/portal/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
      }
    } catch {}
  };

  const filtered = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterKpi && !t.is_kpi) return false;
    return true;
  });

  const kpiCount = tasks.filter(t => t.is_kpi).length;
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-theme-accent animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-theme-text-primary">Tasks & KPIs</h2>
          <p className="text-sm text-theme-text-secondary mt-0.5">
            {isHOD ? 'Manage tasks and KPIs for your department' : 'Your assigned tasks and KPI targets'}
          </p>
        </div>
        {canAssign && (
          <button
            onClick={() => setShowAssign(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-lg text-sm font-medium hover:bg-theme-accent-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Assign Task / KPI
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Tasks" value={tasks.length} icon={<Clock className="w-4 h-4" />} color="bg-theme-muted text-theme-text-primary" />
        <StatCard label="KPIs" value={kpiCount} icon={<Target className="w-4 h-4" />} color="bg-purple-100 text-purple-700" />
        <StatCard label="Pending" value={pendingCount} icon={<AlertCircle className="w-4 h-4" />} color="bg-amber-100 text-amber-700" />
        <StatCard label="Completed" value={completedCount} icon={<CheckCircle className="w-4 h-4" />} color="bg-green-100 text-green-700" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-theme-text-tertiary" />
        {['all', 'pending', 'in_progress', 'completed', 'overdue'].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
              filterStatus === s ? 'bg-theme-accent text-white' : 'bg-theme-muted text-theme-text-secondary hover:bg-theme-muted'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
            {s === 'completed' && completedCount > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                filterStatus === s ? 'bg-theme-surface/20 text-theme-text-primary' : 'bg-green-200 text-green-700'
              }`}>
                {completedCount}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setFilterKpi(!filterKpi)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterKpi ? 'bg-purple-600 text-white' : 'bg-theme-muted text-theme-text-secondary hover:bg-theme-muted'
          }`}
        >
          KPIs Only
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-theme-muted rounded-xl border border-theme-border">
          <Target className="w-10 h-10 text-theme-text-secondary mx-auto mb-3" />
          <p className="text-theme-text-secondary text-sm">No tasks found. {canAssign && 'Assign a task to get started.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isHOD={isHOD}
              canManage={canAssign}
              onStatusUpdate={handleStatusUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Assign Task Modal */}
      {showAssign && (
        <AssignTaskModal
          colleagues={colleagues}
          onClose={() => setShowAssign(false)}
          onAssigned={() => { setShowAssign(false); loadTasks(); }}
        />
      )}

      {/* Completion Note Modal */}
      {completingTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay p-4" onClick={() => { setCompletingTaskId(null); setCompletionNote(''); }}>
          <div className="bg-theme-surface rounded-2xl shadow-xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-theme-border">
              <h3 className="font-bold text-theme-text-primary">Complete Task</h3>
              <button onClick={() => { setCompletingTaskId(null); setCompletionNote(''); }} className="p-1.5 rounded-lg hover:bg-theme-muted"><X className="w-5 h-5 text-theme-text-secondary" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-theme-text-primary mb-1.5">
                  Completion Note <span className="text-theme-text-tertiary font-normal">(optional)</span>
                </label>
                <textarea
                  value={completionNote}
                  onChange={e => setCompletionNote(e.target.value)}
                  rows={4}
                  placeholder="Describe what was accomplished, any evidence, or outcomes achieved..."
                  className="w-full px-3 py-2 rounded-lg border border-theme-border text-sm focus:ring-2 focus:ring-theme-accent focus:border-transparent resize-none"
                />
                <p className="text-xs text-theme-text-tertiary mt-1">This note will be used in AI productivity appraisals</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-theme-border">
              <button onClick={() => { setCompletingTaskId(null); setCompletionNote(''); }} className="px-4 py-2 text-sm font-medium text-theme-text-secondary rounded-lg hover:bg-theme-muted">Cancel</button>
              <button
                onClick={handleCompleteWithNote}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-theme-surface rounded-xl border border-theme-border p-4">
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${color} mb-2`}>
        {icon} {label}
      </div>
      <p className="text-2xl font-bold text-theme-text-primary">{value}</p>
    </div>
  );
}

function TaskCard({
  task, isHOD, canManage, onStatusUpdate, onDelete
}: {
  task: Task; isHOD: boolean; canManage: boolean;
  onStatusUpdate: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-theme-surface rounded-xl border border-theme-border p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-theme-text-primary text-sm">{task.title}</h3>
            {task.is_kpi && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                <Target className="w-3 h-3" /> KPI
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[task.status] || ''}`}>
              {task.status?.replace('_', ' ')}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-theme-muted text-theme-text-secondary">
              {FREQ_LABELS[task.frequency] || task.frequency}
            </span>
            {task.weight && task.weight > 1 && (
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-theme-accent">
                <Zap className="w-3 h-3" /> Weight: {task.weight}
              </span>
            )}
          </div>

          {task.description && (
            <p className="text-sm text-theme-text-secondary mt-1">{task.description}</p>
          )}
          {task.expected_outcome && (
            <p className="text-xs text-theme-text-secondary mt-1.5">
              <span className="font-medium">Expected outcome:</span> {task.expected_outcome}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-xs text-theme-text-tertiary">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Due: {task.due_date}
            </span>
            <span>Assigned by: {task.assigned_by}</span>
            {isHOD && task.employee_name && (
              <span className="font-medium text-theme-text-secondary">{task.employee_name}</span>
            )}
          </div>

          {task.status === 'completed' && task.completion_note && (
            <div className="mt-2 rounded-lg bg-green-50 px-3 py-2">
              <p className="text-xs font-semibold text-green-700">Completion Note</p>
              <p className="text-xs text-green-600 mt-0.5">{task.completion_note}</p>
            </div>
          )}
        </div>

        {canManage && (
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded-lg text-theme-text-tertiary hover:bg-red-50 hover:text-red-600 transition-colors flex-shrink-0"
            title="Delete task"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Action buttons row */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-theme-border">
        {/* Staff action buttons */}
        {!canManage && task.status === 'pending' && (
          <button
            onClick={() => onStatusUpdate(task.id, 'in_progress')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-theme-accent text-white rounded-lg text-xs font-medium hover:bg-theme-accent-hover transition-colors"
          >
            <Play className="w-3.5 h-3.5" /> Start Task
          </button>
        )}
        {!canManage && task.status === 'in_progress' && (
          <button
            onClick={() => onStatusUpdate(task.id, 'completed')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Mark Resolved
          </button>
        )}
        {!canManage && task.status === 'overdue' && (
          <button
            onClick={() => onStatusUpdate(task.id, 'in_progress')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-theme-accent text-white rounded-lg text-xs font-medium hover:bg-theme-accent-hover transition-colors"
          >
            <Play className="w-3.5 h-3.5" /> Start Task
          </button>
        )}
        {!canManage && task.status === 'completed' && (
          <button
            onClick={() => onStatusUpdate(task.id, 'in_progress')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-theme-muted text-theme-text-secondary rounded-lg text-xs font-medium hover:bg-theme-muted transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reopen
          </button>
        )}

        {/* HOD status management buttons */}
        {canManage && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['pending', 'in_progress', 'completed', 'overdue'] as const).map(s => (
              <button
                key={s}
                onClick={() => onStatusUpdate(task.id, s)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                  task.status === s
                    ? 'bg-theme-accent text-white'
                    : 'bg-theme-muted text-theme-text-secondary hover:bg-theme-muted'
                }`}
              >
                {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AssignTaskModal({
  colleagues, onClose, onAssigned
}: {
  colleagues: Colleague[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [weight, setWeight] = useState(1);
  const [isKpi, setIsKpi] = useState(false);
  const [frequency, setFrequency] = useState('daily');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!employeeId || !title) {
      setError('Please select an employee and enter a title');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/hr/employees/portal/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId, title, description, expectedOutcome,
          weight, isKpi, frequency, dueDate,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onAssigned();
      } else {
        setError(data.error || 'Failed to assign task');
      }
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay p-4" onClick={onClose}>
      <div className="bg-theme-surface rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <h3 className="font-bold text-theme-text-primary">Assign Task / KPI</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-theme-muted"><X className="w-5 h-5 text-theme-text-secondary" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Employee select */}
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-1.5">Assign to *</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-theme-border text-sm focus:ring-2 focus:ring-theme-accent focus:border-transparent"
            >
              <option value="">Select department member...</option>
              {colleagues.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.job_title || c.role}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-1.5">Task Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., Prepare Q3 financial report"
              className="w-full px-3 py-2 rounded-lg border border-theme-border text-sm focus:ring-2 focus:ring-theme-accent focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Brief description of what needs to be done..."
              className="w-full px-3 py-2 rounded-lg border border-theme-border text-sm focus:ring-2 focus:ring-theme-accent focus:border-transparent resize-none"
            />
          </div>

          {/* Expected Outcome */}
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-1.5">Expected Outcome</label>
            <input
              type="text"
              value={expectedOutcome}
              onChange={e => setExpectedOutcome(e.target.value)}
              placeholder="e.g., Completed report with all sections filled"
              className="w-full px-3 py-2 rounded-lg border border-theme-border text-sm focus:ring-2 focus:ring-theme-accent focus:border-transparent"
            />
          </div>

          {/* Frequency + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-theme-text-primary mb-1.5">Frequency</label>
              <select
                value={frequency}
                onChange={e => setFrequency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-theme-border text-sm focus:ring-2 focus:ring-theme-accent focus:border-transparent"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="one-time">One-time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-theme-text-primary mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-theme-border text-sm focus:ring-2 focus:ring-theme-accent focus:border-transparent"
              />
            </div>
          </div>

          {/* KPI toggle + Weight */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isKpi}
                onChange={e => setIsKpi(e.target.checked)}
                className="w-4 h-4 rounded border-theme-border text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-theme-text-primary inline-flex items-center gap-1">
                <Target className="w-4 h-4 text-purple-600" /> Mark as KPI
              </span>
            </label>
            {isKpi && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-theme-text-primary">Weight:</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={weight}
                  onChange={e => setWeight(parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 rounded-lg border border-theme-border text-sm focus:ring-2 focus:ring-theme-accent focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-theme-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-theme-text-secondary rounded-lg hover:bg-theme-muted">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-lg text-sm font-medium hover:bg-theme-accent-hover disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Assign Task
          </button>
        </div>
      </div>
    </div>
  );
}
