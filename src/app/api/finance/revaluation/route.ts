export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { listRevaluations, revalueOpenBalances, reverseRevaluation } from "@/lib/finance/currency";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  try {
    const revaluations = await listRevaluations(context.tenantSlug);
    return NextResponse.json({ revaluations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const schema = z.object({
  action: z.enum(["revalue", "reverse"]).optional().default("revalue"),
  asOf: z.string().min(8),
  direction: z.enum(["ar", "ap", "both"]).optional(),
  revaluationId: z.string().optional(),
  reversalDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }
    const d = parsed.data;
    if (d.action === "reverse") {
      if (!d.revaluationId) {
        return NextResponse.json({ error: "revaluationId required for reverse" }, { status: 400 });
      }
      const out = await reverseRevaluation(
        context.tenantSlug, d.revaluationId,
        d.reversalDate ?? d.asOf, (gate as any).user?.id ?? undefined
      );
      return NextResponse.json(out);
    }
    const out = await revalueOpenBalances({
      tenantSlug: context.tenantSlug,
      asOf: d.asOf,
      direction: d.direction,
      userId: (gate as any).user?.id ?? undefined,
    });
    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
