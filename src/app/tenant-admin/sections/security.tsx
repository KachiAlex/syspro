"use client";

import { useEffect, useState } from "react";

type AuditLog = { id: string; actor: string; action: string; resource: string; timestamp: string; status: string };
type MfaSettings = { enforcement: string; methods: string[] };

export default function SecuritySection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [mfaSettings, setMfaSettings] = useState<MfaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/security?tenantSlug=${encodeURIComponent(ts)}&limit=30`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setLogs(payload.auditLogs ?? []);
        setMfaSettings(payload.mfaSettings ?? null);
      }
    } catch (err) {
      console.warn("security load failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function toggleMfaEnforcement() {
    const newEnforcement = mfaSettings?.enforcement === "optional" ? "required" : "optional";
    await fetch(`/api/tenant/security?tenantSlug=${encodeURIComponent(ts)}`, {
      method: "PATCH",
      body: JSON.stringify({ mfaUpdates: { enforcement: newEnforcement } }),
    });
    load();
  }

  if (loading) return <div>Loading security…</div>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold">Multi-Factor Authentication</h3>
        <div className="p-3 border rounded">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">MFA Enforcement</div>
              <div className="text-sm text-muted-foreground">Current: {mfaSettings?.enforcement ?? "optional"}</div>
            </div>
            <button className="btn" onClick={toggleMfaEnforcement}>Toggle</button>
          </div>
          <div className="mt-3">
            <div className="text-sm font-medium">Supported Methods:</div>
            <div className="text-sm text-muted-foreground">
              {mfaSettings?.methods?.join(", ") ?? "None"}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold">Audit Logs</h3>
        {(logs ?? []).length === 0 ? (
          <div>No audit logs.</div>
        ) : (
          <div className="space-y-2">
            {(logs ?? []).map((log) => (
              <div key={log.id} className="flex items-start justify-between p-3 border rounded">
                <div>
                  <div className="font-medium">{log.action} · {log.resource}</div>
                  <div className="text-sm text-muted-foreground">Actor: {log.actor} · {new Date(log.timestamp).toLocaleString()}</div>
                </div>
                <div className="text-sm">{log.status}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
