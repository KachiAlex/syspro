/**
 * API route to assign a role to a user
 * POST /api/tenant/users/{userId}/assign-role
 */

import { NextRequest, NextResponse } from "next/server";
import { getRoles } from "@/lib/admin/db";
import { sql } from "@/lib/sql-client";

interface AssignRoleRequest {
  userId: string;
  oldRoleId?: string;
  newRoleId: string;
  tenantSlug: string;
}

// TODO: Replace with real database transaction when DB is available
// 1. Update tenant_users.role_id WHERE id = $1
// 2. Insert into role_history (tenant_slug, user_id, old_role_id, new_role_id, assigned_by_user_id, assigned_at)
export async function POST(request: NextRequest) {
  try {
    const body: AssignRoleRequest = await request.json();
    const { userId, oldRoleId, newRoleId, tenantSlug } = body;

    // Validation
    if (!userId || !newRoleId || !tenantSlug) {
      return NextResponse.json(
        { error: "Missing required fields: userId, newRoleId, tenantSlug" },
        { status: 400 }
      );
    }

    // Get all available roles for this tenant
    const tenantRoles = await getRoles(tenantSlug, sql);
    const validRoleIds = tenantRoles.map((role: any) => role.id);
    
    // Also include default roles that might not be in the database yet
    const defaultRoles = ["admin", "manager", "editor", "viewer"];
    const allValidRoles = [...new Set([...validRoleIds, ...defaultRoles])];
    
    if (!allValidRoles.includes(newRoleId)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${allValidRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // TODO: Get current user from session to populate assigned_by_user_id
    const currentUserId = request.headers.get("X-User-Id") || "system";

    // Mock response (replace with actual database update)
    const mockResponse = {
      success: true,
      userId,
      oldRoleId: oldRoleId || "viewer",
      newRoleId,
      tenantSlug,
      assignedAt: new Date().toISOString(),
      assignedBy: currentUserId,
      message: `User role updated from ${oldRoleId || "unknown"} to ${newRoleId}`,
    };

    return NextResponse.json(mockResponse);
  } catch (error) {
    console.error("Error assigning role:", error);
    return NextResponse.json(
      { error: "Failed to assign role" },
      { status: 500 }
    );
  }
}
