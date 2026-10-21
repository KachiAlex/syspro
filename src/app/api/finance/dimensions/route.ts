export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listDimensions,
  upsertDimension,
  deleteDimension,
} from "@/lib/finance/dimensions";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const data = await listDimensions(tenantSlug);
  return NextResponse.json({ success: true, data });
}

const upsertSchema = z.object({
  tenantSlug: z.string().min(1),
  dimensionKey: z.string().min(1),
  label: z.string().min(1),
  requiredFor: z.array(z.string()).optional(),
  allowedValues: z.array(z.string()).nullable().optional(),
  active: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const parsed = upsertSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const data = await upsertDimension(parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  const id = request.nextUrl.searchParams.get("id");
  const tenantSlug = request.nextUrl.searchParams.get("tenantSlug");
  if (!id || !tenantSlug) {
    return NextResponse.json({ success: false, error: "id and tenantSlug are required" }, { status: 400 });
  }
  const deleted = await deleteDimension(id, tenantSlug);
  if (!deleted) {
    return NextResponse.json({ success: false, error: "Dimension not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
