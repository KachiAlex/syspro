"use client";

import { useTenantPermissions } from "@/hooks/use-tenant-permissions";

interface DashboardGuardProps {
  /** Dashboard key, e.g. "finance", "automation", "admin" */
  permission: string;
  /** Optional module to also allow read access (e.g. "finance" grants finance dashboard) */
  module?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  userId?: string;
}

export default function DashboardGuard({
  permission,
  module,
  children,
  fallback = null,
  userId,
}: DashboardGuardProps) {
  const perms = useTenantPermissions(userId);

  if (perms.loading) {
    return null;
  }

  const hasDashboard = perms.isAdmin || perms.dashboards.includes(permission);
  const hasModule =
    module && perms.isAdmin
      ? true
      : module
      ? perms[module as keyof typeof perms] !== "none" &&
        perms[module as keyof typeof perms] !== undefined
      : false;

  if (hasDashboard || hasModule) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
