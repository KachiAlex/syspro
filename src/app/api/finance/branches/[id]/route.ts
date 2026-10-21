export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deleteBranch, getBranch, updateBranch } from "@/lib/finance/branches";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const branch = await getBranch(context.tenantSlug, id);
  if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
  return NextResponse.json({ branch });
}

const schema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(1).optional(),
  kind: z.enum(["branch", "subsidiary"]).optional(),
  parentBranchId: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  status: z.enum(["active", "inactive", "planning"]).optional(),
  manager: z.string().optional(),
  headcount: z.number().int().nonnegative().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const branch = await updateBranch(context.tenantSlug, id, parsed.data);
    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });
    return NextResponse.json({ branch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const context = validateTenantContext(request, "delete");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  try {
    const result = await deleteBranch(context.tenantSlug, id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
