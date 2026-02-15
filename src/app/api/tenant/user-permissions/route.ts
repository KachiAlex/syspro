/**
 * API endpoint for getting user permissions
 * GET /api/tenant/user-permissions?tenantSlug=...
 * 
 * This endpoint returns the computed permissions for the current user,
 * taking into account:
 * - User's assigned role
 * - Role's base permissions
 * - Tenant-wide module restrictions
 * - Feature flags
 */

import { NextRequest, NextResponse } from "next/server";
import type { UserPermissions } from "@/lib/permissions";
import { applyRestrictions } from "@/lib/permissions";
import { getCurrentUser, validateTenantAccess, getRolePermissionsFromDB } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get("tenantSlug");

    if (!tenantSlug) {
      return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
    }

    // Step 1: Get current user from request (session/headers)
    const user = getCurrentUser(request);

    if (!user) {
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    // Step 2: Validate user has access to this tenant
    const hasAccess = await validateTenantAccess(user, tenantSlug);
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied to this tenant" }, { status: 403 });
    }

    // Step 3: Get user's role permissions
    const rolePermissions = await getRolePermissionsFromDB(user.roleId, tenantSlug);

    // Step 4: Build the permissions object
    const permissions: UserPermissions = {
      userId: user.id,
      tenantSlug,
      role: user.roleId,
      scope: "tenant",
      modules: rolePermissions,
      features: getFeatureFlags(user.roleId),
      restrictions: [], // Will be populated from tenant restrictions endpoint
    };

    // Step 5: Apply tenant-wide restrictions if they exist
    // TODO: Fetch restrictions from access-restrictions endpoint and apply them
    // const restrictions = await getTenantRestrictions(tenantSlug);
    // const finalPermissions = applyRestrictions(permissions, restrictions);

    return NextResponse.json({
      permissions,
    });
  } catch (error) {
    console.error("Failed to fetch permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}

/**
 * Get feature flags for a role
 * Feature flags control access to beta/experimental features
 */
function getFeatureFlags(roleId: string): string[] {
  const featuresByRole: Record<string, string[]> = {
    admin: [
      "all",
      "beta_features",
      "advanced_analytics",
      "custom_reports",
      "api_access",
    ],
    manager: [
      "reports",
      "advanced_analytics",
      "custom_reports",
    ],
    editor: [
      "reports",
    ],
    viewer: [
      "reports",
    ],
  };

  return featuresByRole[roleId] || [];
}
