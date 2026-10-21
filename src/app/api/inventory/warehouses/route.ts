export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createWarehouse, listWarehouses } from "@/lib/inventory/warehouses";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;
  const context = validateTenantContext(request, "read");
  try {
    const warehouses = await listWarehouses(context.tenantSlug);
    return NextResponse.json({ warehouses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const schema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).optional(),
  parentWarehouseId: z.string().optional(),
  branchId: z.string().optional(),
  type: z.enum(["warehouse", "transit"]).optional(),
  isGroup: z.boolean().optional(),
  status: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;
  const context = validateTenantContext(request, "write");
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const warehouse = await createWarehouse(context.tenantSlug, parsed.data);
    return NextResponse.json({ warehouse }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
