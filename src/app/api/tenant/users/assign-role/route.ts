/**
 * API route to assign a role to a user
 * POST /api/tenant/users/{userId}/assign-role
 */

import { NextRequest, NextResponse } from "next/server";

interface AssignRoleRequest {
  userId: string;
  oldRoleId?: string;
  newRoleId: string;
  tenantSlug: string;
}

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

    const validRoles = ["admin", "manager", "editor", "viewer"];
    if (!validRoles.includes(newRoleId)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
        { status: 400 }
      );
    }

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
