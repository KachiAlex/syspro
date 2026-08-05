import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { ensureTenantTable } from "@/lib/tenant/tenant-table";
import { INDUSTRY_PROFILES, getModulesForIndustries, isValidIndustry, IndustryType } from "@/lib/config/industry-profiles";
import { z } from "zod";

const updateProfilesSchema = z.object({
  industryProfiles: z.array(z.enum(["services", "trading", "manufacturing", "mixed"])),
});

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const sql = SQL;
    await ensureTenantTable(sql);

    const rows = (await sql`
      select industry_profiles, settings
      from tenants
      where slug = ${tenantSlug}
    `) as any[];

    if (!rows.length) {
      return NextResponse.json({ success: false, error: "Tenant not found" }, { status: 404 });
    }

    const rawProfiles = rows[0].industry_profiles;
    let profiles: IndustryType[] = [];

    if (Array.isArray(rawProfiles)) {
      profiles = rawProfiles.filter((p: any) => isValidIndustry(String(p))) as IndustryType[];
    } else if (rows[0].settings?.industryProfiles) {
      profiles = (rows[0].settings.industryProfiles as string[]).filter(isValidIndustry) as IndustryType[];
    }

    const activeModules = getModulesForIndustries(profiles);

    return NextResponse.json({
      success: true,
      data: {
        profiles,
        activeModules,
        availableProfiles: Object.values(INDUSTRY_PROFILES),
      },
    });
  } catch (error) {
    console.error("Error fetching industry profiles:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
    if (!tenantSlug) {
      return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateProfilesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
    }

    const sql = SQL;
    await ensureTenantTable(sql);

    const profiles = parsed.data.industryProfiles;
    const profilesJson = JSON.stringify(profiles);

    await sql`
      update tenants
      set industry_profiles = ${profilesJson}::jsonb,
          settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{industryProfiles}', ${profilesJson}::jsonb),
          "updatedAt" = now()
      where slug = ${tenantSlug}
    `;

    const activeModules = getModulesForIndustries(profiles);

    return NextResponse.json({
      success: true,
      data: {
        profiles,
        activeModules,
      },
    });
  } catch (error) {
    console.error("Error updating industry profiles:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
