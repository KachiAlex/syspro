'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, Trash2, Edit3, Users, UserCheck } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { HRService } from './hr-service';
import { DepartmentModal } from './recruitment-modals';
import type { DepartmentRecord } from '@/lib/hr/types';

interface DeptWithHead extends DepartmentRecord {
  headName: string | null;
  headEmail: string | null;
  employeeCount?: number;
}

export const DepartmentsDashboard: React.FC = () => {
  const { tenantSlug } = useTenantContext();
  const [departments, setDepartments] = useState<DeptWithHead[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedDept, setSelectedDept] = useState<DeptWithHead | null>(null);

  const loadData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [deptRes, userRes] = await Promise.all([
        HRService.listDepartmentsWithHeads(tenantSlug).catch(() => []),
        HRService.getTenantUsers(tenantSlug).catch(() => []),
      ]);
      setDepartments(deptRes);
      setUsers(userRes);
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (data: any) => {
    if (!tenantSlug) return;
    try {
      const created = await HRService.createDepartment(tenantSlug, data);
      setDepartments((prev) => [...prev, { ...created, headName: null, headEmail: null, employeeCount: 0 }]);
    } catch (err: any) {
      console.error('Create department failed:', err);
      const message = err?.response?.data?.error?.formErrors?.[0] || err?.message || 'Failed to create department';
      alert(message);
      throw err;
    }
  };

  const handleUpdateHead = async (deptId: string, managerId: string | null) => {
    if (!tenantSlug) return;
    try {
      const updated = await HRService.updateDepartmentHead(tenantSlug, deptId, managerId);
      const head = users.find((u) => u.id === managerId);
      setDepartments((prev) =>
        prev.map((d) =>
          d.id === deptId
            ? { ...d, managerId: updated.managerId, headName: head?.name || null, headEmail: head?.email || null }
            : d
        )
      );
    } catch (err: any) {
      console.error('Update head failed:', err);
      alert(err?.message || 'Failed to update department head');
    }
  };

  const handleDelete = async (id: string) => {
    if (!tenantSlug) return;
    if (!confirm('Delete this department?')) return;
    // Note: delete endpoint not implemented yet; just remove from UI for now
    setDepartments((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-theme-text-primary">Departments & Units</h2>
          <p className="text-theme-text-secondary mt-1">Manage organizational structure and department heads</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-theme-text-primary bg-theme-muted border border-theme-border rounded-lg hover:bg-theme-sidebar-hover disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => { setModalMode('create'); setSelectedDept(null); setShowModal(true); }}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> New Department
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-theme-text-secondary">Total Departments</p>
              <p className="text-2xl font-bold text-theme-text-primary mt-1">{departments.length}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-theme-text-secondary">With Assigned Head</p>
              <p className="text-2xl font-bold text-theme-text-primary mt-1">{departments.filter((d) => d.managerId).length}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-xl border border-theme-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-theme-text-secondary">Total Employees</p>
              <p className="text-2xl font-bold text-theme-text-primary mt-1">{departments.reduce((sum, d) => sum + (d.employeeCount || 0), 0)}</p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-theme-border">
        <table className="w-full text-sm">
          <thead className="bg-theme-muted">
            <tr>
              {['Name', 'Head', 'Budget', 'Cost Center', 'Employees', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-theme-text-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {departments.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-theme-text-tertiary">No departments found.</td></tr>
            )}
            {departments.map((d) => (
              <tr key={d.id} className="hover:bg-theme-sidebar-hover">
                <td className="px-4 py-3 text-theme-text-primary font-medium">{d.name}</td>
                <td className="px-4 py-3">
                  {d.managerId ? (
                    <div className="text-theme-text-secondary">
                      <span className="font-medium text-theme-text-primary">{d.headName || d.managerId}</span>
                      {d.headEmail && <span className="block text-xs">{d.headEmail}</span>}
                    </div>
                  ) : (
                    <select
                      value=""
                      onChange={(e) => handleUpdateHead(d.id, e.target.value || null)}
                      className="px-2 py-1 text-xs bg-theme-muted border border-theme-border rounded-md text-theme-text-primary"
                    >
                      <option value="">Assign head...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-4 py-3 text-theme-text-secondary">{d.budget ? `$${Number(d.budget).toLocaleString()}` : '—'}</td>
                <td className="px-4 py-3 text-theme-text-secondary">{d.costCenter || '—'}</td>
                <td className="px-4 py-3 text-theme-text-secondary">{d.employeeCount ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {d.managerId && (
                      <button
                        onClick={() => handleUpdateHead(d.id, null)}
                        className="p-1.5 rounded-md hover:bg-red-500/10 text-theme-text-tertiary hover:text-red-400"
                        title="Remove head"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => { setModalMode('edit'); setSelectedDept(d); setShowModal(true); }}
                      className="p-1.5 rounded-md hover:bg-blue-500/10 text-theme-text-tertiary hover:text-blue-400"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DepartmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreate}
        mode={modalMode}
        initialData={selectedDept || undefined}
        users={users}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
      />
    </div>
  );
};
