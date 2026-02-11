"use client";
import React, { useEffect, useState } from "react";
import NewLeadModal from "./NewLeadModal";

type Lead = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  stage: string;
  expectedValue?: number | null;
  currency?: string | null;
  assignedOfficerId?: string | null;
};

export default function LeadsPage({ tenantSlug }: { tenantSlug?: string | null }) {
  const ts = tenantSlug ?? "kreatix-default";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/crm/leads?tenantSlug=${encodeURIComponent(ts)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.leads) setLeads(data.leads);
        else setError("No leads returned");
      })
      .catch((err) => setError(String(err?.message ?? err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLeads();
  }, [ts]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Leads</h2>
        <div className="flex items-center gap-4">
          <div>
            <span className="text-sm text-slate-600">Tenant: </span>
            <span className="font-medium">{ts}</span>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            New Lead
          </button>
        </div>
      </div>

      {loading && <p className="text-slate-600">Loading leads…</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leads.map((lead) => (
          <div key={lead.id} className="border rounded-lg p-4 shadow-sm bg-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{lead.companyName}</h3>
                <p className="text-sm text-slate-600">{lead.contactName}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-1 text-xs rounded bg-slate-100 text-slate-800">{lead.stage}</span>
              </div>
            </div>

            <div className="mt-3 text-sm text-slate-700">
              <div>
                <strong>Contact:</strong> {lead.contactEmail ?? lead.contactPhone ?? "—"}
              </div>
              <div>
                <strong>Value:</strong> {lead.expectedValue ? `${lead.currency ?? "₦"}${lead.expectedValue}` : "—"}
              </div>
              <div>
                <strong>Owner:</strong> {lead.assignedOfficerId ?? "Unassigned"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!loading && leads.length === 0 && !error && <p className="mt-4 text-slate-600">No leads found.</p>}

      {showNew && (
        <NewLeadModal
          tenantSlug={ts}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            loadLeads();
          }}
        />
      )}
    </div>
  );
}
