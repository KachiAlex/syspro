import { NextRequest, NextResponse } from "next/server";

import {
  createEnablementAsset,
  listEnablementAssets,
  type CreateEnablementAssetInput,
} from "@/lib/revops-data";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenantSlug = searchParams.get("tenantSlug")?.trim() || "default";
  const assets = listEnablementAssets(tenantSlug);
  return NextResponse.json({ assets });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<CreateEnablementAssetInput>;
  const requiredFields: Array<keyof CreateEnablementAssetInput> = [
    "tenantSlug",
    "title",
    "assetType",
    "audience",
    "summary",
    "storageUrl",
    "owner",
    "subsidiary",
    "createdBy",
  ];

  const missing = requiredFields.find((field) => !body[field]);
  if (missing) {
    return NextResponse.json({ error: `Missing field: ${missing}` }, { status: 400 });
  }

  try {
    const asset = createEnablementAsset({
      tenantSlug: body.tenantSlug!,
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
      createdBy: body.createdBy!,
    });
    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create asset" }, { status: 500 });
  }
}
