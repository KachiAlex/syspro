"use client";

import { useEffect, useState } from "react";
import { Clock, Loader, X } from "lucide-react";
import { FormAlert, FormButton } from "@/components/form";

interface AssignableUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
}

interface Role {
  id: string;
  name: string;
}

interface Assignment {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  roleId: string;
  roleName: string;
  expiresAt: string | null;
  expired: boolean;
  justification: string | null;
}

/**
 * Delegation & acting roles: time-bound role assignments (expires_at on
 * admin_user_roles) with a mandatory justification for the audit trail.
 */
export default function DelegationPanel({ tenantSlug }: { tenantSlug?: string | null }) {
  const ts = tenantSlug;
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [delegations, setDelegations] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [justification, setJustification] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [u, r, a] = await Promise.all([
        fetch(`/api/tenant/users?tenantSlug=${ts}`).then((r) => (r.ok ? r.json() : { users: [] })),
        fetch(`/api/tenant/roles?tenantSlug=${ts}`).then((r) => (r.ok ? r.json() : { roles: [] })),
        fetch(`/api/tenant/assignments?tenantSlug=${ts}`).then((r) => (r.ok ? r.json() : { assignments: [] })),
      ]);
      setUsers(u.users || []);
      setRoles(r.roles || []);
      setDelegations((a.assignments || []).filter((x: Assignment) => x.expiresAt));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (ts) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts]);

  async function handleDelegate() {
    if (!userId || !roleId || !expiresAt || !justification.trim()) {
      setError("User, role, expiry date and reason are all required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/tenant/users/assign-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          newRoleId: roleId,
          tenantSlug: ts,
          expiresAt: new Date(expiresAt).toISOString(),
          justification: justification.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delegate role");
      setSuccess(data.message || "Delegation created");
      setUserId(""); setRoleId(""); setExpiresAt(""); setJustification("");
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to delegate role");
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(a: Assignment) {
    const res = await fetch("/api/tenant/assignments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: a.userId, roleId: a.roleId, tenantSlug: ts }),
    });
    if (res.ok) {
      setDelegations((prev) => prev.filter((d) => d.id !== a.id));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-1">Delegate a Role</h3>
        <p className="text-sm text-gray-500 mb-4">
          Grants the role until the expiry date — used for acting/stand-in
          coverage. The assignment and reason are recorded in role history.
        </p>

        {error && <FormAlert type="error" message={error} />}
        {success && <FormAlert type="success" message={success} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1">User</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
              disabled={submitting}
            >
              <option value="">Choose a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
              disabled={submitting}
            >
              <option value="">Choose a role…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expires</label>
            <input
              type="date"
              value={expiresAt}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
              disabled={submitting}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason (required)</label>
            <input
              type="text"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="e.g. Covering while Jane is on leave"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-black"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="mt-4">
          <FormButton onClick={handleDelegate} disabled={submitting}>
            {submitting ? "Delegating…" : "Create Delegation"}
          </FormButton>
        </div>
      </div>

      <div className="border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Active & Expired Delegations</h3>
        {delegations.length === 0 ? (
          <p className="text-sm text-gray-500">No delegations recorded.</p>
        ) : (
          <div className="space-y-2">
            {delegations.map((d) => (
              <div
                key={d.id}
                className={`flex items-center justify-between p-3 border rounded-lg ${d.expired ? "opacity-50 bg-gray-50" : ""}`}
              >
                <div>
                  <div className="font-medium text-sm">
                    {d.userName || d.userEmail || d.userId}
                    <span className="text-gray-500 font-normal"> → {d.roleName}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {d.expired ? "Expired" : "Expires"}{" "}
                    {d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : "—"}
                    {d.justification && <> · {d.justification}</>}
                  </div>
                </div>
                {!d.expired && (
                  <button
                    onClick={() => revoke(d)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Revoke delegation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
