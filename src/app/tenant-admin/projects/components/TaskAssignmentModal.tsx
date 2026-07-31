'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { TaskService, Employee, TaskResponse } from '../services/taskService';

interface TaskAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  tenantSlug: string;
  task: TaskResponse | null;
  onAssigned: () => void;
}

// Employee picker + assignment manager. Admins may search and filter staff
// by department and/or name, but every employee across every department is
// selectable — there is no department-based restriction on who can be
// assigned to a task.
export const TaskAssignmentModal: React.FC<TaskAssignmentModalProps> = ({
  isOpen,
  onClose,
  projectId,
  tenantSlug,
  task,
  onAssigned,
}) => {
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !task) return;
    setSelectedIds(new Set());
    setNameSearch('');
    setDepartmentFilter('');
    setError('');
    loadData();
  }, [isOpen, task?.id]);

  const loadData = async () => {
    if (!task) return;
    setLoading(true);
    try {
      const [depts, emps, currentAssignments] = await Promise.all([
        TaskService.getDepartments(tenantSlug),
        TaskService.getEmployees(),
        TaskService.getAssignments(projectId, task.id),
      ]);
      setDepartments(depts);
      setEmployees(emps);
      setAssigned(currentAssignments);
    } catch (err) {
      console.error('Failed to load assignment data:', err);
      setError('Failed to load employees. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((d) => map.set(d.id, d.name));
    return map;
  }, [departments]);

  const assignedIds = useMemo(() => new Set(assigned.map((a) => a.id)), [assigned]);

  const filteredEmployees = useMemo(() => {
    return employees
      .filter((e) => !assignedIds.has(e.id))
      .filter((e) => (departmentFilter ? e.departmentId === departmentFilter : true))
      .filter((e) =>
        nameSearch ? e.name.toLowerCase().includes(nameSearch.toLowerCase()) : true
      );
  }, [employees, assignedIds, departmentFilter, nameSearch]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!task || selectedIds.size === 0) return;
    setAssigning(true);
    setError('');
    try {
      await TaskService.assignEmployees(projectId, task.id, Array.from(selectedIds));
      setSelectedIds(new Set());
      await loadData();
      onAssigned();
    } catch (err) {
      console.error('Failed to assign employees:', err);
      setError('Failed to assign selected employees. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (assignmentId: string) => {
    if (!task) return;
    try {
      await TaskService.removeAssignment(projectId, task.id, assignmentId);
      await loadData();
      onAssigned();
    } catch (err) {
      console.error('Failed to remove assignment:', err);
      setError('Failed to remove assignment. Please try again.');
    }
  };

  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Assign Task</h2>
            <p className="text-sm text-gray-600 mt-1">{task.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Currently assigned */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Currently Assigned ({assigned.length})
            </h3>
            {assigned.length === 0 ? (
              <p className="text-sm text-gray-500">No one is assigned to this task yet.</p>
            ) : (
              <div className="space-y-2">
                {assigned.map((a) => (
                  <div
                    key={a.assignmentId}
                    className="flex items-center justify-between px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{a.name}</p>
                      <p className="text-xs text-gray-600">{a.department || 'No department'}</p>
                    </div>
                    <button
                      onClick={() => handleRemove(a.assignmentId)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Remove assignment"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Assign Staff — Any Department
            </h3>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Search by name</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={nameSearch}
                    onChange={(e) => setNameSearch(e.target.value)}
                    placeholder="Employee name..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Employee list */}
            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No matching employees found</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredEmployees.map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelect(emp.id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-500">
                          {emp.jobTitle} · {departmentNameById.get(emp.departmentId) || 'No department'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <span className="text-sm text-gray-600 self-center">
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleAssign}
                disabled={selectedIds.size === 0 || assigning}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {assigning ? 'Assigning...' : 'Assign Selected'}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
