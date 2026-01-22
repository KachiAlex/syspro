import { NextRequest, NextResponse } from "next/server";
import { generateMockDashboardPayload } from "@/lib/crm/mock";
import { crmFiltersSchema } from "@/lib/crm/types";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parseResult = crmFiltersSchema.safeParse({ tenantSlug: params.tenantSlug ?? "kreatix-default", ...params });

  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const payload = generateMockDashboardPayload(parseResult.data);
  return NextResponse.json({ filters: parseResult.data, payload, generatedAt: new Date().toISOString() });
}
