import { NextRequest, NextResponse } from "next/server";
import { crmFiltersSchema } from "@/lib/crm/types";
import { countLeads, listLeads, countContacts, listContacts, countDeals, listDeals, countCustomers, getConversionStats } from "@/lib/crm/db";
import { handleDatabaseError } from "@/lib/api-errors";
import { resolveCrmAuth, getTeamMemberIds } from "@/lib/crm/auth";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parseResult = crmFiltersSchema.safeParse({ tenantSlug: params.tenantSlug, ...params });

  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.flatten() }, { status: 400 });
  }

  const tenantSlug = parseResult.data.tenantSlug;
  const viewMode = url.searchParams.get("viewMode") || undefined;
  const auth = await resolveCrmAuth(request);

  let filterCreatedBy: string | undefined;
  let teamIds: string[] = [];

  if (auth && auth.session.tenantSlug === tenantSlug) {
    if (viewMode === "mine" || (!viewMode && auth.scope === "mine")) {
      filterCreatedBy = auth.employeeId;
    } else if (viewMode === "team" || (!viewMode && auth.scope === "team")) {
      teamIds = await getTeamMemberIds(auth.session.tenantSlug, auth.departmentId);
      if (teamIds.length === 0) {
        filterCreatedBy = auth.employeeId;
      }
    }
  }

  try {
    let leads: any[], contacts: any[], deals: any[];
    let totalLeads: number, totalContacts: number, totalDeals: number;

    if (teamIds.length > 0) {
      const { db } = await import("@/lib/sql-client");
      const placeholders = teamIds.map((_, i) => `$${i + 2}`).join(",");
      const [leadRows, contactRows, dealRows] = await Promise.all([
        db.query(`select * from crm_leads where tenant_slug = $1 and created_by in (${placeholders}) order by created_at desc limit 10`, [tenantSlug, ...teamIds]),
        db.query(`select * from crm_contacts where tenant_slug = $1 and created_by in (${placeholders}) order by created_at desc limit 10`, [tenantSlug, ...teamIds]),
        db.query(`select * from crm_deals where tenant_slug = $1 and created_by in (${placeholders}) order by created_at desc limit 10`, [tenantSlug, ...teamIds]),
      ]);
      leads = leadRows.rows;
      contacts = contactRows.rows;
      deals = dealRows.rows;
      totalLeads = leads.length;
      totalContacts = contacts.length;
      totalDeals = deals.length;
    } else {
      [leads, totalLeads, contacts, totalContacts, deals, totalDeals] = await Promise.all([
        listLeads({ tenantSlug, limit: 10, createdBy: filterCreatedBy }),
        countLeads({ tenantSlug, createdBy: filterCreatedBy }),
        listContacts({ tenantSlug, limit: 10, createdBy: filterCreatedBy }),
        countContacts({ tenantSlug, createdBy: filterCreatedBy }),
        listDeals({ tenantSlug, limit: 10, createdBy: filterCreatedBy }),
        countDeals({ tenantSlug, createdBy: filterCreatedBy }),
      ]);
    }

    const [totalCustomers, conversionStats] = await Promise.all([
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
