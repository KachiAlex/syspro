'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Search, Shield, UserCheck, UserX, CheckCircle, AlertCircle, Clock, X, Monitor, Loader2, ToggleLeft, ToggleRight, RotateCcw, Grid3x3, List, Save, Layers } from 'lucide-react';
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

const BUSINESS_MODULES = [
  { key: "self_service", label: "Self-Service (Dashboard, Attendance, Expenses, Leave, Payslips)", alwaysOn: true },
  { key: "crm", label: "CRM (Leads, Customers, Sales Pipeline)", alwaysOn: false },
  { key: "finance", label: "Finance (Accounting, Bills, Payments, Reports)", alwaysOn: false },
  { key: "people", label: "HR & Operations (Staff, Payroll, Attendance Mgmt)", alwaysOn: false },
  { key: "projects", label: "Projects (Active, Archive, Reports)", alwaysOn: false },
  { key: "sales", label: "Sales & Procurement (Orders, Suppliers, Inventory)", alwaysOn: false },
  { key: "analytics", label: "Reports & Analytics", alwaysOn: false },
  { key: "automation", label: "Automation (Workflows, Rules)", alwaysOn: false },
  { key: "admin", label: "Admin (Settings, Users, Audit, Health)", alwaysOn: false },
];

function getDefaultPermissions(role: string): Record<string, boolean> {
  const r = (role || "staff").toLowerCase();
  const perms: Record<string, boolean> = {};
  for (const mod of BUSINESS_MODULES) {
    perms[mod.key] = mod.alwaysOn;
  }
  const isHOD = r === "hod" || r === "head_of_department";
  const isHR = r === "hr" || r === "hr_admin" || r === "hr_manager";
  const isAdmin = r === "admin" || r === "administrator";
  if (isHOD) {
    perms.projects = true;
    perms.analytics = true;
  }
  if (isHR) {
    perms.people = true;
    perms.finance = true;
    perms.analytics = true;
  }
  if (isAdmin) {
    for (const mod of BUSINESS_MODULES) {
      perms[mod.key] = true;
    }
  }
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
  const [viewMode, setViewMode] = useState<"list" | "matrix">("list");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [presets, setPresets] = useState<any[]>([]);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [bulkModules, setBulkModules] = useState<Record<string, boolean>>({});
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  // Load presets
  useEffect(() => {
    if (!tenantSlug) return;
    fetch(`/api/hr/employees/module-presets?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then(res => res.json())
      .then(data => setPresets(data.presets || []))
      .catch(() => {});
  }, [tenantSlug]);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredEmployees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEmployees.map((e: any) => e.id)));
    }
  }

  async function applyPreset(preset: any) {
    if (selectedIds.size === 0) {
      alert("Select employees first to apply a preset.");
      return;
    }
    if (!confirm(`Apply "${preset.name}" to ${selectedIds.size} selected employee(s)?`)) return;
    setBulkSaving(true);
    try {
      const res = await fetch("/api/hr/employees/bulk-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          employeeIds: Array.from(selectedIds),
          modules: preset.modules,
          mode: "replace",
        }),
      });
      if (res.ok) {
        await loadEmployees();
        setBulkMsg({ type: "success", text: `Applied "${preset.name}" to ${selectedIds.size} employees` });
        setTimeout(() => setBulkMsg(null), 3000);
      }
    } catch {
      setBulkMsg({ type: "error", text: "Failed to apply preset" });
    } finally {
      setBulkSaving(false);
      setShowPresetMenu(false);
    }
  }

  async function savePreset() {
    if (!newPresetName.trim() || !tenantSlug) return;
    try {
      const res = await fetch("/api/hr/employees/module-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug, name: newPresetName, modules: bulkModules }),
      });
      if (res.ok) {
        const data = await res.json();
        setPresets([...presets, data.preset]);
        setNewPresetName("");
        setShowSavePreset(false);
      }
    } catch {
      alert("Failed to save preset");
    }
  }

  async function applyBulkModules() {
    if (selectedIds.size === 0) return;
    setBulkSaving(true);
    setBulkMsg(null);
    try {
      const res = await fetch("/api/hr/employees/bulk-modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          employeeIds: Array.from(selectedIds),
          modules: bulkModules,
          mode: "replace",
        }),
      });
      if (res.ok) {
        await loadEmployees();
        setBulkMsg({ type: "success", text: `Updated module access for ${selectedIds.size} employees` });
        setTimeout(() => { setShowBulkModal(false); setBulkMsg(null); }, 1500);
      } else {
        setBulkMsg({ type: "error", text: "Failed to update modules" });
      }
    } catch {
      setBulkMsg({ type: "error", text: "Network error" });
    } finally {
      setBulkSaving(false);
    }
  }

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
            <p className="text-sm font-medium text-blue-900">Employee Module Access</p>
            <p className="text-xs text-blue-700 mt-1">
              These are employees with active portal accounts. Assign which business modules each employee can access (CRM, Finance, HR, Projects, etc.).
              To activate a new employee's portal, use the HR & Operations section. Module access defaults based on role but can be customized per employee.
            </p>
          </div>
        </div>
      </div>

      {/* Search & filter */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md min-w-[200px]">
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

        {/* View toggle */}
        <div className="flex items-center border border-theme-border rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-theme-accent text-white" : "text-theme-text-secondary hover:bg-theme-muted"}`}
            title="List view"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("matrix")}
            className={`px-3 py-2 text-sm ${viewMode === "matrix" ? "bg-theme-accent text-white" : "text-theme-text-secondary hover:bg-theme-muted"}`}
            title="Matrix view"
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
        </div>

        {/* Presets dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPresetMenu(!showPresetMenu)}
            disabled={selectedIds.size === 0}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border border-theme-border rounded-lg hover:bg-theme-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Layers className="w-4 h-4" /> Presets
            {selectedIds.size > 0 && <span className="text-xs bg-theme-accent text-white rounded-full px-1.5">{selectedIds.size}</span>}
          </button>
          {showPresetMenu && (
            <div className="absolute right-0 mt-1 w-64 rounded-lg border border-theme-border bg-theme-surface shadow-xl z-20 max-h-80 overflow-y-auto">
              {presets.length === 0 ? (
                <div className="p-3 text-sm text-theme-text-tertiary text-center">No presets saved yet</div>
              ) : (
                presets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    disabled={bulkSaving}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-theme-muted border-b border-theme-border last:border-0"
                  >
                    <div className="font-medium text-theme-text-primary">{p.name}</div>
                    <div className="text-xs text-theme-text-tertiary">
                      {Object.entries(p.modules).filter(([, v]) => v).map(([k]) => k).join(", ") || "No modules"}
                    </div>
                  </button>
                ))
              )}
              <button
                onClick={() => { setShowSavePreset(true); setShowPresetMenu(false); }}
                className="w-full text-left px-3 py-2 text-sm text-theme-accent hover:bg-theme-muted border-t border-theme-border"
              >
                + Save current as preset
              </button>
            </div>
          )}
        </div>

        {/* Bulk assign button */}
        <button
          onClick={() => { setBulkModules(getDefaultPermissions("staff")); setShowBulkModal(true); }}
          disabled={selectedIds.size === 0}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white brand-gradient rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Shield className="w-4 h-4" /> Bulk Assign
          {selectedIds.size > 0 && <span className="text-xs bg-white/20 rounded-full px-1.5">{selectedIds.size}</span>}
        </button>
      </div>

      {/* Bulk status message */}
      {bulkMsg && (
        <div className={`rounded-lg p-3 text-sm flex items-center gap-2 ${bulkMsg.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-400"}`}>
          {bulkMsg.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {bulkMsg.text}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Employee table / Matrix view */}
      {viewMode === "matrix" ? (
        /* Matrix View */
        <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-theme-muted border-b border-theme-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider sticky left-0 bg-theme-muted z-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === filteredEmployees.length && filteredEmployees.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-theme-border"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider sticky left-12 bg-theme-muted z-10 min-w-[160px]">Employee</th>
                  {BUSINESS_MODULES.map((mod) => (
                    <th key={mod.key} className="px-3 py-3 text-center text-xs font-medium text-theme-text-secondary uppercase tracking-wider min-w-[80px]" title={mod.label}>
                      {mod.key === "self_service" ? "Self" : mod.key.charAt(0).toUpperCase() + mod.key.slice(1, 4)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {loading ? (
                  <tr><td colSpan={BUSINESS_MODULES.length + 2} className="px-6 py-12 text-center"><Loader2 className="w-6 h-6 text-theme-accent animate-spin mx-auto" /></td></tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr><td colSpan={BUSINESS_MODULES.length + 2} className="px-6 py-12 text-center text-sm text-theme-text-secondary">No employees found</td></tr>
                ) : (
                  filteredEmployees.map((emp: any) => {
                    const perms = emp.portalPermissions || getDefaultPermissions(emp.role);
                    return (
                      <tr key={emp.id} className="hover:bg-theme-muted">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(emp.id)}
                            onChange={() => toggleSelect(emp.id)}
                            className="rounded border-theme-border"
                          />
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap sticky left-12 bg-theme-surface">
                          <p className="text-sm font-medium text-theme-text-primary truncate">{emp.name}</p>
                          <p className="text-xs text-theme-text-tertiary truncate">{emp.role || "staff"}</p>
                        </td>
                        {BUSINESS_MODULES.map((mod) => (
                          <td key={mod.key} className="px-3 py-2 text-center">
                            {perms[mod.key] === true ? (
                              <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                            ) : (
                              <div className="w-4 h-4 mx-auto rounded-full border border-gray-300" />
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
      /* List View */
      <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-theme-muted border-b border-theme-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredEmployees.length && filteredEmployees.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-theme-border"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Portal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Modules</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Last Login</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 text-theme-accent animate-spin mx-auto" />
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-theme-text-secondary">
                    {employees.length === 0
                      ? "No employees found. Check that employees exist for this tenant."
                      : `No ${filterPortal === "active" ? "portal-active" : filterPortal === "inactive" ? "portal-inactive" : ""} employees found. (${employees.length} total employees loaded)`}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-theme-muted">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(emp.id)}
                        onChange={() => toggleSelect(emp.id)}
                        className="rounded border-theme-border"
                      />
                    </td>
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
                      <span className="text-sm text-theme-text-primary">{getEnabledCount(emp)}/{BUSINESS_MODULES.length}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-secondary">
                      {emp.lastLogin ? new Date(emp.lastLogin).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => openPermissionsModal(emp)}
                        disabled={!emp.isPortalActive}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover disabled:opacity-40 disabled:cursor-not-allowed"
                        title={emp.isPortalActive ? "Manage module access" : "Portal not active — activate in HR section first"}
                      >
                        <Shield className="w-3 h-3" />
                        Manage Modules
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Permissions Modal */}
      {editingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setEditingEmp(null); }}>
          <div className="w-full max-w-lg rounded-xl bg-theme-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-theme-text-primary">Module Access Permissions</h2>
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
              {BUSINESS_MODULES.map((mod) => (
                <div
                  key={mod.key}
                  className={`flex items-center justify-between p-3 rounded-lg border ${permissions[mod.key] ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                >
                  <div className="flex items-center gap-3">
                    {permissions[mod.key] ? (
                      <ToggleRight className="w-5 h-5 text-blue-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <span className="text-sm font-medium text-theme-text-primary">{mod.label}</span>
                      {mod.alwaysOn && (
                        <span className="ml-2 text-xs text-gray-400">(always on)</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (mod.alwaysOn) return;
                      setPermissions((prev) => ({ ...prev, [mod.key]: !prev[mod.key] }));
                    }}
                    disabled={mod.alwaysOn}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${permissions[mod.key] ? "bg-blue-600" : "bg-gray-300"} ${mod.alwaysOn ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${permissions[mod.key] ? "translate-x-6" : "translate-x-1"}`} />
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

      {/* Bulk Assign Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setShowBulkModal(false); }}>
          <div className="w-full max-w-lg rounded-xl bg-theme-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-theme-text-primary">Bulk Module Assignment</h2>
                <p className="text-xs text-theme-text-secondary mt-0.5">Assigning to {selectedIds.size} selected employee(s)</p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-theme-text-tertiary hover:text-theme-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkMsg && (
              <div className={`mb-4 rounded-lg p-3 text-sm flex items-center gap-2 ${bulkMsg.type === "success" ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-400"}`}>
                {bulkMsg.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {bulkMsg.text}
              </div>
            )}

            <div className="space-y-2">
              {BUSINESS_MODULES.map((mod) => (
                <div key={mod.key} className={`flex items-center justify-between p-3 rounded-lg border ${bulkModules[mod.key] ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"}`}>
                  <div className="flex items-center gap-3">
                    {bulkModules[mod.key] ? <ToggleRight className="w-5 h-5 text-blue-600" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                    <span className="text-sm font-medium text-theme-text-primary">{mod.label}</span>
                    {mod.alwaysOn && <span className="ml-2 text-xs text-gray-400">(always on)</span>}
                  </div>
                  <button
                    onClick={() => { if (!mod.alwaysOn) setBulkModules((prev) => ({ ...prev, [mod.key]: !prev[mod.key] })); }}
                    disabled={mod.alwaysOn}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bulkModules[mod.key] ? "bg-blue-600" : "bg-gray-300"} ${mod.alwaysOn ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bulkModules[mod.key] ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between pt-4 border-t border-theme-border">
              <button
                onClick={() => { setShowSavePreset(true); }}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-theme-text-secondary border border-theme-border rounded-lg hover:bg-theme-muted"
              >
                <Save className="w-4 h-4" /> Save as Preset
              </button>
              <div className="flex gap-2">
                <button onClick={() => setShowBulkModal(false)} className="rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-text-secondary hover:bg-theme-muted">Cancel</button>
                <button
                  onClick={applyBulkModules}
                  disabled={bulkSaving}
                  className="rounded-lg brand-gradient px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {bulkSaving ? "Applying..." : `Apply to ${selectedIds.size} Employee(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Preset Modal */}
      {showSavePreset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setShowSavePreset(false); }}>
          <div className="w-full max-w-sm rounded-xl bg-theme-surface p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-theme-text-primary">Save Module Preset</h2>
              <button onClick={() => setShowSavePreset(false)} className="text-theme-text-tertiary hover:text-theme-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Preset name (e.g. Sales Team, Accounting)"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              className="w-full px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSavePreset(false)} className="rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-text-secondary hover:bg-theme-muted">Cancel</button>
              <button
                onClick={savePreset}
                disabled={!newPresetName.trim()}
                className="rounded-lg brand-gradient px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
