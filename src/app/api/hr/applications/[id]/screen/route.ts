import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runApplicationScreening } from "@/lib/hr/db-recruitment";

const screenSchema = z.object({
  tenantSlug: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = screenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await runApplicationScreening(id, parsed.data.tenantSlug);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Application screening failed", error);
    return NextResponse.json({ error: "Failed to run screening" }, { status: 500 });
  }
}
