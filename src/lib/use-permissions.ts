/**
 * React hook for managing user permissions
 */

import { useCallback, useEffect, useState } from "react";
import type { UserPermissions } from "@/lib/permissions";
import {
  hasPermission,
  canRead,
  canWrite,
  canAdmin,
  hasFeature,
  isTenantAdmin,
  filterNavigation,
  getVisibleModules,
} from "@/lib/permissions";

export function usePermissions(tenantSlug?: string | null) {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load permissions from API when component mounts
  useEffect(() => {
    async function loadPermissions() {
      setLoading(true);
      setError(null);
      try {
        const slug = tenantSlug || "kreatix-default";
        const response = await fetch(
          `/api/tenant/user-permissions?tenantSlug=${encodeURIComponent(slug)}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          // If endpoint doesn't exist yet, create default permissions
          if (response.status === 404) {
            setPermissions(null);
            setLoading(false);
            return;
          }

             // If user is not authenticated, log a warning instead of redirecting in local development
             if (response.status === 401) {
               // In local development avoid forcing a redirect from deep client hooks.
               // Let the Access portal handle routing. Log for visibility instead.
               console.warn("Received 401 from /api/user/permissions; skipping auto-redirect in dev.");
               return;
             }

          throw new Error("Failed to load permissions");
        }

        const data = await response.json();
        setPermissions(data.permissions || null);
      } catch (err) {
        console.error("Error loading permissions:", err);
        setError(err instanceof Error ? err.message : "Failed to load permissions");
        setPermissions(null);
      } finally {
        setLoading(false);
      }
    }

    loadPermissions();
  }, [tenantSlug]);

  // Refresh permissions
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const slug = tenantSlug || "kreatix-default";
      const response = await fetch(
        `/api/tenant/user-permissions?tenantSlug=${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
         if (response.status === 401) {
           // In local development avoid forcing a redirect from deep client hooks.
           // Let the Access portal handle routing. Log for visibility instead.
           console.warn("Received 401 from /api/user/permissions; skipping auto-redirect in dev.");
           return;
         }
        throw new Error("Failed to refresh permissions");
      }

      const data = await response.json();
      setPermissions(data.permissions || null);
    } catch (err) {
      console.error("Error refreshing permissions:", err);
      setError(err instanceof Error ? err.message : "Failed to refresh permissions");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  return {
    permissions,
    loading,
    error,
    refresh,

    // Helper methods
    hasPermission: (module: string, level: "read" | "write" | "admin" = "read") =>
      hasPermission(permissions, module, level),
    canRead: (module: string) => canRead(permissions, module),
    canWrite: (module: string) => canWrite(permissions, module),
    canAdmin: (module: string) => canAdmin(permissions, module),
    hasFeature: (feature: string) => hasFeature(permissions, feature),
    isTenantAdmin: () => isTenantAdmin(permissions),
    filterNavigation: (nav: any) => filterNavigation(nav, permissions),
    getVisibleModules: () => getVisibleModules(permissions),
  };
}
