'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Edit, Download, Filter, Building, FileText, Star, TrendingUp, RefreshCw, X } from 'lucide-react';

interface Vendors {
  tenantSlug: string;
}

const VendorsComponent: React.FC<Vendors> = ({ tenantSlug }) => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [stats, setStats] = useState<{ totalVendors: number; activeVendors: number; byPaymentTerms: Record<string, number>; byCountry: Record<string, number> } | null>(null);

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', code: '', email: '', phone: '', country: '', paymentTerms: 'net30' });
  const [creating, setCreating] = useState(false);

  // Initialize last refreshed on mount
  useEffect(() => {
    setLastRefreshed(new Date());
  }, []);

  // Auto-dismiss alerts after 3.5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Load vendors and stats from API
  const loadVendors = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const [vendRes, statsRes] = await Promise.all([
        fetch(`/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}`).then(r => r.json()).catch(() => ({})),
        fetch(`/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}&stats=true`).then(r => r.json()).catch(() => ({})),
      ]);
      const rawVendors = vendRes.vendors || [];
      setVendors(rawVendors.map((v: any) => ({
        id: v.id,
        name: v.name || v.code || "Unknown",
        category: v.country || "Other",
        status: v.isActive === false ? "Inactive" : "Active",
        rating: v.rating ?? 0,
        spend: v.totalSpend ?? 0,
        email: v.email || '',
        phone: v.phone || '',
        paymentTerms: v.paymentTerms || '',
      })));
      if (statsRes.stats) setStats(statsRes.stats);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
      setError("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  // Refresh vendors data
  const handleRefreshVendors = async () => {
    await loadVendors();
    setSuccess("Vendors refreshed successfully");
  };

  // Create vendor
  const handleCreateVendor = async () => {
    if (!newVendor.name || !newVendor.code) {
      setError('Vendor name and code are required');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVendor),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create vendor');
      setSuccess('Vendor created successfully');
      setShowAddModal(false);
      setNewVendor({ name: '', code: '', email: '', phone: '', country: '', paymentTerms: 'net30' });
      await loadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vendor');
    } finally {
      setCreating(false);
    }
  };

  // Export vendors as CSV
  const handleExport = () => {
    const headers = ['Name', 'Code', 'Email', 'Phone', 'Country', 'Payment Terms', 'Status'];
    const rows = filteredVendors.map(v => [v.name, v.code || '', v.email || '', v.phone || '', v.category, v.paymentTerms || '', v.status]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vendors.csv';
    a.click();
    URL.revokeObjectURL(url);
    setSuccess('Vendors exported successfully');
  };

  const filteredVendors = vendors.filter(v => {
    if (categoryFilter !== 'All' && v.category !== categoryFilter) return false;
    if (statusFilter !== 'All' && v.status !== statusFilter) return false;
    if (searchQuery && !v.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-700 text-sm mb-6">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-700 text-sm mb-6">
          {success}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-theme-text-primary mb-2">Vendor Management</h2>
          <p className="text-theme-text-secondary">Manage vendor profiles, contracts, and performance tracking</p>
          {lastRefreshed && (
            <p className="text-xs text-theme-text-tertiary mt-1">
              Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={handleRefreshVendors}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-theme-text-primary hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-theme-muted rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Total Vendors</p>
              <p className="text-xl font-bold text-theme-text-primary">{stats?.totalVendors ?? vendors.length}</p>
            </div>
            <Building className="w-8 h-8 text-theme-accent" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Active Vendors</p>
              <p className="text-xl font-bold text-theme-text-primary">{stats?.activeVendors ?? vendors.filter(v => v.status === 'Active').length}</p>
            </div>
            <FileText className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Countries</p>
              <p className="text-xl font-bold text-theme-text-primary">{stats ? Object.keys(stats.byCountry).length : 0}</p>
            </div>
            <Star className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-theme-muted rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-theme-text-secondary">Payment Terms</p>
              <p className="text-xl font-bold text-theme-text-primary">{stats ? Object.keys(stats.byPaymentTerms).length : 0}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-theme-accent" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-theme-muted rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Vendor
          </button>
          <button onClick={handleExport} className="px-4 py-2 border border-gray-300 text-theme-text-primary rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2 inline" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-theme-muted rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-theme-bg px-3 py-2 border border-theme-border rounded-lg text-white">
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-theme-bg px-3 py-2 border border-theme-border rounded-lg text-white">
            <option value="All">All Categories</option>
            <option value="Technology">Technology</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Logistics">Logistics</option>
          </select>
          <input 
            type="text" 
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-theme-bg px-3 py-2 border border-theme-border rounded-lg flex-1 text-white"
          />
          <button className="px-4 py-2 bg-gray-100 text-theme-text-primary rounded-lg hover:bg-gray-200">
            <Filter className="w-4 h-4 mr-2 inline" />
            Filters
          </button>
        </div>
      </div>

      {/* Vendor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredVendors.map((vendor, i) => (
          <div key={i} className="bg-theme-muted rounded-xl border border-theme-border p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-theme-text-secondary" />
                </div>
                <div>
                  <h3 className="font-semibold text-theme-text-primary">{vendor.name}</h3>
                  <p className="text-sm text-theme-text-secondary">{vendor.category}</p>
                </div>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                vendor.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-theme-text-primary'
              }`}>{vendor.status}</span>
            </div>
            
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-theme-text-secondary">Rating</span>
                <span className="font-semibold flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  {vendor.rating}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-theme-text-secondary">Total Spend</span>
                <span className="font-semibold">{vendor.spend}</span>
              </div>
            </div>
            
            <div className="flex gap-2 pt-3 border-t">
              <button className="flex-1 text-theme-accent hover:text-blue-800">
                <Eye className="w-4 h-4 inline mr-2" />
                View
              </button>
              <button className="flex-1 text-green-400 hover:text-green-800">
                <Edit className="w-4 h-4 inline mr-2" />
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Vendor Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">By Country</h3>
          <div className="space-y-3">
            {stats && Object.entries(stats.byCountry).length > 0 ? (
              Object.entries(stats.byCountry).map(([country, count]) => {
                const pct = stats.totalVendors > 0 ? Math.round((count / stats.totalVendors) * 100) : 0;
                return (
                  <div key={country} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-24 truncate">{country}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="text-sm w-8 text-right">{count}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-theme-text-secondary">No data available</p>
            )}
          </div>
        </div>

        <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
          <h3 className="text-lg font-semibold text-theme-text-primary mb-4">By Payment Terms</h3>
          <div className="space-y-3">
            {stats && Object.entries(stats.byPaymentTerms).length > 0 ? (
              Object.entries(stats.byPaymentTerms).map(([terms, count]) => {
                const pct = stats.totalVendors > 0 ? Math.round((count / stats.totalVendors) * 100) : 0;
                return (
                  <div key={terms} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-24 uppercase">{terms}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="h-2 rounded-full bg-green-500" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="text-sm w-8 text-right">{count}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-theme-text-secondary">No data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Add Vendor Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Vendor</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Vendor name *"
                value={newVendor.name}
                onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
              <input
                type="text"
                placeholder="Vendor code *"
                value={newVendor.code}
                onChange={(e) => setNewVendor({ ...newVendor, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
              <input
                type="email"
                placeholder="Email"
                value={newVendor.email}
                onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
              <input
                type="text"
                placeholder="Phone"
                value={newVendor.phone}
                onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
              <input
                type="text"
                placeholder="Country"
                value={newVendor.country}
                onChange={(e) => setNewVendor({ ...newVendor, country: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
              <select
                value={newVendor.paymentTerms}
                onChange={(e) => setNewVendor({ ...newVendor, paymentTerms: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
              >
                <option value="net30">Net 30</option>
                <option value="net60">Net 60</option>
                <option value="net90">Net 90</option>
                <option value="immediate">Immediate</option>
                <option value="cod">COD</option>
              </select>
              <button
                onClick={handleCreateVendor}
                disabled={creating}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default VendorsComponent;
