"use client";
import React, { useState, useEffect } from "react";

export default function NewDealModal({
  tenantSlug,
  leads,
  onClose,
  onCreated,
}: {
  tenantSlug: string;
  leads: Array<{ id: string; companyName: string; contactName: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [leadId, setLeadId] = useState("");
  const [dealName, setDealName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [currency, setCurrency] = useState("₦");
  const [stage, setStage] = useState("prospecting");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        tenantSlug,
        leadId,
        dealName,
        amount: amount === "" ? undefined : Number(amount),
        currency,
        stage,
      };
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create deal");
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md space-y-6"
      >
        <h2 className="text-xl font-bold mb-4">Create New Deal</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">Lead</label>
          <select
            value={leadId}
            onChange={e => setLeadId(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          >
            <option value="">Select Lead</option>
            {leads.map(lead => (
              <option key={lead.id} value={lead.id}>
                {lead.companyName} ({lead.contactName})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Deal Name</label>
          <input
            type="text"
            value={dealName}
            onChange={e => setDealName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value ? Number(e.target.value) : "")}
            className="w-full border border-gray-300 rounded px-3 py-2"
            min="0"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <input
            type="text"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Stage</label>
          <select
            value={stage}
            onChange={e => setStage(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2"
            required
          >
            <option value="prospecting">Prospecting</option>
            <option value="qualification">Qualification</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="closed_won">Closed Won</option>
            <option value="closed_lost">Closed Lost</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" onClick={onClose} className="px-3 py-1 btn btn-ghost border rounded">Cancel</button>
          <button type="submit" disabled={submitting} className="px-3 py-1 btn btn-blue rounded">
            {submitting ? "Creating…" : "Create Deal"}
          </button>
        </div>
      </form>
    </div>
  );
}
