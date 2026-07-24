import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getScreeningConfig, saveScreeningConfig } from "@/lib/hr/db-recruitment";

const configSchema = z.object({
  tenantSlug: z.string().min(1),
  selectionMode: z.enum(["percentage", "fixed_number"]),
  selectionValue: z.number().int().positive(),
  minScoreThreshold: z.number().int().min(0).max(100).optional(),
  isEnabled: z.boolean().optional(),
  customWeights: z.record(z.string(), z.number()).optional(),
  autoRejectRules: z.array(z.object({
    field: z.enum(["experience", "requiredSkills", "education", "certifications", "resume"]),
    operator: z.enum(["lt", "eq", "missing"]),
    value: z.any(),
  })).optional(),
  autoRejectBelowScore: z.number().int().min(0).max(100).optional(),
  autoTalentPoolRejected: z.boolean().optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ error: "tenantSlug required" }, { status: 400 });
  }
  try {
    const config = await getScreeningConfig(id, tenantSlug);
    return NextResponse.json({ config });
  } catch (error) {
    console.error("Failed to get screening config", error);
    return NextResponse.json({ error: "Failed to get screening config" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const config = await saveScreeningConfig({
      requisitionId: id,
      tenantSlug: parsed.data.tenantSlug,
      selectionMode: parsed.data.selectionMode,
      selectionValue: parsed.data.selectionValue,
      minScoreThreshold: parsed.data.minScoreThreshold ?? 0,
      isEnabled: parsed.data.isEnabled ?? true,
      customWeights: parsed.data.customWeights ?? null,
      autoRejectRules: parsed.data.autoRejectRules ?? null,
      autoRejectBelowScore: parsed.data.autoRejectBelowScore ?? 0,
      autoTalentPoolRejected: parsed.data.autoTalentPoolRejected ?? false,
    });
    return NextResponse.json({ config });
  } catch (error) {
    console.error("Failed to save screening config", error);
    return NextResponse.json({ error: "Failed to save screening config" }, { status: 500 });
  }
}
