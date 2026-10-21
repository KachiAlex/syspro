export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";
import {
  allocateAsset, awardEnergyPoints, docsSharedWith, endAllocation,
  energyLeaderboard, listAssetActivity, listAssetAllocations,
  listCmsPages, listCmsPosts, listDocShares, listEnergyLog,
  logAssetActivity, revertEnergyPoints, shareDoc, unshareDoc,
  upsertCmsPage, upsertCmsPost,
} from "@/lib/platform/edge";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "read");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "read");
    const { searchParams } = new URL(request.url);
    switch (searchParams.get("view") ?? "asset-allocations") {
      case "asset-allocations":
        return NextResponse.json({ allocations: await listAssetAllocations(context.tenantSlug, searchParams.get("assetId") ?? undefined) });
      case "asset-activity":
        return NextResponse.json({ activity: await listAssetActivity(context.tenantSlug, searchParams.get("assetId") ?? undefined) });
      case "doc-shares":
        return NextResponse.json({ shares: await listDocShares(context.tenantSlug, searchParams.get("docType") ?? undefined, searchParams.get("docId") ?? undefined) });
      case "shared-with-me":
        return NextResponse.json({ shares: await docsSharedWith(context.tenantSlug, String(context.userId)) });
      case "energy":
        return NextResponse.json({
          leaderboard: await energyLeaderboard(context.tenantSlug),
          log: await listEnergyLog(context.tenantSlug, searchParams.get("userId") ?? undefined),
        });
      case "cms-posts":
        return NextResponse.json({ posts: await listCmsPosts(context.tenantSlug) });
      case "cms-pages":
        return NextResponse.json({ pages: await listCmsPages(context.tenantSlug) });
      default:
        return NextResponse.json({ error: "Unknown view" }, { status: 400 });
    }
  } catch (error) {
    console.error("Platform edge read failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "admin", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const context = validateTenantContext(request, "write");
    const body = await request.json();
    switch (body.action) {
      case "allocate-asset":
        return NextResponse.json({ allocation: await allocateAsset({
          tenantSlug: context.tenantSlug, assetId: String(body.assetId),
          employeeId: body.employeeId, shiftId: body.shiftId,
          fromDate: String(body.fromDate), toDate: body.toDate,
        }) }, { status: 201 });
      case "end-allocation":
        return NextResponse.json({ allocation: await endAllocation(context.tenantSlug, String(body.id)) });
      case "log-activity":
        return NextResponse.json({ log: await logAssetActivity({
          tenantSlug: context.tenantSlug, assetId: String(body.assetId),
          activityType: String(body.activityType), readingValue: body.readingValue,
          notes: body.notes, loggedBy: context.userId,
        }) }, { status: 201 });
      case "share-doc":
        return NextResponse.json({ share: await shareDoc({
          tenantSlug: context.tenantSlug, docType: String(body.docType),
          docId: String(body.docId), sharedWith: String(body.sharedWith),
          permission: body.permission, createdBy: context.userId,
        }) });
      case "unshare-doc":
        await unshareDoc(context.tenantSlug, String(body.id));
        return NextResponse.json({ ok: true });
      case "award-points":
        return NextResponse.json({ log: await awardEnergyPoints({
          tenantSlug: context.tenantSlug, userId: String(body.userId),
          points: Number(body.points), reason: String(body.reason),
          docType: body.docType, docId: body.docId,
        }) }, { status: 201 });
      case "revert-points":
        return NextResponse.json({ log: await revertEnergyPoints(context.tenantSlug, String(body.id)) });
      case "upsert-post":
        return NextResponse.json({ post: await upsertCmsPost({
          tenantSlug: context.tenantSlug, id: body.id, title: String(body.title),
          slug: String(body.slug), content: String(body.content),
          excerpt: body.excerpt, category: body.category,
          coverImage: body.coverImage, published: body.published,
          author: context.userId,
        }) });
      case "upsert-page":
        return NextResponse.json({ page: await upsertCmsPage({
          tenantSlug: context.tenantSlug, id: body.id, title: String(body.title),
          slug: String(body.slug), content: String(body.content),
          published: body.published,
        }) });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: /not found|required|Invalid|must/i.test(msg) ? 400 : 500 });
  }
}
