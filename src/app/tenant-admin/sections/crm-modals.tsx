"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { X, AlertTriangle, Upload, UserPlus, Building2, FileDown } from "lucide-react";

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

  if (!isOpen) return null;

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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
              placeholder="+1 (555) 000-0000"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as (typeof LEAD_STAGE_OPTIONS)[number]["value"] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
              className="bg-white w-full text-black"
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
              disabled={isLoading}
            >
              {isViewMode ? "Close" : "Cancel"}
            </button>
            {!isViewMode && (
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-black rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
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

  if (!isOpen) return null;

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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
              placeholder="+1 (555) 000-0000"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
              disabled={isLoading}
            >
              {isViewMode ? "Close" : "Cancel"}
            </button>
            {!isViewMode && (
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-black rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
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
  leadId?: string;
  customerId?: string;
}

export function CreateDealModal({
  isOpen,
  mode = "create",
  initialData,
  onClose,
  onSubmit,
  isLoading,
  leads = [],
  customers = [],
}: {
  isOpen: boolean;
  mode?: "create" | "edit" | "view";
  initialData?: Partial<DealFormData & { closingDate?: string }>;
  onClose: () => void;
  onSubmit: (data: DealFormData) => Promise<void>;
  isLoading: boolean;
  leads?: Array<{ id: string; companyName: string; contactName: string }>;
  customers?: Array<{ id: string; name: string }>;
}) {
  const initialState: DealFormData = {
    name: "",
    company: "",
    amount: 25000,
    stage: "prospecting",
    assignedTo: "",
    closingDate: new Date().toISOString().split("T")[0],
    probability: 50,
    leadId: "",
    customerId: "",
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
        leadId: initialData.leadId ?? "",
        customerId: initialData.customerId ?? "",
      });
    }
  }, [isOpen, mode, initialData]);

  if (!isOpen) return null;

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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
              placeholder="ABC Corporation"
              disabled={isLoading || isViewMode}
            />
          </div>

          {leads.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Link to Lead
              </label>
              <select
                value={formData.leadId ?? ""}
                onChange={(e) => {
                  const selectedLead = leads.find((l) => l.id === e.target.value);
                  setFormData({
                    ...formData,
                    leadId: e.target.value || undefined,
                    company: selectedLead ? selectedLead.companyName : formData.company,
                    name: selectedLead && !formData.name ? `Deal - ${selectedLead.companyName}` : formData.name,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
                disabled={isLoading || isViewMode}
              >
                <option value="">None</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.contactName} — {lead.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {customers.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Link to Customer
              </label>
              <select
                value={formData.customerId ?? ""}
                onChange={(e) => {
                  const selectedCustomer = customers.find((c) => c.id === e.target.value);
                  setFormData({
                    ...formData,
                    customerId: e.target.value || undefined,
                    company: selectedCustomer ? selectedCustomer.name : formData.company,
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
                disabled={isLoading || isViewMode}
              >
                <option value="">None</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Deal Amount ($) *
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: +e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
              placeholder="50000"
              min="1"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Stage
              </label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value as (typeof DEAL_STAGE_OPTIONS)[number]["value"] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
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
                className="bg-white w-full text-black"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black bg-white"
              disabled={isLoading || isViewMode}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
              disabled={isLoading}
            >
              {isViewMode ? "Close" : "Cancel"}
            </button>
            {!isViewMode && (
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-green-600 text-black rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
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
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-red-600 text-black rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Contacts Modal
// ---------------------------------------------------------------------------
export interface ImportedContactRow {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
}

// Detect delimiter: tab > semicolon > comma based on first line counts
function detectDelimiter(firstLine: string): string {
  const counts = { "\t": 0, ";": 0, ",": 0 };
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (!inQ && ch in counts) counts[ch as keyof typeof counts]++;
  }
  if (counts["\t"] > 0) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Handle escaped double-quotes ("")
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

export interface ParseCsvResult {
  rows: ImportedContactRow[];
  warnings: string[];
  matched: string[];   // original header names that were mapped
  ignored: string[];   // original header names that were skipped
  totalColumns: number;
}

function parseCsv(text: string): ParseCsvResult {
  // Strip UTF-8 BOM (Excel adds this)
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], warnings: ["File appears empty or has only a header row."], matched: [], ignored: [], totalColumns: 0 };

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCsvLine(lines[0], delimiter);
  // Normalize: lowercase, strip all non-alpha chars
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));

  const idx = (names: string[]) => names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;

  const firstIdx = idx([
    "firstname", "first", "givenname", "forename", "fname",
    "firstnames", "contactfirstname", "contactfirst",
  ]);
  const lastIdx = idx([
    "lastname", "last", "surname", "familyname", "lname",
    "lastnames", "contactlastname", "contactlast", "secondname",
  ]);
  // Single full-name column fallback (e.g. "Name", "Full Name", "Contact Name")
  const fullNameIdx = idx([
    "name", "fullname", "contactname", "displayname", "contact",
  ]);
  const companyIdx = idx([
    "company", "organisation", "organization", "companyname",
    "businessname", "business", "employer", "firm", "account",
    "accountname", "corp", "corporation",
  ]);
  const emailIdx = idx([
    "email", "contactemail", "emailaddress", "emailaddr",
    "mail", "emailid", "workemail", "primaryemail",
  ]);
  const phoneIdx = idx([
    "phone", "phonenumber", "mobile", "contactphone", "telephone",
    "tel", "cell", "cellphone", "mobilenumber", "mobilephone",
    "phoneno", "telnumber", "contactnumber", "number",
  ]);

  // Track which original column indices are used
  const usedIndices = new Set<number>(
    [firstIdx, lastIdx, fullNameIdx, companyIdx, emailIdx, phoneIdx].filter((i) => i >= 0)
  );
  const matched = rawHeaders.filter((_, i) => usedIndices.has(i));
  const ignored = rawHeaders.filter((_, i) => !usedIndices.has(i));

  // Build warnings for completely unrecognised files
  const warnings: string[] = [];
  const hasName = firstIdx >= 0 || lastIdx >= 0 || fullNameIdx >= 0;
  if (!hasName && companyIdx < 0) {
    warnings.push("Could not find a name or company column. Check your column headers match the expected names.");
  }
  if (emailIdx < 0 && phoneIdx < 0) {
    warnings.push("No email or phone column found — contacts will be imported without contact details.");
  }

  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line, delimiter);
    const get = (i: number) => (i >= 0 ? cols[i]?.trim() ?? "" : "");

    let firstName = get(firstIdx);
    let lastName = get(lastIdx);

    // If only a full-name column exists, split on first space
    if (!firstName && !lastName && fullNameIdx >= 0) {
      const full = get(fullNameIdx);
      const spaceIdx = full.indexOf(" ");
      if (spaceIdx > 0) {
        firstName = full.slice(0, spaceIdx);
        lastName = full.slice(spaceIdx + 1);
      } else {
        firstName = full;
      }
    }

    return {
      firstName,
      lastName,
      company: get(companyIdx),
      email: get(emailIdx),
      phone: get(phoneIdx),
    };
  }).filter((r) => r.firstName || r.lastName || r.company || r.email);

  return { rows, warnings, matched, ignored, totalColumns: rawHeaders.length };
}

export function ImportContactsModal({
  isOpen,
  onClose,
  onImport,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImport: (contacts: ImportedContactRow[]) => Promise<void>;
  isLoading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportedContactRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) { setRows([]); setError(null); setFileName(null); setWarnings([]); setMatched([]); setIgnored([]); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    setError(null);
    setWarnings([]);
    const allowed = [".csv", ".tsv", ".txt"];
    if (!allowed.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError("Unsupported file type. Please upload a .csv, .tsv, or .txt file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows: parsed, warnings: warns, matched: m, ignored: ig } = parseCsv(text);
      if (parsed.length === 0) {
        setError(warns.length > 0 ? warns[0] : "No valid rows found. Check the column headers match the expected names.");
        return;
      }
      setRows(parsed);
      setWarnings(warns);
      setMatched(m);
      setIgnored(ig);
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (rows.length === 0) { setError("No contacts to import."); return; }
    try {
      await onImport(rows);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    }
  };

  const downloadSampleCsv = () => {
    const header = "First Name,Last Name,Company,Email,Phone";
    const samples = [
      "John,Smith,Acme Corp,john.smith@acme.com,+1 555 000 0001",
      "Jane,Doe,Beta Ltd,jane.doe@betaltd.com,+1 555 000 0002",
      "Carlos,Rivera,Gamma Inc,c.rivera@gammainc.com,+234 800 000 0003",
      "Amaka,Obi,,amaka.obi@email.com,",
      ",,,sample@noname.com,+44 20 0000 0000",
    ];
    const csv = [header, ...samples].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contacts_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Import Contacts from CSV</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Sample download banner */}
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-blue-800">Not sure about the format?</p>
              <p className="text-xs text-blue-600 mt-0.5">Download the template and fill it in — then upload it here.</p>
            </div>
            <button
              onClick={downloadSampleCsv}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-black text-sm font-medium rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
            >
              <FileDown className="w-4 h-4" /> Download Sample
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {rows.length === 0 ? (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-blue-400 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-theme-text-tertiary mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Drop a file here or <span className="text-blue-600 underline">browse</span></p>
              <p className="text-xs text-theme-text-tertiary mt-2">Accepts <span className="font-medium">.csv, .tsv, .txt</span> — any column order is fine</p>
              <p className="text-xs text-theme-text-tertiary mt-1">
                or{" "}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); downloadSampleCsv(); }}
                  className="text-blue-500 underline hover:text-theme-accent-hover"
                >
                  download the sample template
                </button>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                className="bg-white hidden text-black"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{rows.length}</span> contacts ready to import from <span className="font-medium">{fileName}</span>
                </p>
                <button
                  onClick={() => { setRows([]); setFileName(null); setWarnings([]); setMatched([]); setIgnored([]); }}
                  className="text-xs text-red-600 hover:underline"
                >
                  Clear
                </button>
              </div>
              {/* Column mapping summary */}
              <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                <p className="text-xs font-semibold text-gray-900">Column mapping</p>
                <div className="flex flex-wrap gap-1.5">
                  {matched.map((col) => (
                    <span key={col} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                      ✓ {col}
                    </span>
                  ))}
                  {ignored.map((col) => (
                    <span key={col} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-500 text-xs rounded-full line-through">
                      {col}
                    </span>
                  ))}
                </div>
                {ignored.length > 0 && (
                  <p className="text-xs text-gray-500">{ignored.length} column{ignored.length !== 1 ? "s" : ""} will be ignored during import.</p>
                )}
              </div>
              {warnings.length > 0 && (
                <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-800">⚠ {w}</p>
                  ))}
                </div>
              )}
              <div className="border border-gray-200 rounded-lg overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      {["First Name", "Last Name", "Company", "Email", "Phone"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-900">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900">{r.firstName || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.lastName || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.company || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.email || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2 bg-blue-600 text-black rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            disabled={isLoading || rows.length === 0}
          >
            {isLoading ? "Importing..." : `Import ${rows.length > 0 ? rows.length : ""} Contact${rows.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Convert Contact → Lead Modal
// ---------------------------------------------------------------------------
export interface ConvertToLeadFormData {
  stage: string;
  source: string;
  expectedValue: string;
  notes: string;
}

export function ConvertToLeadModal({
  isOpen,
  contactName,
  company,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  contactName: string;
  company: string;
  onClose: () => void;
  onSubmit: (data: ConvertToLeadFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<ConvertToLeadFormData>({ stage: "new", source: "website", expectedValue: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) { setError(null); setFormData({ stage: "new", source: "website", expectedValue: "", notes: "" }); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-600" />
            <h2 className="text-xl font-bold text-gray-900">Convert to Lead</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              Converting <span className="font-semibold">{contactName}</span> ({company}) to a new lead.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Initial Stage</label>
              <select
                value={formData.stage}
                onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={isLoading}
              >
                {LEAD_STAGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Source</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
                disabled={isLoading}
              >
                <option value="website">Website</option>
                <option value="walk_in">Walk-in</option>
                <option value="campaign">Campaign</option>
                <option value="referral">Referral</option>
                <option value="api_import">API Import</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Expected Value (optional)</label>
            <input
              type="number"
              value={formData.expectedValue}
              onChange={(e) => setFormData({ ...formData, expectedValue: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
              placeholder="e.g. 50000"
              min="0"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Notes (optional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
              rows={2}
              placeholder="Add any context about this lead..."
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-3 pt-2">
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
              className="flex-1 px-4 py-2 bg-green-600 text-black rounded-lg font-medium hover:bg-green-700 transition disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? "Converting..." : "Convert to Lead"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Convert Lead → Customer Modal
// ---------------------------------------------------------------------------
export interface ConvertToCustomerFormData {
  customerName: string;
  regionId: string;
  branchId: string;
  status: string;
}

export function ConvertToCustomerModal({
  isOpen,
  leadContactName,
  companyName,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  leadContactName: string;
  companyName: string;
  onClose: () => void;
  onSubmit: (data: ConvertToCustomerFormData) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<ConvertToCustomerFormData>({
    customerName: "",
    regionId: "default",
    branchId: "default",
    status: "active",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({ ...prev, customerName: companyName }));
      setError(null);
    }
  }, [isOpen, companyName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.customerName.trim()) { setError("Customer name is required"); return; }
    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Convert to Customer</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <p className="text-sm text-purple-800">
              Converting lead <span className="font-semibold">{leadContactName}</span> into a customer. The lead stage will be marked as <strong>Converted</strong>.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Customer / Company Name *</label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
              placeholder="Company name"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Region ID</label>
              <input
                type="text"
                value={formData.regionId}
                onChange={(e) => setFormData({ ...formData, regionId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
                placeholder="default"
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Branch ID</label>
              <input
                type="text"
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
                placeholder="default"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black bg-white"
              disabled={isLoading}
            >
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
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
              className="flex-1 px-4 py-2 bg-purple-600 text-gray-900 rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? "Converting..." : "Convert to Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit Customer Modal
// ---------------------------------------------------------------------------
export interface CustomerFormData {
  name: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
}

const DEFAULT_CUSTOMER_FORM: CustomerFormData = {
  name: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactPhone: "",
  status: "active",
};

export function CreateCustomerModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode = "create",
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CustomerFormData) => Promise<void>;
  initialData?: Partial<CustomerFormData>;
  mode?: "create" | "edit" | "view";
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CustomerFormData>(DEFAULT_CUSTOMER_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(initialData ? { ...DEFAULT_CUSTOMER_FORM, ...initialData } : DEFAULT_CUSTOMER_FORM);
      setFormError(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const readOnly = mode === "view";
  const title = mode === "edit" ? "Edit Customer" : mode === "view" ? "Customer Details" : "Add Customer";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { setFormError("Company / customer name is required."); return; }
    setFormError(null);
    await onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-800">{formError}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Company / Customer Name <span className="text-red-500">*</span></label>
            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-black bg-white disabled:bg-white"
              placeholder="Acme Corporation" disabled={readOnly || isLoading} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">First Name</label>
              <input type="text" value={formData.contactFirstName} onChange={(e) => setFormData({ ...formData, contactFirstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-black bg-white disabled:bg-white"
                placeholder="John" disabled={readOnly || isLoading} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">Last Name</label>
              <input type="text" value={formData.contactLastName} onChange={(e) => setFormData({ ...formData, contactLastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-black bg-white disabled:bg-white"
                placeholder="Smith" disabled={readOnly || isLoading} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Email</label>
            <input type="email" value={formData.contactEmail} onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-black bg-white disabled:bg-white"
              placeholder="john@acme.com" disabled={readOnly || isLoading} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Phone</label>
            <input type="text" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-black bg-white disabled:bg-white"
              placeholder="+1 555 000 0000" disabled={readOnly || isLoading} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Status</label>
            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-black bg-white disabled:bg-white"
              disabled={readOnly || isLoading}>
              <option value="active">Active</option>
              <option value="prospect">Prospect</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {!readOnly ? (
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition" disabled={isLoading}>Cancel</button>
              <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-gray-900 rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50" disabled={isLoading}>
                {isLoading ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Customer"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={onClose} className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition">Close</button>
          )}
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import Customers Modal
// ---------------------------------------------------------------------------
export interface ImportedCustomerRow {
  name: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
}

function parseCustomerCsv(text: string): { rows: ImportedCustomerRow[]; warnings: string[]; matched: string[]; ignored: string[] } {
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], warnings: ["File appears empty or has only a header row."], matched: [], ignored: [] };
  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = parseCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const idx = (names: string[]) => names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;
  const nameIdx = idx(["company", "organisation", "organization", "companyname", "businessname", "business", "name", "customername", "accountname", "firm", "corp"]);
  const firstIdx2 = idx(["firstname", "first", "givenname", "fname", "contactfirstname"]);
  const lastIdx2 = idx(["lastname", "last", "surname", "familyname", "lname", "contactlastname"]);
  const fullNameIdx2 = idx(["contactname", "fullname", "displayname"]);
  const emailIdx2 = idx(["email", "contactemail", "emailaddress", "mail"]);
  const phoneIdx2 = idx(["phone", "phonenumber", "mobile", "telephone", "tel", "contactphone"]);
  const usedIndices = new Set([nameIdx, firstIdx2, lastIdx2, fullNameIdx2, emailIdx2, phoneIdx2].filter((i) => i >= 0));
  const matched = rawHeaders.filter((_, i) => usedIndices.has(i));
  const ignored = rawHeaders.filter((_, i) => !usedIndices.has(i));
  const warnings: string[] = [];
  if (nameIdx < 0) warnings.push("No company/name column found — name will be derived from contact name or email.");
  const rows = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line, delimiter);
    const get = (i: number) => (i >= 0 ? cols[i]?.trim() ?? "" : "");
    let contactFirstName = get(firstIdx2);
    let contactLastName = get(lastIdx2);
    if (!contactFirstName && !contactLastName && fullNameIdx2 >= 0) {
      const full = get(fullNameIdx2); const sp = full.indexOf(" ");
      if (sp > 0) { contactFirstName = full.slice(0, sp); contactLastName = full.slice(sp + 1); }
      else { contactFirstName = full; }
    }
    const name = get(nameIdx) || [contactFirstName, contactLastName].filter(Boolean).join(" ") || get(emailIdx2) || "Unknown";
    return { name, contactFirstName, contactLastName, contactEmail: get(emailIdx2), contactPhone: get(phoneIdx2) };
  }).filter((r) => r.name !== "Unknown" || r.contactEmail);
  return { rows, warnings, matched, ignored };
}

export function ImportCustomersModal({
  isOpen,
  onClose,
  onImport,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: ImportedCustomerRow[]) => Promise<void>;
  isLoading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [custRows, setCustRows] = useState<ImportedCustomerRow[]>([]);
  const [custWarnings, setCustWarnings] = useState<string[]>([]);
  const [custMatched, setCustMatched] = useState<string[]>([]);
  const [custIgnored, setCustIgnored] = useState<string[]>([]);
  const [custError, setCustError] = useState<string | null>(null);
  const [custFileName, setCustFileName] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) { setCustRows([]); setCustError(null); setCustFileName(null); setCustWarnings([]); setCustMatched([]); setCustIgnored([]); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    setCustError(null); setCustWarnings([]);
    if (![".csv", ".tsv", ".txt"].some((ext) => file.name.toLowerCase().endsWith(ext))) { setCustError("Unsupported file type."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows: parsed, warnings: warns, matched: m, ignored: ig } = parseCustomerCsv(text);
      if (parsed.length === 0) { setCustError(warns[0] ?? "No valid rows found."); return; }
      setCustRows(parsed); setCustWarnings(warns); setCustMatched(m); setCustIgnored(ig); setCustFileName(file.name);
    };
    reader.readAsText(file);
  };

  const downloadSample = () => {
    const csv = ["Company,First Name,Last Name,Email,Phone", "Acme Corp,John,Smith,john@acme.com,+1 555 000 0001", "Beta Ltd,Jane,Doe,jane@beta.com,+44 20 0000 0002"].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "customers_import_template.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-600" />
            <h2 className="text-xl font-bold text-gray-900">Import Customers from CSV</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition"><X className="w-5 h-5 text-gray-600" /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-purple-800">Need a template?</p>
              <p className="text-xs text-purple-600 mt-0.5">Download, fill in, then upload.</p>
            </div>
            <button onClick={downloadSample} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-gray-900 text-sm font-medium rounded-lg hover:bg-purple-700 transition whitespace-nowrap">
              <FileDown className="w-4 h-4" /> Download Sample
            </button>
          </div>
          {custError && <div className="p-3 bg-red-50 border border-red-200 rounded-lg"><p className="text-sm text-red-800">{custError}</p></div>}
          {custRows.length === 0 ? (
            <div onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }} onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center hover:border-purple-400 transition cursor-pointer"
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-10 h-10 text-theme-text-tertiary mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Drop a file here or <span className="text-purple-600 underline">browse</span></p>
              <p className="text-xs text-theme-text-tertiary mt-2">Accepts .csv, .tsv, .txt — any column order</p>
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" className="bg-white hidden text-black" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600"><span className="font-semibold text-gray-900">{custRows.length}</span> customers ready from <span className="font-medium">{custFileName}</span></p>
                <button onClick={() => { setCustRows([]); setCustFileName(null); setCustWarnings([]); setCustMatched([]); setCustIgnored([]); }} className="text-xs text-red-600 hover:underline">Clear</button>
              </div>
              {custMatched.length > 0 && (
                <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                  <p className="text-xs font-semibold text-gray-900">Column mapping</p>
                  <div className="flex flex-wrap gap-1.5">
                    {custMatched.map((col) => <span key={col} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">✓ {col}</span>)}
                    {custIgnored.map((col) => <span key={col} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-500 text-xs rounded-full line-through">{col}</span>)}
                  </div>
                </div>
              )}
              {custWarnings.length > 0 && <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">{custWarnings.map((w, i) => <p key={i} className="text-xs text-amber-800">⚠ {w}</p>)}</div>}
              <div className="border border-gray-200 rounded-lg overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>{["Company", "First Name", "Last Name", "Email", "Phone"].map((h) => <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-900">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {custRows.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-900 font-medium">{r.name || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.contactFirstName || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.contactLastName || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.contactEmail || "—"}</td>
                        <td className="px-3 py-2 text-gray-600">{r.contactPhone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-medium hover:bg-gray-50 transition" disabled={isLoading}>Cancel</button>
          <button
            onClick={async () => {
              if (custRows.length === 0) { setCustError("No customers to import."); return; }
              try { await onImport(custRows); onClose(); } catch (err) { setCustError(err instanceof Error ? err.message : "Import failed"); }
            }}
            className="flex-1 px-4 py-2 bg-purple-600 text-gray-900 rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50"
            disabled={isLoading || custRows.length === 0}>
            {isLoading ? "Importing..." : `Import ${custRows.length} Customer${custRows.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
