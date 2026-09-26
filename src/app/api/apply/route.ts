import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { insertCandidate, insertApplication, getRequisitionById } from "@/lib/hr/db-recruitment";

const applySchema = z.object({
  tenantSlug: z.string().min(1),
  requisitionId: z.string().min(1),
  website: z.string().optional(), // honeypot — bots fill it, humans never see it
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  resumeUrl: z.string().url().optional(),
  coverLetter: z.string().optional(),
  experienceYears: z.number().nonnegative().optional(),
  education: z.string().optional(),
  skills: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Honeypot: silently accept bot submissions without storing them.
  if (parsed.data.website) {
    return NextResponse.json({ success: true });
  }

  const { tenantSlug, requisitionId, fullName, email, phone, resumeUrl, coverLetter, experienceYears, education, skills } = parsed.data;

  try {
    // Verify requisition exists
    const requisition = await getRequisitionById(requisitionId, tenantSlug);
    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    // Create candidate
    const candidate = await insertCandidate({
      tenantSlug,
      fullName,
      email,
      phone: phone || null,
      resumeUrl: resumeUrl || null,
      source: "career_page",
      currentStage: "new",
      skills,
      experienceYears: experienceYears ?? null,
      education: education || null,
      notes: null,
      tags: [],
    });

    // Create application
    const application = await insertApplication({
      tenantSlug,
      candidateId: candidate.id,
      requisitionId,
      coverLetter: coverLetter || null,
    });

    return NextResponse.json({ success: true, candidate, application }, { status: 201 });
  } catch (error) {
    console.error("Apply submission failed", error);
    return NextResponse.json({ error: "Failed to submit application" }, { status: 500 });
  }
}
