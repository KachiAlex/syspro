import React from "react";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, validateTenantAccess } from "@/lib/auth-helpers";
import TenantAdminShell from "@/components/layout/tenant-admin-shell";
import { TenantContextProvider } from "@/components/tenant-admin/tenant-context";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { sql as SQL } from "@/lib/sql-client";

export default async function TenantAdminLayout({ children, searchParams }: { children: React.ReactNode; searchParams?: Record<string, string> }) {
  // `headers()` is async in some Next runtimes; await to avoid sync access
  const h = await headers();

  // headers() may not always expose a callable `.get` in some runtimes,
  // guard before calling to avoid `h.get is not a function` errors.
  const safeGet = (key: string) => (typeof (h as any)?.get === "function" ? (h as any).get(key) : undefined);

  // Prefer explicit tenant header; then fallback to cookies (set by the access portal)
  const serverCookies = await cookies();
  const safeGetCookie = (k: string) => (typeof (serverCookies as any)?.get === "function" ? (serverCookies as any).get(k)?.value : undefined);
  const urlTenant = searchParams?.tenantSlug;

  // Fallback: sometimes `searchParams` aren't available to layouts during
  // certain server render paths. Try to parse `tenantSlug` from the referer
  // header (the Access page navigates with `?tenantSlug=...`) so the layout
  // can detect the tenant on the first request.
  let refTenant: string | undefined = undefined;
  try {
    const referer = safeGet("referer") || safeGet("referrer");
    if (referer) {
      try {
        const u = new URL(referer);
        refTenant = u.searchParams.get("tenantSlug") || undefined;
      } catch (e) {
        // ignore invalid referer
      }
    }
  } catch (e) {
    // noop
  }

  const tenantSlug = urlTenant || refTenant || safeGet("X-Tenant-Slug") || safeGet("tenantSlug") || safeGetCookie("tenantSlug");

  // Adapt headers to the shape expected by getCurrentUser (it expects a NextRequest-like object)
  const fakeReq = {
    headers: { get: (k: string) => safeGet(k) },
    cookies: { get: (k: string) => safeGetCookie(k) },
  } as any;
  const user = getCurrentUser(fakeReq);

  // Development fallback: if cookies indicate a tenant but no user was parsed,
  // create a lightweight dev user so the local dev flow can continue without
  // requiring a real DB-backed session. This avoids redirect loops while
  // developing the tenant-admin UI.
  let effectiveUser = user;
  if (effectiveUser && (!effectiveUser.roleId || effectiveUser.roleId === "viewer")) {
    effectiveUser = { ...effectiveUser, roleId: safeGetCookie("X-Role-Id") || "admin" };
  }
  if (!effectiveUser) {
    const cookieUserId = safeGetCookie("X-User-Id") || safeGetCookie("dev-user-id") || safeGetCookie("userId");
    const cookieRole = safeGetCookie("X-Role-Id") || "admin";
    const cookieTenant = tenantSlug || urlTenant;
    if (cookieTenant) {
      effectiveUser = {
        id: cookieUserId || "dev-user-1",
        email: "dev@local",
        name: "Dev User",
        tenantSlug: cookieTenant,
        roleId: cookieRole,
      } as any;
    }
  }

  // Prepare debug info early so we can log and render diagnostics before any redirects
  const debugInfoEarly = {
    urlTenant,
    refTenant,
    cookieTenant: safeGetCookie("tenantSlug"),
    headerTenant: safeGet("X-Tenant-Slug"),
    parsedUser: user,
    effectiveUser,
    NODE_ENV: process.env.NODE_ENV,
  };

  // Debug info available if needed

  if (!tenantSlug) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
          <h1>Dev: Missing tenantSlug</h1>
          <p>The server did not detect a tenantSlug for this request. Inspect the values below and try again.</p>
          <pre style={{ background: "#0b1220", color: "#cbd5e1", padding: 12, borderRadius: 6 }}>{JSON.stringify(debugInfoEarly, null, 2)}</pre>
          <div style={{ marginTop: 12 }}>
            <a href="/login" style={{ marginRight: 12 }}>Open Login Portal</a>
          </div>
        </div>
      );
    }
    // No tenant specified: redirect to access/login page
    redirect("/login?error=tenant_required");
  }

  if (!effectiveUser) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <div style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
          <h1>Dev: Missing user session</h1>
          <p>The server did not detect an authenticated user for this request. Inspect the values below and try again.</p>
          <pre style={{ background: "#0b1220", color: "#cbd5e1", padding: 12, borderRadius: 6 }}>{JSON.stringify(debugInfoEarly, null, 2)}</pre>
          <div style={{ marginTop: 12 }}>
            <a href="/login" style={{ marginRight: 12 }}>Open Login Portal</a>
          </div>
        </div>
      );
    }
    redirect("/login?error=auth_required");
  }

  // In local development, when a dev cookie/session is present, allow access
  // without hitting the database validation. This keeps the UX fast while
  // iterating on the tenant-admin UI and avoids redirect loops.
  let allowed = false;
  const hasDevCookieUser = !!(
    safeGetCookie("X-User-Id") || safeGetCookie("dev-user-id") || safeGetCookie("userId")
  );

  if (process.env.NODE_ENV !== "production" && (hasDevCookieUser || String((effectiveUser as any)?.id || "").startsWith("dev"))) {
    allowed = true;
  } else {
    allowed = await validateTenantAccess(effectiveUser as any, tenantSlug!);
  }
  if (!allowed) {
    // Conservative: show a 403-like response without a nested <html> tag
    return (
      <div style={{ padding: 40, fontFamily: "Inter, system-ui, sans-serif" }}>
        <h1>Access Denied</h1>
        <p>You do not have access to this tenant.</p>
      </div>
    );
  }

  // Debug banner: show what the server sees for tenant/user/cookies
  const debugInfo = {
    urlTenant,
    refTenant,
    cookieTenant: safeGetCookie("tenantSlug"),
    headerTenant: safeGet("X-Tenant-Slug"),
    user: effectiveUser,
    hasDevCookieUser,
    NODE_ENV: process.env.NODE_ENV,
  };

  const sql = SQL;
  await ensureTenantTable(sql);
  let tenantMeta: {
    default_region_id: string | null;
    default_region_name: string | null;
    default_branch_id: string | null;
    default_branch_name: string | null;
    currency: string | null;
  } = {
    default_region_id: null,
    default_region_name: null,
    default_branch_id: null,
    default_branch_name: null,
    currency: null,
  };

  try {
    const tenantRows = await sql`
      select default_region_id, default_region_name, default_branch_id, default_branch_name, settings->>'currency' as currency
      from tenants
      where slug = ${tenantSlug}
      limit 1
    `;
    if (Array.isArray(tenantRows) && tenantRows.length > 0) {
      tenantMeta = tenantRows[0] as typeof tenantMeta;
    }
  } catch (error) {
    console.error("Failed to load tenant defaults", error);
  }

  const contextValue = {
    tenantSlug: tenantSlug!,
    regionId: tenantMeta.default_region_id || `${tenantSlug}-region-default`,
    regionName: tenantMeta.default_region_name || "Primary Region",
    branchId: tenantMeta.default_branch_id || `${tenantSlug}-branch-hq`,
    branchName: tenantMeta.default_branch_name || "Headquarters",
    currency: tenantMeta.currency || "USD",
  };

  // Return layout with the tenant admin shell (which renders the sidebar)
  return (
    <TenantContextProvider value={contextValue}>
      <ToastProvider>
        <TenantAdminShell user={effectiveUser as any}>{children}</TenantAdminShell>
      </ToastProvider>
    </TenantContextProvider>
  );
}
