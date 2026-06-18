"use client";

import React, { useEffect, useState } from "react";
import { Plus, Download, Filter, Grid3X3, List, Kanban, Search, X, Eye, Edit2, Trash2, AlertCircle } from "lucide-react";
import NewLeadModal from "./NewLeadModal";

type Lead = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  stage: string;
  score?: number;
  source?: string;
  expectedValue?: number | null;
  currency?: string | null;
  assignedOfficerId?: string | null;
};

type ViewType = "table" | "grid" | "kanban";

const LEAD_STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "converted", "lost"];
const LEAD_SOURCES = ["website", "walk_in", "campaign", "referral", "api_import"];

export default function LeadsPage({ tenantSlug }: { tenantSlug?: string | null }) {
  const ts = tenantSlug ;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState<number | null>(null);
  const totalPages = total !== null ? Math.max(1, Math.ceil(total / pageSize)) : null;

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  
  // UI
  const [viewType, setViewType] = useState<ViewType>("table");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadLeads = (p = page, size = pageSize) => {
    setLoading(true);
    setError(null);
    const offset = p * size;
    const params = new URLSearchParams({
      tenantSlug: ts ?? '',
      limit: String(size),
      offset: String(offset),
      ...(searchTerm && { search: searchTerm }),
      ...(filterStage !== "all" && { stage: filterStage }),
      ...(filterSource !== "all" && { source: filterSource }),
    });

    fetch(`/api/crm/leads?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setLeads(Array.isArray(data.leads) ? data.leads : []);
        setTotal(data.total || 0);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load leads");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLeads(0, pageSize);
  }, [ts, filterStage, filterSource]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: ts }),
      });

      if (res.ok) {
        setSuccess("Lead deleted successfully");
        setDeleteConfirm(null);
        loadLeads(page, pageSize);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to delete lead");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting lead");
    }
  };

  const handleExportLeads = () => {
    const csv = [
      ["Name", "Company", "Email", "Phone", "Stage", "Score", "Source", "Expected Value"],
      ...leads.map((l) => [
        l.contactName,
        l.companyName,
        l.contactEmail || "",
        l.contactPhone || "",
        l.stage || "",
        l.score || "",
        l.source || "",
        l.expectedValue || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    link.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // Filtered leads for current view
  const filteredLeads = leads.filter(
    (lead) =>
      (searchTerm === "" ||
        lead.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (filterStage === "all" || lead.stage === filterStage) &&
      (filterSource === "all" || lead.source === filterSource)
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Sales Leads</h1>
            <p className="text-gray-600 mt-1">Manage and track your sales leads pipeline</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportLeads}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
            >
              <Download className="w-4 h-4" /> Export
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
            >
              <Plus className="w-4 h-4" /> Add Lead
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(0);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={filterStage}
              onChange={(e) => {
                setFilterStage(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Stages</option>
              {LEAD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={filterSource}
              onChange={(e) => {
                setFilterSource(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                </option>
              ))}
            </select>
          </div>

          {/* View Toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">{filteredLeads.length} leads</p>
            <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
              <button
                onClick={() => setViewType("table")}
                className={`p-2 rounded ${viewType === "table" ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType("grid")}
                className={`p-2 rounded ${viewType === "grid" ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                title="Grid view"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewType("kanban")}
                className={`p-2 rounded ${viewType === "kanban" ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                title="Kanban view"
              >
                <Kanban className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading leads...</p>
          </div>
        )}

        {/* Table View */}
        {!loading && viewType === "table" && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Stage</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Source</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No leads found
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{lead.contactName}</p>
                          <p className="text-sm text-gray-600">{lead.contactEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900">{lead.companyName}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {lead.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full max-w-16">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${(lead.score || 0) / 100 * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-600">{lead.score || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-900">
                        {lead.expectedValue ? `${lead.currency || "₦"}${lead.expectedValue.toLocaleString()}` : "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">{lead.source || "-"}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setShowEditModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(lead.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Grid View */}
        {!loading && viewType === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLeads.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">No leads found</div>
            ) : (
              filteredLeads.map((lead) => (
                <div key={lead.id} className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{lead.contactName}</p>
                      <p className="text-sm text-gray-600">{lead.companyName}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowEditModal(true);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(lead.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Stage:</span>
                      <span className="font-medium">{lead.stage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Score:</span>
                      <span className="font-medium text-green-600">{lead.score || 0}/100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Value:</span>
                      <span className="font-medium">
                        {lead.expectedValue ? `${lead.currency || "₦"}${lead.expectedValue.toLocaleString()}` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Source:</span>
                      <span className="font-medium">{lead.source || "-"}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Kanban View */}
        {!loading && viewType === "kanban" && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4">
            {LEAD_STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="bg-gray-100 rounded-lg p-3 min-h-96">
                  <h3 className="font-semibold text-gray-900 text-sm mb-3">
                    {stage.charAt(0).toUpperCase() + stage.slice(1)}
                    <span className="ml-2 text-gray-500 text-xs">({stageLeads.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-white rounded p-2 shadow-sm hover:shadow-md transition cursor-pointer"
                        onClick={() => {
                          setSelectedLead(lead);
                          setShowEditModal(true);
                        }}
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">{lead.contactName}</p>
                        <p className="text-xs text-gray-600 truncate">{lead.companyName}</p>
                        {lead.expectedValue && (
                          <p className="text-xs text-green-600 mt-1 font-medium">
                            {lead.currency || "₦"}{lead.expectedValue.toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setPage(Math.max(0, page - 1));
                loadLeads(Math.max(0, page - 1), pageSize);
              }}
              disabled={page === 0}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => {
                setPage(page + 1);
                loadLeads(page + 1, pageSize);
              }}
              disabled={page >= totalPages - 1}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewLeadModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onSuccess={() => {
          setShowNewModal(false);
          setSuccess("Lead created successfully");
          loadLeads(0, pageSize);
          setTimeout(() => setSuccess(null), 3000);
        }}
        tenantSlug={ts ?? ''}
      />

      {selectedLead && (
        <NewLeadModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedLead(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedLead(null);
            setSuccess("Lead updated successfully");
            loadLeads(page, pageSize);
            setTimeout(() => setSuccess(null), 3000);
          }}
          tenantSlug={ts ?? ''}
          initialData={selectedLead}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Lead?</h3>
            <p className="text-gray-600 mb-6">This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 text-black rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
