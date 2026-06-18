"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

type Activity = {
  id?: string;
  type: string;
  title: string;
  description?: string;
  relatedTo: string;
  relatedId: string;
  relatedName: string;
  assignedTo?: string;
  dueDate?: string;
  completedAt?: string;
  status?: string;
};

const ACTIVITY_TYPES = ["call", "email", "meeting", "task", "note"];
const ACTIVITY_STATUSES = ["pending", "completed", "cancelled"];
const RELATED_TO_OPTIONS = ["lead", "contact", "deal"];

export default function NewActivityModal({
  isEdit = false,
  initialData,
  onClose,
  onSave,
}: {
  isEdit?: boolean;
  initialData?: Activity;
  onClose: () => void;
  onSave: (data: Activity) => void;
}) {
  const [formData, setFormData] = useState<Activity>(
    initialData || {
      type: "call",
      title: "",
      description: "",
      relatedTo: "lead",
      relatedId: "",
      relatedName: "",
      assignedTo: "",
      dueDate: "",
      completedAt: "",
      status: "pending",
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.title.trim()) {
      setError("Activity title is required");
      setLoading(false);
      return;
    }

    if (!formData.relatedId.trim() || !formData.relatedName.trim()) {
      setError("Related item (ID and Name) is required");
      setLoading(false);
      return;
    }

    try {
      onSave(formData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving activity");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 bg-gray-50 border-b border-gray-200 z-[10000]">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? "Edit Activity" : "Log Activity"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

          {/* Activity Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Activity Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type *</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {ACTIVITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status || "pending"}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ACTIVITY_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Activity title"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={formData.description || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Activity description"
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Related Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Related Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Related To *</label>
                <select
                  name="relatedTo"
                  value={formData.relatedTo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {RELATED_TO_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.charAt(0).toUpperCase() + option.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Related ID *</label>
                <input
                  type="text"
                  name="relatedId"
                  value={formData.relatedId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ID of the related item"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Related Name *</label>
                <input
                  type="text"
                  name="relatedName"
                  value={formData.relatedName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Name of the related item"
                  required
                />
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Additional Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                <input
                  type="text"
                  name="assignedTo"
                  value={formData.assignedTo || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Officer or team member name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  name="dueDate"
                  value={formData.dueDate || ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formData.status === "completed" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Completed Date</label>
                  <input
                    type="date"
                    name="completedAt"
                    value={formData.completedAt || ""}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-900 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Saving..." : isEdit ? "Update Activity" : "Log Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
