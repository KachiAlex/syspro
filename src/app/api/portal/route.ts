export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createPortalToken, listPortalTokens, revokePortalToken } from "@/lib/finance/portal";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

const createSchema = z.object({
  partyType: z.enum(["customer", "vendor"]),
  partyId: z.string().optional(),
  partyName: z.string().min(1),
  email: z.string().email().optional(),
  expiresInDays: z.coerce.number().int().positive().optional(),
});

export async function GET(request: NextRequest) {
  const gate = await requireModuleAccess(request, "finance", "read");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "read");
  const { searchParams } = new URL(request.url);
  const tokens = await listPortalTokens(context.tenantSlug, {
    partyType: searchParams.get("partyType") ?? undefined,
    partyId: searchParams.get("partyId") ?? undefined,
  });
  return NextResponse.json({ tokens });
}

export async function POST(request: NextRequest) {
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await createPortalToken(context.tenantSlug, parsed.data);
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const context = validateTenantContext(request, "write");
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  await revokePortalToken(context.tenantSlug, id);
  return NextResponse.json({ ok: true });
}
