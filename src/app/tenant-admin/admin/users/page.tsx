"use client";

import React, { useState, useEffect } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { tenantSlug } = useTenantContext();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const res = await fetch(`/api/tenant/users?tenantSlug=${encodeURIComponent(tenantSlug)}`);
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        } else {
          throw new Error("Failed to fetch users");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Users</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && users.length === 0 && <p>No users found.</p>}
      {!loading && users.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-theme-surface border border-theme-border rounded-lg">
            <thead>
              <tr className="bg-theme-muted">
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Email</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Role</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Status</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-theme-border">
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{user.name}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{user.email}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{user.role}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{user.status}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
