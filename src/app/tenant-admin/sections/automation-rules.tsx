"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, RefreshCcw, ToggleLeft, ToggleRight } from "lucide-react";

type Rule = {
  id: string;
  name: string;
  description?: string;
  eventType: string;
  condition: any;
  actions: any[];
  enabled: boolean;
};

type RuleTemplate = {
  label: string;
  name: string;
  description: string;
  eventType: string;
  condition: { op: string; field: string; value: any };
  actions: any[];
};

const TEMPLATES: RuleTemplate[] = [
  { label: "Custom rule", name: "", description: "", eventType: "", condition: { op: "exists", field: "payload.id", value: "" }, actions: [{ type: "notify", params: { channel: "email", template: "default" } }] },
  { label: "Notify admin on missed check-in", name: "Missed check-in alert", description: "Notify admin when an employee misses a check-in", eventType: "attendance.missed", condition: { op: "exists", field: "payload.employeeId", value: "" }, actions: [{ type: "notify", params: { channel: "email", template: "missed-checkin" } }] },
  { label: "Create task for new support ticket", name: "Support ticket task", description: "Create a task when a new support ticket is created", eventType: "support.ticket-created", condition: { op: "exists", field: "payload.ticketId", value: "" }, actions: [{ type: "task", params: { title: "Handle support ticket", assignee: "@admin" } }] },
  { label: "Alert when project goes over budget", name: "Over budget alert", description: "Notify project lead when budget threshold is crossed", eventType: "projects.over-budget", condition: { op: "gt", field: "payload.spent", value: "1000" }, actions: [{ type: "email", params: { to: "pm@example.com", subject: "Project over budget" } }] },
];

export default function AutomationRules({ tenantSlug }: { tenantSlug: string }) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [triggers, setTriggers] = useState<Array<{ key: string; module: string; description: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);
  const [audits, setAudits] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [previewPayload, setPreviewPayload] = useState('{\n  "id": "123"\n}');

  const [form, setForm] = useState<{ name: string; eventType: string; description: string; condition: any; actions: Array<{ type: string; params: Record<string, string> }> }>({
    name: "",
    eventType: "",
    description: "",
    condition: { op: "exists", field: "payload.id", value: "" },
    actions: [{ type: "notify", params: { channel: "email", template: "default" } }],
  });

  const groupedTriggers = useMemo(() => {
    return triggers.reduce((acc, t) => {
      (acc[t.module] = acc[t.module] || []).push(t);
      return acc;
    }, {} as Record<string, typeof triggers>);
  }, [triggers]);

  const needsValueOps = ["eq", "neq", "gt", "gte", "lt", "lte", "includes", "excludes"];

  function updateCondition(patch: Partial<typeof form.condition>) {
    setForm((p) => ({ ...p, condition: { ...p.condition, ...patch } }));
  }

  function updateAction(index: number, patch: any) {
    setForm((p) => {
      const actions = [...p.actions];
      actions[index] = { ...actions[index], ...patch };
      return { ...p, actions };
    });
  }

  function addAction() {
    setForm((p) => ({
      ...p,
      actions: [...p.actions, { type: "notify", params: { channel: "email", template: "default" } }],
    }));
  }

  function removeAction(index: number) {
    setForm((p) => ({ ...p, actions: p.actions.filter((_, i) => i !== index) }));
  }

  function applyTemplate(index: number) {
    setSelectedTemplate(index);
    const t = TEMPLATES[index];
    setForm({
      name: t.name,
      eventType: t.eventType,
      description: t.description,
      condition: t.condition,
      actions: t.actions,
    });
  }

  function getPayloadValue(payload: any, path?: string) {
    if (!path) return undefined;
    return path.split(".").reduce((acc: any, key: string) => acc?.[key], payload);
  }

  function compareDraft(op: string, left: any, right: any) {
    switch (op) {
      case "eq": return left === right;
      case "neq": return left !== right;
      case "gt": return Number(left) > Number(right);
      case "gte": return Number(left) >= Number(right);
      case "lt": return Number(left) < Number(right);
      case "lte": return Number(left) <= Number(right);
      case "includes": return Array.isArray(left) ? left.includes(right) : typeof left === "string" ? left.includes(String(right)) : false;
      case "excludes": return Array.isArray(left) ? !left.includes(right) : typeof left === "string" ? !left.includes(String(right)) : false;
      case "exists": return left !== undefined && left !== null;
      case "missing": return left === undefined || left === null;
      default: return false;
    }
  }

  function evaluateDraft(condition: any, payload: any): boolean {
    if (condition.all && condition.all.length > 0) return condition.all.every((c: any) => evaluateDraft(c, payload));
    if (condition.any && condition.any.length > 0) return condition.any.some((c: any) => evaluateDraft(c, payload));
    return compareDraft(condition.op, getPayloadValue(payload, condition.field), condition.value);
  }

  const previewResult = useMemo(() => {
    try {
      const payload = JSON.parse(previewPayload);
      const matched = evaluateDraft(form.condition, payload);
      return { matched, actions: matched ? form.actions : [], error: null };
    } catch (err) {
      return { matched: false, actions: [], error: "Invalid payload JSON" };
    }
  }, [form.condition, form.actions, previewPayload]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [trigRes, ruleRes] = await Promise.all([
        fetch(`/api/automation/triggers?tenantSlug=${encodeURIComponent(tenantSlug)}`),
        fetch(`/api/automation/rules?tenantSlug=${encodeURIComponent(tenantSlug)}`),
      ]);
      if (!trigRes.ok) throw new Error("Unable to load triggers");
      if (!ruleRes.ok) throw new Error("Unable to load rules");
      const trigJson = await trigRes.json();
      const ruleJson = await ruleRes.json();
      setTriggers(trigJson.triggers || []);
      setRules(ruleJson.rules || []);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [tenantSlug]);

  async function loadAudits() {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await fetch(`/api/automation/audit?tenantSlug=${encodeURIComponent(tenantSlug)}`);
      if (!res.ok) throw new Error("Unable to load audits");
      const json = await res.json();
      setAudits(json.audits || []);
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : String(err));
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/automation/rules?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          eventType: form.eventType,
          condition: form.condition,
          actions: form.actions,
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      setForm({ name: "", eventType: form.eventType, description: "", condition: form.condition, actions: form.actions });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: Rule) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/automation/rules/${rule.id}?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) throw new Error("Toggle failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function simulate(rule: Rule) {
    setSimResult(null);
    const res = await fetch(`/api/automation/rules/simulate?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId: rule.id, event: { type: rule.eventType, payload: {} } }),
    });
    if (res.ok) {
      const json = await res.json();
      setSimResult({ rule: rule.name, result: json.result });
    } else {
      setSimResult({ rule: rule.name, result: { error: await res.text() } });
    }
    loadAudits();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-theme-muted p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <h2 className="text-xl font-semibold text-gray-900">Rules</h2>
            <p className="mt-1 text-sm text-slate-500">Event triggers with conditional logic and cross-module actions.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" disabled={loading}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Start from a template</label>
            <select value={selectedTemplate} onChange={(e) => applyTemplate(Number(e.target.value))} className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {TEMPLATES.map((t, i) => (
                <option key={i} value={i}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Rule name</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Event trigger</label>
              <select value={form.eventType} onChange={(e) => setForm((p) => ({ ...p, eventType: e.target.value }))} required className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select a trigger</option>
                {Object.entries(groupedTriggers).map(([module, items]) => (
                  <optgroup key={module} label={module}>
                    {items.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.key} — {t.description}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={2} />
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <label className="block text-sm font-medium text-gray-900 mb-3">Condition</label>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Operator</label>
                  <select value={form.condition.op} onChange={(e) => updateCondition({ op: e.target.value, value: "" })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    {["exists", "missing", "eq", "neq", "gt", "gte", "lt", "lte", "includes", "excludes"].map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Field path</label>
                  <input value={form.condition.field} onChange={(e) => updateCondition({ field: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="payload.id" />
                </div>
                {needsValueOps.includes(form.condition.op) && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Value</label>
                    <input value={String(form.condition.value ?? "")} onChange={(e) => updateCondition({ value: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="value to compare" />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-900">Actions</label>
                <button type="button" onClick={addAction} className="text-xs text-blue-600 hover:text-blue-700">+ Add action</button>
              </div>
              <div className="space-y-3">
                {form.actions.map((action, i) => (
                  <div key={i} className="grid gap-3 md:grid-cols-3 items-end rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Action type</label>
                      <select value={action.type} onChange={(e) => updateAction(i, { type: e.target.value, params: {} })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <option value="notify">Notify</option>
                        <option value="webhook">Webhook</option>
                        <option value="email">Email</option>
                        <option value="task">Task</option>
                      </select>
                    </div>
                    {action.type === "notify" ? (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Channel</label>
                          <input value={action.params?.channel || ""} onChange={(e) => updateAction(i, { params: { ...action.params, channel: e.target.value } })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="email" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Template</label>
                          <input value={action.params?.template || ""} onChange={(e) => updateAction(i, { params: { ...action.params, template: e.target.value } })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="default" />
                        </div>
                      </>
                    ) : action.type === "webhook" ? (
                      <div className="md:col-span-2">
                        <label className="block text-xs text-gray-500 mb-1">URL</label>
                        <input value={action.params?.url || ""} onChange={(e) => updateAction(i, { params: { ...action.params, url: e.target.value } })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="https://..." />
                      </div>
                    ) : action.type === "email" ? (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">To</label>
                          <input value={action.params?.to || ""} onChange={(e) => updateAction(i, { params: { ...action.params, to: e.target.value } })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="user@example.com" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Subject</label>
                          <input value={action.params?.subject || ""} onChange={(e) => updateAction(i, { params: { ...action.params, subject: e.target.value } })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Subject" />
                        </div>
                      </>
                    ) : action.type === "task" ? (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Title</label>
                          <input value={action.params?.title || ""} onChange={(e) => updateAction(i, { params: { ...action.params, title: e.target.value } })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Task title" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Assignee</label>
                          <input value={action.params?.assignee || ""} onChange={(e) => updateAction(i, { params: { ...action.params, assignee: e.target.value } })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="@username" />
                        </div>
                      </>
                    ) : null}
                    <div className="flex justify-end md:col-span-3">
                      <button type="button" onClick={() => removeAction(i)} className="text-xs text-rose-600 hover:text-rose-700">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <label className="block text-sm font-medium text-gray-900 mb-2">Live preview</label>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sample payload (JSON)</label>
                <textarea value={previewPayload} onChange={(e) => setPreviewPayload(e.target.value)} className="bg-white w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" rows={5} />
                {previewResult.error && <p className="mt-1 text-xs text-rose-600">{previewResult.error}</p>}
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400 mb-2">Result</p>
                {previewResult.error ? (
                  <p className="text-sm text-slate-600">Fix the payload JSON to see the preview.</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-900">
                      {previewResult.matched ? "Matched" : "Skipped"}
                    </p>
                    {previewResult.matched && (
                      <div className="mt-2">
                        <p className="text-xs text-slate-500">Actions that would run:</p>
                        <ul className="mt-1 space-y-1 text-xs text-slate-700">
                          {previewResult.actions.map((action, i) => (
                            <li key={i} className="rounded bg-white border border-slate-100 px-2 py-1">{action.type}: {JSON.stringify(action.params)}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Create rule
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-theme-muted p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Rulebook</p>
            <h3 className="text-lg font-semibold text-gray-900">Configured rules</h3>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading rules…</div>
        ) : rules.length === 0 ? (
          <div className="text-sm text-slate-500">No rules yet. Create your first automation above.</div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{rule.name}</p>
                    <p className="text-xs text-slate-500">{rule.eventType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => simulate(rule)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-theme-muted">
                      <Play className="h-3 w-3" /> Simulate
                    </button>
                    <button onClick={() => toggleRule(rule)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-theme-muted">
                      {rule.enabled ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />} {rule.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </div>
                {rule.description && <p className="mt-2 text-sm text-slate-600">{rule.description}</p>}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-theme-muted p-3 text-xs text-slate-700">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">Condition</div>
                    <pre className="whitespace-pre-wrap break-all">{JSON.stringify(rule.condition, null, 2)}</pre>
                  </div>
                  <div className="rounded-xl bg-theme-muted p-3 text-xs text-slate-700">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">Actions</div>
                    <pre className="whitespace-pre-wrap break-all">{JSON.stringify(rule.actions, null, 2)}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {simResult && (
            <div className="rounded-2xl border border-slate-200 bg-theme-muted p-4 text-sm text-slate-800">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Simulation</div>
                <button onClick={loadAudits} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50" disabled={auditLoading}>
                  {auditLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />} Audits
                </button>
              </div>
              <div className="font-semibold">{simResult.rule}</div>
              <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-slate-700">{JSON.stringify(simResult.result, null, 2)}</pre>
            </div>
          )}
          <div className="rounded-2xl border border-slate-200 bg-theme-muted p-4 text-sm text-slate-800">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Audit log</div>
              <button onClick={loadAudits} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50" disabled={auditLoading}>
                {auditLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />} Refresh
              </button>
            </div>
            {auditError && <div className="mt-2 text-xs text-rose-600">{auditError}</div>}
            {audits.length === 0 && !auditLoading ? (
              <p className="mt-2 text-xs text-slate-600">No audits yet. Run a simulation or trigger an event.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {audits.map((audit) => (
                  <div key={audit.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{audit.triggerEvent}</span>
                      <span>{audit.createdAt}</span>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">{audit.matched ? "Matched" : "Skipped"}</div>
                    {audit.result && <pre className="mt-1 whitespace-pre-wrap break-all text-xs text-slate-700">{JSON.stringify(audit.result, null, 2)}</pre>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
