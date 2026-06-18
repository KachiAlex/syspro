"use client";
import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

export default function NewLeadModal({
  isOpen,
  tenantSlug,
  initialData,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  tenantSlug: string;
  initialData?: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!initialData;
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [stage, setStage] = useState("new");
  const [source, setSource] = useState("website");
  const [expectedValue, setExpectedValue] = useState<number | "">("");
  const [currency, setCurrency] = useState("₦");
  const [regionId, setRegionId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && initialData) {
      setCompanyName(initialData.companyName || "");
      setContactName(initialData.contactName || "");
      setContactEmail(initialData.contactEmail || "");
      setContactPhone(initialData.contactPhone || "");
      setStage(initialData.stage || "new");
      setSource(initialData.source || "website");
      setExpectedValue(initialData.expectedValue || "");
      setCurrency(initialData.currency || "₦");
      setRegionId(initialData.regionId || "");
      setBranchId(initialData.branchId || "");
    }
  }, [initialData, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        tenantSlug,
        regionId: regionId || "",
        branchId: branchId || "",
        companyName,
        contactName,
        contactEmail: contactEmail || null,
        contactPhone: contactPhone || null,
        source,
        stage,
        expectedValue: expectedValue === "" ? undefined : Number(expectedValue),
        currency,
      };

      const url = isEdit ? `/api/crm/leads/${initialData.id}?tenantSlug=${encodeURIComponent(tenantSlug)}` : "/api/crm/leads";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Failed to ${isEdit ? "update" : "create"} lead`);
      onSuccess();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[10000] bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 shadow-2xl relative z-[10001]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{isEdit ? "Edit Lead" : "New Lead"}</h3>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-900">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company *</label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name *</label>
              <input
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Region</label>
              <input
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                placeholder="Optional"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
              <input
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                placeholder="Optional"
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stage *</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source *</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Expected Value</label>
            <input
              type="number"
              value={expectedValue === "" ? "" : String(expectedValue)}
              onChange={(e) => setExpectedValue(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="0"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring focus:ring-blue-300"
            />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-slate-100 text-sm font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
          </div>
        </div>
      )}
    </>
  );
}
