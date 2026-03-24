"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

type Account = {
  id?: string;
  tenantSlug?: string;
  regionId?: string;
  branchId?: string;
  name: string;
  primaryContact?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  status?: string;
};

const ACCOUNT_STATUSES = ["active", "inactive", "prospect", "archived"];

export default function NewAccountModal({
  isEdit = false,
  initialData,
  onClose,
  onSave,
}: {
  isEdit?: boolean;
  initialData?: Account;
  onClose: () => void;
  onSave: (data: Account) => void;
}) {
  const [formData, setFormData] = useState<Account>(
    initialData || {
      name: "",
      regionId: "",
      branchId: "",
      primaryContact: {
        name: "",
        email: "",
        phone: "",
      },
      status: "active",
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith("contact_")) {
      const field = name.replace("contact_", "");
      setFormData((prev) => ({
        ...prev,
        primaryContact: {
          ...prev.primaryContact,
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.name.trim()) {
      setError("Account name is required");
      setLoading(false);
      return;
    }

    if (!formData.primaryContact?.email) {
      setError("Primary contact email is required");
      setLoading(false);
      return;
    }

    try {
      onSave(formData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving account");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 bg-gray-50 border-b border-gray-200 z-[10000]">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? "Edit Account" : "New Account"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

          {/* Account Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Company or account name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status || "active"}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACCOUNT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region ID</label>
                <input
                  type="text"
                  name="regionId"
                  value={formData.regionId || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional region identifier"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch ID</label>
                <input
                  type="text"
                  name="branchId"
                  value={formData.branchId || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional branch identifier"
                />
              </div>
            </div>
          </div>

          {/* Primary Contact */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Primary Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  name="contact_name"
                  value={formData.primaryContact?.name || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Contact person name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.primaryContact?.email || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="contact@example.com"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  name="contact_phone"
                  value={formData.primaryContact?.phone || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+234 12345 67890"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
            >
              {loading ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
