'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useCallback } from "react";
import { X, Search, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { TaskService, Employee } from '../services/taskService';
import { ProjectService } from '../services/projectService';

interface CreateTaskWithAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantSlug: string;
  onCreated: () => void;
}

interface ProjectOption {
  id: string;
  name: string;
}

export const CreateTaskWithAssignmentModal: React.FC<CreateTaskWithAssignmentModalProps> = ({
  isOpen,
  onClose,
  tenantSlug,
  onCreated,
}) => {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');

  const [departmentFilter, setDepartmentFilter] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());



  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const [projs, depts, emps] = await Promise.all([
        ProjectService.getProjects(tenantSlug),
        TaskService.getDepartments(tenantSlug),
        TaskService.getEmployees(),
      ]);
      setProjects(projs.map((p) => ({ id: p.id, name: p.name })));
      setDepartments(depts);
      setEmployees(emps);
    } catch (err) {
      console.error('Failed to load options:', err);
      setError('Failed to load projects and employees. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (!isOpen) return;
    setProjectId('');
    setTitle('');
    setDescription('');
    setPriority('medium');
    setDueDate('');
    setEstimatedHours('');
    setDepartmentFilter('');
    setNameSearch('');
    setSelectedIds(new Set());
    setError('');
    loadOptions();
  }, [isOpen, loadOptions]);

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [departments]);

  const filteredEmployees = useMemo(() => {
    return employees
      .filter((e) => (departmentFilter ? e.departmentId === departmentFilter : true))
      .filter((e) =>
        nameSearch ? e.name.toLowerCase().includes(nameSearch.toLowerCase()) : true
      );
  }, [employees, departmentFilter, nameSearch]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !title.trim() || !dueDate || !estimatedHours) {
      setError('Project, title, due date, and estimated hours are required.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/projects/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          workstreamId: null,
          title,
          description,
          priority,
          dueDate,
          estimatedHours: Number(estimatedHours),
          assignedEmployees: Array.from(selectedIds),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create task');
      }
      onCreated();
      onClose();
    } catch (err: any) {
      console.error('Failed to create task:', err);
      setError(err.message || 'Failed to create task. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50">
      <div className="bg-theme-surface rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-theme-surface border-b border-theme-border p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-theme-text-primary">Create Task & Assign</h2>
          <button onClick={onClose} className="text-theme-text-secondary hover:text-theme-text-primary transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Project selection */}
          <div>
            <label className="block text-sm font-medium text-theme-text-primary mb-2">Project *</label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-theme-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading projects...
              </div>
            ) : (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary bg-theme-surface focus:outline-none focus:ring-2 focus:ring-theme-accent"
                required
              >
                <option value="">Select a project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Task details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Task Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary bg-theme-surface focus:outline-none focus:ring-2 focus:ring-theme-accent"
                placeholder="Enter task title"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary bg-theme-surface focus:outline-none focus:ring-2 focus:ring-theme-accent"
                placeholder="Task description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary bg-theme-surface focus:outline-none focus:ring-2 focus:ring-theme-accent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary bg-theme-surface focus:outline-none focus:ring-2 focus:ring-theme-accent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text-primary mb-2">Estimated Hours *</label>
              <input
                type="number"
                min="0"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary bg-theme-surface focus:outline-none focus:ring-2 focus:ring-theme-accent"
                placeholder="e.g. 20"
                required
              />
            </div>
          </div>

          {/* Employee assignment */}
          <div className="border-t border-theme-border pt-6">
            <h3 className="text-sm font-semibold text-theme-text-primary mb-3">
              Assign Employees — Any Department
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-theme-text-primary mb-1">Department</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary bg-theme-surface focus:outline-none focus:ring-2 focus:ring-theme-accent"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-theme-text-primary mb-1">Search by name</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-theme-text-tertiary" />
                  <input
                    type="text"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                    placeholder="Employee name..."
                    className="w-full pl-10 pr-3 py-2 border border-theme-border rounded-lg text-sm text-theme-text-primary bg-theme-surface focus:outline-none focus:ring-2 focus:ring-theme-accent"
                  />
                </div>
              </div>
            </div>

            <div className="border border-theme-border rounded-lg max-h-48 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-theme-text-tertiary" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-sm text-theme-text-secondary text-center py-6">No matching employees found</p>
              ) : (
                <div className="divide-y divide-theme-border">
                  {filteredEmployees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-theme-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelect(emp.id)}
                        className="w-4 h-4 text-theme-accent rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-theme-text-primary">{emp.name}</p>
                        <p className="text-xs text-theme-text-secondary">
                          {emp.jobTitle} · {departmentNameById.get(emp.departmentId) || 'No department'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedIds.size > 0 && (
              <p className="text-xs text-theme-accent mt-2">
                {selectedIds.size} employee(s) selected — HODs will be automatically notified.
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-theme-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-theme-border text-theme-text-primary rounded-lg hover:bg-theme-muted transition-colors disabled:opacity-50"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent-hover transition-colors disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {creating ? 'Creating...' : 'Create & Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
