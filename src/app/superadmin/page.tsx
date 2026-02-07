'use client';

import { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { TrendingUp, Users, DollarSign, Zap, AlertCircle, Check, Search, Download, PlusCircle, Eye, Edit, Trash2, Loader2, ArrowRight, X } from 'lucide-react';

interface Tenant {
  slug: string;
  name: string;
  region: string;
  status: string;
  ledger: string;
  seats: number;
  persisted: boolean;
  email?: string;
  plan?: 'starter' | 'professional' | 'enterprise';
  health?: 'healthy' | 'warning' | 'critical';
}

interface TenantFormState {
  companyName: string;
  companySlug: string;
  region: string;
  industry: string;
  seats: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  confirmPassword: string;
  adminNotes: string;
}

const REGION_OPTIONS = [
  "North America",
  "South America",
  "Europe",
  "Middle East",
  "Africa",
  "Asia-Pacific",
  "Australia & New Zealand",
] as const;

const INITIAL_TENANT_FORM: TenantFormState = {
  companyName: "",
  companySlug: "",
  region: "",
  industry: "",
  seats: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  confirmPassword: "",
  adminNotes: "",
};

const MOCK_METRICS = {
  totalTenants: '12',
  monthlyRevenue: '$65,000',
  totalUsers: '1,619',
  activeTrials: '2',
  tenantChange: '+2 vs last month',
  revenueChange: '+5.2% vs last month',
  userChange: '+12.3% vs last month',
  trialChange: '+1 vs last month',
};

const HEALTH_STATUS = [
  { label: 'Healthy', value: 9, color: 'bg-green-500' },
  { label: 'Warning', value: 2, color: 'bg-yellow-500' },
  { label: 'Critical', value: 1, color: 'bg-red-500' }
];

export default function SuperadminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [formState, setFormState] = useState<TenantFormState>(INITIAL_TENANT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Load tenants
  useEffect(() => {
    let isCancelled = false;

    async function loadTenants() {
      try {
        const response = await fetch("/api/tenants", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (isCancelled || !Array.isArray(data?.tenants)) {
          return;
        }

        setTenants(data.tenants);
      } catch (error) {
        console.error("Failed to load tenants", error);
      }
    }

    loadTenants();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Map tenants to include mock data
  const enrichedTenants = useMemo(() => {
    return tenants.map((t, idx) => ({
      ...t,
      email: `admin@${t.slug}.com`,
      plan: (
        idx % 3 === 0 ? 'enterprise' :
        idx % 3 === 1 ? 'professional' :
        'starter'
      ) as 'starter' | 'professional' | 'enterprise',
      health: (
        t.status === 'active' ? (idx % 7 === 0 ? 'warning' : idx % 13 === 0 ? 'critical' : 'healthy') :
        'healthy'
      ) as 'healthy' | 'warning' | 'critical',
    }));
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    return enrichedTenants.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                           (t.email?.toLowerCase().includes(search.toLowerCase()) ?? false);
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      const matchesPlan = planFilter === 'all' || t.plan === planFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [enrichedTenants, search, statusFilter, planFilter]);

  function handleOpenTenantModal() {
    setFormError(null);
    setFormSuccess(null);
    setShowTenantModal(true);
  }

  function handleCloseTenantModal() {
    setShowTenantModal(false);
    setFormState(INITIAL_TENANT_FORM);
    setFormError(null);
  }

  function handleFieldChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.currentTarget;
    setFormState(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmitTenant(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: formState.companyName,
          companySlug: formState.companySlug,
          region: formState.region,
          industry: formState.industry,
          seats: formState.seats ? Number(formState.seats) : null,
          adminName: formState.adminName,
          adminEmail: formState.adminEmail,
          adminPassword: formState.adminPassword,
          adminNotes: formState.adminNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to create tenant");
      }

      setTenants(prev => [data.tenantSummary, ...prev.filter(t => t.slug !== data.tenantSummary.slug)]);
      setFormState(INITIAL_TENANT_FORM);
      setShowTenantModal(false);
      setFormSuccess(`Tenant ${data.tenantSummary.name} created successfully.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create tenant";
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthIcon = (health: string) => {
    switch(health) {
      case 'healthy': return <Check className="w-5 h-5 text-green-600" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      case 'critical': return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="mt-2 text-gray-600">Monitor and manage all Syspro tenants</p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {formSuccess && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {formSuccess}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                <div className="mt-3">
                  <p className="text-3xl font-bold text-gray-900">{MOCK_METRICS.totalTenants}</p>
                  <p className="mt-2 text-sm text-gray-500">{MOCK_METRICS.tenantChange}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Monthly Revenue</p>
                <div className="mt-3">
                  <p className="text-3xl font-bold text-gray-900">{MOCK_METRICS.monthlyRevenue}</p>
                  <p className="mt-2 text-sm text-green-600">{MOCK_METRICS.revenueChange}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <div className="mt-3">
                  <p className="text-3xl font-bold text-gray-900">{MOCK_METRICS.totalUsers}</p>
                  <p className="mt-2 text-sm text-gray-500">{MOCK_METRICS.userChange}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Active Trials</p>
                <div className="mt-3">
                  <p className="text-3xl font-bold text-gray-900">{MOCK_METRICS.activeTrials}</p>
                  <p className="mt-2 text-sm text-gray-500">{MOCK_METRICS.trialChange}</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <Zap className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Health Status Row */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          {HEALTH_STATUS.map((status) => (
            <div key={status.label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{status.label}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{status.value}</p>
                  <p className="text-xs text-gray-500 mt-1">No issues detected</p>
                </div>
                <div className={`w-12 h-12 rounded-lg ${status.color} opacity-20`} />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Revenue Growth</h3>
            <div className="space-y-4">
              {['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((month, idx) => {
                const heights = [40, 50, 58, 65, 72, 78, 82];
                return (
                  <div key={month} className="flex items-end gap-2">
                    <span className="w-10 text-xs font-medium text-gray-600">{month}</span>
                    <div className="flex-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded" style={{height: `${heights[idx]}%`, minHeight: '24px'}}></div>
                    <span className="text-xs text-gray-600">$50K+</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Tenant Growth</h3>
            <div className="space-y-4">
              {['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'].map((month, idx) => {
                const heights = [6, 7, 8, 9, 10, 11, 12];
                return (
                  <div key={month} className="flex items-end gap-2">
                    <span className="w-10 text-xs font-medium text-gray-600">{month}</span>
                    <div className="flex-1 bg-gradient-to-r from-purple-400 to-purple-600 rounded" style={{height: `${heights[idx] * 10}%`, minHeight: '28px'}}></div>
                    <span className="text-xs text-gray-600">{heights[idx]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tenant Management */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tenant Management</h2>
                <p className="text-sm text-gray-600 mt-1">Manage all tenant accounts and subscriptions</p>
              </div>
              <button
                onClick={handleOpenTenantModal}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <PlusCircle className="w-4 h-4" />
                Add Tenant
              </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by company name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
              </select>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Plans</option>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Tenant</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Health</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.map((tenant, idx) => (
                  <tr key={tenant.slug} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{tenant.name}</p>
                        <p className="text-sm text-gray-600">{tenant.email || `admin@${tenant.slug}.com`}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(tenant.status)}`}>
                        {tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900 capitalize">{tenant.plan}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{tenant.seats} seats</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getHealthIcon(tenant.health!)}
                        <span className="text-sm capitalize text-gray-700">{tenant.health}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-gray-200 rounded transition-colors" title="View">
                          <Eye className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-2 hover:bg-gray-200 rounded transition-colors" title="Edit">
                          <Edit className="w-4 h-4 text-gray-600" />
                        </button>
                        <button className="p-2 hover:bg-gray-200 rounded transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">Showing {filteredTenants.length} of {enrichedTenants.length} tenants</p>
          </div>
        </div>
      </main>

      {/* Add Tenant Modal */}
      {showTenantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Tenant</h2>
              <button onClick={handleCloseTenantModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitTenant} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Name *</label>
                  <input
                    type="text"
                    name="companyName"
                    value={formState.companyName}
                    onChange={handleFieldChange}
                    placeholder="Acme Corp"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Slug *</label>
                  <input
                    type="text"
                    name="companySlug"
                    value={formState.companySlug}
                    onChange={handleFieldChange}
                    placeholder="acme-corp"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Region *</label>
                  <select
                    name="region"
                    value={formState.region}
                    onChange={handleFieldChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  >
                    <option value="">Select region</option>
                    {REGION_OPTIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
                  <input
                    type="text"
                    name="industry"
                    value={formState.industry}
                    onChange={handleFieldChange}
                    placeholder="Manufacturing"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Name *</label>
                  <input
                    type="text"
                    name="adminName"
                    value={formState.adminName}
                    onChange={handleFieldChange}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Email *</label>
                  <input
                    type="email"
                    name="adminEmail"
                    value={formState.adminEmail}
                    onChange={handleFieldChange}
                    placeholder="john@acme.com"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                  <input
                    type="password"
                    name="adminPassword"
                    value={formState.adminPassword}
                    onChange={handleFieldChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formState.confirmPassword}
                    onChange={handleFieldChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseTenantModal}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Deploy Tenant
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
