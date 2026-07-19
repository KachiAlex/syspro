'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, Plus, Edit, Trash2, Eye, Search, Filter, Shield, UserCheck, UserX, Mail, Phone, Calendar, Building, CheckCircle, AlertCircle, Clock, X } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { AdminService } from '@/app/tenant-admin/services/admin-service';
import DashboardGuard from '@/app/tenant-admin/components/DashboardGuard';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  branch: string;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin: string;
  joinDate: string;
  permissions: string[];
  avatar: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  userCount: number;
  color: string;
}

const INITIAL_USERS: User[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@techcorp.com',
    phone: '+1 (555) 123-4567',
    role: 'System Administrator',
    department: 'IT',
    branch: 'New York Headquarters',
    status: 'active',
    lastLogin: '2024-04-03 09:15:00',
    joinDate: '2018-03-15',
    permissions: ['Full Access', 'User Management', 'System Settings', 'Branch Management'],
    avatar: 'SJ'
  },
  {
    id: '2',
    name: 'James Wilson',
    email: 'james.wilson@techcorp.com',
    phone: '+1 (555) 234-5678',
    role: 'Branch Manager',
    department: 'Operations',
    branch: 'London Branch',
    status: 'active',
    lastLogin: '2024-04-03 08:30:00',
    joinDate: '2019-07-22',
    permissions: ['Branch Management', 'User Management', 'Reporting'],
    avatar: 'JW'
  },
  {
    id: '3',
    name: 'Yuki Tanaka',
    email: 'yuki.tanaka@techcorp.com',
    phone: '+81 (3) 1234-5678',
    role: 'Sales Manager',
    department: 'Sales',
    branch: 'Tokyo Office',
    status: 'active',
    lastLogin: '2024-04-02 22:45:00',
    joinDate: '2020-11-10',
    permissions: ['Sales Management', 'Reporting', 'Customer Management'],
    avatar: 'YT'
  },
  {
    id: '4',
    name: 'Michael Chen',
    email: 'michael.chen@techcorp.com',
    phone: '+61 (2) 1234-5678',
    role: 'Financial Analyst',
    department: 'Finance',
    branch: 'Sydney Branch',
    status: 'inactive',
    lastLogin: '2024-03-28 16:20:00',
    joinDate: '2021-02-28',
    permissions: ['Financial Reporting', 'Budget Management'],
    avatar: 'MC'
  },
  {
    id: '5',
    name: 'Ahmed Hassan',
    email: 'ahmed.hassan@techcorp.com',
    phone: '+971 (4) 123-4567',
    role: 'HR Manager',
    department: 'Human Resources',
    branch: 'Dubai Office',
    status: 'active',
    lastLogin: '2024-04-03 07:00:00',
    joinDate: '2022-05-15',
    permissions: ['HR Management', 'Payroll', 'Employee Records'],
    avatar: 'AH'
  },
  {
    id: '6',
    name: 'Emma Davis',
    email: 'emma.davis@techcorp.com',
    phone: '+1 (555) 345-6789',
    role: 'Marketing Specialist',
    department: 'Marketing',
    branch: 'New York Headquarters',
    status: 'suspended',
    lastLogin: '2024-03-15 14:30:00',
    joinDate: '2020-09-10',
    permissions: ['Content Management', 'Campaign Management'],
    avatar: 'ED'
  }
];

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: '', department: '', branch: '', status: 'active' });

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    const matchesStatus = selectedStatus === 'all' || user.status === selectedStatus;
    const matchesBranch = selectedBranch === 'all' || user.branch === selectedBranch;
    return matchesSearch && matchesRole && matchesStatus && matchesBranch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-theme-accent-subtle text-theme-accent';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-theme-accent-subtle text-theme-accent';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'inactive': return <Clock className="w-4 h-4 text-theme-text-secondary" />;
      case 'suspended': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-theme-text-secondary" />;
    }
  };

  const branches = [...new Set(users.map(u => u.branch))];
  const rolesList = [...new Set(users.map(u => u.role))];
  const activeUsers = users.filter(u => u.status === 'active').length;
  const inactiveUsers = users.filter(u => u.status === 'inactive').length;
  const suspendedUsers = users.filter(u => u.status === 'suspended').length;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim()) {
      setAddUserError('Name and email are required');
      return;
    }
    if (!tenantSlug) return;
    setAddUserLoading(true);
    setAddUserError(null);
    try {
      const data = await AdminService.createUser(tenantSlug, {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        status: userForm.status,
        role: userForm.role,
      });
      const newUser: User = {
        id: data.user?.id || Date.now().toString(),
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        phone: '',
        role: userForm.role || 'User',
        department: userForm.department || '—',
        branch: userForm.branch || '—',
        status: userForm.status as User['status'],
        lastLogin: '—',
        joinDate: new Date().toISOString().split('T')[0],
        permissions: [],
        avatar: getInitials(userForm.name),
      };
      setUsers((prev) => [...prev, newUser]);
      setShowAddUser(false);
      setUserForm({ name: '', email: '', role: '', department: '', branch: '', status: 'active' });
    } catch (err: any) {
      setAddUserError(err?.message || 'Failed to create user');
    } finally {
      setAddUserLoading(false);
    }
  }

  return (
    <DashboardGuard permission="admin" module="admin">
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Users & Roles</h1>
          <p className="text-sm text-theme-text-secondary mt-1">User management and permissions</p>
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
          Users ({users.length})
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Total Users</p>
                  <p className="text-3xl font-bold text-theme-text-primary mt-2">{users.length}</p>
                  <p className="text-xs text-theme-accent mt-2">↑ 4 new this month</p>
                </div>
                <Users className="w-12 h-12 text-theme-accent" />
              </div>
            </div>
            <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Active</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{activeUsers}</p>
                  <p className="text-xs text-green-600 mt-2">{((activeUsers / users.length) * 100).toFixed(1)}% active</p>
                </div>
                <UserCheck className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Inactive</p>
                  <p className="text-3xl font-bold text-theme-text-secondary mt-2">{inactiveUsers}</p>
                  <p className="text-xs text-theme-text-secondary mt-2">Not recently active</p>
                </div>
                <Clock className="w-12 h-12 text-gray-100" />
              </div>
            </div>
            <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-theme-text-secondary">Suspended</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">{suspendedUsers}</p>
                  <p className="text-xs text-red-600 mt-2">Access restricted</p>
                </div>
                <UserX className="w-12 h-12 text-red-500" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-tertiary w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
                />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              >
                <option value="all">All Roles</option>
                {rolesList.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              >
                <option value="all">All Branches</option>
                {branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white brand-gradient rounded-lg hover:opacity-90">
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>

          <div className="gradient-card bg-theme-surface rounded-xl border border-theme-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-theme-muted border-b border-theme-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-theme-muted">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-theme-accent-subtle rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-theme-accent">{getInitials(user.name)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-theme-text-primary">{user.name}</p>
                            <p className="text-xs text-theme-text-secondary">{user.email}</p>
                            <p className="text-xs text-theme-text-secondary">{user.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-theme-text-primary">{user.role}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-theme-text-primary">{user.department}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-theme-text-primary">{user.branch}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(user.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-primary">
                        {user.lastLogin}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-accent hover:text-theme-accent-hover">
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary">
                            <Edit className="w-3 h-3" />
                            Edit
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-theme-danger">
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
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
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) setShowAddUser(false); }}>
          <div className="w-full max-w-md rounded-xl bg-theme-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-theme-text-primary">Add User</h2>
              <button onClick={() => setShowAddUser(false)} className="text-theme-text-tertiary hover:text-theme-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            {addUserError && (
              <div className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">{addUserError}</div>
            )}
            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary">Full Name</label>
                <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary" placeholder="John Doe" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary">Email</label>
                <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary" placeholder="john@company.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary">Role</label>
                <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary">
                  <option value="">Select role</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.name}>{role.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary">Department</label>
                <input value={userForm.department} onChange={(e) => setUserForm({ ...userForm, department: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary" placeholder="e.g. Operations" />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary">Branch</label>
                <select value={userForm.branch} onChange={(e) => setUserForm({ ...userForm, branch: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary">
                  <option value="">Select branch</option>
                  {branches.map(branch => (
                    <option key={branch} value={branch}>{branch}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary">Status</label>
                <select value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddUser(false)} className="rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-text-secondary hover:bg-theme-muted">Cancel</button>
                <button type="submit" disabled={addUserLoading} className="rounded-lg brand-gradient px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">{addUserLoading ? 'Adding...' : 'Add User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </DashboardGuard>
  );
}
