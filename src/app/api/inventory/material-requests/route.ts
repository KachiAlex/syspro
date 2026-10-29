export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  createMaterialRequest,
  listMaterialRequests,
  listReorderRules,
  runReorderScan,
  upsertReorderRule,
} from "@/lib/inventory/material-requests";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "inventory", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    if (searchParams.get("view") === "reorder-rules") {
      return NextResponse.json({ rules: await listReorderRules(context.tenantSlug) });
    }
    const requests = await listMaterialRequests(context.tenantSlug, searchParams.get("status") ?? undefined);
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Material requests fetch failed:", error);
    return NextResponse.json({ error: "Failed to fetch material requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "inventory", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    if (body.action === "run-reorder-scan") {
      return NextResponse.json(await runReorderScan(context.tenantSlug));
    }
    if (body.action === "upsert-reorder-rule") {
      const rule = await upsertReorderRule({
        tenantSlug: context.tenantSlug,
        productSku: String(body.productSku),
        warehouseId: String(body.warehouseId ?? "main"),
        reorderLevel: Number(body.reorderLevel),
        reorderQuantity: Number(body.reorderQuantity),
        requestType: body.requestType,
        enabled: body.enabled,
      });
      return NextResponse.json({ rule });
    }
    if (!body.requestType || !Array.isArray(body.items) || !body.items.length) {
      return NextResponse.json({ error: "requestType and items[] are required" }, { status: 400 });
    }
    if (!["purchase", "manufacture", "transfer"].includes(body.requestType)) {
      return NextResponse.json({ error: "requestType must be purchase|manufacture|transfer" }, { status: 400 });
    }
    const request_ = await createMaterialRequest({
      tenantSlug: context.tenantSlug,
      requestType: body.requestType,
      requestedBy: context.userId,
      requiredBy: body.requiredBy ?? null,
      notes: body.notes ?? null,
      items: body.items.map((i: any) => ({
        productId: String(i.productId ?? i.sku),
        productName: i.productName ?? null,
        description: i.description ?? null,
        quantity: Number(i.quantity ?? 1),
        uom: i.uom ?? null,
        warehouseId: i.warehouseId ?? null,
      })),
    });
    return NextResponse.json({ request: request_ }, { status: 201 });
  } catch (error) {
    console.error("Material request create failed:", error);
    return NextResponse.json({ error: "Failed to create material request", details: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
