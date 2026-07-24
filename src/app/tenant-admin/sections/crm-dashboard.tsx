"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  Target,
  TrendingUp,
  BarChart3,
  Plus,
  Download,
  Upload,
  UserPlus,
  CheckCircle,
  Eye,
  Edit2,
  Trash2,
  ChevronRight,
  AlertTriangle,
  ArrowRightCircle,
  Building2,
} from "lucide-react";
import {
  CreateLeadModal,
  CreateContactModal,
  CreateDealModal,
  DeleteConfirmModal,
  ImportContactsModal,
  ConvertToLeadModal,
  ConvertToCustomerModal,
  CreateCustomerModal,
  ImportCustomersModal,
  LeadFormData,
  ContactFormData,
  DealFormData,
  ImportedContactRow,
  ImportedCustomerRow,
  CustomerFormData,
  ConvertToLeadFormData,
  ConvertToCustomerFormData,
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
    name: string | null;
    stage: DealStage;
    value: number;
    currency: string;
    probability: number | null;
    expectedClose: string | null;
    assignedOfficerId: string | null;
    customerId: string | null;
    leadId: string | null;
    contactId: string | null;
  }>;
  total: number;
};

type CustomersResponse = {
  customers: Array<{
    id: string;
    name: string;
    primaryContact: Record<string, unknown> | null;
    status: string | null;
    regionId: string;
    branchId: string;
    createdAt: string;
  }>;
  total: number;
};

interface CustomerRow {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
  createdAt: string;
}

type DashboardStats = {
  totalLeads: number;
  totalContacts: number;
  totalDeals: number;
  totalCustomers: number;
  pipelineValue: number;
  conversionRate: number;
  totalConverted: number;
};

const DEFAULT_STATS: DashboardStats = {
  totalLeads: 0,
  totalContacts: 0,
  totalDeals: 0,
  totalCustomers: 0,
  pipelineValue: 0,
  conversionRate: 0,
  totalConverted: 0,
};

function toCustomerRow(c: CustomersResponse["customers"][number]): CustomerRow {
  const pc = c.primaryContact as any;
  return {
    id: c.id,
    name: c.name,
    contactName: pc ? [pc.firstName, pc.lastName].filter(Boolean).join(" ") || pc.name || "" : "",
    contactEmail: pc?.email ?? "",
    contactPhone: pc?.phone ?? "",
    status: c.status ?? "active",
    createdAt: c.createdAt,
  };
}

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
    name: deal.name || `Deal ${deal.id.slice(0, 6)}`,
    company: deal.customerId || "N/A",
    amount: deal.value ?? 0,
    currency: deal.currency ?? "₦",
    stage: deal.stage,
    probability: deal.probability,
    closingDate: deal.expectedClose,
    assignedTo: deal.assignedOfficerId || "Unassigned",
  };
}

// Same-origin fetch helper for all CRM API routes (/api/crm/...)
async function crmFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function fetchLeads(params: { tenantSlug: string; viewMode?: string }) {
  const searchParams = new URLSearchParams({ tenantSlug: params.tenantSlug, limit: "50" });
  if (params.viewMode) searchParams.set("viewMode", params.viewMode);
  try {
    return await crmFetch<LeadsResponse>(`/crm/leads?${searchParams.toString()}`);
  } catch (error) {
    console.error('Failed to fetch leads:', error);
    return { leads: [], total: 0 };
  }
}

async function fetchContacts(params: { tenantSlug: string; viewMode?: string }) {
  const searchParams = new URLSearchParams({ tenantSlug: params.tenantSlug, limit: "50" });
  if (params.viewMode) searchParams.set("viewMode", params.viewMode);
  try {
    return await crmFetch<ContactsResponse>(`/crm/contacts?${searchParams.toString()}`);
  } catch (error) {
    console.error('Failed to fetch contacts:', error);
    return { contacts: [], total: 0 };
  }
}

async function fetchDeals(params: { tenantSlug: string; viewMode?: string }) {
  const searchParams = new URLSearchParams({ tenantSlug: params.tenantSlug, limit: "50" });
  if (params.viewMode) searchParams.set("viewMode", params.viewMode);
  try {
    return await crmFetch<DealsResponse>(`/crm/deals?${searchParams.toString()}`);
  } catch (error) {
    console.error('Failed to fetch deals:', error);
    return { deals: [], total: 0 };
  }
}

async function fetchCustomers(params: { tenantSlug: string }) {
  const searchParams = new URLSearchParams({ tenantSlug: params.tenantSlug, limit: "50" });
  try {
    return await crmFetch<CustomersResponse>(`/crm/customers?${searchParams.toString()}`);
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return { customers: [], total: 0 };
  }
}

async function createCustomerRequest(payload: {
  tenantSlug: string;
  name: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  status: string;
}) {
  const data = await crmFetch<{ customer: CustomersResponse["customers"][number] }>("/crm/customers", { method: "POST", body: JSON.stringify(payload) });
  return data.customer;
}

async function updateCustomerRequest(id: string, payload: { tenantSlug: string; name?: string; status?: string; primaryContact?: Record<string, unknown> }) {
  const data = await crmFetch<{ customer: CustomersResponse["customers"][number] }>(`/crm/customers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  return data.customer;
}

async function deleteCustomerRequest(id: string, tenantSlug: string) {
  await crmFetch(`/crm/customers/${id}?tenantSlug=${tenantSlug}`, { method: "DELETE" });
}

async function importCustomersRequest(tenantSlug: string, rows: ImportedCustomerRow[]) {
  const results: CustomersResponse["customers"] = [];
  for (const r of rows) {
    const c = await createCustomerRequest({ tenantSlug, name: r.name, contactFirstName: r.contactFirstName, contactLastName: r.contactLastName, contactEmail: r.contactEmail, contactPhone: r.contactPhone, status: "active" });
    results.push(c);
  }
  return results;
}

async function fetchDashboard(params: { tenantSlug: string; viewMode?: string }) {
  try {
    const searchParams = new URLSearchParams({ tenantSlug: params.tenantSlug });
    if (params.viewMode) searchParams.set("viewMode", params.viewMode);
    return await crmFetch<{
      payload: {
        totals: {
          totalLeads: number;
          totalCustomers: number;
          conversionRate: number;
          totalConverted: number;
          recentConverted: number;
        };
      };
    }>(`/crm/dashboard?${searchParams.toString()}`);
  } catch (error) {
    console.error("Failed to fetch dashboard:", error);
    return null;
  }
}

async function fetchActivities(params: { tenantSlug: string; limit?: number }) {
  try {
    return await crmFetch<{ activities: Array<{ id: string; entityType: string; action: string; description: string | null; createdAt: string }> }>(
      `/crm/activities?tenantSlug=${params.tenantSlug}&limit=${params.limit ?? 15}`
    );
  } catch (error) {
    console.error("Failed to fetch activities:", error);
    return { activities: [] };
  }
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
  const data = await crmFetch<{ lead: LeadsResponse["leads"][number] }>("/crm/leads", { method: "POST", body: JSON.stringify(payload) });
  return data.lead;
}

async function deleteLeadRequest(id: string, tenantSlug: string) {
  await crmFetch(`/crm/leads/${id}?tenantSlug=${tenantSlug}`, { method: "DELETE" });
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
  const data = await crmFetch<{ lead: LeadsResponse["leads"][number] }>(`/crm/leads/${id}?tenantSlug=${payload.tenantSlug}`, { method: "PATCH", body: JSON.stringify(payload) });
  return data.lead;
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
  const data = await crmFetch<{ contact: ContactsResponse["contacts"][number] }>("/crm/contacts", { method: "POST", body: JSON.stringify(payload) });
  return data.contact;
}

async function importContacts(tenantSlug: string, rows: ImportedContactRow[]) {
  const contacts = rows
    .map((r) => {
      const contactName =
        [r.firstName, r.lastName].filter(Boolean).join(" ") ||
        r.company ||
        r.email ||
        "Unknown";
      const company = r.company || contactName;
      return {
        company,
        contactName,
        contactEmail: r.email || null,
        contactPhone: r.phone || null,
      };
    })
    .filter((c) => c.contactName.length > 0 && c.company.length > 0);

  if (contacts.length === 0) throw new Error("No valid contacts to import after processing.");

  const data = await crmFetch<{ contacts: ContactsResponse["contacts"] }>("/crm/contacts", {
    method: "POST",
    body: JSON.stringify({ tenantSlug, contacts }),
  });
  return data.contacts;
}

async function convertContactToLead(
  contactId: string,
  tenantSlug: string,
  data: ConvertToLeadFormData,
  regionId?: string,
  branchId?: string,
) {
  const result = await crmFetch<{ lead: LeadsResponse["leads"][number] }>(
    `/crm/contacts/${contactId}/convert-to-lead`,
    { method: "POST", body: JSON.stringify({
      tenantSlug,
      regionId: regionId || "default",
      branchId: branchId || "default",
      stage: data.stage,
      source: data.source,
      expectedValue: data.expectedValue ? Number(data.expectedValue) : undefined,
      notes: data.notes || undefined,
    }) }
  );
  return result.lead;
}

async function convertLeadToCustomer(
  leadId: string,
  tenantSlug: string,
  data: ConvertToCustomerFormData
) {
  const result = await crmFetch<{ customer: unknown; leadId: string }>(
    `/crm/leads/${leadId}/convert-to-customer`,
    { method: "POST", body: JSON.stringify({
      tenantSlug,
      regionId: data.regionId,
      branchId: data.branchId,
      customerName: data.customerName,
      status: data.status,
    }) }
  );
  return result;
}

async function deleteContactRequest(id: string, tenantSlug: string) {
  await crmFetch(`/crm/contacts/${id}?tenantSlug=${tenantSlug}`, { method: "DELETE" });
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
  const data = await crmFetch<{ contact: ContactsResponse["contacts"][number] }>(`/crm/contacts/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  return data.contact;
}

async function createDeal(payload: {
  tenantSlug: string;
  customerId?: string;
  leadId?: string;
  contactId?: string;
  name?: string;
  stage: DealStage;
  value: number;
  currency?: string;
  probability?: number;
  expectedClose?: string;
  assignedOfficerId?: string;
}) {
  const data = await crmFetch<{ deal: DealsResponse["deals"][number] }>("/crm/deals", { method: "POST", body: JSON.stringify(payload) });
  return data.deal;
}

async function deleteDealRequest(id: string) {
  await crmFetch(`/crm/deals/${id}`, { method: "DELETE" });
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
  const data = await crmFetch<{ deal: DealsResponse["deals"][number] }>(`/crm/deals/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  return data.deal;
}

function formatCurrency(value: number, currencySymbol: string) {
  const formatted = Math.abs(value) >= 1000 ? `${currencySymbol}${(value / 1000).toFixed(1)}K` : `${currencySymbol}${value.toLocaleString()}`;
  return formatted.replace(/\.0K$/, "K");
}

export type CrmViewMode = "all" | "team" | "mine";

export default function CRMDashboard({ tenantSlug, initialTab = "overview", viewMode, onViewModeChange }: {
  tenantSlug?: string | null;
  initialTab?: "overview" | "leads" | "contacts" | "deals" | "customers";
  viewMode?: CrmViewMode;
  onViewModeChange?: (mode: CrmViewMode) => void;
}) {
  const tenantContext = useTenantContext();
  const effectiveTenant = tenantSlug ?? tenantContext.tenantSlug;
  const regionId = tenantContext.regionId;
  const branchId = tenantContext.branchId;
  const [internalViewMode, setInternalViewMode] = useState<CrmViewMode | undefined>(viewMode);
  const effectiveViewMode = viewMode ?? internalViewMode;

  const [activeTab, setActiveTab] = useState<"overview" | "leads" | "contacts" | "deals" | "customers">(initialTab);
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
  const [dealPrefill, setDealPrefill] = useState<Partial<DealFormData> | null>(null);

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerModalMode, setCustomerModalMode] = useState<ModalMode>("create");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [showDeleteCustomerModal, setShowDeleteCustomerModal] = useState(false);
  const [isImportCustomersModalOpen, setIsImportCustomersModalOpen] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConvertToLeadModalOpen, setIsConvertToLeadModalOpen] = useState(false);
  const [contactToConvert, setContactToConvert] = useState<ContactRow | null>(null);
  const [isConvertToCustomerModalOpen, setIsConvertToCustomerModalOpen] = useState(false);
  const [leadToConvert, setLeadToConvert] = useState<LeadRow | null>(null);

  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [activities, setActivities] = useState<Array<{ id: string; entityType: string; action: string; description: string | null; createdAt: string }>>([]);
  const pipelineCurrency = deals[0]?.currency ?? "₦";

  const loadData = useCallback(async () => {
    if (!effectiveTenant) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [leadData, contactData, dealData, customerData, dashboardData, activityData] = await Promise.all([
        fetchLeads({ tenantSlug: effectiveTenant, viewMode: effectiveViewMode }),
        fetchContacts({ tenantSlug: effectiveTenant, viewMode: effectiveViewMode }),
        fetchDeals({ tenantSlug: effectiveTenant, viewMode: effectiveViewMode }),
        fetchCustomers({ tenantSlug: effectiveTenant }),
        fetchDashboard({ tenantSlug: effectiveTenant, viewMode: effectiveViewMode }),
        fetchActivities({ tenantSlug: effectiveTenant }),
      ]);

      const leadArray = Array.isArray(leadData?.leads) ? leadData.leads : [];
      const contactArray = Array.isArray(contactData?.contacts) ? contactData.contacts : [];
      const dealArray = Array.isArray(dealData?.deals) ? dealData.deals : [];
      const customerArray = Array.isArray(customerData?.customers) ? customerData.customers : [];

      const normalizedLeads: LeadRow[] = leadArray.map(toLeadRow);
      const normalizedContacts: ContactRow[] = contactArray.map(toContactRow);
      const normalizedDeals: DealRow[] = dealArray.map(toDealRow);
      const normalizedCustomers: CustomerRow[] = customerArray.map(toCustomerRow);

      setLeads(normalizedLeads);
      setTotalLeads(leadData?.total ?? 0);
      setContacts(normalizedContacts);
      setTotalContacts(contactData?.total ?? 0);
      setDeals(normalizedDeals);
      setTotalDeals(dealData?.total ?? 0);
      setCustomers(normalizedCustomers);
      setTotalCustomers(customerData?.total ?? 0);

      setStats({
        totalLeads: leadData?.total ?? 0,
        totalContacts: contactData?.total ?? 0,
        totalDeals: dealData?.total ?? 0,
        totalCustomers: customerData?.total ?? 0,
        pipelineValue: normalizedDeals.reduce((sum, deal) => sum + deal.amount, 0),
        conversionRate: dashboardData?.payload?.totals?.conversionRate ?? 0,
        totalConverted: dashboardData?.payload?.totals?.totalConverted ?? 0,
      });

      setActivities(activityData?.activities ?? []);
    } catch (error) {
      console.error('CRM data loading error:', error);
      setErrorMessage("Failed to load CRM data. Please try again.");
      // Set default empty state on error
      setLeads([]);
      setContacts([]);
      setDeals([]);
      setCustomers([]);
      setStats(DEFAULT_STATS);
    } finally {
      setIsLoading(false);
    }
  }, [effectiveTenant, effectiveViewMode]);

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
    if (dealModalMode === "create" && dealPrefill) return dealPrefill;
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
  }, [selectedDeal, dealModalMode, dealPrefill]);

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

  const openDealModal = (mode: ModalMode, deal?: DealRow, prefill?: Partial<DealFormData>) => {
    setDealModalMode(mode);
    setSelectedDeal(deal ?? null);
    setDealPrefill(prefill ?? null);
    setIsDealModalOpen(true);
  };

  const closeDealModal = () => {
    setIsDealModalOpen(false);
    setSelectedDeal(null);
    setDealPrefill(null);
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

  const handleImportContacts = async (rows: ImportedContactRow[]) => {
    if (!effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const imported = await importContacts(effectiveTenant, rows);
      const newRows = imported.map(toContactRow);
      setContacts((prev) => [...newRows, ...prev]);
      setTotalContacts((prev) => prev + newRows.length);
      setStats((prev) => ({ ...prev, totalContacts: prev.totalContacts + newRows.length }));
      setSuccessMessage(`${newRows.length} contact${newRows.length !== 1 ? "s" : ""} imported successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Import failed");
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvertContactToLead = async (data: ConvertToLeadFormData) => {
    if (!contactToConvert || !effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const lead = await convertContactToLead(contactToConvert.id, effectiveTenant, data, regionId, branchId);
      const newLead = toLeadRow(lead);
      setLeads((prev) => [newLead, ...prev]);
      setTotalLeads((prev) => prev + 1);
      setStats((prev) => ({ ...prev, totalLeads: prev.totalLeads + 1 }));
      setSuccessMessage(`${contactToConvert.contactName} converted to lead successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Conversion failed");
      throw error;
    } finally {
      setIsSubmitting(false);
      setContactToConvert(null);
      setIsConvertToLeadModalOpen(false);
    }
  };

  const handleConvertLeadToCustomer = async (data: ConvertToCustomerFormData) => {
    if (!leadToConvert || !effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await convertLeadToCustomer(leadToConvert.id, effectiveTenant, data);
      setLeads((prev) =>
        prev.map((l) => l.id === leadToConvert.id ? { ...l, stage: "converted" as LeadStage } : l)
      );
      // Refresh customer list to show the newly converted customer
      const freshCustomers = await fetchCustomers({ tenantSlug: effectiveTenant });
      const freshDashboard = await fetchDashboard({ tenantSlug: effectiveTenant });
      setCustomers(Array.isArray(freshCustomers?.customers) ? freshCustomers.customers.map(toCustomerRow) : []);
      setTotalCustomers(freshCustomers?.total ?? 0);
      setStats((prev) => ({
        ...prev,
        totalCustomers: freshCustomers?.total ?? 0,
        conversionRate: freshDashboard?.payload?.totals?.conversionRate ?? prev.conversionRate,
        totalConverted: freshDashboard?.payload?.totals?.totalConverted ?? (prev.totalConverted + 1),
      }));
      setSuccessMessage(`${leadToConvert.contactName} converted to customer successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Conversion failed");
      throw error;
    } finally {
      setIsSubmitting(false);
      setLeadToConvert(null);
      setIsConvertToCustomerModalOpen(false);
    }
  };

  const openCustomerModal = (mode: ModalMode, customer?: CustomerRow) => {
    setCustomerModalMode(mode);
    setSelectedCustomer(customer ?? null);
    setIsCustomerModalOpen(true);
  };

  const handleCustomerModalSubmit = async (data: CustomerFormData) => {
    if (!effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (customerModalMode === "edit" && selectedCustomer) {
        const updated = await updateCustomerRequest(selectedCustomer.id, {
          tenantSlug: effectiveTenant,
          name: data.name,
          status: data.status,
          primaryContact: { firstName: data.contactFirstName, lastName: data.contactLastName, name: [data.contactFirstName, data.contactLastName].filter(Boolean).join(" "), email: data.contactEmail, phone: data.contactPhone },
        });
        setCustomers((prev) => prev.map((c) => c.id === selectedCustomer.id ? toCustomerRow(updated) : c));
        setSuccessMessage("Customer updated successfully!");
      } else {
        const created = await createCustomerRequest({ tenantSlug: effectiveTenant, name: data.name, contactFirstName: data.contactFirstName, contactLastName: data.contactLastName, contactEmail: data.contactEmail, contactPhone: data.contactPhone, status: data.status });
        setCustomers((prev) => [toCustomerRow(created), ...prev]);
        setTotalCustomers((prev) => prev + 1);
        setStats((prev) => ({ ...prev, totalCustomers: prev.totalCustomers + 1 }));
        setSuccessMessage("Customer added successfully!");
      }
      setTimeout(() => setSuccessMessage(null), 3000);
      setIsCustomerModalOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save customer");
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer || !effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteCustomerRequest(selectedCustomer.id, effectiveTenant);
      setCustomers((prev) => prev.filter((c) => c.id !== selectedCustomer.id));
      setTotalCustomers((prev) => Math.max(prev - 1, 0));
      setStats((prev) => ({ ...prev, totalCustomers: Math.max(prev.totalCustomers - 1, 0) }));
      setSuccessMessage("Customer deleted successfully!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to delete customer");
    } finally {
      setIsSubmitting(false);
      setSelectedCustomer(null);
      setShowDeleteCustomerModal(false);
    }
  };

  const handleImportCustomers = async (rows: ImportedCustomerRow[]) => {
    if (!effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const imported = await importCustomersRequest(effectiveTenant, rows);
      const newRows = imported.map(toCustomerRow);
      setCustomers((prev) => [...newRows, ...prev]);
      setTotalCustomers((prev) => prev + newRows.length);
      setStats((prev) => ({ ...prev, totalCustomers: prev.totalCustomers + newRows.length }));
      setSuccessMessage(`${newRows.length} customer${newRows.length !== 1 ? "s" : ""} imported successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Import failed");
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportCustomers = () => {
    const csv = [
      ["Customer Name", "Contact", "Email", "Phone", "Status", "Created"],
      ...customers.map((c) => [c.name, c.contactName, c.contactEmail, c.contactPhone, c.status, c.createdAt]),
    ].map((row) => row.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
    link.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const handleDeleteContact = async () => {
    if (!selectedContact || !effectiveTenant) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await deleteContactRequest(selectedContact.id, effectiveTenant);
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
        customerId: data.customerId || undefined,
        leadId: data.leadId || undefined,
        name: data.name || undefined,
      });

      const newDeal = {
        ...toDealRow(created),
        name: data.name || created.name || `Deal ${created.id.slice(0, 6)}`,
        company: data.company || "N/A",
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
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-sm text-green-800 font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-theme-text-primary">CRM Dashboard</h1>
          <p className="text-theme-text-secondary mt-1">Manage customer relationships, sales pipeline, and business growth</p>
        </div>
        {effectiveViewMode && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-theme-text-secondary">View:</span>
            <div className="flex bg-theme-muted border border-theme-border rounded-lg overflow-hidden">
              {([
                { key: "mine" as const, label: "My" },
                { key: "team" as const, label: "Team" },
                { key: "all" as const, label: "All" },
              ] as const).map((opt) => {
              const active = effectiveViewMode === opt.key;
              const handleViewChange = onViewModeChange ?? setInternalViewMode;
              return (
                <button
                  key={opt.key}
                  onClick={() => handleViewChange(opt.key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-blue-600 text-white" : "text-theme-text-primary hover:bg-gray-100"
                  }`}
                >
                  {opt.label}
                </button>
              );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 bg-theme-muted rounded-xl border border-theme-border">
        <div className="flex flex-wrap gap-0">
          {[
            { key: "overview" as const, label: "Overview", icon: BarChart3 },
            { key: "leads" as const, label: "Leads", icon: UserPlus },
            { key: "contacts" as const, label: "Contacts", icon: Users },
            { key: "customers" as const, label: "Customers", icon: Building2 },
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
                    ? "border-blue-500 text-theme-accent"
                    : "border-transparent text-theme-text-primary hover:text-theme-text-secondary hover:bg-gray-50"
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
          <button
            onClick={loadData}
            className="ml-auto mr-4 my-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-theme-text-secondary hover:text-theme-text-secondary"
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-theme-muted rounded-xl border border-theme-border">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="p-8 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-theme-text-secondary">Total Leads</p>
                    <p className="text-2xl font-bold text-theme-text-primary">{stats.totalLeads}</p>
                    <p className="text-xs text-theme-text-tertiary">Showing last 50 records</p>
                  </div>
                  <div className="w-12 h-12 bg-theme-accent-subtle rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-theme-accent" />
                  </div>
                </div>
              </div>

              <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-theme-text-secondary">Active Deals</p>
                    <p className="text-2xl font-bold text-theme-text-primary">{stats.totalDeals}</p>
                    <p className="text-xs text-theme-text-tertiary">In all pipeline stages</p>
                  </div>
                  <div className="w-12 h-12 bg-theme-success-bg rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-green-400" />
                  </div>
                </div>
              </div>

              <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-theme-text-secondary">Pipeline Value</p>
                    <p className="text-2xl font-bold text-theme-text-primary">{formatCurrency(stats.pipelineValue, pipelineCurrency)}</p>
                    <p className="text-xs text-theme-text-tertiary">Currency based on recorded deals</p>
                  </div>
                  <div className="w-12 h-12 bg-theme-accent-subtle rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-theme-accent" />
                  </div>
                </div>
              </div>

              <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-theme-text-secondary">Customers</p>
                    <p className="text-2xl font-bold text-theme-text-primary">{stats.totalCustomers}</p>
                    <p className="text-xs text-theme-text-tertiary">Active & prospect customers</p>
                  </div>
                  <div className="w-12 h-12 bg-theme-accent-subtle rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-theme-accent" />
                  </div>
                </div>
              </div>

              <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-theme-text-secondary">Conversion Rate</p>
                    <p className="text-2xl font-bold text-theme-text-primary">{stats.conversionRate}%</p>
                    <p className="text-xs text-theme-text-tertiary">{stats.totalConverted} leads → customers</p>
                  </div>
                  <div className="w-12 h-12 bg-theme-success-bg rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
              <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Quick Actions</h3>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => openLeadModal("create")}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-muted border border-gray-200 rounded-lg hover:bg-blue-50 text-theme-text-primary font-medium transition"
                >
                  Add New Lead <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openDealModal("create")}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-muted border border-gray-200 rounded-lg hover:bg-blue-50 text-theme-text-primary font-medium transition"
                >
                  Create Deal <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setActiveTab("leads")}
                  className="flex items-center gap-2 px-4 py-2 bg-theme-muted border border-gray-200 rounded-lg hover:bg-blue-50 text-theme-text-primary font-medium transition"
                >
                  View All Leads <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="bg-theme-muted rounded-xl border border-theme-border p-6">
              <h3 className="text-lg font-semibold text-theme-text-primary mb-4">Recent Activity</h3>
              {activities.length === 0 ? (
                <p className="text-sm text-theme-text-tertiary">No activity yet. Convert contacts, create deals, or manage leads to see activity here.</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity) => {
                    const icon = activity.entityType === "deal" ? Target
                      : activity.entityType === "lead" ? UserPlus
                      : activity.entityType === "customer" ? Building2
                      : Users;
                    const color = activity.entityType === "deal" ? "text-green-400 bg-green-100"
                      : activity.entityType === "lead" ? "text-theme-accent bg-blue-100"
                      : activity.entityType === "customer" ? "text-theme-accent bg-purple-100"
                      : "text-theme-text-secondary bg-gray-100";
                    const Icon = icon;
                    const timeAgo = (() => {
                      const diff = Date.now() - new Date(activity.createdAt).getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 1) return "just now";
                      if (mins < 60) return `${mins}m ago`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs}h ago`;
                      const days = Math.floor(hrs / 24);
                      return `${days}d ago`;
                    })();
                    return (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-theme-text-primary">{activity.description || activity.action.replace(/_/g, " ")}</p>
                          <p className="text-xs text-theme-text-tertiary">{timeAgo}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === "leads" && (
          <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-theme-text-primary">Leads</h2>
                <p className="text-theme-text-secondary">{filteredLeads.length} shown • {totalLeads} total</p>
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
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-theme-text-primary rounded-lg hover:bg-gray-50 font-medium transition"
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
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Leads Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-theme-bg border-b border-theme-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Stage</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-theme-text-primary">Score</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Source</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Assigned</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-primary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredLeads.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-theme-text-tertiary">
                        No leads match the selected filters.
                      </td>
                    </tr>
                  )}
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-theme-text-primary">
                        <div className="flex flex-col">
                          <span>{lead.contactName}</span>
                          {lead.contactEmail && <span className="text-xs text-theme-text-tertiary">{lead.contactEmail}</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-theme-text-secondary">{lead.companyName}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                          {LEAD_STAGE_LABELS[lead.stage] ?? lead.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-theme-text-primary">{lead.score}</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{LEAD_SOURCE_LABELS[lead.source] ?? lead.source}</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{lead.assignedTo}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            title="View"
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openLeadModal("view", lead)}
                          >
                            <Eye className="w-4 h-4 text-theme-text-secondary" />
                          </button>
                          <button
                            title="Edit"
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openLeadModal("edit", lead)}
                          >
                            <Edit2 className="w-4 h-4 text-theme-text-secondary" />
                          </button>
                          <button
                            title="Create Deal"
                            className="p-1 hover:bg-green-100 rounded transition"
                            onClick={() => {
                              openDealModal("create", undefined, {
                                name: `Deal - ${lead.companyName}`,
                                company: lead.companyName,
                                leadId: lead.id,
                              });
                            }}
                          >
                            <Target className="w-4 h-4 text-green-400" />
                          </button>
                          <button
                            title="Convert to Customer"
                            className="p-1 hover:bg-purple-100 rounded transition"
                            onClick={() => {
                              setLeadToConvert(lead);
                              setIsConvertToCustomerModalOpen(true);
                            }}
                          >
                            <Building2 className="w-4 h-4 text-theme-accent" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => {
                              setSelectedLead(lead);
                              setShowDeleteLeadModal(true);
                            }}
                            className="p-1 hover:bg-red-100 rounded transition"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
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
                <h2 className="text-2xl font-bold text-theme-text-primary">Contacts</h2>
                <p className="text-theme-text-secondary">{filteredContacts.length} shown • {totalContacts} total</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => openContactModal("create")}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
                >
                  <Plus className="w-4 h-4" /> Add Contact
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition"
                >
                  <Upload className="w-4 h-4" /> Import CSV
                </button>
                <button
                  onClick={handleExportContacts}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-theme-text-primary rounded-lg hover:bg-gray-50 font-medium transition"
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
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Contacts Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-theme-bg border-b border-theme-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Source</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-primary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredContacts.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-theme-text-tertiary">
                        No contacts yet. Import or create a new contact to get started.
                      </td>
                    </tr>
                  )}
                  {filteredContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-theme-text-primary">{contact.contactName}</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{contact.company}</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{contact.contactEmail ?? "—"}</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{contact.status ?? "—"}</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{contact.source ?? "—"}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            title="View"
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openContactModal("view", contact)}
                          >
                            <Eye className="w-4 h-4 text-theme-text-secondary" />
                          </button>
                          <button
                            title="Edit"
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openContactModal("edit", contact)}
                          >
                            <Edit2 className="w-4 h-4 text-theme-text-secondary" />
                          </button>
                          <button
                            title="Convert to Lead"
                            className="p-1 hover:bg-green-100 rounded transition"
                            onClick={() => {
                              setContactToConvert(contact);
                              setIsConvertToLeadModalOpen(true);
                            }}
                          >
                            <ArrowRightCircle className="w-4 h-4 text-green-400" />
                          </button>
                          <button
                            title="Delete"
                            onClick={() => {
                              setSelectedContact(contact);
                              setShowDeleteContactModal(true);
                            }}
                            className="p-1 hover:bg-red-100 rounded transition"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
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

        {/* Customers Tab */}
        {activeTab === "customers" && (
          <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-theme-text-primary">Customers</h2>
                <p className="text-theme-text-secondary">{customers.length} shown • {totalCustomers} total</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => openCustomerModal("create")}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition">
                  <Plus className="w-4 h-4" /> Add Customer
                </button>
                <button onClick={() => setIsImportCustomersModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition">
                  <Upload className="w-4 h-4" /> Import CSV
                </button>
                <button onClick={handleExportCustomers}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-theme-text-primary rounded-lg hover:bg-gray-50 font-medium transition">
                  <Download className="w-4 h-4" /> Export
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-theme-bg border-b border-theme-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Primary Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Status</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-primary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {customers.length === 0 && !isLoading && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-theme-text-tertiary">No customers yet. Add manually, import from CSV, or convert a lead.</td></tr>
                  )}
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-theme-text-primary">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-theme-accent" />
                          </div>
                          {customer.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-theme-text-secondary">{customer.contactName || "—"}</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{customer.contactEmail || "—"}</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{customer.contactPhone || "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          customer.status === "active" ? "bg-green-100 text-green-700"
                          : customer.status === "prospect" ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-theme-text-secondary"
                        }`}>{customer.status}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button title="View" className="p-1 hover:bg-gray-200 rounded transition" onClick={() => openCustomerModal("view", customer)}>
                            <Eye className="w-4 h-4 text-theme-text-secondary" />
                          </button>
                          <button title="Edit" className="p-1 hover:bg-gray-200 rounded transition" onClick={() => openCustomerModal("edit", customer)}>
                            <Edit2 className="w-4 h-4 text-theme-text-secondary" />
                          </button>
                          <button title="Delete" className="p-1 hover:bg-red-100 rounded transition" onClick={() => { setSelectedCustomer(customer); setShowDeleteCustomerModal(true); }}>
                            <Trash2 className="w-4 h-4 text-red-400" />
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
                <h2 className="text-2xl font-bold text-theme-text-primary">Deals</h2>
                <p className="text-theme-text-secondary">{filteredDeals.length} shown • {totalDeals} total • {formatCurrency(totalPipelineValue, pipelineCurrency)} pipeline</p>
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
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-theme-text-primary rounded-lg hover:bg-gray-50 font-medium transition"
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
                      : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Deals Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full">
                <thead className="bg-theme-bg border-b border-theme-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Deal</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Company</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-theme-text-primary">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Stage</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-theme-text-primary">Probability</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-primary">Closing Date</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-theme-text-primary">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredDeals.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-theme-text-tertiary">
                        No deals yet. Create a deal to begin tracking your pipeline.
                      </td>
                    </tr>
                  )}
                  {filteredDeals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-theme-text-primary">{deal.name}</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{deal.company}</td>
                      <td className="px-6 py-4 text-right font-semibold text-theme-text-primary">
                        {formatCurrency(deal.amount, deal.currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 rounded text-xs font-semibold bg-green-50 text-green-700">
                          {DEAL_STAGE_LABELS[deal.stage] ?? deal.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-theme-text-primary">{deal.probability ?? "—"}%</td>
                      <td className="px-6 py-4 text-theme-text-secondary">{deal.closingDate ?? "—"}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openDealModal("view", deal)}
                          >
                            <Eye className="w-4 h-4 text-theme-text-secondary" />
                          </button>
                          <button
                            className="p-1 hover:bg-gray-200 rounded transition"
                            onClick={() => openDealModal("edit", deal)}
                          >
                            <Edit2 className="w-4 h-4 text-theme-text-secondary" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDeal(deal);
                              setShowDeleteDealModal(true);
                            }}
                            className="p-1 hover:bg-red-100 rounded transition"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
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
        <div className="fixed inset-0 bg-theme-muted/40 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-6 w-6 text-theme-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span className="text-sm text-theme-text-secondary">Syncing CRM data…</span>
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
        leads={leads.map((l) => ({ id: l.id, companyName: l.companyName, contactName: l.contactName }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
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

      <ImportContactsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImportContacts}
        isLoading={isSubmitting}
      />

      <ConvertToLeadModal
        isOpen={isConvertToLeadModalOpen}
        contactName={contactToConvert?.contactName ?? ""}
        company={contactToConvert?.company ?? ""}
        onClose={() => { setIsConvertToLeadModalOpen(false); setContactToConvert(null); }}
        onSubmit={handleConvertContactToLead}
        isLoading={isSubmitting}
      />

      <ConvertToCustomerModal
        isOpen={isConvertToCustomerModalOpen}
        leadContactName={leadToConvert?.contactName ?? ""}
        companyName={leadToConvert?.companyName ?? ""}
        onClose={() => { setIsConvertToCustomerModalOpen(false); setLeadToConvert(null); }}
        onSubmit={handleConvertLeadToCustomer}
        isLoading={isSubmitting}
      />

      <CreateCustomerModal
        isOpen={isCustomerModalOpen}
        mode={customerModalMode}
        initialData={selectedCustomer ? {
          name: selectedCustomer.name,
          contactFirstName: selectedCustomer.contactName.split(" ")[0] ?? "",
          contactLastName: selectedCustomer.contactName.split(" ").slice(1).join(" ") ?? "",
          contactEmail: selectedCustomer.contactEmail,
          contactPhone: selectedCustomer.contactPhone,
          status: selectedCustomer.status,
        } : undefined}
        onClose={() => { setIsCustomerModalOpen(false); setSelectedCustomer(null); }}
        onSubmit={handleCustomerModalSubmit}
        isLoading={isSubmitting}
      />

      <ImportCustomersModal
        isOpen={isImportCustomersModalOpen}
        onClose={() => setIsImportCustomersModalOpen(false)}
        onImport={handleImportCustomers}
        isLoading={isSubmitting}
      />

      <DeleteConfirmModal
        isOpen={showDeleteCustomerModal}
        onClose={() => { setShowDeleteCustomerModal(false); setSelectedCustomer(null); }}
        onConfirm={handleDeleteCustomer}
        isLoading={isSubmitting}
        itemName={selectedCustomer?.name}
        itemType="Customer"
      />
    </div>
  );
}
