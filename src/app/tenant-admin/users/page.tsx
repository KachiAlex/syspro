'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Shield, UserCheck, UserX, CheckCircle, AlertCircle, Clock, X, Monitor, Loader2, ToggleLeft, ToggleRight, RotateCcw } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { apiClient } from '@/lib/api-client';

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  color: string;
}

const roles: Role[] = [
  {
    id: '1',
    name: 'System Administrator',
    description: 'Full system access and configuration',
    permissions: ['Full Access', 'User Management', 'System Settings', 'Branch Management'],
    userCount: 2,
    color: 'bg-red-500'
  },
  {
    id: '2',
    name: 'Branch Manager',
    description: 'Manage branch operations and staff',
    permissions: ['Branch Management', 'User Management', 'Reporting'],
    userCount: 5,
    color: 'bg-blue-500'
  },
  {
    id: '3',
    name: 'Sales Manager',
    description: 'Manage sales team and customer relationships',
    permissions: ['Sales Management', 'Reporting', 'Customer Management'],
    userCount: 3,
    color: 'bg-green-500'
  },
  {
    id: '4',
    name: 'Financial Analyst',
    description: 'Financial reporting and budget management',
    permissions: ['Financial Reporting', 'Budget Management'],
    userCount: 4,
    color: 'bg-purple-500'
  },
  {
    id: '5',
    name: 'HR Manager',
    description: 'Employee management and payroll',
    permissions: ['HR Management', 'Payroll', 'Employee Records'],
    userCount: 2,
    color: 'bg-amber-500'
  },
  {
    id: '6',
    name: 'Marketing Specialist',
    description: 'Marketing campaigns and content management',
    permissions: ['Content Management', 'Campaign Management'],
    userCount: 6,
    color: 'bg-pink-500'
  }
];

export default function UsersPage() {
  const { tenantSlug } = useTenantContext();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Users & Roles</h1>
          <p className="text-sm text-theme-text-secondary mt-1">Manage portal users and their tab access permissions</p>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-theme-border">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-theme-accent text-theme-accent'
              : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
          }`}
        >
          Portal Users
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-theme-accent text-theme-accent'
              : 'border-transparent text-theme-text-secondary hover:text-theme-text-primary'
          }`}
        >
          Roles ({roles.length})
        </button>
      </div>

      {activeTab === 'users' && (
        <PortalAccessPanel tenantSlug={tenantSlug} />
      )}

      {activeTab === 'roles' && (
        <>
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-tertiary w-4 h-4" />
              <input
                type="text"
                placeholder="Search roles..."
                className="w-full pl-10 pr-4 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white brand-gradient rounded-lg hover:opacity-90">
              <Plus className="w-4 h-4" />
              Create Role
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div key={role.id} className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${role.color} rounded-full flex items-center justify-center`}>
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-theme-text-primary">{role.name}</h3>
                      <span className="text-xs text-theme-text-secondary">{role.userCount} users</span>
                    </div>
                  </div>
                  <button className="text-theme-text-tertiary hover:text-theme-text-secondary">
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-theme-text-secondary mb-4">{role.description}</p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-theme-text-primary">Permissions:</p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((permission, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-theme-accent-subtle text-theme-accent"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-theme-border flex items-center justify-between">
                  <button className="text-sm text-theme-accent hover:text-theme-accent-hover font-medium">
                    Edit Role
                  </button>
                  <button className="text-sm text-red-600 hover:text-theme-danger font-medium">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-6">
            <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Role Permissions Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-theme-muted border-b border-theme-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Permission</th>
                    {roles.map(role => (
                      <th key={role.id} className="px-4 py-3 text-center text-xs font-medium text-theme-text-secondary uppercase tracking-wider">
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {['Full Access', 'User Management', 'System Settings', 'Branch Management', 'Reporting', 'Financial Reporting', 'HR Management', 'Sales Management'].map(permission => (
                    <tr key={permission}>
                      <td className="px-4 py-3 text-sm text-theme-text-primary">{permission}</td>
                      {roles.map(role => (
                        <td key={role.id} className="px-4 py-3 text-center">
                          {role.permissions.includes(permission) ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <div className="w-4 h-4 border border-theme-border rounded mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

const PORTAL_TABS = [
  { key: "dashboard", label: "Dashboard", alwaysOn: true },
  { key: "tasks", label: "Tasks & KPIs", alwaysOn: true },
  { key: "attendance", label: "Attendance", alwaysOn: true },
  { key: "reports", label: "KPI Reports", alwaysOn: true },
  { key: "expenses", label: "Expenses", alwaysOn: false },
  { key: "leave", label: "Leave", alwaysOn: false },
  { key: "payslips", label: "Payslips", alwaysOn: false },
  { key: "approvals", label: "Approvals", alwaysOn: false },
  { key: "appraisal", label: "AI Appraisal", alwaysOn: false },
  { key: "profile", label: "Profile", alwaysOn: true },
];

function getDefaultPermissions(role: string): Record<string, boolean> {
  const r = (role || "staff").toLowerCase();
  const perms: Record<string, boolean> = {};
  for (const tab of PORTAL_TABS) {
    perms[tab.key] = tab.alwaysOn;
  }
  perms.expenses = true;
  perms.leave = true;
  perms.payslips = true;
  const isHOD = r === "hod" || r === "head_of_department";
  const isHR = r === "hr" || r === "hr_admin" || r === "hr_manager";
  if (isHOD || isHR) perms.approvals = true;
  if (isHR) perms.appraisal = true;
  return perms;
}

function PortalAccessPanel({ tenantSlug }: { tenantSlug?: string | null }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPortal, setFilterPortal] = useState<"all" | "active" | "inactive">("active");
  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [defaults, setDefaults] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [modalMsg, setModalMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadEmployees = useCallback(async () => {
    if (!tenantSlug) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/hr/employees?tenantSlug=${encodeURIComponent(tenantSlug)}&limit=500`, { skipCache: true });
      const list = res.data.employees || [];
      console.log('[PortalUsers] fetched employees:', list.length, 'portal active:', list.filter((e: any) => e.isPortalActive).length, list);
      setEmployees(list);
    } catch (e: any) {
      console.error('[PortalUsers] fetch error:', e);
      setError(e?.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const filteredEmployees = employees.filter((emp: any) => {
    const matchesSearch = (emp.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (emp.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    const isPortalActive = emp.isPortalActive === true;
    const matchesFilter = filterPortal === "all" ||
                          (filterPortal === "active" && isPortalActive) ||
                          (filterPortal === "inactive" && !isPortalActive);
    return matchesSearch && matchesFilter;
  });

  const portalActiveCount = employees.filter((e: any) => e.isPortalActive).length;

  async function openPermissionsModal(emp: any) {
    setEditingEmp(emp);
    setModalMsg(null);
    try {
      const res = await fetch(`/api/hr/employees/${emp.id}/portal-permissions?tenantSlug=${encodeURIComponent(tenantSlug || "")}`);
      const data = await res.json();
      if (res.ok) {
        setPermissions(data.permissions || getDefaultPermissions(emp.role));
        setDefaults(data.defaults || getDefaultPermissions(emp.role));
      } else {
        setPermissions(getDefaultPermissions(emp.role));
        setDefaults(getDefaultPermissions(emp.role));
      }
    } catch {
      setPermissions(getDefaultPermissions(emp.role));
      setDefaults(getDefaultPermissions(emp.role));
    }
  }

  async function savePermissions() {
    if (!editingEmp) return;
    setSaving(true);
    setModalMsg(null);
    try {
      const res = await fetch(`/api/hr/employees/${editingEmp.id}/portal-permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, permissions }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setModalMsg({ type: "success", text: "Permissions updated successfully" });
        setEmployees(employees.map((e: any) => e.id === editingEmp.id ? { ...e, portalPermissions: permissions } : e));
        setTimeout(() => { setEditingEmp(null); setModalMsg(null); }, 1200);
      } else {
        setModalMsg({ type: "error", text: data.error || "Failed to save" });
      }
    } catch {
      setModalMsg({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefaults() {
    if (!editingEmp) return;
    setSaving(true);
    setModalMsg(null);
    try {
      const res = await fetch(`/api/hr/employees/${editingEmp.id}/portal-permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, resetToDefaults: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPermissions(data.permissions || defaults);
        setModalMsg({ type: "success", text: "Reset to role defaults" });
        setEmployees(employees.map((e: any) => e.id === editingEmp.id ? { ...e, portalPermissions: data.permissions } : e));
      } else {
        setModalMsg({ type: "error", text: data.error || "Failed to reset" });
      }
    } catch {
      setModalMsg({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  function getEnabledCount(emp: any): number {
    const perms = emp.portalPermissions || getDefaultPermissions(emp.role);
    return Object.entries(perms).filter(([, v]) => v === true).length;
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Total Employees</p>
              <p className="text-3xl font-bold text-theme-text-primary mt-2">{employees.length}</p>
            </div>
            <Users className="w-12 h-12 text-theme-accent" />
          </div>
        </div>
        <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Portal Active</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{portalActiveCount}</p>
            </div>
            <Monitor className="w-12 h-12 text-green-500" />
          </div>
        </div>
        <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Portal Inactive</p>
              <p className="text-3xl font-bold text-theme-text-secondary mt-2">{employees.length - portalActiveCount}</p>
            </div>
            <UserX className="w-12 h-12 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Monitor className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-900">Portal Users & Tab Access</p>
            <p className="text-xs text-blue-700 mt-1">
              These are employees with active portal accounts. Manage which dashboard tabs each employee can access.
              To activate a new employee's portal, use the HR & Operations section. Permissions default based on role but can be customized per employee.
            </p>
          </div>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-tertiary w-4 h-4" />
          <input
            type="text"
            placeholder="Search employees..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
          />
        </div>
        <select
          value={filterPortal}
          onChange={(e) => setFilterPortal(e.target.value as any)}
          className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
        >
          <option value="all">All Employees</option>
          <option value="active">Portal Active</option>
          <option value="inactive">Portal Inactive</option>
        </select>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Employee table */}
      <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-theme-muted border-b border-theme-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Portal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Tabs Enabled</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-theme-accent animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-theme-text-secondary">
                    {employees.length === 0
                      ? "No employees found. Check that employees exist for this tenant."
                      : `No ${filterPortal === "active" ? "portal-active" : filterPortal === "inactive" ? "portal-inactive" : ""} employees found. (${employees.length} total employees loaded)`}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-theme-muted">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-theme-accent-subtle rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-theme-accent">
                            {(emp.name || "?").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-theme-text-primary">{emp.name}</p>
                          <p className="text-xs text-theme-text-secondary">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-theme-text-primary capitalize">{emp.role || "staff"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-theme-text-primary">{emp.jobTitle || emp.departmentId || "—"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {emp.isPortalActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          <Clock className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-theme-text-primary">{getEnabledCount(emp)}/{PORTAL_TABS.length}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary">
                      {emp.lastLogin ? new Date(emp.lastLogin).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => openPermissionsModal(emp)}
                        disabled={!emp.isPortalActive}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
                        title={emp.isPortalActive ? "Manage tab permissions" : "Portal not active — activate in HR section first"}
                      >
                        <Shield className="w-3 h-3" />
                        Manage Permissions
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permissions Modal */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setEditingEmp(null); }}>
          <div className="w-full max-w-lg rounded-xl bg-theme-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-theme-text-primary">Portal Tab Permissions</h2>
                <p className="text-xs text-theme-text-secondary mt-0.5">{editingEmp.name} — {editingEmp.email}</p>
              </div>
              <button onClick={() => setEditingEmp(null)} className="text-theme-text-tertiary hover:text-theme-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMsg && (
              <div className={`mb-4 rounded-lg p-3 text-sm flex items-center gap-2 ${modalMsg.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-400"}`}>
                {modalMsg.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {modalMsg.text}
              </div>
            )}

            <div className="space-y-2">
              {PORTAL_TABS.map((tab) => (
                <div
                  key={tab.key}
                  className={`flex items-center justify-between p-3 rounded-lg border ${permissions[tab.key] ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                >
                  <div className="flex items-center gap-3">
                    {permissions[tab.key] ? (
                      <ToggleRight className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <span className="text-sm font-medium text-theme-text-primary">{tab.label}</span>
                      {tab.alwaysOn && (
                        <span className="ml-2 text-xs text-gray-400">(always on)</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (tab.alwaysOn) return;
                      setPermissions((prev) => ({ ...prev, [tab.key]: !prev[tab.key] }));
                    }}
                    disabled={tab.alwaysOn}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${permissions[tab.key] ? "bg-blue-600" : "bg-gray-300"} ${tab.alwaysOn ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${permissions[tab.key] ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between pt-4 border-t border-theme-border">
              <button
                onClick={resetToDefaults}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-theme-text-secondary border border-theme-border rounded-lg hover:bg-theme-muted transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Reset to Role Defaults
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditingEmp(null)} className="rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-text-secondary hover:bg-theme-muted">Cancel</button>
                <button
                  onClick={savePermissions}
                  disabled={saving}
                  className="rounded-lg brand-gradient px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save Permissions"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
