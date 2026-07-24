import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateCandidate, deleteCandidate, getCandidateById } from "@/lib/hr/db-recruitment";

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  source: z.string().optional(),
  currentStage: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experienceYears: z.number().nonnegative().optional(),
  education: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  expectedSalary: z.number().nonnegative().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  overallScore: z.number().min(0).max(100).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    const candidate = await getCandidateById(id, tenantSlug);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    return NextResponse.json({ candidate });
  } catch (error) {
    console.error("Candidate get failed", error);
    return NextResponse.json({ error: "Failed to load candidate" }, { status: 500 });
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
    const candidate = await updateCandidate(id, parsed.data.tenantSlug, parsed.data);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }
    return NextResponse.json({ candidate });
  } catch (error) {
    console.error("Candidate update failed", error);
    return NextResponse.json({ error: "Failed to update candidate" }, { status: 500 });
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
    await deleteCandidate(id, tenantSlug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Candidate delete failed", error);
    return NextResponse.json({ error: "Failed to delete candidate" }, { status: 500 });
  }
}
