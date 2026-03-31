"use client";
import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { MoreVertical, Trash2, Edit2, Eye, Grid3x3, Table2, Kanban, Filter, ChevronDown, X, Plus } from "lucide-react";
import NewLeadModal from "./NewLeadModal";

type ViewMode = "grid" | "table" | "kanban";

type Lead = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  stage: string;
  source?: string | null;
  score?: number | null;
  expectedValue?: number | null;
  currency?: string | null;
  assignedOfficerId?: string | null;
  createdAt?: string;
};

const STAGES = ["new", "contacted", "qualified", "proposal", "negotiation", "converted", "lost"];
const SOURCES = ["website", "walk_in", "campaign", "referral", "api_import"];
const STAGE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  new: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  contacted: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  qualified: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  proposal: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  negotiation: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  converted: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  lost: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

const SOURCE_ICONS: Record<string, string> = {
  website: "🌐",
  walk_in: "🚶",
  campaign: "📢",
  referral: "🤝",
  api_import: "💾",
};

function StageSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const colors = STAGE_COLORS[value] || STAGE_COLORS.new;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border rounded px-2 py-1 text-sm font-medium ${colors.text} ${colors.bg} ${colors.border} border cursor-pointer`}
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const ts = searchParams.get("tenantSlug") ?? "kreatix-default";
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    stages: new Set<string>(),
    sources: new Set<string>(),
    scoreMin: 0,
    scoreMax: 100,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "value" | "stage" | "created">("name");
  const totalPages = total !== null ? Math.max(1, Math.ceil(total / pageSize)) : null;

  const loadLeads = (p = page, size = pageSize) => {
    setLoading(true);
    setError(null);
    const offset = p * size;
    fetch(
      `/api/crm/leads?tenantSlug=${encodeURIComponent(ts)}&limit=${encodeURIComponent(String(size))}&offset=${encodeURIComponent(String(offset))}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data?.leads) setLeads(data.leads);
        else setError("No leads returned");
        if (typeof data?.total === "number") setTotal(data.total);
      })
      .catch((err) => setError(String(err?.message ?? err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(0);
    loadLeads(0, pageSize);
  }, [ts]);

  const filteredLeads = useMemo(() => {
    let result = leads.filter((lead) => {
      const matchSearch = search === "" || 
        lead.companyName.toLowerCase().includes(search.toLowerCase()) ||
        lead.contactName.toLowerCase().includes(search.toLowerCase());
      
      const matchStage = filters.stages.size === 0 || filters.stages.has(lead.stage);
      const matchSource = filters.sources.size === 0 || (lead.source && filters.sources.has(lead.source));
      const matchScore = !lead.score || (lead.score >= filters.scoreMin && lead.score <= filters.scoreMax);
      
      return matchSearch && matchStage && matchSource && matchScore;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === "name") return a.companyName.localeCompare(b.companyName);
      if (sortBy === "value") return (b.expectedValue ?? 0) - (a.expectedValue ?? 0);
      if (sortBy === "stage") return a.stage.localeCompare(b.stage);
      if (sortBy === "created") return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      return 0;
    });

    return result;
  }, [leads, search, filters, sortBy]);

  const leadsByStage = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    STAGES.forEach((s) => (grouped[s] = []));
    filteredLeads.forEach((lead) => {
      if (grouped[lead.stage]) grouped[lead.stage].push(lead);
    });
    return grouped;
  }, [filteredLeads]);

  const handleDeleteLead = async (id: string) => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/crm/leads/${id}?tenantSlug=${encodeURIComponent(ts)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setLeads((prev) => prev.filter((l) => l.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete lead");
    }
  };

  const toggleSelectLead = (id: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedLeads(newSelected);
  };

  const selectAllVisisible = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Leads</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">{ts}</span>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" /> New Lead
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        {/* Top row: Search + View toggle + Filters */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-blue-300"
            />
          </div>

          <div className="flex items-center gap-1 border rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded ${viewMode === "grid" ? "bg-blue-100 text-blue-600" : "text-slate-600"}`}
              title="Grid view"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 rounded ${viewMode === "table" ? "bg-blue-100 text-blue-600" : "text-slate-600"}`}
              title="Table view"
            >
              <Table2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-2 rounded ${viewMode === "kanban" ? "bg-blue-100 text-blue-600" : "text-slate-600"}`}
              title="Kanban view"
            >
              <Kanban className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-slate-50 text-sm"
          >
            <Filter className="w-4 h-4" /> Filters {filters.stages.size > 0 || filters.sources.size > 0 ? `(${filters.stages.size + filters.sources.size})` : ""}
          </button>
        </div>

        {/* Filter panel */}
        {filterOpen && (
          <div className="bg-slate-50 border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Stages */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Stages</label>
                <div className="space-y-1">
                  {STAGES.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.stages.has(s)}
                        onChange={(e) => {
                          const newStages = new Set(filters.stages);
                          if (e.target.checked) newStages.add(s);
                          else newStages.delete(s);
                          setFilters({ ...filters, stages: newStages });
                        }}
                        className="rounded"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              {/* Sources */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Sources</label>
                <div className="space-y-1">
                  {SOURCES.map((s) => (
                    <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.sources.has(s)}
                        onChange={(e) => {
                          const newSources = new Set(filters.sources);
                          if (e.target.checked) newSources.add(s);
                          else newSources.delete(s);
                          setFilters({ ...filters, sources: newSources });
                        }}
                        className="rounded"
                      />
                      {SOURCE_ICONS[s]} {s}
                    </label>
                  ))}
                </div>
              </div>

              {/* Score range */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Score Range</label>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-600">Min: {filters.scoreMin}</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.scoreMin}
                      onChange={(e) => setFilters({ ...filters, scoreMin: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600">Max: {filters.scoreMax}</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={filters.scoreMax}
                      onChange={(e) => setFilters({ ...filters, scoreMax: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="name">Company Name</option>
                  <option value="value">Expected Value</option>
                  <option value="stage">Stage</option>
                  <option value="created">Date Created</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">{filteredLeads.length} leads match filters</span>
              <button
                onClick={() => {
                  setFilters({ stages: new Set(), sources: new Set(), scoreMin: 0, scoreMax: 100 });
                  setSearch("");
                }}
                className="text-sm text-blue-600 hover:underline"
              >
                Clear all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selectedLeads.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedLeads.size === filteredLeads.length}
              onChange={selectAllVisisible}
              className="rounded"
            />
            <span className="text-sm font-medium text-blue-700">{selectedLeads.size} selected</span>
          </div>
          <button
            onClick={() => {
              if (confirm("Delete selected leads?")) {
                Promise.all(
                  Array.from(selectedLeads).map((id) =>
                    fetch(`/api/crm/leads/${id}?tenantSlug=${encodeURIComponent(ts)}`, { method: "DELETE" })
                  )
                ).then(() => {
                  loadLeads();
                  setSelectedLeads(new Set());
                });
              }
            }}
            className="text-sm text-red-600 hover:underline"
          >
            Delete selected
          </button>
        </div>
      )}

      {/* Content */}
      {loading && <p className="text-slate-600">Loading leads…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {/* Grid View */}
      {viewMode === "grid" && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => {
            const colors = STAGE_COLORS[lead.stage] || STAGE_COLORS.new;
            return (
              <div key={lead.id} className={`border rounded-lg p-4 shadow-sm bg-white ${colors.border} hover:shadow-md transition`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{lead.companyName}</h3>
                    <p className="text-sm text-slate-600 truncate">{lead.contactName}</p>
                  </div>
                  <div className="relative group">
                    <button className="p-1 text-slate-400 hover:text-slate-600">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    <div className="absolute right-0 mt-1 w-32 bg-white border rounded shadow-lg opacity-0 group-hover:opacity-100 transition z-10">
                      <button
                        onClick={() => setDetailLead(lead)}
                        className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Eye className="w-3 h-3" /> View
                      </button>
                      <button
                        onClick={() => {
                          setEditingLead(lead);
                          setShowEdit(true);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <Edit2 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(lead.id)}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${colors.text} ${colors.bg} ${colors.border} border`}>
                      {lead.stage}
                    </span>
                    {lead.score !== null && lead.score !== undefined && (
                      <span className="text-xs font-medium text-slate-600">
                        Score: <span className={lead.score >= 70 ? "text-green-600" : lead.score >= 40 ? "text-amber-600" : "text-red-600"}>
                          {lead.score}%
                        </span>
                      </span>
                    )}
                  </div>

                  {lead.source && (
                    <div className="text-xs text-slate-600">
                      {SOURCE_ICONS[lead.source]} {lead.source}
                    </div>
                  )}

                  <div className="text-xs text-slate-600 space-y-1">
                    {lead.contactEmail && <div>📧 {lead.contactEmail}</div>}
                    {lead.contactPhone && <div>📱 {lead.contactPhone}</div>}
                  </div>

                  {lead.expectedValue && (
                    <div className="text-sm font-semibold text-slate-900">
                      {lead.currency ?? "₦"}{lead.expectedValue.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && !loading && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="text-left px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                    onChange={selectAllVisisible}
                    className="rounded"
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200" onClick={() => setSortBy("name")}>
                  Company
                </th>
                <th className="text-left px-4 py-3 font-semibold">Contact</th>
                <th className="text-left px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200" onClick={() => setSortBy("stage")}>
                  Stage
                </th>
                <th className="text-left px-4 py-3 font-semibold">Source</th>
                <th className="text-left px-4 py-3 font-semibold">Score</th>
                <th className="text-right px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200" onClick={() => setSortBy("value")}>
                  Value
                </th>
                <th className="text-center px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead, idx) => {
                const colors = STAGE_COLORS[lead.stage] || STAGE_COLORS.new;
                return (
                  <tr key={lead.id} className={`border-b ${idx % 2 === 0 ? "" : "bg-slate-50"} hover:bg-blue-50`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(lead.id)}
                        onChange={() => toggleSelectLead(lead.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{lead.companyName}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.contactName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${colors.text} ${colors.bg} ${colors.border} border`}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.source ? `${SOURCE_ICONS[lead.source]} ${lead.source}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {lead.score !== null && lead.score !== undefined ? (
                        <span className={lead.score >= 70 ? "text-green-600 font-semibold" : lead.score >= 40 ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>
                          {lead.score}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {lead.expectedValue ? `${lead.currency ?? "₦"}${lead.expectedValue.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setDetailLead(lead)}
                          className="p-1 text-slate-600 hover:bg-slate-200 rounded"
                          title="View"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingLead(lead);
                            setShowEdit(true);
                          }}
                          className="p-1 text-slate-600 hover:bg-slate-200 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(lead.id)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Kanban View */}
      {viewMode === "kanban" && !loading && (
        <div className="overflow-x-auto pb-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(300px, 1fr))` }}>
            {STAGES.map((stage) => {
              const stageLeads = leadsByStage[stage] || [];
              const colors = STAGE_COLORS[stage];
              return (
                <div key={stage} className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-3 min-h-96`}>
                  <div className={`font-semibold text-sm mb-3 ${colors.text}`}>
                    {stage} <span className="text-xs >opacity-75">({stageLeads.length})</span>
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-white rounded border shadow-sm p-3 cursor-grab hover:shadow-md transition"
                        onClick={() => setDetailLead(lead)}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="font-medium text-sm text-gray-900">{lead.companyName}</div>
                        <div className="text-xs text-slate-600">{lead.contactName}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <div>
                            {lead.score !== null && lead.score !== undefined && (
                              <div className={`text-xs font-semibold ${lead.score >= 70 ? "text-green-600" : lead.score >= 40 ? "text-amber-600" : "text-red-600"}`}>
                                Score: {lead.score}%
                              </div>
                            )}
                            {lead.expectedValue && (
                              <div className="text-xs font-semibold text-slate-900 mt-1">
                                {lead.currency ?? "₦"}{lead.expectedValue.toLocaleString()}
                              </div>
                            )}
                          </div>
                          <MoreVertical className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="text-center py-8 text-slate-400 text-xs">No leads</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {filteredLeads.length === 0 && !loading && !error && (
        <div className="text-center py-12">
          <p className="text-slate-600">No leads match your criteria</p>
        </div>
      )}

      {/* Pagination (grid/table views only) */}
      {(viewMode === "grid" || viewMode === "table") && !loading && (
        <div className="flex items-center justify-between border-t pt-4">
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
                const np = page + 1;
                if (totalPages !== null && np >= totalPages) return;
                setPage(np);
                loadLeads(np, pageSize);
              }}
              disabled={totalPages !== null ? page >= totalPages - 1 : false}
              className={`px-3 py-1 rounded border ${totalPages !== null ? (page >= totalPages - 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-100") : "hover:bg-slate-100"}`}
            >
              Next
            </button>

            <span className="text-sm text-slate-600 ml-3">
              Page {page + 1}{totalPages ? ` of ${totalPages}` : ""} • {total ?? "?"} total
            </span>
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
              className="border rounded px-2 py-1 text-sm"
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detailLead && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-96 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{detailLead.companyName}</h3>
              <button onClick={() => setDetailLead(null)} className="text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-slate-700">Contact:</span> {detailLead.contactName}
              </div>
              {detailLead.contactEmail && (
                <div>
                  <span className="font-medium text-slate-700">Email:</span> {detailLead.contactEmail}
                </div>
              )}
              {detailLead.contactPhone && (
                <div>
                  <span className="font-medium text-slate-700">Phone:</span> {detailLead.contactPhone}
                </div>
              )}
              <div>
                <span className="font-medium text-slate-700">Stage:</span>
                <span className="ml-2 px-2 py-1 text-xs rounded bg-slate-100">
                  {detailLead.stage}
                </span>
              </div>
              {detailLead.source && (
                <div>
                  <span className="font-medium text-slate-700">Source:</span> {SOURCE_ICONS[detailLead.source]} {detailLead.source}
                </div>
              )}
              {detailLead.score !== null && detailLead.score !== undefined && (
                <div>
                  <span className="font-medium text-slate-700">Score:</span> {detailLead.score}%
                </div>
              )}
              {detailLead.expectedValue && (
                <div>
                  <span className="font-medium text-slate-700">Expected Value:</span> {detailLead.currency ?? "₦"}
                  {detailLead.expectedValue.toLocaleString()}
                </div>
              )}
              {detailLead.assignedOfficerId && (
                <div>
                  <span className="font-medium text-slate-700">Owner:</span> {detailLead.assignedOfficerId}
                </div>
              )}
              {detailLead.createdAt && (
                <div>
                  <span className="font-medium text-slate-700">Created:</span> {new Date(detailLead.createdAt).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setEditingLead(detailLead);
                  setDetailLead(null);
                  setShowEdit(true);
                }}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  setDeleteConfirm(detailLead.id);
                  setDetailLead(null);
                }}
                className="px-3 py-2 border border-red-600 text-red-600 rounded hover:bg-red-50 text-sm"
              >
                Delete
              </button>
              <button onClick={() => setDetailLead(null)} className="px-3 py-2 border rounded hover:bg-slate-100 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Delete Lead?</h3>
            <p className="text-slate-600 text-sm mb-4">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-3 py-2 border rounded hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLead(deleteConfirm)}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New/Edit Lead Modal */}
      {showNew && (
        <NewLeadModal
          isOpen={showNew}
          tenantSlug={ts}
          onClose={() => setShowNew(false)}
          onSuccess={() => {
            setShowNew(false);
            loadLeads();
          }}
        />
      )}

      {showEdit && editingLead && (
        <NewLeadModal
          isOpen={showEdit}
          tenantSlug={ts}
          initialData={editingLead}
          onClose={() => {
            setShowEdit(false);
            setEditingLead(null);
          }}
          onSuccess={() => {
            setShowEdit(false);
            setEditingLead(null);
            loadLeads();
          }}
        />
      )}
    </div>
  );
}
