'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Plus, Pencil, Search, ChevronLeft, ChevronRight, KeyRound, Lock, Unlock, CheckCircle, X, Copy, RefreshCw, AlertTriangle } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { HRService } from '@/app/tenant-admin/sections/hr-service';
import { AddEmployeeModal } from '@/app/tenant-admin/sections/hr-add-employee-modal';
import { EditEmployeeModal } from '@/app/tenant-admin/sections/hr-edit-employee-modal';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: string;
  startDate: string;
  status: string;
  salary: string;
  employmentType?: string;
  isPortalActive?: boolean;
  lastLogin?: string | null;
}

interface TrainingSession {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'ongoing' | 'completed';
  startDate: string;
  endDate: string;
  instructor: string;
  capacity: number;
  enrolled: number;
  location?: string;
}


export default function StaffPage() {
  const { tenantSlug } = useTenantContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  const [portalActionLoading, setPortalActionLoading] = useState<string | null>(null);
  const [portalCredentials, setPortalCredentials] = useState<{ name: string; email: string; password: string } | null>(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [MigrationResult, setMigrationResult] = useState<{ scanned: number; repaired: number; repairs: any[]; dryRun: boolean } | null>(null);

  const [departments, setDepartments] = useState<string[]>(['All Departments']);
  const statuses = ['All Statuses', 'Active', 'On Leave', 'Inactive', 'Terminated'];
  const [currency, setCurrency] = useState('USD');

  const currencySymbol = (code: string) => {
    const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', NGN: '₦', JPY: '¥', CAD: 'C$', AUD: 'A$', INR: '₹', KES: 'KSh', GHS: '₵' };
    return symbols[code] || code;
  };

  const loadData = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [fetchedEmployees, fetchedDepartments, fetchedTraining, fetchedCurrency] = await Promise.all([
        HRService.getEmployees(tenantSlug).catch(() => []),
        HRService.getDepartments(tenantSlug).catch(() => []),
        HRService.getTrainingSessions(tenantSlug).catch(() => []),
        HRService.getTenantCurrency(tenantSlug).catch(() => 'USD'),
      ]);
      setCurrency(fetchedCurrency);
      const sym = currencySymbol(fetchedCurrency);
      setEmployees(fetchedEmployees.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        email: emp.email,
        department: emp.department,
        position: emp.position,
        role: emp.role || 'Staff',
        startDate: emp.startDate,
        status: emp.status,
        salary: emp.salary ? `${sym}${Number(emp.salary).toLocaleString()}` : '',
        employmentType: emp.employmentType || 'Full-time',
        isPortalActive: emp.isPortalActive ?? false,
        lastLogin: emp.lastLogin ?? null,
      })));
      setDepartments(['All Departments', ...fetchedDepartments]);
      setTrainingSessions(fetchedTraining.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description || '',
        status: (s.status as 'planned' | 'ongoing' | 'completed') || 'planned',
        startDate: s.startDate || s.start_date || '',
        endDate: s.endDate || s.end_date || '',
        instructor: s.instructor || '',
        capacity: s.capacity || 0,
        enrolled: s.enrolled || 0,
        location: s.location || ''
      })));
    } catch (error) {
      console.error('Failed to load staff data:', error);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (departmentFilter !== 'All Departments' && emp.department !== departmentFilter) return false;
      if (statusFilter !== 'All Statuses' && emp.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!emp.name.toLowerCase().includes(query) && !emp.email.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [employees, departmentFilter, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredEmployees.slice(start, start + itemsPerPage);
  }, [filteredEmployees, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, departmentFilter, statusFilter]);

  const handleAddEmployee = async (data: any) => {
    if (!tenantSlug) return;
    const result = await HRService.addEmployee(tenantSlug, data);
    await loadData();
    return result;
  };

  const handleActivatePortal = async (emp: Employee) => {
    if (!tenantSlug) return;
    setPortalActionLoading(emp.id);
    try {
      const creds = await HRService.activateEmployeePortal(tenantSlug, [emp.id]);
      if (creds.length > 0) {
        setPortalCredentials({ name: creds[0].name, email: creds[0].email, password: creds[0].password });
      }
      await loadData();
    } catch (err) {
      console.error('Failed to activate portal:', err);
    } finally {
      setPortalActionLoading(null);
    }
  };

  const handleDeactivatePortal = async (emp: Employee) => {
    if (!tenantSlug) return;
    setPortalActionLoading(emp.id);
    try {
      await HRService.deactivateEmployeePortal(tenantSlug, emp.id);
      await loadData();
    } catch (err) {
      console.error('Failed to deactivate portal:', err);
    } finally {
      setPortalActionLoading(null);
    }
  };

  const handleMigrateDepartments = async (dryRun: boolean) => {
    if (!tenantSlug) return;
    setMigrationLoading(true);
    try {
      const res = await fetch('/api/hr/employees/migrate-departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantSlug, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error('Migration failed:', data.error);
        return;
      }
      setMigrationResult({
        scanned: data.scanned,
        repaired: data.repaired ?? 0,
        repairs: data.repairs || [],
        dryRun,
      });
      if (!dryRun && data.repaired > 0) {
        await loadData();
      }
    } catch (err) {
      console.error('Migration error:', err);
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleEditEmployee = async (data: any) => {
    if (!tenantSlug || !editingEmployee) return;
    await HRService.updateEmployee(tenantSlug, editingEmployee.id, data);
    await loadData();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Staff Management</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleMigrateDepartments(true)}
            disabled={migrationLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            title="Scan and fix department links for existing employees"
          >
            <RefreshCw className={`w-4 h-4 ${migrationLoading ? 'animate-spin' : ''}`} />
            Sync Departments
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-theme-text-tertiary" />
              <input
                type="text"
                placeholder="Name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-2">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-900 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Department</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Position</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Portal</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-900 whitespace-nowrap">Start Date</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-900 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedEmployees.length > 0 ? (
              paginatedEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">{emp.name}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{emp.email}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{emp.department}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{emp.position}</td>
                  <td className="px-4 py-4 text-sm whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.role === 'Executive' ? 'bg-purple-100 text-purple-800' :
                      emp.role === 'Admin' ? 'bg-blue-100 text-blue-800' :
                      emp.role === 'HOD' ? 'bg-amber-100 text-amber-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.status === 'Active' ? 'bg-green-100 text-green-800' :
                      emp.status === 'On Leave' ? 'bg-amber-100 text-amber-800' :
                      emp.status === 'Inactive' ? 'bg-gray-100 text-gray-900' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm whitespace-nowrap">
                    {emp.isPortalActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Unlock className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <Lock className="w-3 h-3" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{emp.startDate}</td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setEditingEmployee(emp);
                          setShowEditModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      {emp.isPortalActive ? (
                        <>
                          <button
                            onClick={() => handleActivatePortal(emp)}
                            disabled={portalActionLoading === emp.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-600 hover:text-amber-800 disabled:opacity-40"
                            title="Reset portal password"
                          >
                            <KeyRound className="w-4 h-4" />
                            Reset
                          </button>
                          <button
                            onClick={() => handleDeactivatePortal(emp)}
                            disabled={portalActionLoading === emp.id}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-40"
                            title="Deactivate portal access"
                          >
                            <Lock className="w-4 h-4" />
                            Disable
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleActivatePortal(emp)}
                          disabled={portalActionLoading === emp.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 hover:text-green-800 disabled:opacity-40"
                          title="Activate portal access"
                        >
                          <KeyRound className="w-4 h-4" />
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-sm text-gray-600">
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3">
          <div className="text-sm text-gray-600">
            Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddEmployee}
        departments={departments.filter(d => d !== 'All Departments')}
        tenantSlug={tenantSlug || ''}
      />

      <EditEmployeeModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setEditingEmployee(null); }}
        onSubmit={handleEditEmployee}
        employee={editingEmployee}
        departments={departments.filter(d => d !== 'All Departments')}
        tenantSlug={tenantSlug || ''}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">{employees.filter(e => e.status === 'Active').length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">On Leave</p>
          <p className="text-2xl font-bold text-amber-600">{employees.filter(e => e.status === 'On Leave').length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 mb-1">Departments</p>
          <p className="text-2xl font-bold text-blue-600">{new Set(employees.map(e => e.department)).size}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Training & Development</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trainingSessions.length > 0 ? trainingSessions.map((session) => (
            <div key={session.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h5 className="font-semibold text-gray-900">{session.title}</h5>
                  <p className="text-xs text-gray-600 mt-1">{session.description}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${
                  session.status === 'completed' ? 'bg-green-100 text-green-800' :
                  session.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-900'
                }`}>
                  {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </span>
              </div>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Instructor:</span>
                  <span className="font-medium text-gray-900">{session.instructor}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Enrollment:</span>
                  <span className="font-medium text-gray-900">{session.enrolled}/{session.capacity}</span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${(session.enrolled / session.capacity) * 100}%` }} />
              </div>
            </div>
          )) : (
            <p className="text-sm text-gray-600">No training sessions available.</p>
          )}
        </div>
      </div>

      {/* Portal credentials modal */}
      {portalCredentials && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Portal Credentials</h3>
              <button onClick={() => setPortalCredentials(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-800">
                  Portal account activated for <strong>{portalCredentials.name}</strong>. Share these credentials securely.
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Email</span>
                  <span className="text-sm font-mono text-gray-900">{portalCredentials.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Password</span>
                  <span className="text-sm font-mono text-gray-900 select-all">{portalCredentials.password}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Login URL</span>
                  <span className="text-sm font-mono text-blue-700">/employee/login</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `Login URL: /employee/login\nEmail: ${portalCredentials.email}\nPassword: ${portalCredentials.password}`
                    );
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={() => setPortalCredentials(null)}
                  className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Migration result modal */}
      {MigrationResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Department Sync</h3>
              <button onClick={() => setMigrationResult(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {MigrationResult.scanned === 0 ? (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800">
                    All employees already have proper department links. No repairs needed.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">
                        {MigrationResult.dryRun
                          ? `${MigrationResult.scanned} employee(s) have raw-text department IDs`
                          : `${MigrationResult.repaired} employee(s) repaired`}
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        {MigrationResult.dryRun
                          ? 'Review the list below and click "Apply Repair" to fix them.'
                          : 'Department links have been updated to use proper department records.'}
                      </p>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Employee</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Old Dept ID</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Resolved To</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {MigrationResult.repairs.slice(0, 20).map((r: any, i: number) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-xs text-gray-900">{r.employeeName}</td>
                            <td className="px-3 py-2 text-xs font-mono text-gray-500 truncate max-w-[120px]">{r.oldDepartmentId}</td>
                            <td className="px-3 py-2 text-xs text-gray-900">{r.departmentName}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {MigrationResult.repairs.length > 20 && (
                      <p className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
                        ...and {MigrationResult.repairs.length - 20} more
                      </p>
                    )}
                  </div>

                  {MigrationResult.dryRun && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setMigrationResult(null); handleMigrateDepartments(false); }}
                        disabled={migrationLoading}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {migrationLoading ? 'Applying...' : 'Apply Repair'}
                      </button>
                      <button
                        onClick={() => setMigrationResult(null)}
                        className="flex-1 px-4 py-2 text-sm border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {!MigrationResult.dryRun && (
                    <button
                      onClick={() => setMigrationResult(null)}
                      className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Done
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
