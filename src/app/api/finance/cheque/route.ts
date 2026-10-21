export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertChequeTemplate, listChequeTemplates, renderCheque, amountInWords,
} from "@/lib/finance/cheque-print";
import { requireModuleAccess } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const _scope = await requireModuleAccess(request, "finance", "read");
  if (!_scope.ok) return _scope.response;
  const sp = request.nextUrl.searchParams;
  const tenantSlug = sp.get("tenantSlug");
  if (!tenantSlug) {
    return NextResponse.json({ success: false, error: "tenantSlug is required" }, { status: 400 });
  }
  const view = sp.get("view") ?? "templates";
  switch (view) {
    case "templates":
      return NextResponse.json({ success: true, data: await listChequeTemplates(tenantSlug) });
    case "words": {
      const amount = Number(sp.get("amount") ?? 0);
      return NextResponse.json({ success: true, data: { words: amountInWords(amount, sp.get("currency") ?? "Naira") } });
    }
    default:
      return NextResponse.json({ success: false, error: "view must be 'templates' or 'words'" }, { status: 400 });
  }
}

const schemas = {
  "upsert-template": z.object({
    tenantSlug: z.string().min(1), name: z.string().min(1),
    bank: z.string().optional(), fields: z.record(z.any()),
    scanUrl: z.string().optional(), isDefault: z.boolean().optional(),
  }),
  render: z.object({
    tenantSlug: z.string().min(1), templateId: z.string().optional(),
    payee: z.string().min(1), amount: z.coerce.number().positive(),
    date: z.string().min(8), accountNo: z.string().optional(), currency: z.string().optional(),
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
    const data = action === "upsert-template"
      ? await upsertChequeTemplate(input)
      : await renderCheque(input);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status ?? 500 });
  }
}
