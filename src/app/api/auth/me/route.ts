import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name || user.email?.split("@")[0] || "User",
    tenantSlug: user.tenantSlug,
    roleId: user.roleId,
    isEmployee: user.isEmployee || false,
  });
}
