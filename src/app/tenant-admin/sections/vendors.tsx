'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, Edit, Download, Filter, Building, FileText, Star, TrendingUp, RefreshCw } from 'lucide-react';

interface Vendors {
  tenantSlug: string;
}

const VendorsComponent: React.FC<Vendors> = ({ tenantSlug }) => {
  const [vendors, setVendors] = useState<any[]>([]);

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

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

  // Load vendors from API
  async function loadVendors() {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/vendors?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Failed to load vendors");
      const rawVendors = payload.vendors || [];
      // Map backend fields to frontend shape
      setVendors(rawVendors.map((v: any) => ({
        id: v.id,
        name: v.name || v.code || "Unknown",
        category: v.country || "Other",
        status: v.isActive === false ? "Inactive" : "Active",
        rating: 4.0,
        spend: "$0",
      })));
      setLastRefreshed(new Date());
    } catch (err) {
      console.error(err);
      setError("Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVendors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  // Refresh vendors data
  const handleRefreshVendors = async () => {
    await loadVendors();
    setSuccess("Vendors refreshed successfully");
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
          <h2 className="text-2xl font-bold text-[#F8FAFC] mb-2">Vendor Management</h2>
          <p className="text-[#94A3B8]">Manage vendor profiles, contracts, and performance tracking</p>
          {lastRefreshed && (
            <p className="text-xs text-[#64748B] mt-1">
              Last updated: {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <button
          onClick={handleRefreshVendors}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg text-[#F8FAFC] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#94A3B8]">Total Vendors</p>
              <p className="text-xl font-bold text-[#F8FAFC]">{vendors.length}</p>
            </div>
            <Building className="w-8 h-8 text-[#818CF8]" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#94A3B8]">Active Contracts</p>
              <p className="text-xl font-bold text-[#F8FAFC]">89</p>
            </div>
            <FileText className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#94A3B8]">Avg. Performance</p>
              <p className="text-xl font-bold text-[#F8FAFC]">4.2/5</p>
            </div>
            <Star className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-[#111827] rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#94A3B8]">This Month Spend</p>
              <p className="text-xl font-bold text-[#F8FAFC]">$45,678</p>
            </div>
            <TrendingUp className="w-8 h-8 text-[#818CF8]" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-[#111827] rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Vendor
          </button>
          <button className="px-4 py-2 border border-gray-300 text-[#F8FAFC] rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4 mr-2 inline" />
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#111827] rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-[#0B1120] px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-white">
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="bg-[#0B1120] px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg text-white">
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
            className="bg-[#0B1120] px-3 py-2 border border-[rgba(255,255,255,0.1)] rounded-lg flex-1 text-white"
          />
          <button className="px-4 py-2 bg-gray-100 text-[#F8FAFC] rounded-lg hover:bg-gray-200">
            <Filter className="w-4 h-4 mr-2 inline" />
            Filters
          </button>
        </div>
      </div>

      {/* Vendor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {filteredVendors.map((vendor, i) => (
          <div key={i} className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-[#94A3B8]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#F8FAFC]">{vendor.name}</h3>
                  <p className="text-sm text-[#94A3B8]">{vendor.category}</p>
                </div>
              </div>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                vendor.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-[#F8FAFC]'
              }`}>{vendor.status}</span>
            </div>
            
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Rating</span>
                <span className="font-semibold flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  {vendor.rating}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Total Spend</span>
                <span className="font-semibold">{vendor.spend}</span>
              </div>
            </div>
            
            <div className="flex gap-2 pt-3 border-t">
              <button className="flex-1 text-[#818CF8] hover:text-blue-800">
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

      {/* Performance Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Performance Distribution</h3>
          <div className="space-y-3">
            {[
              { level: 'Excellent', count: 45, pct: 27, color: 'bg-green-500' },
              { level: 'Good', count: 67, pct: 40, color: 'bg-blue-500' },
              { level: 'Average', count: 34, pct: 20, color: 'bg-yellow-500' },
              { level: 'Poor', count: 21, pct: 13, color: 'bg-red-500' }
            ].map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm font-medium w-20">{p.level}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${p.color}`} style={{ width: `${p.pct}%` }}></div>
                </div>
                <span className="text-sm w-8 text-right">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#111827] rounded-xl border border-[rgba(255,255,255,0.07)] p-6">
          <h3 className="text-lg font-semibold text-[#F8FAFC] mb-4">Top Vendors by Spend</h3>
          <div className="space-y-3">
            {[
              { name: 'Manufacturing Partners Inc', spend: '$234,567', pct: 35 },
              { name: 'Tech Solutions Inc', spend: '$125,000', pct: 19 },
              { name: 'Global Logistics Ltd', spend: '$89,234', pct: 13 }
            ].map((v, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium text-[#F8FAFC] text-sm">{v.name}</p>
                  <div className="flex-1 bg-gray-200 rounded-full h-2 mt-1">
                    <div className="h-2 rounded-full bg-blue-500" style={{ width: `${v.pct}%` }}></div>
                  </div>
                </div>
                <span className="font-semibold ml-3 text-sm">{v.spend}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default VendorsComponent;
