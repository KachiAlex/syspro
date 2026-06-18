import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listOffers, insertOffer } from "@/lib/hr/db-recruitment";

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
  salary: z.number().nonnegative(),
  bonus: z.number().nonnegative().optional(),
  benefits: z.record(z.any()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportingManagerId: z.string().min(1),
  expiresAt: z.string().datetime(),
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
    const offers = await listOffers(parsed.data);
    return NextResponse.json({ offers });
  } catch (error) {
    console.error("Offer list failed", error);
    return NextResponse.json({ error: "Failed to load offers" }, { status: 500 });
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
    const offer = await insertOffer(parsed.data);
    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    console.error("Offer create failed", error);
    return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
  }
}
