"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType, type FormEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Headphones,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCcw,
  SendHorizontal,
  ShieldCheck,
  Siren,
  Sparkles,
  UserCheck,
  X,
} from "lucide-react";
import { FormAlert } from "@/components/form";
import type {
  FieldJob,
  KnowledgeBaseArticle,
  SupportIncident,
  SupportTicket,
  TicketActivityLog,
  TicketComment,
} from "@/lib/support-data";

interface DashboardMetrics {
  totals: {
    ticketsOpen: number;
    ticketsCritical: number;
    slaBreaches: number;
    fieldJobsActive: number;
  };
  sla: {
    atRisk: Array<{ ticketId: string; ticketNumber: string; resolutionDueAt?: string }>;
  };
  workload: Array<{
    engineerId: string;
    engineerName: string;
    currentLoad: number;
    maxLoad: number;
    utilization: number;
  }>;
  incidents: {
    open: number;
    items: Array<{ id: string; summary?: string; severity: string; detectedAt: string }>;
  };
}

type AssignmentRank = {
  engineerId: string;
  engineerName: string;
  skillMatch: number;
  loadScore: number;
  performanceScore: number;
  onDuty: boolean;
  total: number;
};

type AssignmentSuggestion = {
  primary: AssignmentRank | null;
  backup: AssignmentRank | null;
  ranked: AssignmentRank[];
};

const DEFAULT_TOTALS = { count: 0, critical: 0, breached: 0, awaitingCustomer: 0 };

const STATUS_LABELS: Record<SupportTicket["status"], string> = {
  new: "New",
  acknowledged: "Acknowledged",
  diagnosing: "Diagnosing",
  in_progress: "In progress",
  awaiting_customer: "Awaiting customer",
  awaiting_dependency: "Awaiting dependency",
  resolved: "Resolved",
  closed: "Closed",
  reopened: "Reopened",
};

const STATUS_STYLES: Record<SupportTicket["status"], string> = {
  new: "bg-indigo-50 text-indigo-600",
  acknowledged: "bg-slate-100 text-slate-600",
  diagnosing: "bg-amber-50 text-amber-600",
  in_progress: "bg-blue-50 text-blue-600",
  awaiting_customer: "bg-rose-50 text-rose-600",
  awaiting_dependency: "bg-fuchsia-50 text-fuchsia-600",
  resolved: "bg-emerald-50 text-emerald-600",
  closed: "bg-slate-200 text-slate-600",
  reopened: "bg-purple-50 text-purple-600",
};

const PRIORITY_BADGES: Record<SupportTicket["priority"], string> = {
  critical: "bg-rose-100 text-rose-700 border border-rose-200",
  high: "bg-amber-100 text-amber-800 border border-amber-200",
  medium: "bg-sky-100 text-sky-800 border border-sky-200",
  low: "bg-slate-100 text-slate-600 border border-slate-200",
};

const PRIORITY_ORDER: Record<SupportTicket["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const STATUS_SEQUENCE: SupportTicket["status"][] = [
  "new",
  "acknowledged",
  "diagnosing",
  "in_progress",
  "awaiting_customer",
  "awaiting_dependency",
  "resolved",
  "closed",
  "reopened",
];

const STATUS_OPTIONS = STATUS_SEQUENCE.map((status) => ({ value: status, label: STATUS_LABELS[status] }));

type CreateTicketForm = {
  title: string;
  description: string;
  ticketType: SupportTicket["ticketType"];
  source: SupportTicket["source"];
  impactLevel: SupportTicket["impactLevel"];
  priority: SupportTicket["priority"];
  serviceArea: string;
  region: string;
  tags: string;
};

const TICKET_TYPE_OPTIONS: CreateTicketForm["ticketType"][] = ["customer", "internal"];
const SOURCE_OPTIONS: CreateTicketForm["source"][] = ["erp", "crm", "email", "api", "mobile", "monitoring"];
const PRIORITY_OPTIONS: CreateTicketForm["priority"][] = ["critical", "high", "medium", "low"];
const IMPACT_OPTIONS: CreateTicketForm["impactLevel"][] = ["critical", "high", "medium", "low"];

function defaultCreateTicketForm(): CreateTicketForm {
  return {
    title: "",
    description: "",
    ticketType: "customer",
    source: "erp",
    impactLevel: "high",
    priority: "high",
    serviceArea: "",
    region: "",
    tags: "",
  };
}

function formatClock(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelative(value?: string) {
  if (!value) return "";
  const date = new Date(value).getTime();
  const now = Date.now();
  const diff = date - now;
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 60) {
    return minutes >= 0 ? `${minutes}m remaining` : `${Math.abs(minutes)}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) {
    return hours >= 0 ? `${hours}h remaining` : `${Math.abs(hours)}h ago`;
  }
  const days = Math.round(hours / 24);
  return days >= 0 ? `${days}d remaining` : `${Math.abs(days)}d ago`;
}

export default function ItSupportWorkspace({ tenantSlug, region }: { tenantSlug?: string | null; region?: string }) {
  const tenantKey = tenantSlug?.trim() || "kreatix-default";
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketTotals, setTicketTotals] = useState(DEFAULT_TOTALS);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [incidents, setIncidents] = useState<SupportIncident[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeBaseArticle[]>([]);
  const [assignment, setAssignment] = useState<AssignmentSuggestion | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [activities, setActivities] = useState<TicketActivityLog[]>([]);
  const [fieldJobs, setFieldJobs] = useState<FieldJob[]>([]);
  const [filterStatus, setFilterStatus] = useState<SupportTicket["status"] | "all">("all");
  const [filterPriority, setFilterPriority] = useState<SupportTicket["priority"] | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTicketForm>(() => defaultCreateTicketForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const filteredTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        if (filterStatus !== "all" && ticket.status !== filterStatus) return false;
        if (filterPriority !== "all" && ticket.priority !== filterPriority) return false;
        if (searchQuery && !`${ticket.ticketNumber} ${ticket.title}`.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [tickets, filterStatus, filterPriority, searchQuery]);

  const slaAtRisk = metrics?.sla.atRisk ?? [];
  const workload = metrics?.workload ?? [];

  const openCreateModal = () => {
    setCreateError(null);
    setCreateForm(() => {
      const defaults = defaultCreateTicketForm();
      if (region && region !== "Global HQ") {
        defaults.region = region;
      }
      return defaults;
    });
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateError(null);
    setCreateForm(defaultCreateTicketForm());
  };

  const handleCreateFieldChange = (field: keyof CreateTicketForm, value: string) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createForm.title.trim()) {
      setCreateError("Title is required");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
        const payload = {
        tenantSlug: tenantKey,
        title: createForm.title.trim(),
        description: createForm.description.trim() || undefined,
        ticketType: createForm.ticketType,
        source: createForm.source,
        impactLevel: createForm.impactLevel,
        priority: createForm.priority,
        serviceArea: createForm.serviceArea.trim() || undefined,
        region: createForm.region.trim() || undefined,
        tags: createForm.tags
          ? createForm.tags
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
          : undefined,
        };

      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error ?? "Unable to create ticket");
      }
      const newTicket = result.ticket as SupportTicket | undefined;
      if (newTicket) {
        setTickets((prev) => [newTicket, ...prev]);
        setTicketTotals((prev) => ({
          ...prev,
          count: prev.count + 1,
          critical: prev.critical + (newTicket.priority === "critical" ? 1 : 0),
        }));
        setSelectedTicketId(newTicket.id);
      }
      closeCreateModal();
    } catch (error) {
      console.error("Ticket creation failed", error);
      setCreateError(error instanceof Error ? error.message : "Unable to create ticket");
    } finally {
      setCreateLoading(false);
    }
  };

  const loadTicketDetails = useCallback(
    async (ticketId: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const params = new URLSearchParams({ tenantSlug: tenantKey });
        const [ticketRes, commentsRes, activityRes, jobsRes] = await Promise.all([
          fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/comments?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/activities?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/field-jobs?${params.toString()}`, { cache: "no-store" }),
        ]);

        const [ticketPayload, commentsPayload, activityPayload, jobsPayload] = await Promise.all([
          ticketRes.json().catch(() => ({})),
          commentsRes.json().catch(() => ({})),
          activityRes.json().catch(() => ({})),
          jobsRes.json().catch(() => ({})),
        ]);

        if (!ticketRes.ok) {
          if (ticketRes.status === 404) {
            setSelectedTicketId(null);
            setSelectedTicket(null);
            setComments([]);
            setActivities([]);
            setFieldJobs([]);
            setDetailError("Ticket not found. Queue will refresh to stay accurate.");
            setRefreshToken((prev) => prev + 1);
            return;
          }
          throw new Error(ticketPayload?.error ?? "Unable to load ticket");
        }

        setSelectedTicket(ticketPayload.ticket ?? null);
        setComments(Array.isArray(commentsPayload.comments) ? commentsPayload.comments.slice().reverse() : []);
        setActivities(Array.isArray(activityPayload.activities) ? activityPayload.activities.slice().reverse() : []);
        setFieldJobs(Array.isArray(jobsPayload.fieldJobs) ? jobsPayload.fieldJobs : []);
      } catch (error) {
        console.error("Ticket detail load failed", error);
        setDetailError(error instanceof Error ? error.message : "Unable to load ticket detail");
      } finally {
        setDetailLoading(false);
      }
    },
    [tenantKey]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      setWorkspaceLoading(true);
      setWorkspaceError(null);
      try {
        const params = new URLSearchParams({ tenantSlug: tenantKey });
        if (region && region !== "Global HQ") {
          params.set("region", region);
        }

        const [ticketsRes, incidentsRes, knowledgeRes, metricsRes] = await Promise.all([
          fetch(`/api/support/tickets?${params.toString()}`, { cache: "no-store" }),
          fetch(`/api/support/incidents?tenantSlug=${encodeURIComponent(tenantKey)}`, { cache: "no-store" }),
          fetch(`/api/support/knowledge-base?tenantSlug=${encodeURIComponent(tenantKey)}`, { cache: "no-store" }),
          fetch(`/api/support/dashboard/metrics?tenantSlug=${encodeURIComponent(tenantKey)}`, { cache: "no-store" }),
        ]);

        const [ticketPayload, incidentPayload, knowledgePayload, metricsPayload] = await Promise.all([
          ticketsRes.json().catch(() => ({})),
          incidentsRes.json().catch(() => ({})),
          knowledgeRes.json().catch(() => ({})),
          metricsRes.json().catch(() => ({})),
        ]);

        if (!ticketsRes.ok) {
          throw new Error(ticketPayload?.error ?? "Unable to load ticket queue");
        }

        if (!cancelled) {
          const list = Array.isArray(ticketPayload.tickets) ? ticketPayload.tickets : [];
          setTickets(list);
          setTicketTotals(ticketPayload.totals ?? DEFAULT_TOTALS);
          setIncidents(Array.isArray(incidentPayload.incidents) ? incidentPayload.incidents : []);
          setKnowledge(Array.isArray(knowledgePayload.articles) ? knowledgePayload.articles : []);
          setMetrics(metricsPayload.metrics ?? metricsPayload ?? null);

          setSelectedTicketId((current) => {
            if (current && list.some((ticket: any) => ticket.id === current)) {
              return current;
            }
            return list[0]?.id ?? null;
          });

          try {
            const primaryTicket = list[0];
            const assignRes = await fetch("/api/support/assign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tenantSlug: tenantKey,
                region: primaryTicket?.region,
                serviceArea: primaryTicket?.serviceArea,
                skills: primaryTicket?.tags,
              }),
            });
            const assignPayload = await assignRes.json().catch(() => ({}));
            if (assignRes.ok) {
              setAssignment(assignPayload.assignment ?? null);
            } else {
              setAssignment(null);
            }
          } catch (err) {
            console.warn("Assignment suggestion failed", err);
            setAssignment(null);
          }
        }
      } catch (error) {
        console.error("IT support workspace load failed", error);
        if (!cancelled) {
          setWorkspaceError(error instanceof Error ? error.message : "Unable to load IT support workspace");
        }
      } finally {
        if (!cancelled) {
          setWorkspaceLoading(false);
        }
      }
    }

    loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [tenantKey, region, refreshToken]);

  useEffect(() => {
    if (!selectedTicketId) {
      setSelectedTicket(null);
      setComments([]);
      setActivities([]);
      setFieldJobs([]);
      return;
    }
    loadTicketDetails(selectedTicketId);
  }, [selectedTicketId, loadTicketDetails]);

  const handleCommentSubmit = async () => {
    if (!selectedTicketId || !commentBody.trim()) {
      return;
    }
    setCommentSubmitting(true);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(selectedTicketId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: tenantKey, body: commentBody.trim(), commentType: "internal", visibility: "internal" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to log comment");
      }
      setComments((prev) => [payload.comment, ...prev]);
      setCommentBody("");
    } catch (error) {
      console.error("Comment submit failed", error);
      setDetailError(error instanceof Error ? error.message : "Unable to log comment");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleStatusChange = async (status: SupportTicket["status"]) => {
    if (!selectedTicketId) return;
    setStatusUpdating(true);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(selectedTicketId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantSlug: tenantKey, status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to update status");
      }
      const updatedTicket = payload.ticket as SupportTicket | undefined;
      if (updatedTicket) {
        setSelectedTicket(updatedTicket);
        setTickets((prev) => prev.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket)));
      }
      setDetailError(null);
    } catch (error) {
      console.error("Status update failed", error);
      setDetailError(error instanceof Error ? error.message : "Unable to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDispatch = async () => {
    if (!selectedTicketId) return;
    setDispatching(true);
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(selectedTicketId)}/field-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug: tenantKey,
          engineerId: assignment?.primary?.engineerId,
          location: selectedTicket?.region ? { region: selectedTicket.region } : undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to dispatch field job");
      }
      setFieldJobs((prev) => [payload.fieldJob, ...prev]);
    } catch (error) {
      console.error("Dispatch failed", error);
      setDetailError(error instanceof Error ? error.message : "Unable to dispatch engineer");
    } finally {
      setDispatching(false);
    }
  };

  const openTickets = metrics?.totals?.ticketsOpen ?? ticketTotals.count;
  const criticalTickets = metrics?.totals?.ticketsCritical ?? ticketTotals.critical;
  const slaBreaches = metrics?.totals?.slaBreaches ?? ticketTotals.breached;
  const activeDispatch = metrics?.totals?.fieldJobsActive ?? fieldJobs.filter((job) => job.status !== "completed" && job.status !== "cancelled").length;
  const isCreateDisabled = !createForm.title.trim();

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Incident to resolution</p>
          <h2 className="text-2xl font-semibold text-slate-900">IT Support control center</h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-sm text-slate-500">Tenant:</span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-sm font-medium text-slate-700">{tenantKey}</span>
          </div>
          <p className="text-sm text-slate-500">Live ticket queue, SLA heatmap, dispatch radar, and assignment intelligence.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            New ticket
          </button>
          <button
            type="button"
            onClick={() => setRefreshToken((prev) => prev + 1)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm hover:border-slate-300"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh data
          </button>
        </div>
      </div>

      {workspaceError && (
        <FormAlert
          type="error"
          title="Error loading IT support workspace"
          message={workspaceError}
          onClose={() => setWorkspaceError(null)}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Open tickets" value={openTickets} sublabel="Across all queues" accent="from-indigo-500 via-slate-900 to-slate-900" icon={Headphones} />
        <StatCard title="Critical" value={criticalTickets} sublabel="P1/P0 workload" accent="from-rose-500 via-red-600 to-rose-700" icon={AlertTriangle} />
        <StatCard title="SLA at risk" value={slaBreaches} sublabel="Resolution breaches" accent="from-amber-500 via-orange-500 to-amber-600" icon={ShieldCheck} />
        <StatCard title="Active dispatch" value={activeDispatch} sublabel="Field jobs live" accent="from-emerald-500 via-teal-500 to-emerald-600" icon={BadgeCheck} />
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <div className="space-y-8 xl:col-span-2">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Queues</p>
                <h3 className="text-xl font-semibold text-slate-900">Ticket board</h3>
                <p className="text-sm text-slate-500">Filter by SLA risk, priority, or region to focus the war room.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                  <option value="all">All statuses</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value as typeof filterPriority)} className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
                  <option value="all">All priorities</option>
                  {(["critical", "high", "medium", "low"] as SupportTicket["priority"][]).map((priority) => (
                    <option key={priority} value={priority}>{priority.toUpperCase()}</option>
                  ))}
                </select>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search ticket or title"
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
                />
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-100">
              <div className="grid grid-cols-[1.5fr,0.7fr,0.8fr,0.8fr] gap-4 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <span>Ticket</span>
                <span>Priority</span>
                <span>Status</span>
                <span>Resolution</span>
              </div>
              <div className="divide-y divide-slate-100">
                {workspaceLoading && filteredTickets.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading queue...
                  </div>
                ) : filteredTickets.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-slate-500">No tickets match the filters.</div>
                ) : (
                  filteredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`grid w-full grid-cols-[1.5fr,0.7fr,0.8fr,0.8fr] gap-4 px-4 py-4 text-left transition ${selectedTicketId === ticket.id ? "bg-slate-900/5" : "hover:bg-slate-50"}`}
                    >
                      <div>
                        <p className="font-medium text-slate-900">{ticket.ticketNumber} · {ticket.title}</p>
                        <p className="text-xs text-slate-500">{ticket.serviceArea || "General"} · {ticket.region || "Region N/A"}</p>
                      </div>
                      <span className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${PRIORITY_BADGES[ticket.priority]}`}>
                        {ticket.priority.toUpperCase()}
                      </span>
                      <span className={`inline-flex items-center justify-center rounded-full px-2 py-1 text-xs font-semibold ${STATUS_STYLES[ticket.status]}`}>
                        {STATUS_LABELS[ticket.status]}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{ticket.resolutionDueAt ? formatRelative(ticket.resolutionDueAt) : "TBD"}</p>
                        <p className="text-xs text-slate-500">Due {ticket.resolutionDueAt ? formatClock(ticket.resolutionDueAt) : "—"}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Ticket detail</p>
                <h3 className="text-xl font-semibold text-slate-900">{selectedTicket ? selectedTicket.title : "Select a ticket"}</h3>
                <p className="text-sm text-slate-500">Lifecycle, diagnostics timeline, field dispatch, and collaboration thread.</p>
              </div>
              {selectedTicket && (
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={selectedTicket.status}
                    onChange={(e) => handleStatusChange(e.target.value as SupportTicket["status"])}
                    disabled={statusUpdating}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleDispatch}
                    disabled={dispatching}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-slate-300"
                  >
                    {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                    Dispatch field crew
                  </button>
                </div>
              )}
            </div>

            {detailError && (
              <FormAlert
                type="error"
                title="Error updating ticket"
                message={detailError}
                onClose={() => setDetailError(null)}
              />
            )}

            {!selectedTicket && !detailLoading && (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                Choose a ticket from the board to inspect timeline, comments, and SLA clocks.
              </div>
            )}

            {detailLoading ? (
              <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading ticket context…
              </div>
            ) : selectedTicket ? (
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-100 p-5">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${PRIORITY_BADGES[selectedTicket.priority]}`}>
                        {selectedTicket.priority.toUpperCase()}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${STATUS_STYLES[selectedTicket.status]}`}>
                        {STATUS_LABELS[selectedTicket.status]}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1 text-slate-600">
                        <MapPin className="h-3.5 w-3.5" />
                        {selectedTicket.region || "Region N/A"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Service area</p>
                        <p className="font-semibold text-slate-900">{selectedTicket.serviceArea || "Unmapped"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">SLA resolution</p>
                        <p className="font-semibold text-slate-900">{selectedTicket.resolutionDueAt ? formatRelative(selectedTicket.resolutionDueAt) : "No SLA"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Assigned engineer</p>
                        <p className="font-semibold text-slate-900">{selectedTicket.assignedEngineerId || "Auto pending"}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tags</p>
                        <p className="font-semibold text-slate-900">
                          {(selectedTicket.tags || []).length ? selectedTicket.tags.join(", ") : "No tags"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Timeline</p>
                      <span className="text-xs text-slate-500">{activities.length} entries</span>
                    </div>
                    <div className="mt-4 space-y-4">
                      {activities.slice(0, 6).map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3">
                          <div className="rounded-full bg-slate-900/5 p-2 text-slate-600">
                            <Activity className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{activity.activityType.replace(/_/g, " ")}</p>
                            <p className="text-xs text-slate-500">{formatClock(activity.createdAt)}</p>
                          </div>
                        </div>
                      ))}
                      {activities.length === 0 && <p className="text-sm text-slate-500">No activity logged yet.</p>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Collaboration</p>
                      <span className="text-xs text-slate-500">{comments.length} comments</span>
                    </div>
                    <div className="mt-4 space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <textarea
                          value={commentBody}
                          onChange={(e) => setCommentBody(e.target.value)}
                          placeholder="Drop an internal note or customer update"
                          className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
                        />
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            onClick={handleCommentSubmit}
                            disabled={!commentBody.trim() || commentSubmitting}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                          >
                            {commentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                            Log update
                          </button>
                        </div>
                      </div>
                      {comments.slice(0, 4).map((comment) => (
                        <div key={comment.id} className="rounded-2xl border border-slate-100 p-4">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {comment.visibility === "internal" ? "Internal" : "External"}
                            · {formatClock(comment.createdAt)}
                          </div>
                          <p className="mt-2 text-sm text-slate-700">{comment.body}</p>
                        </div>
                      ))}
                      {comments.length === 0 && <p className="text-sm text-slate-500">No commentary logged.</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-100 p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Field jobs</p>
                      <span className="text-xs text-slate-500">{fieldJobs.length} assignments</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {fieldJobs.length === 0 && <p className="text-sm text-slate-500">No field dispatch yet.</p>}
                      {fieldJobs.slice(0, 4).map((job) => (
                        <div key={job.id} className="rounded-xl border border-slate-100 px-4 py-3 text-sm text-slate-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserCheck className="h-4 w-4 text-slate-500" />
                              {job.engineerId || "Unassigned"}
                            </div>
                            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{job.status.replace(/_/g, " ")}</span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">Scheduled {formatClock(job.scheduledAt)} · {typeof job.location?.region === "string" ? job.location.region : "No region"}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Root cause notes</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {selectedTicket.description || "No diagnostic notes captured. Use the comment field to capture hypotheses and learnings."}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">SLA radar</p>
                <h3 className="text-lg font-semibold text-slate-900">At-risk countdown</h3>
              </div>
              <ShieldCheck className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-4 space-y-4">
              {slaAtRisk.length === 0 && <p className="text-sm text-slate-500">All tickets within SLA right now.</p>}
              {slaAtRisk.slice(0, 4).map((entry) => (
                <div key={entry.ticketId} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-amber-900">
                    <span>{entry.ticketNumber}</span>
                    <span>{formatRelative(entry.resolutionDueAt)}</span>
                  </div>
                  <p className="text-xs text-amber-700">Resolution by {formatClock(entry.resolutionDueAt)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Incident feed</p>
                <h3 className="text-lg font-semibold text-slate-900">Monitoring signals</h3>
              </div>
              <Siren className="h-5 w-5 text-rose-500" />
            </div>
            <div className="mt-4 space-y-4">
              {incidents.length === 0 && <p className="text-sm text-slate-500">No live incidents linked.</p>}
              {incidents.slice(0, 4).map((incident) => (
                <div key={incident.id} className="rounded-2xl border border-slate-100 px-4 py-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                    <span>{incident.summary || incident.incidentType || "Incident"}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${incident.severity === "critical" ? "bg-rose-100 text-rose-700" : incident.severity === "high" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                      {incident.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Detected {formatClock(incident.detectedAt)} · {incident.affectedServices?.join(", ") || "Core"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Assignment intelligence</p>
                <h3 className="text-lg font-semibold text-slate-900">Recommended crew</h3>
              </div>
              <Sparkles className="h-5 w-5 text-indigo-500" />
            </div>
            {assignment?.primary ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-900 p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/60">Primary engineer</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">{assignment.primary.engineerName}</p>
                      <p className="text-sm text-white/70">Skill match {assignment.primary.skillMatch}% · Load score {assignment.primary.loadScore}%</p>
                    </div>
                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs">{assignment.primary.total}% fit</div>
                  </div>
                </div>
                {assignment.backup && (
                  <div className="rounded-2xl border border-slate-100 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Backup</p>
                    <p className="text-sm font-semibold text-slate-900">{assignment.backup.engineerName}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Workload radar</p>
                  <div className="mt-2 space-y-2">
                    {workload.slice(0, 4).map((engineer) => (
                      <div key={engineer.engineerId} className="overflow-hidden rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between px-4 py-2 text-sm font-semibold text-slate-900">
                          <span>{engineer.engineerName}</span>
                          <span>{engineer.utilization}% utilized</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100">
                          <div className="h-full bg-slate-900" style={{ width: `${Math.min(engineer.utilization, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Assignment engine will populate once tickets load.</p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Knowledge loop</p>
                <h3 className="text-lg font-semibold text-slate-900">Suggested playbooks</h3>
              </div>
              <BookIcon />
            </div>
            <div className="mt-4 space-y-4">
              {knowledge.length === 0 && <p className="text-sm text-slate-500">No KB articles yet. Capture learnings after resolution.</p>}
              {knowledge.slice(0, 3).map((article) => (
                <div key={article.id} className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-sm font-semibold text-slate-900">{article.title}</p>
                  <p className="text-xs text-slate-500">Audience: {article.audience} · Score {article.effectivenessScore}</p>
                  <button className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-900">
                    Open playbook <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Ticket intake</p>
                <h3 className="text-2xl font-semibold text-slate-900">Log a new support ticket</h3>
                <p className="text-sm text-slate-500">Capture context, SLA classification, and tags so the war room can act immediately.</p>
              </div>
              <button onClick={closeCreateModal} className="rounded-full border border-slate-200 p-2 text-slate-500 hover:text-slate-700" aria-label="Close create ticket dialog">
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <FormAlert
                type="error"
                title="Error creating ticket"
                message={createError}
                onClose={() => setCreateError(null)}
              />
            )}

            <form onSubmit={handleCreateTicket} className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-semibold text-slate-900">Title</label>
                <input
                  type="text"
                  value={createForm.title}
                  onChange={(event) => handleCreateFieldChange("title", event.target.value)}
                  required
                  placeholder="e.g., MetroWave POP outage"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-900">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(event) => handleCreateFieldChange("description", event.target.value)}
                  rows={4}
                  placeholder="Add quick diagnostic notes, affected services, or monitoring signal"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-900">Ticket type</label>
                  <select
                    value={createForm.ticketType}
                    onChange={(event) => handleCreateFieldChange("ticketType", event.target.value as CreateTicketForm["ticketType"])}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                  >
                    {TICKET_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option === "customer" ? "Customer" : "Internal"}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-900">Source</label>
                  <select
                    value={createForm.source}
                    onChange={(event) => handleCreateFieldChange("source", event.target.value as CreateTicketForm["source"])}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                  >
                    {SOURCE_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-900">Impact level</label>
                  <select
                    value={createForm.impactLevel}
                    onChange={(event) => handleCreateFieldChange("impactLevel", event.target.value as CreateTicketForm["impactLevel"])}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                  >
                    {IMPACT_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-900">Priority</label>
                  <select
                    value={createForm.priority}
                    onChange={(event) => handleCreateFieldChange("priority", event.target.value as CreateTicketForm["priority"])}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-900">Service area</label>
                  <input
                    type="text"
                    value={createForm.serviceArea}
                    onChange={(event) => handleCreateFieldChange("serviceArea", event.target.value)}
                    placeholder="Core Network, Internal IT, Field"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-900">Region</label>
                  <input
                    type="text"
                    value={createForm.region}
                    onChange={(event) => handleCreateFieldChange("region", event.target.value)}
                    placeholder="Global HQ, EMEA, APAC"
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-900">Tags</label>
                <input
                  type="text"
                  value={createForm.tags}
                  onChange={(event) => handleCreateFieldChange("tags", event.target.value)}
                  placeholder="fiber, authentication, vpn"
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                />
                <p className="mt-1 text-xs text-slate-500">Comma separated list. Helps the assignment engine find specialists.</p>
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button type="button" onClick={closeCreateModal} className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreateDisabled || createLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  Create ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  sublabel,
  accent,
  icon: Icon,
}: {
  title: string;
  value: number;
  sublabel: string;
  accent: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className={`rounded-3xl border border-slate-100 bg-gradient-to-br ${accent} p-6 text-white shadow-sm`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">{title}</p>
          <p className="mt-2 text-3xl font-semibold">{value}</p>
          <p className="text-sm text-white/70">{sublabel}</p>
        </div>
        <div className="rounded-2xl bg-white/15 p-3">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function BookIcon() {
  return (
    <div className="rounded-2xl bg-slate-100 p-3 text-slate-500">
      <SendHorizontal className="h-5 w-5" />
    </div>
  );
}
