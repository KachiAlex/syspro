"use client";

import React, { useEffect, useState } from "react";
import { Plus, AlertCircle, Eye, Edit2, Trash2, Filter, CheckCircle } from "lucide-react";
import {
  CreateCampaignModal,
  EditCampaignModal,
  ViewCampaignModal,
  DeleteConfirmModal,
  CampaignFormData,
} from "./campaign-modals";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  budget: number;
  actualSpend: number;
  revenue: number;
  roi: number;
  startDate: string;
  endDate?: string;
}

export default function CampaignsTab({
  tenantSlug,
  onError,
  autoOpenCreate,
  onAutoOpenCleared,
}: {
  tenantSlug: string;
  onError: (error: string) => void;
  autoOpenCreate?: boolean;
  onAutoOpenCleared?: () => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        setLoading(true);
        const res = await fetch(`/api/revops/campaigns?tenantSlug=${encodeURIComponent(tenantSlug)}`);
        
        if (res.ok) {
          const data = await res.json();
          const campaignList = Array.isArray(data.data) ? data.data : [];
          setCampaigns(campaignList);
          onError("");
        } else {
          throw new Error("Failed to fetch campaigns");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load campaigns";
        onError(message);
        // Show demo data
        setCampaigns([
          {
            id: "1",
            name: "Q1 Enterprise Push",
            channel: "email",
            status: "active",
            budget: 50000,
            actualSpend: 42000,
            revenue: 120000,
            roi: 2.86,
            startDate: "2026-01-01",
            endDate: "2026-03-31",
          },
          {
            id: "2",
            name: "Summer Marketing",
            channel: "paid_search",
            status: "active",
            budget: 35000,
            actualSpend: 31000,
            revenue: 95000,
            roi: 3.06,
            startDate: "2026-06-01",
            endDate: "2026-08-31",
          },
          {
            id: "3",
            name: "Partner Co-marketing",
            channel: "partnerships",
            status: "planning",
            budget: 25000,
            actualSpend: 0,
            revenue: 0,
            roi: 0,
            startDate: "2026-04-15",
            endDate: "2026-06-15",
          },
        ]);
      } finally {
        setLoading(false);
      }
    }

    loadCampaigns();
  }, [tenantSlug, onError]);

  // Handle auto-open from Overview tab
  useEffect(() => {
    if (autoOpenCreate) {
      setShowCreateModal(true);
      onAutoOpenCleared?.();
    }
  }, [autoOpenCreate, onAutoOpenCleared]);

  // CRUD Handlers
  const handleCreateCampaign = async (data: CampaignFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/revops/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tenantSlug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to create campaign');
      setCampaigns([payload.campaign, ...campaigns]);
      setSuccessMessage("Campaign created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create campaign';
      onError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCampaign = async (data: CampaignFormData) => {
    if (!selectedCampaign) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/revops/campaigns/${selectedCampaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, tenantSlug }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to update campaign');
      setCampaigns(
        campaigns.map((c) =>
          c.id === selectedCampaign.id ? { ...c, ...payload.campaign } : c
        )
      );
      setSuccessMessage("Campaign updated successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update campaign';
      onError(message);
    } finally {
      setIsSubmitting(false);
      setSelectedCampaign(null);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!selectedCampaign) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/revops/campaigns/${selectedCampaign.id}?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to delete campaign');
      }
      setCampaigns(campaigns.filter((c) => c.id !== selectedCampaign.id));
      setSuccessMessage("Campaign deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete campaign';
      onError(message);
    } finally {
      setIsSubmitting(false);
      setSelectedCampaign(null);
    }
  };

  const openViewModal = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowViewModal(true);
  };

  const openEditModal = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowEditModal(true);
  };

  const openDeleteModal = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setShowDeleteModal(true);
  };

  const filteredCampaigns = campaigns.filter(
    (c) => filterStatus === "all" || c.status === filterStatus
  );

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Header & Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Campaigns</h2>
          <p className="text-[#94A3B8] mt-1">{filteredCampaigns.length} campaigns</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-5 h-5 text-gray-600" />
        {["all", "active", "planning", "completed"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              filterStatus === status
                ? "bg-blue-600 text-white"
                : "bg-blue-100 text-blue-700 hover:bg-blue-200"
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaigns Table */}
      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No campaigns found</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Channel</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase">Budget / Spent</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase">Revenue</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase">ROI</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCampaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{campaign.name}</td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{campaign.channel.replace("_", " ")}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        campaign.status === "active"
                          ? "bg-green-100 text-green-800"
                          : campaign.status === "planning"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">
                    ${(campaign.actualSpend / 1000).toFixed(0)}K / ${(campaign.budget / 1000).toFixed(0)}K
                  </td>
                  <td className="px-6 py-4 text-right text-gray-900">${(campaign.revenue / 1000).toFixed(0)}K</td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-semibold text-green-600">{campaign.roi.toFixed(2)}x</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openViewModal(campaign)}
                        className="p-1 hover:bg-gray-200 rounded transition"
                        title="View"
                      >
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => openEditModal(campaign)}
                        className="p-1 hover:bg-gray-200 rounded transition"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(campaign)}
                        className="p-1 hover:bg-red-100 rounded transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <CreateCampaignModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateCampaign}
        isLoading={isSubmitting}
      />

      <EditCampaignModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCampaign(null);
        }}
        onSubmit={handleEditCampaign}
        isLoading={isSubmitting}
        campaign={selectedCampaign}
      />

      <ViewCampaignModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedCampaign(null);
        }}
        campaign={selectedCampaign}
      />

      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedCampaign(null);
        }}
        onConfirm={handleDeleteCampaign}
        isLoading={isSubmitting}
        campaignName={selectedCampaign?.name}
      />
    </div>
  );
}
