"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { KvEditor, objectToRows, rowsToObject, type KvRow } from "@/app/tenant-admin/components/kv-editor";

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  webhook_url?: string;
  webhookUrl?: string;
  config?: Record<string, any>;
  events?: string[];
  last_sync_at?: string;
  error_message?: string;
}

interface ApiKey {
  id: string;
  name: string;
  keyPrefix?: string;
  key_prefix?: string;
  expires_at?: string;
  revoked_at?: string;
  last_used_at?: string;
  created_at?: string;
}

const INTEGRATION_TYPES = ["webhook", "oauth", "api_key", "custom"];
const MASK = "********";

const EVENT_OPTIONS = [
  { id: "create", label: "Created" },
  { id: "update", label: "Updated" },
  { id: "submit", label: "Submitted / issued" },
  { id: "cancel", label: "Cancelled" },
] as const;
const ALL_EVENTS = EVENT_OPTIONS.map((e) => e.id);

const DOC_TYPE_OPTIONS = [
  "invoice", "sales_order", "payment", "expense", "bill", "purchase_order",
  "lead", "deal", "customer", "employee", "payroll_run", "work_order",
];

export default function IntegrationsPage() {
  const { tenantSlug } = useTenantContext();
  const [tab, setTab] = useState<"integrations" | "api-keys">("integrations");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Integration form state
  const [showIntForm, setShowIntForm] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);
  const [intName, setIntName] = useState("");
  const [intType, setIntType] = useState("webhook");
  const [intWebhook, setIntWebhook] = useState("");
  const [intEnabled, setIntEnabled] = useState(true);
  const [intConfigRows, setIntConfigRows] = useState<KvRow[]>([]);
  const [intEvents, setIntEvents] = useState<string[]>([...ALL_EVENTS]);
  const [intDocTypes, setIntDocTypes] = useState<string[]>([]);
  const [intSecret, setIntSecret] = useState("");

  // API key form state
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [keyLabel, setKeyLabel] = useState("");
  const [newKey, setNewKey] = useState<{ key: string; secret: string } | null>(null);

  const load = useCallback(async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const [intRes, keyRes] = await Promise.all([
        fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}&type=integrations`),
        fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}&type=api-keys`),
      ]);
      if (!intRes.ok) throw new Error("Failed to load integrations");
      const intData = await intRes.json();
      setIntegrations(intData.data?.integrations || []);
      if (keyRes.ok) {
        const keyData = await keyRes.json();
        setApiKeys(keyData.data?.apiKeys || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setIntName(""); setIntType("webhook"); setIntWebhook(""); setIntEnabled(true); setIntConfigRows([]);
    setIntEvents([...ALL_EVENTS]); setIntDocTypes([]); setIntSecret("");
    setShowIntForm(true);
  }

  function openEdit(i: Integration) {
    setEditing(i);
    setIntName(i.name);
    setIntType(i.type);
    setIntWebhook(i.webhook_url || i.webhookUrl || "");
    setIntEnabled(i.status === "active");
    // Dedicated fields own docTypes/webhookSecret — keep the KvEditor for the
    // remaining custom config only.
    const { docTypes, webhookSecret, ...restConfig } = (i.config || {}) as Record<string, any>;
    setIntConfigRows(objectToRows(restConfig));
    setIntEvents(i.events && i.events.length ? i.events : [...ALL_EVENTS]);
    setIntDocTypes(Array.isArray(docTypes) ? docTypes.map(String) : []);
    setIntSecret(typeof webhookSecret === "string" ? webhookSecret : "");
    setShowIntForm(true);
  }

  async function saveIntegration() {
    if (!tenantSlug || !intName.trim()) return;
    const config: Record<string, any> = { ...rowsToObject(intConfigRows), docTypes: intDocTypes };
    if (intSecret) config.webhookSecret = intSecret;
    const body = { name: intName, enabled: intEnabled, config, webhookUrl: intWebhook || undefined, events: intEvents };
    setError(null);
    try {
      if (editing) {
        const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}&id=${editing.id}&type=integration`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      } else {
        const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}&type=integration`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, type: intType }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Create failed");
      }
      setShowIntForm(false);
      setNotice(editing ? "Integration updated" : "Integration created");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function deleteIntegration(id: string) {
    if (!tenantSlug || !confirm("Delete this integration?")) return;
    const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}&id=${id}&type=integration`, { method: "DELETE" });
    if (!res.ok) { setError("Delete failed"); return; }
    setNotice("Integration deleted");
    await load();
  }

  async function createKey() {
    if (!tenantSlug || !keyLabel.trim()) return;
    setError(null);
    const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}&type=api-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: keyLabel }),
    });
    if (!res.ok) { setError((await res.json()).error || "Create failed"); return; }
    const data = await res.json();
    setNewKey({ key: data.data.key, secret: data.data.secret });
    setKeyLabel("");
    setShowKeyForm(false);
    await load();
  }

  async function revokeKey(id: string) {
    if (!tenantSlug || !confirm("Revoke this API key? Existing calls will stop working.")) return;
    const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}&id=${id}&type=api-key&action=revoke`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) { setError("Revoke failed"); return; }
    setNotice("API key revoked");
    await load();
  }

  const fmt = (v?: string) => (v ? new Date(v).toLocaleDateString() : "—");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Integrations</h1>
        <div className="flex gap-2">
          <button onClick={tab === "integrations" ? openCreate : () => setShowKeyForm(true)} className="px-3 py-1.5 bg-theme-accent text-white text-sm rounded">
            {tab === "integrations" ? "New integration" : "New API key"}
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-theme-border mb-4">
        {(["integrations", "api-keys"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm ${tab === t ? "border-b-2 border-theme-accent text-blue-700 font-medium" : "text-theme-text-secondary"}`}>
            {t === "integrations" ? "Integrations" : "API keys"}
          </button>
        ))}
      </div>

      {error && <p className="text-red-600 mb-2">{error}</p>}
      {notice && <p className="text-green-700 mb-2">{notice}</p>}
      {loading && <p>Loading...</p>}

      {newKey && (
        <div className="mb-4 p-4 border border-amber-300 bg-amber-50 rounded">
          <p className="font-medium text-amber-900">Save these credentials — they are shown only once.</p>
          <p className="mt-2 text-sm"><span className="font-medium">Key:</span> <code className="bg-theme-surface px-1">{newKey.key}</code></p>
          <p className="text-sm"><span className="font-medium">Secret:</span> <code className="bg-theme-surface px-1">{newKey.secret}</code></p>
          <button onClick={() => setNewKey(null)} className="mt-2 text-sm text-blue-700 underline">I have saved them</button>
        </div>
      )}

      {tab === "integrations" && !loading && (
        <>
          {integrations.length === 0 && <p className="text-theme-text-secondary">No integrations configured yet.</p>}
          {integrations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-theme-surface border border-theme-border rounded-lg">
                <thead>
                  <tr className="bg-theme-muted">
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Name</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Type</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Last sync</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Error</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary"></th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.map((i) => (
                    <tr key={i.id} className="border-t border-theme-border">
                      <td className="px-4 py-2 text-sm text-theme-text-primary font-medium">{i.name}</td>
                      <td className="px-4 py-2 text-sm text-theme-text-primary">{i.type}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${i.status === "active" ? "bg-green-100 text-green-800" : i.status === "error" ? "bg-red-100 text-red-800" : "bg-theme-muted text-theme-text-primary"}`}>{i.status}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-theme-text-primary">{fmt(i.last_sync_at)}</td>
                      <td className="px-4 py-2 text-sm text-red-600 max-w-[200px] truncate">{i.error_message || "—"}</td>
                      <td className="px-4 py-2 text-sm space-x-3 whitespace-nowrap">
                        <button onClick={() => openEdit(i)} className="text-blue-700 underline">Edit</button>
                        <button onClick={() => deleteIntegration(i.id)} className="text-red-700 underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === "api-keys" && !loading && (
        <>
          <div className="mb-4 rounded-lg border border-theme-border bg-theme-surface p-4 text-sm">
            <p className="font-medium mb-1">Push data in from your tools</p>
            <p className="text-theme-text-secondary mb-2">
              A CRM, POS, or script can create records in this ERP with any active key —
              send <code>x-api-key</code> (or <code>Authorization: Bearer</code>) and <code>x-tenant-slug</code> headers to:
            </p>
            <ul className="space-y-1 text-xs font-mono text-theme-text-secondary">
              <li>POST /api/external/v1/leads &nbsp;—&nbsp; {"{ companyName, contactName, contactEmail?, stage?, externalId? }"}</li>
              <li>POST /api/external/v1/customers &nbsp;—&nbsp; {"{ name, contactName?, contactEmail?, externalId? }"}</li>
              <li>POST /api/external/v1/orders &nbsp;—&nbsp; {"{ customerName, items: [{ name, quantity, unitPrice }], externalId? }"}</li>
              <li>GET &nbsp;/api/external/v1/ping &nbsp;—&nbsp; connectivity check</li>
            </ul>
            <p className="text-xs text-theme-text-tertiary mt-2">
              Include an <code>externalId</code> to make retries safe — the same id never creates two records.
            </p>
          </div>
          {apiKeys.length === 0 && <p className="text-theme-text-secondary">No API keys yet. Keys authenticate external calls (e.g. the AI agent API) via the <code>x-api-key</code> + <code>x-tenant-slug</code> headers.</p>}
          {apiKeys.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-theme-surface border border-theme-border rounded-lg">
                <thead>
                  <tr className="bg-theme-muted">
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Label</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Key</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Expires</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Last used</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary"></th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => (
                    <tr key={k.id} className="border-t border-theme-border">
                      <td className="px-4 py-2 text-sm text-theme-text-primary font-medium">{k.name}</td>
                      <td className="px-4 py-2 text-sm text-theme-text-primary"><code>{(k.keyPrefix || k.key_prefix || "")}…</code></td>
                      <td className="px-4 py-2 text-sm">
                        {k.revoked_at
                          ? <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">revoked</span>
                          : <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">active</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-theme-text-primary">{fmt(k.expires_at)}</td>
                      <td className="px-4 py-2 text-sm text-theme-text-primary">{fmt(k.last_used_at)}</td>
                      <td className="px-4 py-2 text-sm">
                        {!k.revoked_at && <button onClick={() => revokeKey(k.id)} className="text-red-700 underline">Revoke</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showIntForm && (
        <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50" onClick={() => setShowIntForm(false)}>
          <div className="bg-theme-surface rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editing ? "Edit integration" : "New integration"}</h2>
            <label className="block text-sm mb-1">Name</label>
            <input value={intName} onChange={(e) => setIntName(e.target.value)} className="w-full border rounded px-2 py-1.5 mb-3 text-sm" />
            {!editing && (
              <>
                <label className="block text-sm mb-1">Type</label>
                <select value={intType} onChange={(e) => setIntType(e.target.value)} className="w-full border rounded px-2 py-1.5 mb-3 text-sm">
                  {INTEGRATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </>
            )}
            <label className="block text-sm mb-1">Webhook URL <span className="text-theme-text-tertiary">(we push events here)</span></label>
            <input value={intWebhook} onChange={(e) => setIntWebhook(e.target.value)} placeholder="https://your-crm.example.com/erp-events" className="w-full border rounded px-2 py-1.5 mb-3 text-sm" />
            {intWebhook && (
              <div className="mb-3 rounded border border-theme-border p-3 space-y-3 bg-theme-muted/40">
                <div>
                  <p className="text-sm font-medium mb-1">Send when a document is…</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {EVENT_OPTIONS.map((ev) => (
                      <label key={ev.id} className="flex items-center gap-1.5 text-sm">
                        <input
                          type="checkbox"
                          checked={intEvents.includes(ev.id)}
                          onChange={(e) =>
                            setIntEvents((prev) =>
                              e.target.checked ? [...prev, ev.id] : prev.filter((x) => x !== ev.id)
                            )
                          }
                        />
                        {ev.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">For these documents <span className="text-theme-text-tertiary font-normal">(none checked = everything)</span></p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {DOC_TYPE_OPTIONS.map((dt) => (
                      <label key={dt} className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          checked={intDocTypes.includes(dt)}
                          onChange={(e) =>
                            setIntDocTypes((prev) =>
                              e.target.checked ? [...prev, dt] : prev.filter((x) => x !== dt)
                            )
                          }
                        />
                        {dt.replace(/_/g, " ")}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Signing secret <span className="text-theme-text-tertiary font-normal">(optional)</span></p>
                  <input
                    value={intSecret}
                    onChange={(e) => setIntSecret(e.target.value)}
                    placeholder="Used to sign payloads — verify with X-ERP-Signature"
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  />
                  <p className="text-xs text-theme-text-tertiary mt-1">
                    Every delivery is POSTed with headers <code>X-ERP-Event</code>, <code>X-ERP-Delivery</code>, and{" "}
                    <code>X-ERP-Signature</code> (HMAC-SHA256 over the raw body). Deliveries retry automatically.
                  </p>
                </div>
              </div>
            )}
            <label className="block text-sm mb-1">Config entries <span className="text-theme-text-tertiary">(secrets show as {MASK} — leave as-is to keep them)</span></label>
            <div className="mb-3">
              <KvEditor rows={intConfigRows} onChange={setIntConfigRows} />
            </div>
            <label className="flex items-center gap-2 text-sm mb-4">
              <input type="checkbox" checked={intEnabled} onChange={(e) => setIntEnabled(e.target.checked)} /> Enabled
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowIntForm(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
              <button onClick={saveIntegration} className="px-3 py-1.5 text-sm bg-theme-accent text-white rounded">{editing ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {showKeyForm && (
        <div className="fixed inset-0 bg-theme-overlay flex items-center justify-center z-50" onClick={() => setShowKeyForm(false)}>
          <div className="bg-theme-surface rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">New API key</h2>
            <label className="block text-sm mb-1">Label</label>
            <input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder="e.g. Reporting pipeline" className="w-full border rounded px-2 py-1.5 mb-4 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowKeyForm(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
              <button onClick={createKey} className="px-3 py-1.5 text-sm bg-theme-accent text-white rounded">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
