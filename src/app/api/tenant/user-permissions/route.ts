/**
 * API endpoint for getting user permissions
 * GET /api/tenant/user-permissions?tenantSlug=...
 */

import { NextRequest, NextResponse } from "next/server";
import type { UserPermissions } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug") || "kreatix-default";

    // TODO: In production, fetch actual user from session/auth
    // and their assigned role and permissions from the database
    
    // For now, return default admin permissions
    // In a real app, this would:
    // 1. Get the current user from the session
    // 2. Look up their role assignments for the tenant
   // 3. Get the role definition and permissions
    // 4. Apply any tenant-admin restrictions
    // 5. Return the computed permissions

    const permissions: UserPermissions = {
      userId: "current-user", // Would come from session
      tenantSlug,
      role: "admin",
      scope: "tenant",
      modules: {
        overview: "admin",
        crm: "admin",
        finance: "admin",
        people: "admin",
        projects: "admin",
        billing: "admin",
        itsupport: "admin",
        revops: "admin",
        automation: "admin",
        admin: "admin",
        integrations: "admin",
        analytics: "admin",
        security: "admin",
        inventory: "admin",
        procurement: "admin",
        policies: "admin",
        reports: "admin",
        dashboards: "admin",
      },
      features: ["all"],
      restrictions: [], // Tenant admin can set restrictions here
    };

    return NextResponse.json({ permissions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}
