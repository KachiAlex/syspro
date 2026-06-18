import { NextRequest, NextResponse } from "next/server";
import { crmFiltersSchema } from "@/lib/crm/types";
import { countLeads, listLeads, countContacts, listContacts, countDeals, listDeals, countCustomers, getConversionStats } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parseResult = crmFiltersSchema.safeParse({ tenantSlug: params.tenantSlug, ...params });

  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const tenantSlug = parseResult.data.tenantSlug;

  try {
    const [leads, totalLeads, contacts, totalContacts, deals, totalDeals, totalCustomers, conversionStats] = await Promise.all([
      listLeads({ tenantSlug, limit: 10 }),
      countLeads({ tenantSlug }),
      listContacts({ tenantSlug, limit: 10 }),
      countContacts({ tenantSlug }),
      listDeals({ tenantSlug, limit: 10 }),
      countDeals({ tenantSlug }),
      countCustomers({ tenantSlug }),
      getConversionStats({ tenantSlug }),
    ]);

    const dealsWon = deals.filter((d) => d.stage === "closed_won").length;
    const dealsLost = deals.filter((d) => d.stage === "closed_lost").length;
    const revenue = deals
      .filter((d) => d.stage === "closed_won")
      .reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    const totalOpportunities = deals.length;
    const dealConversionRate = totalOpportunities > 0 ? (dealsWon / totalOpportunities) * 100 : 0;

    const payload = {
      metrics: [
        { label: "Total Leads", value: totalLeads },
        { label: "Total Contacts", value: totalContacts },
        { label: "Total Deals", value: totalDeals },
        { label: "Total Customers", value: totalCustomers },
        { label: "Revenue", value: revenue },
      ],
      totals: {
        totalLeads,
        totalCustomers,
        qualifiedLeads: leads.filter((l) => l.stage === "qualified").length,
        opportunities: totalOpportunities,
        dealsWon,
        dealsLost,
        revenue,
        conversionRate: Math.round(dealConversionRate * 100) / 100,
        leadConversionRate: conversionStats.conversionRate,
        totalConverted: conversionStats.totalConverted,
        recentConverted: conversionStats.recentConverted,
      },
      charts: {
        salesFunnel: [
          { stage: "prospecting", count: deals.filter((d) => d.stage === "prospecting").length },
          { stage: "qualification", count: deals.filter((d) => d.stage === "qualification").length },
          { stage: "proposal", count: deals.filter((d) => d.stage === "proposal").length },
          { stage: "negotiation", count: deals.filter((d) => d.stage === "negotiation").length },
          { stage: "closed_won", count: dealsWon },
          { stage: "closed_lost", count: dealsLost },
        ],
        revenueByOfficer: [],
        lostReasons: [],
      },
      leads,
      reminders: [],
      tasks: [],
      engagements: [],
    };

    return NextResponse.json({ filters: parseResult.data, payload, generatedAt: new Date().toISOString() });
  } catch (error) {
    return handleDatabaseError(error, "CRM dashboard");
  }
}
