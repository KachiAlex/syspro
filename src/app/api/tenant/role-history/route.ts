/**
 * API route to fetch role assignment history / audit log
 * GET /api/tenant/role-history?tenantSlug=...&userId=...
 */

import { NextRequest, NextResponse } from "next/server";

interface RoleHistoryEntry {
  id: string;
  userId: string;
  userEmail: string;
  oldRoleId: string | null;
  newRoleId: string;
  assignedAt: string;
  assignedByUserId: string | null;
  assignedByEmail: string | null;
}

export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  const userId = request.nextUrl.searchParams.get("userId");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  // Mock history data (replace with database query)
  const mockHistory: RoleHistoryEntry[] = [
    {
      id: "history-1",
      userId: "user-3",
      userEmail: "sarah.jones@example.com",
      oldRoleId: "viewer",
      newRoleId: "editor",
      assignedAt: new Date("2025-02-06 10:30:00").toISOString(),
      assignedByUserId: "user-1",
      assignedByEmail: "admin@example.com",
    },
    {
      id: "history-2",
      userId: "user-2",
      userEmail: "john.smith@example.com",
      oldRoleId: "editor",
      newRoleId: "manager",
      assignedAt: new Date("2025-02-05 14:15:00").toISOString(),
      assignedByUserId: "user-1",
      assignedByEmail: "admin@example.com",
    },
    {
      id: "history-3",
      userId: "user-4",
      userEmail: "mike.davis@example.com",
      oldRoleId: null,
      newRoleId: "viewer",
      assignedAt: new Date("2025-02-03 09:00:00").toISOString(),
      assignedByUserId: "user-1",
      assignedByEmail: "admin@example.com",
    },
    {
      id: "history-4",
      userId: "user-5",
      userEmail: "alice.brown@example.com",
      oldRoleId: null,
      newRoleId: "viewer",
      assignedAt: new Date("2025-02-05 08:45:00").toISOString(),
      assignedByUserId: "user-1",
      assignedByEmail: "admin@example.com",
    },
  ];

  // Filter by userId if provided
  let filtered = mockHistory;
  if (userId) {
    filtered = filtered.filter((h) => h.userId === userId);
  }

  // Limit results
  filtered = filtered.slice(0, limit);

  return NextResponse.json({ history: filtered, total: filtered.length });
}
