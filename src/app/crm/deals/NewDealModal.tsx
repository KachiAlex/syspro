"use client";

import React, { useState } from "react";
import { X } from "lucide-react";

type Deal = {
  id?: string;
  tenantSlug?: string;
  customerId?: string | null;
  leadId?: string | null;
  stage: string;
  value: number;
  currency?: string;
  probability?: number | null;
  expectedClose?: string | null;
  assignedOfficerId?: string | null;
  status?: string;
};

const DEAL_STAGES = ["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"];
const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting",
  qualification: "Qualification",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export default function NewDealModal({
  isEdit = false,
  initialData,
  onClose,
  onSave,
}: {
  isEdit?: boolean;
  initialData?: Deal;
  onClose: () => void;
  onSave: (data: Deal) => void;
}) {
  const [formData, setFormData] = useState<Deal>(
    initialData || {
      stage: "prospecting",
      value: 0,
      currency: "₦",
      probability: 50,
      status: "open",
    }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let finalValue: any = value;
    
    if (name === "value" || name === "probability") {
      finalValue = value === "" ? 0 : Number(value);
    }
    
    setFormData((prev) => ({ ...prev, [name]: finalValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.value <= 0) {
      setError("Deal value must be greater than 0");
      setLoading(false);
      return;
    }

    try {
      onSave(formData);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving deal");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-6 bg-gray-50 border-b border-gray-200 z-[10000]">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? "Edit Deal" : "New Deal"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Stage *</label>
              <select
                name="stage"
                value={formData.stage}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {DEAL_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {STAGE_LABELS[stage]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deal Value *</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="value"
                  value={formData.value || ""}
                  onChange={handleChange}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  required
                  step="1000"
                  min="0"
                />
                <select
                  name="currency"
                  value={formData.currency || "₦"}
                  onChange={handleChange}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="₦">₦ (Naira)</option>
                  <option value="$">$ (USD)</option>
                  <option value="€">€ (EUR)</option>
                  <option value="£">£ (GBP)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Probability (%)</label>
              <div className="flex gap-4 items-end">
                <input
                  type="range"
                  name="probability"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.probability || 50}
                  onChange={handleChange}
                  className="flex-1"
                />
                <input
                  type="number"
                  name="probability"
                  value={formData.probability || 50}
                  onChange={handleChange}
                  className="w-16 px-2 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Close Date</label>
              <input
                type="date"
                name="expectedClose"
                value={formData.expectedClose || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Lead ID</label>
              <input
                type="text"
                name="leadId"
                value={formData.leadId || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional: Link to a lead"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
              <input
                type="text"
                name="customerId"
                value={formData.customerId || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional: Link to a customer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Officer ID</label>
              <input
                type="text"
                name="assignedOfficerId"
                value={formData.assignedOfficerId || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional: Assign to a sales officer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                name="status"
                value={formData.status || "open"}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="open">Open</option>
                <option value="stalled">Stalled</option>
                <option value="inactive">Inactive</option>
              </select>
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
