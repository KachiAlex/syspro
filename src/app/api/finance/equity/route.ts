export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertShareType, listShareTypes, upsertShareholder, listShareholders,
  recordShareTransfer, shareLedger, shareBalance,
} from "@/lib/finance/equity";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "shareholders";
  switch (view) {
    case "share-types":
      return NextResponse.json({ success: true, data: await listShareTypes(tenantSlug) });
    case "shareholders":
      return NextResponse.json({ success: true, data: await listShareholders(tenantSlug) });
    case "ledger":
      return NextResponse.json({ success: true, data: await shareLedger({
        tenantSlug, shareholderId: sp.get("shareholderId") ?? undefined,
        shareTypeId: sp.get("shareTypeId") ?? undefined,
      }) });
    case "balance":
      return NextResponse.json({ success: true, data: await shareBalance(tenantSlug) });
    default:
      return NextResponse.json({ success: false, error: "view must be one of: share-types, shareholders, ledger, balance" }, { status: 400 });
  }
}

const schemas = {
  "upsert-type": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1),
    faceValue: z.coerce.number().positive(), premium: z.coerce.number().optional(),
    capitalAccountCode: z.string().optional(), premiumAccountCode: z.string().optional(),
  }),
  "upsert-shareholder": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1),
    email: z.string().optional(), address: z.string().optional(), folioNo: z.string().optional(),
  }),
  transfer: z.object({
    tenantSlug: z.string().min(1),
    transferType: z.enum(["issue", "purchase", "transfer"]),
    shareTypeId: z.string().min(1),
    fromShareholderId: z.string().optional(), toShareholderId: z.string().optional(),
    qty: z.coerce.number().positive(), rate: z.coerce.number().nonnegative(),
    postingDate: z.string().min(8), bankAccountCode: z.string().optional(),
  }),
} as const;

export async function POST(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "write");
  if (!_scope.ok) return _scope.response;
  try {
    const body = await request.json();
    const action = body?.action as keyof typeof schemas | undefined;
    const schema = action ? schemas[action] : undefined;
    if (!schema) {
      return NextResponse.json(
        { success: false, error: `action must be one of: ${Object.keys(schemas).join(", ")}` },
        { status: 400 },
      );
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 });
    }
    const input = parsed.data as any;
    const userId = (_scope as any).user?.id;
    let data: unknown;
    switch (action) {
      case "upsert-type": data = await upsertShareType(input); break;
      case "upsert-shareholder": data = await upsertShareholder(input); break;
      case "transfer": data = await recordShareTransfer({ ...input, userId }); break;
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
