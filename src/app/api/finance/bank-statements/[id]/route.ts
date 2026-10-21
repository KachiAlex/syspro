export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  postStatementLine, ignoreStatementLine, matchStatementLine, unmatchStatementLine,
} from "@/lib/finance/bank-statement";
import { validateTenantContext } from "@/lib/tenant-admin/utils";
import { requireModuleAccess } from "@/lib/api-auth";

type Params = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("post"),
    kind: z.enum(["bank_charge", "interest", "manual"]),
    expenseAccountCode: z.string().optional(),
    description: z.string().optional(),
  }),
  z.object({ action: z.literal("ignore") }),
  z.object({
    action: z.literal("match"),
    matchedEntity: z.enum(["finance_payment", "journal_entry_line"]),
    matchedId: z.string().min(1),
  }),
  z.object({ action: z.literal("unmatch") }),
]);

export async function POST(request: NextRequest, { params }: Params) {
  const context = validateTenantContext(request, "write");
  const gate = await requireModuleAccess(request, "finance", "write");
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  try {
    const out =
      parsed.data.action === "post"
        ? await postStatementLine({ tenantSlug: context.tenantSlug, lineId: id, ...parsed.data })
        : parsed.data.action === "match"
        ? await matchStatementLine({ tenantSlug: context.tenantSlug, lineId: id, ...parsed.data })
        : parsed.data.action === "unmatch"
        ? (await unmatchStatementLine(context.tenantSlug, id), { ok: true })
        : (await ignoreStatementLine(context.tenantSlug, id), { ok: true });
    return NextResponse.json(out);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
