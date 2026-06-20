import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listApplications, insertApplication, countApplications, ensureRecruitmentTables } from "@/lib/hr/db-recruitment";
import { sql as SQL } from "@/lib/sql-client";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  candidateId: z.string().optional(),
  requisitionId: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  candidateId: z.string().min(1),
  requisitionId: z.string().min(1),
  coverLetter: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    candidateId: url.searchParams.get("candidateId") ?? undefined,
    requisitionId: url.searchParams.get("requisitionId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await ensureRecruitmentTables(SQL);
    const [applications, total] = await Promise.all([
      listApplications(parsed.data),
      countApplications({ tenantSlug: parsed.data.tenantSlug, requisitionId: parsed.data.requisitionId, status: parsed.data.status }),
    ]);
    return NextResponse.json({ applications, total });
  } catch (error) {
    console.error("Application list failed", error);
    return NextResponse.json({ error: "Failed to load applications" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await ensureRecruitmentTables(SQL);
    const application = await insertApplication(parsed.data);
    return NextResponse.json({ application }, { status: 201 });
  } catch (error) {
    console.error("Application create failed", error);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
