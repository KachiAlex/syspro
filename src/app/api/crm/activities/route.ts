import { NextRequest, NextResponse } from "next/server";
import { listActivities } from "@/lib/crm/db";
import { resolveCrmAuth } from "@/lib/crm/auth";
import { handleDatabaseError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  const auth = await resolveCrmAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (auth.session.tenantSlug !== tenantSlug) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const limit = url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 20;
  const entityType = url.searchParams.get("entityType") || undefined;
  const entityId = url.searchParams.get("entityId") || undefined;

  try {
    const activities = await listActivities({ tenantSlug, limit, entityType, entityId });
    return NextResponse.json({ activities });
  } catch (error) {
    return handleDatabaseError(error, "List activities");
  }
}
