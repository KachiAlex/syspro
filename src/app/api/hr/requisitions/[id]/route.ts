import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateRequisition, deleteRequisition, getRequisitionById } from "@/lib/hr/db-recruitment";

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  title: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  branchId: z.string().optional(),
  headcount: z.number().int().positive().optional(),
  budget: z.number().nonnegative().optional(),
  requiredSkills: z.array(z.string()).optional(),
  minExperienceYears: z.number().int().nonnegative().optional(),
  employmentType: z.enum(["full-time", "part-time", "contract", "intern"]).optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  location: z.string().optional(),
  salaryRange: z.string().optional(),
  status: z.string().optional(),
  postedAt: z.string().datetime().optional(),
  closedAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    const requisition = await getRequisitionById(id, tenantSlug);
    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }
    return NextResponse.json({ requisition });
  } catch (error) {
    console.error("Requisition get failed", error);
    return NextResponse.json({ error: "Failed to load requisition" }, { status: 500 });
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
    const requisition = await updateRequisition(id, parsed.data.tenantSlug, parsed.data);
    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }
    return NextResponse.json({ requisition });
  } catch (error) {
    console.error("Requisition update failed", error);
    return NextResponse.json({ error: "Failed to update requisition" }, { status: 500 });
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
    await deleteRequisition(id, tenantSlug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Requisition delete failed", error);
    return NextResponse.json({ error: "Failed to delete requisition" }, { status: 500 });
  }
}
