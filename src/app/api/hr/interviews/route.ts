import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listInterviews, insertInterview } from "@/lib/hr/db-recruitment";

const listSchema = z.object({
  tenantSlug: z.string().min(1),
  applicationId: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const createSchema = z.object({
  tenantSlug: z.string().min(1),
  applicationId: z.string().min(1),
  roundNumber: z.number().int().positive().optional(),
  type: z.enum(["technical", "behavioral", "cultural", "executive", "panel", "phone_screen"]),
  scheduledAt: z.string().datetime(),
  interviewerIds: z.array(z.string()).min(1),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    tenantSlug: url.searchParams.get("tenantSlug") ?? undefined,
    applicationId: url.searchParams.get("applicationId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const interviews = await listInterviews(parsed.data);
    return NextResponse.json({ interviews });
  } catch (error) {
    console.error("Interview list failed", error);
    return NextResponse.json({ error: "Failed to load interviews" }, { status: 500 });
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
    const interview = await insertInterview(parsed.data);
    return NextResponse.json({ interview }, { status: 201 });
  } catch (error) {
    console.error("Interview create failed", error);
    return NextResponse.json({ error: "Failed to schedule interview" }, { status: 500 });
  }
}
