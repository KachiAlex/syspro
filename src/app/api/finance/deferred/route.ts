export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createDeferredItem,
  listDeferredItems,
  processDeferredAccounting,
  deferredReport,
} from "@/lib/finance/deferred";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const direction = (sp.get("direction") ?? undefined) as "revenue" | "expense" | undefined;

  if (sp.get("view") === "report") {
    const data = await deferredReport({ tenantSlug, direction });
    if (sp.get("format") === "csv") {
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const headers = ["Doc Type", "Document", "Party", "Item", "Direction", "Total", "Recognized", "Remaining", "Start", "End", "Status"];
      const rows = data.map((d) => [d.documentType, d.documentId, d.party ?? "", d.item ?? "", d.direction, d.totalAmount.toFixed(2), d.recognizedAmount.toFixed(2), d.remainingAmount.toFixed(2), d.serviceStartDate, d.serviceEndDate, d.status]);
      return new NextResponse([headers, ...rows].map((r) => r.map(esc).join(",")).join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="deferred-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }
    return NextResponse.json({ success: true, data });
  }
  return NextResponse.json({
    success: true,
    data: await listDeferredItems(tenantSlug, direction, sp.get("status") ?? undefined),
  });
}

const createSchema = z.object({
  action: z.literal("create").optional(),
  tenantSlug: z.string().min(1),
  direction: z.enum(["revenue", "expense"]),
  documentType: z.enum(["invoice", "bill"]),
  documentId: z.string().min(1),
  lineNo: z.coerce.number().int().optional(),
  party: z.string().optional(),
  item: z.string().optional(),
  totalAmount: z.coerce.number().positive(),
  serviceStartDate: z.string().min(8),
  serviceEndDate: z.string().min(8),
  recognitionAccountCode: z.string().min(1),
  deferredAccountCode: z.string().optional(),
});

const processSchema = z.object({
  action: z.literal("process"),
  tenantSlug: z.string().min(1),
  asOf: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const body = await request.json();
    if (body?.action === "process") {
      const parsed = processSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
      }
      const data = await processDeferredAccounting({
        ...parsed.data,
        userId: (_scope as any).user?.id,
      });
      return NextResponse.json({ success: true, data });
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const { action: _a, ...input } = parsed.data;
    const data = await createDeferredItem(input);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
