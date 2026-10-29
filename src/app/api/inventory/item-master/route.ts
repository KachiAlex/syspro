export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  convertUom,
  createVariant,
  explodeBundle,
  listAttributes,
  listBundles,
  listItemGroups,
  listUoms,
  listVariants,
  upsertAttribute,
  upsertBundle,
  upsertItemGroup,
  upsertUom,
  upsertUomConversion,
} from "@/lib/inventory/item-master";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "inventory", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "uoms";

    switch (view) {
      case "uoms":
        return NextResponse.json(await listUoms(context.tenantSlug));
      case "convert": {
        const qty = await convertUom(
          context.tenantSlug,
          Number(searchParams.get("quantity")),
          String(searchParams.get("from")),
          String(searchParams.get("to"))
        );
        return NextResponse.json({ quantity: qty });
      }
      case "item-groups":
        return NextResponse.json({ groups: await listItemGroups(context.tenantSlug) });
      case "attributes":
        return NextResponse.json({ attributes: await listAttributes(context.tenantSlug) });
      case "variants":
        return NextResponse.json({ variants: await listVariants(context.tenantSlug, searchParams.get("templateProductId") ?? undefined) });
      case "bundles":
        return NextResponse.json({ bundles: await listBundles(context.tenantSlug) });
      case "explode-bundle": {
        const result = await explodeBundle(context.tenantSlug, String(searchParams.get("sku")));
        return result ? NextResponse.json(result) : NextResponse.json({ error: "Bundle not found" }, { status: 404 });
      }
      default:
        return NextResponse.json({ error: "view must be uoms|convert|item-groups|attributes|variants|bundles|explode-bundle" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: /No UOM conversion/.test(msg) ? 400 : 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "inventory", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();

    switch (body.action) {
      case "upsert-uom":
        return NextResponse.json({ uom: await upsertUom(context.tenantSlug, String(body.name), { categoryId: body.categoryId, mustBeWhole: body.mustBeWhole }) });
      case "upsert-uom-conversion":
        return NextResponse.json({ conversion: await upsertUomConversion(context.tenantSlug, String(body.fromUom), String(body.toUom), Number(body.factor)) });
      case "upsert-item-group":
        return NextResponse.json({ group: await upsertItemGroup(context.tenantSlug, String(body.name), body.parentId ?? null, body.isGroup) });
      case "upsert-attribute":
        return NextResponse.json({ attribute: await upsertAttribute(context.tenantSlug, String(body.name), body.values ?? []) });
      case "create-variant":
        return NextResponse.json({ variant: await createVariant({
          tenantSlug: context.tenantSlug,
          templateProductId: String(body.templateProductId),
          attributes: body.attributes ?? {},
          salePrice: body.salePrice ?? null,
          unitCost: body.unitCost ?? null,
        }) });
      case "upsert-bundle":
        return NextResponse.json({ bundle: await upsertBundle({
          tenantSlug: context.tenantSlug,
          bundleSku: String(body.bundleSku),
          name: String(body.name),
          description: body.description ?? null,
          items: (body.items ?? []).map((i: any) => ({ productSku: String(i.productSku), quantity: Number(i.quantity) })),
        }) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Item master write failed:", error);
    return NextResponse.json({ error: String((error as any)?.message ?? error) }, { status: 500 });
  }
}
