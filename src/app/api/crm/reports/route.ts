export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmAuth } from "@/lib/crm/auth";
import { db } from "@/lib/sql-client";

/**
 * GET /api/crm/reports?tenantSlug=…&report=pipeline|funnel|lost-reasons|officers|sources
 * CRM report suite over crm_leads/crm_deals/crm_customers.
 */
export async function GET(request: NextRequest) {
  const tenantSlug = new URL(request.url).searchParams.get("tenantSlug") ?? "";
  const guard = await requireCrmAuth(request, tenantSlug);
  if (!guard.ok) return guard.response;

  const report = new URL(request.url).searchParams.get("report") ?? "pipeline";
  const tenant = guard.auth.session.tenantSlug;

  try {
    switch (report) {
      case "pipeline": {
        const rows = (await db.query(
          `select stage, count(*)::int as count, coalesce(sum(value),0)::numeric as value
           from crm_deals where tenant_slug = $1 group by stage order by stage`,
          [tenant]
        )).rows;
        return NextResponse.json({ report, rows });
      }
      case "funnel": {
        const rows = (await db.query(
          `select stage, count(*)::int as count from crm_leads where tenant_slug = $1 group by stage`,
          [tenant]
        )).rows;
        const deals = (await db.query(
          `select
             count(*)::int as total,
             count(*) filter (where stage = 'closed_won')::int as won,
             count(*) filter (where stage = 'closed_lost')::int as lost
           from crm_deals where tenant_slug = $1`,
          [tenant]
        )).rows[0];
        return NextResponse.json({ report, leadsByStage: rows, deals });
      }
      case "lost-reasons": {
        const rows = (await db.query(
          `select coalesce(lost_reason, 'Unspecified') as reason, count(*)::int as count,
                  coalesce(sum(value),0)::numeric as value
           from crm_deals where tenant_slug = $1 and stage = 'closed_lost'
           group by 1 order by count desc`,
          [tenant]
        )).rows;
        return NextResponse.json({ report, rows });
      }
      case "officers": {
        const rows = (await db.query(
          `select coalesce(assigned_officer_id, 'Unassigned') as officer,
                  count(*)::int as deals,
                  count(*) filter (where stage = 'closed_won')::int as won,
                  coalesce(sum(value) filter (where stage = 'closed_won'),0)::numeric as won_value,
                  coalesce(sum(value) filter (where stage not in ('closed_won','closed_lost')),0)::numeric as open_value
           from crm_deals where tenant_slug = $1 group by 1 order by won_value desc`,
          [tenant]
        )).rows;
        return NextResponse.json({ report, rows });
      }
      case "sources": {
        const rows = (await db.query(
          `select coalesce(l.source, 'unknown') as source,
                  count(*)::int as leads,
                  count(*) filter (where l.stage = 'converted')::int as converted,
                  coalesce(sum(d.value) filter (where d.stage = 'closed_won'),0)::numeric as won_value
           from crm_leads l
           left join crm_deals d on d.lead_id = l.id and d.tenant_slug = l.tenant_slug
           where l.tenant_slug = $1 group by 1 order by leads desc`,
          [tenant]
        )).rows;
        return NextResponse.json({ report, rows });
      }
      default:
        return NextResponse.json({ error: `Unknown report "${report}"` }, { status: 400 });
    }
  } catch (err) {
    console.error("CRM report failed:", err);
    return NextResponse.json({ error: "Report failed" }, { status: 500 });
  }
}
