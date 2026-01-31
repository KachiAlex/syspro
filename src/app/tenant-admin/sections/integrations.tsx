"use client";

import { useEffect, useState } from "react";

type Connector = { id: string; name: string; enabled: boolean };
type ApiKey = { id: string; label: string; key: string; revoked: boolean };

export default function IntegrationsSection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    try {
      const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(ts)}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setConnectors(payload.connectors ?? []);
        setApiKeys(payload.apiKeys ?? []);
      }
    } catch (err) {
      console.warn("integrations load failed", err);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function createKey() {
    const res = await fetch(`/api/tenant/integrations?tenantSlug=${encodeURIComponent(ts)}`, { method: "POST", body: JSON.stringify({ type: "apikey", label: "New key" }) });
    await res.json().catch(() => null);
    load();
  }

  async function revokeKey(id: string) {
    await fetch(`/api/tenant/integrations?id=${encodeURIComponent(id)}&type=apikey&tenantSlug=${encodeURIComponent(ts)}`, { method: "DELETE" });
    load();
  }

  if (!connectors && !apiKeys) return <div>Loading integrations…</div>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold">Connectors</h3>
        {connectors.length === 0 ? (
          <div>No connectors configured.</div>
        ) : (
          <div className="space-y-2">
            {connectors.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 border rounded">
                <div>{c.name}</div>
                <div>{c.enabled ? "Enabled" : "Disabled"}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold">API Keys</h3>
        <div className="space-y-2">
          <div className="flex gap-2">
            <button className="btn" onClick={createKey}>Create API key</button>
          </div>
          {apiKeys.length === 0 ? (
            <div>No keys issued.</div>
          ) : (
            apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{k.label}</div>
                  <div className="text-sm text-muted-foreground">{k.revoked ? "Revoked" : k.key}</div>
                </div>
                <div>
                  {!k.revoked && <button className="btn" onClick={() => revokeKey(k.id)}>Revoke</button>}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
