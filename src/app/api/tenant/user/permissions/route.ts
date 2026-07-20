/**
 * Tenant-scoped user permissions
 * GET /api/tenant/user/permissions?tenantSlug=...&userId=...
 */

import { NextRequest, NextResponse } from "next/server";
import { getTenantUserPermissions } from "@/lib/tenant-admin/permissions";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tenantSlug = searchParams.get("tenantSlug");
  const userId =
    searchParams.get("userId") ||
    request.headers.get("x-user-id") ||
    request.headers.get("x-dev-user-id") ||
    request.cookies.get("X-User-Id")?.value ||
    request.cookies.get("dev-user-id")?.value ||
    request.cookies.get("userId")?.value;
  const roleId =
    searchParams.get("roleId") ||
    request.headers.get("x-role-id") ||
    request.cookies.get("X-Role-Id")?.value ||
    request.cookies.get("roleId")?.value ||
    undefined;

  if (!tenantSlug) {
    return NextResponse.json(
      { error: "tenantSlug is required" },
      { status: 400 }
    );
  }

  if (!userId) {
    return NextResponse.json(
      { error: "userId is required" },
      { status: 400 }
    );
  }

  try {
    const permissions = await getTenantUserPermissions(tenantSlug, userId, roleId ?? undefined);
    return NextResponse.json(permissions);
  } catch (error) {
    console.error("Failed to fetch tenant user permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}
