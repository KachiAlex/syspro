import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runBatchAIScreening } from "@/lib/hr/db-recruitment";

const runSchema = z.object({
  tenantSlug: z.string().min(1),
  selectionMode: z.enum(["percentage", "fixed_number"]).optional(),
  selectionValue: z.number().int().positive().optional(),
  minScoreThreshold: z.number().int().min(0).max(100).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = runSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await runBatchAIScreening(id, parsed.data.tenantSlug, {
      selectionMode: parsed.data.selectionMode,
      selectionValue: parsed.data.selectionValue,
      minScoreThreshold: parsed.data.minScoreThreshold,
    });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("Batch AI screening failed", error);
    return NextResponse.json({ error: "Failed to run AI screening" }, { status: 500 });
  }
}
