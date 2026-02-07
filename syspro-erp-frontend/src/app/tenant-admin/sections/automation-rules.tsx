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

  const [form, setForm] = useState({
    name: "",
    eventType: "",
    description: "",
    condition: '{"op":"exists","field":"payload.id"}',
    actions: '[{"type":"notify","params":{"channel":"email","template":"default"}}]',
  });

  const triggerOptions = useMemo(() => triggers.map((t) => t.key), [triggers]);

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
      const condition = JSON.parse(form.condition || "{}");
      const actions = JSON.parse(form.actions || "[]");
      const res = await fetch(`/api/automation/rules?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          eventType: form.eventType,
          condition,
          actions,
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
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Automation</p>
            <h2 className="text-xl font-semibold text-slate-900">Rules</h2>
            <p className="mt-1 text-sm text-slate-500">Event triggers with conditional logic and cross-module actions.</p>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" disabled={loading}>
            <RefreshCcw className="h-4 w-4" /> Refresh
          </button>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleCreate}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Rule name</label>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Event type</label>
              <input list="trigger-list" value={form.eventType} onChange={(e) => setForm((p) => ({ ...p, eventType: e.target.value }))} required className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <datalist id="trigger-list">
                {triggerOptions.map((t) => (
                  <option value={t} key={t} />
                ))}
              </datalist>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" rows={2} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Condition (JSON)</label>
              <textarea value={form.condition} onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" rows={4} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Actions (JSON)</label>
              <textarea value={form.actions} onChange={(e) => setForm((p) => ({ ...p, actions: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs" rows={4} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Create rule
            </button>
            {error && <span className="text-sm text-rose-600">{error}</span>}
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Rulebook</p>
            <h3 className="text-lg font-semibold text-slate-900">Configured rules</h3>
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
                    <p className="text-sm font-semibold text-slate-900">{rule.name}</p>
                    <p className="text-xs text-slate-500">{rule.eventType}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => simulate(rule)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-white">
                      <Play className="h-3 w-3" /> Simulate
                    </button>
                    <button onClick={() => toggleRule(rule)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:bg-white">
                      {rule.enabled ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-slate-400" />} {rule.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </div>
                {rule.description && <p className="mt-2 text-sm text-slate-600">{rule.description}</p>}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-white p-3 text-xs text-slate-700">
                    <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">Condition</div>
                    <pre className="whitespace-pre-wrap break-all">{JSON.stringify(rule.condition, null, 2)}</pre>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-xs text-slate-700">
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
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
                    <div className="text-sm font-semibold text-slate-900">{audit.matched ? "Matched" : "Skipped"}</div>
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
