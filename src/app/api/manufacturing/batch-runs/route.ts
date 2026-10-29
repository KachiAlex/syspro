export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cancelBatchRun, createBatchRun, listBatchRuns } from "@/lib/manufacturing/batches";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "manufacturing", "read");
  if (!gate.ok) return gate.response;
  try {
    const runs = await listBatchRuns(context.tenantSlug);
    return NextResponse.json({ runs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const createSchema = z.object({
  productSku: z.string().min(1),
  productName: z.string().min(1),
  totalQuantity: z.coerce.number().positive(),
  batchSize: z.coerce.number().positive(),
  bomId: z.string().optional(),
  scheduledStart: z.string().optional(),
  scheduledEnd: z.string().optional(),
  priority: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "manufacturing", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }
    const out = await createBatchRun({
      tenantSlug: context.tenantSlug,
      createdBy: (gate as any).user?.id ?? undefined,
      ...parsed.data,
    });
    return NextResponse.json(out, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "manufacturing", "write");
  if (!gate.ok) return gate.response;
  try {
    const runId = new URL(request.url).searchParams.get("runId");
    if (!runId) return NextResponse.json({ error: "runId is required" }, { status: 400 });
    await cancelBatchRun(context.tenantSlug, runId);
    return NextResponse.json({ cancelled: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
