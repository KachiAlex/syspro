export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleGate } from "@/lib/api-auth";

import {
  createEnablementAsset,
  listEnablementAssets,
  type CreateEnablementAssetInput,
} from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const context = validateTenantContext(request, "read");
  const _gate1 = await requireModuleGate(request, "revops", "read");
  if (_gate1) return _gate1;
  const tenantSlug = context.tenantSlug;
  try {
    const assets = await listEnablementAssets(tenantSlug);
    return NextResponse.json({ assets });
  } catch (error) {
    console.error("Failed to list enablement assets", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list assets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const context = validateTenantContext(request, "write");
  const _gate2 = await requireModuleGate(request, "revops", "write");
  if (_gate2) return _gate2;
  const body = (await request.json().catch(() => ({}))) as Partial<CreateEnablementAssetInput>;
  const requiredFields: Array<keyof CreateEnablementAssetInput> = [
    "title",
    "assetType",
    "audience",
    "summary",
    "storageUrl",
    "owner",
    "subsidiary",
  ];

  const missing = requiredFields.find((field) => !body[field]);
  if (missing) {
    return NextResponse.json({ error: `Missing field: ${missing}` }, { status: 400 });
  }

  try {
    const asset = await createEnablementAsset({
      tenantSlug: context.tenantSlug,
      title: body.title!,
      assetType: body.assetType!,
      audience: body.audience!,
      version: body.version,
      tags: body.tags,
      summary: body.summary!,
      storageUrl: body.storageUrl!,
      owner: body.owner!,
      subsidiary: body.subsidiary!,
      region: body.region,
      createdBy: context.userId && context.userId !== "unknown" ? context.userId : body.createdBy!,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error("Failed to create enablement asset", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create asset" }, { status: 500 });
  }
}
