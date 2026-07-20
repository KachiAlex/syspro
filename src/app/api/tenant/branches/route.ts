import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/sql-client";
import { requireDashboardPermission } from "@/lib/tenant-admin/permissions";

export interface TenantBranch {
  id: string;
  name: string;
  code?: string;
  country?: string;
  continent?: string;
  state?: string;
  city?: string;
  status?: string;
  headcount?: number;
  manager?: string;
  establishedDate?: string;
  revenue?: string;
  currency?: string;
  region?: string;
  metadata?: Record<string, string>;
}

function flattenBranches(node: any, list: TenantBranch[] = []) {
  if (!node || typeof node !== "object") return list;

  if (node.type === "branch") {
    list.push({
      id: node.id,
      name: node.name || "Branch",
      code: node.metadata?.code || node.id,
      country: node.metadata?.country || "—",
      continent: node.metadata?.continent || node.region || "Other",
      state: node.metadata?.state || "—",
      city: node.metadata?.city || node.region || "—",
      status: node.status === "Live" ? "active" : node.status === "Paused" ? "inactive" : "pending",
      headcount: typeof node.headcount === "number" ? node.headcount : 0,
      manager: node.manager || "—",
      establishedDate: node.metadata?.establishedDate || "—",
      revenue: String(Number(node.metadata?.revenue) || 0),
      currency: node.metadata?.currency || "USD",
      region: node.region,
      metadata: node.metadata || {},
    });
  }

  for (const child of node.children || []) {
    flattenBranches(child, list);
  }

  return list;
}

export async function GET(request: NextRequest) {
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug is required" }, { status: 400 });
  }

  try {
    await requireDashboardPermission(request, "admin");
    await sql`
      create table if not exists tenant_org_structures (
        slug text primary key,
        tree jsonb not null,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      )
    `;

    const rows = await sql`
      select tree from tenant_org_structures where slug = ${tenantSlug} limit 1
    `;

    const tree = (Array.isArray(rows) && rows.length > 0 ? rows[0].tree : null) as any;
    const branches = flattenBranches(tree);

    return NextResponse.json({ branches });
  } catch (error) {
    console.error("Branches GET error:", error);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}
