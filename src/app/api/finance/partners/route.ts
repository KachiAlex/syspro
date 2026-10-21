export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertSalesPartner, listSalesPartners, accrueCommission,
  payCommission, partnerCommissionReport,
} from "@/lib/finance/partners";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "partners";
  switch (view) {
    case "partners":
      return NextResponse.json({ success: true, data: await listSalesPartners(tenantSlug) });
    case "report":
      return NextResponse.json({ success: true, data: await partnerCommissionReport({
        tenantSlug, partnerId: sp.get("partnerId") ?? undefined,
        fromDate: sp.get("fromDate") ?? undefined, toDate: sp.get("toDate") ?? undefined,
      }) });
    default:
      return NextResponse.json({ success: false, error: "view must be 'partners' or 'report'" }, { status: 400 });
  }
}

const schemas = {
  "upsert-partner": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1),
    partnerType: z.enum(["agent", "reseller", "referrer", "distributor"]).optional(),
    commissionRate: z.coerce.number().nonnegative(),
    email: z.string().optional(), phone: z.string().optional(), territory: z.string().optional(),
    expenseAccountCode: z.string().optional(), payableAccountCode: z.string().optional(),
    active: z.boolean().optional(),
  }),
  accrue: z.object({
    tenantSlug: z.string().min(1), invoiceId: z.string().min(1), partnerId: z.string().min(1),
  }),
  pay: z.object({
    tenantSlug: z.string().min(1), commissionId: z.string().min(1),
    bankAccountCode: z.string().optional(), paidDate: z.string().optional(),
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
      case "upsert-partner": data = await upsertSalesPartner(input); break;
      case "accrue": data = await accrueCommission({ ...input, userId }); break;
      case "pay": data = await payCommission({ ...input, userId }); break;
    }
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
