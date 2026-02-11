"use client";
import React, { useState } from "react";

export default function NewLeadModal({
  tenantSlug,
  onClose,
  onCreated,
}: {
  tenantSlug: string;
  onClose: () => void;
  onCreated: () => void;
}) {
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

      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create lead");
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">New Lead</h3>
          <button onClick={onClose} className="text-slate-600">Close</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-slate-700">Company</label>
            <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>

          <div>
            <label className="block text-sm text-slate-700">Contact Name</label>
            <input required value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-slate-700">Email</label>
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm text-slate-700">Phone</label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-sm text-slate-700">Region</label>
              <input value={regionId} onChange={(e) => setRegionId(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm text-slate-700">Branch</label>
              <input value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
            <div>
              <label className="block text-sm text-slate-700">Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border rounded px-2 py-1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-slate-700">Stage</label>
              <select value={stage} onChange={(e) => setStage(e.target.value)} className="w-full border rounded px-2 py-1">
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="qualified">Qualified</option>
                <option value="proposal">Proposal</option>
                <option value="negotiation">Negotiation</option>
                <option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-700">Source</label>
              <select value={source} onChange={(e) => setSource(e.target.value)} className="w-full border rounded px-2 py-1">
                <option value="website">Website</option>
                <option value="walk_in">Walk-in</option>
                <option value="campaign">Campaign</option>
                <option value="referral">Referral</option>
                <option value="api_import">API</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm text-slate-700">Expected Value</label>
              <input type="number" value={expectedValue === "" ? "" : String(expectedValue)} onChange={(e) => setExpectedValue(e.target.value === "" ? "" : Number(e.target.value))} className="w-full border rounded px-2 py-1" />
            </div>
            <div />
          </div>

          {error && <p className="text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1 border rounded">Cancel</button>
            <button type="submit" disabled={submitting} className="px-3 py-1 bg-blue-600 text-white rounded">{submitting ? "Creating…" : "Create"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
