"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";

type Connector = { id: string; name: string; description?: string; enabled: boolean };
type ApiKey = { id: string; label: string; key: string; revoked: boolean; createdAt?: string };

const CONNECTOR_DESCRIPTIONS: Record<string, string> = {
  slack: "Integrate with Slack for notifications and messaging",
  salesforce: "Connect to Salesforce for CRM data synchronization",
  hubspot: "Integrate with HubSpot for marketing and sales",
  stripe: "Connect to Stripe for payment processing",
  zapier: "Automate workflows with Zapier",
  github: "Connect to GitHub for development tracking",
};

export default function IntegrationsSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setConnectors(payload.connectors ?? []);
        setApiKeys(payload.apiKeys ?? []);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function toggleConnector(id: string, currentState: boolean) {
    try {
      const res = await fetch(`/api/tenant/integrations?id=${encodeURIComponent(id)}&type=connector&tenantSlug=${encodeURIComponent(ts)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentState }),
      });
      if (!res.ok) throw new Error("Failed to update connector");
      setSuccess("Connector updated");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update connector");
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) {
      setError("Key name is required");
      return;
    }
    try {
      const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "apikey", label: newKeyName }),
      });
      if (!res.ok) throw new Error("Failed to create API key");
      setNewKeyName("");
      setShowNewKey(false);
      setSuccess("API key created successfully");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create API key");
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Are you sure? This will block any access using this key.")) return;
    try {
      const res = await fetch(
        `/api/tenant/integrations?id=${encodeURIComponent(id)}&type=apikey&tenantSlug=${encodeURIComponent(ts)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to revoke key");
      setSuccess("API key revoked");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard");
    setTimeout(() => setSuccess(null), 2000);
  }

  return (
    <div className="space-y-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Connectors */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Integrations</p>
          <h2 className="text-lg font-semibold text-slate-900">Connected Services</h2>
          <p className="mt-1 text-sm text-slate-600">Enable or disable third-party service integrations</p>
        </div>

        {loading ? (
          <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
            <p className="mt-2">Loading integrations…</p>
          </div>
        ) : (connectors ?? []).length === 0 ? (
          <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
            <p className="font-medium text-blue-900">No connectors available</p>
            <p className="mt-1 text-blue-700">Contact support to enable integrations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {connectors.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{c.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {CONNECTOR_DESCRIPTIONS[c.name.toLowerCase()] || c.description || "No description"}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleConnector(c.id, c.enabled)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      c.enabled
                        ? "bg-green-100 text-green-900 hover:bg-green-200"
                        : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {c.enabled ? "✓ Enabled" : "Enable"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Keys */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">API Access</p>
            <h2 className="text-lg font-semibold text-slate-900">API Keys</h2>
            <p className="mt-1 text-sm text-slate-600">Create and manage API keys for programmatic access</p>
          </div>
          <button
            onClick={() => {
              setShowNewKey(!showNewKey);
              setNewKeyName("");
            }}
            className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {showNewKey ? "Cancel" : "+ New API Key"}
          </button>
        </div>

        {showNewKey && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">Key Name</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Development Integration"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-slate-500">Choose a descriptive name to remember what this key is used for</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={createKey}
                className="rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Create Key
              </button>
              <button
                onClick={() => {
                  setShowNewKey(false);
                  setNewKeyName("");
                }}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="mt-4">
          {(apiKeys ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <p className="font-medium text-blue-900">No API keys created</p>
              <p className="mt-1 text-blue-700">Create one to enable programmatic access to your system</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  className={`rounded-lg border p-4 ${k.revoked ? "border-slate-200 bg-slate-50" : "border-slate-200"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{k.label}</h3>
                        {k.revoked && (
                          <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                            Revoked
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-mono text-xs text-slate-500 break-all">
                        {k.revoked ? "••••••••" : k.key}
                      </p>
                      {k.createdAt && (
                        <p className="mt-1 text-xs text-slate-500">
                          Created {new Date(k.createdAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!k.revoked && (
                        <button
                          onClick={() => copyToClipboard(k.key)}
                          className="rounded-full border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Copy
                        </button>
                      )}
                      {!k.revoked && (
                        <button
                          onClick={() => revokeKey(k.id)}
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security Notice */}
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-semibold text-amber-900">🔒 Security Reminder</p>
        <ul className="mt-3 space-y-1 text-sm text-amber-900">
          <li>• Never share API keys in code or version control</li>
          <li>• Rotate keys regularly for sensitive operations</li>
          <li>• Revoke any keys you no longer use</li>
          <li>• Use environment variables to store keys securely</li>
        </ul>
      </div>
    </div>
  );
}
