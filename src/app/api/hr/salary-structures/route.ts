export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import { listSalaryStructures, upsertSalaryStructure, applySalaryStructure } from "@/lib/hr/salary-structure";

const componentSchema = z.object({
  name: z.string().min(1).max(120),
  componentType: z.enum(["earning", "deduction"]),
  amountType: z.enum(["fixed", "percent_of_base"]).optional(),
  amount: z.coerce.number(),
});

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(160),
  effectiveFrom: z.string().optional(),
  isActive: z.boolean().optional(),
  components: z.array(componentSchema).min(1),
});

const applySchema = z.object({
  action: z.literal("apply"),
  structureId: z.string().min(1),
  employeeIds: z.array(z.string()).min(1),
});

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "people", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  return NextResponse.json({ structures: await listSalaryStructures(context.tenantSlug) });
}

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "people", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  if ((body as any).action === "apply") {
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const result = await applySalaryStructure(context.tenantSlug, parsed.data.structureId, parsed.data.employeeIds, context.userId);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const structure = await upsertSalaryStructure(context.tenantSlug, parsed.data);
  return NextResponse.json({ structure }, { status: 201 });
}
