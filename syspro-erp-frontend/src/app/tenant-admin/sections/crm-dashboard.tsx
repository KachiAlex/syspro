"use client";

import React, { useState } from "react";
import {
  Users,
  Target,
  TrendingUp,
  BarChart3,
  Plus,
  Download,
  UserPlus,
  CheckCircle,
  Eye,
  Edit2,
  Trash2,
  ChevronRight,
} from "lucide-react";
import {
  CreateLeadModal,
  CreateContactModal,
  CreateDealModal,
  DeleteConfirmModal,
  LeadFormData,
  ContactFormData,
  DealFormData,
} from "./crm-modals";

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  score: number;
  source: string;
  assignedTo: string;
  created: string;
}

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string;
  type: string;
  segment: string;
  engagement: number;
  created: string;
}

interface Deal {
  id: string;
  name: string;
  company: string;
  amount: number;
  stage: string;
  probability: number;
  closingDate: string;
  assignedTo: string;
}

export default function CRMDashboard({ tenantSlug, initialTab = "overview" }: { tenantSlug?: string | null; initialTab?: "overview" | "leads" | "contacts" | "deals" }) {
  const ts = tenantSlug ?? "kreatix-default";
  const [activeTab, setActiveTab] = useState<"overview" | "leads" | "contacts" | "deals">(initialTab);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Leads state
  const [leads, setLeads] = useState<Lead[]>([
    {
      id: "1",
      name: "John Smith",
      email: "john@techcorp.com",
      company: "Tech Corp",
      status: "Qualified",
      score: 85,
      source: "Website",
      assignedTo: "Alex Johnson",
      created: "2024-01-15",
    },
    {
      id: "2",
      name: "Sarah Johnson",
      email: "sarah@xyzinc.com",
      company: "XYZ Inc",
      status: "New",
      score: 72,
      source: "Email",
      assignedTo: "Sarah Williams",
      created: "2024-01-18",
    },
  ]);
  const [leadStatusFilter, setLeadStatusFilter] = useState("all");
  const [showCreateLeadModal, setShowCreateLeadModal] = useState(false);
  const [showDeleteLeadModal, setShowDeleteLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([
    {
      id: "1",
      name: "Jane Doe",
      email: "jane@acmecorp.com",
      company: "Acme Corp",
      type: "Customer",
      segment: "VIP",
      engagement: 95,
      created: "2024-01-10",
    },
  ]);
  const [contactTypeFilter, setContactTypeFilter] = useState("all");
  const [showCreateContactModal, setShowCreateContactModal] = useState(false);
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Deals state
  const [deals, setDeals] = useState<Deal[]>([
    {
      id: "1",
      name: "Enterprise Deal - ABC Corp",
      company: "ABC Corp",
      amount: 50000,
      stage: "Proposal",
      probability: 75,
      closingDate: "2024-03-15",
      assignedTo: "Alex Johnson",
    },
  ]);
  const [dealStageFilter, setDealStageFilter] = useState("all");
  const [showCreateDealModal, setShowCreateDealModal] = useState(false);
  const [showDeleteDealModal, setShowDeleteDealModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lead Handlers
  const handleCreateLead = async (data: LeadFormData) => {
    setIsSubmitting(true);
    try {
      const newLead: Lead = {
        id: Date.now().toString(),
        name: data.name,
        email: data.email,
        company: data.company,
        status: data.status,
        score: data.score,
        source: data.source,
        assignedTo: data.assignedTo || "Unassigned",
        created: new Date().toISOString().split("T")[0],
      };
      setLeads([newLead, ...leads]);
      setSuccessMessage("Lead created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead) return;
    setIsSubmitting(true);
    try {
      setLeads(leads.filter((l) => l.id !== selectedLead.id));
      setSuccessMessage("Lead deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsSubmitting(false);
      setSelectedLead(null);
    }
  };

  // Contact Handlers
  const handleCreateContact = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const newContact: Contact = {
        id: Date.now().toString(),
        name: data.name,
        email: data.email,
        company: data.company,
        type: data.type,
        segment: data.segment,
        engagement: Math.floor(Math.random() * 100),
        created: new Date().toISOString().split("T")[0],
      };
      setContacts([newContact, ...contacts]);
      setSuccessMessage("Contact created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    setIsSubmitting(true);
    try {
      setContacts(contacts.filter((c) => c.id !== selectedContact.id));
      setSuccessMessage("Contact deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsSubmitting(false);
      setSelectedContact(null);
    }
  };

  // Deal Handlers
  const handleCreateDeal = async (data: DealFormData) => {
    setIsSubmitting(true);
    try {
      const newDeal: Deal = {
        id: Date.now().toString(),
        name: data.name,
        company: data.company,
        amount: data.amount,
        stage: data.stage,
        probability: data.probability,
        closingDate: data.closingDate,
        assignedTo: data.assignedTo || "Unassigned",
      };
      setDeals([newDeal, ...deals]);
      setSuccessMessage("Deal created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDeal = async () => {
    if (!selectedDeal) return;
    setIsSubmitting(true);
    try {
      setDeals(deals.filter((d) => d.id !== selectedDeal.id));
      setSuccessMessage("Deal deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsSubmitting(false);
      setSelectedDeal(null);
    }
  };

  const handleExportLeads = () => {
    const csv = [
      ["Name", "Email", "Company", "Status", "Score", "Source", "Created"],
      ...leads.map((l) => [l.name, l.email, l.company, l.status, l.score, l.source, l.created]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    link.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const handleExportContacts = () => {
    const csv = [
      ["Name", "Email", "Company", "Type", "Segment", "Engagement", "Created"],
      ...contacts.map((c) => [c.name, c.email, c.company, c.type, c.segment, c.engagement, c.created]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    link.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const handleExportDeals = () => {
    const csv = [
      ["Name", "Company", "Amount", "Stage", "Probability", "Closing Date", "Assigned To"],
      ...deals.map((d) => [d.name, d.company, d.amount, d.stage, d.probability, d.closingDate, d.assignedTo]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    link.download = `deals-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">CRM Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage customer relationships, sales pipeline, and business growth</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-white rounded-lg shadow-sm">
        <div className="flex flex-wrap gap-0">
          {[
            { key: "overview" as const, label: "Overview", icon: BarChart3 },
            { key: "leads" as const, label: "Leads", icon: UserPlus },
            { key: "contacts" as const, label: "Contacts", icon: Users },
            { key: "deals" as const, label: "Deals", icon: Target },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="p-8 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Leads</p>
                    <p className="text-2xl font-bold text-gray-900">{leads.length}</p>
                    <p className="text-sm text-green-600">+12% from last month</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active Deals</p>
                    <p className="text-2xl font-bold text-gray-900">{deals.length}</p>
                    <p className="text-sm text-green-600">+8% from last month</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Pipeline Value</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${(deals.reduce((sum, d) => sum + d.amount, 0) / 1000).toFixed(0)}K
                    </p>
                    <p className="text-sm text-green-600">+23% from last month</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Contacts</p>
                    <p className="text-2xl font-bold text-gray-900">{contacts.length}</p>
                    <p className="text-sm text-red-600">-2% from last month</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowCreateLeadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition"
                >
                  Add New Lead <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowCreateDealModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition"
                >
                  Create Deal <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTab("leads")}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium transition"
                >
                  View All Leads <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between  mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
                <p className="text-gray-600">{leads.length} leads total</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateLeadModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                >
                  <Plus className="w-4 h-4" /> Add Lead
                </button>
                <button
                  onClick={handleExportLeads}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {["all", "New", "Contacted", "Qualified", "Converted"].map((status) => (
                <button
                  key={status}
                  onClick={() => setLeadStatusFilter(status.toLowerCase())}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    leadStatusFilter === status.toLowerCase()
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {status === "all" ? "All" : status}
                </button>
              ))}
            </div>

            {/* Leads Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Source</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leads
                    .filter((l) => leadStatusFilter === "all" || l.status.toLowerCase() === leadStatusFilter)
                    .map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{lead.name}</td>
                        <td className="px-6 py-4 text-gray-600">{lead.company}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            lead.status === "Qualified"
                              ? "bg-green-100 text-green-800"
                              : lead.status === "New"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">{lead.score}</td>
                        <td className="px-6 py-4 text-gray-600">{lead.source}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button className="p-1 hover:bg-gray-200 rounded transition">
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            <button className="p-1 hover:bg-gray-200 rounded transition">
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedLead(lead);
                                setShowDeleteLeadModal(true);
                              }}
                              className="p-1 hover:bg-red-100 rounded transition"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === "contacts" && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
                <p className="text-gray-600">{contacts.length} contacts total</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateContactModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                >
                  <Plus className="w-4 h-4" /> Add Contact
                </button>
                <button
                  onClick={handleExportContacts}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {["all", "Customer", "Prospect", "Partner", "Vendor"].map((type) => (
                <button
                  key={type}
                  onClick={() => setContactTypeFilter(type.toLowerCase())}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    contactTypeFilter === type.toLowerCase()
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {type === "all" ? "All" : type}
                </button>
              ))}
            </div>

            {/* Contacts Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Segment</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">Engagement</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {contacts
                    .filter((c) => contactTypeFilter === "all" || c.type.toLowerCase() === contactTypeFilter)
                    .map((contact) => (
                      <tr key={contact.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{contact.name}</td>
                        <td className="px-6 py-4 text-gray-600">{contact.company}</td>
                        <td className="px-6 py-4 text-gray-900">{contact.type}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            contact.segment === "VIP"
                              ? "bg-purple-100 text-purple-800"
                              : contact.segment === "Premium"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {contact.segment}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">{contact.engagement}%</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button className="p-1 hover:bg-gray-200 rounded transition">
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            <button className="p-1 hover:bg-gray-200 rounded transition">
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedContact(contact);
                                setShowDeleteContactModal(true);
                              }}
                              className="p-1 hover:bg-red-100 rounded transition"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Deals Tab */}
        {activeTab === "deals" && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Deals</h2>
                <p className="text-gray-600">${(deals.reduce((sum, d) => sum + d.amount, 0) / 1000).toFixed(0)}K pipeline</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateDealModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
                >
                  <Plus className="w-4 h-4" /> Create Deal
                </button>
                <button
                  onClick={handleExportDeals}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              {["all", "Lead", "Qualified", "Proposal", "Negotiation", "Closed Won"].map((stage) => (
                <button
                  key={stage}
                  onClick={() => setDealStageFilter(stage.toLowerCase())}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    dealStageFilter === stage.toLowerCase()
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {stage === "all" ? "All" : stage}
                </button>
              ))}
            </div>

            {/* Deals Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Deal</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Company</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Stage</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">Probability</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Closing Date</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deals
                    .filter((d) => dealStageFilter === "all" || d.stage.toLowerCase() === dealStageFilter)
                    .map((deal) => (
                      <tr key={deal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{deal.name}</td>
                        <td className="px-6 py-4 text-gray-600">{deal.company}</td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">${(deal.amount / 1000).toFixed(0)}K</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            deal.stage === "Proposal"
                              ? "bg-yellow-100 text-yellow-800"
                              : deal.stage === "Negotiation"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {deal.stage}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-900">{deal.probability}%</td>
                        <td className="px-6 py-4 text-gray-600">{deal.closingDate}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button className="p-1 hover:bg-gray-200 rounded transition">
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            <button className="p-1 hover:bg-gray-200 rounded transition">
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedDeal(deal);
                                setShowDeleteDealModal(true);
                              }}
                              className="p-1 hover:bg-red-100 rounded transition"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateLeadModal
        isOpen={showCreateLeadModal}
        onClose={() => setShowCreateLeadModal(false)}
        onSubmit={handleCreateLead}
        isLoading={isSubmitting}
      />

      <CreateContactModal
        isOpen={showCreateContactModal}
        onClose={() => setShowCreateContactModal(false)}
        onSubmit={handleCreateContact}
        isLoading={isSubmitting}
      />

      <CreateDealModal
        isOpen={showCreateDealModal}
        onClose={() => setShowCreateDealModal(false)}
        onSubmit={handleCreateDeal}
        isLoading={isSubmitting}
      />

      <DeleteConfirmModal
        isOpen={showDeleteLeadModal}
        onClose={() => {
          setShowDeleteLeadModal(false);
          setSelectedLead(null);
        }}
        onConfirm={handleDeleteLead}
        isLoading={isSubmitting}
        itemName={selectedLead?.name}
        itemType="Lead"
      />

      <DeleteConfirmModal
        isOpen={showDeleteContactModal}
        onClose={() => {
          setShowDeleteContactModal(false);
          setSelectedContact(null);
        }}
        onConfirm={handleDeleteContact}
        isLoading={isSubmitting}
        itemName={selectedContact?.name}
        itemType="Contact"
      />

      <DeleteConfirmModal
        isOpen={showDeleteDealModal}
        onClose={() => {
          setShowDeleteDealModal(false);
          setSelectedDeal(null);
        }}
        onConfirm={handleDeleteDeal}
        isLoading={isSubmitting}
        itemName={selectedDeal?.name}
        itemType="Deal"
      />
    </div>
  );
}
