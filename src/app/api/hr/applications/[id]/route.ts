import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateApplication, getApplicationById } from "@/lib/hr/db-recruitment";

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  status: z.string().optional(),
  aiScore: z.number().min(0).max(100).optional(),
  screeningResult: z.record(z.any()).optional(),
  reviewedAt: z.string().datetime().optional(),
  decidedAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    const application = await getApplicationById(id, tenantSlug);
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    return NextResponse.json({ application });
  } catch (error) {
    console.error("Application get failed", error);
    return NextResponse.json({ error: "Failed to load application" }, { status: 500 });
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
    const application = await updateApplication(id, parsed.data.tenantSlug, parsed.data);
    if (!application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    return NextResponse.json({ application });
  } catch (error) {
    console.error("Application update failed", error);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}
