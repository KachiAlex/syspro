import { NextRequest, NextResponse } from "next/server";
import { crmFiltersSchema } from "@/lib/crm/types";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parseResult = crmFiltersSchema.safeParse({ tenantSlug: params.tenantSlug ?? "kreatix-default", ...params });

  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  // Return empty CRM data structure
  const payload = {
    metrics: [],
    totals: { totalLeads: 0, qualifiedLeads: 0, opportunities: 0, dealsWon: 0, dealsLost: 0, revenue: 0, conversionRate: 0 },
    charts: { salesFunnel: [], revenueByOfficer: [], lostReasons: [] },
    leads: [],
    reminders: [],
    tasks: [],
    engagements: [],
  };

  return NextResponse.json({ filters: parseResult.data, payload, generatedAt: new Date().toISOString() });
}
