'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, LogOut, X, Eye, CheckSquare, Square, ChevronLeft, ChevronRight } from 'lucide-react';

interface Tenant {
  id: number;
  name: string;
  slug: string;
  seats: number;
  created_at: string;
}

interface License {
  id: number;
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  type: string;
  seats: number;
  expiry: string | null;
  created_at: string;
}

interface TenantAdmin {
  id: number;
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export default function SuperadminPage() {
    // Tenant status management
    const handleSuspendTenant = async (slug: string) => {
      if (!confirm('Suspend this tenant? Users will lose access to all services.')) return;
      
      setActionLoading(slug);
      setError(null);
      setSuccess(null);
      
      try {
        const response = await fetch(`/api/superadmin/tenants/${slug}/suspend`, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          setSuccess(`Tenant "${slug}" has been suspended successfully`);
          fetchTenants(); // Refresh the list
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to suspend tenant: ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to suspend tenant:', error);
        setError(error instanceof Error ? error.message : 'Failed to suspend tenant');
      } finally {
        setActionLoading(null);
      }
    };

    const handleActivateTenant = async (slug: string) => {
      if (!confirm('Activate this tenant? Users will regain access to all services.')) return;
      
      setActionLoading(slug);
      setError(null);
      setSuccess(null);
      
      try {
        const response = await fetch(`/api/superadmin/tenants/${slug}/activate`, { 
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const result = await response.json();
          setSuccess(`Tenant "${slug}" has been activated successfully`);
          fetchTenants(); // Refresh the list
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to activate tenant: ${response.status}`);
        }
      } catch (error) {
        console.error('Failed to activate tenant:', error);
        setError(error instanceof Error ? error.message : 'Failed to activate tenant');
      } finally {
        setActionLoading(null);
      }
    };
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [totalTenants, setTotalTenants] = useState(0);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [tenantAdmins, setTenantAdmins] = useState<TenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tenants' | 'licenses' | 'admins'>('tenants');
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantDetails, setTenantDetails] = useState<any>(null);
  const [tenantFormData, setTenantFormData] = useState({ name: '', slug: '', seats: 1 });
  const [licenseFormData, setLicenseFormData] = useState({ tenantSlug: '', type: 'basic', seats: 1, expiry: '' });
  const [adminFormData, setAdminFormData] = useState({ tenantSlug: '', email: '', name: '', role: 'admin' });
  
  // Pagination and bulk selection state
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const tenantsPerPage = 20;
  const router = useRouter();

  // Debounce search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (activeTab === 'tenants') {
        setCurrentPage(1); // Reset to first page on search
        fetchTenants(1, searchQuery);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, activeTab]);

  // Helper functions for bulk operations and pagination
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedTenants([]);
    } else {
      setSelectedTenants(getPaginatedTenants().map(t => t.slug));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectTenant = (slug: string) => {
    if (selectedTenants.includes(slug)) {
      setSelectedTenants(selectedTenants.filter(s => s !== slug));
    } else {
      setSelectedTenants([...selectedTenants, slug]);
    }
  };

  const handleBulkActivate = async () => {
    if (selectedTenants.length === 0) return;
    try {
      const res = await fetch('/api/superadmin/tenants/bulk-activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: selectedTenants }),
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(prev => prev.map(t => data.updated.includes(t.slug) ? { ...t, status: 'active' } : t));
        setSelectedTenants([]);
        setSelectAll(false);
      }
    } catch (error) {
      console.error('Bulk activate failed', error);
    }
  };

  const handleBulkSuspend = async () => {
    if (selectedTenants.length === 0) return;
    try {
      const res = await fetch('/api/superadmin/tenants/bulk-suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: selectedTenants }),
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(prev => prev.map(t => data.updated.includes(t.slug) ? { ...t, status: 'suspended' } : t));
        setSelectedTenants([]);
        setSelectAll(false);
      }
    } catch (error) {
      console.error('Bulk suspend failed', error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTenants.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedTenants.length} tenants?`)) return;
    try {
      const res = await fetch('/api/superadmin/tenants/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: selectedTenants }),
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(prev => prev.filter(t => !data.deleted.includes(t.slug)));
        setSelectedTenants([]);
        setSelectAll(false);
        fetchTenants(currentPage);
      }
    } catch (error) {
      console.error('Bulk delete failed', error);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const getPaginatedTenants = () => {
    // server returns the current page of tenants already
    return tenants;
  };
  const totalPages = Math.max(1, Math.ceil(totalTenants / tenantsPerPage));

  useEffect(() => {
    fetchTenants(currentPage);
    fetchLicenses();
    // tenant admins will be fetched after tenants load (see tenants effect)
  }, [currentPage]);

  const fetchTenants = async (page?: number, query?: string) => {
    const usePage = page || currentPage;
    const useQuery = query || searchQuery;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: usePage.toString(),
        limit: tenantsPerPage.toString(),
        ...(useQuery && { q: useQuery }),
      });
      const response = await fetch(`/api/superadmin/tenants?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTenants(data.items || []);
        setTotalTenants(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLicenses = async () => {
    try {
      const response = await fetch('/api/superadmin/licenses');
      if (response.ok) {
        const data = await response.json();
        setLicenses(data);
      }
    } catch (error) {
      console.error('Failed to fetch licenses:', error);
    }
  };

  const fetchTenantAdmins = async () => {
    try {
      // Fetch admins for the visible tenants in one call to avoid N+1
      const slugs = tenants.map(t => t.slug);
      const response = await fetch('/api/superadmin/tenants/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs }),
      });
      if (response.ok) {
        const admins = await response.json();
        setTenantAdmins(admins.map((a: any) => ({ ...a })));
      }
    } catch (error) {
      console.error('Failed to fetch tenant admins:', error);
    }
  };

  useEffect(() => {
    if (tenants.length > 0) {
      fetchTenantAdmins();
    }
  }, [tenants]);

  const handleViewDetails = async (tenant: Tenant | string) => {
    const slug = typeof tenant === 'string' ? tenant : tenant.slug;
    try {
      const response = await fetch(`/api/superadmin/tenants/${slug}`);
      if (response.ok) {
        const details = await response.json();
        setTenantDetails(details);
        if (typeof tenant === 'object') {
          setSelectedTenant(tenant);
        } else {
          // Find the tenant from the list
          const foundTenant = tenants.find(t => t.slug === slug);
          setSelectedTenant(foundTenant || null);
        }
        setShowDetailsModal(true);
      }
    } catch (error) {
      console.error('Failed to fetch tenant details:', error);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/superadmin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tenantFormData),
      });
      if (response.ok) {
        const newTenant = await response.json();
        setShowTenantModal(false);
        setTenantFormData({ name: '', slug: '', seats: 1 });
        // refresh page to include new tenant
        fetchTenants(currentPage);
      }
    } catch (error) {
      console.error('Failed to create tenant:', error);
    }
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/superadmin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(licenseFormData),
      });
      if (response.ok) {
        const newLicense = await response.json();
        setLicenses([...licenses, newLicense]);
        setShowLicenseModal(false);
        setLicenseFormData({ tenantSlug: '', type: 'basic', seats: 1, expiry: '' });
      }
    } catch (error) {
      console.error('Failed to create license:', error);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/superadmin/tenants/${adminFormData.tenantSlug}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminFormData.email,
          name: adminFormData.name,
          role: adminFormData.role,
        }),
      });
      if (response.ok) {
        const newAdmin = await response.json();
        const tenant = tenants.find(t => t.slug === adminFormData.tenantSlug);
        setTenantAdmins([...tenantAdmins, { ...newAdmin, tenant_name: tenant?.name || '', tenant_slug: adminFormData.tenantSlug }]);
        setShowAdminModal(false);
        setAdminFormData({ tenantSlug: '', email: '', name: '', role: 'admin' });
      }
    } catch (error) {
      console.error('Failed to create tenant admin:', error);
    }
  };

  const handleDeleteTenant = async (slug: string) => {
    if (!confirm(`Are you sure you want to delete tenant "${slug}"? This action cannot be undone and will delete all associated data.`)) return;

    setActionLoading(slug);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/superadmin/tenants/${slug}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setSuccess(`Tenant "${slug}" has been deleted successfully`);
        setSelectedTenants(selectedTenants.filter(s => s !== slug));
        // refresh the current page
        fetchTenants(currentPage);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to delete tenant: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to delete tenant:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete tenant');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteLicense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this license?')) return;

    try {
      const response = await fetch(`/api/superadmin/licenses/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setLicenses(licenses.filter(l => l.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete license:', error);
    }
  };

  const handleDeleteAdmin = async (tenantSlug: string, id: number) => {
    if (!confirm('Are you sure you want to delete this tenant admin?')) return;

    try {
      const response = await fetch(`/api/superadmin/tenants/${tenantSlug}/admins/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setTenantAdmins(tenantAdmins.filter(a => a.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete tenant admin:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/superadmin/auth/logout', { method: 'POST' });
      router.push('/superadmin/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-200 text-lg font-semibold text-blue-700">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Syspro Logo" className="w-8 h-8" />
              <h1 className="text-2xl font-bold text-gray-900">Superadmin Portal</h1>
            </div>
            {activeTab === 'tenants' && (
              <input
                type="text"
                placeholder="Search tenants by name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <div className="flex items-center gap-3">
              {activeTab === 'tenants' && (
                <Button onClick={() => setShowTenantModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
                  <Plus className="w-4 h-4 mr-2" /> Add Tenant
                </Button>
              )}
              {activeTab === 'licenses' && (
                <Button onClick={() => setShowLicenseModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
                  <Plus className="w-4 h-4 mr-2" /> Add License
                </Button>
              )}
              {activeTab === 'admins' && (
                <Button onClick={() => setShowAdminModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
                  <Plus className="w-4 h-4 mr-2" /> Add Admin
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout} className="border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      
      {success && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`px-4 py-2 rounded-md font-medium transition ${
                activeTab === 'tenants' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tenants
            </button>
            <button
              onClick={() => setActiveTab('licenses')}
              className={`px-4 py-2 rounded-md font-medium transition ${
                activeTab === 'licenses' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Licenses
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`px-4 py-2 rounded-md font-medium transition ${
                activeTab === 'admins' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Admins
            </button>
          </div>
        </div>

        {activeTab === 'tenants' && (
      <div>
        {/* Bulk Actions Bar */}
        {selectedTenants.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-blue-900">
                {selectedTenants.length} tenant{selectedTenants.length !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleBulkActivate}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                >
                  Activate
                </button>
                <button
                  onClick={handleBulkSuspend}
                  className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors"
                >
                  Suspend
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedTenants([]);
                setSelectAll(false);
              }}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Tenant Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center justify-center"
                  >
                    {selectAll ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getPaginatedTenants().map((tenant: any, index: number) => {
                const globalIndex = (currentPage - 1) * tenantsPerPage + index + 1;
                const isSelected = selectedTenants.includes(tenant.slug);
                return (
                  <tr key={tenant.id} className={isSelected ? 'bg-blue-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {globalIndex}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleSelectTenant(tenant.slug)}
                        className="flex items-center justify-center"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tenant.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tenant.slug}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {tenant.seats}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(tenant)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSuspendTenant(tenant.slug)}
                          disabled={actionLoading === tenant.slug}
                          className="disabled:opacity-50"
                        >
                          {actionLoading === tenant.slug ? (
                            <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <X className="w-4 h-4 text-orange-600" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleActivateTenant(tenant.slug)}
                          disabled={actionLoading === tenant.slug}
                          className="disabled:opacity-50"
                        >
                          {actionLoading === tenant.slug ? (
                            <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Eye className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteTenant(tenant.slug)}
                          disabled={actionLoading === tenant.slug}
                          className="disabled:opacity-50"
                        >
                          {actionLoading === tenant.slug ? (
                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Trash2 className="w-4 h-4 text-red-600" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow px-4 py-3 mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {((currentPage - 1) * tenantsPerPage) + 1} to{' '}
              {Math.min(currentPage * tenantsPerPage, totalTenants)} of {totalTenants} tenants
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 rounded-lg text-sm ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    )}

    {activeTab === 'licenses' && (
        <div className="bg-white rounded-lg shadow">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiry
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {licenses.map((license) => (
                <tr key={license.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {license.tenant_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {license.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {license.seats}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {license.expiry ? new Date(license.expiry).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(license.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(license.tenant_slug)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteLicense(license.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'admins' && (
        <div className="bg-white rounded-lg shadow">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenantAdmins.map((admin) => (
                <tr key={admin.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {admin.tenant_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {admin.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {admin.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {admin.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(admin.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAdmin(admin.tenant_slug, admin.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDetailsModal && tenantDetails && selectedTenant && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Tenant Details: {selectedTenant.name}</h2>
              <Button variant="ghost" onClick={() => setShowDetailsModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Basic Information</h3>
                <p><strong>Name:</strong> {tenantDetails.name}</p>
                <p><strong>Slug:</strong> {tenantDetails.slug}</p>
                <p><strong>Seats:</strong> {tenantDetails.seats}</p>
                <p><strong>Created:</strong> {new Date(tenantDetails.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Statistics</h3>
                <p><strong>Licenses:</strong> {tenantDetails.licenses?.length || 0}</p>
                <p><strong>Admins:</strong> {tenantDetails.admins?.length || 0}</p>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Licenses</h3>
              {tenantDetails.licenses?.length > 0 ? (
                <table className="w-full border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Seats</th>
                      <th className="px-4 py-2 text-left">Expiry</th>
                      <th className="px-4 py-2 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantDetails.licenses.map((license: any) => (
                      <tr key={license.id}>
                        <td className="px-4 py-2">{license.type}</td>
                        <td className="px-4 py-2">{license.seats}</td>
                        <td className="px-4 py-2">{license.expiry ? new Date(license.expiry).toLocaleDateString() : 'Never'}</td>
                        <td className="px-4 py-2">{new Date(license.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No licenses found.</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Tenant Admins</h3>
              {tenantDetails.admins?.length > 0 ? (
                <table className="w-full border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Role</th>
                      <th className="px-4 py-2 text-left">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantDetails.admins.map((admin: any) => (
                      <tr key={admin.id}>
                        <td className="px-4 py-2">{admin.name}</td>
                        <td className="px-4 py-2">{admin.email}</td>
                        <td className="px-4 py-2">{admin.role}</td>
                        <td className="px-4 py-2">{new Date(admin.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No admins found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showTenantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add Tenant</h2>
              <Button variant="ghost" onClick={() => setShowTenantModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleCreateTenant}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Name</label>
                <input
                  type="text"
                  value={tenantFormData.name}
                  onChange={(e) => setTenantFormData({ ...tenantFormData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Slug</label>
                <input
                  type="text"
                  value={tenantFormData.slug}
                  onChange={(e) => setTenantFormData({ ...tenantFormData, slug: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Seats</label>
                <input
                  type="number"
                  value={tenantFormData.seats}
                  onChange={(e) => setTenantFormData({ ...tenantFormData, seats: parseInt(e.target.value) || 1 })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  min="1"
                  required
                />
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setShowTenantModal(false)} className="mr-2">
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLicenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add License</h2>
              <Button variant="ghost" onClick={() => setShowLicenseModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleCreateLicense}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Tenant Slug</label>
                <select
                  value={licenseFormData.tenantSlug}
                  onChange={(e) => setLicenseFormData({ ...licenseFormData, tenantSlug: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  required
                >
                  <option value="">Select tenant</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.slug}>
                      {tenant.name} ({tenant.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Type</label>
                <select
                  value={licenseFormData.type}
                  onChange={(e) => setLicenseFormData({ ...licenseFormData, type: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  required
                >
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Seats</label>
                <input
                  type="number"
                  value={licenseFormData.seats}
                  onChange={(e) => setLicenseFormData({ ...licenseFormData, seats: parseInt(e.target.value) || 1 })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  min="1"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Expiry Date (optional)</label>
                <input
                  type="date"
                  value={licenseFormData.expiry}
                  onChange={(e) => setLicenseFormData({ ...licenseFormData, expiry: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                />
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setShowLicenseModal(false)} className="mr-2">
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdminModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Add Tenant Admin</h2>
              <Button variant="ghost" onClick={() => setShowAdminModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Tenant Slug</label>
                <select
                  value={adminFormData.tenantSlug}
                  onChange={(e) => setAdminFormData({ ...adminFormData, tenantSlug: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  required
                >
                  <option value="">Select tenant</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.slug}>
                      {tenant.name} ({tenant.slug})
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Name</label>
                <input
                  type="text"
                  value={adminFormData.name}
                  onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Email</label>
                <input
                  type="email"
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-black">Role</label>
                <select
                  value={adminFormData.role}
                  onChange={(e) => setAdminFormData({ ...adminFormData, role: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                  required
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="user">User</option>
                </select>
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setShowAdminModal(false)} className="mr-2">
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDetailsModal && tenantDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Tenant Details: {tenantDetails.name}</h2>
              <Button variant="ghost" onClick={() => setShowDetailsModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                <div className="space-y-2">
                  <p><strong>Name:</strong> {tenantDetails.name}</p>
                  <p><strong>Slug:</strong> {tenantDetails.slug}</p>
                  <p><strong>Seats:</strong> {tenantDetails.seats}</p>
                  <p><strong>Created:</strong> {new Date(tenantDetails.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Licenses ({tenantDetails.licenses?.length || 0})</h3>
                {tenantDetails.licenses?.length > 0 ? (
                  <div className="space-y-2">
                    {tenantDetails.licenses.map((license: any) => (
                      <div key={license.id} className="border rounded p-3">
                        <p><strong>Type:</strong> {license.type}</p>
                        <p><strong>Seats:</strong> {license.seats}</p>
                        <p><strong>Expiry:</strong> {license.expiry ? new Date(license.expiry).toLocaleDateString() : 'Never'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No licenses assigned</p>
                )}
              </div>

              <div className="md:col-span-2">
                <h3 className="text-lg font-semibold mb-4">Tenant Admins ({tenantDetails.admins?.length || 0})</h3>
                {tenantDetails.admins?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tenantDetails.admins.map((admin: any) => (
                          <tr key={admin.id}>
                            <td className="px-4 py-2 text-sm">{admin.name}</td>
                            <td className="px-4 py-2 text-sm">{admin.email}</td>
                            <td className="px-4 py-2 text-sm">{admin.role}</td>
                            <td className="px-4 py-2 text-sm">{new Date(admin.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500">No admins assigned</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
