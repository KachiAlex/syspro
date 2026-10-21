export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { globalSearch } from "@/lib/platform/search";

export async function GET(request: NextRequest) {
  try {
    const context = validateTenantContext(request, "read");
    const q = new URL(request.url).searchParams.get("q") ?? "";
    if (q.trim().length < 2) return NextResponse.json({ hits: [] });
    return NextResponse.json({ hits: await globalSearch(context.tenantSlug, q.trim()) });
  } catch (error) {
    console.error("Global search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
