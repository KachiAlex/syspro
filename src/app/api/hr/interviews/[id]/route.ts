import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateInterview, deleteInterview, getInterviewById } from "@/lib/hr/db-recruitment";

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  type: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  interviewerIds: z.array(z.string()).optional(),
  scorecard: z.record(z.any()).optional(),
  notes: z.string().optional(),
  recordingUrl: z.string().url().optional(),
  status: z.string().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    const interview = await getInterviewById(id, tenantSlug);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }
    return NextResponse.json({ interview });
  } catch (error) {
    console.error("Interview get failed", error);
    return NextResponse.json({ error: "Failed to load interview" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const interview = await updateInterview(id, parsed.data.tenantSlug, parsed.data);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }
    return NextResponse.json({ interview });
  } catch (error) {
    console.error("Interview update failed", error);
    return NextResponse.json({ error: "Failed to update interview" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    await deleteInterview(id, tenantSlug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Interview delete failed", error);
    return NextResponse.json({ error: "Failed to delete interview" }, { status: 500 });
  }
}
