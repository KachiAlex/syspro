export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  previewRepost,
  repostJournalEntries,
  glVsSubledgerComparison,
  listDeletionRecords,
  recordTransactionDeletion,
} from "@/lib/finance/ledger-integrity";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "gl-vs-subledger";
  switch (view) {
    case "gl-vs-subledger":
      return NextResponse.json({ success: true, data: await glVsSubledgerComparison({ tenantSlug }) });
    case "deletion-records":
      return NextResponse.json({
        success: true,
        data: await listDeletionRecords(tenantSlug, sp.get("documentType") ?? undefined),
      });
    case "repost-preview": {
      const ids = (sp.get("entryIds") ?? "").split(",").filter(Boolean);
      if (!ids.length) {
        return NextResponse.json({ success: false, error: "entryIds required" }, { status: 400 });
      }
      return NextResponse.json({ success: true, data: await previewRepost({ tenantSlug, entryIds: ids }) });
    }
    default:
      return NextResponse.json({ success: false, error: "view must be one of: gl-vs-subledger, deletion-records, repost-preview" }, { status: 400 });
  }
}

const repostSchema = z.object({
  action: z.literal("repost"),
  tenantSlug: z.string().min(1),
  entryIds: z.array(z.string().min(1)).min(1),
  corrections: z.record(z.object({
    accountCode: z.string().optional(),
    description: z.string().optional(),
    branchId: z.string().optional(),
    departmentId: z.string().optional(),
    projectId: z.string().optional(),
    costCenterId: z.string().optional(),
    dimensions: z.record(z.string()).optional(),
  })).optional(),
  reason: z.string().optional(),
});

const recordSchema = z.object({
  action: z.literal("record-deletion"),
  tenantSlug: z.string().min(1),
  documentType: z.string().min(1),
  documentId: z.string().min(1),
  documentData: z.unknown().optional(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const body = await request.json();
    const userId = (_scope as any).user?.id;
    if (body?.action === "repost") {
      const parsed = repostSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
      }
      const { action: _a, ...input } = parsed.data;
      return NextResponse.json({ success: true, data: await repostJournalEntries({ ...input, userId }) });
    }
    if (body?.action === "record-deletion") {
      const parsed = recordSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
      }
      const { action: _a, ...input } = parsed.data;
      await recordTransactionDeletion({ ...input, deletedBy: userId });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "action must be 'repost' or 'record-deletion'" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
