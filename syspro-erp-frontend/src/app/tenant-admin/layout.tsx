import React from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, validateTenantAccess } from "@/lib/auth-helpers";

export default async function TenantAdminLayout({ children }: { children: React.ReactNode }) {
  const h = headers();

  // Prefer explicit tenant header; guard against missing tenant context
  const tenantSlug = h.get("X-Tenant-Slug") || h.get("tenantSlug") || null;

  // Adapt headers to the shape expected by getCurrentUser (it expects a NextRequest-like object)
  const fakeReq = { headers: { get: (k: string) => h.get(k) } } as any;
  const user = getCurrentUser(fakeReq);

  if (!tenantSlug) {
    // No tenant specified: redirect to access/login page
    redirect("/access?error=tenant_required");
  }

  if (!user) {
    redirect("/access?error=auth_required");
  }

  const allowed = await validateTenantAccess(user, tenantSlug!);
  if (!allowed) {
    // Conservative: show a 403-like response
    return (
      <html>
        <body style={{ padding: 40, fontFamily: "Inter, system-ui, sans-serif" }}>
          <h1>Access Denied</h1>
          <p>You do not have access to this tenant.</p>
        </body>
      </html>
    );
  }

  return <>{children}</>;
}
