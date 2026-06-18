"use client";

import { useEffect, useState } from "react";
import { FormAlert } from "@/components/form";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  Users, 
  Lock, 
  Key, 
  Eye, 
  EyeOff,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  UserCheck,
  UserX,
  Settings,
  Smartphone,
  Mail,
  Fingerprint,
  Download,
  RefreshCw,
  Ban,
  Unlock,
  Globe,
  Server,
  Database,
  Wifi,
  HardDrive
} from "lucide-react";

type AuditLog = { 
  id: string; 
  actor: string; 
  action: string; 
  resource: string; 
  timestamp: string; 
  status: string; 
  details?: string; 
  ipAddress?: string;
  userAgent?: string;
  location?: string;
};

type MfaSettings = { 
  enforcement: "optional" | "required"; 
  methods: string[]; 
  enabledUsers?: number;
  totalUsers?: number;
};

type SecurityMetrics = {
  totalLogins: number;
  failedLogins: number;
  suspiciousActivity: number;
  activeSessions: number;
  blockedAttempts: number;
  passwordStrength: number;
  lastSecurityScan?: string;
  vulnerabilities?: number;
};

type SecurityPolicy = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: "low" | "medium" | "high" | "critical";
  lastModified: string;
};

const AUDIT_ACTIONS: Record<string, { label: string; icon: string; color: string; description: string }> = {
  login: { label: "Login", icon: "🔓", color: "green", description: "User successfully logged in" },
  logout: { label: "Logout", icon: "🔐", color: "slate", description: "User logged out" },
  login_failed: { label: "Failed Login", icon: "🚫", color: "red", description: "Login attempt failed" },
  create: { label: "Created", icon: "➕", color: "blue", description: "Resource created" },
  update: { label: "Updated", icon: "✏️", color: "blue", description: "Resource updated" },
  delete: { label: "Deleted", icon: "🗑️", color: "rose", description: "Resource deleted" },
  permission_grant: { label: "Permission Granted", icon: "✓", color: "green", description: "Permission granted to user" },
  permission_revoke: { label: "Permission Revoked", icon: "✕", color: "rose", description: "Permission revoked from user" },
  mfa_enable: { label: "MFA Enabled", icon: "🔐", color: "green", description: "Multi-factor authentication enabled" },
  mfa_disable: { label: "MFA Disabled", icon: "🔓", color: "amber", description: "Multi-factor authentication disabled" },
  api_key_create: { label: "API Key Created", icon: "🔑", color: "blue", description: "New API key generated" },
  api_key_revoke: { label: "API Key Revoked", icon: "🔑", color: "rose", description: "API key revoked" },
  password_change: { label: "Password Changed", icon: "🔒", color: "green", description: "User password changed" },
  account_locked: { label: "Account Locked", icon: "🔒", color: "red", description: "User account locked" },
  account_unlocked: { label: "Account Unlocked", icon: "🔓", color: "green", description: "User account unlocked" },
  data_export: { label: "Data Export", icon: "📤", color: "blue", description: "Data exported from system" },
  security_scan: { label: "Security Scan", icon: "🔍", color: "purple", description: "Security scan performed" },
};

const STATUS_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-900",
  failure: "bg-rose-100 text-rose-900",
  pending: "bg-amber-100 text-amber-900",
  warning: "bg-yellow-100 text-yellow-900",
  critical: "bg-red-100 text-red-900",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800", 
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function SecuritySection({ tenantSlug }: { tenantSlug?: string | null }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [mfaSettings, setMfaSettings] = useState<MfaSettings | null>(null);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null);
  const [securityPolicies, setSecurityPolicies] = useState<SecurityPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState("24h");
  const ts = tenantSlug ;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tenant/security?tenantSlug=${encodeURIComponent(ts)}&limit=100&timeRange=${selectedTimeRange}`);
      const payload = await res.json().catch(() => null);
      if (res.ok && payload) {
        setLogs(payload.auditLogs ?? []);
        setMfaSettings(payload.mfaSettings ?? null);
        setSecurityMetrics(payload.securityMetrics ?? null);
        setSecurityPolicies(payload.securityPolicies ?? []);
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
  }, [ts, selectedTimeRange]);

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

  async function togglePolicy(policyId: string) {
    try {
      const policy = securityPolicies.find(p => p.id === policyId);
      if (!policy) return;
      
      const res = await fetch(`/api/tenant/security/policies/${encodeURIComponent(policyId)}?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !policy.enabled }),
      });
      if (!res.ok) throw new Error("Failed to update policy");
      setSuccess(`Security policy ${policy.enabled ? "disabled" : "enabled"}`);
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to update policy");
    }
  }

  async function runSecurityScan() {
    try {
      const res = await fetch(`/api/tenant/security/scan?tenantSlug=${encodeURIComponent(ts)}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to start security scan");
      setSuccess("Security scan initiated");
      setTimeout(() => setSuccess(null), 3000);
      load();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to start security scan");
    }
  }

  const filteredLogs = logs.filter((log) => {
    const actionMatch = !filterAction || log.action === filterAction;
    const statusMatch = !filterStatus || log.status === filterStatus;
    return actionMatch && statusMatch;
  });

  const recentThreats = logs.filter(log => 
    log.action === "login_failed" || 
    log.action === "account_locked" || 
    log.status === "failure"
  ).slice(0, 5);

  return (
    <div className="space-y-6">
      {error && <FormAlert type="error" title="Error" message={error} onClose={() => setError(null)} />}
      {success && <FormAlert type="success" message={success} onClose={() => setSuccess(null)} />}

      {/* Security Dashboard */}
      <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Security Overview</p>
            <h2 className="text-lg font-semibold text-gray-900">Security Dashboard</h2>
            <p className="mt-1 text-sm text-slate-600">Monitor your system's security posture and threats</p>
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <button
              onClick={runSecurityScan}
              className="whitespace-nowrap rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4 mr-2 inline" />
              Scan Now
            </button>
          </div>
        </div>

        {/* Security Metrics */}
        {securityMetrics && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Logins</p>
                  <p className="text-2xl font-bold text-gray-900">{securityMetrics.totalLogins}</p>
                  <p className="text-xs text-slate-500 mt-1">Last {selectedTimeRange}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600 opacity-20" />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Failed Logins</p>
                  <p className="text-2xl font-bold text-red-600">{securityMetrics.failedLogins}</p>
                  <p className="text-xs text-slate-500 mt-1">Security concern</p>
                </div>
                <XCircle className="w-8 h-8 text-red-600 opacity-20" />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Active Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{securityMetrics.activeSessions}</p>
                  <p className="text-xs text-slate-500 mt-1">Currently active</p>
                </div>
                <Activity className="w-8 h-8 text-green-600 opacity-20" />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Blocked Attempts</p>
                  <p className="text-2xl font-bold text-orange-600">{securityMetrics.blockedAttempts}</p>
                  <p className="text-xs text-slate-500 mt-1">Threats blocked</p>
                </div>
                <ShieldAlert className="w-8 h-8 text-orange-600 opacity-20" />
              </div>
            </div>
          </div>
        )}

        {/* Recent Threats */}
        {recentThreats.length > 0 && (
          <div className="mt-6">
            <h3 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Recent Security Events
            </h3>
            <div className="space-y-2">
              {recentThreats.map((threat, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                    <div>
                      <p className="font-medium text-gray-900">{AUDIT_ACTIONS[threat.action]?.label || threat.action}</p>
                      <p className="text-sm text-slate-600">{threat.actor} · {threat.resource}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-600">{new Date(threat.timestamp).toLocaleString()}</span>
                    {threat.ipAddress && (
                      <span className="text-xs text-slate-500">IP: {threat.ipAddress}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multi-Factor Authentication */}
      <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Access Control</p>
            <h2 className="text-lg font-semibold text-gray-900">Multi-Factor Authentication</h2>
            <p className="mt-1 text-sm text-slate-600">Protect your account with additional security layers</p>
          </div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="whitespace-nowrap rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {showAdvanced ? "Hide" : "Show"} Advanced
          </button>
        </div>

        <div className="space-y-4 mt-4">
          {/* MFA Enforcement */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Enforcement Policy</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {mfaSettings?.enforcement === "required" ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-sm text-green-900">
                        <ShieldCheck className="w-3 h-3" />
                        Required for all users
                      </span>
                      <span className="ml-2 text-slate-600">All team members must enable MFA</span>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-sm text-amber-900">
                        <AlertTriangle className="w-3 h-3" />
                        Optional
                      </span>
                      <span className="ml-2 text-slate-600">Users can enable MFA if they choose</span>
                    </>
                  )}
                </p>
                {mfaSettings?.enabledUsers !== undefined && mfaSettings?.totalUsers !== undefined && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Adoption Rate</span>
                      <span className="font-medium text-gray-900">
                        {mfaSettings.enabledUsers} / {mfaSettings.totalUsers} users
                      </span>
                    </div>
                    <div className="mt-1 w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${(mfaSettings.enabledUsers / mfaSettings.totalUsers) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}
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
              <h3 className="font-semibold text-gray-900">Available Methods</h3>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                {mfaSettings.methods.map((method) => (
                  <div key={method} className="rounded-lg bg-[#111827] p-3 text-center">
                    <div className="text-2xl mb-2">
                      {method === "totp" && <Smartphone className="w-6 h-6 mx-auto text-blue-600" />}
                      {method === "sms" && <Smartphone className="w-6 h-6 mx-auto text-green-600" />}
                      {method === "email" && <Mail className="w-6 h-6 mx-auto text-purple-600" />}
                      {method === "webauthn" && <Fingerprint className="w-6 h-6 mx-auto text-orange-600" />}
                    </div>
                    <p className="text-sm font-medium text-gray-900">
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

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Advanced Settings</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Remember Device</p>
                    <p className="text-sm text-slate-600">Allow users to skip MFA on trusted devices</p>
                  </div>
                  <button className="rounded-full bg-slate-200 px-3 py-1 text-sm">Configure</button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Grace Period</p>
                    <p className="text-sm text-slate-600">Time before MFA is required for new users</p>
                  </div>
                  <button className="rounded-full bg-slate-200 px-3 py-1 text-sm">Configure</button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Backup Codes</p>
                    <p className="text-sm text-slate-600">Generate backup codes for account recovery</p>
                  </div>
                  <button className="rounded-full bg-slate-200 px-3 py-1 text-sm">Generate</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Policies */}
      <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Security Policies</p>
            <h2 className="text-lg font-semibold text-gray-900">Security Policies</h2>
            <p className="mt-1 text-sm text-slate-600">Configure security policies and compliance rules</p>
          </div>
          <button
            onClick={() => setShowPolicies(!showPolicies)}
            className="whitespace-nowrap rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {showPolicies ? "Hide" : "Show"} Policies
          </button>
        </div>

        {showPolicies && (
          <div className="mt-4 space-y-3">
            {securityPolicies.length === 0 ? (
              <div className="text-center py-8">
                <Settings className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No security policies configured</p>
                <p className="text-xs text-slate-400 mt-1">Add policies to enhance your security posture</p>
              </div>
            ) : (
              securityPolicies.map((policy) => (
                <div key={policy.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-gray-900">{policy.name}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${SEVERITY_COLORS[policy.severity]}`}>
                          {policy.severity.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          policy.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-900"
                        }`}>
                          {policy.enabled ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{policy.description}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Last modified: {new Date(policy.lastModified).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => togglePolicy(policy.id)}
                      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                        policy.enabled 
                          ? "bg-amber-100 text-amber-900 hover:bg-amber-200"
                          : "bg-green-100 text-green-900 hover:bg-green-200"
                      }`}
                    >
                      {policy.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Audit Logs */}
      <div className="rounded-3xl border border-slate-100 bg-[#111827] p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Compliance</p>
            <h2 className="text-lg font-semibold text-gray-900">Audit Logs</h2>
            <p className="mt-1 text-sm text-slate-600">Complete record of all system actions and access</p>
          </div>
          <button className="whitespace-nowrap rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <Download className="w-4 h-4 mr-2 inline" />
            Export
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-lg bg-[#0B1120] p-3">
            <label className="block text-sm font-medium text-white mb-2">Filter by Action</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="bg-[#0B1120] w-full rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-white"
            >
              <option value="">All Actions</option>
              {Object.entries(AUDIT_ACTIONS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg bg-[#0B1120] p-3">
            <label className="block text-sm font-medium text-white mb-2">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#0B1120] w-full rounded-lg border border-[rgba(255,255,255,0.1)] px-3 py-2 text-sm text-white"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="pending">Pending</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Logs List */}
        <div className="mt-4">
          {loading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"></div>
              <p className="mt-2">Loading audit logs…</p>
            </div>
          ) : (logs ?? []).length === 0 ? (
            <div className="rounded-lg bg-blue-50 p-4 text-center text-sm">
              <Shield className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <p className="font-medium text-gray-900">No audit logs</p>
              <p className="mt-1 text-blue-700">Log entries will appear here as actions occur</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-600">
              <p>No logs match this filter</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const actionInfo = AUDIT_ACTIONS[log.action] || { 
                  label: log.action, 
                  icon: "•", 
                  color: "slate",
                  description: "Unknown action"
                };
                const statusColor = STATUS_COLORS[log.status] || STATUS_COLORS.success;
                return (
                  <div key={log.id} className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 text-lg">{actionInfo.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900">{actionInfo.label}</h3>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                            {log.status === "success" && <CheckCircle className="w-3 h-3 mr-1 inline" />}
                            {log.status === "failure" && <XCircle className="w-3 h-3 mr-1 inline" />}
                            {log.status === "pending" && <Clock className="w-3 h-3 mr-1 inline" />}
                            {log.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          <span className="font-medium">{log.actor}</span> · {log.resource}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 italic">{actionInfo.description}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                          <span>{new Date(log.timestamp).toLocaleString()}</span>
                          {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                          {log.location && <span>📍 {log.location}</span>}
                        </div>
                        {log.details && (
                          <p className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded">
                            Details: {log.details}
                          </p>
                        )}
                        {log.userAgent && (
                          <p className="mt-1 text-xs text-slate-500 truncate">
                            {log.userAgent}
                          </p>
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

      {/* Security Best Practices */}
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-5 h-5 text-amber-900" />
          <p className="text-sm font-semibold text-amber-900">Security Best Practices</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-amber-900 mt-0.5" />
              <p className="text-sm text-amber-900">Enable MFA for all team members to prevent unauthorized access</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-amber-900 mt-0.5" />
              <p className="text-sm text-amber-900">Review audit logs regularly for suspicious activity</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-amber-900 mt-0.5" />
              <p className="text-sm text-amber-900">Rotate API keys periodically for security</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-amber-900 mt-0.5" />
              <p className="text-sm text-amber-900">Limit admin access to authorized users only</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-amber-900 mt-0.5" />
              <p className="text-sm text-amber-900">Use strong passwords and never reuse them</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-amber-900 mt-0.5" />
              <p className="text-sm text-amber-900">Keep software and dependencies up to date</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
