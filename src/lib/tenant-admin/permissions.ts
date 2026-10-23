import { sql } from "@/lib/sql-client";
import { setupTenantAdminSchema } from "./schema";
import { cached, invalidatePrefix } from "@/lib/cache";

let permissionsTablesEnsured = false;
async function ensurePermissionsTables() {
  if (permissionsTablesEnsured) return;
  try {
    await setupTenantAdminSchema(sql);
    permissionsTablesEnsured = true;
  } catch (error) {
    console.warn("Failed to ensure permissions tables:", error);
  }
}

export const DASHBOARD_PERMISSION_KEYS: Record<string, string> = {
  admin: "dashboard:admin",
  automation: "dashboard:automation",
  finance: "dashboard:finance",
  people: "dashboard:people",
  crm: "dashboard:crm",
  projects: "dashboard:projects",
  reports: "dashboard:reports",
  billing: "dashboard:billing",
  sales: "dashboard:sales",
  analytics: "dashboard:analytics",
};

const MODULE_PERMISSION_KEYS: Record<string, string[]> = {
  crm: ["crm.read", "crm.write"],
  finance: ["finance.read", "finance.write"],
  people: ["people.read", "people.write"],
  billing: ["billing.read", "billing.write"],
  automation: ["automation.read", "automation.write"],
  projects: ["projects.read", "projects.write"],
  admin: ["admin.read", "admin.write"],
  sales: ["sales.read", "sales.write"],
  analytics: ["analytics.read", "analytics.write"],
};

function keyToLevel(key: string): "none" | "read" | "write" | "admin" {
  if (key === "all") return "admin";
  const [, action] = key.split(".");
  if (action === "write") return "write";
  if (action === "read") return "read";
  return "none";
}

export interface TenantUserPermissions {
  people: "none" | "read" | "write" | "admin";
  admin: "none" | "read" | "write" | "admin";
  integrations: "none" | "read" | "write" | "admin";
  billing: "none" | "read" | "write" | "admin";
  automation: "none" | "read" | "write" | "admin";
  crm: "none" | "read" | "write" | "admin";
  finance: "none" | "read" | "write" | "admin";
  projects: "none" | "read" | "write" | "admin";
  sales: "none" | "read" | "write" | "admin";
  analytics: "none" | "read" | "write" | "admin";
  dashboards: string[];
  isAdmin: boolean;
}

export async function getTenantUserPermissions(
  tenantSlug: string,
  userId: string,
  roleId?: string
): Promise<TenantUserPermissions> {
  const cacheKey = `perms:${tenantSlug}:${userId}:${roleId || "none"}`;
  return cached(cacheKey, 30_000, async () => {
    return _getTenantUserPermissions(tenantSlug, userId, roleId);
  });
}

/** Raw permission keys for a user — includes doc.* keys the module-level
 *  flattening discards. Same cache lifetime as getTenantUserPermissions. */
export async function getTenantUserPermissionKeys(
  tenantSlug: string,
  userId: string
): Promise<string[]> {
  const cacheKey = `permkeys:${tenantSlug}:${userId}`;
  return cached(cacheKey, 30_000, async () => {
    try {
      await ensurePermissionsTables();
      const rows = await sql`
        SELECT DISTINCT unnest(r.permissions) as key
        FROM admin_user_roles ur
        JOIN admin_roles r ON r.id = ur.role_id
        WHERE ur.tenant_slug = ${tenantSlug} AND ur.user_id = ${userId} AND r.permissions IS NOT NULL
      `;
      return (Array.isArray(rows) ? (rows as any[]).map((r) => r.key) : [])
        .filter((k): k is string => typeof k === "string" && k.length > 0);
    } catch (error) {
      console.error("Permission-key lookup failed for", tenantSlug, userId, error);
      return [];
    }
  });
}

/**
 * Document-level permission model (ERPNext/Venditium-style).
 * Keys: "doc.<docType>.<action>" — e.g. doc.bill.submit, doc.journal_entry.approve.
 * Stored in admin_roles.permissions alongside module keys; assigned via the
 * existing /api/tenant/roles API (permissions: string[]).
 *
 * Semantics (backward compatible):
 *  - "all" or doc.* or doc.<docType>.*  → all actions on that docType
 *  - no doc.<docType>.* keys at all      → module-level fallback (unchanged)
 *  - some doc.<docType> keys, not this   → denied
 */
export const DOC_TYPES = [
  "journal_entry", "bill", "invoice", "payment_entry", "purchase_order",
  "goods_receipt", "sales_order", "pos_sale", "expense_claim",
  "payroll_run", "production_order", "stock_adjustment", "credit_note",
] as const;
export type DocType = (typeof DOC_TYPES)[number];
export type DocAction = "read" | "create" | "edit" | "submit" | "approve" | "cancel" | "delete" | "refund";

export function hasDocAccess(keys: string[], docType: string, action: DocAction): boolean {
  if (keys.includes("all") || keys.includes("doc.*") || keys.includes(`doc.${docType}.*`)) return true;
  const docKeys = keys.filter((k) => k.startsWith(`doc.${docType}.`));
  if (docKeys.length === 0) return true; // docType unrestricted → module level governs
  return docKeys.includes(`doc.${docType}.${action}`);
}

/**
 * Invalidate cached permissions for a tenant (call when permissions change).
 */
export function invalidateTenantPermissions(tenantSlug: string, userId?: string): void {
  if (userId) {
    invalidatePrefix(`perms:${tenantSlug}:${userId}:`);
  } else {
    invalidatePrefix(`perms:${tenantSlug}:`);
  }
}

async function _getTenantUserPermissions(
  tenantSlug: string,
  userId: string,
  roleId?: string
): Promise<TenantUserPermissions> {
  let keys: string[] = [];
  try {
    await ensurePermissionsTables();
    const rows = await sql`
      SELECT DISTINCT unnest(r.permissions) as key
      FROM admin_user_roles ur
      JOIN admin_roles r ON r.id = ur.role_id
      WHERE ur.tenant_slug = ${tenantSlug} AND ur.user_id = ${userId} AND r.permissions IS NOT NULL
    `;
    keys = (Array.isArray(rows) ? (rows as any[]).map((r) => r.key) : [])
      .filter((k): k is string => typeof k === "string" && k.length > 0);
  } catch (error) {
    console.error("Permission lookup failed for", tenantSlug, userId, error);
  }

  // Fallback: if no roles are configured for the tenant yet, grant full
  // dashboard access to admin users and dev accounts so the UI remains usable.
  const isDevUser = userId?.startsWith("dev-user-");
  const isAdminRole = roleId?.toLowerCase() === "admin";

  // Admin role always gets full permissions, even if they have entries in
  // admin_user_roles with limited perms. This prevents accidental lockout.
  if (isAdminRole || isDevUser) {
    const allDashboards = ["admin", "automation", "finance", "people", "crm", "projects", "reports", "billing", "sales", "analytics"];
    return {
      people: "admin",
      admin: "admin",
      integrations: "admin",
      billing: "admin",
      automation: "admin",
      crm: "admin",
      finance: "admin",
      projects: "admin",
      sales: "admin",
      analytics: "admin",
      dashboards: allDashboards,
      isAdmin: true,
    };
  }

  if (keys.length === 0 && process.env.NODE_ENV !== "production") {
    const allDashboards = ["admin", "automation", "finance", "people", "crm", "projects", "reports", "billing", "sales", "analytics"];
    return {
      people: "admin",
      admin: "admin",
      integrations: "admin",
      billing: "admin",
      automation: "admin",
      crm: "admin",
      finance: "admin",
      projects: "admin",
      sales: "admin",
      analytics: "admin",
      dashboards: allDashboards,
      isAdmin: true,
    };
  }

  const result: Omit<TenantUserPermissions, "dashboards" | "isAdmin"> = {
    people: "none",
    admin: "none",
    integrations: "none",
    billing: "none",
    automation: "none",
    crm: "none",
    finance: "none",
    projects: "none",
    sales: "none",
    analytics: "none",
  };

  const dashboards: string[] = [];
  let isAdmin = false;

  for (const key of keys) {
    if (key === "all") {
      isAdmin = true;
      continue;
    }
    if (key.startsWith("dashboard:")) {
      dashboards.push(key.replace("dashboard:", ""));
      continue;
    }
    for (const [module, moduleKeys] of Object.entries(MODULE_PERMISSION_KEYS)) {
      if (moduleKeys.includes(key)) {
        const level = keyToLevel(key);
        const current = (result as any)[module];
        if (level === "admin") {
          (result as any)[module] = "admin";
        } else if (level === "write" && current !== "admin") {
          (result as any)[module] = "write";
        } else if (level === "read" && current === "none") {
          (result as any)[module] = "read";
        }
      }
    }
  }

  if (isAdmin) {
    Object.keys(result).forEach((k) => ((result as any)[k] = "admin"));
  }

  return { ...result, dashboards, isAdmin };
}

export async function requireDashboardPermission(
  request: { nextUrl: { searchParams: URLSearchParams }; headers: Headers; cookies: any },
  dashboardKey: string
): Promise<TenantUserPermissions> {
  const tenantSlug =
    request.nextUrl.searchParams.get("tenantSlug") ||
    request.cookies?.get?.("tenantSlug")?.value;

  const userId =
    request.nextUrl.searchParams.get("userId") ||
    request.headers.get("x-user-id") ||
    request.headers.get("x-dev-user-id") ||
    request.cookies?.get?.("dev-user-id")?.value ||
    request.cookies?.get?.("userId")?.value ||
    request.cookies?.get?.("X-User-Id")?.value;

  const roleId =
    request.nextUrl.searchParams.get("roleId") ||
    request.headers.get("x-role-id") ||
    request.cookies?.get?.("X-Role-Id")?.value ||
    request.cookies?.get?.("roleId")?.value;

  if (!tenantSlug || !userId) {
    throw new Error("Unauthorized");
  }

  const perms = await getTenantUserPermissions(tenantSlug, userId, roleId ?? undefined);

  if (perms.isAdmin || perms.dashboards.includes(dashboardKey)) {
    return perms;
  }

  throw new Error("Forbidden");
}
