"use client";

import React, { useEffect, useState } from "react";
import { Plus, Download, Filter, Grid3X3, List, Search, X, Edit2, AlertCircle } from "lucide-react";
import NewContactModal from "./NewContactModal";

type Contact = {
  id: string;
  company: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  source?: string | null;
  status?: string | null;
  tags?: string[];
  importedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ViewType = "table" | "grid";

const CONTACT_STATUSES = ["New", "Active", "Qualified", "Nurturing", "Unresponsive", "Closed"];

export default function ContactsPage({ tenantSlug }: { tenantSlug?: string | null }) {
  const ts = tenantSlug ;
  const [contacts, setContacts] = useState<Contact[]>([]);
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
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [allTags, setAllTags] = useState<string[]>([]);
  
  // UI
  const [viewType, setViewType] = useState<ViewType>("table");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const loadContacts = (p = page, size = pageSize) => {
    setLoading(true);
    setError(null);
    const offset = p * size;
    const params = new URLSearchParams({
      tenantSlug: ts,
      limit: String(size),
      offset: String(offset),
      ...(filterTag !== "all" && { tag: filterTag }),
    });

    fetch(`/api/crm/contacts?${params}`)
      .then((res) => res.json())
      .then((data) => {
        const contactList = Array.isArray(data.contacts) ? data.contacts : [];
        setContacts(contactList);
        setTotal(data.total || 0);

        // Extract unique tags
        const tags = new Set<string>();
        contactList.forEach((c: Contact) => {
          if (c.tags && Array.isArray(c.tags)) {
            c.tags.forEach((tag) => tags.add(tag));
          }
        });
        setAllTags(Array.from(tags).sort());
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load contacts");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadContacts(0, pageSize);
  }, [ts, filterTag]);

  const handleUpdate = async (id: string, updates: Partial<Contact>) => {
    try {
      const res = await fetch(`/api/crm/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setSuccess("Contact updated successfully");
        setShowEditModal(false);
        setSelectedContact(null);
        loadContacts(page, pageSize);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to update contact");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating contact");
    }
  };

  const handleCreateContact = async (contactData: any) => {
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: ts,
          contacts: [contactData],
        }),
      });

      if (res.ok) {
        setSuccess("Contact created successfully");
        setShowNewModal(false);
        loadContacts(0, pageSize);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Failed to create contact");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating contact");
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    if (searchTerm && !contact.company.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !contact.contactName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !contact.contactEmail?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterStatus !== "all" && contact.status !== filterStatus) {
      return false;
    }
    return true;
  });

  const handleExportContacts = () => {
    const headers = ["Company", "Contact Name", "Email", "Phone", "Source", "Status", "Tags", "Created"];
    const data = filteredContacts.map((c) => [
      c.company,
      c.contactName,
      c.contactEmail || "",
      c.contactPhone || "",
      c.source || "",
      c.status || "",
      c.tags?.join("; ") || "",
      new Date(c.createdAt ?? "").toLocaleDateString(),
    ]);

    const csv = [headers, ...data].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && contacts.length === 0) {
    return <div className="flex items-center justify-center h-96">Loading contacts...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Contacts</h2>
          <p className="text-sm text-gray-600">Manage your contact database</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportContacts}
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
            New
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

      {/* Filters */}
      <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by company, name, or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(0);
                }}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(0);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {allTags.length > 0 && (
            <select
              value={filterTag}
              onChange={(e) => {
                setFilterTag(e.target.value);
                setPage(0);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-1 border border-gray-300 rounded-lg p-1 bg-white">
            <button
              onClick={() => setViewType("table")}
              className={`p-2 rounded ${viewType === "table" ? "bg-gray-200" : "hover:bg-gray-100"}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewType("grid")}
              className={`p-2 rounded ${viewType === "grid" ? "bg-gray-200" : "hover:bg-gray-100"}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredContacts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No contacts found</p>
        </div>
      ) : viewType === "table" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-300">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Company</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Contact Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Source</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">Tags</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{contact.company}</td>
                  <td className="px-4 py-3 text-gray-700">{contact.contactName}</td>
                  <td className="px-4 py-3 text-gray-600">{contact.contactEmail || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{contact.contactPhone || "-"}</td>
                  <td className="px-4 py-3 text-gray-600">{contact.source || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                      {contact.status || "New"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {contact.tags && contact.tags.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {contact.tags.map((tag) => (
                          <span key={tag} className="inline-block px-2 py-1 text-xs bg-gray-200 text-gray-800 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        setSelectedContact(contact);
                        setShowEditModal(true);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{contact.company}</h3>
                  <p className="text-sm text-gray-600">{contact.contactName}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedContact(contact);
                    setShowEditModal(true);
                  }}
                  className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1 text-sm text-gray-600 mb-3">
                {contact.contactEmail && <p>📧 {contact.contactEmail}</p>}
                {contact.contactPhone && <p>📱 {contact.contactPhone}</p>}
                {contact.source && <p>Source: {contact.source}</p>}
              </div>
              <div className="flex justify-between items-center">
                <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                  {contact.status || "New"}
                </span>
                {contact.tags && contact.tags.length > 0 && (
                  <div className="flex gap-1">
                    {contact.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="px-1 py-0 text-xs bg-gray-200 text-gray-800 rounded">
                        {tag}
                      </span>
                    ))}
                    {contact.tags.length > 2 && <span className="text-xs text-gray-500">+{contact.tags.length - 2}</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages !== null && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-600">
            Page {page + 1} of {totalPages} ({total} total)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewModal && <NewContactModal onClose={() => setShowNewModal(false)} onSave={handleCreateContact} />}
      {showEditModal && selectedContact && (
        <NewContactModal
          isEdit
          initialData={selectedContact}
          onClose={() => {
            setShowEditModal(false);
            setSelectedContact(null);
          }}
          onSave={(data) => handleUpdate(selectedContact.id, data)}
        />
      )}
    </div>
  );
}
