"use client";

import React, { useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import { AdminService } from "@/app/tenant-admin/services/admin-service";

interface OrgNode {
  id: string;
  name: string;
  type: string;
  status?: string;
  manager?: string;
  headcount?: number;
  region?: string;
  children?: OrgNode[];
}

function OrgNodeItem({ node, depth = 0 }: { node: OrgNode; depth?: number }) {
  return (
    <div className="mb-2" style={{ marginLeft: depth * 20 }}>
      <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
        <div>
          <p className="text-sm font-medium text-gray-900">{node.name}</p>
          <p className="text-xs text-gray-500 capitalize">{node.type} {node.status && `• ${node.status}`} {node.region && `• ${node.region}`}</p>
        </div>
        <div className="text-xs text-gray-600 text-right">
          {node.manager && <p>Manager: {node.manager}</p>}
          {typeof node.headcount === "number" && <p>Headcount: {node.headcount}</p>}
        </div>
      </div>
      {node.children && (
        <div className="mt-2">
          {node.children.map((child) => (
            <OrgNodeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StructurePage() {
  const { tenantSlug } = useTenantContext();
  const [tree, setTree] = useState<OrgNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantSlug) return;
    async function load() {
      try {
        const data = await AdminService.getOrgStructure(tenantSlug);
        setTree(data.tree || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load org structure");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantSlug]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Organization Structure</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && !tree && <p>No organization structure found.</p>}
      {!loading && tree && <OrgNodeItem node={tree} />}
    </div>
  );
}
