export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { deleteWarehouse, getWarehouse, updateWarehouse } from "@/lib/inventory/warehouses";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  const _scope = await requireModuleAccess(request, "inventory", "read");
  if (!_scope.ok) return _scope.response;
  const context = validateTenantContext(request, "read");
  const { id } = await params;
  const warehouse = await getWarehouse(context.tenantSlug, id);
  if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
  return NextResponse.json({ warehouse });
}

const schema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  parentWarehouseId: z.string().optional(),
  branchId: z.string().nullable().optional(),
  type: z.enum(["warehouse", "transit"]).optional(),
  isGroup: z.boolean().optional(),
  status: z.string().optional(),
});

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const _scope = await requireModuleAccess(request, "inventory", "write");
  if (!_scope.ok) return _scope.response;
  const context = validateTenantContext(request, "write");
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const warehouse = await updateWarehouse(context.tenantSlug, id, parsed.data);
    if (!warehouse) return NextResponse.json({ error: "Warehouse not found" }, { status: 404 });
    return NextResponse.json({ warehouse });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const _scope = await requireModuleAccess(request, "inventory", "write");
  if (!_scope.ok) return _scope.response;
  const context = validateTenantContext(request, "write");
  const { id } = await params;
  try {
    const result = await deleteWarehouse(context.tenantSlug, id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
