'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Panel, PillButton } from '@/components/ui/primitives';
import { Plus, Edit, Trash2, LogOut, X, Eye } from 'lucide-react';

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
      if (!confirm('Suspend this tenant?')) return;
      try {
        const response = await fetch(`/api/superadmin/tenants/${slug}/suspend`, { method: 'POST' });
        if (response.ok) {
          fetchTenants();
        }
      } catch (error) {
        console.error('Failed to suspend tenant:', error);
      }
    };

    const handleActivateTenant = async (slug: string) => {
      if (!confirm('Activate this tenant?')) return;
      try {
        const response = await fetch(`/api/superadmin/tenants/${slug}/activate`, { method: 'POST' });
        if (response.ok) {
          fetchTenants();
        }
      } catch (error) {
        console.error('Failed to activate tenant:', error);
      }
    };
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [tenantAdmins, setTenantAdmins] = useState<TenantAdmin[]>([]);
  const [loading, setLoading] = useState(true);
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
  const router = useRouter();

  useEffect(() => {
    fetchTenants();
    fetchLicenses();
    fetchTenantAdmins();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/superadmin/tenants');
      if (response.ok) {
        const data = await response.json();
        setTenants(data);
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
      const allAdmins: TenantAdmin[] = [];
      for (const tenant of tenants) {
        const response = await fetch(`/api/superadmin/tenants/${tenant.slug}/admins`);
        if (response.ok) {
          const admins = await response.json();
          allAdmins.push(...admins.map((admin: any) => ({ ...admin, tenant_name: tenant.name, tenant_slug: tenant.slug })));
        }
      }
      setTenantAdmins(allAdmins);
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
        setTenants([...tenants, newTenant]);
        setShowTenantModal(false);
        setTenantFormData({ name: '', slug: '', seats: 1 });
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
    if (!confirm('Are you sure you want to delete this tenant?')) return;

    try {
      const response = await fetch(`/api/superadmin/tenants/${slug}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setTenants(tenants.filter(t => t.slug !== slug));
      }
    } catch (error) {
      console.error('Failed to delete tenant:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-200 text-lg font-semibold text-blue-700">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-white to-blue-200">
      <Panel className="p-10 max-w-5xl w-full">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Syspro Logo" className="w-12 h-12" />
            <h1 className="text-3xl font-bold text-blue-700">Superadmin Portal</h1>
          </div>
          <div className="flex gap-4">
            {activeTab === 'tenants' && (
              <Button onClick={() => setShowTenantModal(true)} className="btn btn-blue px-6 py-3 rounded-lg font-semibold text-lg transition">
                <Plus className="w-5 h-5 mr-2" /> Add Tenant
              </Button>
            )}
            {activeTab === 'licenses' && (
              <Button onClick={() => setShowLicenseModal(true)} className="btn btn-blue px-6 py-3 rounded-lg font-semibold text-lg transition">
                <Plus className="w-5 h-5 mr-2" /> Add License
              </Button>
            )}
            {activeTab === 'admins' && (
              <Button onClick={() => setShowAdminModal(true)} className="btn btn-blue px-6 py-3 rounded-lg font-semibold text-lg transition">
                <Plus className="w-5 h-5 mr-2" /> Add Admin
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout} className="btn btn-ghost px-6 py-3 rounded-lg font-semibold text-lg border border-[color:var(--accent)] text-[color:var(--accent)] transition">
              <LogOut className="w-5 h-5 mr-2" /> Logout
            </Button>
          </div>
        </div>

        <div className="mb-8">
          <div role="tablist" className="flex space-x-4" aria-label="Superadmin tabs">
            <PillButton variant={activeTab === 'tenants' ? 'primary' : 'secondary'} onClick={() => setActiveTab('tenants')} aria-pressed={activeTab === 'tenants'}>Tenants</PillButton>
            <PillButton variant={activeTab === 'licenses' ? 'primary' : 'secondary'} onClick={() => setActiveTab('licenses')} aria-pressed={activeTab === 'licenses'}>Licenses</PillButton>
            <PillButton variant={activeTab === 'admins' ? 'primary' : 'secondary'} onClick={() => setActiveTab('admins')} aria-pressed={activeTab === 'admins'}>Tenant Admins</PillButton>
          </div>
        </div>

      {activeTab === 'tenants' && (
        <Panel className="p-0 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
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
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(tenant)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleSuspendTenant(tenant.slug)}>
                      <X className="w-4 h-4 text-orange-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleActivateTenant(tenant.slug)}>
                      <Eye className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteTenant(tenant.slug)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {activeTab === 'licenses' && (
        <Panel className="p-0 overflow-auto">
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
        </Panel>
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
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={tenantFormData.name}
                  onChange={(e) => setTenantFormData({ ...tenantFormData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Slug</label>
                <input
                  type="text"
                  value={tenantFormData.slug}
                  onChange={(e) => setTenantFormData({ ...tenantFormData, slug: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Seats</label>
                <input
                  type="number"
                  value={tenantFormData.seats}
                  onChange={(e) => setTenantFormData({ ...tenantFormData, seats: parseInt(e.target.value) || 1 })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
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
                <label className="block text-sm font-medium text-gray-700">Tenant Slug</label>
                <select
                  value={licenseFormData.tenantSlug}
                  onChange={(e) => setLicenseFormData({ ...licenseFormData, tenantSlug: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
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
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={licenseFormData.type}
                  onChange={(e) => setLicenseFormData({ ...licenseFormData, type: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                >
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Seats</label>
                <input
                  type="number"
                  value={licenseFormData.seats}
                  onChange={(e) => setLicenseFormData({ ...licenseFormData, seats: parseInt(e.target.value) || 1 })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  min="1"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Expiry Date (optional)</label>
                <input
                  type="date"
                  value={licenseFormData.expiry}
                  onChange={(e) => setLicenseFormData({ ...licenseFormData, expiry: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
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
                <label className="block text-sm font-medium text-gray-700">Tenant Slug</label>
                <select
                  value={adminFormData.tenantSlug}
                  onChange={(e) => setAdminFormData({ ...adminFormData, tenantSlug: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
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
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={adminFormData.name}
                  onChange={(e) => setAdminFormData({ ...adminFormData, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <select
                  value={adminFormData.role}
                  onChange={(e) => setAdminFormData({ ...adminFormData, role: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
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
      </Panel>
    </div>
  );
}