export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  cancelSubcontractOrder, createSubcontractOrder, issueSubcontractMaterials,
  listSubcontractOrders, receiveSubcontractGoods,
} from "@/lib/manufacturing/subcontracting";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const gate = await requireModuleAccess(request, "admin", "read");
  if (!gate.ok) return gate.response;
  try {
    const orders = await listSubcontractOrders(
      context.tenantSlug, new URL(request.url).searchParams.get("status") ?? undefined
    );
    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const createSchema = z.object({
  subcontractor: z.string().min(1),
  productSku: z.string().min(1),
  productName: z.string().min(1),
  quantity: z.coerce.number().positive(),
  feePerUnit: z.coerce.number().nonnegative().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  warehouseId: z.string().optional(),
  materials: z.array(z.object({
    sku: z.string().min(1),
    name: z.string().optional(),
    quantity: z.coerce.number().positive(),
    unitCost: z.coerce.number().nonnegative().optional(),
  })).min(1),
});

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }
    const out = await createSubcontractOrder({
      tenantSlug: context.tenantSlug,
      createdBy: (gate as any).user?.id ?? undefined,
      ...parsed.data,
    });
    return NextResponse.json(out, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum(["issue", "receive", "cancel"]),
  orderId: z.string().min(1),
  receivedQty: z.coerce.number().positive().optional(),
  warehouseId: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "admin", "write");
  if (!gate.ok) return gate.response;
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
    }
    const d = parsed.data;
    const out = d.action === "issue"
      ? await issueSubcontractMaterials(context.tenantSlug, d.orderId, { warehouseId: d.warehouseId })
      : d.action === "receive"
        ? await receiveSubcontractGoods({
            tenantSlug: context.tenantSlug, orderId: d.orderId,
            receivedQty: d.receivedQty, warehouseId: d.warehouseId,
            userId: (gate as any).user?.id ?? undefined,
          })
        : (await cancelSubcontractOrder(context.tenantSlug, d.orderId), { cancelled: true });
    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
