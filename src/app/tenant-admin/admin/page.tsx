'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Users, FileText, Heart, Globe, MapPin, Building, Plus, Edit, Trash2, Eye, TrendingUp, TrendingDown, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useTenantContext } from '@/components/tenant-admin/tenant-context';
import { AdminService } from '@/app/tenant-admin/services/admin-service';
import { COUNTRIES } from '@/lib/reference-data';

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

export default function AdminPage() {
  const { tenantSlug } = useTenantContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContinent, setSelectedContinent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [showAddBranch, setShowAddBranch] = useState(false);
  const [addBranchLoading, setAddBranchLoading] = useState(false);
  const [addBranchError, setAddBranchError] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState({ name: '', code: '', city: '', country: '', continent: '', manager: '' });

  useEffect(() => {
    async function load() {
      if (!tenantSlug) return;
      try {
        const [usersRes, auditRes, healthRes, branchesRes] = await Promise.all([
          AdminService.getUsers(tenantSlug),
          AdminService.getAuditLogs(tenantSlug),
          AdminService.getHealth(tenantSlug),
          AdminService.getBranches(tenantSlug),
        ]);
        setCounts({
          users: (usersRes.users || []).length,
          audit: (auditRes.logs || []).length,
          health: (healthRes.metrics || []).length,
        });
        setBranches(branchesRes.branches || []);
        setRecentAudits(auditRes.logs || []);
      } catch (err) {
        console.error('Failed to load admin data', err);
      }
    }
    load();
  }, [tenantSlug]);

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
      default: return 'bg-theme-muted text-theme-text-primary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'inactive': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'pending': return <AlertCircle className="w-4 h-4 text-amber-600" />;
      default: return <AlertCircle className="w-4 h-4 text-theme-text-secondary" />;
    }
  };

  const totalRevenue = branches.reduce((sum, branch) => sum + branch.revenue, 0);
  const totalEmployees = branches.reduce((sum, branch) => sum + branch.employees, 0);
  const activeBranches = branches.filter(b => b.status === 'active').length;
  const continents = [...new Set(branches.map(b => b.continent))];
  const tabs = adminTabs.map(t => ({ ...t, count: counts[t.id] ?? t.count }));

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.manager.trim()) {
      setAddBranchError('Name and manager are required');
      return;
    }
    if (!tenantSlug) return;
    setAddBranchLoading(true);
    setAddBranchError(null);
    try {
      await AdminService.createBranch(tenantSlug, {
        parentId: 'tenant-root',
        node: {
          name: branchForm.name.trim(),
          manager: branchForm.manager.trim(),
          type: 'branch',
          status: 'Live',
          region: branchForm.continent,
          timezone: 'UTC',
          headcount: 0,
          modules: [],
        },
      });
      setShowAddBranch(false);
      setBranchForm({ name: '', code: '', city: '', country: '', continent: '', manager: '' });
      const branchesRes = await AdminService.getBranches(tenantSlug);
      setBranches(branchesRes.branches || []);
    } catch (err: any) {
      setAddBranchError(err?.message || 'Failed to create branch');
    } finally {
      setAddBranchLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-theme-text-primary">Admin</h1>
          <p className="text-sm text-theme-text-secondary mt-1">System administration and branch management</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent">
            <option>Last 30 Days</option>
            <option>Last Quarter</option>
            <option>Last Year</option>
          </select>
          <button onClick={() => setShowAddBranch(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-theme-accent rounded-lg hover:bg-theme-accent-hover">
            <Plus className="w-4 h-4" />
            Add Branch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Total Branches</p>
              <p className="text-3xl font-bold text-theme-text-primary mt-2">{branches.length}</p>
              <p className="text-xs text-theme-accent mt-2">↑ 2 new this month</p>
            </div>
            <Building className="w-12 h-12 text-blue-100" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Active Branches</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{activeBranches}</p>
              <p className="text-xs text-green-600 mt-2">80% operational</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-100" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Total Employees</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">{totalEmployees.toLocaleString()}</p>
              <p className="text-xs text-purple-600 mt-2">↑ 8.3% growth</p>
            </div>
            <Users className="w-12 h-12 text-purple-100" />
          </div>
        </div>
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-theme-text-secondary">Total Revenue</p>
              <p className="text-3xl font-bold text-amber-600 mt-2">${(totalRevenue / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-amber-600 mt-2">↑ 12.4% YoY</p>
            </div>
            <TrendingUp className="w-12 h-12 text-amber-100" />
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border overflow-hidden">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Quick Access</h3>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className="group block p-6 bg-gradient-to-br from-theme-muted to-theme-elevated rounded-lg border border-theme-border hover:from-theme-elevated hover:to-theme-muted transition-all duration-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <tab.icon className="w-8 h-8 text-theme-text-secondary group-hover:text-theme-text-primary" />
                  <div>
                    <h3 className="text-lg font-semibold text-theme-text-primary group-hover:text-theme-text-primary">{tab.name}</h3>
                    {tab.count !== undefined && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-theme-muted text-theme-text-primary group-hover:bg-theme-elevated">
                        {tab.count}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-theme-text-secondary group-hover:text-theme-text-primary">{tab.description}</p>
                <div className="mt-4 flex items-center text-sm font-medium text-theme-text-primary group-hover:text-theme-text-primary">
                  Access →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-theme-surface rounded-lg border border-theme-border">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-theme-text-primary">Branch Management</h3>
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search branches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
                />
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-text-tertiary w-4 h-4" />
              </div>
              <select
                value={selectedContinent}
                onChange={(e) => setSelectedContinent(e.target.value)}
                className="px-3 py-2 border border-theme-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
              >
                <option value="all">All Continents</option>
                {continents.map(continent => (
                  <option key={continent} value={continent}>{continent}</option>
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
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-theme-muted border-b border-theme-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Branch</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Employees</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Manager</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-theme-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border">
                {filteredBranches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-theme-muted">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="text-sm font-medium text-theme-text-primary">{branch.name}</p>
                        <p className="text-xs text-theme-text-secondary">{branch.code}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-theme-text-tertiary" />
                        <div>
                          <p className="text-sm text-theme-text-primary">{branch.city}</p>
                          <p className="text-xs text-theme-text-secondary">{branch.country}</p>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-primary">
                      {branch.employees.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-primary">
                      {branch.manager}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-theme-text-primary">
                      {branch.currency} {(branch.revenue / 1000000).toFixed(1)}M
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-accent hover:text-blue-700">
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                        <button className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary">
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
        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Geographic Distribution</h3>
          <div className="space-y-4">
            {continents.map(continent => {
              const continentBranches = branches.filter(b => b.continent === continent);
              const continentEmployees = continentBranches.reduce((sum, b) => sum + b.employees, 0);
              const percentage = (continentEmployees / totalEmployees) * 100;
              
              return (
                <div key={continent} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-theme-text-tertiary" />
                    <div>
                      <p className="text-sm font-medium text-theme-text-primary">{continent}</p>
                      <p className="text-xs text-theme-text-secondary">{continentBranches.length} branches</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-theme-muted rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-theme-text-primary">{percentage.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-theme-surface rounded-lg border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentAudits.slice(0, 4).map((audit) => (
              <div key={audit.id} className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-theme-text-primary">{audit.action} on {audit.resource}</p>
                  <p className="text-xs text-theme-text-secondary">{audit.user} • {audit.timestamp ? new Date(audit.timestamp).toLocaleString() : '—'}</p>
                </div>
              </div>
            ))}
            {recentAudits.length === 0 && (
              <p className="text-sm text-theme-text-secondary">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
      {showAddBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddBranch(false); }}>
          <div className="w-full max-w-md rounded-xl bg-theme-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-theme-text-primary">Add Branch</h2>
              <button onClick={() => setShowAddBranch(false)} className="text-theme-text-tertiary hover:text-theme-text-secondary">
                <X className="w-5 h-5" />
              </button>
            </div>
            {addBranchError && (
              <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{addBranchError}</div>
            )}
            <form onSubmit={handleAddBranch} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">Branch Name</label>
                <input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary" placeholder="Branch name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">Branch Code</label>
                <input value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary" placeholder="e.g. NYC-01" />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">Manager</label>
                <input value={branchForm.manager} onChange={(e) => setBranchForm({ ...branchForm, manager: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary" placeholder="Manager name" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">City</label>
                <input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary" placeholder="City" />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">Country</label>
                <select value={branchForm.country} onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary">
                  <option value="">Select country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-theme-text-primary">Continent</label>
                <select value={branchForm.continent} onChange={(e) => setBranchForm({ ...branchForm, continent: e.target.value })} className="mt-1 w-full rounded-lg border border-theme-border px-3 py-2 text-sm text-theme-text-primary">
                  <option value="">Select continent</option>
                  <option value="Africa">Africa</option>
                  <option value="Asia">Asia</option>
                  <option value="Europe">Europe</option>
                  <option value="North America">North America</option>
                  <option value="South America">South America</option>
                  <option value="Oceania">Oceania</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddBranch(false)} className="rounded-lg border border-theme-border px-4 py-2 text-sm font-medium text-theme-text-primary hover:bg-theme-muted">Cancel</button>
                <button type="submit" disabled={addBranchLoading} className="rounded-lg bg-theme-accent px-4 py-2 text-sm font-medium text-white hover:bg-theme-accent-hover disabled:opacity-50">{addBranchLoading ? 'Creating...' : 'Add Branch'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
