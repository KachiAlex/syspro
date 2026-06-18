"use client";

import React, { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

export interface CampaignFormData {
  name: string;
  channel: string;
  status: string;
  budget: number;
  startDate: string;
  endDate?: string;
}

/** Modal for creating a new campaign */
export function CreateCampaignModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CampaignFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CampaignFormData>({
    name: "",
    channel: "email",
    status: "planning",
    budget: 10000,
    startDate: new Date().toISOString().split("T")[0],
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Campaign name is required");
      return;
    }

    if (formData.budget <= 0) {
      setError("Budget must be greater than 0");
      return;
    }

    try {
      await onSubmit(formData);
      setFormData({
        name: "",
        channel: "email",
        status: "planning",
        budget: 10000,
        startDate: new Date().toISOString().split("T")[0],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Create Campaign</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Campaign Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              placeholder="e.g., Q1 Enterprise Push"
              disabled={isLoading}
            />
          </div>

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Channel
            </label>
            <select
              value={formData.channel}
              onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              disabled={isLoading}
            >
              <option value="email">Email</option>
              <option value="paid_search">Paid Search</option>
              <option value="social_media">Social Media</option>
              <option value="content">Content</option>
              <option value="partnerships">Partnerships</option>
              <option value="events">Events</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Initial Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              disabled={isLoading}
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Budget ($) *
            </label>
            <input
              type="number"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: +e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              placeholder="10000"
              min="1"
              disabled={isLoading}
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              disabled={isLoading}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={formData.endDate || ""}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              disabled={isLoading}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Create Campaign"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Modal for editing a campaign */
export function EditCampaignModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  campaign,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CampaignFormData) => Promise<void>;
  isLoading: boolean;
  campaign?: any;
}) {
  const [formData, setFormData] = useState<CampaignFormData>(
    campaign || {
      name: "",
      channel: "email",
      status: "active",
      budget: 0,
      startDate: new Date().toISOString().split("T")[0],
    }
  );
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (campaign) {
      setFormData({
        name: campaign.name,
        channel: campaign.channel,
        status: campaign.status,
        budget: campaign.budget,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
      });
    }
  }, [campaign, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Campaign name is required");
      return;
    }

    if (formData.budget <= 0) {
      setError("Budget must be greater than 0");
      return;
    }

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update campaign");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Edit Campaign</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Campaign Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              disabled={isLoading}
            />
          </div>

          {/* Channel */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Channel
            </label>
            <select
              value={formData.channel}
              onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              disabled={isLoading}
            >
              <option value="email">Email</option>
              <option value="paid_search">Paid Search</option>
              <option value="social_media">Social Media</option>
              <option value="content">Content</option>
              <option value="partnerships">Partnerships</option>
              <option value="events">Events</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              disabled={isLoading}
            >
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Budget ($) *
            </label>
            <input
              type="number"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: +e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              min="1"
              disabled={isLoading}
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              disabled={isLoading}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={formData.endDate || ""}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              disabled={isLoading}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Modal for viewing campaign details */
export function ViewCampaignModal({
  isOpen,
  onClose,
  campaign,
}: {
  isOpen: boolean;
  onClose: () => void;
  campaign?: any;
}) {
  if (!isOpen || !campaign) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Campaign Details</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Campaign Name */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Campaign Name</p>
            <p className="text-lg font-semibold text-gray-900 mt-1">{campaign.name}</p>
          </div>

          {/* Channel & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Channel</p>
              <p className="text-sm text-gray-900 mt-1 capitalize">{campaign.channel.replace("_", " ")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</p>
              <p className="mt-1">
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                    campaign.status === "active"
                      ? "bg-green-100 text-green-800"
                      : campaign.status === "planning"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                </span>
              </p>
            </div>
          </div>

          {/* Budget & Spend */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Budget</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                ${(campaign.budget / 1000).toFixed(0)}K
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Spent</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                ${(campaign.actualSpend / 1000).toFixed(0)}K
              </p>
            </div>
          </div>

          {/* Revenue & ROI */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Revenue</p>
              <p className="text-sm font-semibold text-green-600 mt-1">
                ${(campaign.revenue / 1000).toFixed(0)}K
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">ROI</p>
              <p className="text-sm font-semibold text-green-600 mt-1">{campaign.roi.toFixed(2)}x</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Start Date</p>
              <p className="text-sm text-gray-900 mt-1">{new Date(campaign.startDate).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">End Date</p>
              <p className="text-sm text-gray-900 mt-1">
                {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Confirmation dialog for deleting a campaign */
export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  campaignName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
  campaignName?: string;
}) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      // Error handling in parent
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h2 className="text-lg font-bold text-gray-900">Delete Campaign?</h2>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold">"{campaignName}"</span>? This action cannot be undone.
          </p>
        </div>

        {/* Buttons */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
