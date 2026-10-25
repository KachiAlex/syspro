"use client";

import React, { useState, useEffect } from "react";
import { useCallback } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format } from "date-fns";
import { FormAlert } from "@/components/form";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface Approval {
  id: string;
  entityType: "purchase_order" | "bill" | "payment" | "journal_entry" | "sales_return" | "purchase_return" | "expense" | "employee_expense";
  entityId: string;
  status: "pending" | "approved" | "rejected" | "escalated" | "cancelled";
  requestedBy: string;
  requestedByName?: string | null;
  approverChain: Array<{
    step: number;
    userId: string;
    role?: string;
    required: boolean;
    order: number;
  }>;
  decisions: Array<{
    step: number;
    userId: string;
    decision: "approved" | "rejected" | "escalated" | "clarification_needed";
    comments?: string;
    timestamp: string;
    delegatedFor?: string;
  }>;
  currentStep: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface ApprovalRule {
  id: string;
  entityType: string;
  ruleType: string;
  conditions: Record<string, any>;
  approvers: Array<{ step: number; userId: string; role?: string; required: boolean; order: number }>;
  isActive: boolean;
  priority: number;
}

interface ApprovalDelegate {
  id: string;
  delegatorId: string;
  delegateId: string;
  entityType: string | null;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  note: string | null;
}

const ENTITY_TYPE_OPTIONS = [
  ["purchase_order", "Purchase Order"],
  ["bill", "Bill"],
  ["payment", "Payment"],
  ["journal_entry", "Journal Entry"],
  ["sales_return", "Sales Return"],
  ["purchase_return", "Purchase Return"],
  ["expense", "Expense"],
  ["employee_expense", "Employee Expense"],
] as const;

const RULE_TYPE_OPTIONS = [
  ["amount_based", "Amount based"],
  ["department_based", "Department based"],
  ["category_based", "Category based"],
  ["project_based", "Project based"],
  ["vendor_based", "Vendor based"],
] as const;

const ROLE_SPECS = [
  "role:dept_manager",
  "role:finance_manager",
  "role:admin",
  "role:tenant_owner",
];

interface TenantOfficer {
  title: string;
  userIds: string[];
}

function officerSlug(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Tenant-configured company officers (settings.approvals.officers). */
function useOfficers(tenantSlug: string) {
  const [officers, setOfficers] = useState<TenantOfficer[]>([]);
  const reload = useCallback(async () => {
    if (!tenantSlug) return;
    try {
      const res = await fetch(`/api/finance/approvals?officers=true&tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();
      setOfficers(data.officers || []);
    } catch {
      setOfficers([]);
    }
  }, [tenantSlug]);
  useEffect(() => { reload(); }, [reload]);
  return { officers, reload };
}

export default function ApprovalsWorkspace({ onNavigateTo }: { onNavigateTo?: (section: string) => void }) {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"requests" | "rules" | "officers" | "delegates">("requests");
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const currentUser = useCurrentUser();
  const [filters, setFilters] = useState({
    status: "",
    entityType: ""
  });



  const loadApprovals = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        tenantSlug,
        ...(filters.status && { status: filters.status }),
        ...(filters.entityType && { entityType: filters.entityType })
      });

      const response = await fetch(`/api/finance/approvals?${params}`);
      const data = await response.json();
      setApprovals(data.approvals || []);
    } catch (err) {
      console.error("Failed to load approvals:", err);
      setError("Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [filters, tenantSlug]);

  useEffect(() => {
    if (tenantSlug) loadApprovals();
  }, [loadApprovals, tenantSlug]);

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
      escalated: "bg-orange-100 text-orange-800",
      cancelled: "bg-theme-muted text-theme-text-primary"
    };
    return colors[status as keyof typeof colors] || "bg-theme-muted text-theme-text-primary";
  };

  const handleDecision = async (approvalId: string, decision: "approved" | "rejected" | "escalated", comments?: string) => {
    try {
      const response = await fetch(`/api/finance/approvals?tenantSlug=${encodeURIComponent(tenantSlug ?? "")}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "decision",
          approvalId,
          userId: currentUser?.id || "unknown",
          decision,
          comments
        })
      });

      if (response.ok) {
        setSuccess(`Approval ${decision} successfully`);
        setTimeout(() => setSuccess(null), 3000);
        loadApprovals();
      } else {
        const error = await response.json();
        setError(error.error || "Decision failed");
      }
    } catch (err) {
      console.error("Decision error:", err);
      setError(err instanceof Error ? err.message : "Decision failed");
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-theme-muted p-8 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-theme-border border-t-slate-900"></div>
          <p className="mt-3 text-theme-text-secondary">Loading approvals…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-theme-text-secondary">Financial Management</p>
          <h1 className="text-2xl font-semibold text-theme-text-primary">Approvals</h1>
          <p className="mt-1 text-sm text-theme-text-secondary">Review and authorize financial documents</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-theme-border">
        {([["requests", "Requests"], ["rules", "Rules"], ["officers", "Officers"], ["delegates", "Delegations"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-theme-accent text-theme-accent"
                : "border-transparent text-theme-text-secondary hover:text-theme-text-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <RulesPanel
          tenantSlug={tenantSlug ?? ""}
          onError={setError}
          onSuccess={(m) => { setSuccess(m); setTimeout(() => setSuccess(null), 3000); }}
        />
      )}
      {tab === "officers" && (
        <OfficersPanel
          tenantSlug={tenantSlug ?? ""}
          onError={setError}
          onSuccess={(m) => { setSuccess(m); setTimeout(() => setSuccess(null), 3000); }}
        />
      )}
      {tab === "delegates" && (
        <DelegatesPanel
          tenantSlug={tenantSlug ?? ""}
          onError={setError}
          onSuccess={(m) => { setSuccess(m); setTimeout(() => setSuccess(null), 3000); }}
        />
      )}

      {tab === "requests" && (<>
      {/* Filters */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-6">
        <p className="mb-4 text-sm font-semibold text-theme-text-primary">Filters</p>
        <div className="grid grid-cols-2 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="rounded-lg border border-theme-border px-3 py-2 text-sm"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="escalated">Escalated</option>
          </select>
          
          <select
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            className="rounded-lg border border-theme-border px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="purchase_order">Purchase Orders</option>
            <option value="bill">Bills</option>
            <option value="payment">Payments</option>
            <option value="journal_entry">Journal Entries</option>
            <option value="sales_return">Sales Returns</option>
            <option value="purchase_return">Purchase Returns</option>
            <option value="expense">Expenses</option>
            <option value="employee_expense">Employee Expenses</option>
          </select>
        </div>
      </div>

      {/* Approvals Table */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-theme-border bg-theme-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Entity Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Entity ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Requested By
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Current Step
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border">
              {approvals.map((approval) => (
                <tr key={approval.id} className="hover:bg-theme-muted">
                  <td className="px-6 py-4 text-sm font-medium text-theme-text-primary">
                    {approval.entityType?.replace("_", " ")}
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">
                    {approval.entityId.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">
                    {approval.requestedByName || approval.requestedBy.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">
                    Step {approval.currentStep + 1} of {approval.approverChain.length}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(approval.status)}`}>
                      {approval.status === "pending" && "⏳"}
                      {approval.status === "approved" && "✓"}
                      {approval.status === "rejected" && "✕"}
                      {approval.status === "escalated" && "⬆️"}
                      {approval.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-theme-text-secondary">
                    {format(new Date(approval.createdAt), "MMM dd, yyyy")}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      {approval.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleDecision(approval.id, "approved")}
                            className="text-green-600 hover:text-green-900"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleDecision(approval.id, "rejected")}
                            className="text-rose-600 hover:text-rose-900"
                          >
                            ✕ Reject
                          </button>
                          <button
                            onClick={() => handleDecision(approval.id, "escalated")}
                            className="text-amber-600 hover:text-amber-900"
                          >
                            ⬆️ Escalate
                          </button>
                        </>
                      )}
                      <button className="text-theme-accent hover:text-theme-text-primary">
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>)}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-rose-100 text-rose-900",
  escalated: "bg-orange-100 text-orange-900",
  cancelled: "bg-theme-muted text-theme-text-primary"
};

function getStatusColor(status: string) {
  return STATUS_COLORS[status] || STATUS_COLORS.cancelled;
}

/** Best-effort employee list for approver pickers (requires people:read). */
function useUserOptions(tenantSlug: string) {
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!tenantSlug) return;
    fetch(`/api/hr/employees?limit=500`)
      .then((r) => (r.ok ? r.json() : { employees: [] }))
      .then((d) => {
        const list = (d.employees ?? d.data ?? []) as any[];
        setUsers(list.map((e) => ({ id: String(e.id), name: e.name ?? e.email ?? String(e.id) })));
      })
      .catch(() => setUsers([]));
  }, [tenantSlug]);
  return users;
}

function UserSpecInput({ value, onChange, users, extraSpecs, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  users: Array<{ id: string; name: string }>;
  extraSpecs?: Array<{ value: string; label?: string }>;
  placeholder?: string;
}) {
  const listId = React.useId();
  return (
    <>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "user id or role:finance_manager"}
        className="w-full rounded-lg border border-theme-border px-3 py-2 text-sm"
      />
      <datalist id={listId}>
        {ROLE_SPECS.map((r) => <option key={r} value={r} />)}
        {(extraSpecs ?? []).map((s) => <option key={s.value} value={s.value}>{s.label ?? s.value}</option>)}
        {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </datalist>
    </>
  );
}

function conditionsSummary(rule: ApprovalRule): string {
  const c = rule.conditions ?? {};
  const parts: string[] = [];
  if (c.minAmount != null || c.maxAmount != null) {
    parts.push(`₦${(c.minAmount ?? 0).toLocaleString?.() ?? c.minAmount ?? 0}${c.maxAmount != null ? ` – ₦${Number(c.maxAmount).toLocaleString()}` : "+"}`);
  }
  if (c.departmentId) parts.push(`dept: ${c.departmentId}`);
  if (c.categoryId) parts.push(`category: ${c.categoryId}`);
  if (c.projectId) parts.push(`project: ${c.projectId}`);
  if (c.vendorId) parts.push(`vendor: ${c.vendorId}`);
  if (c.slaHours) parts.push(`SLA ${c.slaHours}h${c.slaAction === "escalate" ? " → escalate" : ""}`);
  return parts.join(" · ") || "—";
}

function RulesPanel({ tenantSlug, onError, onSuccess }: {
  tenantSlug: string;
  onError: (m: string | null) => void;
  onSuccess: (m: string) => void;
}) {
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const users = useUserOptions(tenantSlug);
  const { officers } = useOfficers(tenantSlug);
  const officerSpecs = officers.map((o) => ({
    value: `role:${officerSlug(o.title)}`,
    label: `${o.title} (officer)`,
  }));

  const [entityType, setEntityType] = useState<string>("expense");
  const [ruleType, setRuleType] = useState<string>("amount_based");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [slaHours, setSlaHours] = useState("");
  const [slaAction, setSlaAction] = useState<"remind" | "escalate">("remind");
  const [priority, setPriority] = useState("0");
  const [steps, setSteps] = useState<Array<{ step: number; userId: string; required: boolean }>>([
    { step: 0, userId: "role:dept_manager", required: true },
  ]);

  const loadRules = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/approvals?rules=true&tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();
      setRules(data.rules || []);
    } catch {
      onError("Failed to load approval rules");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, onError]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/finance/approvals?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.details || "Request failed");
    return data;
  };

  const toggleRule = async (rule: ApprovalRule) => {
    try {
      await post({ action: "update-rule", ruleId: rule.id, isActive: !rule.isActive });
      onSuccess(`Rule ${rule.isActive ? "disabled" : "enabled"}`);
      loadRules();
    } catch (e: any) {
      onError(e.message);
    }
  };

  const deleteRule = async (rule: ApprovalRule) => {
    if (!confirm("Delete this approval rule? Matching documents will fall back to threshold-based chains.")) return;
    try {
      await post({ action: "delete-rule", ruleId: rule.id });
      onSuccess("Rule deleted");
      loadRules();
    } catch (e: any) {
      onError(e.message);
    }
  };

  const addStep = () => {
    const nextStep = steps.length ? Math.max(...steps.map((s) => s.step)) + 1 : 0;
    setSteps([...steps, { step: nextStep, userId: "", required: true }]);
  };

  const submitRule = async () => {
    if (steps.some((s) => !s.userId.trim())) {
      onError("Every approver step needs a user id or role:* spec");
      return;
    }
    setSaving(true);
    try {
      const conditions: Record<string, any> = {};
      if (minAmount) conditions.minAmount = Number(minAmount);
      if (maxAmount) conditions.maxAmount = Number(maxAmount);
      if (ruleType === "department_based" && departmentId) conditions.departmentId = departmentId;
      if (ruleType === "category_based" && categoryId) conditions.categoryId = categoryId;
      if (ruleType === "project_based" && projectId) conditions.projectId = projectId;
      if (ruleType === "vendor_based" && vendorId) conditions.vendorId = vendorId;
      if (slaHours) {
        conditions.slaHours = Number(slaHours);
        conditions.slaAction = slaAction;
      }
      await post({
        action: "create-rule",
        tenantSlug,
        entityType,
        ruleType,
        conditions,
        approvers: steps.map((s, i) => ({ step: s.step, userId: s.userId.trim(), required: s.required, order: i })),
        priority: Number(priority) || 0,
      });
      onSuccess("Rule created");
      setShowForm(false);
      setSteps([{ step: 0, userId: "role:dept_manager", required: true }]);
      setMinAmount(""); setMaxAmount(""); setDepartmentId(""); setCategoryId("");
      setProjectId(""); setVendorId(""); setSlaHours(""); setPriority("0");
      loadRules();
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-theme-border px-3 py-2 text-sm";
  const labelCls = "block text-xs font-medium text-theme-text-primary mb-1";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-theme-text-secondary">
          Rules decide which documents enter a workflow and who approves each step.
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-full bg-theme-accent px-4 py-2 text-sm font-semibold text-white hover:bg-theme-accent-hover"
        >
          {showForm ? "Cancel" : "+ New rule"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Entity type</label>
              <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={inputCls}>
                {ENTITY_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Rule type</label>
              <select value={ruleType} onChange={(e) => setRuleType(e.target.value)} className={inputCls}>
                {RULE_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Min amount (₦)</label>
              <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Max amount (₦, optional)</label>
              <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} className={inputCls} />
            </div>
          </div>

          {ruleType === "department_based" && (
            <div><label className={labelCls}>Department ID</label>
              <input value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputCls} /></div>
          )}
          {ruleType === "category_based" && (
            <div><label className={labelCls}>Expense category ID</label>
              <input value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls} /></div>
          )}
          {ruleType === "project_based" && (
            <div><label className={labelCls}>Project ID</label>
              <input value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputCls} /></div>
          )}
          {ruleType === "vendor_based" && (
            <div><label className={labelCls}>Vendor ID</label>
              <input value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={inputCls} /></div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>SLA hours (optional)</label>
              <input type="number" value={slaHours} onChange={(e) => setSlaHours(e.target.value)} className={inputCls} placeholder="e.g. 48" />
            </div>
            <div>
              <label className={labelCls}>On SLA breach</label>
              <select value={slaAction} onChange={(e) => setSlaAction(e.target.value as any)} className={inputCls}>
                <option value="remind">Remind approvers</option>
                <option value="escalate">Escalate to next step</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority (higher wins)</label>
              <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Approver steps (same step = any one approver)</label>
              <button type="button" onClick={addStep} className="text-xs text-theme-accent font-medium">+ Add approver</button>
            </div>
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    value={s.step}
                    onChange={(e) => {
                      const next = [...steps];
                      next[i] = { ...s, step: Number(e.target.value) };
                      setSteps(next);
                    }}
                    className="w-16 rounded-lg border border-theme-border px-2 py-2 text-sm"
                    title="Step number"
                  />
                  <div className="flex-1">
                    <UserSpecInput
                      value={s.userId}
                      onChange={(v) => {
                        const next = [...steps];
                        next[i] = { ...s, userId: v };
                        setSteps(next);
                      }}
                      users={users}
                      extraSpecs={officerSpecs}
                    />
                  </div>
                  <label className="flex items-center gap-1 text-xs text-theme-text-secondary">
                    <input
                      type="checkbox"
                      checked={s.required}
                      onChange={(e) => {
                        const next = [...steps];
                        next[i] = { ...s, required: e.target.checked };
                        setSteps(next);
                      }}
                    />
                    Required
                  </label>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSteps(steps.filter((_, j) => j !== i))}
                      className="text-rose-600 text-sm px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-theme-text-secondary hover:bg-theme-muted">
              Cancel
            </button>
            <button
              onClick={submitRule}
              disabled={saving}
              className="rounded-lg bg-theme-accent px-4 py-2 text-sm font-semibold text-white hover:bg-theme-accent-hover disabled:opacity-50"
            >
              {saving ? "Saving…" : "Create rule"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-theme-border bg-theme-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Entity</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Conditions</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Steps</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Priority</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Active</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-theme-text-secondary">Loading rules…</td></tr>
            ) : rules.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-theme-text-secondary">
                No rules configured — documents fall back to threshold-based default chains.
              </td></tr>
            ) : rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-theme-muted">
                <td className="px-4 py-3 text-sm font-medium text-theme-text-primary">{rule.entityType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-sm text-theme-text-secondary">{rule.ruleType.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-xs text-theme-text-secondary">{conditionsSummary(rule)}</td>
                <td className="px-4 py-3 text-xs text-theme-text-secondary" title={rule.approvers.map((a) => `step ${a.step}: ${a.userId}`).join("\n")}>
                  {rule.approvers.length} approver{rule.approvers.length === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3 text-sm text-theme-text-secondary">{rule.priority}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${rule.isActive ? "bg-green-100 text-green-800" : "bg-theme-muted text-theme-text-secondary"}`}
                  >
                    {rule.isActive ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => deleteRule(rule)} className="text-rose-600 hover:text-rose-900 text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DelegatesPanel({ tenantSlug, onError, onSuccess }: {
  tenantSlug: string;
  onError: (m: string | null) => void;
  onSuccess: (m: string) => void;
}) {
  const [delegates, setDelegates] = useState<ApprovalDelegate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const users = useUserOptions(tenantSlug);

  const [delegatorId, setDelegatorId] = useState("");
  const [delegateId, setDelegateId] = useState("");
  const [entityType, setEntityType] = useState("");
  const [validTo, setValidTo] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/approvals?delegates=true&tenantSlug=${encodeURIComponent(tenantSlug)}`);
      const data = await res.json();
      setDelegates(data.delegates || []);
    } catch {
      onError("Failed to load delegations");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, onError]);

  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/finance/approvals?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const create = async () => {
    if (!delegatorId.trim() || !delegateId.trim()) {
      onError("Both delegator and delegate are required");
      return;
    }
    setSaving(true);
    try {
      await post({
        action: "create-delegate",
        delegatorId: delegatorId.trim(),
        delegateId: delegateId.trim(),
        entityType: entityType || undefined,
        validTo: validTo || undefined,
        note: note || undefined,
      });
      onSuccess("Delegation created");
      setDelegatorId(""); setDelegateId(""); setEntityType(""); setValidTo(""); setNote("");
      load();
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (d: ApprovalDelegate) => {
    try {
      await post({ action: "revoke-delegate", delegateRecordId: d.id });
      onSuccess("Delegation revoked");
      load();
    } catch (e: any) {
      onError(e.message);
    }
  };

  const inputCls = "w-full rounded-lg border border-theme-border px-3 py-2 text-sm";
  const labelCls = "block text-xs font-medium text-theme-text-primary mb-1";
  const nameFor = (id: string) => users.find((u) => u.id === id)?.name;

  return (
    <div className="space-y-4">
      <p className="text-sm text-theme-text-secondary">
        Delegation lets an approver hand their authority to another user — e.g. while out of office.
        The delegate acts in their own identity; the original approver is recorded as the delegated authority.
      </p>

      <div className="rounded-2xl border border-theme-border bg-theme-surface p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Delegator (approver handing off)</label>
            <UserSpecInput value={delegatorId} onChange={setDelegatorId} users={users} placeholder="approver user id" />
            {nameFor(delegatorId) && <p className="text-xs text-theme-text-secondary mt-1">{nameFor(delegatorId)}</p>}
          </div>
          <div>
            <label className={labelCls}>Delegate (acts in their place)</label>
            <UserSpecInput value={delegateId} onChange={setDelegateId} users={users} placeholder="delegate user id" />
            {nameFor(delegateId) && <p className="text-xs text-theme-text-secondary mt-1">{nameFor(delegateId)}</p>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Scope</label>
            <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className={inputCls}>
              <option value="">All document types</option>
              {ENTITY_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Valid until (optional)</label>
            <input type="datetime-local" value={validTo} onChange={(e) => setValidTo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="e.g. Annual leave" />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={create}
            disabled={saving}
            className="rounded-lg bg-theme-accent px-4 py-2 text-sm font-semibold text-white hover:bg-theme-accent-hover disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create delegation"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-theme-border bg-theme-surface shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-theme-border bg-theme-muted">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Delegator</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Delegate</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Scope</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Window</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-text-secondary uppercase">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-theme-text-secondary">Loading…</td></tr>
            ) : delegates.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-theme-text-secondary">No delegations configured.</td></tr>
            ) : delegates.map((d) => {
              const expired = d.validTo ? new Date(d.validTo) < new Date() : false;
              return (
                <tr key={d.id} className="hover:bg-theme-muted">
                  <td className="px-4 py-3 text-sm text-theme-text-primary">{nameFor(d.delegatorId) ?? d.delegatorId}</td>
                  <td className="px-4 py-3 text-sm text-theme-text-primary">{nameFor(d.delegateId) ?? d.delegateId}</td>
                  <td className="px-4 py-3 text-sm text-theme-text-secondary">{d.entityType?.replace(/_/g, " ") ?? "all"}</td>
                  <td className="px-4 py-3 text-xs text-theme-text-secondary">
                    {format(new Date(d.validFrom), "MMM dd")} → {d.validTo ? format(new Date(d.validTo), "MMM dd, yyyy HH:mm") : "open"}
                    {d.note ? ` · ${d.note}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${d.active && !expired ? "bg-green-100 text-green-800" : "bg-theme-muted text-theme-text-secondary"}`}>
                      {d.active ? (expired ? "Expired" : "Active") : "Revoked"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {d.active && (
                      <button onClick={() => revoke(d)} className="text-rose-600 hover:text-rose-900 text-sm">Revoke</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OfficersPanel({ tenantSlug, onError, onSuccess }: {
  tenantSlug: string;
  onError: (m: string | null) => void;
  onSuccess: (m: string) => void;
}) {
  const { officers, reload } = useOfficers(tenantSlug);
  const users = useUserOptions(tenantSlug);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [newMember, setNewMember] = useState("");
  const [memberAdds, setMemberAdds] = useState<Record<number, string>>({});

  const nameFor = (id: string) => users.find((u) => u.id === id)?.name ?? id;
  const inputCls = "w-full rounded-lg border border-theme-border px-3 py-2 text-sm";

  const save = async (next: TenantOfficer[]) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/finance/approvals?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-officers", officers: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save officers");
      onSuccess("Officers updated");
      reload();
    } catch (e: any) {
      onError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const addPost = async () => {
    if (!title.trim()) { onError("Enter an officer title (e.g. Managing Director)"); return; }
    const userIds = newMember.trim() ? [newMember.trim()] : [];
    await save([...officers, { title: title.trim(), userIds }]);
    setTitle(""); setNewMember("");
  };

  const removePost = (idx: number) => {
    if (!confirm(`Remove the "${officers[idx].title}" officer post?`)) return;
    save(officers.filter((_, i) => i !== idx));
  };

  const addMember = (idx: number) => {
    const uid = (memberAdds[idx] ?? "").trim();
    if (!uid) return;
    const next = officers.map((o, i) =>
      i === idx ? { ...o, userIds: [...new Set([...o.userIds, uid])] } : o);
    setMemberAdds({ ...memberAdds, [idx]: "" });
    save(next);
  };

  const removeMember = (idx: number, uid: string) => {
    const next = officers.map((o, i) =>
      i === idx ? { ...o, userIds: o.userIds.filter((u) => u !== uid) } : o);
    save(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-theme-text-secondary">
        Officers are company-wide approval posts — e.g. <b>Managing Director</b> or <b>Chairman</b>.
        Unlike department managers (who only decide their own department's documents), officers act on
        any document routed to them. In a rule, reference a post as <code>role:&lt;title-slug&gt;</code>
        — shown on each card below. Multiple users on one post act as parallel approvers (any one decides).
      </p>

      {/* New post */}
      <div className="rounded-2xl border border-theme-border bg-theme-surface p-6">
        <div className="grid grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-1">Officer title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Managing Director"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-theme-text-primary mb-1">First holder (optional)</label>
            <UserSpecInput value={newMember} onChange={setNewMember} users={users} placeholder="user id" />
          </div>
          <button
            onClick={addPost}
            disabled={saving}
            className="rounded-lg bg-theme-accent px-4 py-2 text-sm font-semibold text-white hover:bg-theme-accent-hover disabled:opacity-50"
          >
            Add post
          </button>
        </div>
      </div>

      {/* Officer cards */}
      {officers.length === 0 ? (
        <div className="rounded-2xl border border-theme-border bg-theme-surface p-8 text-center text-sm text-theme-text-secondary">
          No officers configured yet. Add posts like "Managing Director" or "Chairman" so rules can route to them.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {officers.map((o, idx) => (
            <div key={idx} className="rounded-2xl border border-theme-border bg-theme-surface p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-semibold text-theme-text-primary">{o.title}</h4>
                  <code className="text-xs text-theme-text-secondary">role:{officerSlug(o.title)}</code>
                </div>
                <button onClick={() => removePost(idx)} className="text-rose-600 hover:text-rose-900 text-sm">Remove</button>
              </div>
              <div className="mt-3 space-y-1.5">
                {o.userIds.length === 0 && (
                  <p className="text-xs text-amber-600">No holder assigned — steps routed here fall back to tenant admins.</p>
                )}
                {o.userIds.map((uid) => (
                  <div key={uid} className="flex items-center justify-between rounded-lg bg-theme-muted px-3 py-1.5">
                    <span className="text-sm text-theme-text-primary">{nameFor(uid)}</span>
                    <button onClick={() => removeMember(idx, uid)} className="text-rose-600 text-xs">remove</button>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <div className="flex-1">
                    <UserSpecInput
                      value={memberAdds[idx] ?? ""}
                      onChange={(v) => setMemberAdds({ ...memberAdds, [idx]: v })}
                      users={users}
                      placeholder="add user id…"
                    />
                  </div>
                  <button
                    onClick={() => addMember(idx)}
                    disabled={saving}
                    className="rounded-lg border border-theme-border px-3 py-1.5 text-xs font-medium text-theme-text-primary hover:bg-theme-muted disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
