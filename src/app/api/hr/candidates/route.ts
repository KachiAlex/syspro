import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listCandidates, insertCandidate, countCandidates, ensureRecruitmentTables } from "@/lib/hr/db-recruitment";
import { sql as SQL } from "@/lib/sql-client";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  currentStage: z.string().optional(),
  source: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  source: z.enum(["career_page", "linkedin", "indeed", "referral", "agency", "job_fair", "manual"]).optional(),
  currentStage: z.string().optional(),
  skills: z.array(z.string()).default([]),
  experienceYears: z.number().nonnegative().optional(),
  education: z.string().optional(),
  certifications: z.array(z.string()).default([]),
  expectedSalary: z.number().nonnegative().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    currentStage: url.searchParams.get("currentStage") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await ensureRecruitmentTables(SQL);
    const [candidates, total] = await Promise.all([
      listCandidates(parsed.data),
      countCandidates({ tenantSlug: parsed.data.tenantSlug, currentStage: parsed.data.currentStage, source: parsed.data.source }),
    ]);
    return NextResponse.json({ candidates, total });
  } catch (error) {
    console.error("Candidate list failed", error);
    return NextResponse.json({ error: "Failed to load candidates" }, { status: 500 });
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
    const candidate = await insertCandidate(parsed.data);
    return NextResponse.json({ candidate }, { status: 201 });
  } catch (error) {
    console.error("Candidate create failed", error);
    return NextResponse.json({ error: "Failed to create candidate" }, { status: 500 });
  }
}
