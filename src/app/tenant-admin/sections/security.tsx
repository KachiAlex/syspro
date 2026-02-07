"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";

type AuditLog = { id: string; actor: string; action: string; resource: string; timestamp: string; status: string; details?: string };
type MfaSettings = { enforcement: "optional" | "required"; methods: string[] };

const AUDIT_ACTIONS: Record<string, { label: string; icon: string; color: string }> = {
  login: { label: "Login", icon: "🔓", color: "green" },
  logout: { label: "Logout", icon: "🔐", color: "slate" },
  create: { label: "Created", icon: "➕", color: "blue" },
  update: { label: "Updated", icon: "✏️", color: "blue" },
  delete: { label: "Deleted", icon: "🗑️", color: "rose" },
  permission_grant: { label: "Permission Granted", icon: "✓", color: "green" },
  permission_revoke: { label: "Permission Revoked", icon: "✕", color: "rose" },
  mfa_enable: { label: "MFA Enabled", icon: "🔐", color: "green" },
  mfa_disable: { label: "MFA Disabled", icon: "🔓", color: "amber" },
  api_key_create: { label: "API Key Created", icon: "🔑", color: "blue" },
  api_key_revoke: { label: "API Key Revoked", icon: "🔑", color: "rose" },
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-900",
  failure: "bg-rose-100 text-rose-900",
  pending: "bg-amber-100 text-amber-900",
};

export default function SecuritySection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [mfaSettings, setMfaSettings] = useState<MfaSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>("");
  const ts = tenantSlug ?? "kreatix-default";

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/security?tenantSlug=${encodeURIComponent(ts)}&limit=50`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setLogs(payload.auditLogs ?? []);
        setMfaSettings(payload.mfaSettings ?? null);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load security settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [ts]);

  async function toggleMfaEnforcement() {
    const newEnforcement = mfaSettings?.enforcement === "optional" ? "required" : "optional";
    try {
      const res = await fetch(`/api/tenant/security?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaUpdates: { enforcement: newEnforcement } }),
      });
      if (!res.ok) throw new Error("Failed to update MFA settings");
      setSuccess(`MFA is now ${newEnforcement === "required" ? "required" : "optional"}`);
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update MFA settings");
    }
  }

  const filteredLogs = filterAction ? logs.filter((log) => log.action === filterAction) : logs;

  return (
    <div className="space-y-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Multi-Factor Authentication */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Access Control</p>
          <h2 className="text-lg font-semibold text-slate-900">Multi-Factor Authentication</h2>
          <p className="mt-1 text-sm text-slate-600">Protect your account with additional security layers</p>
        </div>

        <div className="space-y-4">
          {/* MFA Enforcement */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900">Enforcement Policy</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {mfaSettings?.enforcement === "required" ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-sm text-green-900">
                        ✓ Required for all users
                      </span>
                      <span className="ml-2 text-slate-600">All team members must enable MFA</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-sm text-amber-900">
                        ⚠️ Optional
                      </span>
                      <span className="ml-2 text-slate-600">Users can enable MFA if they choose</span>
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={toggleMfaEnforcement}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                  mfaSettings?.enforcement === "required"
                    ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                    : "bg-green-100 text-green-900 hover:bg-green-200"
                }`}
              >
                {mfaSettings?.enforcement === "required" ? "Make Optional" : "Enforce"}
              </button>
            </div>
          </div>

          {/* Supported Methods */}
          {mfaSettings?.methods && mfaSettings.methods.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="font-semibold text-blue-900">Available Methods</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {mfaSettings.methods.map((method) => (
                  <div key={method} className="rounded-lg bg-white p-3 text-center">
                    <p className="text-lg">
                      {method === "totp" && "🔐"}
                      {method === "sms" && "📱"}
                      {method === "email" && "📧"}
                      {method === "webauthn" && "🔑"}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {method === "totp" && "Authenticator App"}
                      {method === "sms" && "SMS Text"}
                      {method === "email" && "Email Code"}
                      {method === "webauthn" && "Security Key"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Audit Logs */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Compliance</p>
          <h2 className="text-lg font-semibold text-slate-900">Audit Logs</h2>
          <p className="mt-1 text-sm text-slate-600">Complete record of all system actions and access</p>
        </div>

        {/* Filter */}
        <div className="mb-4 rounded-lg bg-slate-50 p-3">
          <label className="block text-sm font-medium text-slate-900 mb-2">Filter by Action</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All Actions</option>
            {Object.entries(AUDIT_ACTIONS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Logs List */}
        <div>
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
              <p className="mt-2">Loading audit logs…</p>
            </div>
          ) : (logs ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <p className="font-medium text-blue-900">No audit logs</p>
              <p className="mt-1 text-blue-700">Log entries will appear here as actions occur</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              <p>No logs match this filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const actionInfo = AUDIT_ACTIONS[log.action] || { label: log.action, icon: "•", color: "slate" };
                const statusColor = STATUS_COLORS[log.status] || STATUS_COLORS.success;
                return (
                  <div key={log.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 text-lg">{actionInfo.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{actionInfo.label}</h3>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                            {log.status === "success" ? "✓" : log.status === "failure" ? "✕" : "⏳"} {log.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {log.actor} · {log.resource}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {new Date(log.timestamp).toLocaleString()}
                        </p>
                        {log.details && (
                          <p className="mt-2 text-xs text-slate-600 italic">Details: {log.details}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {filteredLogs.length > 0 && (
          <div className="mt-4 text-center text-xs text-slate-500">
            Showing {filteredLogs.length} of {logs.length} audit logs
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm font-semibold text-amber-900">🔐 Security Best Practices</p>
        <ul className="mt-3 space-y-1 text-sm text-amber-900">
          <li>• Enable MFA for all team members to prevent unauthorized access</li>
          <li>• Review audit logs regularly for suspicious activity</li>
          <li>• Rotate API keys periodically for security</li>
          <li>• Limit admin access to authorized users only</li>
          <li>• Use strong passwords and never reuse them</li>
        </ul>
      </div>
    </div>
  );
}
