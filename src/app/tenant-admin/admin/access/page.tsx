"use client";

import React, { useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AdminService } from "@/app/tenant-admin/services/admin-service";

interface Role {
  id: string;
  name: string;
  scope: string;
  permissions: string[];
  description?: string;
  isSystem?: boolean;
}

export default function AccessControlPage() {
  const { tenantSlug } = useTenantContext();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const data = await AdminService.getRoles(tenantSlug);
        setRoles(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load roles");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Access Control</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && roles.length === 0 && <p>No roles found.</p>}
      {!loading && roles.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-theme-surface border border-theme-border rounded-lg">
            <thead>
              <tr className="bg-theme-muted">
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Scope</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Permissions</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-theme-text-primary">Description</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t border-theme-border">
                  <td className="px-4 py-2 text-sm text-theme-text-primary font-medium">{role.name}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{role.scope}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{(role.permissions || []).join(", ")}</td>
                  <td className="px-4 py-2 text-sm text-theme-text-primary">{role.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
