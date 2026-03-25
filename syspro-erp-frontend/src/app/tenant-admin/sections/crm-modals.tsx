"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, AlertTriangle } from "lucide-react";

export const LEAD_STAGE_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
] as const;

export const LEAD_SOURCE_OPTIONS = [
  { value: "website", label: "Website" },
  { value: "walk_in", label: "Walk-in" },
  { value: "campaign", label: "Campaign" },
  { value: "referral", label: "Referral" },
  { value: "api_import", label: "API Import" },
] as const;

export const DEAL_STAGE_OPTIONS = [
  { value: "prospecting", label: "Prospecting" },
  { value: "qualification", label: "Qualification" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
] as const;

// Lead Modal Components
export interface LeadFormData {
  name: string;
  email: string;
  company: string;
  phone?: string;
  status: string;
  source: string;
  score: number;
  assignedTo?: string;
}

type LeadModalMode = "create" | "edit" | "view";

export function CreateLeadModal({
  isOpen,
  mode = "create",
  initialData,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  mode?: LeadModalMode;
  initialData?: Partial<LeadFormData>;
  onClose: () => void;
  onSubmit: (data: LeadFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const initialState: LeadFormData = {
    name: "",
    email: "",
    company: "",
    phone: "",
    status: "new",
    source: "website",
    score: 50,
    assignedTo: "",
  };
  const [formData, setFormData] = useState<LeadFormData>(initialState);
  const [error, setError] = useState<string | null>(null);

  const isViewMode = mode === "view";
  const title = useMemo(() => {
    switch (mode) {
      case "edit":
        return "Edit Lead";
      case "view":
        return "Lead Details";
      default:
        return "Add New Lead";
    }
  }, [mode]);

  const submitLabel = mode === "edit" ? "Save Changes" : "Add Lead";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isViewMode) {
      onClose();
      return;
    }

    if (!formData.name.trim()) {
      setError("Lead name is required");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    try {
      await onSubmit(formData);
      if (mode === "create") {
        setFormData(initialState);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lead");
    }
  };

  if (!isOpen) return null;

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }
    if (mode === "create") {
      setFormData(initialState);
      return;
    }
    if (initialData) {
      setFormData({
        ...initialState,
        ...initialData,
        email: initialData.email ?? "",
        company: initialData.company ?? "",
        phone: initialData.phone ?? "",
        assignedTo: initialData.assignedTo ?? "",
      });
    }
  }, [isOpen, mode, initialData]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John Smith"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="john@example.com"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Tech Corp"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+1 (555) 000-0000"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as (typeof LEAD_STAGE_OPTIONS)[number]["value"] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading || isViewMode}
              >
                {LEAD_STAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Source
              </label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value as (typeof LEAD_SOURCE_OPTIONS)[number]["value"] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading || isViewMode}
              >
                {LEAD_SOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Lead Score: {formData.score}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.score}
              onChange={(e) => setFormData({ ...formData, score: +e.target.value })}
              className="w-full"
              disabled={isLoading || isViewMode}
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              disabled={isLoading}
            >
              {isViewMode ? "Close" : "Cancel"}
            </button>
            {!isViewMode && (
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (mode === "edit" ? "Saving..." : "Adding...") : submitLabel}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// Contact Modal Components
export interface ContactFormData {
  name: string;
  email: string;
  company: string;
  phone?: string;
  type: string;
  segment: string;
  notes?: string;
}

export function CreateContactModal({
  isOpen,
  mode = "create",
  initialData,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  mode?: "create" | "edit" | "view";
  initialData?: Partial<ContactFormData>;
  onClose: () => void;
  onSubmit: (data: ContactFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<ContactFormData>({
    name: "",
    email: "",
    company: "",
    phone: "",
    type: "Customer",
    segment: "Standard",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const isViewMode = mode === "view";
  const title = useMemo(() => {
    switch (mode) {
      case "edit":
        return "Edit Contact";
      case "view":
        return "Contact Details";
      default:
        return "Add New Contact";
    }
  }, [mode]);

  const submitLabel = mode === "edit" ? "Save Changes" : "Add Contact";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isViewMode) {
      onClose();
      return;
    }

    if (!formData.name.trim()) {
      setError("Contact name is required");
      return;
    }
    if (!formData.email.trim()) {
      setError("Email is required");
      return;
    }

    try {
      await onSubmit(formData);
      if (mode === "create") {
        setFormData({
          name: "",
          email: "",
          company: "",
          phone: "",
          type: "Customer",
          segment: "Standard",
          notes: "",
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contact");
    }
  };

  if (!isOpen) return null;

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }
    if (mode === "create") {
      setFormData({
        name: "",
        email: "",
        company: "",
        phone: "",
        type: "Customer",
        segment: "Standard",
        notes: "",
      });
      return;
    }
    if (initialData) {
      setFormData({
        name: initialData.name ?? "",
        email: initialData.email ?? "",
        company: initialData.company ?? "",
        phone: initialData.phone ?? "",
        type: initialData.type ?? "Customer",
        segment: initialData.segment ?? "Standard",
        notes: initialData.notes ?? "",
      });
    }
  }, [isOpen, mode, initialData]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Jane Doe"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="jane@example.com"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ABC Corp"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="+1 (555) 000-0000"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading || isViewMode}
              >
                <option>Customer</option>
                <option>Prospect</option>
                <option>Partner</option>
                <option>Vendor</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Segment
              </label>
              <select
                value={formData.segment}
                onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading || isViewMode}
              >
                <option>VIP</option>
                <option>Premium</option>
                <option>Standard</option>
                <option>Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              disabled={isLoading}
            >
              {isViewMode ? "Close" : "Cancel"}
            </button>
            {!isViewMode && (
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (mode === "edit" ? "Saving..." : "Adding...") : submitLabel}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// Deal Modal Components
export interface DealFormData {
  name: string;
  company: string;
  amount: number;
  stage: string;
  assignedTo?: string;
  closingDate: string;
  probability: number;
}

export function CreateDealModal({
  isOpen,
  mode = "create",
  initialData,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  mode?: "create" | "edit" | "view";
  initialData?: Partial<DealFormData & { closingDate?: string }>;
  onClose: () => void;
  onSubmit: (data: DealFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const initialState: DealFormData = {
    name: "",
    company: "",
    amount: 25000,
    stage: "prospecting",
    assignedTo: "",
    closingDate: new Date().toISOString().split("T")[0],
    probability: 50,
  };
  const [formData, setFormData] = useState<DealFormData>(initialState);
  const [error, setError] = useState<string | null>(null);

  const isViewMode = mode === "view";
  const title = useMemo(() => {
    switch (mode) {
      case "edit":
        return "Edit Deal";
      case "view":
        return "Deal Details";
      default:
        return "Create New Deal";
    }
  }, [mode]);

  const submitLabel = mode === "edit" ? "Save Changes" : "Create Deal";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isViewMode) {
      onClose();
      return;
    }

    if (!formData.name.trim()) {
      setError("Deal name is required");
      return;
    }
    if (formData.amount <= 0) {
      setError("Deal amount must be greater than 0");
      return;
    }

    try {
      await onSubmit(formData);
      if (mode === "create") {
        setFormData({
          ...initialState,
          closingDate: new Date().toISOString().split("T")[0],
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create deal");
    }
  };

  if (!isOpen) return null;

  useEffect(() => {
    if (!isOpen) {
      setError(null);
      return;
    }
    if (mode === "create") {
      setFormData({
        ...initialState,
        closingDate: new Date().toISOString().split("T")[0],
      });
      return;
    }
    if (initialData) {
      setFormData({
        name: initialData.name ?? "",
        company: initialData.company ?? "",
        amount: initialData.amount ?? initialState.amount,
        stage: initialData.stage ?? initialState.stage,
        assignedTo: initialData.assignedTo ?? "",
        closingDate: initialData.closingDate ?? new Date().toISOString().split("T")[0],
        probability: initialData.probability ?? initialState.probability,
      });
    }
  }, [isOpen, mode, initialData]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Deal Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enterprise Deal - ABC Corp"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="ABC Corporation"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Deal Amount ($) *
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: +e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="50000"
              min="1"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value as (typeof DEAL_STAGE_OPTIONS)[number]["value"] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading || isViewMode}
              >
                {DEAL_STAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Probability: {formData.probability}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={formData.probability}
                onChange={(e) => setFormData({ ...formData, probability: +e.target.value })}
                className="w-full"
                disabled={isLoading || isViewMode}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Expected Closing Date
            </label>
            <input
              type="date"
              value={formData.closingDate}
              onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
              disabled={isLoading}
            >
              {isViewMode ? "Close" : "Cancel"}
            </button>
            {!isViewMode && (
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? (mode === "edit" ? "Saving..." : "Creating...") : submitLabel}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// Delete Confirmation Modals
export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  itemName,
  itemType,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
  itemName?: string;
  itemType?: string;
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
        <div className="flex items-center gap-3 p-6 border-b border-gray-200">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h2 className="text-lg font-bold text-gray-900">Delete {itemType || "Item"}?</h2>
        </div>

        <div className="p-6">
          <p className="text-gray-600">
            Are you sure you want to delete <span className="font-semibold">"{itemName}"</span>? This action cannot be undone.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
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
