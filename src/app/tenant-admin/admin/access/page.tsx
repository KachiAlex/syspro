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
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Scope</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Permissions</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-t border-gray-100">
                  <td className="px-4 py-2 text-sm text-gray-900 font-medium">{role.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{role.scope}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{(role.permissions || []).join(", ")}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{role.description || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
