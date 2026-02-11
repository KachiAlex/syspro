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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);

  const loadLeads = (p = page, size = pageSize) => {
    setLoading(true);
    setError(null);
    const offset = p * size;
    fetch(
      `/api/crm/leads?tenantSlug=${encodeURIComponent(ts)}&limit=${encodeURIComponent(String(size))}&offset=${encodeURIComponent(
        String(offset)
      )}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data?.leads) setLeads(data.leads);
        else setError("No leads returned");
      })
      .catch((err) => setError(String(err?.message ?? err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // reset to page 0 when tenant changes
    setPage(0);
    loadLeads(0, pageSize);
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

      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (page > 0) {
                const np = page - 1;
                setPage(np);
                loadLeads(np, pageSize);
              }
            }}
            disabled={page === 0}
            className={`px-3 py-1 rounded border ${page === 0 ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100"}`}
          >
            Previous
          </button>

          <button
            onClick={() => {
              // only advance if we received a full page (simple heuristic)
              if (leads.length >= pageSize) {
                const np = page + 1;
                setPage(np);
                loadLeads(np, pageSize);
              }
            }}
            disabled={leads.length < pageSize}
            className={`px-3 py-1 rounded border ${leads.length < pageSize ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100"}`}
          >
            Next
          </button>

          <span className="text-sm text-slate-600 ml-3">Page {page + 1}</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Page size</label>
          <select
            value={pageSize}
            onChange={(e) => {
              const size = Number(e.target.value);
              setPageSize(size);
              setPage(0);
              loadLeads(0, size);
            }}
            className="border rounded px-2 py-1"
          >
            <option value={6}>6</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
          </select>
        </div>
      </div>

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
