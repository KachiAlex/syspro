'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Settings, Users, FileText, Heart, Globe, MapPin, Building, Plus, Edit, Trash2, Eye, TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';

interface AdminTab {
  id: string;
  name: string;
  href: string;
  icon: React.ElementType;
  count?: number;
  description: string;
}

const adminTabs: AdminTab[] = [
  {
    id: 'settings',
    name: 'Settings',
    href: '/tenant-admin/settings',
    icon: Settings,
    description: 'System configuration and preferences'
  },
  {
    id: 'users',
    name: 'Users & Roles',
    href: '/tenant-admin/users',
    icon: Users,
    count: 127,
    description: 'User management and permissions'
  },
  {
    id: 'audit',
    name: 'Audit Trail',
    href: '/tenant-admin/audit',
    icon: FileText,
    count: 2847,
    description: 'Activity logs and compliance tracking'
  },
  {
    id: 'health',
    name: 'System Health',
    href: '/tenant-admin/health',
    icon: Heart,
    description: 'System monitoring and diagnostics'
  }
];

interface Branch {
  id: string;
  name: string;
  code: string;
  country: string;
  continent: string;
  state: string;
  city: string;
  status: 'active' | 'inactive' | 'pending';
  employees: number;
  manager: string;
  establishedDate: string;
  revenue: number;
  currency: string;
}

const branches: Branch[] = [
  {
    id: '1',
    name: 'New York Headquarters',
    code: 'NY-HQ-001',
    country: 'United States',
    continent: 'North America',
    state: 'New York',
    city: 'New York City',
    status: 'active',
    employees: 450,
    manager: 'Sarah Johnson',
    establishedDate: '2018-03-15',
    revenue: 12500000,
    currency: 'USD'
  },
  {
    id: '2',
    name: 'London Branch',
    code: 'LON-UK-002',
    country: 'United Kingdom',
    continent: 'Europe',
    state: 'England',
    city: 'London',
    status: 'active',
    employees: 280,
    manager: 'James Wilson',
    establishedDate: '2019-07-22',
    revenue: 8750000,
    currency: 'GBP'
  },
  {
    id: '3',
    name: 'Tokyo Office',
    code: 'TOK-JP-003',
    country: 'Japan',
    continent: 'Asia',
    state: 'Tokyo',
    city: 'Tokyo',
    status: 'active',
    employees: 195,
    manager: 'Yuki Tanaka',
    establishedDate: '2020-11-10',
    revenue: 6200000,
    currency: 'JPY'
  },
  {
    id: '4',
    name: 'Sydney Branch',
    code: 'SYD-AU-004',
    country: 'Australia',
    continent: 'Oceania',
    state: 'New South Wales',
    city: 'Sydney',
    status: 'pending',
    employees: 120,
    manager: 'Michael Chen',
    establishedDate: '2021-02-28',
    revenue: 3100000,
    currency: 'AUD'
  },
  {
    id: '5',
    name: 'Dubai Office',
    code: 'DUB-AE-005',
    country: 'United Arab Emirates',
    continent: 'Asia',
    state: 'Dubai',
    city: 'Dubai',
    status: 'active',
    employees: 85,
    manager: 'Ahmed Hassan',
    establishedDate: '2022-05-15',
    revenue: 4200000,
    currency: 'AED'
  }
];

export default function AdminPage() {
  const { tenantSlug } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContinent, setSelectedContinent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const filteredBranches = branches.filter(branch => {
    const matchesSearch = branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         branch.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         branch.country.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesContinent = selectedContinent === 'all' || branch.continent === selectedContinent;
    const matchesStatus = selectedStatus === 'all' || branch.status === selectedStatus;
    return matchesSearch && matchesContinent && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'inactive': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-amber-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const totalRevenue = branches.reduce((sum, branch) => sum + branch.revenue, 0);
  const totalEmployees = branches.reduce((sum, branch) => sum + branch.employees, 0);
  const activeBranches = branches.filter(b => b.status === 'active').length;
  const continents = [...new Set(branches.map(b => b.continent))];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="text-sm text-gray-600 mt-1">System administration and branch management</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Last 30 Days</option>
            <option>Last Quarter</option>
            <option>Last Year</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Branches</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{branches.length}</p>
              <p className="text-xs text-blue-600 mt-2">↑ 2 new this month</p>
            </div>
            <Building className="w-12 h-12 text-blue-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Branches</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{activeBranches}</p>
              <p className="text-xs text-green-600 mt-2">80% operational</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{totalEmployees.toLocaleString()}</p>
              <p className="text-xs text-purple-600 mt-2">↑ 8.3% growth</p>
            </div>
            <Users className="w-12 h-12 text-purple-100" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">${(totalRevenue / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-amber-600 mt-2">↑ 12.4% YoY</p>
            </div>
            <TrendingUp className="w-12 h-12 text-amber-100" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Access</h3>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
            {adminTabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className="group block p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 hover:from-gray-100 hover:to-gray-200 transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <tab.icon className="w-8 h-8 text-gray-600 group-hover:text-gray-700" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-gray-800">{tab.name}</h3>
                    {tab.count && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 group-hover:bg-gray-300">
                        {tab.count}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 group-hover:text-gray-700">{tab.description}</p>
                <div className="mt-4 flex items-center text-sm font-medium text-gray-700 group-hover:text-gray-800">
                  Access →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Branch Management</h3>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search branches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              </div>
              <select
                value={selectedContinent}
                onChange={(e) => setSelectedContinent(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Continents</option>
                {continents.map(continent => (
                  <option key={continent} value={continent}>{continent}</option>
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
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Manager</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBranches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{branch.name}</p>
                        <p className="text-xs text-gray-500">{branch.code}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-900">{branch.city}</p>
                          <p className="text-xs text-gray-500">{branch.country}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(branch.status)}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(branch.status)}`}>
                          {branch.status.charAt(0).toUpperCase() + branch.status.slice(1)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {branch.employees.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {branch.manager}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {branch.currency} {(branch.revenue / 1000000).toFixed(1)}M
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Geographic Distribution</h3>
          <div className="space-y-4">
            {continents.map(continent => {
              const continentBranches = branches.filter(b => b.continent === continent);
              const continentEmployees = continentBranches.reduce((sum, b) => sum + b.employees, 0);
              const percentage = (continentEmployees / totalEmployees) * 100;
              
              return (
                <div key={continent} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{continent}</p>
                      <p className="text-xs text-gray-500">{continentBranches.length} branches</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900">{percentage.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Dubai Office activated</p>
                <p className="text-xs text-gray-500">2 hours ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">New manager assigned to Sydney Branch</p>
                <p className="text-xs text-gray-500">1 day ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Sydney Branch setup in progress</p>
                <p className="text-xs text-gray-500">3 days ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">Quarterly revenue report generated</p>
                <p className="text-xs text-gray-500">1 week ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
