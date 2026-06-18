'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Users, Plus, Edit, Trash2, Eye, Search, Filter, Shield, UserCheck, UserX, Mail, Phone, Calendar, Building, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

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

const users: User[] = [
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
      case 'inactive': return 'bg-gray-100 text-gray-900';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-900';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'inactive': return <Clock className="w-4 h-4 text-gray-600" />;
      case 'suspended': return <AlertCircle className="w-4 h-4 text-red-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F8FAFC]">Users & Roles</h1>
          <p className="text-sm text-gray-600 mt-1">User management and permissions</p>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Roles ({roles.length})
        </button>
      </div>

      {activeTab === 'users' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Users</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{users.length}</p>
                  <p className="text-xs text-blue-600 mt-2">↑ 4 new this month</p>
                </div>
                <Users className="w-12 h-12 text-blue-100" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">{activeUsers}</p>
                  <p className="text-xs text-green-600 mt-2">{((activeUsers / users.length) * 100).toFixed(1)}% active</p>
                </div>
                <UserCheck className="w-12 h-12 text-green-100" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Inactive</p>
                  <p className="text-3xl font-bold text-gray-600 mt-2">{inactiveUsers}</p>
                  <p className="text-xs text-gray-600 mt-2">Not recently active</p>
                </div>
                <Clock className="w-12 h-12 text-gray-100" />
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Suspended</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">{suspendedUsers}</p>
                  <p className="text-xs text-red-600 mt-2">Access restricted</p>
                </div>
                <UserX className="w-12 h-12 text-red-100" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                {rolesList.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Branches</option>
                {branches.map(branch => (
                  <option key={branch} value={branch}>{branch}</option>
                ))}
              </select>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">{getInitials(user.name)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500">{user.email}</p>
                            <p className="text-xs text-gray-500">{user.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{user.role}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{user.department}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{user.branch}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(user.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
                            {user.status.charAt(0).toUpperCase() + user.status.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.lastLogin}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-700">
                            <Edit className="w-3 h-3" />
                            Edit
                          </button>
                          <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700">
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search roles..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Create Role
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {roles.map((role) => (
              <div key={role.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${role.color} rounded-full flex items-center justify-center`}>
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{role.name}</h3>
                      <span className="text-xs text-gray-500">{role.userCount} users</span>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Edit className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">{role.description}</p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-900">Permissions:</p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((permission, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-900"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
                  <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Edit Role
                  </button>
                  <button className="text-sm text-red-600 hover:text-red-700 font-medium">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Permissions Matrix</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permission</th>
                    {roles.map(role => (
                      <th key={role.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {['Full Access', 'User Management', 'System Settings', 'Branch Management', 'Reporting', 'Financial Reporting', 'HR Management', 'Sales Management'].map(permission => (
                    <tr key={permission}>
                      <td className="px-4 py-3 text-sm text-gray-900">{permission}</td>
                      {roles.map(role => (
                        <td key={role.id} className="px-4 py-3 text-center">
                          {role.permissions.includes(permission) ? (
                            <CheckCircle className="w-4 h-4 text-green-600 mx-auto" />
                          ) : (
                            <div className="w-4 h-4 border border-gray-300 rounded mx-auto" />
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
