export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { authenticateExternal } from "@/lib/external/auth";

/** Connectivity check for external tools — verifies the API key + tenant slug. */
export async function GET(request: NextRequest) {
  const auth = await authenticateExternal(request);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    ok: true,
    tenant: auth.tenantSlug,
    service: "external-api",
    version: "v1",
    time: new Date().toISOString(),
  });
}
