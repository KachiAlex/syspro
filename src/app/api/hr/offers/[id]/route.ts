import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateOffer, deleteOffer, getOfferById } from "@/lib/hr/db-recruitment";

const updateSchema = z.object({
  tenantSlug: z.string().min(1),
  salary: z.number().nonnegative().optional(),
  bonus: z.number().nonnegative().optional(),
  benefits: z.record(z.any()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  reportingManagerId: z.string().optional(),
  status: z.string().optional(),
  candidateResponse: z.string().optional(),
  candidateResponseAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  sentAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const tenantSlug = url.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Missing tenantSlug" }, { status: 400 });
  }

  try {
    const offer = await getOfferById(id, tenantSlug);
    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }
    return NextResponse.json({ offer });
  } catch (error) {
    console.error("Offer get failed", error);
    return NextResponse.json({ error: "Failed to load offer" }, { status: 500 });
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
    const offer = await updateOffer(id, parsed.data.tenantSlug, parsed.data);
    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }
    return NextResponse.json({ offer });
  } catch (error) {
    console.error("Offer update failed", error);
    return NextResponse.json({ error: "Failed to update offer" }, { status: 500 });
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
    await deleteOffer(id, tenantSlug);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Offer delete failed", error);
    return NextResponse.json({ error: "Failed to delete offer" }, { status: 500 });
  }
}
