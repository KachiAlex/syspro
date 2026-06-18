"use client";

import React, { useEffect, useState } from "react";
import { Plus, Download, Search, X, Edit2, Trash2, AlertCircle } from "lucide-react";
import NewDealModal from "./NewDealModal";

type Deal = {
  id: string;
  tenantSlug: string;
  customerId?: string | null;
  leadId?: string | null;
  stage: string;
  value: number;
  currency: string;
  probability?: number | null;
  expectedClose?: string | null;
  assignedOfficerId?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
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
const STAGE_COLORS: Record<string, string> = {
  prospecting: "bg-blue-50 border-blue-200",
  qualification: "bg-purple-50 border-purple-200",
  proposal: "bg-indigo-50 border-indigo-200",
  negotiation: "bg-orange-50 border-orange-200",
  closed_won: "bg-green-50 border-green-200",
  closed_lost: "bg-red-50 border-red-200",
};
const BADGE_COLORS: Record<string, string> = {
  prospecting: "bg-blue-100 text-blue-800",
  qualification: "bg-purple-100 text-purple-800",
  proposal: "bg-indigo-100 text-indigo-800",
  negotiation: "bg-orange-100 text-orange-800",
  closed_won: "bg-green-100 text-green-800",
  closed_lost: "bg-red-100 text-red-800",
};

export default function DealsPage({ tenantSlug }: { tenantSlug?: string | null }) {
  const ts = tenantSlug ;
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadDeals = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      tenantSlug: ts,
      limit: "1000",
      offset: "0",
    });

    fetch(`/api/crm/deals?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setDeals(Array.isArray(data.deals) ? data.deals : []);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load deals");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDeals();
  }, [ts]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/crm/deals/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: ts }),
      });

      if (res.ok) {
        setSuccess("Deal deleted successfully");
        setDeleteConfirm(null);
        loadDeals();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to delete deal");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting deal");
    }
  };

  const handleCreateDeal = async (dealData: any) => {
    try {
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: ts,
          ...dealData,
        }),
      });

      if (res.ok) {
        setSuccess("Deal created successfully");
        setShowNewModal(false);
        loadDeals();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to create deal");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating deal");
    }
  };

  const handleUpdateDeal = async (id: string, updates: any) => {
    try {
      const res = await fetch(`/api/crm/deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setSuccess("Deal updated successfully");
        setShowEditModal(false);
        setSelectedDeal(null);
        loadDeals();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to update deal");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating deal");
    }
  };

  const handleExportDeals = () => {
    const headers = ["Stage", "Value", "Currency", "Probability", "Expected Close", "Status", "Created"];
    const data = groupedDeals.flatMap((group) =>
      group.deals.map((deal) => [
        STAGE_LABELS[deal.stage],
        deal.value,
        deal.currency,
        deal.probability ? `${deal.probability}%` : "-",
        deal.expectedClose ? new Date(deal.expectedClose).toLocaleDateString() : "-",
        deal.status,
        new Date(deal.createdAt).toLocaleDateString(),
      ])
    );

    const csv = [headers, ...data].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const filteredDeals = deals.filter((deal) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        deal.leadId?.toLowerCase().includes(search) ||
        deal.customerId?.toLowerCase().includes(search) ||
        deal.id.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const groupedDeals = DEAL_STAGES.map((stage) => ({
    stage,
    deals: filteredDeals.filter((deal) => deal.stage === stage),
    count: filteredDeals.filter((deal) => deal.stage === stage).length,
    total: filteredDeals.filter((deal) => deal.stage === stage).reduce((sum, deal) => sum + deal.value, 0),
  }));

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading deals...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pipeline</h2>
          <p className="text-sm text-gray-600">Manage your sales deals and pipeline</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportDeals}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Deal
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search/Filter */}
      <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by deal ID, lead, or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {groupedDeals.map((column) => (
            <div key={column.stage} className={`flex-none w-96 rounded-lg border-2 ${STAGE_COLORS[column.stage]} p-4`}>
              <div className="mb-4 pb-3 border-b border-current border-opacity-20">
                <h3 className="font-semibold text-gray-900">{STAGE_LABELS[column.stage]}</h3>
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>{column.count} deals</span>
                  <span>
                    {column.total.toLocaleString()} {column.deals.length > 0 ? column.deals[0].currency : "₦"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {column.deals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">No deals</div>
                ) : (
                  column.deals.map((deal) => (
                    <div key={deal.id} className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {deal.value.toLocaleString()} {deal.currency}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {deal.leadId ? `Lead: ${deal.leadId.slice(0, 8)}...` : deal.customerId ? `Customer: ${deal.customerId.slice(0, 8)}...` : "No reference"}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setSelectedDeal(deal);
                              setShowEditModal(true);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(deal.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {deal.probability !== null && (
                        <div className="mb-2">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-gray-600">Probability</span>
                            <span className="text-xs font-medium text-gray-900">{deal.probability}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${BADGE_COLORS[deal.stage]}`} style={{ width: `${deal.probability}%` }} />
                          </div>
                        </div>
                      )}

                      {deal.expectedClose && (
                        <div className="text-xs text-gray-600">
                          📅 {new Date(deal.expectedClose).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm">
            <h3 className="font-semibold text-gray-900 mb-2">Delete Deal?</h3>
            <p className="text-sm text-gray-600 mb-6">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewModal && <NewDealModal onClose={() => setShowNewModal(false)} onSave={handleCreateDeal} />}
      {showEditModal && selectedDeal && (
        <NewDealModal
          isEdit
          initialData={selectedDeal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDeal(null);
          }}
          onSave={(data) => handleUpdateDeal(selectedDeal.id, data)}
        />
      )}
    </div>
  );
}
