import { NextRequest, NextResponse } from "next/server";
import { sql as SQL } from "@/lib/sql-client";
import { ensureRecruitmentTables } from "@/lib/hr/db-recruitment";
import { checkRateLimitAsync, getRateLimitKey } from "@/lib/rate-limit";

// Public job-board read: returns only the fields a job page needs, and only
// for requisitions in 'open' status.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await checkRateLimitAsync(`apply-req:${getRateLimitKey(request)}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { id } = await params;
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug") || "";
  if (!id || !tenantSlug) {
    return NextResponse.json({ error: "Missing requisition id or tenant" }, { status: 400 });
  }

  try {
    const sql = SQL;
    await ensureRecruitmentTables(sql);
    const rows = await sql`
      select id, title, description, requirements, location, salary_range,
             employment_type, headcount, min_experience_years, required_skills
      from admin_job_requisitions
      where id = ${id} and tenant_slug = ${tenantSlug} and status = 'open'
      limit 1
    `;
    const row = (rows as any[])[0];
    if (!row) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    return NextResponse.json({
      requisition: {
        id: row.id,
        title: row.title,
        description: row.description,
        requirements: row.requirements ?? null,
        location: row.location ?? null,
        salaryRange: row.salary_range ?? null,
        employmentType: row.employment_type,
        headcount: row.headcount ?? 1,
        minExperienceYears: row.min_experience_years ?? null,
        requiredSkills: Array.isArray(row.required_skills) ? row.required_skills : [],
      },
    });
  } catch (error) {
    console.error("Public requisition fetch failed:", error);
    return NextResponse.json({ error: "Failed to load job details" }, { status: 500 });
  }
}
