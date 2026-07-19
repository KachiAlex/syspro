"use client";

import { useEffect, useState } from "react";
import { useTenantContext } from "@/components/tenant-admin/tenant-context";
import type { UserPermissions } from "@/hooks/use-permissions";

export interface TenantPermissions extends UserPermissions {
  dashboards: string[];
  isAdmin: boolean;
}

const DEFAULT: TenantPermissions = {
  people: "none",
  admin: "none",
  integrations: "none",
  billing: "none",
  automation: "none",
  crm: "none",
  finance: "none",
  projects: "none",
  dashboards: [],
  isAdmin: false,
  loading: true,
};

function normalizeFromRole(roleId?: string): TenantPermissions {
  const id = roleId?.toLowerCase() || "viewer";
  const allDashboards = ["admin", "automation", "finance", "people", "crm", "projects", "reports", "billing"];
  if (id === "admin") {
    return { ...DEFAULT, loading: false, isAdmin: true, admin: "admin", dashboards: allDashboards };
  }
  return { ...DEFAULT, loading: false };
}

export function useTenantPermissions(userId?: string): TenantPermissions {
  const { tenantSlug } = useTenantContext();
  const [permissions, setPermissions] = useState<TenantPermissions>(DEFAULT);

  useEffect(() => {
    async function load() {
      if (!tenantSlug) {
        setPermissions(normalizeFromRole(undefined));
        return;
      }

      const uid =
        userId ||
        (typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("userId")
          : null) ||
        undefined;

      try {
        const res = await fetch(
          `/api/tenant/user/permissions?tenantSlug=${encodeURIComponent(
            tenantSlug
          )}${uid ? `&userId=${encodeURIComponent(uid)}` : ""}`,
          { cache: "no-store" }
        );

        if (res.ok) {
          const data = await res.json();
          setPermissions({
            ...data,
            loading: false,
          });
        } else {
          setPermissions(normalizeFromRole(undefined));
        }
      } catch (error) {
        console.error("Error fetching tenant permissions:", error);
        setPermissions(normalizeFromRole(undefined));
      }
    }

    load();
  }, [tenantSlug, userId]);

  return permissions;
}
