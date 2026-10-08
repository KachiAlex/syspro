"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  webhook_url?: string;
  webhookUrl?: string;
  config?: Record<string, any>;
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
  const [intConfigJson, setIntConfigJson] = useState("{}");

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
    setIntName(""); setIntType("webhook"); setIntWebhook(""); setIntEnabled(true); setIntConfigJson("{}");
    setShowIntForm(true);
  }

  function openEdit(i: Integration) {
    setEditing(i);
    setIntName(i.name);
    setIntType(i.type);
    setIntWebhook(i.webhook_url || i.webhookUrl || "");
    setIntEnabled(i.status === "active");
    setIntConfigJson(JSON.stringify(i.config || {}, null, 2));
    setShowIntForm(true);
  }

  async function saveIntegration() {
    if (!tenantSlug || !intName.trim()) return;
    let config: Record<string, any>;
    try {
      config = JSON.parse(intConfigJson || "{}");
    } catch {
      setError("Config must be valid JSON");
      return;
    }
    setError(null);
    try {
      if (editing) {
        const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}&id=${editing.id}&type=integration`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: intName, enabled: intEnabled, config, webhookUrl: intWebhook || undefined }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Update failed");
      } else {
        const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(tenantSlug)}&type=integration`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: intName, type: intType, enabled: intEnabled, config, webhookUrl: intWebhook || undefined }),
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
          <button onClick={tab === "integrations" ? openCreate : () => setShowKeyForm(true)} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded">
            {tab === "integrations" ? "New integration" : "New API key"}
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-4">
        {(["integrations", "api-keys"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`pb-2 text-sm ${tab === t ? "border-b-2 border-blue-600 text-blue-700 font-medium" : "text-gray-500"}`}>
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
          <p className="mt-2 text-sm"><span className="font-medium">Key:</span> <code className="bg-white px-1">{newKey.key}</code></p>
          <p className="text-sm"><span className="font-medium">Secret:</span> <code className="bg-white px-1">{newKey.secret}</code></p>
          <button onClick={() => setNewKey(null)} className="mt-2 text-sm text-blue-700 underline">I have saved them</button>
        </div>
      )}

      {tab === "integrations" && !loading && (
        <>
          {integrations.length === 0 && <p className="text-gray-500">No integrations configured yet.</p>}
          {integrations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Last sync</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Error</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {integrations.map((i) => (
                    <tr key={i.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-sm text-gray-900 font-medium">{i.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{i.type}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs ${i.status === "active" ? "bg-green-100 text-green-800" : i.status === "error" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-700"}`}>{i.status}</span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{fmt(i.last_sync_at)}</td>
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
          {apiKeys.length === 0 && <p className="text-gray-500">No API keys yet. Keys authenticate external calls (e.g. the AI agent API) via the <code>x-api-key</code> + <code>x-tenant-slug</code> headers.</p>}
          {apiKeys.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Label</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Key</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Expires</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Last used</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k) => (
                    <tr key={k.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 text-sm text-gray-900 font-medium">{k.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-700"><code>{(k.keyPrefix || k.key_prefix || "")}…</code></td>
                      <td className="px-4 py-2 text-sm">
                        {k.revoked_at
                          ? <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-800">revoked</span>
                          : <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-800">active</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">{fmt(k.expires_at)}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">{fmt(k.last_used_at)}</td>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowIntForm(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
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
            <label className="block text-sm mb-1">Webhook URL</label>
            <input value={intWebhook} onChange={(e) => setIntWebhook(e.target.value)} placeholder="https://…" className="w-full border rounded px-2 py-1.5 mb-3 text-sm" />
            <label className="block text-sm mb-1">Config (JSON — secrets show as {MASK})</label>
            <textarea value={intConfigJson} onChange={(e) => setIntConfigJson(e.target.value)} rows={5} className="w-full border rounded px-2 py-1.5 mb-3 text-sm font-mono" />
            <label className="flex items-center gap-2 text-sm mb-4">
              <input type="checkbox" checked={intEnabled} onChange={(e) => setIntEnabled(e.target.checked)} /> Enabled
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowIntForm(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
              <button onClick={saveIntegration} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded">{editing ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {showKeyForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowKeyForm(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">New API key</h2>
            <label className="block text-sm mb-1">Label</label>
            <input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder="e.g. Reporting pipeline" className="w-full border rounded px-2 py-1.5 mb-4 text-sm" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowKeyForm(false)} className="px-3 py-1.5 text-sm border rounded">Cancel</button>
              <button onClick={createKey} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
