"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
} from "lucide-react";
import {
  CreateLeadModal,
  CreateContactModal,
  CreateDealModal,
  DeleteConfirmModal,
  LeadFormData,
  ContactFormData,
  DealFormData,
  LEAD_STAGE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  DEAL_STAGE_OPTIONS,
} from "./crm-modals";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { apiClient } from "@/lib/api-client";
import { CRM_LEAD_STAGES, CRM_LEAD_SOURCES, CRM_PIPELINE_STAGES } from "@/lib/crm/types";

const LEAD_STAGE_LABELS = Object.fromEntries(LEAD_STAGE_OPTIONS.map((option) => [option.value, option.label]));
const LEAD_SOURCE_LABELS = Object.fromEntries(LEAD_SOURCE_OPTIONS.map((option) => [option.value, option.label]));
const DEAL_STAGE_LABELS = Object.fromEntries(DEAL_STAGE_OPTIONS.map((option) => [option.value, option.label]));

type LeadStage = (typeof CRM_LEAD_STAGES)[number];
type LeadSource = (typeof CRM_LEAD_SOURCES)[number];
type DealStage = (typeof CRM_PIPELINE_STAGES)[number];

type LeadFilterKey = "all" | LeadStage;
type DealFilterKey = "all" | DealStage;
type ContactFilterKey = "all" | "has_email" | "missing_email";

interface LeadRow {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  stage: LeadStage;
  score: number;
  source: LeadSource;
  assignedTo: string;
  createdAt: string;
}

interface ContactRow {
  id: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  company: string;
  status: string | null;
  source: string | null;
  importedAt: string;
}

interface DealRow {
  id: string;
  name: string;
  company: string;
  amount: number;
  currency: string;
  stage: DealStage;
  probability: number | null;
  closingDate: string | null;
  assignedTo: string;
}

type LeadsResponse = {
  leads: Array<{
    id: string;
    companyName: string;
    contactName: string;
    contactEmail: string | null;
    stage: LeadStage;
    score: number;
    source: LeadSource;
    assignedOfficerId: string | null;
    createdAt: string;
  }>;
  total: number;
};

type ContactsResponse = {
  contacts: Array<{
    id: string;
    company: string;
    contactName: string;
    contactEmail: string | null;
    status: string | null;
    source: string | null;
    importedAt: string;
  }>;
  total: number;
};

type DealsResponse = {
  deals: Array<{
    id: string;
    stage: DealStage;
    value: number;
    currency: string;
    probability: number | null;
    expectedClose: string | null;
    assignedOfficerId: string | null;
    customerId: string | null;
    leadId: string | null;
  }>;
  total: number;
};

type DashboardStats = {
  totalLeads: number;
  totalContacts: number;
  totalDeals: number;
  pipelineValue: number;
};

const DEFAULT_STATS: DashboardStats = {
  totalLeads: 0,
  totalContacts: 0,
  totalDeals: 0,
  pipelineValue: 0,
};

type ModalMode = "create" | "edit" | "view";

function toLeadRow(lead: LeadsResponse["leads"][number]): LeadRow {
  return {
    id: lead.id,
    companyName: lead.companyName,
    contactName: lead.contactName,
    contactEmail: lead.contactEmail,
    contactPhone: (lead as any).contactPhone ?? null,
    stage: lead.stage,
    score: lead.score,
    source: lead.source,
    assignedTo: lead.assignedOfficerId || "Unassigned",
    createdAt: lead.createdAt,
  };
}

function toContactRow(contact: ContactsResponse["contacts"][number]): ContactRow {
  return {
    id: contact.id,
    company: contact.company,
    contactName: contact.contactName,
    contactEmail: contact.contactEmail,
    contactPhone: (contact as any).contactPhone ?? null,
    status: contact.status,
    source: contact.source,
    importedAt: contact.importedAt,
  };
}

function toDealRow(deal: DealsResponse["deals"][number]): DealRow {
  return {
    id: deal.id,
    name: deal.leadId || deal.customerId || `Deal ${deal.id.slice(0, 6)}`,
    company: deal.customerId || "N/A",
    amount: deal.value ?? 0,
    currency: deal.currency ?? "₦",
    stage: deal.stage,
    probability: deal.probability,
    closingDate: deal.expectedClose,
    assignedTo: deal.assignedOfficerId || "Unassigned",
  };
}

async function fetchLeads(params: { tenantSlug: string; regionId: string; branchId: string }) {
  const searchParams = new URLSearchParams({ tenantSlug: params.tenantSlug, limit: "50" });
  if (params.regionId) searchParams.set("regionId", params.regionId);
  if (params.branchId) searchParams.set("branchId", params.branchId);
  const response = await apiClient.get<LeadsResponse>(`/crm/leads?${searchParams.toString()}`);
  return response.data;
}

async function fetchContacts(params: { tenantSlug: string }) {
  const searchParams = new URLSearchParams({ tenantSlug: params.tenantSlug, limit: "50" });
  const response = await apiClient.get<ContactsResponse>(`/crm/contacts?${searchParams.toString()}`);
  return response.data;
}

async function fetchDeals(params: { tenantSlug: string }) {
  const searchParams = new URLSearchParams({ tenantSlug: params.tenantSlug, limit: "50" });
  const response = await apiClient.get<DealsResponse>(`/crm/deals?${searchParams.toString()}`);
  return response.data;
}

async function createLead(payload: {
  tenantSlug: string;
  regionId: string;
  branchId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  source: LeadSource;
  stage: LeadStage;
  assignedOfficerId?: string;
  expectedValue?: number;
  currency?: string;
}) {
  const response = await apiClient.post<{ lead: LeadsResponse["leads"][number] }>("/crm/leads", payload);
  return response.data.lead;
}

async function deleteLeadRequest(id: string, tenantSlug: string) {
  await apiClient.delete(`/crm/leads/${id}?tenantSlug=${tenantSlug}`);
}

async function updateLeadRequest(
  id: string,
  payload: {
    tenantSlug: string;
    companyName: string;
    contactName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    stage: LeadStage;
    source: LeadSource;
    assignedOfficerId: string | null;
    score: number;
  }
) {
  const response = await apiClient.patch<{ lead: LeadsResponse["leads"][number] }>(`/crm/leads/${id}?tenantSlug=${payload.tenantSlug}`, payload);
  return response.data.lead;
}

async function createContact(payload: {
  tenantSlug: string;
  company: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  source?: string;
  status?: string;
}) {
  const response = await apiClient.post<{ contacts: ContactsResponse["contacts"] }>("/crm/contacts", {
    tenantSlug: payload.tenantSlug,
    contacts: [
      {
        company: payload.company,
        contactName: payload.contactName,
        contactEmail: payload.contactEmail,
        contactPhone: payload.contactPhone,
        source: payload.source,
        status: payload.status,
      },
    ],
  });
  return response.data.contacts[0];
}

async function deleteContactRequest(id: string) {
  await apiClient.delete(`/crm/contacts/${id}`);
}

async function updateContactRequest(
  id: string,
  payload: {
    tenantSlug: string;
    company?: string;
    contactName?: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    source?: string;
    status?: string;
  }
) {
  const response = await apiClient.patch<{ contact: ContactsResponse["contacts"][number] }>(`/crm/contacts/${id}`, payload);
  return response.data.contact;
}

async function createDeal(payload: {
  tenantSlug: string;
  customerId?: string;
  leadId?: string;
  stage: DealStage;
  value: number;
  currency?: string;
  probability?: number;
  expectedClose?: string;
  assignedOfficerId?: string;
}) {
  const response = await apiClient.post<{ deal: DealsResponse["deals"][number] }>("/crm/deals", payload);
  return response.data.deal;
}

async function deleteDealRequest(id: string) {
  await apiClient.delete(`/crm/deals/${id}`);
}

async function updateDealRequest(
  id: string,
  payload: {
    stage?: DealStage;
    value?: number;
    currency?: string;
    probability?: number | null;
    expectedClose?: string | null;
    assignedOfficerId?: string;
    status?: string;
  }
) {
  const response = await apiClient.patch<{ deal: DealsResponse["deals"][number] }>(`/crm/deals/${id}`, payload);
  return response.data.deal;
}

function formatCurrency(value: number, currencySymbol: string) {
  const formatted = Math.abs(value) >= 1000 ? `${currencySymbol}${(value / 1000).toFixed(1)}K` : `${currencySymbol}${value.toLocaleString()}`;
  return formatted.replace(/\.0K$/, "K");
}

export default function CRMDashboard({ tenantSlug, initialTab = "overview" }: { tenantSlug?: string | null; initialTab?: "overview" | "leads" | "contacts" | "deals" }) {
  const tenantContext = useTenantContext();
  const effectiveTenant = tenantSlug ?? tenantContext.tenantSlug;
  const regionId = tenantContext.regionId;
  const branchId = tenantContext.branchId;

  const [activeTab, setActiveTab] = useState<"overview" | "leads" | "contacts" | "deals">(initialTab);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [leadFilter, setLeadFilter] = useState<LeadFilterKey>("all");
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [leadModalMode, setLeadModalMode] = useState<ModalMode>("create");
  const [showDeleteLeadModal, setShowDeleteLeadModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null);

  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [contactFilter, setContactFilter] = useState<ContactFilterKey>("all");
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactModalMode, setContactModalMode] = useState<ModalMode>("create");
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactRow | null>(null);

  const [deals, setDeals] = useState<DealRow[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [dealFilter, setDealFilter] = useState<DealFilterKey>("all");
  const [isDealModalOpen, setIsDealModalOpen] = useState(false);
  const [dealModalMode, setDealModalMode] = useState<ModalMode>("create");
  const [showDeleteDealModal, setShowDeleteDealModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);

  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const pipelineCurrency = deals[0]?.currency ?? "₦";

  const loadData = useCallback(async () => {
    if (!effectiveTenant) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [leadData, contactData, dealData] = await Promise.all([
        fetchLeads({ tenantSlug: effectiveTenant, regionId, branchId }),
        fetchContacts({ tenantSlug: effectiveTenant }),
        fetchDeals({ tenantSlug: effectiveTenant }),
      ]);

      const normalizedLeads: LeadRow[] = leadData.leads.map(toLeadRow);

      const normalizedContacts: ContactRow[] = contactData.contacts.map(toContactRow);

      const normalizedDeals: DealRow[] = dealData.deals.map(toDealRow);

      setLeads(normalizedLeads);
      setTotalLeads(leadData.total);
      setContacts(normalizedContacts);
      setTotalContacts(contactData.total);
      setDeals(normalizedDeals);
      setTotalDeals(dealData.total);

      setStats({
        totalLeads: leadData.total,
        totalContacts: contactData.total,
        totalDeals: dealData.total,
        pipelineValue: normalizedDeals.reduce((sum, deal) => sum + deal.amount, 0),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load CRM data");
    } finally {
      setIsLoading(false);
    }
  }, [effectiveTenant, regionId, branchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const leadFilterOptions = useMemo(
    () => [{ value: "all", label: "All" }, ...LEAD_STAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))],
    []
  );

  const contactFilterOptions = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "has_email", label: "Has Email" },
      { value: "missing_email", label: "Missing Email" },
    ],
    []
  );

  const dealFilterOptions = useMemo(
    () => [{ value: "all", label: "All" }, ...DEAL_STAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))],
    []
  );

  const filteredLeads = useMemo(() => {
    if (leadFilter === "all") return leads;
    return leads.filter((lead) => lead.stage === leadFilter);
  }, [leadFilter, leads]);

  const filteredContacts = useMemo(() => {
    if (contactFilter === "has_email") return contacts.filter((contact) => Boolean(contact.contactEmail));
    if (contactFilter === "missing_email") return contacts.filter((contact) => !contact.contactEmail);
    return contacts;
  }, [contactFilter, contacts]);

  const filteredDeals = useMemo(() => {
    if (dealFilter === "all") return deals;
    return deals.filter((deal) => deal.stage === dealFilter);
  }, [dealFilter, deals]);

  const totalPipelineValue = useMemo(
    () => deals.reduce((sum, deal) => sum + deal.amount, 0),
    [deals]
  );

  const leadModalInitialData = useMemo(() => {
    if (!selectedLead || leadModalMode === "create") return undefined;
    return {
      name: selectedLead.contactName,
      email: selectedLead.contactEmail ?? "",
      company: selectedLead.companyName,
      phone: selectedLead.contactPhone ?? "",
      status: selectedLead.stage,
      source: selectedLead.source,
      score: selectedLead.score,
      assignedTo: selectedLead.assignedTo === "Unassigned" ? "" : selectedLead.assignedTo,
    } satisfies Partial<LeadFormData>;
  }, [selectedLead, leadModalMode]);

  const contactModalInitialData = useMemo(() => {
    if (!selectedContact || contactModalMode === "create") return undefined;
    return {
      name: selectedContact.contactName,
      email: selectedContact.contactEmail ?? "",
      company: selectedContact.company,
      phone: selectedContact.contactPhone ?? "",
      type: selectedContact.source ?? "Customer",
      segment: selectedContact.status ?? "Standard",
      notes: "",
    } satisfies Partial<ContactFormData>;
  }, [selectedContact, contactModalMode]);

  const dealModalInitialData = useMemo(() => {
    if (!selectedDeal || dealModalMode === "create") return undefined;
    return {
      name: selectedDeal.name,
      company: selectedDeal.company === "N/A" ? "" : selectedDeal.company,
      amount: selectedDeal.amount,
      stage: selectedDeal.stage,
      assignedTo: selectedDeal.assignedTo === "Unassigned" ? "" : selectedDeal.assignedTo,
      closingDate: selectedDeal.closingDate ?? new Date().toISOString().split("T")[0],
      probability: selectedDeal.probability ?? 0,
    } satisfies Partial<DealFormData>;
  }, [selectedDeal, dealModalMode]);

  const openLeadModal = (mode: ModalMode, lead?: LeadRow) => {
    setLeadModalMode(mode);
    setSelectedLead(lead ?? null);
    setIsLeadModalOpen(true);
  };

  const closeLeadModal = () => {
    setIsLeadModalOpen(false);
    setSelectedLead(null);
    setLeadModalMode("create");
  };

  const openContactModal = (mode: ModalMode, contact?: ContactRow) => {
    setContactModalMode(mode);
    setSelectedContact(contact ?? null);
    setIsContactModalOpen(true);
  };

  const closeContactModal = () => {
    setIsContactModalOpen(false);
    setSelectedContact(null);
    setContactModalMode("create");
  };

  const openDealModal = (mode: ModalMode, deal?: DealRow) => {
    setDealModalMode(mode);
    setSelectedDeal(deal ?? null);
    setIsDealModalOpen(true);
  };

  const closeDealModal = () => {
    setIsDealModalOpen(false);
    setSelectedDeal(null);
    setDealModalMode("create");
  };

  // Lead Handlers
  const handleCreateLead = async (data: LeadFormData) => {
    if (!effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await createLead({
        tenantSlug: effectiveTenant,
        regionId,
        branchId,
        companyName: data.company || data.name,
        contactName: data.name,
        contactEmail: data.email,
        contactPhone: data.phone,
        source: data.source as LeadSource,
        stage: data.status as LeadStage,
        assignedOfficerId: data.assignedTo || undefined,
        expectedValue: data.score ? data.score * 1000 : undefined,
        currency: "₦",
      });

      const newLead: LeadRow = toLeadRow(created);

      setLeads((prev) => [newLead, ...prev]);
      setTotalLeads((prev) => prev + 1);
      setStats((prev) => ({ ...prev, totalLeads: prev.totalLeads + 1 }));
      setSuccessMessage("Lead created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLead = async (data: LeadFormData) => {
    if (!selectedLead || !effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await updateLeadRequest(selectedLead.id, {
        tenantSlug: effectiveTenant,
        companyName: data.company || data.name,
        contactName: data.name,
        contactEmail: data.email || null,
        contactPhone: data.phone || null,
        stage: data.status as LeadStage,
        source: data.source as LeadSource,
        assignedOfficerId: data.assignedTo || null,
        score: data.score,
      });

      const updatedRow = toLeadRow(updated);
      setLeads((prev) => prev.map((lead) => (lead.id === updatedRow.id ? updatedRow : lead)));
      setSuccessMessage("Lead updated successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update lead");
      throw error;
    } finally {
      setIsSubmitting(false);
      setSelectedLead(null);
      setLeadModalMode("create");
    }
  };

  const handleLeadModalSubmit = async (data: LeadFormData) => {
    if (leadModalMode === "edit" && selectedLead) {
      await handleUpdateLead(data);
    } else if (leadModalMode === "create") {
      await handleCreateLead(data);
    }
  };

  const handleDeleteLead = async () => {
    if (!selectedLead || !effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteLeadRequest(selectedLead.id, effectiveTenant);
      setLeads((prev) => prev.filter((lead) => lead.id !== selectedLead.id));
      setTotalLeads((prev) => Math.max(prev - 1, 0));
      setStats((prev) => ({ ...prev, totalLeads: Math.max(prev.totalLeads - 1, 0) }));
      setSuccessMessage("Lead deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete lead");
    } finally {
      setIsSubmitting(false);
      setSelectedLead(null);
      setLeadModalMode("create");
    }
  };

  // Contact Handlers
  const handleCreateContact = async (data: ContactFormData) => {
    if (!effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await createContact({
        tenantSlug: effectiveTenant,
        company: data.company || data.name,
        contactName: data.name,
        contactEmail: data.email,
        contactPhone: data.phone,
        source: data.type,
        status: data.segment,
      });

      const newContact: ContactRow = toContactRow(created);

      setContacts((prev) => [newContact, ...prev]);
      setTotalContacts((prev) => prev + 1);
      setStats((prev) => ({ ...prev, totalContacts: prev.totalContacts + 1 }));
      setSuccessMessage("Contact created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create contact");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateContact = async (data: ContactFormData) => {
    if (!selectedContact || !effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await updateContactRequest(selectedContact.id, {
        tenantSlug: effectiveTenant,
        company: data.company,
        contactName: data.name,
        contactEmail: data.email || null,
        contactPhone: data.phone || null,
        source: data.type,
        status: data.segment,
      });

      const updatedRow = toContactRow(updated);
      setContacts((prev) => prev.map((contact) => (contact.id === updatedRow.id ? updatedRow : contact)));
      setSuccessMessage("Contact updated successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update contact");
      throw error;
    } finally {
      setIsSubmitting(false);
      setSelectedContact(null);
      setContactModalMode("create");
    }
  };

  const handleContactModalSubmit = async (data: ContactFormData) => {
    if (contactModalMode === "edit" && selectedContact) {
      await handleUpdateContact(data);
    } else if (contactModalMode === "create") {
      await handleCreateContact(data);
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedContact) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteContactRequest(selectedContact.id);
      setContacts((prev) => prev.filter((contact) => contact.id !== selectedContact.id));
      setTotalContacts((prev) => Math.max(prev - 1, 0));
      setStats((prev) => ({ ...prev, totalContacts: Math.max(prev.totalContacts - 1, 0) }));
      setSuccessMessage("Contact deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete contact");
    } finally {
      setIsSubmitting(false);
      setSelectedContact(null);
      setContactModalMode("create");
    }
  };

  // Deal Handlers
  const handleCreateDeal = async (data: DealFormData) => {
    if (!effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const created = await createDeal({
        tenantSlug: effectiveTenant,
        stage: data.stage as DealStage,
        value: data.amount,
        currency: "₦",
        probability: data.probability,
        expectedClose: data.closingDate,
        assignedOfficerId: data.assignedTo || undefined,
        customerId: data.company || undefined,
      });

      const newDeal = {
        ...toDealRow(created),
        name: data.name || created.leadId || created.customerId || `Deal ${created.id.slice(0, 6)}`,
        company: data.company || created.customerId || "N/A",
      } satisfies DealRow;

      setDeals((prev) => [newDeal, ...prev]);
      setTotalDeals((prev) => prev + 1);
      setStats((prev) => ({
        ...prev,
        totalDeals: prev.totalDeals + 1,
        pipelineValue: prev.pipelineValue + newDeal.amount,
      }));
      setSuccessMessage("Deal created successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create deal");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateDeal = async (data: DealFormData) => {
    if (!selectedDeal) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await updateDealRequest(selectedDeal.id, {
        stage: data.stage as DealStage,
        value: data.amount,
        currency: selectedDeal.currency,
        probability: data.probability,
        expectedClose: data.closingDate || null,
        assignedOfficerId: data.assignedTo || undefined,
      });

      const updatedRow = {
        ...toDealRow(updated),
        name: data.name || selectedDeal.name,
        company: data.company || updated.customerId || "N/A",
      } satisfies DealRow;

      setDeals((prev) =>
        prev.map((deal) => (deal.id === updatedRow.id ? updatedRow : deal))
      );
      setStats((prev) => ({
        ...prev,
        pipelineValue: prev.pipelineValue - selectedDeal.amount + updatedRow.amount,
      }));
      setSuccessMessage("Deal updated successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update deal");
      throw error;
    } finally {
      setIsSubmitting(false);
      setSelectedDeal(null);
      setDealModalMode("create");
    }
  };

  const handleDealModalSubmit = async (data: DealFormData) => {
    if (dealModalMode === "edit" && selectedDeal) {
      await handleUpdateDeal(data);
    } else if (dealModalMode === "create") {
      await handleCreateDeal(data);
    }
  };

  const handleDeleteDeal = async () => {
    if (!selectedDeal) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteDealRequest(selectedDeal.id);
      setDeals((prev) => prev.filter((deal) => deal.id !== selectedDeal.id));
      setTotalDeals((prev) => Math.max(prev - 1, 0));
      setStats((prev) => ({
        ...prev,
        totalDeals: Math.max(prev.totalDeals - 1, 0),
        pipelineValue: Math.max(prev.pipelineValue - selectedDeal.amount, 0),
      }));
      setSuccessMessage("Deal deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete deal");
    } finally {
      setIsSubmitting(false);
      setSelectedDeal(null);
      setDealModalMode("create");
    }
  };

  const handleExportLeads = () => {
    const csv = [
      ["Contact Name", "Company", "Stage", "Score", "Source", "Assigned To", "Created"],
      ...filteredLeads.map((lead) => [
        lead.contactName,
        lead.companyName,
        LEAD_STAGE_LABELS[lead.stage] ?? lead.stage,
        lead.score,
        LEAD_SOURCE_LABELS[lead.source] ?? lead.source,
        lead.assignedTo,
        lead.createdAt,
      ]),
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
      ["Contact Name", "Company", "Email", "Status", "Source", "Imported"],
      ...filteredContacts.map((contact) => [
        contact.contactName,
        contact.company,
        contact.contactEmail ?? "",
        contact.status ?? "",
        contact.source ?? "",
        contact.importedAt,
      ]),
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
      ["Deal", "Company", "Amount", "Stage", "Probability", "Closing Date", "Assigned"],
      ...filteredDeals.map((deal) => [
        deal.name,
        deal.company,
        `${deal.currency}${deal.amount}`,
        DEAL_STAGE_LABELS[deal.stage] ?? deal.stage,
        deal.probability ?? "",
        deal.closingDate ?? "",
        deal.assignedTo,
      ]),
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
      {/* Alerts */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-sm text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-800">{errorMessage}</p>
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
          <button
            onClick={loadData}
            className="ml-auto mr-4 my-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
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
                    <p className="text-2xl font-bold text-gray-900">{stats.totalLeads}</p>
                    <p className="text-xs text-gray-500">Showing last 50 records</p>
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
                    <p className="text-2xl font-bold text-gray-900">{stats.totalDeals}</p>
                    <p className="text-xs text-gray-500">In all pipeline stages</p>
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
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.pipelineValue, pipelineCurrency)}</p>
                    <p className="text-xs text-gray-500">Currency based on recorded deals</p>
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
                    <p className="text-2xl font-bold text-gray-900">{stats.totalContacts}</p>
                    <p className="text-xs text-gray-500">Imported & synced contacts</p>
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
                  onClick={() => openLeadModal("create")}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 text-gray-700 font-medium transition"
                >
                  Add New Lead <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openDealModal("create")}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 text-gray-700 font-medium transition"
                >
                  Create Deal <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTab("leads")}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 text-gray-700 font-medium transition"
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Leads</h2>
                <p className="text-gray-600">{filteredLeads.length} shown • {totalLeads} total</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openLeadModal("create")}
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
            <div className="flex flex-wrap gap-2">
              {leadFilterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLeadFilter(option.value as LeadFilterKey)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    leadFilter === option.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Leads Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Stage</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Assigned</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLeads.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                        No leads match the selected filters.
                      </td>
                    </tr>
                  )}
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <div className="flex flex-col">
                          <span>{lead.contactName}</span>
                          {lead.contactEmail && <span className="text-xs text-gray-500">{lead.contactEmail}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{lead.companyName}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                          {LEAD_STAGE_LABELS[lead.stage] ?? lead.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">{lead.score}</td>
                      <td className="px-6 py-4 text-gray-600">{LEAD_SOURCE_LABELS[lead.source] ?? lead.source}</td>
                      <td className="px-6 py-4 text-gray-600">{lead.assignedTo}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openLeadModal("view", lead)}
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openLeadModal("edit", lead)}
                          >
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
                <p className="text-gray-600">{filteredContacts.length} shown • {totalContacts} total</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openContactModal("create")}
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
            <div className="flex flex-wrap gap-2">
              {contactFilterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setContactFilter(option.value as ContactFilterKey)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    contactFilter === option.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Contacts Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">Source</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredContacts.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                        No contacts yet. Import or create a new contact to get started.
                      </td>
                    </tr>
                  )}
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{contact.contactName}</td>
                      <td className="px-6 py-4 text-gray-600">{contact.company}</td>
                      <td className="px-6 py-4 text-gray-600">{contact.contactEmail ?? "—"}</td>
                      <td className="px-6 py-4 text-gray-600">{contact.status ?? "—"}</td>
                      <td className="px-6 py-4 text-gray-600">{contact.source ?? "—"}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openContactModal("view", contact)}
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openContactModal("edit", contact)}
                          >
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Deals</h2>
                <p className="text-gray-600">{filteredDeals.length} shown • {totalDeals} total • {formatCurrency(totalPipelineValue, pipelineCurrency)} pipeline</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openDealModal("create")}
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
            <div className="flex flex-wrap gap-2">
              {dealFilterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDealFilter(option.value as DealFilterKey)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    dealFilter === option.value
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {option.label}
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
                  {filteredDeals.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                        No deals yet. Create a deal to begin tracking your pipeline.
                      </td>
                    </tr>
                  )}
                  {filteredDeals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{deal.name}</td>
                      <td className="px-6 py-4 text-gray-600">{deal.company}</td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">
                        {formatCurrency(deal.amount, deal.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-green-50 text-green-700">
                          {DEAL_STAGE_LABELS[deal.stage] ?? deal.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-gray-900">{deal.probability ?? "—"}%</td>
                      <td className="px-6 py-4 text-gray-600">{deal.closingDate ?? "—"}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openDealModal("view", deal)}
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openDealModal("edit", deal)}
                          >
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

      {/* Loading overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span className="text-sm text-gray-600">Syncing CRM data…</span>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreateLeadModal
        isOpen={isLeadModalOpen}
        mode={leadModalMode}
        initialData={leadModalInitialData}
        onClose={closeLeadModal}
        onSubmit={handleLeadModalSubmit}
        isLoading={isSubmitting}
      />

      <CreateContactModal
        isOpen={isContactModalOpen}
        mode={contactModalMode}
        initialData={contactModalInitialData}
        onClose={closeContactModal}
        onSubmit={handleContactModalSubmit}
        isLoading={isSubmitting}
      />

      <CreateDealModal
        isOpen={isDealModalOpen}
        mode={dealModalMode}
        initialData={dealModalInitialData}
        onClose={closeDealModal}
        onSubmit={handleDealModalSubmit}
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
        itemName={selectedLead?.contactName}
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
        itemName={selectedContact?.contactName}
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
