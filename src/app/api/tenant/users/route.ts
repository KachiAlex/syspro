/**
 * API route to fetch all users in a tenant
 * GET /api/tenant/users?tenantSlug=...
 */

import { NextRequest, NextResponse } from "next/server";

// TODO: Replace with real database query when DB is available
// SELECT id, email, name, role_id, is_active FROM tenant_users WHERE tenant_slug = $1 ORDER BY email
// For now, return mock data for development
export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  // Mock users data (replace with database query)
  const mockUsers = [
    {
      id: "user-1",
      email: "admin@example.com",
      name: "Admin User",
      roleId: "admin",
      isActive: true,
      createdAt: new Date("2025-01-15").toISOString(),
    },
    {
      id: "user-2",
      email: "john.smith@example.com",
      name: "John Smith",
      roleId: "manager",
      isActive: true,
      createdAt: new Date("2025-01-20").toISOString(),
    },
    {
      id: "user-3",
      email: "sarah.jones@example.com",
      name: "Sarah Jones",
      roleId: "editor",
      isActive: true,
      createdAt: new Date("2025-02-01").toISOString(),
    },
    {
      id: "user-4",
      email: "mike.davis@example.com",
      name: "Mike Davis",
      roleId: "viewer",
      isActive: true,
      createdAt: new Date("2025-02-03").toISOString(),
    },
    {
      id: "user-5",
      email: "alice.brown@example.com",
      name: "Alice Brown",
      roleId: "viewer",
      isActive: true,
      createdAt: new Date("2025-02-05").toISOString(),
    },
  ];

  return NextResponse.json({ users: mockUsers });
}
